"""Tests de l'API. Lancer : python -m pytest -q"""
from fastapi.testclient import TestClient

from app.api import app

client = TestClient(app)


def test_sante():
    r = client.get("/sante")
    assert r.status_code == 200 and r.json()["statut"] == "ok"


def test_signal_du_dernier_mois():
    s = client.get("/signal").json()
    assert s["mois_des_donnees"] == "2026-10"
    assert 0 <= s["p_hausse"] <= 1 and s["action_du_modele"] in {"acheter", "neutre", "vendre"}
    assert abs(s["score"] - (2 * s["p_hausse"] - 1)) < 1e-3


def test_signal_mois_inconnu_et_format():
    assert client.get("/signal", params={"mois": "1990-01"}).status_code == 404
    assert client.get("/signal", params={"mois": "janvier"}).status_code == 422


def test_explication_additive():
    # SHAP linéaire : valeur de base + somme des contributions = score du modèle (log-odds de la baisse)
    from src.data import charger_table
    from src.config import COLONNES
    from src.predict import _modele
    contrib = client.get("/explication", params={"mois": "2024-07"}).json()
    assert len(contrib) == 12
    _, pipe = _modele()
    table = charger_table()
    z_moyen = pipe[:-1].transform(table.loc[table["bloc"] == "entraînement", COLONNES]).mean(axis=0)
    base = pipe.named_steps["model"].decision_function(z_moyen.reshape(1, -1))[0]
    score = pipe.decision_function(table.loc[table.index.strftime("%Y-%m") == "2024-07", COLONNES])[0]
    assert abs(base + sum(c["contribution"] for c in contrib) - score) < 1e-3


def test_historique_et_evaluation():
    h = client.get("/historique", params={"bloc": "test"}).json()
    assert len(h) == 33
    assert client.get("/evaluation").json()["plancher_battu"] is False
