"""Exploration après coup : une décision prise chaque matin à l'ouverture de Tokyo, sur un produit réellement achetable.

Sur l'indice, un signal apparaissait à l'ouverture (src.banc_essai_jour), mais l'indice ouvre avec des cours en partie
périmés. Ici, on le teste sur l'ETF Nikkei 225 coté à Tokyo (code 1321), dont l'ouverture est un vrai prix d'échange
(data/1_brutes/nikkei_etf_1321.csv, Yahoo Finance).

Décision : à l'ouverture du jour J+1, en connaissant tout ce qui était connu à la clôture de Tokyo du jour J,
la séance de Wall Street de la nuit, et le saut d'ouverture de l'ETF. Cible : l'ETF baisse-t-il entre l'ouverture et la
clôture de J+1 ? Le test 2024-2026 avait déjà été ouvert : ces chiffres ne remplacent pas le résultat du projet.

Usage : python -m src.banc_essai_ouverture     écrit runs/exploration_ouverture.json
"""
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd

from .banc_essai_jour import TEST, charger, marcher, mesurer, variables
from .config import ROOT, RUNS, commit_courant

SORTIE = RUNS / "exploration_ouverture.json"
FRAIS = [0.0, 0.0002, 0.0005, 0.0010]          # coût d'un aller-retour (achat à l'ouverture, revente à la clôture)
MARGE = 0.03                                   # on ne prend position que si la probabilité s'écarte de 50 % d'au moins 3 points


def charger_etf() -> pd.DataFrame:
    for dossier in [ROOT / "data" / "1_brutes"]:
        if (dossier / "nikkei_etf_1321.csv").exists():
            return pd.read_csv(dossier / "nikkei_etf_1321.csv", parse_dates=[0], index_col=0)
    raise SystemExit("nikkei_etf_1321.csv introuvable (cherché dans data/1_brutes/)")


def bilan(gains: pd.Series, positions: pd.Series) -> dict:
    """Résultat d'une suite de paris d'une séance : `gains` nets, un par séance (0 quand on reste à l'écart)."""
    pris = positions != 0
    valeur = (1 + gains).cumprod()
    return {"seances_jouees": int(pris.sum()), "part_des_seances_%": float(pris.mean() * 100),
            "paris_gagnants_%": float((gains[pris] > 0).mean() * 100) if pris.any() else None,
            "gain_moyen_par_pari_pb": float(gains[pris].mean() * 1e4) if pris.any() else None,
            "cumul": float(valeur.iloc[-1] - 1), "perte_maximale": float((valeur / valeur.cummax() - 1).min()),
            "rendement_par_unite_de_risque": float(gains.mean() / gains.std() * np.sqrt(252)) if gains.std() > 0 else 0.0}


def main() -> None:
    warnings.filterwarnings("ignore")
    d, etf = charger(), charger_etf()
    etf = etf.reindex(d.index)
    ouverture, cloture = etf["Open"], etf["Close"]
    saut = (ouverture.shift(-1) / cloture - 1).where(lambda s: s.abs() < 0.15)       # connu à l'ouverture de J+1
    seance = cloture.shift(-1) / ouverture.shift(-1) - 1                             # ce qu'on cherche à prévoir
    seance = seance.where(etf["Volume"].shift(-1) > 0)
    v = variables(d)
    X = pd.concat([v["tokyo"], v["ailleurs_veille"], v["wall_street_du_soir"]], axis=1).assign(saut_d_ouverture=saut)
    y = (seance <= 0).astype(float).where(seance.notna() & saut.notna())

    pred = marcher(X, y, 1)
    mesures = mesurer(pred, 1)

    # Stratégies d'une séance, sur le test : +1 = acheter à l'ouverture, -1 = vendre à découvert, 0 = rester à l'écart
    test = pred.loc[TEST[0]:TEST[1]]
    r = seance.reindex(test.index)
    p_hausse = 1 - test["moitié logistique, moitié LightGBM"]
    nuit = d["sp500"].pct_change().reindex(test.index)
    regles = {"modèle (moitié logistique, moitié LightGBM)": np.sign(p_hausse - 0.5).where((p_hausse - 0.5).abs() >= MARGE, 0.0),
              "modèle, achats seulement": (p_hausse >= 0.5 + MARGE).astype(float),
              "règle simple : suivre Wall Street de la nuit": np.sign(nuit).fillna(0.0),
              "règle simple : suivre le saut d'ouverture": np.sign(saut.reindex(test.index)).fillna(0.0),
              "toujours acheter à l'ouverture, revendre à la clôture": pd.Series(1.0, index=test.index)}
    strategies = {nom: {f"frais {f * 1e4:.0f} pb": bilan(pos * r - pos.abs() * f, pos) for f in FRAIS} for nom, pos in regles.items()}
    etf_test = cloture.loc[TEST[0]:TEST[1]].dropna()
    garder = bilan(etf_test.pct_change().dropna(), pd.Series(1.0, index=etf_test.index[1:]))

    # Deux contrôles : l'ouverture de l'ETF est-elle un vrai prix ? et le signal dépend-il de quelques séances ?
    indice_saut, indice_seance = d["n225_open"].shift(-1) / d["n225_close"] - 1, d["n225_close"].shift(-1) / d["n225_open"].shift(-1) - 1
    controles = {"correlation_saut_puis_seance_sur_l_indice": float(indice_saut.corr(indice_seance)),
                 "correlation_saut_puis_seance_sur_l_etf": float(saut.corr(seance)),
                 "correlation_wall_street_puis_seance_de_l_etf": float(d["sp500"].pct_change().corr(seance)),
                 "correlation_wall_street_puis_saut_de_l_etf": float(d["sp500"].pct_change().corr(saut))}
    par_annee = {}
    for an, bloc in pred.groupby(pred.index.year):
        p, yy = bloc["moitié logistique, moitié LightGBM"].clip(1e-4, 1 - 1e-4), bloc["y"]
        perte = lambda q: -(yy * np.log(q) + (1 - yy) * np.log(1 - q))
        ecart = perte(p) - perte(bloc["constante"])
        par_annee[int(an)] = {"seances": int(len(bloc)), "ecart_vs_constante": float(ecart.mean()), "erreur_type": float(ecart.std(ddof=1) / np.sqrt(len(ecart)))}

    sortie = {"avertissement": "Exploration après coup : le test 2024-2026 avait déjà été ouvert. Ces chiffres ne remplacent pas "
                               "runs/evaluation_test.json, qui reste le résultat du projet.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "methode": {"produit": "ETF Nikkei 225 coté à Tokyo (1321.T), prix non ajustés, Yahoo Finance",
                          "decision": "à l'ouverture de J+1 ; position tenue jusqu'à la clôture de J+1",
                          "variables": int(X.shape[1]), "marge_de_decision": MARGE, "frais_testes_aller_retour": FRAIS,
                          "reentrainement": "toutes les 20 séances, sur tout le passé"},
              "prevision": mesures, "ecart_par_annee": par_annee, "controles": controles,
              "strategies_sur_le_test": strategies, "acheter_et_garder_l_etf_sur_le_test": garder}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))

    for cle, b in mesures.items():
        print(f"\n{cle} : {b['observations']} séances, {b['part_de_baisses_%']:.1f} % de baisses")
        for m, x in b["modeles"].items():
            print(f"   {m:38s} écart {x['ecart_vs_constante']:+.4f} ± {x['erreur_type']:.4f}  AUC {x['auc']:.3f}  bon sens {x['bon_sens_%']:.1f} %")
    print("\ncontrôles :", {k: round(x, 3) for k, x in controles.items()})
    print("par année :", {a: f"{x['ecart_vs_constante']:+.4f}±{x['erreur_type']:.4f}" for a, x in par_annee.items()})
    for nom, f in strategies.items():
        print(f"\n{nom}")
        for cle, b in f.items():
            print(f"   {cle:12s} {b['seances_jouees']:4d} paris, {b['paris_gagnants_%']:.1f} % gagnants, {b['gain_moyen_par_pari_pb']:+.1f} pb/pari, "
                  f"cumul {b['cumul']:+.1%}, perte max {b['perte_maximale']:.1%}, ratio {b['rendement_par_unite_de_risque']:.2f}")
    print(f"\nacheter et garder l'ETF : cumul {garder['cumul']:+.1%}, perte max {garder['perte_maximale']:.1%}, ratio {garder['rendement_par_unite_de_risque']:.2f}")
    print(f"écrit : {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
