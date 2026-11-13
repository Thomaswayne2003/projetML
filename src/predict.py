"""Signal du mois : probabilité, score, action et couverture pour un mois donné.

Utilisé par la plateforme (étape 7). Usage : python -m src.predict [--mois 2026-10]
"""
import argparse

import joblib
import numpy as np
import pandas as pd

from .config import COLONNES, ROOT
from .data import charger_table
from .decision import actions, appliquer_platt, charger_decision


def signal(mois: str | None = None, table: pd.DataFrame | None = None) -> dict:
    """Signal pour le mois suivant, à partir des données de fin de `mois` (par défaut, la ligne à prédire)."""
    table = charger_table() if table is None else table
    dec = charger_decision()
    if mois is None:
        ligne = table[table["bloc"] == "à prédire"]
    else:
        ligne = table[table.index.strftime("%Y-%m") == mois]
    if ligne.empty:
        raise KeyError(f"aucune donnée pour {mois}")
    pipe = joblib.load(ROOT / dec["fichiers_modeles"][dec["modele_nikkei"]])
    p_baisse = float(appliquer_platt(pipe.predict_proba(ligne[COLONNES])[:, 1], dec["platt"][dec["modele_nikkei"]])[0])
    p_hausse = 1 - p_baisse
    action = actions(pd.Series([p_hausse], index=ligne.index), dec["couts_entrainement_exces_du_cash"], dec["marge_m"]).iloc[0]
    resultat = ligne["target_rn_next"].iloc[0]
    return {"mois_des_donnees": ligne.index[0].strftime("%Y-%m"), "bloc": ligne["bloc"].iloc[0],
            "p_hausse": round(p_hausse, 4), "score": round(2 * p_hausse - 1, 4),
            "action_du_modele": action, "couverture": "couvert" if action == "acheter" else "sans objet",
            "seuils": {k: round(v, 4) for k, v in dec["seuils"].items()},
            "recommandation_finale": "toujours acheter, couvert (le modèle ne bat pas la constante sur le test)",
            "rendement_realise_mois_suivant": None if np.isnan(resultat) else round(float(resultat), 4)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mois", default=None, help="mois des données, au format AAAA-MM")
    for cle, valeur in signal(parser.parse_args().mois).items():
        print(f"{cle:32s} {valeur}")
