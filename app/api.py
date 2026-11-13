"""API du projet Nikkei : le point d'accès qui sert la prédiction (« served prediction endpoint » de l'énoncé).

Lancer depuis la racine du dépôt : uvicorn app.api:app --reload
Documentation interactive : http://127.0.0.1:8000/docs
"""
import json

from fastapi import FastAPI, HTTPException, Query

from src.config import RUNS
from src.data import charger_table
from src.decision import charger_decision
from src.predict import contributions, historique, signal

app = FastAPI(title="Projet Nikkei", version="1.0",
              description="Signal mensuel acheter / neutre / vendre sur le Nikkei 225 pour un investisseur en euros.")
TABLE = charger_table()


@app.get("/sante")
def sante() -> dict:
    """État du service et de la décision figée."""
    dec = charger_decision()
    return {"statut": "ok", "modele": dec["modele_nikkei"], "decision_calculee_le": dec["date"],
            "dernier_mois_disponible": TABLE.index.max().strftime("%Y-%m")}


@app.get("/signal")
def signal_du_mois(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="mois des données, AAAA-MM")) -> dict:
    """Probabilité de hausse du mois suivant, score, action du modèle et recommandation finale."""
    try:
        return signal(mois, TABLE)
    except KeyError as erreur:
        raise HTTPException(status_code=404, detail=str(erreur))


@app.get("/explication")
def explication(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$")) -> list[dict]:
    """Contributions SHAP de chaque variable au log-odds de la baisse, de la plus forte à la plus faible."""
    try:
        return contributions(mois, TABLE).round(4).to_dict(orient="records")
    except KeyError as erreur:
        raise HTTPException(status_code=404, detail=str(erreur))


@app.get("/historique")
def historique_des_decisions(bloc: str = Query("test", pattern="^(validation|test)$")) -> list[dict]:
    """Décisions mois par mois et rendements réalisés, sur la validation ou le test."""
    h = historique(TABLE, blocs=(bloc,)).round(4).reset_index()
    h["date"] = h["date"].dt.strftime("%Y-%m")
    return h.to_dict(orient="records")


@app.get("/evaluation")
def evaluation() -> dict:
    """Résultats de l'évaluation unique sur le test 2024-2026."""
    return json.loads((RUNS / "evaluation_test.json").read_text())
