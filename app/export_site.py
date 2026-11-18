"""Prépare le site « Visite et Lecture » (dossier site/) : données, figures, notebooks et PDF.

Le site est statique : il ne demande ni PHP ni API vivante. Ce script interroge l'API en mémoire (sans serveur),
écrit toutes les réponses dans site/data/donnees.js, puis copie à côté les figures, les notebooks (en HTML pour les lire,
en .ipynb et en .zip pour les télécharger) et les deux PDF. À relancer après tout changement des résultats ou des notebooks :

    python -m app.export_site

Puis, pour regarder le site : python -m http.server 8095 --directory site  (adresse http://localhost:8095).
"""
import json
import re
import shutil
import subprocess
import warnings
import zipfile
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
    ("00a_collecte_V1", "Collecte, première version : prix, taux, change, news"),
    ("00b_collecte_V2", "Collecte, seconde version : 1999-2026, nouvelles sources"),
    ("01_cadrage_eda_variables", "Cadrage, audit des fuites, exploration, variables, découpage"),
    ("02_pipeline_modeles_optuna", "Pipeline, trois modèles, Optuna, journal des essais"),
    ("03_calibration_seuils", "Calibration, choix du modèle, règle de décision figée"),
    ("03b_test_final", "Évaluation unique sur le test 2024-2026"),
    ("04_explicabilite_diagnostics", "Tranches, permutation, SHAP, dépendances partielles"),
    ("05_annexe_maths_logistique", "Annexe de Maths : la régression logistique à la main"),
    ("06_annexe_news_prix", "Annexe : signal news × signal prix, temps de réalisation, backtests, HMM"),
    ("07_seconde_version_bloomberg", "Seconde version : 1999-2026, Bloomberg, résultats et explicabilité"),
    ("08_ameliorations_sans_surapprentissage", "Améliorations sans surapprentissage : protocole figé, jugé sur 2010-2023"),
]
# Un notebook rangé dans son propre dossier (avec ses scripts et ses figures) se télécharge avec tout son dossier.
DOSSIERS_NB = {"06_annexe_news_prix": "notebooks/06_annexe_news_prix"}
ARCHIVE_NOTEBOOKS = "notebooks_nikkei_225.zip"   # le dossier notebooks/ au complet
ARCHIVE_PROJET = "projet_nikkei_225.zip"         # tout ce qu'il faut pour refaire tourner le projet
# hors de l'archive du projet : le site lui-même, l'ancien site, les données brutes (lourdes, ou sous licence comme Bloomberg)
HORS_PROJET = ("site/", "site_statique/", "web/", "data/1_brutes/", "data/archives/", ".claude/", "lancer.php", "Ouvrir le site.html",
               "Lancer le projet.command")
DATE_FIXE = (2026, 1, 1, 0, 0, 0)               # archives identiques d'un export à l'autre si rien n'a changé
WIDGET = "application/vnd.jupyter.widget-view+json"
NOTE_WIDGET = ('<div style="padding:12px 14px;border:1px solid #d9d2c5;border-radius:4px;background:#f7f3ec;color:#1f1d1a;'
               'font:14px/1.5 system-ui,sans-serif"><b>Tableau de bord interactif (ipywidgets).</b> Ses curseurs ont besoin de Python : '
               'ils ne fonctionnent pas dans cette page. Téléchargez le dossier du notebook depuis le site, puis ouvrez-le dans Jupyter.</div>')

LISEZMOI_PROJET = """# Projet Nikkei 225 : version finale

Cette archive contient tout le projet, sauf le site de présentation et les données brutes :
- `notebooks/` : tous les notebooks, exécutés (le 06 avec ses scripts, ses figures et son README) ;
- `src/`, `app/`, `tests/` : le code, l'API et les tests ;
- `data/2_construites/`, `data/3_modele/` : les tables mensuelles et les tables de modélisation ;
- `runs/` : journaux des essais, modèles, décisions figées, évaluations et résultats des trois étapes ;
- `figures/`, `report/` : les figures et le rapport.

Les données brutes (`data/1_brutes/`) ne sont pas incluses : elles se retéléchargent avec les notebooks 00a et 00b, et les
exports Bloomberg ne peuvent pas être redistribués. Les notebooks se lisent tels quels, sorties comprises ; pour les
réexécuter, voir le README.md (installation, puis python -m pytest -q).
"""


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
    # l'explication de chaque décision du test, mois par mois (première version : contributions de la logistique)
    sortie["explications_test"] = {}
    for mois in [m["date"] for m in sortie["historique_test"]] + [sortie["signal"]["mois_des_donnees"]]:
        reponse = client.get(f"/explication?mois={mois}")
        if reponse.status_code == 200:
            sortie["explications_test"][mois] = reponse.json()
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


def versionner() -> None:
    """Chaque page appelle ses scripts et ses styles avec une empreinte de leur contenu (?v=…) : en ligne, un navigateur
    qui garde une ancienne copie en cache recharge le fichier dès qu'il change, sans jamais mélanger deux versions."""
    import hashlib

    def empreinte(m: re.Match) -> str:
        chemin = m.group(2)
        cible = SITE / chemin
        if not cible.exists():
            return m.group(0)
        return f'{m.group(1)}="{chemin}?v={hashlib.sha256(cible.read_bytes()).hexdigest()[:10]}"'
    for page in ("index.html", "lecture.html", "cabinet.html"):
        p = SITE / page
        html = p.read_text(encoding="utf-8")
        html = re.sub(r'(src|href)="((?:assets|data)/[^"?]+\.(?:js|css))(?:\?v=[0-9a-f]+)?"', empreinte, html)
        p.write_text(html, encoding="utf-8")


def maths_cours() -> dict:
    """Parcours Maths : la log-loss d'entraînement du modèle figé, et l'option L2 de l'annexe (notebook 05, section 7) :
    les équations normales résolues à la main pour prédire le rendement du mois suivant, et le R² qu'elles donnent."""
    import joblib
    import numpy as np
    import pandas as pd
    import yaml
    from sklearn.linear_model import LinearRegression

    cfg = yaml.safe_load(open(ROOT / "config.yaml"))
    table = pd.read_csv(ROOT / cfg["data"]["model_table"], parse_dates=["date"]).set_index("date")
    features = [c for g in ["news", "price", "macro", "fx"] for c in cfg["features"][g]]
    colonnes = features + [c for c in cfg["features"]["regime"] if c not in features]
    train, valid = table[table["bloc"] == "entraînement"], table[table["bloc"] == "validation"]
    pipe = joblib.load(ROOT / "runs" / "models" / "nikkei_logit.joblib")
    prep = pipe[:-1]
    X, Xv = prep.transform(train[colonnes]), prep.transform(valid[colonnes])
    y = train["y_baisse"].astype(int).to_numpy()
    p = np.clip(pipe.predict_proba(train[colonnes])[:, 1], 1e-12, 1 - 1e-12)
    w = pipe.named_steps["model"].coef_[0]
    lam = 1 / (2 * len(y) * pipe.named_steps["model"].C)
    ll = float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
    Xt, Xvt = np.c_[X, np.ones(len(X))], np.c_[Xv, np.ones(len(Xv))]
    r, rv = train["target_rn_next"].to_numpy(), valid["target_rn_next"].to_numpy()
    beta = np.linalg.solve(Xt.T @ Xt, Xt.T @ r)
    ols = LinearRegression().fit(X, r)
    r2 = lambda vrai, prevu: float(1 - ((vrai - prevu) ** 2).sum() / ((vrai - vrai.mean()) ** 2).sum())
    pv = Xvt @ beta
    u = X @ w + pipe.named_steps["model"].intercept_[0]          # score wᵀx + b de chaque mois d'entraînement
    return {"logloss_entrainement": ll, "cout_penalise_entrainement": ll + lam * float(w @ w), "lambda": lam, "mois_entrainement": int(len(y)),
            "scores_entrainement": [[d.strftime("%Y-%m"), round(float(a), 4), int(b)] for d, a, b in zip(train.index, u, y)],
            "ols": {"r2_entrainement": r2(r, Xt @ beta), "r2_validation": r2(rv, pv),
                    "ecart_scikit_learn": float(np.abs(beta - np.r_[ols.coef_, ols.intercept_]).max()),
                    "variables": int(X.shape[1]), "mois_validation": int(len(rv)),
                    "entrainement": [[d.strftime("%Y-%m"), round(float(a), 5), round(float(b), 5)] for d, a, b in zip(train.index, Xt @ beta, r)],
                    "validation": [[d.strftime("%Y-%m"), round(float(a), 5), round(float(b), 5)] for d, a, b in zip(valid.index, pv, rv)]}}


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


# ---------- seconde version (Bloomberg, 1999-2026) et description du dataset ----------
def version_2() -> dict:
    """Résultats de src.v2_bloomberg et table 1999-2026, s'ils existent."""
    import pandas as pd

    dossier = ROOT / "runs" / "v2_bloomberg"
    sortie = {}
    for nom in ["evaluation_test", "decision_finale", "controle_bloomberg", "shap_test"]:
        f = dossier / f"{nom}.json"
        if f.exists():
            sortie[nom] = json.loads(f.read_text())
    table = ROOT / "data" / "3_modele" / "dataset_model2.csv"
    if table.exists():
        t = pd.read_csv(table, parse_dates=["date"])
        sortie["serie"] = [{"mois": d.strftime("%Y-%m"), "cloture": round(float(c), 1), "bloc": b}
                           for d, c, b in zip(t["date"], t["n225_close"], t["bloc"])]
    journal = dossier / "trials_log.csv"
    if journal.exists():
        j = pd.read_csv(journal)
        j = j[j["cible"] == "nikkei"]
        sortie["essais"] = [{"modele": m, "essai": int(e), "logloss": float(l), "retenu": bool(r)}
                            for m, e, l, r in zip(j["modele"], j["essai"], j["cv_logloss"], j["retenu"])]
    return sortie


def version_3() -> dict:
    """Résultats de src.ameliorations (protocole figé avant le calcul), s'ils existent."""
    dossier = ROOT / "runs" / "v3_ameliorations"
    if not (dossier / "resultats.json").exists():
        return {}
    r = json.loads((dossier / "resultats.json").read_text())
    fige = json.loads((dossier / "protocole.json").read_text())
    garder = ["protocole", "premiere_prevision", "mois_par_periode", "tests_probabilites", "tests_euros", "retenus",
              "assemblage_final", "mois_prochain"]
    sortie = {k: r[k] for k in garder}
    sortie["probabilites"] = {per: {v: {k: b[k] for k in ["log_loss", "ecart_vs_constante", "erreur_type", "auc"]} for v, b in d.items()}
                              for per, d in r["probabilites"].items()}
    sortie["euros"] = {per: {s: {k: b[k] for k in ["sharpe", "cumul", "volatilite", "perte_maximale"]} for s, b in d.items()}
                       for per, d in r["euros"].items()}
    import pandas as pd

    p = pd.read_csv(dossier / "probabilites.csv", parse_dates=["date"]).set_index("date").loc["2010":"2023"]
    sortie["actions_2010_2023"] = {c.split(" · ", 1)[1]: {k: int(v) for k, v in p[c].value_counts().items()}
                                   for c in p.columns if c.startswith("action · ")}
    sortie["descriptions"] = fige["protocole"]["probabilites"] | {k: v for k, v in fige["protocole"]["leviers_euros"].items()
                                                                  if not k.startswith("règle")}
    return sortie


def dataset() -> dict:
    """Ce que contient la table 1999-2026 : taille, sources, décalages de publication."""
    import pandas as pd

    dico = ROOT / "data" / "2_construites" / "dictionnaire_variables2.csv"
    mensuel = ROOT / "data" / "2_construites" / "dataset_monthly2.csv"
    if not (dico.exists() and mensuel.exists()):
        return {}
    d = pd.read_csv(dico)
    m = d[d["fichier"] == "dataset_monthly2.csv"]
    def famille(source: str, colonne: str) -> str:
        if colonne.startswith(("news_", "gdelt_")):
            return "News (GDELT, FinBERT)"
        if colonne.startswith("cpi_"):
            return "Inflation (OCDE, e-Stat)"
        if colonne.startswith("ff_"):
            return "Facteurs Fama-French"
        if colonne == "nikkei_vi":
            return "Volatilité implicite (Nikkei VI)"
        for cle, nom in [("Yahoo", "Yahoo Finance"), ("MoF", "Ministère des Finances"), ("BoJ", "Banque du Japon"), ("OCDE", "OCDE"),
                         ("BCE", "BCE et Bundesbank"), ("Bundesbank", "BCE et Bundesbank"), ("policy", "Incertitude et géopolitique"),
                         ("Caldara", "Incertitude et géopolitique")]:
            if cle in source:
                return nom
        return "Calendrier et dérivées"
    tab = pd.read_csv(mensuel, usecols=["date"], parse_dates=["date"])
    return {"colonnes": int(len(m)), "mois": int(len(tab)), "premier_mois": tab["date"].min().strftime("%Y-%m"),
            "dernier_mois": tab["date"].max().strftime("%Y-%m"),
            "variables_journalieres": int((d["fichier"] == "dataset_daily2.csv").sum()),
            "sources": pd.Series([famille(src, col) for src, col in zip(m["source"].fillna(""), m["colonne"])]).value_counts().to_dict(),
            "decalages": m["decalage"].fillna("").value_counts().to_dict()}


def images_integrees() -> None:
    """Les estampes de la rotonde, en data URI : la 3D les lit même quand le site est ouvert depuis le disque."""
    import base64

    images = {f.stem: "data:image/jpeg;base64," + base64.b64encode(f.read_bytes()).decode()
              for f in sorted((SITE / "images").glob("*.jpg"))}
    (SITE / "data" / "images.js").write_text("// Fichier écrit par python -m app.export_site : ne pas modifier à la main.\n"
                                             f"window.NIKKEI_IMAGES = {json.dumps(images)};\n", encoding="utf-8")
    print(f"site/data/images.js : {len(images)} images")


def ipynb(nom: str) -> Path:
    dossier = DOSSIERS_NB.get(nom)
    return ROOT / (dossier or "notebooks") / f"{nom}.ipynb"


def fichiers_du_depot(prefixe: str = "") -> list[str]:
    """Fichiers suivis par Git, ou nouveaux et non ignorés (le .gitignore écarte caches et données lourdes)."""
    sortie = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", prefixe or "."],
                            cwd=ROOT, capture_output=True, check=True)
    noms = {n for n in sortie.stdout.decode().split("\0") if n}
    return sorted(n for n in noms if (ROOT / n).is_file() and not n.endswith(".DS_Store"))


def ecrire_zip(cible: Path, fichiers: list[tuple[str, Path | str]]) -> int:
    """Archive déterministe : (nom dans l'archive, fichier ou texte), dates fixées, ordre trié."""
    cible.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(cible, "w", zipfile.ZIP_DEFLATED) as z:
        for nom, contenu in sorted(fichiers, key=lambda f: f[0]):
            info = zipfile.ZipInfo(nom, date_time=DATE_FIXE)
            info.compress_type, info.external_attr = zipfile.ZIP_DEFLATED, 0o644 << 16
            z.writestr(info, contenu.read_bytes() if isinstance(contenu, Path) else contenu.encode("utf-8"))
    return len(fichiers)


# avertissements de bibliothèques sans rapport avec les résultats (tqdm, torch, barres de chargement)
BRUIT = re.compile(r"TqdmWarning|IProgress not found|autonotebook import tqdm|Redirects are currently not supported|it/s\]|^\s*$")


def pour_affichage(nb) -> None:
    """Version HTML seulement (le .ipynb reste intact) : un tableau de bord ipywidgets, qui ne tourne pas dans une page
    statique, est remplacé par une note ; les avertissements techniques des bibliothèques sont retirés."""
    import nbformat

    for cellule in nb.cells:
        if "outputs" not in cellule:
            continue
        sorties, note = [], False
        for o in cellule.outputs:
            if o.get("output_type") == "stream" and o.get("name") == "stderr" and all(BRUIT.search(l) for l in o.get("text", "").splitlines() or [""]):
                continue
            if WIDGET in o.get("data", {}):
                if not note:
                    sorties.append(nbformat.v4.new_output("display_data", data={"text/html": NOTE_WIDGET,
                                                                                "text/plain": "Tableau de bord interactif (Jupyter)"}))
                    note = True
                continue
            sorties.append(o)
        cellule.outputs = sorties
    nb.metadata.pop("widgets", None)


def notebook_html(nom: str) -> Path:
    """La page HTML d'un notebook : celle de web/nb, ou une conversion faite ici si elle manque."""
    source = ROOT / "web" / "nb" / f"{nom}.html"
    if source.exists():
        return source
    import nbformat
    from nbconvert import HTMLExporter

    exporteur = HTMLExporter(template_name="lab")
    exporteur.embed_images = True
    nb = nbformat.read(ipynb(nom), as_version=4)
    pour_affichage(nb)
    titre = dict(NOTEBOOKS)[nom]
    html, _ = exporteur.from_notebook_node(nb, resources={"metadata": {"name": f"Notebook {nom.split('_')[0]} · {titre}"}})
    cible = SITE / "nb" / f"{nom}.html"
    cible.parent.mkdir(parents=True, exist_ok=True)
    cible.write_text(html, encoding="utf-8")
    return cible


def alleger(page: Path) -> None:
    """Les pages de notebooks ne doivent pas attendre un CDN pour s'afficher : require.js (inutile ici, aucun widget ni
    sortie JavaScript) est retiré, et MathJax (les formules) se charge en différé, après le texte."""
    html = page.read_text(encoding="utf-8")
    html = re.sub(r'<script[^>]*src="[^"]*require(?:\.min)?\.js"[^>]*>\s*</script>\s*', "", html)
    html = re.sub(r'<script(?![^>]*\bdefer\b)([^>]*src="[^"]*mathjax[^"]*")', r'<script defer\1', html)
    page.write_text(html, encoding="utf-8")


def copier(source: Path, destination: Path) -> int:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination.stat().st_size


def telechargements() -> dict:
    """Les .ipynb, le dossier du 06, et les deux archives : écrits dans site/nb, décrits pour le site."""
    nb = SITE / "nb"
    sortie = {"notebooks": {}, "archives": []}
    for nom, _ in NOTEBOOKS:
        if nom in DOSSIERS_NB:
            dossier = DOSSIERS_NB[nom]
            n = ecrire_zip(nb / f"{nom}.zip", [(f[len("notebooks/"):], ROOT / f) for f in fichiers_du_depot(dossier + "/")])
            (nb / f"{nom}.ipynb").unlink(missing_ok=True)
            sortie["notebooks"][nom] = {"href": f"nb/{nom}.zip", "fichier": f"{nom}.zip", "dossier": True, "fichiers": n}
        else:
            copier(ipynb(nom), nb / f"{nom}.ipynb")
            sortie["notebooks"][nom] = {"href": f"nb/{nom}.ipynb", "fichier": f"{nom}.ipynb", "dossier": False, "fichiers": 1}
    tous = fichiers_du_depot("notebooks/")
    projet = [f for f in fichiers_du_depot() if not f.startswith(HORS_PROJET)]
    for cle, nom, titre, fichiers in [
            ("notebooks", ARCHIVE_NOTEBOOKS, "Tous les notebooks", [(f, ROOT / f) for f in tous]),
            ("projet", ARCHIVE_PROJET, "Le projet complet", [(f"projet_nikkei_225/{f}", ROOT / f) for f in projet]
             + [("projet_nikkei_225/LISEZMOI.md", LISEZMOI_PROJET)])]:
        n = ecrire_zip(nb / nom, fichiers)
        sortie["archives"].append({"cle": cle, "href": f"nb/{nom}", "fichier": nom, "titre": titre, "fichiers": n,
                                   "octets": (nb / nom).stat().st_size})
    return sortie


def main() -> None:
    donnees = donnees_api()
    donnees["notebooks"] = [{"nom": nom, "titre": titre} for nom, titre in NOTEBOOKS]
    donnees["figures"] = sorted(p.name for p in (ROOT / "figures").glob("*.png"))
    donnees["modele"] = modele_final()
    donnees["v2"] = version_2()
    donnees["v3"] = version_3()
    donnees["maths"] = maths_cours()
    donnees["telechargements"] = telechargements()
    donnees["dataset"] = dataset()

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
        source = notebook_html(nom)
        cible = SITE / "nb" / f"{nom}.html"
        if source != cible:
            copier(source, cible)
        alleger(cible)
        total += cible.stat().st_size
    print(f"site/nb : {len(NOTEBOOKS)} notebooks en HTML ({total / 1e6:.1f} Mo), à télécharger en .ipynb ou en dossier ; "
          + " ; ".join(f"{a['fichier']} {a['fichiers']} fichiers, {a['octets'] / 1e6:.1f} Mo" for a in donnees["telechargements"]["archives"]))

    for pdf in ("rapport.pdf", "annexe_maths.pdf"):
        copier(ROOT / "report" / pdf, SITE / "docs" / pdf)
    print("site/docs : rapport.pdf, annexe_maths.pdf")

    vendeur = SITE / "vendor" / "three.module.min.js"
    if not vendeur.exists():
        copier(ROOT / "web" / "assets" / "three.module.min.js", vendeur)
    images_integrees()
    paquets()
    versionner()


if __name__ == "__main__":
    main()
