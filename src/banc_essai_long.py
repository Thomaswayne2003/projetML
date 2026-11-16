"""Exploration après coup : apprendre sur plus de mois (depuis 2000, ou depuis 1970) aide-t-il ?

Seul le cours de clôture du Nikkei existe sur une aussi longue période dans nos fichiers
(data/1_brutes/nikkei225_long.csv, depuis 1970). Les variables sont donc tirées des prix seulement.
La comparaison porte sur la date de départ de l'apprentissage, toutes choses égales par ailleurs.
Ce script ne remplace pas le résultat du projet (runs/evaluation_test.json) ; le test a déjà été ouvert.

Usage : python -m src.banc_essai_long     écrit runs/exploration_historique_long.json
"""
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import ROOT, RUNS, SEED, commit_courant

SORTIE = RUNS / "exploration_historique_long.json"
DEPARTS = ["2010-02", "2000-01", "1985-01", "1971-06"]        # premier mois d'apprentissage
PERIODES = {"avant_test_2016_2023": ("2016-02", "2023-12"), "test_2024_2026": ("2024-01", "2026-09")}


def table_mensuelle() -> pd.DataFrame:
    """Variables de prix en fin de mois et sens du mois suivant, à partir des clôtures journalières."""
    for dossier in [ROOT / "data" / "1_brutes"]:
        if (dossier / "nikkei225_long.csv").exists():
            jour = pd.read_csv(dossier / "nikkei225_long.csv", parse_dates=[0], index_col=0)["close"].dropna()
            break
    else:
        raise SystemExit("nikkei225_long.csv introuvable")
    r_jour = jour.pct_change()
    mois = jour.groupby(jour.index.to_period("M")).last()
    r = mois.pct_change()
    t = pd.DataFrame({"ret_1m": r, "mom_3m": mois.pct_change(3), "mom_6m": mois.pct_change(6), "mom_12m": mois.pct_change(12),
                      "ecart_moyenne_10m": mois / mois.rolling(10).mean() - 1, "recul_depuis_le_plus_haut_12m": mois / mois.rolling(12).max() - 1,
                      "vol_1m": r_jour.groupby(r_jour.index.to_period("M")).std() * np.sqrt(252),
                      "vol_6m": r.rolling(6).std() * np.sqrt(12)})
    t["rendement_suivant"] = r.shift(-1)
    t["y_baisse"] = (t["rendement_suivant"] <= 0).astype(float).where(t["rendement_suivant"].notna())
    return t.dropna()


def modeles() -> dict:
    prep = lambda m: Pipeline([("scale", StandardScaler()), ("model", m)])
    return {"logistique L2": prep(LogisticRegression(C=0.03, max_iter=2000)),
            "logistique très pénalisée": prep(LogisticRegression(C=0.003, max_iter=2000)),
            "LightGBM bridé": prep(LGBMClassifier(n_estimators=100, learning_rate=0.02, num_leaves=4, min_child_samples=30,
                                                   subsample=0.8, subsample_freq=1, reg_lambda=5.0, random_state=SEED,
                                                   n_jobs=1, verbose=-1))}


def marcher(t: pd.DataFrame, depart: str) -> pd.DataFrame:
    """Réentraînement chaque mois sur tous les mois depuis `depart`, prédiction du mois suivant."""
    X, y = t.drop(columns=["rendement_suivant", "y_baisse"]), t["y_baisse"].astype(int)
    lignes = []
    for mois in t.loc[PERIODES["avant_test_2016_2023"][0]:PERIODES["test_2024_2026"][1]].index:
        passe = (t.index >= pd.Period(depart, "M")) & (t.index < mois)
        p = {"constante": y[passe].mean()}
        for nom, pipe in modeles().items():
            p[nom] = pipe.fit(X[passe], y[passe]).predict_proba(X.loc[[mois]])[0, 1]
        lignes.append({"mois": mois, "y": y[mois], "mois_d_apprentissage": int(passe.sum()), **p})
    return pd.DataFrame(lignes).set_index("mois")


def mesurer(pred: pd.DataFrame, reference: pd.DataFrame) -> dict:
    """Écart de log-loss avec la constante apprise depuis 2010 (la même référence pour tous les départs)."""
    perte = lambda y, p: -(y * np.log(p) + (1 - y) * np.log(1 - p))
    sortie = {}
    for cle, (a, b) in PERIODES.items():
        d, ref = pred.loc[a:b], reference.loc[a:b]
        lignes = {}
        for nom in ["constante"] + list(modeles()):
            ecart = (perte(d["y"], d[nom]) - perte(ref["y"], ref["constante"])).to_numpy()
            lignes[nom] = {"log_loss": float(perte(d["y"], d[nom]).mean()), "ecart_vs_constante_2010": float(ecart.mean()),
                           "erreur_type": float(ecart.std(ddof=1) / np.sqrt(len(ecart))),
                           "auc": float(roc_auc_score(d["y"], d[nom])) if nom != "constante" else 0.5,
                           "proba_moyenne_de_baisse_%": float(d[nom].mean() * 100)}
        sortie[cle] = {"mois": int(len(d)), "baisses": int(d["y"].sum()),
                       "mois_d_apprentissage": [int(d["mois_d_apprentissage"].iloc[0]), int(d["mois_d_apprentissage"].iloc[-1])],
                       "modeles": lignes}
    return sortie


def main() -> None:
    warnings.filterwarnings("ignore")
    t = table_mensuelle()
    pred = {depart: marcher(t, depart) for depart in DEPARTS}
    resultats = {depart: mesurer(pred[depart], pred["2010-02"]) for depart in DEPARTS}
    frequences = {depart: float(t.loc[depart:"2023-12", "y_baisse"].mean() * 100) for depart in DEPARTS}
    for depart in DEPARTS:
        test = resultats[depart]["test_2024_2026"]
        meilleur = min(modeles(), key=lambda m: test["modeles"][m]["log_loss"])
        print(f"depuis {depart} ({test['mois_d_apprentissage'][0]} mois, {frequences[depart]:.1f} % de baisses) : constante "
              f"{test['modeles']['constante']['log_loss']:.3f} | {meilleur} {test['modeles'][meilleur]['log_loss']:.3f} "
              f"(écart {test['modeles'][meilleur]['ecart_vs_constante_2010']:+.3f} ± {test['modeles'][meilleur]['erreur_type']:.3f})")
    sortie = {"avertissement": "Exploration après coup : le test 2024-2026 avait déjà été ouvert. Ces chiffres ne remplacent pas "
                               "runs/evaluation_test.json, qui reste le résultat du projet.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "methode": {"variables": [c for c in t.columns if c not in ("rendement_suivant", "y_baisse")],
                          "reentrainement": "chaque mois, sur tous les mois depuis la date de départ",
                          "reference": "constante apprise depuis 2010-02, identique pour tous les départs"},
              "part_de_baisses_jusqu_a_2023_%": frequences, "resultats_par_depart": resultats}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    print(f"test : {resultats['2010-02']['test_2024_2026']['mois']} mois, {resultats['2010-02']['test_2024_2026']['baisses']} baisses ; "
          f"écrit : {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
