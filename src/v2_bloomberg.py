"""Seconde version, après l'ouverture du test : données 1999-2026 et séries Bloomberg en référence.

Même protocole que la première version, rejoué de bout en bout :
  1. contrôle des séries Bloomberg (Tankan, IPC, VIX) contre la table mensuelle, et des dates de publication ;
  2. réglage Optuna sur l'entraînement 1999-2021 (TimeSeriesSplit), comme le notebook 02 ;
  3. calibration de Platt et choix du modèle sur la validation 2022-2023, règle du notebook 03 ;
  4. une évaluation sur le test 2024-2026, au format du notebook 03b.

Le test 2024-2026 a déjà été ouvert par la première version : ce résultat est une exploration après coup, pas un
test à l'aveugle. La décision et l'évaluation figées de runs/ ne sont pas touchées : tout s'écrit dans runs/v2_bloomberg/.

Usage : NIKKEI_CONFIG=config_bloomberg.yaml python -m src.v2_bloomberg [--essais 50] [--sans-reglage]
"""
import argparse
import json
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss

from .config import CFG, COLONNES, CONFIG, ROOT, RUNS, commit_courant
from .data import charger_mensuel, charger_table
from .decision import MARGE, actions, appliquer_platt, apprendre_platt, couts_entrainement, rendements, seuils

MODELES = ["logit", "rf", "lgbm"]
NOMS = {"logit": "logistique", "rf": "Random Forest", "lgbm": "LightGBM", "moyenne": "moyenne des trois"}


# ---------- 1. les séries Bloomberg ----------
def _serie_bloomberg(fichier: str) -> pd.Series:
    x = pd.read_excel(ROOT / CFG["data"]["bloomberg"] / fichier, header=3)
    x.columns = ["date", "valeur"]
    return x.assign(date=pd.to_datetime(x["date"])).set_index("date")["valeur"].astype(float)


def controle_bloomberg() -> dict:
    """Compare les séries Bloomberg à la table mensuelle, en tenant compte de leur date de publication."""
    mensuel = charger_mensuel()
    mois = mensuel.index.to_period("M")
    rapport = {}

    # Tankan : Bloomberg date l'enquête à la fin du trimestre ; elle n'est connue qu'au mois suivant
    # (début avril, juillet, octobre ; mi-décembre pour l'enquête de décembre, utilisée en janvier par prudence).
    tankan = _serie_bloomberg("Trimestre_JNTSMFG_INDEX_HP.xlsx")
    publie = pd.Series(tankan.to_numpy(), index=tankan.index.to_period("M") + 1)
    table = pd.Series(mensuel["tankan_large_manuf"].to_numpy(), index=mois)
    communs = publie.index.intersection(table.index)
    egaux = int((publie[communs] == table[communs]).sum())
    naif = pd.Series(tankan.to_numpy(), index=tankan.index.to_period("M"))
    communs_naif = naif.index.intersection(table.index)
    rapport["tankan"] = {
        "trimestres_compares": int(len(communs)), "valeurs_identiques": egaux,
        "regle": "valeur de l'enquête du trimestre utilisée à partir du mois suivant sa date Bloomberg",
        "erreur_si_date_bloomberg_prise_telle_quelle": f"{int((naif[communs_naif] != table[communs_naif]).sum())} trimestres "
                                                       "auraient utilisé l'enquête avant sa publication"}

    # IPC : publié le mois suivant ; la table mensuelle utilise une autre mesure (indice recalculé)
    ipc = _serie_bloomberg("Monthly_JNCPIYOY_INDEX_HP.xlsx")
    ipc_m = pd.Series(ipc.to_numpy(), index=ipc.index.to_period("M"))
    table_ipc = pd.Series(mensuel["cpi_all_yoy"].to_numpy(), index=mois).dropna()
    corr = {f"decalage_{k}": float(ipc_m.shift(k, freq="M").reindex(table_ipc.index).corr(table_ipc)) for k in range(3)}
    rapport["ipc"] = {"mois_compares": int(ipc_m.index.intersection(table_ipc.index).size), "correlations": corr,
                      "lecture": "même tendance, mais ce n'est pas la même mesure que l'IPC officiel ; l'IPC n'est pas une variable du modèle"}

    # VIX : l'export Bloomberg a été converti en euros, ce qui n'a pas de sens pour un indice de volatilité
    vix = _serie_bloomberg("Monthly_VIX_HP.xlsx")
    vix_m = pd.Series(vix.to_numpy(), index=vix.index.to_period("M"))
    table_vix = pd.Series(mensuel["vix"].to_numpy(), index=mois)
    ratio = (vix_m / table_vix.reindex(vix_m.index)).dropna()
    rapport["vix"] = {"mois_compares": int(len(ratio)), "ratio_median_bloomberg_sur_vix": float(ratio.median()),
                      "ratio_min": float(ratio.min()), "ratio_max": float(ratio.max()),
                      "decision": "non utilisé : export « EUR, as exported », converti au taux de change ; le VIX en points (Cboe) de la table est gardé"}

    # Calendrier Bloomberg des publications (export limité à 5 000 lignes : 1999-2006)
    cal = pd.read_excel(ROOT / CFG["data"]["bloomberg"] / "calendrier_chiffres_1999_2006.xlsx")
    cal["quand"] = pd.to_datetime(cal["Date Time"], errors="coerce", format="mixed")
    publications = {}
    for ticker, nom in [("JNTSMFG Index", "tankan"), ("JNCPIYOY Index", "ipc")]:
        c = cal[cal["Ticker"] == ticker].dropna(subset=["quand"])
        publications[nom] = {"publications": int(len(c)), "premiere": str(c["quand"].min().date()), "derniere": str(c["quand"].max().date()),
                             "jour_du_mois_median": float(c["quand"].dt.day.median()),
                             "publiees_en_decembre": int((c["quand"].dt.month == 12).sum())}
    rapport["calendrier"] = {"lignes": int(len(cal)), "couvre": f"{cal['quand'].min().date()} → {cal['quand'].max().date()}",
                             "limite": "export tronqué à 5 000 lignes : à refaire par périodes pour couvrir 2007-2026",
                             "publications": publications}
    return rapport


# ---------- 3. la décision, règle du notebook 03 ----------
def decider() -> dict:
    table = charger_table()
    train, valid = table[table["bloc"] == "entraînement"], table[table["bloc"] == "validation"]
    pred = pd.read_csv(RUNS / "predictions_02.csv", parse_dates=["date"])
    nik = pred[pred["cible"] == "nikkei"]
    platt, calibre_va = {}, {}
    for m in MODELES:
        hf = nik[(nik["modele"] == m) & (nik["bloc"] == "hors fold")]
        platt[m] = apprendre_platt(hf["p"].to_numpy(), hf["y"].astype(int).to_numpy())
        va = nik[(nik["modele"] == m) & (nik["bloc"] == "validation")].set_index("date")["p"]
        calibre_va[m] = pd.Series(appliquer_platt(va.to_numpy(), platt[m]), index=va.index)
    calibre_va = pd.DataFrame(calibre_va)
    calibre_va["moyenne"] = calibre_va[MODELES].mean(axis=1)
    y_va = valid["y_baisse"].astype(int).reindex(calibre_va.index)
    pr = {m: float(average_precision_score(y_va, calibre_va[m])) for m in calibre_va}
    ll = {m: float(log_loss(y_va, calibre_va[m], labels=[0, 1])) for m in calibre_va}
    candidats = [m for m in ["rf", "lgbm", "moyenne"] if pr[m] > pr["logit"] and ll[m] < ll["logit"]]
    choix = "logit" if not candidats else min(candidats, key=lambda m: ll[m])
    ll_const = float(log_loss(y_va, np.full(len(y_va), train["y_baisse"].mean()), labels=[0, 1]))
    couts = couts_entrainement(train)
    return {"date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(), "configuration": CONFIG.name,
            "modele_nikkei": choix, "fichiers_modeles": {m: f"{RUNS.relative_to(ROOT)}/models/nikkei_{m}.joblib" for m in MODELES},
            "sortie_du_modele": "P(baisse) ; p_hausse = 1 - P(baisse) calibrée", "platt": platt,
            "couts_entrainement_exces_du_cash": couts, "marge_m": MARGE, "seuils": seuils(couts, MARGE),
            "couverture": "toujours couvert (h = 1)",
            "regle_choix_modele": "la logistique sauf si un modèle plus complexe la bat en PR-AUC et en log-loss calibrée sur la validation",
            "validation": {"pr_auc": pr, "log_loss_calibree": ll, "log_loss_constante": ll_const,
                           "plancher_battu": bool(ll[choix] < ll_const)},
            "mois_entrainement": int(len(train)), "premier_mois": str(train.index.min().date())}


# ---------- 4. l'évaluation, format du notebook 03b ----------
def _fiabilite(y, p, groupes=5):
    g = pd.qcut(pd.Series(p).rank(method="first"), q=groupes, labels=False)
    d = pd.DataFrame({"y": np.asarray(y), "p": np.asarray(p), "g": g.values})
    t = d.groupby("g").agg(conf=("p", "mean"), acc=("y", "mean"), n=("y", "size"))
    return float((t["n"] / t["n"].sum() * (t["acc"] - t["conf"]).abs()).sum())


def _scores(y, p) -> dict:
    return {"log-loss": float(log_loss(y, p, labels=[0, 1])), "Brier": float(brier_score_loss(y, p)), "ECE": _fiabilite(y, p),
            "PR-AUC": float(average_precision_score(y, p)), "proba moyenne": float(np.mean(p)), "fréquence observée": float(np.mean(y))}


def _perf(r) -> dict:
    w = np.cumprod(1 + np.asarray(r))
    return {"cumul": float(w[-1] - 1), "annualisé": float(w[-1] ** (12 / len(w)) - 1),
            "perte maximale": float(np.min(w / np.maximum.accumulate(w)) - 1)}


def _probas(dec: dict, bloc: pd.DataFrame) -> pd.DataFrame:
    p = {m: appliquer_platt(joblib.load(ROOT / dec["fichiers_modeles"][m]).predict_proba(bloc[COLONNES])[:, 1], dec["platt"][m])
         for m in MODELES}
    p = pd.DataFrame(p, index=bloc.index)
    p["moyenne"] = p[MODELES].mean(axis=1)
    return p


def _historique(dec: dict, bloc: pd.DataFrame, p_baisse: pd.Series) -> list:
    p_hausse = 1 - p_baisse
    act = actions(p_hausse, dec["couts_entrainement_exces_du_cash"], dec["marge_m"])
    r = rendements(act, bloc)
    cash = bloc["eur_overnight"] / 100 / 12
    return [{"date": d.strftime("%Y-%m"), "p_hausse": round(float(p_hausse[d]), 6), "action": act[d],
             "hausse_realisee": int(bloc.loc[d, "y_baisse"] == 0), "rendement_regle": round(float(r[d]), 6),
             "rendement_achat_couvert": round(float(bloc.loc[d, "target_reur_hedged_next"]), 6),
             "rendement_achat_non_couvert": round(float(bloc.loc[d, "target_reur_unhedged_next"]), 6),
             "rendement_vente": round(float(bloc.loc[d, "target_short_eur_next"]), 6), "rendement_cash": round(float(cash[d]), 6)}
            for d in bloc.index]


def evaluer(dec: dict) -> dict:
    table = charger_table()
    train, valid, test = (table[table["bloc"] == b] for b in ["entraînement", "validation", "test"])
    y = test["y_baisse"].astype(int)
    p = _probas(dec, test)
    p_const = float(train["y_baisse"].mean())
    metriques = {NOMS[m]: _scores(y, p[m]) for m in MODELES}
    if dec["modele_nikkei"] == "moyenne":
        metriques[NOMS["moyenne"]] = _scores(y, p["moyenne"])
    metriques["constante (fréquence de l'entraînement)"] = _scores(y, np.full(len(y), p_const))
    p_choisi = p[dec["modele_nikkei"]]
    hist = _historique(dec, test, p_choisi)
    act = pd.Series([h["action"] for h in hist], index=test.index)
    r_regle = pd.Series([h["rendement_regle"] for h in hist], index=test.index)
    cash = test["eur_overnight"] / 100 / 12
    expo = act.map({"acheter": 1, "neutre": 0, "vendre": -1}).mean()
    perf = {"règle du modèle": _perf(r_regle), "toujours acheter, couvert": _perf(test["target_reur_hedged_next"]),
            "toujours acheter, non couvert": _perf(test["target_reur_unhedged_next"]), "toujours neutre (cash)": _perf(cash),
            f"même exposition moyenne ({expo:.0%}), sans timing": _perf(cash + expo * (test["target_reur_hedged_next"] - cash))}
    ll_m = lambda q, yy: -(yy * np.log(q) + (1 - yy) * np.log(1 - q))
    ecarts = ll_m(np.clip(p_choisi.to_numpy(), 1e-6, 1 - 1e-6), y.to_numpy()) - ll_m(p_const, y.to_numpy())
    ll_choisi, ll_const = metriques[NOMS[dec["modele_nikkei"]]]["log-loss"], metriques["constante (fréquence de l'entraînement)"]["log-loss"]
    return {"date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(), "configuration": CONFIG.name,
            "avertissement": "Seconde version, après l'ouverture du test 2024-2026 par la première : exploration après coup, pas un test à l'aveugle.",
            "mois_entrainement": int(len(train)), "mois_test": int(len(test)), "baisses_test": int(y.sum()),
            "modele": NOMS[dec["modele_nikkei"]], "metriques": metriques, "actions": act.value_counts().to_dict(),
            "performance_euros": perf, "plancher_battu": bool(ll_choisi < ll_const),
            "ecart_log_loss": {"moyenne": float(ecarts.mean()), "ecart_type": float(ecarts.std(ddof=1)),
                               "erreur_type": float(ecarts.std(ddof=1) / np.sqrt(len(ecarts)))},
            "historique_test": hist,
            "historique_validation": _historique(dec, valid, _probas(dec, valid)[dec["modele_nikkei"]])}


def main(n_essais: int, regler: bool) -> None:
    assert RUNS.name == "v2_bloomberg", "lancer avec NIKKEI_CONFIG=config_bloomberg.yaml : la première version ne doit pas être réécrite"
    RUNS.mkdir(parents=True, exist_ok=True)
    rapport = controle_bloomberg()
    (RUNS / "controle_bloomberg.json").write_text(json.dumps(rapport, indent=2, ensure_ascii=False))
    print(f"Tankan : {rapport['tankan']['valeurs_identiques']}/{rapport['tankan']['trimestres_compares']} trimestres identiques ; "
          f"VIX Bloomberg / VIX : {rapport['vix']['ratio_median_bloomberg_sur_vix']:.3f} (non utilisé)")
    if regler:
        from .tune import main as regler_optuna
        regler_optuna(n_essais, RUNS)
    dec = decider()
    (RUNS / "decision_finale.json").write_text(json.dumps(dec, indent=2, ensure_ascii=False))
    print(f"décision : {NOMS[dec['modele_nikkei']]} ; validation {dec['validation']['log_loss_calibree'][dec['modele_nikkei']]:.3f} "
          f"contre {dec['validation']['log_loss_constante']:.3f} pour la constante ; seuils {dec['seuils']}")
    ev = evaluer(dec)
    (RUNS / "evaluation_test.json").write_text(json.dumps(ev, indent=2, ensure_ascii=False))
    m, constante = ev["metriques"], "constante (fréquence de l'entraînement)"
    print(f"test : log-loss {m[ev['modele']]['log-loss']:.3f} contre {m[constante]['log-loss']:.3f} "
          f"pour la constante ; écart {ev['ecart_log_loss']['moyenne']:+.3f} ± {ev['ecart_log_loss']['erreur_type']:.3f} ; "
          f"règle {ev['performance_euros']['règle du modèle']['cumul']:+.1%} ; actions {ev['actions']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--essais", type=int, default=50)
    parser.add_argument("--sans-reglage", action="store_true", help="réutiliser les modèles déjà réglés de runs/v2_bloomberg/")
    args = parser.parse_args()
    main(args.essais, not args.sans_reglage)
