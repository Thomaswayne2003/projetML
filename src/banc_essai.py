"""Exploration après coup : beaucoup de modèles, réentraînés mois après mois (walk-forward).

Ce script ne remplace pas le résultat du projet. Le test 2024-2026 a déjà été ouvert une fois
(runs/evaluation_test.json) : tout ce qui sort d'ici est une exploration faite en connaissant la suite.

Principe : pour prédire le mois t, chaque modèle n'apprend que sur les mois strictement antérieurs.
Deux fenêtres sont comparées : tout le passé (« croissante ») ou les 60 derniers mois (« glissante »).
Le choix du « meilleur » modèle se fait sur les mois d'avant le test (2016-2023) ; les 33 mois de test
servent ensuite à voir si ce choix tenait.

Usage : python -m src.banc_essai     écrit runs/exploration_apres_coup.json et ..._predictions.csv
"""
import json
import warnings
from datetime import datetime

import numpy as np
import optuna
import pandas as pd
from joblib import Parallel, delayed
from scipy.stats import norm, spearmanr
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss
from sklearn.model_selection import TimeSeriesSplit
from sklearn.naive_bayes import GaussianNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from .config import CFG, COLONNES, RUNS, SEED, commit_courant
from .data import charger_table
from .decision import MARGE, actions, couts_entrainement, rendements
from .pipeline import construire_pipeline, proposer

DEPART = 72            # mois d'historique exigés avant la première prédiction (février 2016)
GLISSANTE = 60         # largeur de la fenêtre glissante, en mois
SORTIE = RUNS / "exploration_apres_coup.json"
PREDICTIONS = RUNS / "exploration_apres_coup_predictions.csv"
PRIX = CFG["features"]["price"] + ["n225_ret_1m"]
SANS_NEWS = [c for c in COLONNES if not c.startswith("news_")]


def officiel(nom: str):
    """Modèle du projet, avec les hyperparamètres retenus par Optuna (runs/trials_log.csv)."""
    journal = pd.read_csv(RUNS / "trials_log.csv")
    ligne = journal[(journal["cible"] == "nikkei") & (journal["modele"] == nom) & journal["retenu"]].iloc[0]
    return proposer(optuna.trial.FixedTrial(json.loads(ligne["params"])), nom)


def simple(modele, colonnes=COLONNES) -> tuple:
    """Imputation et standardisation sur un sous-ensemble de colonnes, sans les régimes k-means."""
    return Pipeline([("impute", SimpleImputer(strategy="median")), ("scale", StandardScaler()), ("model", modele)]), colonnes


# Chaque entrée : nom lisible -> fonction qui renvoie (pipeline, colonnes). Tout est réajusté à chaque mois.
APPRIS = {
    "logistique L2 (modèle du projet)": lambda: (construire_pipeline(officiel("logit")), COLONNES),
    "logistique L1": lambda: (construire_pipeline(LogisticRegression(
        C=0.1, penalty="l1", solver="saga", max_iter=5000, random_state=SEED)), COLONNES),
    "logistique très pénalisée": lambda: (construire_pipeline(LogisticRegression(C=0.003, max_iter=2000)), COLONNES),
    "logistique sans les news": lambda: simple(LogisticRegression(C=0.03, max_iter=2000), SANS_NEWS),
    "logistique, prix seuls": lambda: simple(LogisticRegression(C=0.03, max_iter=2000), PRIX),
    "analyse discriminante linéaire": lambda: (construire_pipeline(LinearDiscriminantAnalysis(shrinkage="auto", solver="lsqr")), COLONNES),
    "Bayes naïf gaussien": lambda: (construire_pipeline(GaussianNB()), COLONNES),
    "15 plus proches voisins": lambda: (construire_pipeline(KNeighborsClassifier(n_neighbors=15)), COLONNES),
    "SVM à noyau gaussien": lambda: (construire_pipeline(SVC(C=0.5, probability=True, random_state=SEED)), COLONNES),
    "Random Forest (projet)": lambda: (construire_pipeline(officiel("rf")), COLONNES),
    "Extra Trees": lambda: (construire_pipeline(ExtraTreesClassifier(
        n_estimators=200, max_depth=3, min_samples_leaf=8, random_state=SEED, n_jobs=1)), COLONNES),
    "LightGBM (projet)": lambda: (construire_pipeline(officiel("lgbm")), COLONNES),
    "gradient boosting peu profond": lambda: (construire_pipeline(GradientBoostingClassifier(
        n_estimators=60, learning_rate=0.03, max_depth=2, subsample=0.8, random_state=SEED)), COLONNES),
    "réseau de neurones (8 neurones)": lambda: (construire_pipeline(MLPClassifier(
        hidden_layer_sizes=(8,), alpha=1.0, max_iter=3000, random_state=SEED)), COLONNES),
}


def p_constante(passe: pd.DataFrame, ligne: pd.DataFrame) -> float:
    """Fréquence des baisses observée dans la fenêtre."""
    return float(passe["y_baisse"].mean())


def p_ar1(passe: pd.DataFrame, ligne: pd.DataFrame) -> float:
    """Série temporelle classique : rendement suivant = a + b x rendement du mois, bruit gaussien."""
    x, y = passe["n225_ret_1m"].to_numpy(), passe["target_rn_next"].to_numpy()
    b, a = np.polyfit(x, y, 1)
    sigma = np.std(y - (a + b * x), ddof=2)
    return float(norm.cdf(-(a + b * ligne["n225_ret_1m"].iloc[0]) / sigma))


def p_lissage(passe: pd.DataFrame, ligne: pd.DataFrame) -> float:
    """Lissage exponentiel (demi-vie 12 mois) de la moyenne et de l'écart-type des rendements."""
    r = passe["target_rn_next"]
    mu, sigma = r.ewm(halflife=12).mean().iloc[-1], r.ewm(halflife=12).std().iloc[-1]
    return float(norm.cdf(-mu / sigma))


def p_tendance(passe: pd.DataFrame, ligne: pd.DataFrame) -> float:
    """Suivi de tendance : fréquence passée des baisses, selon que le momentum 12 mois est positif ou non."""
    meme_signe = (passe["n225_mom_12m"] > 0) == bool(ligne["n225_mom_12m"].iloc[0] > 0)
    y = passe.loc[meme_signe, "y_baisse"]
    return float((y.sum() + 1) / (len(y) + 2))            # lissage de Laplace : jamais 0 ni 1


def p_logit_regle(passe: pd.DataFrame, ligne: pd.DataFrame) -> float:
    """Logistique L2 dont la pénalité est rechoisie à chaque mois, par validation chronologique sur la fenêtre."""
    X, y = passe[COLONNES], passe["y_baisse"].astype(int)
    scores = {}
    for C in np.logspace(-3, 0, 7):
        pipe = construire_pipeline(LogisticRegression(C=C, max_iter=2000))
        scores[C] = np.mean([log_loss(y.iloc[b], pipe.fit(X.iloc[a], y.iloc[a]).predict_proba(X.iloc[b])[:, 1], labels=[0, 1])
                             for a, b in TimeSeriesSplit(n_splits=3).split(X) if y.iloc[a].nunique() == 2])
    pipe = construire_pipeline(LogisticRegression(C=min(scores, key=scores.get), max_iter=2000))
    return float(pipe.fit(X, y).predict_proba(ligne[COLONNES])[0, 1])


FORMULES = {"logistique L2, pénalité rechoisie chaque mois": p_logit_regle,
            "constante (fréquence passée)": p_constante, "AR(1) sur les rendements": p_ar1,
            "lissage exponentiel des rendements": p_lissage, "suivi de tendance 12 mois": p_tendance}


def marcher(nom: str, fenetre: str, table: pd.DataFrame) -> pd.DataFrame:
    """Prédictions walk-forward d'un modèle : une probabilité de baisse et une action par mois."""
    warnings.filterwarnings("ignore")
    lignes = []
    for t in range(DEPART, len(table)):
        debut = 0 if fenetre == "croissante" else max(0, t - GLISSANTE)
        passe, ligne = table.iloc[debut:t], table.iloc[[t]]
        if nom in FORMULES:
            p = FORMULES[nom](passe, ligne)
        else:
            pipe, colonnes = APPRIS[nom]()
            p = float(pipe.fit(passe[colonnes], passe["y_baisse"].astype(int)).predict_proba(ligne[colonnes])[0, 1])
        p = float(np.clip(p, 1e-4, 1 - 1e-4))
        couts = couts_entrainement(table.iloc[:t])            # coûts appris sur tout le passé connu, comme dans le projet
        action = actions(pd.Series([1 - p], index=ligne.index), couts, MARGE).iloc[0]
        lignes.append({"date": ligne.index[0], "modele": nom, "fenetre": fenetre, "p_baisse": p, "action": action})
    return pd.DataFrame(lignes)


def perte(y, p) -> np.ndarray:
    """Log-loss mois par mois."""
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


def ece(y, p, cases: int = 5) -> float:
    """Écart moyen entre probabilité annoncée et fréquence observée, sur des cases de largeur égale."""
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    case = np.minimum((p * cases).astype(int), cases - 1)
    return float(sum(abs(y[case == k].mean() - p[case == k].mean()) * (case == k).mean() for k in np.unique(case)))


def resumer(pred: pd.DataFrame, bloc: pd.DataFrame, reference: pd.Series) -> dict:
    """Métriques d'un modèle sur une période ; `reference` = log-loss mensuelle de la constante."""
    y, p = bloc["y_baisse"].astype(int).to_numpy(), pred["p_baisse"].to_numpy()
    ecart = perte(y, p) - reference.to_numpy()
    gains = rendements(pred["action"], bloc)
    valeur = np.cumprod(1 + gains.to_numpy())
    return {"mois": int(len(y)), "log_loss": float(perte(y, p).mean()),
            "ecart_vs_constante": float(ecart.mean()), "erreur_type_de_l_ecart": float(ecart.std(ddof=1) / np.sqrt(len(ecart))),
            "pr_auc": float(average_precision_score(y, p)), "brier": float(brier_score_loss(y, p)), "ece": ece(y, p),
            "actions": {a: int(n) for a, n in pred["action"].value_counts().items()},
            "cumul_regle": float(valeur[-1] - 1), "perte_maximale": float((valeur / np.maximum.accumulate(valeur) - 1).min()),
            "cumul_achat_couvert": float(np.prod(1 + bloc["target_reur_hedged_next"].to_numpy()) - 1)}


def main() -> None:
    table = charger_table()
    table = table[table["bloc"] != "à prédire"]
    plan = [(nom, f) for nom in list(FORMULES) + list(APPRIS) for f in ["croissante", "glissante"]]
    morceaux = Parallel(n_jobs=-1)(delayed(marcher)(nom, f, table) for nom, f in plan)
    pred = pd.concat(morceaux).set_index("date")

    # Moyenne des trois modèles du projet : l'ensemble le plus simple possible
    for f in ["croissante", "glissante"]:
        trio = pred[(pred["fenetre"] == f) & pred["modele"].isin(
            ["logistique L2 (modèle du projet)", "Random Forest (projet)", "LightGBM (projet)"])]
        moyenne = trio.groupby(level=0)["p_baisse"].mean()
        act = [actions(pd.Series([1 - p], index=[d]), couts_entrainement(table.loc[:d].iloc[:-1]), MARGE).iloc[0]
               for d, p in moyenne.items()]
        pred = pd.concat([pred, pd.DataFrame({"modele": "moyenne logistique + forêt + LightGBM", "fenetre": f,
                                              "p_baisse": moyenne, "action": act})])

    periodes = {"avant_test_2016_2023": table.index[DEPART:][(table["bloc"].iloc[DEPART:] != "test").to_numpy()],
                "test_2024_2026": table.index[table["bloc"] == "test"]}
    const = pred[(pred["modele"] == "constante (fréquence passée)") & (pred["fenetre"] == "croissante")]
    resultats = []
    for (nom, f), d in pred.groupby(["modele", "fenetre"], sort=False):
        ligne = {"modele": nom, "fenetre": f}
        for cle, mois in periodes.items():
            bloc = table.loc[mois]
            ref = pd.Series(perte(bloc["y_baisse"], const.loc[mois, "p_baisse"]), index=mois)
            ligne[cle] = resumer(d.loc[mois], bloc, ref)
        resultats.append(ligne)

    avant = [r["avant_test_2016_2023"]["log_loss"] for r in resultats]
    apres = [r["test_2024_2026"]["log_loss"] for r in resultats]
    choisi, gagnant_test = resultats[int(np.argmin(avant))], resultats[int(np.argmin(apres))]
    rho, _ = spearmanr(avant, apres)
    battent = lambda cle: sum(r[cle]["ecart_vs_constante"] < 0 for r in resultats if not r["modele"].startswith("constante"))
    sortie = {
        "avertissement": "Exploration après coup : le test 2024-2026 avait déjà été ouvert. Ces chiffres ne remplacent pas "
                         "runs/evaluation_test.json, qui reste le résultat du projet.",
        "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
        "methode": {"depart_mois": DEPART, "fenetre_glissante_mois": GLISSANTE, "reentrainement": "chaque mois",
                    "reference": "constante (fréquence passée), fenêtre croissante",
                    "regle": f"mêmes formules que le projet, marge {MARGE}, coûts appris sur le passé connu à chaque mois",
                    "probabilites": "brutes, sans calibration de Platt"},
        "configurations": len(resultats),
        "choix_sur_2016_2023": {"modele": choisi["modele"], "fenetre": choisi["fenetre"],
                                "avant_test": choisi["avant_test_2016_2023"], "test": choisi["test_2024_2026"]},
        "meilleur_sur_le_test_a_posteriori": {"modele": gagnant_test["modele"], "fenetre": gagnant_test["fenetre"],
                                              "avant_test": gagnant_test["avant_test_2016_2023"], "test": gagnant_test["test_2024_2026"]},
        "battent_la_constante": {"avant_test": battent("avant_test_2016_2023"), "test": battent("test_2024_2026"),
                                 "sur": len(resultats) - 2},
        "correlation_de_rang_avant_test_vs_test": float(rho),
        "resultats": resultats,
    }
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    pred.rename_axis("date").to_csv(PREDICTIONS)
    print(f"{len(resultats)} configurations ; choix sur 2016-2023 : {choisi['modele']} ({choisi['fenetre']})")
    print(f"écrit : {SORTIE.relative_to(RUNS.parent)} et {PREDICTIONS.relative_to(RUNS.parent)}")


if __name__ == "__main__":
    main()
