// English version of site/assets/cabinet.js: the notebook list and the reader, on a page of their own.
import { installerMenu, installerEntete, FLECHE, BAS, lienIpynb, lienArchive, telechargement, ouvrirDansCadre } from "./commun.js";
import { COURS, RACINE, titreNb } from "./contenu.js";

// the Maths path puts the appendix first
const nbs = COURS === "maths"
  ? [...window.NIKKEI.notebooks].sort((a, b) => (b.nom.startsWith("05") ? 1 : 0) - (a.nom.startsWith("05") ? 1 : 0))
  : window.NIKKEI.notebooks;
const liste = document.getElementById("liste"), choix = document.getElementById("choix"), cadre = document.getElementById("cadre"), charge = document.getElementById("charge");
liste.innerHTML = nbs.map((n) => `<li><a href="?nb=${n.nom}&cours=${COURS}" data-nb="${n.nom}"><span class="n">${n.nom.split("_")[0]}</span><span class="t">${titreNb(n.nom)}</span></a>${lienIpynb(n.nom, "telecharger mini")}</li>`).join("");
choix.innerHTML = nbs.map((n) => `<option value="${n.nom}">${n.nom.split("_")[0]} · ${titreNb(n.nom)}</option>`).join("");
document.getElementById("archive").innerHTML = lienArchive("notebooks") + lienArchive("projet");
const courant = document.getElementById("courant");
document.getElementById("docs").innerHTML = `<a href="${RACINE}docs/rapport.pdf"><span class="t">The report, PDF (French)</span>${FLECHE}</a><a href="${RACINE}docs/annexe_maths.pdf"><span class="t">The maths appendix, PDF (French)</span>${FLECHE}</a>`;

function ouvrir(nom, pousser) {
  if (!nbs.some((n) => n.nom === nom)) nom = nbs[0].nom;
  charge.style.opacity = 1;
  ouvrirDansCadre(cadre, `${RACINE}nb/${nom}.html`, () => { charge.style.opacity = 0; });
  choix.value = nom;
  const t = telechargement(nom);
  courant.href = t.href; courant.download = t.fichier;
  courant.innerHTML = t.dossier ? `Download notebook ${nom.split("_")[0]} and its folder (.zip) ${BAS}` : `Download notebook ${nom.split("_")[0]} (.ipynb) ${BAS}`;
  liste.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", a.dataset.nb === nom ? "page" : "false"));
  document.title = `Nikkei · Notebook ${nom.split("_")[0]}`;
  // opened straight from disk, some browsers refuse to change the address: that's fine
  if (pousser) try { history.pushState(null, "", `?nb=${nom}&cours=${COURS}`); } catch (e) { /* address unchanged */ }
}
cadre.addEventListener("load", () => { charge.style.opacity = 0; });
liste.addEventListener("click", (e) => { const a = e.target.closest("a[data-nb]"); if (!a) return; e.preventDefault(); ouvrir(a.dataset.nb, true); });
choix.addEventListener("change", () => ouvrir(choix.value, true));
addEventListener("popstate", () => ouvrir(new URLSearchParams(location.search).get("nb"), false));
ouvrir(new URLSearchParams(location.search).get("nb"), false);
installerEntete("cabinet");
installerMenu({ page: "cabinet" });
