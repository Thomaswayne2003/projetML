"""Exploration après coup, sur la base journalière (4 118 séances, 2010-2026).

Question : avec vingt fois plus de lignes que la table mensuelle, prédit-on mieux le sens du Nikkei ?
Ce script ne remplace pas le résultat du projet (runs/evaluation_test.json) ; le test a déjà été ouvert.

Précaution sur les horaires. Dans la base, la ligne du jour j contient la clôture de Wall Street du jour j,
connue plusieurs heures APRÈS la clôture de Tokyo. Tout ce qui ne vient pas de la Bourse de Tokyo est donc
décalé d'un jour quand la décision se prend à la clôture. Une expérience garde exprès Wall Street non décalé
pour montrer ce que ce piège rapporte, et une autre le rend honnête en décidant à l'ouverture du lendemain.

Usage : python -m src.banc_essai_jour     écrit runs/exploration_journaliere.json
"""
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import ROOT, RUNS, SEED, commit_courant

SORTIE = RUNS / "exploration_journaliere.json"
DEBUT = "2016-01-01"                 # première prédiction : six ans d'historique au moins
TEST = ("2024-01-01", "2026-09-30")  # mêmes mois que le test du projet
REFAIRE = 20                         # réentraînement toutes les 20 séances (un mois environ)
VOL_CIBLE = 0.15                     # volatilité annuelle visée par la stratégie de dosage


def charger() -> pd.DataFrame:
    for dossier in [ROOT / "data" / "2_construites"]:
        if (dossier / "dataset_daily_v2.csv").exists():
            return pd.read_csv(dossier / "dataset_daily_v2.csv", parse_dates=["date"]).set_index("date")
    raise SystemExit("dataset_daily_v2.csv introuvable (cherché dans data/2_construites/)")


def variables(d: pd.DataFrame) -> dict:
    """Trois familles de variables, selon le moment où elles sont connues."""
    tokyo = d[["n225_ret_1d", "n225_ret_5d", "n225_ret_20d", "n225_ret_60d", "n225_mom_12m", "n225_dist_sma20",
               "n225_dist_sma50", "n225_dist_sma200", "n225_vol_20d", "n225_vol_ewma", "n225_rsi14", "n225_macd_hist",
               "n225_bb_pctb", "n225_atr14_pct", "boj_days_to_next", "boj_days_since_last", "boj_meeting_day"]].copy()
    tokyo["taiex_r1"], tokyo["taiex_r5"] = d["taiex"].pct_change(), d["taiex"].pct_change(5)   # Taipei ferme avant Tokyo

    ailleurs = pd.DataFrame(index=d.index)
    for nom, jours in [("sp500", [1, 5, 20]), ("msci_em_eem", [5]), ("msci_japan_etf", [1, 5]), ("shanghai", [5]),
                       ("nifty50", [5]), ("eurjpy", [5, 20]), ("usdjpy", [5, 20])]:
        for j in jours:
            ailleurs[f"{nom}_r{j}"] = d[nom].pct_change(j)
    ailleurs["vix"], ailleurs["vix_d5"] = d["vix"], d["vix"].diff(5)
    for nom in ["us10y", "jgb10y", "spread_us_jgb10y"]:
        ailleurs[f"{nom}_d20"] = d[nom].diff(20)
    news = ["news_japan_sent_5d", "news_japan_sent_20d", "news_boj_sent_20d", "news_japan_neg_share_5d",
            "gdelt_japan_tone_5d", "gdelt_japan_attention"]
    ailleurs[news] = d[news]
    ailleurs["news_dispo"] = d["news_japan_sent_20d"].notna().astype(int)

    soir = pd.DataFrame({"sp500_soir": d["sp500"].pct_change(), "vix_soir": d["vix"].diff(),
                         "etf_japon_soir": d["msci_japan_etf"].pct_change(), "us10y_soir": d["us10y"].diff()})
    return {"tokyo": tokyo, "ailleurs_veille": ailleurs.shift(1), "wall_street_du_soir": soir}


def modeles() -> dict:
    prep = lambda m: Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", m)])
    return {"logistique L2": prep(LogisticRegression(C=0.01, max_iter=2000)),
            "LightGBM bridé": prep(LGBMClassifier(n_estimators=150, learning_rate=0.02, num_leaves=4, min_child_samples=100,
                                                   subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=5.0,
                                                   random_state=SEED, n_jobs=1, verbose=-1))}


def marcher(X: pd.DataFrame, y: pd.Series, horizon: int) -> pd.DataFrame:
    """Probabilités de baisse walk-forward. La cible d'une ligne d'entraînement est entièrement connue avant la prédiction."""
    ok = y.notna() & X.notna().any(axis=1)
    X, y = X[ok], y[ok].astype(int)
    depart = int(np.searchsorted(X.index, pd.Timestamp(DEBUT)))
    sorties = []
    for i in range(depart, len(X), REFAIRE):
        passe, bloc = slice(0, i - horizon), slice(i, min(i + REFAIRE, len(X)))
        p = {"constante": np.full(bloc.stop - bloc.start, y.iloc[passe].mean())}
        for nom, pipe in modeles().items():
            p[nom] = pipe.fit(X.iloc[passe], y.iloc[passe]).predict_proba(X.iloc[bloc])[:, 1]
        p["moitié logistique, moitié LightGBM"] = (p["logistique L2"] + p["LightGBM bridé"]) / 2
        p["70 % constante + 30 % logistique"] = 0.7 * p["constante"] + 0.3 * p["logistique L2"]
        sorties.append(pd.DataFrame(p, index=X.index[bloc]).assign(y=y.iloc[bloc]))
    return pd.concat(sorties)


def mesurer(pred: pd.DataFrame, horizon: int) -> dict:
    """Métriques sur des dates qui ne se chevauchent pas (une sur `horizon`), par période."""
    pred = pred.iloc[::horizon]
    perte = lambda p: -(pred["y"].reindex(p.index) * np.log(p) + (1 - pred["y"].reindex(p.index)) * np.log(1 - p))
    periodes = {"avant_test_2016_2023": pred.index < TEST[0], "test_2024_2026": (pred.index >= TEST[0]) & (pred.index <= TEST[1])}
    sortie = {}
    for cle, masque in periodes.items():
        y, lignes = pred["y"][masque], {}
        for nom in [c for c in pred.columns if c != "y"]:
            p = pred[nom][masque].clip(1e-4, 1 - 1e-4)
            ecart = (perte(p) - perte(pred["constante"][masque])).to_numpy()
            lignes[nom] = {"log_loss": float(perte(p).mean()), "ecart_vs_constante": float(ecart.mean()),
                           "erreur_type": float(ecart.std(ddof=1) / np.sqrt(len(ecart))),
                           "auc": float(roc_auc_score(y, p)) if nom != "constante" else 0.5,
                           "bon_sens_%": float(((p > 0.5) == (y == 1)).mean() * 100)}
        sortie[cle] = {"observations": int(masque.sum()), "part_de_baisses_%": float(y.mean() * 100), "modeles": lignes}
    return sortie


def volatilite(d: pd.DataFrame) -> dict:
    """Prévoir l'agitation des 20 prochaines séances, puis doser la position en conséquence."""
    r = d["n225_close"].pct_change()
    realisee = lambda n: r.rolling(n).std() * np.sqrt(252)
    X = pd.DataFrame({"vol5": np.log(realisee(5)), "vol20": np.log(realisee(20)), "vol60": np.log(realisee(60)),
                      "vix": np.log(d["vix"].shift(1))}).dropna()
    y = np.log(realisee(20).shift(-20)).reindex(X.index)                 # volatilité des 20 séances suivantes
    X, y = X[y.notna()], y[y.notna()]
    depart, lignes = int(np.searchsorted(X.index, pd.Timestamp(DEBUT))), []
    for i in range(depart, len(X), REFAIRE):
        passe = slice(0, i - 20)
        modele = LinearRegression().fit(X.iloc[passe], y.iloc[passe])
        lignes.append({"date": X.index[i], "reelle": y.iloc[i], "modele": modele.predict(X.iloc[[i]])[0],
                       "comme_le_mois_passe": X["vol20"].iloc[i], "moyenne_passee": y.iloc[passe].mean()})
    v = pd.DataFrame(lignes).set_index("date")

    def qualite(masque) -> dict:
        w, ref = v[masque], ((v["reelle"] - v["moyenne_passee"])[masque] ** 2).sum()
        return {"observations": int(masque.sum()),
                "r2_modele": float(1 - ((w["reelle"] - w["modele"]) ** 2).sum() / ref),
                "r2_comme_le_mois_passe": float(1 - ((w["reelle"] - w["comme_le_mois_passe"]) ** 2).sum() / ref),
                "correlation_prevue_reelle": float(w["reelle"].corr(w["modele"]))}

    # Dosage : part investie = volatilité visée / volatilité prévue, plafonnée à 100 %, revue toutes les 20 séances
    part = (VOL_CIBLE / np.exp(v["modele"])).clip(upper=1.0).reindex(r.index).ffill().shift(1)   # appliquée dès le lendemain
    test = (r.index >= TEST[0]) & (r.index <= TEST[1])

    def bilan(gains: pd.Series) -> dict:
        valeur = (1 + gains).cumprod()
        return {"cumul": float(valeur.iloc[-1] - 1), "volatilite_annuelle": float(gains.std() * np.sqrt(252)),
                "perte_maximale": float((valeur / valeur.cummax() - 1).min()),
                "rendement_par_unite_de_risque": float(gains.mean() / gains.std() * np.sqrt(252))}

    return {"prevision": {"avant_test_2016_2023": qualite(v.index < TEST[0]),
                          "test_2024_2026": qualite((v.index >= TEST[0]) & (v.index <= TEST[1]))},
            "dosage_sur_le_test": {"note": "rendements du Nikkei en yens, sans frais ni rémunération du cash : ordre de grandeur, "
                                           "pas comparable au centime avec les +82,3 % en euros couverts du projet",
                                   "part_investie_moyenne_%": float(part[test].mean() * 100),
                                   "acheter_et_garder": bilan(r[test]), "position_dosee": bilan((part * r)[test])}}


def main() -> None:
    warnings.filterwarnings("ignore")
    d = charger()
    v = variables(d)
    cloture, ouverture = d["n225_close"], d["n225_open"]
    baisse = lambda rendement: (rendement <= 0).astype(float).where(rendement.notna())
    connu_a_la_cloture = pd.concat([v["tokyo"], v["ailleurs_veille"]], axis=1)
    avec_le_soir = pd.concat([connu_a_la_cloture, v["wall_street_du_soir"]], axis=1)
    a_l_ouverture = avec_le_soir.assign(saut_d_ouverture=ouverture.shift(-1) / cloture - 1)
    experiences = {
        "lendemain, décision à la clôture de Tokyo": (connu_a_la_cloture, baisse(cloture.shift(-1) / cloture - 1), 1),
        "lendemain, en connaissant Wall Street du soir (piège : pas encore connu à la clôture)":
            (avec_le_soir, baisse(cloture.shift(-1) / cloture - 1), 1),
        "séance du lendemain, décision à l'ouverture (version honnête du piège)":
            (a_l_ouverture, baisse(cloture.shift(-1) / ouverture.shift(-1) - 1), 1),
        "5 séances": (connu_a_la_cloture, baisse(cloture.shift(-5) / cloture - 1), 5),
        "20 séances (un mois)": (connu_a_la_cloture, baisse(cloture.shift(-20) / cloture - 1), 20),
    }
    sens = {}
    for nom, (X, y, horizon) in experiences.items():
        sens[nom] = {"horizon_seances": horizon, "variables": int(X.shape[1]), **mesurer(marcher(X, y, horizon), horizon)}
        t = sens[nom]["test_2024_2026"]
        meilleur = min((m for m in t["modeles"] if m != "constante"), key=lambda m: t["modeles"][m]["log_loss"])
        print(f"{nom[:60]:60s} test n={t['observations']:4d} | {meilleur}: écart {t['modeles'][meilleur]['ecart_vs_constante']:+.4f} "
              f"± {t['modeles'][meilleur]['erreur_type']:.4f}, AUC {t['modeles'][meilleur]['auc']:.3f}")
    sortie = {"avertissement": "Exploration après coup : le test 2024-2026 avait déjà été ouvert. Ces chiffres ne remplacent pas "
                               "runs/evaluation_test.json, qui reste le résultat du projet.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "base": {"seances": int(len(d)), "debut": str(d.index[0].date()), "fin": str(d.index[-1].date())},
              "methode": {"premiere_prediction": DEBUT, "reentrainement_toutes_les_seances": REFAIRE,
                          "fenetre": "tout le passé, en retirant les lignes dont la cible n'est pas encore connue",
                          "mesure": "sur des dates qui ne se chevauchent pas ; écart = log-loss du modèle moins celle de la constante"},
              "sens_du_marche": sens, "volatilite": volatilite(d)}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    print(f"écrit : {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
