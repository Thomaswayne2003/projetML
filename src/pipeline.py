"""Étape B : la pipeline scikit-learn et les espaces de recherche des modèles (notebook 02)."""
from lightgbm import LGBMClassifier
from sklearn.cluster import KMeans
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .config import FEATURES, REGIME, SEED

K_REGIMES = 2   # coude du k-means sur l'entraînement (notebook 02, L3B)


def construire_pipeline(modele, k: int = K_REGIMES) -> Pipeline:
    """Imputation, distances aux régimes k-means, standardisation, puis le modèle.

    Tout ce qui apprend un paramètre est dans la pipeline, donc ajusté sur le fold d'entraînement seulement.
    """
    regime = Pipeline([("impute", SimpleImputer(strategy="median")),
                       ("scale", StandardScaler()),
                       ("kmeans", KMeans(n_clusters=k, n_init=10, random_state=SEED))])
    prep = ColumnTransformer([("vars", SimpleImputer(strategy="median"), FEATURES),
                              ("regime", regime, REGIME)])
    return Pipeline([("prep", prep), ("scale", StandardScaler()), ("model", modele)])


def proposer(trial, nom: str):
    """Modèle proposé par un essai Optuna (ou par optuna.trial.FixedTrial pour des paramètres fixés)."""
    poids = trial.suggest_categorical("class_weight", [None, "balanced"])
    if nom == "logit":
        # saga ne pénalise pas l'intercept b (liblinear le pénalise)
        return LogisticRegression(C=trial.suggest_float("C", 1e-3, 10, log=True),
                                  penalty=trial.suggest_categorical("penalty", ["l1", "l2"]),
                                  solver="saga", class_weight=poids, max_iter=5000, random_state=SEED)
    if nom == "rf":
        return RandomForestClassifier(n_estimators=trial.suggest_int("n_estimators", 100, 500, step=100),
                                      max_depth=trial.suggest_int("max_depth", 2, 4),
                                      min_samples_leaf=trial.suggest_int("min_samples_leaf", 5, 15),
                                      max_features=trial.suggest_categorical("max_features", ["sqrt", 0.5]),
                                      class_weight=poids, random_state=SEED, n_jobs=1)
    if nom == "lgbm":
        return LGBMClassifier(n_estimators=trial.suggest_int("n_estimators", 50, 300, step=25),
                              learning_rate=trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
                              num_leaves=trial.suggest_int("num_leaves", 4, 8),
                              min_child_samples=trial.suggest_int("min_child_samples", 5, 15),
                              reg_lambda=trial.suggest_float("reg_lambda", 0.0, 5.0),
                              class_weight=poids, random_state=SEED, n_jobs=1, verbose=-1)
    raise ValueError(f"modèle inconnu : {nom}")
