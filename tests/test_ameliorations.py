"""Tests de la troisième étape (src.ameliorations) : protocole figé, correction de Holm, stratégies. python -m pytest -q"""
import numpy as np
import pandas as pd
import pytest

from src import ameliorations as a


def test_protocole_fige_inchange():
    if not a.FICHIER_PROTOCOLE.exists():
        pytest.skip("protocole pas encore figé")
    assert a.verifier_protocole()["sha256"] == a.empreinte(a.PROTOCOLE)


def test_empreinte_change_si_le_protocole_change():
    autre = a.PROTOCOLE | {"reglages": "modifié après coup"}
    assert a.empreinte(autre) != a.empreinte(a.PROTOCOLE)


def test_holm():
    p = a.holm({"x": 0.01, "y": 0.04, "z": 0.03})
    assert p == pytest.approx({"x": 0.03, "z": 0.06, "y": 0.06})   # 3 × 0,01 ; 2 × 0,03 ; max(1 × 0,04, 0,06)


def test_bootstrap_ecart_nul_sur_deux_series_identiques():
    x = np.tile([0.01, -0.02, 0.03, 0.005], 30)
    b = a.bootstrap_sharpe(x, x)
    assert b["ecart"] == 0 and b["ic_90"] == [0, 0]


def test_reference_et_couverture():
    t = a.charger()
    un = pd.Series(1.0, index=t.index)
    ref = a.strategie(t, un, un, un)
    assert np.allclose(ref, t["target_reur_hedged_next"], equal_nan=True)
    non_couvert = a.strategie(t, un, 0 * un, un)
    assert np.allclose(non_couvert, t["target_reur_unhedged_next"], equal_nan=True)
    cash = t["eur_overnight"] / 100 / 12
    neutre = a.strategie(t, 0 * un, un, un)
    assert np.allclose(neutre, cash, equal_nan=True)


def test_variables_economiques_connues_et_sans_cible():
    t = a.charger()
    assert t[a.ECONOMIQUES].notna().all().all()
    assert not {c for c in a.ECONOMIQUES if c.startswith("target_") or c.startswith("y_")}
