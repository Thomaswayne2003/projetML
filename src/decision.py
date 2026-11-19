"""Calibration de Platt, règle de décision par espérance de gain, et décision figée (notebook 03).

La décision du projet est figée dans runs/decision_finale.json (commit 0d8df2f, avant le test).
Usage :
  python -m src.decision --verifier   recalcule tout et compare à la décision figée, sans rien écrire
  python -m src.decision --ecrire     réécrit le fichier (refusé s'il existe déjà, sauf --forcer)
"""
import argparse
import json
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from .config import RUNS, commit_courant
from .data import charger_table

MODELES = ["logit", "rf", "lgbm"]
MARGE = 0.005          # gain espéré minimal au-dessus du cash pour prendre position, fixé à l'avance
FICHIER = RUNS / "decision_finale.json"


def logit(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))


def apprendre_platt(p_hors_fold, y_hors_fold) -> dict:
    """Platt : sigmoïde du log-odds du modèle, apprise sur les prédictions hors fold."""
    cal = LogisticRegression(C=1e6, max_iter=1000).fit(logit(p_hors_fold).reshape(-1, 1), y_hors_fold)
    return {"a": float(cal.coef_[0, 0]), "c": float(cal.intercept_[0])}


def appliquer_platt(p, platt: dict):
    return 1 / (1 + np.exp(-(platt["a"] * logit(p) + platt["c"])))


def couts_entrainement(train: pd.DataFrame) -> dict:
    """Rendements moyens en excès du cash d'un achat couvert et d'une vente, selon hausse ou baisse."""
    cash = train["eur_overnight"] / 100 / 12
    achat = train["target_reur_hedged_next"] - cash
    vente = train["target_short_eur_next"] - cash
    hausse = train["y_baisse"] == 0
    return {"B_u": float(achat[hausse].mean()), "B_d": float(achat[~hausse].mean()),
            "S_u": float(vente[hausse].mean()), "S_d": float(vente[~hausse].mean())}


def seuils(couts: dict, marge: float) -> dict:
    return {"theta_a": (marge - couts["B_d"]) / (couts["B_u"] - couts["B_d"]),
            "theta_v": (couts["S_d"] - marge) / (couts["S_d"] - couts["S_u"])}


def actions(p_hausse: pd.Series, couts: dict, marge: float) -> pd.Series:
    """Acheter ou vendre si le gain espéré au-dessus du cash dépasse la marge, sinon neutre."""
    gain_achat = p_hausse * couts["B_u"] + (1 - p_hausse) * couts["B_d"]
    gain_vente = p_hausse * couts["S_u"] + (1 - p_hausse) * couts["S_d"]
    meilleur = np.where(gain_achat >= gain_vente, "acheter", "vendre")
    return pd.Series(np.where(np.maximum(gain_achat, gain_vente) >= marge, meilleur, "neutre"), index=p_hausse.index)


def rendements(act: pd.Series, bloc: pd.DataFrame) -> pd.Series:
    """Rendement en euros du mois suivant : achat couvert, cash ou vente."""
    cash = bloc["eur_overnight"] / 100 / 12
    return pd.Series(np.select([act == "acheter", act == "vendre"],
                               [bloc["target_reur_hedged_next"], bloc["target_short_eur_next"]], cash), index=bloc.index)


def calculer_decision() -> dict:
    table = charger_table()
    train = table[table["bloc"] == "entraînement"]
    pred = pd.read_csv(RUNS / "predictions_02.csv", parse_dates=["date"])
    hors_fold = pred[(pred["cible"] == "nikkei") & (pred["bloc"] == "hors fold")]
    platt = {}
    for m in MODELES:
        d = hors_fold[hors_fold["modele"] == m]
        platt[m] = apprendre_platt(d["p"].to_numpy(), d["y"].astype(int).to_numpy())
    couts = couts_entrainement(train)
    return {"modele_nikkei": "logit", "platt": platt, "couts_entrainement_exces_du_cash": couts,
            "marge_m": MARGE, "seuils": seuils(couts, MARGE), "couverture": "toujours couvert (h = 1)"}


def charger_decision() -> dict:
    return json.loads(FICHIER.read_text())


def verifier() -> None:
    """Recalcule la décision et la compare au fichier figé."""
    fige, recalcul = charger_decision(), calculer_decision()
    ecarts = {"platt " + m: max(abs(fige["platt"][m][k] - recalcul["platt"][m][k]) for k in "ac") for m in MODELES}
    ecarts["coûts"] = max(abs(fige["couts_entrainement_exces_du_cash"][k] - v)
                          for k, v in recalcul["couts_entrainement_exces_du_cash"].items())
    ecarts["seuils"] = max(abs(fige["seuils"][k] - v) for k, v in recalcul["seuils"].items())
    for nom, e in ecarts.items():
        print(f"{nom:14s} écart max {e:.1e}")
    assert max(ecarts.values()) < 1e-6, "le recalcul ne retrouve pas la décision figée"
    print("décision figée retrouvée à l'identique")


def ecrire(forcer: bool = False) -> None:
    if FICHIER.exists() and not forcer:
        raise SystemExit(f"{FICHIER.name} existe et a été figé avant le test : rien n'est réécrit (utiliser --forcer)")
    decision = calculer_decision() | {"date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
                                      "fichiers_modeles": {m: f"runs/models/nikkei_{m}.joblib" for m in MODELES}}
    FICHIER.write_text(json.dumps(decision, indent=2, ensure_ascii=False))
    print(f"écrit : {FICHIER}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    groupe = parser.add_mutually_exclusive_group(required=True)
    groupe.add_argument("--verifier", action="store_true")
    groupe.add_argument("--ecrire", action="store_true")
    parser.add_argument("--forcer", action="store_true")
    args = parser.parse_args()
    verifier() if args.verifier else ecrire(args.forcer)
