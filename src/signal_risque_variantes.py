"""Trois améliorations du signal fondé sur le risque, plus leur combinaison, testées sans tricher.

Les variantes ont été écrites AVANT de voir leurs résultats, pour une raison de principe :
  A. Levier en période calme : part investie = c / variance prévue, jusqu'à 150 % (contrats à terme). c est choisi pour
     que la part investie moyenne vaille 100 % sur 2003-2015 (aucun rendement n'intervient dans ce choix).
  B. Sortir lentement, revenir vite : on remonte d'un niveau dès le premier soir, on descend après trois soirs ; et l'on
     ne sort entièrement que si le cours est aussi sous sa moyenne des 200 dernières séances (filtre de tendance).
  C. Décider seulement en fin de mois, avec la règle figée de src.signal_risque.
  D. Les trois ensemble : part c / variance prévue revue en fin de mois, jusqu'à 150 %, ramenée à 50 % au plus quand le
     cours est sous sa moyenne 200 séances et le risque très élevé.

Protocole : `--figer` calcule c avec les seules données 2000-2015 et écrit runs/signal_risque_variantes_regle.json ;
sans option, le script applique ces réglages figés à 2003-2026. Toutes les variantes sont publiées. Quatre essais au lieu
d'un augmentent la chance qu'un d'eux réussisse par hasard : un écart doit dépasser nettement son erreur type.
Volet après coup : il ne remplace pas le résultat du projet.
"""
import argparse
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd

from . import signal_risque as S
from .config import ROOT, RUNS, commit_courant

REGLE = RUNS / "signal_risque_variantes_regle.json"
SORTIE = RUNS / "signal_risque_variantes.json"
PLAFOND = 1.5
MOYENNE_LONGUE = 200


def fin_de_mois(w: pd.Series) -> pd.Series:
    """Garde la valeur du dernier jour de chaque mois, tenue tout le mois suivant."""
    dernier = w.index.to_series().groupby(w.index.to_period("M")).transform("max") == w.index.to_series()
    return w.where(dernier).ffill().bfill()


def variante_b(vol: pd.Series, tendance_baissiere: pd.Series, seuils) -> pd.Series:
    zone = pd.Series(np.select([vol < seuils[0], vol < seuils[1]], [1.0, 0.5], 0.0), index=vol.index)
    zone = zone.where(~((zone == 0.0) & ~tendance_baissiere.reindex(vol.index).fillna(False)), 0.5)   # pas de sortie totale en tendance haussière
    sortie, actuel, attente = [], 1.0, 0
    for z in zone.to_numpy():
        if z > actuel:
            actuel, attente = z, 0                       # revenir : tout de suite
        elif z < actuel:
            attente += 1
            if attente >= S.CONFIRMATION:                # sortir : après trois soirs
                actuel, attente = z, 0
        else:
            attente = 0
        sortie.append(actuel)
    return pd.Series(sortie, index=vol.index)


def positions(vol: pd.Series, d: pd.DataFrame, seuils, c: float) -> dict:
    baissier = d["close"] < d["close"].rolling(MOYENNE_LONGUE).mean()
    levier = (c / vol ** 2).clip(upper=PLAFOND)
    combine = fin_de_mois(levier)
    tres_risque = fin_de_mois(pd.Series((vol >= seuils[1]).astype(float), index=vol.index)) > 0
    combine = combine.where(~(tres_risque & fin_de_mois(baissier.reindex(vol.index).astype(float)).astype(bool)), combine.clip(upper=0.5))
    return {"acheter et garder": pd.Series(1.0, index=vol.index),
            "règle figée (jour, 3 niveaux)": S.niveaux(vol, seuils, S.CONFIRMATION),
            "A. levier en période calme (c / variance, jusqu'à 150 %)": levier,
            "B. sortir lentement, revenir vite, filtre de tendance": variante_b(vol, baissier, seuils),
            "C. décision en fin de mois": S.niveaux(vol, seuils, 1, fin_de_mois=True),
            "D. les trois ensemble": combine}


def prevoir(fin=None):
    d = S.charger()
    if fin:
        d = d.loc[:fin]
    regle = json.loads(S.REGLE.read_text())
    x, y = S.variables(d), S.cible(d)
    pred = S.marcher(d, x, y, fin)
    return d, regle, np.exp(pred[regle["modele"]])


def figer() -> None:
    if REGLE.exists():
        raise SystemExit(f"{REGLE.relative_to(ROOT)} existe déjà : les variantes sont figées.")
    _, regle, vol = prevoir(S.FIN_REGLAGE)
    c = float(1 / (1 / vol.loc["2003":S.FIN_REGLAGE] ** 2).mean())        # part moyenne de 100 % sur 2003-2015
    sortie = {"figee_le": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "donnees_utilisees": f"{S.DEBUT} -> {S.FIN_REGLAGE} uniquement", "c": c,
              "lecture_c": f"part investie = {c:.4f} / variance prévue, soit 100 % quand la volatilité prévue vaut {np.sqrt(c):.1%}",
              "plafond": PLAFOND, "moyenne_longue_seances": MOYENNE_LONGUE, "seuils_repris_de": "runs/signal_risque_regle.json",
              "seuils": regle["seuils_volatilite_annuelle"], "frais": S.FRAIS}
    REGLE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    print(json.dumps(sortie, indent=2, ensure_ascii=False))


def evaluer() -> None:
    if not REGLE.exists():
        raise SystemExit("Lancez d'abord : python -m src.signal_risque_variantes --figer")
    fige = json.loads(REGLE.read_text())
    d, regle, vol = prevoir()
    r = S.rendements(d)
    pos = positions(vol, d, fige["seuils"], fige["c"])
    resultats = {}
    for cote in ["couvert", "non_couvert"]:
        gains = {nom: S.appliquer(w, r, cote, 0.0 if nom == "acheter et garder" else S.FRAIS) for nom, w in pos.items()}
        for per, (a, b) in S.PERIODES.items():
            bloc = resultats.setdefault(cote, {}).setdefault(per, {})
            for nom, g in gains.items():
                g = g.loc[a:b]
                ligne = S.bilan(g, r["euros"], pos[nom])
                if nom != "acheter et garder":
                    part = pos[nom].loc[a:b].mean()                                         # même part moyenne, mais fixe
                    fixe = S.appliquer(pd.Series(part, index=vol.index), r, cote, 0.0).loc[a:b]
                    ligne["face_a_acheter_et_garder"] = S.ecart_ratio(g, gains["acheter et garder"].loc[a:b], r["euros"])
                    ligne["face_a_une_part_fixe_equivalente"] = S.ecart_ratio(g, fixe, r["euros"]) | {"part_fixe_%": float(part * 100)}
                bloc[nom] = ligne
    sortie = {"avertissement": "Volet après coup : variantes écrites avant de voir leurs résultats, réglées sur 2000-2015, toutes publiées. "
                               "Il ne remplace pas runs/evaluation_test.json.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(), "reglages_figes": fige,
              "resultats": resultats,
              "aujourd_hui": {nom: float(w.iloc[-1]) for nom, w in pos.items()}}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    for cote in ["couvert"]:
        for per, bloc in resultats[cote].items():
            print(f"\n=== {cote}, {per}")
            for nom, b in bloc.items():
                e = b.get("face_a_acheter_et_garder"), b.get("face_a_une_part_fixe_equivalente")
                comp = f"  vs garder {e[0]['ecart']:+.2f}±{e[0]['erreur_type']:.2f}  vs part fixe {e[1]['part_fixe_%']:.0f}% {e[1]['ecart']:+.2f}±{e[1]['erreur_type']:.2f}" if e[0] else ""
                print(f"  {nom[:44]:44s} {b['rendement_annuel_%']:+5.1f}%/an vol {b['volatilite_%']:4.1f} ratio {b['rendement_par_unite_de_risque']:+.2f} "
                      f"perte max {b['perte_maximale_%']:6.1f} investi {b['part_investie_moyenne_%']:3.0f}% {b['changements_par_an']:5.1f}/an{comp}")
    print("\naujourd'hui :", {k[:20]: round(v, 2) for k, v in sortie["aujourd_hui"].items()})
    print(f"écrit : {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--figer", action="store_true")
    figer() if p.parse_args().figer else evaluer()
