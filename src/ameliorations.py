"""Troisième étape, après coup : appliquer les leviers d'amélioration sans surapprendre.

Le protocole (variantes, réglages, périodes, critères) est écrit dans runs/v3_ameliorations/protocole.json
AVANT tout calcul de résultat, avec son empreinte SHA-256. L'évaluation refuse de tourner si le protocole
du code ne correspond plus à celui qui a été figé.

Principes contre le surapprentissage :
  - chaque variante est réentraînée chaque mois sur tous les mois connus depuis 1999 (fenêtre croissante) ;
  - tous les réglages sont fixés à l'avance, aucun réglage automatique (pas d'Optuna) ;
  - la période de jugement est 2010-2023 ; une variante n'est retenue que si elle bat la référence
    après correction de Holm ET sur les deux sous-périodes 2010-2016 et 2017-2023 ;
  - 2024-2026 a déjà été ouvert par la V1 et la V2 : affiché à titre indicatif, jamais utilisé pour choisir.

Usage :
  python -m src.ameliorations --figer     écrit le protocole (refusé s'il existe déjà)
  python -m src.ameliorations             calcule tout, après avoir vérifié le protocole figé
"""
import argparse
import hashlib
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
import yaml
from joblib import Parallel, delayed
from scipy.stats import norm
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import COLONNES, ROOT, SEED, commit_courant
from .decision import MARGE, actions, couts_entrainement
from .pipeline import construire_pipeline

V2 = yaml.safe_load(open(ROOT / "config_bloomberg.yaml"))
DOSSIER = ROOT / "runs" / "v3_ameliorations"
FICHIER_PROTOCOLE = DOSSIER / "protocole.json"

# Six variables choisies pour une raison économique connue avant les données, pas pour leur score :
ECONOMIQUES = ["n225_mom_12m",      # momentum 12 mois (Moskowitz, Ooi et Pedersen, 2012)
               "jgb_slope_10y2y",   # pente des taux japonais 10 ans - 2 ans (Fama et French, 1989)
               "us_slope_10y3m",    # pente des taux américains, indicateur avancé du cycle mondial
               "d_cli_jpn",         # variation de l'indicateur avancé OCDE du Japon
               "vix",               # appétit pour le risque mondial
               "n225_vol_ewma"]     # volatilité récente du Nikkei (arbitrage rendement-risque)
AJOUTEES = ["jgb_slope_10y2y", "us_slope_10y3m", "d_cli_jpn"]       # prises dans dataset_monthly2.csv

C_PROJET, C_FORT, ALPHA_RIDGE = 0.03, 0.003, 100.0
VOL_CIBLE, FRAIS, MELANGE = 0.15, 0.0005, 0.5
TIRAGES, BLOC, SEUIL = 5000, 12, 0.05

PERIODES = {"2010-2023 (jugement)": ("2010-01-01", "2023-12-31"),
            "2010-2016": ("2010-01-01", "2016-12-31"),
            "2017-2023": ("2017-01-01", "2023-12-31"),
            "2024-2026 (déjà vu, indicatif)": ("2024-01-01", "2026-09-30")}
JUGEMENT, SOUS_PERIODES, DEJA_VU = "2010-2023 (jugement)", ["2010-2016", "2017-2023"], "2024-2026 (déjà vu, indicatif)"

PROBABILITES = {
    "constante": "fréquence des baisses sur tout le passé connu (la référence)",
    "logistique du projet": f"13 variables du projet + régimes k-means, L2, C = {C_PROJET} (valeur retenue par la V1)",
    "logistique très pénalisée": f"mêmes variables, C = {C_FORT} : dix fois plus tirée vers la constante",
    "logistique du projet, mélangée à la constante": f"moyenne {MELANGE:.0%} logistique du projet, {1 - MELANGE:.0%} constante",
    "logistique économique": f"6 variables économiques, sans news ni régimes, L2, C = {C_PROJET}",
    "logistique économique, mélangée à la constante": f"moyenne {MELANGE:.0%} logistique économique, {1 - MELANGE:.0%} constante",
    "ridge sur le rendement": f"régression ridge (alpha = {ALPHA_RIDGE:g}) du rendement suivant sur les 6 variables économiques, "
                              "puis P(baisse) = Φ(-rendement prévu / volatilité récente mensuelle)",
}
LEVIERS = {
    "achat couvert, toujours": "la référence : acheter le Nikkei chaque mois, change couvert",
    "achat non couvert": "acheter sans couvrir le yen",
    "couverture à moitié": "acheter, couvrir la moitié du yen",
    "couvert seulement si le carry est positif": "couvrir quand la couverture rapporte (carry > 0), sinon ne pas couvrir",
    "achat couvert, dosé par la volatilité": f"part investie = min(1, {VOL_CIBLE:.0%} / volatilité récente), le reste au cash",
}
REFERENCE_EUROS = "achat couvert, toujours"

PROTOCOLE = {
    "question": "Quels leviers améliorent la prévision du mois suivant et la règle en euros, sans surapprendre ?",
    "donnees": "data/3_modele/dataset_model2.csv (1999-2026, Bloomberg en référence) + " + ", ".join(AJOUTEES)
               + " de data/2_construites/dataset_monthly2.csv",
    "reentrainement": "chaque mois, sur tous les mois connus depuis janvier 1999 (fenêtre croissante)",
    "reglages": "fixés ici, avant tout calcul ; aucun réglage automatique",
    "variables_economiques": ECONOMIQUES,
    "periodes": PERIODES,
    "periode_de_jugement": JUGEMENT,
    "probabilites": PROBABILITES,
    "critere_probabilites": "log-loss mensuelle comparée à la constante, mois par mois (test de Diebold-Mariano unilatéral) ; "
                            f"correction de Holm sur les variantes ; retenue si p corrigée < {SEUIL} et log-loss plus basse "
                            "que la constante sur 2010-2016 et sur 2017-2023",
    "regle_de_decision": f"celle du projet : gain espéré au-dessus du cash comparé à la marge {MARGE}, coûts appris sur le passé connu",
    "leviers_euros": LEVIERS | {f"règle : {v}": "acheter, neutre ou vendre selon la probabilité de cette variante" for v in PROBABILITES},
    "reference_euros": REFERENCE_EUROS,
    "critere_euros": f"ratio de Sharpe annualisé (rendement au-dessus du cash / écart-type) ; bootstrap par blocs de {BLOC} mois, "
                     f"{TIRAGES} tirages, graine {SEED} ; Holm sur les leviers ; retenu si p corrigée < {SEUIL} et Sharpe plus haut "
                     "que la référence sur 2010-2016 et sur 2017-2023",
    "frais": f"{FRAIS:.2%} par 100 % de position achetée ou vendue, pour toutes les stratégies",
    "assemblage_final": "les leviers retenus sont combinés (une seule politique de couverture : celle au meilleur Sharpe 2010-2023) ; "
                        "si aucun n'est retenu, on garde la référence : probabilité constante et achat couvert",
    "deja_vu": "2024-2026 a été ouvert par la V1 et la V2 : affiché à titre indicatif, jamais utilisé pour choisir",
    "ce_que_l_auteur_savait": "les explorations après coup sur 2016-2023 (runs/exploration_apres_coup.json) montraient déjà qu'aucun "
                              "modèle ne battait nettement la constante, et C = 0,03 est la valeur réglée par la V1 sur son "
                              "entraînement (qui recouvre 2010-2021) ; les autres choix sont des valeurs standards de la littérature",
}


def empreinte(protocole: dict) -> str:
    return hashlib.sha256(json.dumps(protocole, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def figer() -> None:
    if FICHIER_PROTOCOLE.exists():
        raise SystemExit(f"{FICHIER_PROTOCOLE.relative_to(ROOT)} existe déjà : un protocole figé ne se réécrit pas")
    DOSSIER.mkdir(parents=True, exist_ok=True)
    FICHIER_PROTOCOLE.write_text(json.dumps({"fige_le": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "commit_du_code": commit_courant(),
                                             "sha256": empreinte(PROTOCOLE), "protocole": PROTOCOLE}, indent=2, ensure_ascii=False))
    print(f"protocole figé : {FICHIER_PROTOCOLE.relative_to(ROOT)} (sha256 {empreinte(PROTOCOLE)[:12]}…)")


def verifier_protocole() -> dict:
    if not FICHIER_PROTOCOLE.exists():
        raise SystemExit("aucun protocole figé : lancer d'abord python -m src.ameliorations --figer")
    fige = json.loads(FICHIER_PROTOCOLE.read_text())
    if fige["sha256"] != empreinte(PROTOCOLE) or fige["protocole"] != json.loads(json.dumps(PROTOCOLE, ensure_ascii=False)):
        raise SystemExit("le protocole du code a changé depuis qu'il a été figé : évaluation refusée")
    return fige


# ---------- 1. les données ----------
def charger() -> pd.DataFrame:
    t = pd.read_csv(ROOT / V2["data"]["model_table"], parse_dates=["date"]).set_index("date")
    m = pd.read_csv(ROOT / V2["data"]["monthly"], parse_dates=["date"]).set_index("date")
    for c in AJOUTEES:
        t[c] = m[c].reindex(t.index)
    assert t[ECONOMIQUES].notna().all().all(), "une variable économique manque"
    return t


# ---------- 2. les probabilités, mois après mois ----------
def _simple(modele) -> Pipeline:
    return Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", modele)])


def marcher(nom: str, table: pd.DataFrame, debut: int) -> tuple[pd.Series, pd.DataFrame]:
    """Probabilité de baisse du mois suivant, chaque mois t appris sur les mois strictement antérieurs."""
    warnings.filterwarnings("ignore")
    p, coefs = {}, {}
    for t in range(debut, len(table)):
        passe, ligne, date = table.iloc[:t], table.iloc[[t]], table.index[t]
        y = passe["y_baisse"].astype(int)
        if nom == "constante":
            q = y.mean()
        elif nom == "ridge sur le rendement":
            pipe = _simple(Ridge(alpha=ALPHA_RIDGE)).fit(passe[ECONOMIQUES], passe["target_rn_next"])
            mu, sigma = pipe.predict(ligne[ECONOMIQUES])[0], ligne["n225_vol_ewma"].iloc[0] / np.sqrt(12)
            q = norm.cdf(-mu / sigma)
            coefs[date] = dict(zip(ECONOMIQUES, pipe[-1].coef_)) | {"constante": pipe[-1].intercept_}
        elif nom == "logistique économique":
            pipe = _simple(LogisticRegression(C=C_PROJET, max_iter=5000)).fit(passe[ECONOMIQUES], y)
            q = pipe.predict_proba(ligne[ECONOMIQUES])[0, 1]
            coefs[date] = dict(zip(ECONOMIQUES, pipe[-1].coef_[0])) | {"constante": pipe[-1].intercept_[0]}
        else:
            C = C_PROJET if nom == "logistique du projet" else C_FORT
            pipe = construire_pipeline(LogisticRegression(C=C, max_iter=5000)).fit(passe[COLONNES], y)
            q = pipe.predict_proba(ligne[COLONNES])[0, 1]
        p[date] = float(np.clip(q, 1e-4, 1 - 1e-4))
    return pd.Series(p, name=nom), pd.DataFrame(coefs).T.assign(modele=nom)


def probabilites(table: pd.DataFrame, debut: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    appris = [v for v in PROBABILITES if "mélangée" not in v]
    sorties = Parallel(n_jobs=-1)(delayed(marcher)(v, table, debut) for v in appris)
    p = pd.concat([s for s, _ in sorties], axis=1)
    for base in ["logistique du projet", "logistique économique"]:
        p[f"{base}, mélangée à la constante"] = MELANGE * p[base] + (1 - MELANGE) * p["constante"]
    coefs = pd.concat([c for _, c in sorties if len(c)]).rename_axis("date")
    return p[list(PROBABILITES)], coefs


# ---------- 3. les stratégies en euros ----------
def actions_regle(p_baisse: pd.Series, table: pd.DataFrame) -> pd.Series:
    """La règle du projet, mois par mois, avec les coûts appris sur le passé connu à ce mois."""
    sortie = {}
    for date, p in p_baisse.items():
        couts = couts_entrainement(table.iloc[:table.index.get_loc(date)])
        sortie[date] = actions(pd.Series([1 - p], index=[date]), couts, MARGE).iloc[0]
    return pd.Series(sortie)


def strategie(table: pd.DataFrame, sens: pd.Series, couvert: pd.Series, poids: pd.Series) -> pd.Series:
    """Rendement en euros du mois suivant ; sens dans {1, 0, -1}, part couverte et part investie dans [0, 1]."""
    cash = table["eur_overnight"] / 100 / 12
    achat = couvert * table["target_reur_hedged_next"] + (1 - couvert) * table["target_reur_unhedged_next"]
    brut = pd.Series(np.select([sens > 0, sens < 0], [achat, table["target_short_eur_next"]], cash), index=table.index)
    position = sens * poids
    return poids * brut + (1 - poids) * cash - FRAIS * position.diff().abs().fillna(0)


def leviers(table: pd.DataFrame, regles: dict) -> pd.DataFrame:
    un = pd.Series(1.0, index=table.index)
    carry_positif = (table["carry_1m"] > 0).astype(float)
    dose = (VOL_CIBLE / table["n225_vol_ewma"]).clip(upper=1.0)
    r = {"achat couvert, toujours": strategie(table, un, un, un),
         "achat non couvert": strategie(table, un, 0 * un, un),
         "couverture à moitié": strategie(table, un, 0.5 * un, un),
         "couvert seulement si le carry est positif": strategie(table, un, carry_positif, un),
         "achat couvert, dosé par la volatilité": strategie(table, un, un, dose)}
    for nom, act in regles.items():
        r[f"règle : {nom}"] = strategie(table, act.map({"acheter": 1, "neutre": 0, "vendre": -1}).astype(float), un, un)
    return pd.DataFrame(r)


# ---------- 4. les tests ----------
def perte(y, p) -> np.ndarray:
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


def holm(p: dict) -> dict:
    """p-valeurs corrigées de Holm (contrôle du risque de se tromper au moins une fois)."""
    ordre, m, sortie, courant = sorted(p, key=p.get), len(p), {}, 0.0
    for i, cle in enumerate(ordre):
        courant = max(courant, min(1.0, (m - i) * p[cle]))
        sortie[cle] = courant
    return sortie


def sharpe(exces) -> float:
    exces = np.asarray(exces, dtype=float)
    s = exces.std(ddof=1)
    return float(exces.mean() / s * np.sqrt(12)) if s > 0 else 0.0


def bootstrap_sharpe(a, b) -> dict:
    """Écart de Sharpe a - b, bootstrap circulaire par blocs (mêmes mois tirés pour a et b)."""
    a, b, n = np.asarray(a, dtype=float), np.asarray(b, dtype=float), len(a)
    rng = np.random.default_rng(SEED)
    debuts = rng.integers(0, n, size=(TIRAGES, int(np.ceil(n / BLOC))))
    idx = ((debuts[:, :, None] + np.arange(BLOC)) % n).reshape(TIRAGES, -1)[:, :n]

    def s(x):
        e = x.std(axis=1, ddof=1)
        return np.where(e > 0, x.mean(axis=1) / np.where(e > 0, e, 1), 0.0) * np.sqrt(12)

    ecarts = s(a[idx]) - s(b[idx])
    return {"ecart": sharpe(a) - sharpe(b), "ic_90": [float(np.quantile(ecarts, 0.05)), float(np.quantile(ecarts, 0.95))],
            "p_unilaterale": float(np.mean(ecarts <= 0))}


def bilan_proba(y, p, ref) -> dict:
    ecart = perte(y, p) - perte(y, ref)
    se = ecart.std(ddof=1) / np.sqrt(len(ecart))
    return {"mois": int(len(y)), "log_loss": float(perte(y, p).mean()), "ecart_vs_constante": float(ecart.mean()),
            "erreur_type": float(se), "p_unilaterale": float(norm.cdf(ecart.mean() / se)) if se > 0 else 1.0,
            "brier": float(brier_score_loss(y, p)), "auc": float(roc_auc_score(y, p)) if len(set(p)) > 1 else 0.5,
            "pr_auc": float(average_precision_score(y, p)), "proba_moyenne": float(np.mean(p)), "frequence_observee": float(np.mean(y))}


def bilan_euros(r: pd.Series, cash: pd.Series) -> dict:
    valeur = (1 + r).cumprod()
    return {"mois": int(len(r)), "cumul": float(valeur.iloc[-1] - 1), "annualise": float(valeur.iloc[-1] ** (12 / len(r)) - 1),
            "volatilite": float(r.std(ddof=1) * np.sqrt(12)), "sharpe": sharpe(r - cash),
            "perte_maximale": float((valeur / valeur.cummax() - 1).min()), "pire_mois": float(r.min())}


# ---------- 5. tout assembler ----------
def main() -> None:
    fige = verifier_protocole()
    table = charger()
    debut = table.index.get_loc(table.index[table.index >= PERIODES[JUGEMENT][0]][0])
    p, coefs = probabilites(table, debut)
    connus = table.loc[p.index, "y_baisse"].notna()
    regles = {v: actions_regle(p[v], table) for v in PROBABILITES}
    r = leviers(table.loc[p.index], regles)
    cash = table.loc[p.index, "eur_overnight"] / 100 / 12
    mois = {k: p.index[connus & (p.index >= a) & (p.index <= b)] for k, (a, b) in PERIODES.items()}

    # Probabilités
    res_p = {}
    for per, idx in mois.items():
        y = table.loc[idx, "y_baisse"].astype(int).to_numpy()
        res_p[per] = {v: bilan_proba(y, p.loc[idx, v].to_numpy(), p.loc[idx, "constante"].to_numpy()) for v in PROBABILITES}
    candidats = [v for v in PROBABILITES if v != "constante"]
    p_holm = holm({v: res_p[JUGEMENT][v]["p_unilaterale"] for v in candidats})
    tests_p = {v: {"ecart_vs_constante": res_p[JUGEMENT][v]["ecart_vs_constante"], "erreur_type": res_p[JUGEMENT][v]["erreur_type"],
                   "p_unilaterale": res_p[JUGEMENT][v]["p_unilaterale"], "p_holm": p_holm[v],
                   "mieux_sur": {s: bool(res_p[s][v]["ecart_vs_constante"] < 0) for s in SOUS_PERIODES}} for v in candidats}
    for v, t in tests_p.items():
        t["retenue"] = bool(t["p_holm"] < SEUIL and all(t["mieux_sur"].values()))

    # Euros
    res_e = {per: {s: bilan_euros(r.loc[idx, s], cash[idx]) for s in r.columns} for per, idx in mois.items()}
    ref = r[REFERENCE_EUROS] - cash
    autres = [s for s in r.columns if s != REFERENCE_EUROS]
    boot = {s: bootstrap_sharpe((r[s] - cash)[mois[JUGEMENT]], ref[mois[JUGEMENT]]) for s in autres}
    e_holm = holm({s: boot[s]["p_unilaterale"] for s in autres})
    tests_e = {s: boot[s] | {"p_holm": e_holm[s],
                             "mieux_sur": {sp: bool(res_e[sp][s]["sharpe"] > res_e[sp][REFERENCE_EUROS]["sharpe"]) for sp in SOUS_PERIODES}}
               for s in autres}
    for s, t in tests_e.items():
        t["retenu"] = bool(t["p_holm"] < SEUIL and all(t["mieux_sur"].values()))

    # Assemblage final : seulement ce qui a passé les deux critères
    proba_retenues = [v for v in candidats if tests_p[v]["retenue"]]
    proba = min(proba_retenues, key=lambda v: res_p[JUGEMENT][v]["log_loss"]) if proba_retenues else "constante"
    couvertures = [s for s in ["achat non couvert", "couverture à moitié", "couvert seulement si le carry est positif"] if tests_e[s]["retenu"]]
    couverture = max(couvertures, key=lambda s: res_e[JUGEMENT][s]["sharpe"]) if couvertures else REFERENCE_EUROS
    dosage = tests_e["achat couvert, dosé par la volatilité"]["retenu"]
    regle = tests_e.get(f"règle : {proba}", {}).get("retenu", False) and proba != "constante"
    t = table.loc[p.index]
    part_couverte = {"achat non couvert": 0.0 * t["carry_1m"], "couverture à moitié": 0.5 + 0 * t["carry_1m"],
                     "couvert seulement si le carry est positif": (t["carry_1m"] > 0).astype(float)}.get(couverture, 1 + 0 * t["carry_1m"])
    poids = (VOL_CIBLE / t["n225_vol_ewma"]).clip(upper=1.0) if dosage else 1 + 0 * t["carry_1m"]
    sens = regles[proba].map({"acheter": 1, "neutre": 0, "vendre": -1}).astype(float) if regle else 1 + 0 * t["carry_1m"]
    final = strategie(t, sens, part_couverte, poids)
    r["assemblage final"] = final
    for per, idx in mois.items():
        res_e[per]["assemblage final"] = bilan_euros(final[idx], cash[idx])

    derniere = p.index[-1]
    prochain = {"donnees_arretees_au": str(derniere.date()), "mois_prevu": (derniere.to_period("M") + 1).strftime("%Y-%m"),
                "probabilites_de_baisse": {v: float(p.loc[derniere, v]) for v in PROBABILITES},
                "assemblage": {"probabilite_utilisee": proba, "p_baisse": float(p.loc[derniere, proba]),
                               "sens": {1.0: "acheter", 0.0: "neutre", -1.0: "vendre"}[float(sens[derniere])],
                               "part_couverte": float(part_couverte[derniere]), "part_investie": float(poids[derniere]),
                               "volatilite_recente": float(t.loc[derniere, "n225_vol_ewma"]), "carry_1m": float(t.loc[derniere, "carry_1m"])}}

    derniers_coefs = {m: coefs[coefs["modele"] == m].drop(columns="modele").iloc[-1].dropna().to_dict()
                      for m in coefs["modele"].unique()}
    sortie = {
        "avertissement": "Troisième étape, après l'ouverture du test 2024-2026 par la V1 et la V2. Le protocole a été figé avant le calcul "
                         "(protocole.json) ; 2024-2026 est montré à titre indicatif seulement.",
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
        "protocole": {"fichier": str(FICHIER_PROTOCOLE.relative_to(ROOT)), "sha256": fige["sha256"], "fige_le": fige["fige_le"]},
        "premiere_prevision": str(p.index[0].date()), "mois_par_periode": {k: int(len(v)) for k, v in mois.items()},
        "probabilites": res_p, "tests_probabilites": tests_p,
        "euros": res_e, "tests_euros": tests_e,
        "retenus": {"probabilites": proba_retenues, "euros": [s for s in autres if tests_e[s]["retenu"]]},
        "assemblage_final": {"probabilite": proba, "couverture": couverture, "dosage_par_la_volatilite": bool(dosage),
                             "regle_de_decision": bool(regle)},
        "mois_prochain": prochain,
        "coefficients_derniers": derniers_coefs,
    }
    DOSSIER.mkdir(parents=True, exist_ok=True)
    (DOSSIER / "resultats.json").write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    p.join(pd.DataFrame({f"action · {v}": a for v, a in regles.items()})).join(table[["y_baisse", "bloc"]]) \
        .round(6).rename_axis("date").to_csv(DOSSIER / "probabilites.csv")
    r.round(6).join(cash.rename("cash")).rename_axis("date").to_csv(DOSSIER / "rendements.csv")
    coefs.round(6).to_csv(DOSSIER / "coefficients.csv")

    print(f"protocole vérifié (sha256 {fige['sha256'][:12]}…, figé le {fige['fige_le']})")
    print(f"\nProbabilités, {JUGEMENT} — log-loss et écart à la constante (p de Holm) :")
    for v in PROBABILITES:
        b = res_p[JUGEMENT][v]
        extra = "" if v == "constante" else f"  {b['ecart_vs_constante']:+.4f} ± {b['erreur_type']:.4f}  p Holm {tests_p[v]['p_holm']:.2f}" \
                                            f"  {'RETENUE' if tests_p[v]['retenue'] else ''}"
        print(f"  {v:48s} {b['log_loss']:.4f}{extra}")
    print(f"\nEuros, {JUGEMENT} — Sharpe, perte maximale, cumul (p de Holm) :")
    for s in r.columns:
        b = res_e[JUGEMENT][s]
        extra = f"  p Holm {tests_e[s]['p_holm']:.2f} {'RETENU' if tests_e[s]['retenu'] else ''}" if s in tests_e else ""
        print(f"  {s:60s} {b['sharpe']:+.2f}  {b['perte_maximale']:+.1%}  {b['cumul']:+.1%}{extra}")
    print(f"\nAssemblage : {sortie['assemblage_final']}")
    print(f"Indicatif 2024-2026 : assemblage {res_e[DEJA_VU]['assemblage final']['cumul']:+.1%}, "
          f"référence {res_e[DEJA_VU][REFERENCE_EUROS]['cumul']:+.1%}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--figer", action="store_true", help="écrire le protocole avant tout calcul")
    args = parser.parse_args()
    figer() if args.figer else main()
