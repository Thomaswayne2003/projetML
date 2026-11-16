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


def test_mois_disponibles():
    mois = client.get("/mois").json()
    assert mois[0] == {"mois": "2026-10", "bloc": "à prédire"}
    assert len(mois) == 24 + 33 + 1


def test_prediction_selon_l_information():
    base = client.get("/prediction", params={"mois": "2026-10"}).json()
    assert base["p_hausse"] == client.get("/signal", params={"mois": "2026-10"}).json()["p_hausse"]
    assert base["variables_modifiees"] == {} and len(base["contributions"]) == 12
    # moins de news que d'habitude : le modèle doit juger la hausse plus probable (coefficient positif vers la baisse)
    calme = client.get("/prediction", params={"mois": "2026-10", "news_attention_6m": -0.8}).json()
    assert calme["p_hausse"] > base["p_hausse"] and calme["variables_modifiees"] == {"news_attention_6m": -0.8}
    assert client.get("/prediction", params={"news_attention_6m": "beaucoup"}).status_code == 422


def test_variables_et_decision():
    variables = client.get("/variables").json()
    assert len(variables) == 6 and all(v["min"] < v["max"] for v in variables)
    decision = client.get("/decision").json()
    assert decision["marge"] == 0.005 and decision["seuils"]["theta_v"] < decision["seuils"]["theta_a"]


def test_donnees_des_scenes_3d():
    serie = client.get("/serie").json()
    assert len(serie) == 201 and serie[-1]["baisse"] is None and sum(m["news"] for m in serie[:143]) == 57
    assert sum(m["baisse"] for m in serie if m["bloc"] == "test") == 12
    essais = client.get("/essais").json()
    assert len(essais) == 200 and {e["modele"] for e in essais} == {"logit", "rf", "lgbm"}
    surface = client.get("/surface").json()
    assert len(surface["cout"]) == len(surface["axe"]) == 41
    trajets = surface["trajectoires"]
    assert trajets["classique (1/L)"]["converge"] and not trajets["au-delà de la limite"]["converge"]
    assert min(map(min, surface["cout"])) >= surface["optimum"][2] - 1e-6      # l'optimum est bien le minimum


def test_volatilite_et_verifications():
    # second volet, ajouté après le test : la série couvre les mêmes 33 mois de test que le projet
    v = client.get("/volatilite").json()
    test = [p for p in v["serie"] if p["bloc"] == "test"]
    assert len(test) == 33 and all(0.03 < p["prevue"] < 1 and 0 <= p["p_agite"] <= 1 for p in test)
    assert v["serie"][-1]["bloc"] == "à prédire" and v["serie"][-1]["reelle"] is None
    achat = v["usage"]["test_2024_2026"]["position"]["acheter_et_garder"]["cumul"]
    assert abs(achat - client.get("/evaluation").json()["performance_euros"]["toujours acheter, couvert"]["cumul"]) < 1e-3
    verif = client.get("/verifications").json()
    assert verif["vingt_modeles"]["configurations"] == len(verif["vingt_modeles"]["classement_sur_le_test"]) == 40
    assert set(verif["historique_long"]) == {"2010-02", "2000-01", "1985-01", "1971-06"}


def test_signal_risque():
    # signal fondé sur le risque : règle figée sur 2000-2015, série hebdomadaire de 2003 à aujourd'hui
    s = client.get("/signal_risque").json()
    assert s["regle"]["donnees_utilisees"].endswith("2015-12-31 uniquement")
    bas, haut = s["regle"]["seuils_volatilite_annuelle"]
    assert 0.05 < bas < haut < 0.6
    assert s["serie"][0]["date"] < "2004" and {p["signal"] for p in s["serie"]} <= {0.0, 0.5, 1.0}
    assert s["aujourd_hui"]["signal"] in {"acheter plein", "acheter à moitié", "ne pas acheter"}


def test_pages_php_valides():
    # syntaxe des pages PHP du site, si PHP est installé
    import shutil
    import subprocess
    from pathlib import Path
    php = shutil.which("php") or "/opt/homebrew/bin/php"
    if not Path(php).exists():
        import pytest
        pytest.skip("PHP n'est pas installé")
    for fichier in sorted(Path(__file__).resolve().parents[1].glob("web/**/*.php")):
        resultat = subprocess.run([php, "-l", str(fichier)], capture_output=True, text=True)
        assert resultat.returncode == 0, resultat.stdout + resultat.stderr
