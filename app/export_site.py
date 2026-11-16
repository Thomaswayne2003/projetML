"""Prépare le site « Visite et Lecture » (dossier site/) : données, figures, notebooks et PDF.

Le site est statique : il ne demande ni PHP ni API vivante. Ce script interroge l'API en mémoire (sans serveur),
écrit toutes les réponses dans site/data/donnees.js, puis copie à côté les figures, les notebooks convertis en HTML
et les deux PDF. À relancer après tout changement des résultats ou des notebooks :

    python -m app.export_site

Puis, pour regarder le site : python -m http.server 8095 --directory site  (adresse http://localhost:8095).
"""
import json
import re
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


LIBELLES = {
    "news_attention_6m": "volume anormal d'articles", "news_sent_w": "tonalité des news", "news_dispo": "news disponibles",
    "n225_mom_12m": "momentum 12 mois", "n225_mom_3m": "momentum 3 mois", "n225_vol_ewma": "volatilité lissée",
    "d_jgb10y_bp": "variation du taux à 10 ans", "tankan_large_manuf": "Tankan", "carry_1m": "portage à un mois",
    "eurjpy_rvol_1m": "volatilité de l'euro-yen", "kmeans0": "distance au régime 1", "kmeans1": "distance au régime 2",
}


def modele_final() -> dict:
    """Coefficients de la logistique figée (parcours Maths : le prior gaussien et les poids appris)."""
    import joblib

    pipe = joblib.load(ROOT / "runs" / "models" / "nikkei_logit.joblib")
    reg = pipe.named_steps["model"]
    noms = [n.split("__")[-1] for n in pipe[:-1].get_feature_names_out()]
    return {"variables": noms, "libelles": [LIBELLES.get(n, n) for n in noms],
            "coefficients": [round(float(c), 5) for c in reg.coef_[0]], "intercept": round(float(reg.intercept_[0]), 5),
            "C": round(float(reg.C), 6), "solveur": reg.solver}


# ---------- paquets : un script classique par page, pour ouvrir le site d'un double-clic ----------
# Les navigateurs refusent les modules JavaScript ouverts depuis le disque (file://). On assemble donc, pour
# chaque page, Three.js et nos modules en un seul script classique : chaque module devient une fonction qui
# renvoie ses exports, et chaque import devient une lecture de ces exports.
PAQUETS = {
    "visite": ["contenu", "commun", "oeuvres", "visite"],
    "lecture": ["contenu", "commun", "lecture"],
    "cabinet": ["contenu", "commun", "cabinet"],
}


def _three() -> str:
    code = (SITE / "vendor" / "three.module.min.js").read_text(encoding="utf-8")
    export = re.search(r"export\s*\{([^}]*)\}\s*;?\s*$", code)
    paires = [p.strip().split(" as ") for p in export.group(1).split(",") if p.strip()]
    retour = ",".join(f"{(p[1] if len(p) == 2 else p[0]).strip()}:{p[0].strip()}" for p in paires)
    return f"const __three = (() => {{\n\"use strict\";\n{code[:export.start()]}\nreturn {{{retour}}};\n}})();\n"


def _module(nom: str) -> str:
    code = (SITE / "assets" / f"{nom}.js").read_text(encoding="utf-8")
    exports = []

    def importer(m: re.Match) -> str:
        quoi, source = m.group(1).strip(), Path(m.group(2)).stem
        if source.startswith("three"):
            return f"const {quoi.split(' as ')[1].strip()} = __three;"
        return f"const {quoi} = __{source};"

    code = re.sub(r'^import\s+(.+?)\s+from\s+"([^"]+)";\s*$', importer, code, flags=re.M)

    def exporter(m: re.Match) -> str:
        exports.append(m.group(2))
        return f"{m.group(1)} {m.group(2)}"

    code = re.sub(r"^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)", exporter, code, flags=re.M)
    if re.search(r"^\s*(import|export)\b", code, flags=re.M):
        raise SystemExit(f"assets/{nom}.js : import ou export non pris en charge par l'assemblage")
    return f"const __{nom} = (() => {{\n\"use strict\";\n{code}\nreturn {{ {', '.join(exports)} }};\n}})();\n"


def paquets() -> None:
    for page, modules in PAQUETS.items():
        morceaux = ["// Fichier écrit par python -m app.export_site à partir de assets/*.js : ne pas modifier à la main.\n"]
        if any(m in ("oeuvres", "visite") for m in modules):
            morceaux.append(_three())
        morceaux += [_module(m) for m in modules]
        sortie = SITE / "assets" / f"{page}.bundle.js"
        sortie.write_text("".join(morceaux), encoding="utf-8")
        print(f"site/assets/{page}.bundle.js : {sortie.stat().st_size / 1e3:.0f} ko")


def copier(source: Path, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination.stat().st_size


def main() -> None:
    donnees = donnees_api()
    donnees["notebooks"] = [{"nom": nom, "titre": titre} for nom, titre in NOTEBOOKS]
    donnees["figures"] = sorted(p.name for p in (ROOT / "figures").glob("*.png"))
    donnees["modele"] = modele_final()

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
    paquets()


if __name__ == "__main__":
    main()
