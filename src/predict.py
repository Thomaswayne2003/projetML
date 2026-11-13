"""Signal du mois, historique des décisions et explication SHAP, avec la décision figée.

Utilisé par la plateforme (API et tableau de bord). Usage : python -m src.predict [--mois 2026-10]
"""
import argparse
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd

from .config import COLONNES, FEATURES, ROOT
from .data import charger_table
from .decision import actions, appliquer_platt, charger_decision, rendements

RECOMMANDATION = "toujours acheter, couvert (le modèle ne bat pas la constante sur le test)"


@lru_cache(maxsize=1)
def _modele():
    dec = charger_decision()
    return dec, joblib.load(ROOT / dec["fichiers_modeles"][dec["modele_nikkei"]])


def _ligne(table: pd.DataFrame, mois: str | None) -> pd.DataFrame:
    ligne = table[table["bloc"] == "à prédire"] if mois is None else table[table.index.strftime("%Y-%m") == mois]
    if ligne.empty:
        raise KeyError(f"aucune donnée pour le mois {mois}")
    return ligne


def probabilites_hausse(lignes: pd.DataFrame) -> pd.Series:
    """Probabilité calibrée de hausse le mois suivant : 1 - Platt(P(baisse))."""
    dec, pipe = _modele()
    p_baisse = appliquer_platt(pipe.predict_proba(lignes[COLONNES])[:, 1], dec["platt"][dec["modele_nikkei"]])
    return pd.Series(1 - p_baisse, index=lignes.index)


def signal(mois: str | None = None, table: pd.DataFrame | None = None) -> dict:
    """Signal pour le mois suivant, à partir des données de fin de `mois` (par défaut, la ligne à prédire)."""
    table = charger_table() if table is None else table
    dec, _ = _modele()
    ligne = _ligne(table, mois)
    p_hausse = float(probabilites_hausse(ligne).iloc[0])
    action = actions(pd.Series([p_hausse], index=ligne.index), dec["couts_entrainement_exces_du_cash"], dec["marge_m"]).iloc[0]
    resultat = ligne["target_rn_next"].iloc[0]
    return {"mois_des_donnees": ligne.index[0].strftime("%Y-%m"), "bloc": ligne["bloc"].iloc[0],
            "p_hausse": round(p_hausse, 4), "score": round(2 * p_hausse - 1, 4),
            "action_du_modele": action, "couverture": "couvert" if action == "acheter" else "sans objet",
            "seuils": {k: round(v, 4) for k, v in dec["seuils"].items()},
            "recommandation_finale": RECOMMANDATION,
            "rendement_realise_mois_suivant": None if np.isnan(resultat) else round(float(resultat), 4)}


def historique(table: pd.DataFrame | None = None, blocs=("validation", "test")) -> pd.DataFrame:
    """Probabilité, action et rendements en euros mois par mois, pour les blocs demandés."""
    table = charger_table() if table is None else table
    dec, _ = _modele()
    d = table[table["bloc"].isin(blocs)]
    p = probabilites_hausse(d)
    act = actions(p, dec["couts_entrainement_exces_du_cash"], dec["marge_m"])
    return pd.DataFrame({"bloc": d["bloc"], "p_hausse": p, "action": act,
                         "hausse_realisee": (d["y_baisse"] == 0).astype(int),
                         "rendement_regle": rendements(act, d),
                         "rendement_achat_couvert": d["target_reur_hedged_next"],
                         "rendement_cash": d["eur_overnight"] / 100 / 12})


def contributions(mois: str | None = None, table: pd.DataFrame | None = None) -> pd.DataFrame:
    """SHAP du modèle linéaire : φ_j = w_j (z_j - moyenne d'entraînement de z_j), en log-odds de la baisse."""
    table = charger_table() if table is None else table
    _, pipe = _modele()
    prep, w = pipe[:-1], pipe.named_steps["model"].coef_[0]
    z_moyen = prep.transform(table.loc[table["bloc"] == "entraînement", COLONNES]).mean(axis=0)
    ligne = _ligne(table, mois)
    z = prep.transform(ligne[COLONNES])[0]
    noms = FEATURES + ["distance au régime 0", "distance au régime 1"]
    valeurs = pipe.named_steps["prep"].transform(ligne[COLONNES])[0]
    return (pd.DataFrame({"variable": noms, "valeur": valeurs, "contribution": w * (z - z_moyen)})
            .sort_values("contribution", key=np.abs, ascending=False).reset_index(drop=True))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mois", default=None, help="mois des données, au format AAAA-MM")
    for cle, valeur in signal(parser.parse_args().mois).items():
        print(f"{cle:32s} {valeur}")
