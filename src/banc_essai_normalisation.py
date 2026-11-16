"""Exploration après coup : normaliser les variables sur une fenêtre glissante aide-t-il après le changement de régime ?

Dans le projet, chaque variable est centrée et réduite avec la moyenne et l'écart-type de tout l'entraînement.
Après 2022, plusieurs variables sortent de cette plage (le portage est à six écarts-types). Ici, chaque valeur est
comparée aux 24, 36 ou 60 derniers mois seulement : z = (x - moyenne récente) / écart-type récent, sans regarder le futur.
Les modèles sont ensuite réentraînés chaque mois, comme dans src.banc_essai. Le test avait déjà été ouvert.

Usage : python -m src.banc_essai_normalisation     écrit runs/exploration_normalisation.json
"""
import json
import warnings
from datetime import datetime

import pandas as pd
from joblib import Parallel, delayed

from .banc_essai import DEPART, marcher, perte, resumer
from .config import COLONNES, ROOT, RUNS, commit_courant
from .data import charger_table

SORTIE = RUNS / "exploration_normalisation.json"
FENETRES = [24, 36, 60]
MODELES = ["logistique L2 (modèle du projet)", "logistique très pénalisée", "logistique L1", "Random Forest (projet)", "LightGBM (projet)"]


def normaliser(table: pd.DataFrame, mois: int) -> pd.DataFrame:
    """Chaque variable continue est exprimée en écarts-types par rapport à ses `mois` derniers mois (mois courant inclus)."""
    t = table.copy()
    for col in [c for c in COLONNES if t[c].nunique() > 2]:           # l'indicateur de présence des news reste tel quel
        glissant = t[col].rolling(mois, min_periods=12)
        t[col] = ((t[col] - glissant.mean()) / glissant.std()).clip(-5, 5)
    return t


def main() -> None:
    warnings.filterwarnings("ignore")
    table = charger_table()
    table = table[table["bloc"] != "à prédire"]
    variantes = {"tout l'entraînement (projet)": table} | {f"{m} derniers mois": normaliser(table, m) for m in FENETRES}
    plan = [(v, nom) for v in variantes for nom in MODELES]
    morceaux = Parallel(n_jobs=-1)(delayed(marcher)(nom, "croissante", variantes[v]) for v, nom in plan)
    const = marcher("constante (fréquence passée)", "croissante", table).set_index("date")
    periodes = {"avant_test_2016_2023": table.index[DEPART:][(table["bloc"].iloc[DEPART:] != "test").to_numpy()],
                "test_2024_2026": table.index[table["bloc"] == "test"]}
    resultats = []
    for (v, nom), pred in zip(plan, morceaux):
        pred, ligne = pred.set_index("date"), {"normalisation": v, "modele": nom}
        for cle, mois in periodes.items():
            bloc = table.loc[mois]
            ref = pd.Series(perte(bloc["y_baisse"], const.loc[mois, "p_baisse"]), index=mois)
            ligne[cle] = resumer(pred.loc[mois], bloc, ref)
        resultats.append(ligne)
    sortie = {"avertissement": "Exploration après coup : le test 2024-2026 avait déjà été ouvert. Ces chiffres ne remplacent pas "
                               "runs/evaluation_test.json, qui reste le résultat du projet.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "methode": {"normalisation": "z = (x - moyenne des N derniers mois) / écart-type des N derniers mois, borné à ±5",
                          "fenetres_mois": FENETRES, "reentrainement": "chaque mois, sur tout le passé",
                          "reference": "constante (fréquence passée)"},
              "resultats": resultats}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    for r in sorted(resultats, key=lambda r: r["test_2024_2026"]["log_loss"]):
        a, t = r["avant_test_2016_2023"], r["test_2024_2026"]
        print(f"{r['normalisation']:30s} {r['modele'][:34]:34s} avant {a['ecart_vs_constante']:+.3f} ± {a['erreur_type_de_l_ecart']:.3f} | "
              f"test LL {t['log_loss']:.3f} écart {t['ecart_vs_constante']:+.3f} ± {t['erreur_type_de_l_ecart']:.3f} PR-AUC {t['pr_auc']:.2f} règle {t['cumul_regle']:+.1%}")
    print(f"écrit : {SORTIE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
