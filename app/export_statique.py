"""Fabrique une copie statique du site, publiable sans serveur (Python et PHP doivent tourner pendant l'export).

Les pages sont rendues par le serveur PHP, les réponses de l'API sont enregistrées en fichiers JSON, et un petit script
injecté en tête de chaque page renvoie les appels « api.php?... » vers ces fichiers. Seules les simulations « et si »
du prédicteur (réglages libres) ont besoin de l'API vivante : dans la copie, elles affichent un message.

Usage : python -m app.export_statique [--site http://localhost:8080] [--sortie site_statique]
"""
import argparse
import json
import re
import shutil
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
NOTEBOOKS = ["01_cadrage_eda_variables", "02_pipeline_modeles_optuna", "03_calibration_seuils", "03b_test_final",
             "04_explicabilite_diagnostics", "05_annexe_maths_logistique"]
SIMPLES = ["sante", "mois", "evaluation", "decision", "serie", "essais", "surface", "volatilite", "verifications", "signal_risque",
           "signal", "explication", "variables", "prediction"]
PAR_MOIS = ["signal", "explication", "variables", "prediction"]

# Redirige les appels à l'API vers les fichiers JSON de la copie
AIGUILLAGE = """<script>
(() => {
  const nomFichier = (u) => {
    const p = new URLSearchParams(u.split("?")[1] || ""), route = p.get("route"); p.delete("route");
    const cles = [...p.keys()].sort();
    if (cles.some((k) => !["mois", "bloc"].includes(k))) return null;              // simulation libre : pas de fichier
    return route + cles.map((k) => "__" + k + "-" + p.get(k)).join("");
  };
  const fetchOriginal = window.fetch.bind(window);
  let paquet = null;                                  // toutes les réponses de l'API, dans un seul fichier chargé une fois
  const donnees = () => (paquet ??= fetchOriginal("donnees.json").then((r) => r.json()));
  const reponse = (corps, statut) => new Response(JSON.stringify(corps), { status: statut, headers: { "Content-Type": "application/json" } });
  window.fetch = (entree, options) => {
    const u = typeof entree === "string" ? entree : entree.url;
    if (u && u.includes("api.php?")) {
      const f = nomFichier(u);
      if (!f) return Promise.resolve(reponse({ detail: "Simulation disponible seulement dans la version locale du site" }, 503));
      return donnees().then((d) => (f in d ? reponse(d[f], 200) : reponse({ detail: "donnée absente de la copie" }, 404)));
    }
    return fetchOriginal(entree, options);
  };
  for (const nom of ["replaceState", "pushState"]) {
    const original = history[nom].bind(history);
    history[nom] = (...a) => { try { original(...a); } catch (e) {} };
  }
})();
</script>
"""


def lire(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def nom_json(route: str, params: dict) -> str:
    return route + "".join(f"__{k}-{params[k]}" for k in sorted(params)) + ".json"


def relier(html: str) -> str:
    """Rend les liens absolus du site relatifs à la copie."""
    html = re.sub(r'href="/notebooks\?nb=([a-z0-9_]+)"', r'href="notebooks-\1.html"', html)
    html = html.replace('href="/notebooks"', 'href="notebooks.html"')
    html = re.sub(r'href="/recit([?#][^"]*)?"', lambda m: f'href="recit.html{m.group(1) or ""}"', html)
    html = html.replace('href="/"', 'href="accueil.html"')
    html = re.sub(r'(href|src)="/(assets|figures|nb)/', r'\1="\2/', html)
    html = re.sub(r'href="/(rapport|rapport_maths)\.pdf"', r'href="\1.pdf"', html)
    html = re.sub(r'<a href="/ipynb/[^"]*"[^>]*>[^<]*</a>', "", html)                # pas de .ipynb dans la copie
    html = re.sub(r'href="http://127\.0\.0\.1:\d+/docs"', 'href="recit.html#ressources"', html)
    return html


def sans_enveloppe(html: str) -> str:
    """Page principale d'un Artifact : sans doctype, html, head ni body (la plateforme les ajoute)."""
    html = re.sub(r"<!doctype[^>]*>", "", html, flags=re.I)
    html = re.sub(r"</?(html|head)[^>]*>", "", html, flags=re.I)
    html = re.sub(r'<meta (charset|name="viewport")[^>]*>', "", html, flags=re.I)
    corps = re.search(r"<body([^>]*)>", html, flags=re.I)
    if corps and corps.group(1).strip():
        attributs = corps.group(1)
        html = html.replace(corps.group(0), "") + f"<script>(() => {{ const t = document.createElement('template'); t.innerHTML = '<i{attributs}></i>'; for (const a of t.content.firstChild.attributes) document.body.setAttribute(a.name, a.value); }})();</script>"
    else:
        html = re.sub(r"<body[^>]*>", "", html, flags=re.I)
    return re.sub(r"</body>", "", html, flags=re.I)


def avec_aiguillage(html: str) -> str:
    return re.sub(r"(<head[^>]*>)", r"\1" + AIGUILLAGE.replace("\\", "\\\\"), html, count=1, flags=re.I) if re.search(r"<head", html, re.I) else AIGUILLAGE + html


def main(site: str, sortie: Path) -> None:
    if sortie.exists():
        shutil.rmtree(sortie)
    sortie.mkdir(parents=True)
    paquet = {}

    # 1. Les réponses de l'API
    mois = [m["mois"] for m in json.loads(lire(f"{site}/api.php?route=mois"))]
    demandes = [(r, {}) for r in SIMPLES] + [("historique", {"bloc": b}) for b in ["test", "validation"]]
    demandes += [(r, {"mois": m}) for r in PAR_MOIS for m in mois]
    for route, params in demandes:
        corps = lire(f"{site}/api.php?" + urllib.parse.urlencode({"route": route, **params}))
        paquet[nom_json(route, params)[:-5]] = json.loads(corps)
    (sortie / "donnees.json").write_text(json.dumps(paquet, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # 2. Les pages
    pages = {"accueil.html": "/", "recit.html": "/recit", "notebooks.html": "/notebooks"}
    pages |= {f"notebooks-{nb}.html": f"/notebooks?nb={nb}" for nb in NOTEBOOKS}
    for fichier, chemin in pages.items():
        html = avec_aiguillage(relier(lire(site + chemin).decode("utf-8")))
        (sortie / fichier).write_text(html, encoding="utf-8")
    accueil = (sortie / "accueil.html").read_text(encoding="utf-8")
    (sortie / "index.html").write_text(sans_enveloppe(accueil), encoding="utf-8")

    # 3. Les fichiers fixes
    shutil.copytree(WEB / "assets", sortie / "assets")
    shutil.copytree(WEB / "nb", sortie / "nb")
    shutil.copytree(ROOT / "figures", sortie / "figures")
    for pdf in ["rapport.pdf", "rapport_maths.pdf"]:
        shutil.copy(ROOT / "report" / pdf, sortie / pdf)

    n = sum(1 for _ in sortie.rglob("*") if _.is_file())
    taille = sum(f.stat().st_size for f in sortie.rglob("*") if f.is_file()) / 1e6
    print(f"{sortie} : {n} fichiers, {taille:.1f} Mo ({len(demandes)} réponses de l'API)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", default="http://localhost:8080")
    parser.add_argument("--sortie", default=str(ROOT / "site_statique"))
    args = parser.parse_args()
    main(args.site.rstrip("/"), Path(args.sortie))
