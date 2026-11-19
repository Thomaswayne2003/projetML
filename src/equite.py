"""Exigence 10 : audit d'équité entre régimes de marché, et une mitigation par repondération (Kamiran et Calders).

Le jeu ne contient pas de personnes. L'attribut « sensible » retenu est le régime du mois (calme ou agité), donné par
le k-means de la pipeline ajusté sur l'entraînement : un modèle qui raterait surtout les baisses des mois agités
ferait perdre de l'argent au pire moment.

Définitions d'équité, avec la baisse comme classe positive et le seuil 0,5 :
  - égalité des chances (equal opportunity) : même recall dans chaque groupe ;
  - égalité des cotes (equalized odds) : même recall et même taux de faux positifs ;
  - parité démographique : même taux de prédictions « baisse ».

Mitigation (prétraitement) : on réentraîne la même pipeline, avec les mêmes hyperparamètres, en pondérant chaque mois
d'entraînement par w(g, y) = P(g) P(y) / P(g, y), qui rend le régime et la cible indépendants dans les données
d'apprentissage. La calibration de Platt est réapprise de la même façon que pour le modèle figé (prédictions hors
fold d'un TimeSeriesSplit de l'entraînement). Rien n'est réglé sur le test.

Ce script est écrit après l'ouverture du test : la décision et l'évaluation figées de runs/ ne sont pas touchées.
Usage : python -m src.equite   (écrit runs/equite_mitigation.json)
       NIKKEI_CONFIG=config_bloomberg.yaml python -m src.equite   (seconde version, runs/v2_bloomberg/)
"""
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.metrics import brier_score_loss, log_loss
from sklearn.model_selection import TimeSeriesSplit

from src.config import CFG, ROOT, commit_courant
from src.decision import apprendre_platt, appliquer_platt

RUNS = ROOT / CFG.get("runs", "runs")   # runs/ (version 1) ou runs/v2_bloomberg (NIKKEI_CONFIG=config_bloomberg.yaml)
DEC = json.loads((RUNS / "decision_finale.json").read_text())
FEATURES = [c for g in ["news", "price", "macro", "fx"] for c in CFG["features"][g]]
REGIME = CFG["features"]["regime"]
COLONNES = FEATURES + [c for c in REGIME if c not in FEATURES]
SEUIL = 0.5


def charger():
    table = pd.read_csv(ROOT / CFG["data"]["model_table"], parse_dates=["date"]).set_index("date")
    pipe = joblib.load(ROOT / DEC["fichiers_modeles"]["logit"])
    return table, pipe


def regimes(pipe, X) -> pd.Series:
    """Régime k-means de chaque mois, nommé d'après le centre au VIX le plus haut."""
    km = pipe.named_steps["prep"].named_transformers_["regime"]
    centres = km.named_steps["scale"].inverse_transform(km.named_steps["kmeans"].cluster_centers_)
    agite = int(np.argmax(centres[:, REGIME.index("vix")]))
    return pd.Series(km.predict(X[REGIME]), index=X.index).map({agite: "agité", 1 - agite: "calme"})


def poids_kamiran(groupe: pd.Series, y: pd.Series) -> np.ndarray:
    """w(g, y) = P(g) P(y) / P(g, y) : le groupe et la cible deviennent indépendants une fois pondérés."""
    pg, py = groupe.value_counts(normalize=True), y.value_counts(normalize=True)
    pgy = pd.crosstab(groupe, y, normalize=True)
    return np.array([pg[g] * py[c] / pgy.loc[g, c] for g, c in zip(groupe, y)])


def p_platt(pipe, X, platt):
    return appliquer_platt(pipe.predict_proba(X[COLONNES])[:, 1], platt)


def platt_hors_fold(pipe, X, y, w):
    """Comme le modèle figé : Platt appris sur les prédictions hors fold de l'entraînement."""
    p, cible = [], []
    for app, val in TimeSeriesSplit(n_splits=4, test_size=12).split(X):
        m = clone(pipe).fit(X.iloc[app][COLONNES], y.iloc[app], model__sample_weight=w[app])
        p.append(m.predict_proba(X.iloc[val][COLONNES])[:, 1])
        cible.append(y.iloc[val])
    return apprendre_platt(np.concatenate(p), np.concatenate(cible))


def mesures(p, y, groupe) -> dict:
    yhat = (p >= SEUIL).astype(int)
    par = {}
    for g in ["calme", "agité"]:
        m = (groupe == g).to_numpy()
        pos, neg = (y[m] == 1), (y[m] == 0)
        par[g] = {"mois": int(m.sum()), "baisses": int(pos.sum()),
                  "recall": float(yhat[m][pos].mean()) if pos.any() else None,
                  "taux_faux_positifs": float(yhat[m][neg].mean()) if neg.any() else None,
                  "taux_predit_baisse": float(yhat[m].mean())}
    ecart = lambda k: abs(par["calme"][k] - par["agité"][k])
    return {"groupes": par,
            "ecart_recall": ecart("recall"), "ecart_faux_positifs": ecart("taux_faux_positifs"),
            "ecart_parite": ecart("taux_predit_baisse"),
            "log_loss": float(log_loss(y, p, labels=[0, 1])), "brier": float(brier_score_loss(y, p)),
            "exactitude": float((yhat == y).mean())}


def main():
    table, pipe = charger()
    train = table[table["bloc"] == "entraînement"]
    test = table[table["bloc"] == "test"]
    y_tr, y_te = train["y_baisse"].astype(int), test["y_baisse"].astype(int).to_numpy()
    g_tr, g_te = regimes(pipe, train), regimes(pipe, test)

    avant = mesures(p_platt(pipe, test, DEC["platt"]["logit"]), y_te, g_te)

    w = poids_kamiran(g_tr, y_tr)
    repondere = clone(pipe).fit(train[COLONNES], y_tr, model__sample_weight=w)
    platt = platt_hors_fold(pipe, train, y_tr, w)
    apres = mesures(p_platt(repondere, test, platt), y_te, g_te)

    p_const = float(y_tr.mean())
    sortie = {
        "commit_du_code": commit_courant(),
        "attribut": "régime k-means de la pipeline (calme ou agité), ajusté sur l'entraînement",
        "mitigation": "repondération de Kamiran et Calders, w(g, y) = P(g) P(y) / P(g, y), mêmes hyperparamètres",
        "seuil": SEUIL,
        "poids": {f"{g}, {'baisse' if c else 'hausse'}": round(float(w[(g_tr == g).to_numpy() & (y_tr == c).to_numpy()][0]), 3)
                  for g in ["calme", "agité"] for c in [0, 1]},
        "entrainement_par_groupe": pd.crosstab(g_tr, y_tr).rename(columns={0: "hausse", 1: "baisse"}).to_dict("index"),
        "platt_repondere": platt,
        "log_loss_constante_test": float(log_loss(y_te, np.full(len(y_te), p_const), labels=[0, 1])),
        "avant": avant, "apres": apres,
    }
    (RUNS / "equite_mitigation.json").write_text(json.dumps(sortie, ensure_ascii=False, indent=2))
    for nom, r in [("avant", avant), ("après", apres)]:
        print(f"{nom:6s} recall calme {r['groupes']['calme']['recall']:.2f} agité {r['groupes']['agité']['recall']:.2f} "
              f"| écarts recall {r['ecart_recall']:.2f} FP {r['ecart_faux_positifs']:.2f} parité {r['ecart_parite']:.2f} "
              f"| log-loss {r['log_loss']:.3f} Brier {r['brier']:.3f} exactitude {r['exactitude']:.2f}")
    print("poids :", sortie["poids"], "| log-loss constante", round(sortie["log_loss_constante_test"], 3))


if __name__ == "__main__":
    main()
