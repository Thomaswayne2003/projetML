"""Tests rapides : fuites, pipeline, descente de gradient, décision. Lancer : python -m pytest -q"""
import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression

from src.config import COLONNES, FEATURES
from src.data import audit_fuites, ajouter_blocs, ajouter_cibles, charger_mensuel, construire_table, variables_news
from src.decision import actions, seuils
from src.logreg_scratch import ajuster, cout, gradient
from src.pipeline import construire_pipeline


def test_table_et_audit():
    table = construire_table()
    assert table["bloc"].value_counts().to_dict() == {"entraînement": 143, "test": 33, "validation": 24, "à prédire": 1}
    assert table.loc[table["bloc"] == "à prédire", "y_baisse"].isna().all()


def test_variables_news_sans_regard_vers_le_futur():
    df = ajouter_cibles(charger_mensuel())
    complet, coupe = variables_news(df), variables_news(df.loc[:"2019-12-31"])
    assert np.allclose(complet.loc[:"2019-12-31"].to_numpy(), coupe.to_numpy(), equal_nan=True)


def _table_avec_fuite(colonne, valeurs):
    df = ajouter_blocs(ajouter_cibles(charger_mensuel()))
    df[["news_attention_6m", "news_sent_w", "news_dispo"]] = variables_news(df)
    df[colonne] = valeurs(df)
    return df


@pytest.mark.parametrize("colonne", ["n225_ret_1m", "vix", "carry_1m", "news_attention_6m"])
def test_audit_detecte_une_fuite_dans_n_importe_quelle_variable(colonne):
    # fuite volontaire : la variable recopie (à l'échelle près) le rendement du mois suivant
    df = _table_avec_fuite(colonne, lambda d: 100 * d["target_rn_next"] + 3)
    with pytest.raises(AssertionError):
        audit_fuites(df)


def test_audit_accepte_les_vraies_donnees():
    df = _table_avec_fuite("vix", lambda d: d["vix"])
    audit_fuites(df)


def test_pipeline_ajuste_sur_l_entrainement_seulement():
    table = construire_table()
    train = table[table["bloc"] == "entraînement"]
    tout = table[table["bloc"] != "à prédire"]
    pipe = construire_pipeline(LogisticRegression(max_iter=1000)).fit(train[COLONNES], train["y_baisse"])
    imputation = pipe.named_steps["prep"].named_transformers_["vars"].statistics_
    assert np.allclose(imputation, train[FEATURES].median().to_numpy())             # médianes de l'entraînement
    assert not np.allclose(imputation, tout[FEATURES].median().to_numpy())          # pas celles de toutes les données
    sortie_brute = pipe.named_steps["prep"].transform(train[COLONNES])
    assert np.allclose(pipe.named_steps["scale"].mean_, sortie_brute.mean(axis=0))   # standardisation de l'entraînement


def test_gradient_et_descente():
    rng = np.random.default_rng(0)
    X, y = rng.normal(size=(200, 4)), rng.integers(0, 2, 200)
    w, b = rng.normal(size=4), 0.2
    gw, gb = gradient(w, b, X, y, 0.1)
    eps = 1e-6
    num = [(cout(w + eps * e, b, X, y, 0.1) - cout(w - eps * e, b, X, y, 0.1)) / (2 * eps) for e in np.eye(4)]
    assert np.allclose(gw, num, atol=1e-7)
    w_gd, b_gd, _ = ajuster(X, y, lam=0.1)
    ref = LogisticRegression(C=1 / (2 * 200 * 0.1), tol=1e-12, max_iter=10000).fit(X, y)
    assert np.allclose(np.r_[w_gd, b_gd], np.r_[ref.coef_[0], ref.intercept_[0]], atol=1e-5)


def test_regle_de_decision():
    couts = {"B_u": 0.04, "B_d": -0.04, "S_u": -0.04, "S_d": 0.04}
    s = seuils(couts, 0.005)
    act = actions(pd.Series([0.9, 0.5, 0.1]), couts, 0.005)
    assert s["theta_v"] < 0.5 < s["theta_a"]
    assert act.tolist() == ["acheter", "neutre", "vendre"]
