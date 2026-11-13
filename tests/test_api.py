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
    contrib = client.get("/explication", params={"mois": "2024-07"}).json()
    assert len(contrib) == 12


def test_historique_et_evaluation():
    h = client.get("/historique", params={"bloc": "test"}).json()
    assert len(h) == 33
    assert client.get("/evaluation").json()["plancher_battu"] is False
