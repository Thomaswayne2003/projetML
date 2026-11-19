"""Évaluation sur le test 2024-2026 avec la décision figée (notebook 03b).

Le test a été évalué une seule fois, au commit 775a352 (runs/evaluation_test.json).
Usage : python -m src.evaluate --verifier   recalcule et compare au fichier, sans rien écrire
"""
import argparse
import json

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss

from .config import COLONNES, ROOT, RUNS
from .data import charger_table
from .decision import actions, appliquer_platt, charger_decision, rendements

FICHIER = RUNS / "evaluation_test.json"


def evaluer() -> dict:
    table, dec = charger_table(), charger_decision()
    train, test = table[table["bloc"] == "entraînement"], table[table["bloc"] == "test"]
    y = test["y_baisse"].astype(int)
    pipe = joblib.load(ROOT / dec["fichiers_modeles"][dec["modele_nikkei"]])
    p_baisse = appliquer_platt(pipe.predict_proba(test[COLONNES])[:, 1], dec["platt"][dec["modele_nikkei"]])
    p_const = np.full(len(y), train["y_baisse"].mean())
    act = actions(pd.Series(1 - p_baisse, index=test.index), dec["couts_entrainement_exces_du_cash"], dec["marge_m"])
    cumul = lambda r: float(np.prod(1 + np.asarray(r)) - 1)
    return {"log_loss_modele": log_loss(y, p_baisse), "log_loss_constante": log_loss(y, p_const),
            "brier_modele": brier_score_loss(y, p_baisse), "pr_auc_modele": average_precision_score(y, p_baisse),
            "actions": act.value_counts().to_dict(), "cumul_regle": cumul(rendements(act, test)),
            "cumul_achat_couvert": cumul(test["target_reur_hedged_next"])}


def verifier() -> None:
    fige, r = json.loads(FICHIER.read_text()), evaluer()
    attendu = {"log_loss_modele": fige["metriques"]["logistique"]["log-loss"],
               "log_loss_constante": fige["metriques"]["constante (fréquence de l'entraînement)"]["log-loss"],
               "cumul_regle": fige["performance_euros"]["règle du modèle"]["cumul"],
               "cumul_achat_couvert": fige["performance_euros"]["toujours acheter, couvert"]["cumul"]}
    for cle, valeur in attendu.items():
        print(f"{cle:22s} figé {valeur:.4f} | recalculé {r[cle]:.4f}")
        assert abs(valeur - r[cle]) < 1e-3, f"{cle} ne correspond pas"
    assert r["actions"] == fige["actions"], "les actions ne correspondent pas"
    print("évaluation du test retrouvée à l'identique (rien n'a été réécrit)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--verifier", action="store_true", required=True)
    parser.parse_args()
    verifier()
