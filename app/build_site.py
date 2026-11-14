"""Convertit les notebooks en pages HTML pour le site (web/nb/).

À relancer après toute modification d'un notebook : python -m app.build_site
"""
from pathlib import Path

import nbformat
from nbconvert import HTMLExporter

ROOT = Path(__file__).resolve().parents[1]
SORTIE = ROOT / "web" / "nb"

NOTEBOOKS = [
    ("01_cadrage_eda_variables", "Cadrage, audit des fuites, EDA, variables, split"),
    ("02_pipeline_modeles_optuna", "Pipeline, trois modèles, Optuna, journal des essais"),
    ("03_calibration_seuils", "Calibration, choix du modèle, règle de décision"),
    ("03b_test_final", "Évaluation unique sur le test 2024-2026"),
    ("04_explicabilite_diagnostics", "Slices, permutation, SHAP, PDP"),
    ("05_annexe_maths_logistique", "Annexe de Maths : la logistique à la main"),
]


def main() -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    exporteur = HTMLExporter(template_name="lab")
    exporteur.embed_images = True
    for nom, _ in NOTEBOOKS:
        nb = nbformat.read(ROOT / "notebooks" / f"{nom}.ipynb", as_version=4)
        html, _ = exporteur.from_notebook_node(nb, resources={"metadata": {"name": nom}})
        (SORTIE / f"{nom}.html").write_text(html, encoding="utf-8")
        print(f"{nom}.html : {len(html) / 1e6:.1f} Mo")


if __name__ == "__main__":
    main()
