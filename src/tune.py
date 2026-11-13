"""Réglage Optuna avec TimeSeriesSplit, journal des essais, modèles retenus (notebook 02).

Usage : python -m src.tune [--essais 50] [--sortie runs]
"""
import argparse
import json
import time
import warnings
from datetime import datetime

import joblib
import numpy as np
import optuna
import pandas as pd
from optuna.samplers import TPESampler
from sklearn.base import clone
from sklearn.exceptions import ConvergenceWarning
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss
from sklearn.model_selection import TimeSeriesSplit

from .config import CIBLES, COLONNES, RUNS, SEED, commit_courant
from .data import charger_table
from .pipeline import construire_pipeline, proposer

PLAN = [("nikkei", "logit"), ("nikkei", "rf"), ("nikkei", "lgbm"), ("couverture", "logit")]
FOLDS_CV = TimeSeriesSplit(n_splits=4, test_size=12)


def evaluer_cv(pipe, X, y, folds):
    """Log-loss, Brier et PR-AUC moyens sur les folds, et prédictions hors fold."""
    pertes, briers, praucs = [], [], []
    oof = pd.Series(np.nan, index=y.index)
    for a, b in folds:
        modele = clone(pipe).fit(X.iloc[a], y.iloc[a])
        p = modele.predict_proba(X.iloc[b])[:, 1]
        pertes.append(log_loss(y.iloc[b], p, labels=[0, 1]))
        briers.append(brier_score_loss(y.iloc[b], p))
        praucs.append(average_precision_score(y.iloc[b], p))
        oof.iloc[b] = p
    return {"logloss": float(np.mean(pertes)), "logloss_std": float(np.std(pertes)),
            "brier": float(np.mean(briers)), "pr_auc": float(np.mean(praucs)),
            "logloss_folds": [round(float(x), 4) for x in pertes]}, oof


def main(n_essais: int = 50, sortie=RUNS) -> None:
    from pathlib import Path
    sortie = Path(sortie)
    modeles = sortie / "models"
    warnings.filterwarnings("ignore", category=ConvergenceWarning)
    warnings.filterwarnings("ignore", message=".*feature names.*")
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    modeles.mkdir(parents=True, exist_ok=True)

    table = charger_table()
    train, valid = table[table["bloc"] == "entraînement"], table[table["bloc"] == "validation"]
    X_tr, X_va = train[COLONNES], valid[COLONNES]
    folds = list(FOLDS_CV.split(X_tr))
    date, commit = datetime.now().strftime("%Y-%m-%d %H:%M"), commit_courant()

    journal, predictions = [], []
    for cible, nom in PLAN:
        y_tr, y_va = train[CIBLES[cible]].astype(int), valid[CIBLES[cible]].astype(int)

        def objectif(trial):
            res, _ = evaluer_cv(construire_pipeline(proposer(trial, nom)), X_tr, y_tr, folds)
            for cle in ["logloss_std", "brier", "pr_auc", "logloss_folds"]:
                trial.set_user_attr(cle, res[cle])
            return res["logloss"]

        debut = time.time()
        etude = optuna.create_study(direction="minimize", sampler=TPESampler(seed=SEED))
        etude.optimize(objectif, n_trials=n_essais)
        meilleur = etude.best_trial

        fixe = lambda: construire_pipeline(proposer(optuna.trial.FixedTrial(etude.best_params), nom))
        pipe = fixe().fit(X_tr, y_tr)
        joblib.dump(pipe, modeles / f"{cible}_{nom}.joblib")
        _, oof = evaluer_cv(fixe(), X_tr, y_tr, folds)
        predictions.append(pd.DataFrame({"cible": cible, "modele": nom, "bloc": "hors fold", "y": y_tr, "p": oof}).dropna())
        predictions.append(pd.DataFrame({"cible": cible, "modele": nom, "bloc": "validation", "y": y_va,
                                         "p": pipe.predict_proba(X_va)[:, 1]}, index=valid.index))

        for t in etude.trials:
            retenu = t.number == meilleur.number
            journal.append({"date": date, "commit": commit, "cible": cible, "modele": nom, "essai": t.number,
                            "params": json.dumps(t.params), "cv_logloss": round(t.value, 5),
                            "cv_logloss_std": round(t.user_attrs["logloss_std"], 5),
                            "cv_brier": round(t.user_attrs["brier"], 5), "cv_pr_auc": round(t.user_attrs["pr_auc"], 5),
                            "logloss_par_fold": json.dumps(t.user_attrs["logloss_folds"]), "retenu": retenu,
                            "artefact_modele": f"runs/models/{cible}_{nom}.joblib" if retenu else "",
                            "figure": "figures/02_optuna_historique.png"})
        print(f"{cible:10s} {nom:5s} : log-loss CV {meilleur.value:.4f} (essai {meilleur.number}) en {time.time() - debut:.0f} s")

    pd.DataFrame(journal).to_csv(sortie / "trials_log.csv", index=False)
    pd.concat(predictions).rename_axis("date").to_csv(sortie / "predictions_02.csv")
    print(f"{sortie}/trials_log.csv : {len(journal)} essais ; modèles dans {modeles}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--essais", type=int, default=50)
    parser.add_argument("--sortie", default=str(RUNS), help="dossier où écrire le journal, les prédictions et les modèles")
    args = parser.parse_args()
    main(args.essais, args.sortie)
