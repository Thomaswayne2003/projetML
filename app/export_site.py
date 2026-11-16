"""Prépare le site « Visite et Lecture » (dossier site/) : données, figures, notebooks et PDF.

Le site est statique : il ne demande ni PHP ni API vivante. Ce script interroge l'API en mémoire (sans serveur),
écrit toutes les réponses dans site/data/donnees.js, puis copie à côté les figures, les notebooks convertis en HTML
et les deux PDF. À relancer après tout changement des résultats ou des notebooks :

    python -m app.export_site

Puis, pour regarder le site : python -m http.server 8095 --directory site  (adresse http://localhost:8095).
"""
import json
import shutil
import warnings
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

ROUTES = {
    "sante": "/sante",
    "evaluation": "/evaluation",
    "decision": "/decision",
    "serie": "/serie",
    "essais": "/essais",
    "surface": "/surface",
    "volatilite": "/volatilite",
    "signal_risque": "/signal_risque",
    "verifications": "/verifications",
    "signal": "/signal",
    "explication": "/explication",
    "historique_test": "/historique?bloc=test",
    "historique_validation": "/historique?bloc=validation",
}

NOTEBOOKS = [
    ("01_cadrage_eda_variables", "Cadrage, audit des fuites, exploration, variables, découpage"),
    ("02_pipeline_modeles_optuna", "Pipeline, trois modèles, Optuna, journal des essais"),
    ("03_calibration_seuils", "Calibration, choix du modèle, règle de décision figée"),
    ("03b_test_final", "Évaluation unique sur le test 2024-2026"),
    ("04_explicabilite_diagnostics", "Tranches, permutation, SHAP, dépendances partielles"),
    ("05_annexe_maths_logistique", "Annexe de Maths : la régression logistique à la main"),
]


def donnees_api() -> dict:
    warnings.filterwarnings("ignore")
    from fastapi.testclient import TestClient

    from app.api import app

    client = TestClient(app)
    sortie = {}
    for cle, route in ROUTES.items():
        reponse = client.get(route)
        reponse.raise_for_status()
        sortie[cle] = reponse.json()
    return sortie


def copier(source: Path, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination.stat().st_size


def main() -> None:
    donnees = donnees_api()
    donnees["notebooks"] = [{"nom": nom, "titre": titre} for nom, titre in NOTEBOOKS]
    donnees["figures"] = sorted(p.name for p in (ROOT / "figures").glob("*.png"))

    (SITE / "data").mkdir(parents=True, exist_ok=True)
    texte = json.dumps(donnees, ensure_ascii=False, separators=(",", ":"))
    (SITE / "data" / "donnees.js").write_text(
        "// Fichier écrit par python -m app.export_site : ne pas modifier à la main.\n"
        f"window.NIKKEI = {texte};\n", encoding="utf-8")
    print(f"site/data/donnees.js : {len(texte) / 1e3:.0f} ko")

    total = 0
    for png in (ROOT / "figures").glob("*.png"):
        total += copier(png, SITE / "figures" / png.name)
    print(f"site/figures : {len(donnees['figures'])} figures, {total / 1e6:.1f} Mo")

    total = 0
    for nom, _ in NOTEBOOKS:
        source = ROOT / "web" / "nb" / f"{nom}.html"
        if not source.exists():
            raise SystemExit(f"{source} manque : lancer d'abord python -m app.build_site")
        total += copier(source, SITE / "nb" / f"{nom}.html")
    print(f"site/nb : {len(NOTEBOOKS)} notebooks, {total / 1e6:.1f} Mo")

    for pdf in ("rapport.pdf", "annexe_maths.pdf"):
        copier(ROOT / "report" / pdf, SITE / "docs" / pdf)
    print("site/docs : rapport.pdf, annexe_maths.pdf")

    vendeur = SITE / "vendor" / "three.module.min.js"
    if not vendeur.exists():
        copier(ROOT / "web" / "assets" / "three.module.min.js", vendeur)


if __name__ == "__main__":
    main()
