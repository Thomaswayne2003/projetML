// English version of site/assets/commun.js: header, course choice, menu and notebook reader, shared by the tour,
// the reading and the cabinet. Files outside site/en/ (PDFs, notebooks, downloads) are reached through RACINE ("../").
import { SALLES, ENTREE, COURS, COURS_INFO, avecCours, D, nomNotebook, RACINE, titreNb, ARCHIVES_TITRES } from "./contenu.js";

export const FLECHE = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5h32M27 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
export const FLECHE_G = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M34 5H2M7 1 2 5l5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';

export function stocker(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* stockage indisponible */ } }
export function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }

const DOCS = { rapport: ["The Applied ML report (in French)", `${RACINE}docs/rapport.pdf`], annexe: ["The maths appendix (in French)", `${RACINE}docs/annexe_maths.pdf`] };
export const titreNotebook = (nom) => titreNb(nom);
export const BAS = '<svg class="bas" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0v10M1 6l4 4 4-4M0 11.5h10" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
// What can be downloaded: each notebook as .ipynb (or its folder as .zip), and two archives (site/data/donnees.js)
const TL = D.telechargements ?? { notebooks: {}, archives: [] };
export const telechargement = (nom) => { const t = TL.notebooks[nom] ?? { href: `nb/${nom}.ipynb`, fichier: `${nom}.ipynb`, dossier: false }; return { ...t, href: RACINE + t.href }; };
export const etiquetteNb = (nom) => (telechargement(nom).dossier ? "folder .zip" : ".ipynb");
export const lienIpynb = (nom, classe = "telecharger") => {
  const t = telechargement(nom);
  const aide = t.dossier ? `Download ${nomNotebook(nom)} with its whole folder (${t.fichiers} files: notebook, scripts, figures)` : `Download ${nomNotebook(nom)} (.ipynb, to open in Jupyter)`;
  return `<a class="${classe}" href="${t.href}" download="${t.fichier}" title="${aide}">${etiquetteNb(nom)} ${BAS}</a>`;
};
const mo = (o) => `${(o / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`;
export const archives = () => TL.archives;
export const lienArchive = (cle, classe = "telecharger") => {
  const a = TL.archives.find((x) => x.cle === cle);
  return a ? `<a class="${classe}" href="${RACINE}${a.href}" download="${a.fichier}" title="${a.fichiers} files, ${mo(a.octets)}">${ARCHIVES_TITRES[a.cle] ?? a.titre} (.zip, ${mo(a.octets)}) ${BAS}</a>` : "";
};

// The course choice (Applied ML or Maths) and the mode (tour or reading) carry over from page to page.
export function installerEntete(page) {
  document.body.dataset.cours = COURS;
  document.querySelectorAll("[data-cours]").forEach((a) => {
    const ici = page === "cabinet" ? `cabinet.html${location.search.includes("nb=") ? `?nb=${new URLSearchParams(location.search).get("nb")}` : ""}` : page === "lecture" ? "lecture.html" : "index.html";
    a.href = avecCours(ici, a.dataset.cours);
    a.setAttribute("aria-current", a.dataset.cours === COURS ? "page" : "false");
  });
  document.querySelectorAll("a[data-lien]").forEach((a) => (a.href = avecCours(a.dataset.lien)));
  // the FR link opens the same page of the French site, with the same course (and notebook, in the cabinet)
  document.querySelectorAll("a[data-langue]").forEach((a) => (a.href = `../${page === "cabinet" ? "cabinet.html" : page === "lecture" ? "lecture.html" : "index.html"}${location.search || `?cours=${COURS}`}${location.hash}`));
}

// page: "visite" | "lecture" | "cabinet"; allerSalle(id): called by the tour to move without reloading
export function installerMenu({ page, allerSalle = null, salleActive = () => null }) {
  const lienSalle = (s) => (page === "visite" || page === "lecture" ? `#${s.id}` : avecCours(`lecture.html#${s.id}`));
  const autre = COURS === "maths" ? "ml" : "maths";
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  menu.setAttribute("aria-label", "Menu");
  menu.innerHTML = `
    <button class="menu-fermer" type="button">Close <span class="points" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
    <div class="menu-corps">
      <nav class="menu-liste">
        <div>
          <p class="menu-titre">${COURS_INFO[COURS].nom} · ${page === "visite" ? "the rooms" : "the chapters"}</p>
          <ul class="menu-salles">
            ${SALLES.map((s) => `<li><a href="${lienSalle(s)}" data-salle="${s.id}"><span class="n">${s.num}</span><span class="t">${s.nom}</span>${FLECHE}</a></li>`).join("")}
          </ul>
        </div>
        <div class="menu-autres">
          <p class="menu-titre">Elsewhere</p>
          <a href="${avecCours(page === "cabinet" ? "index.html" : page === "lecture" ? "lecture.html" : "index.html", autre)}"><span class="t">Switch to the ${COURS_INFO[autre].nom} path</span>${FLECHE}</a>
          ${page !== "visite" ? `<a href="${avecCours("index.html")}"><span class="t">The 3D tour</span>${FLECHE}</a>` : ""}
          ${page !== "lecture" ? `<a href="${avecCours("lecture.html")}"><span class="t">The reading</span>${FLECHE}</a>` : ""}
          ${page !== "cabinet" ? `<a href="${avecCours("cabinet.html")}"><span class="t">The notebooks</span>${FLECHE}</a>` : ""}
          <a href="${RACINE}docs/rapport.pdf"><span class="t">The report, PDF (French)</span>${FLECHE}</a>
          <a href="${RACINE}docs/annexe_maths.pdf"><span class="t">The maths appendix, PDF (French)</span>${FLECHE}</a>
          <a href="${RACINE}${location.pathname.endsWith("cabinet.html") ? "cabinet.html" : location.pathname.endsWith("lecture.html") ? "lecture.html" : "index.html"}${location.search}" lang="fr" hreflang="fr"><span class="t">Version française</span>${FLECHE}</a>
        </div>
        <p class="menu-pied"><span>${ENTREE.ecole}</span></p>
      </nav>
      <div class="menu-cartes">
        ${page === "lecture"
          ? `<a class="carte-menu" href="${avecCours("index.html")}" style="--fond:${SALLES[4].ton.mur}"><span class="num">V</span><span>The 3D tour ${FLECHE}</span><small>Seven rooms, each with a work made of data.</small></a>`
          : `<a class="carte-menu" href="${avecCours("lecture.html")}" style="--fond:${SALLES[0].ton.mur}"><span class="num">¶</span><span>The reading ${FLECHE}</span><small>The same path as text, with the charts, tables and figures.</small></a>`}
        <a class="carte-menu" href="${avecCours("cabinet.html")}" style="--fond:${COURS === "maths" ? "#3b3533" : "#55443a"}"><span class="num">⌘</span><span>The cabinet ${FLECHE}</span><small>The notebooks, exactly as they were executed (in French).</small></a>
      </div>
    </div>`;
  document.body.appendChild(menu);

  const bouton = document.querySelector(".bouton-menu");
  const fermer = menu.querySelector(".menu-fermer");
  let dernierFocus = null;
  const ouvrir = () => {
    dernierFocus = document.activeElement;
    const actif = salleActive();
    menu.querySelectorAll(".menu-salles a").forEach((a) => a.setAttribute("aria-current", a.dataset.salle === actif ? "true" : "false"));
    menu.classList.add("ouvert");
    bouton?.setAttribute("aria-expanded", "true");
    setTimeout(() => fermer.focus(), 50);
  };
  const clore = () => {
    menu.classList.remove("ouvert");
    bouton?.setAttribute("aria-expanded", "false");
    dernierFocus?.focus?.();
  };
  bouton?.addEventListener("click", ouvrir);
  fermer.addEventListener("click", clore);
  menu.addEventListener("click", (e) => { if (e.target === menu) clore(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && menu.classList.contains("ouvert")) { e.stopPropagation(); clore(); } }, true);
  if (allerSalle) {
    menu.querySelectorAll(".menu-salles a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault(); clore(); allerSalle(a.dataset.salle);
    }));
  } else {
    menu.querySelectorAll(".menu-salles a").forEach((a) => a.addEventListener("click", () => clore()));
  }
  return { ouvrir, clore, estOuvert: () => menu.classList.contains("ouvert") };
}

// On entering a room: the course sessions it draws on, then the three points to present
export function arrivee(salle) {
  if (!salle.presenter?.length) return "";
  const seances = (salle.seances ?? []).map(([code, nom]) => `<li><b>${code}</b>${nom}</li>`).join("");
  return `<div class="arrivee">
    ${seances ? `<p class="sur-titre">Seen in class · ${COURS_INFO[COURS].nom}</p><ul class="seances">${seances}</ul>` : ""}
    <p class="sur-titre">To present on arrival</p>
    <ol class="a-presenter">${salle.presenter.map((p) => `<li>${p}</li>`).join("")}</ol>
  </div>`;
}

// A room's notebooks and documents, as buttons; data-nb opens the reader without leaving the page
export function liensPieces(salle) {
  const nbs = salle.notebooks.map((n) => `<li class="piece-nb"><button type="button" class="piece-lien" data-nb="${n}"><span class="sur-titre">${nomNotebook(n)}</span><span class="t">${titreNotebook(n)}</span>${FLECHE}</button>${lienIpynb(n, "piece-telecharger")}</li>`);
  const docs = salle.docs.map((d) => `<li><a class="piece-lien" href="${DOCS[d][1]}" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><span class="t">${DOCS[d][0]}</span>${FLECHE}</a></li>`);
  if (!nbs.length && !docs.length) return "";
  return `<ul class="pieces-salle">${nbs.join("")}${docs.join("")}</ul>`;
}

// Opens a notebook in a frame and hides the “Opening…” veil as soon as the page is readable, without waiting for its
// external scripts (MathJax): offline, the load event can take a long time.
export function ouvrirDansCadre(cadre, url, cacher) {
  const jeton = (cadre.dataset.jeton = String(Date.now() + Math.random()));
  if (cadre.getAttribute("src") === url) { cacher(); return; }
  cadre.src = url;
  const debut = Date.now();
  const verifier = () => {
    if (cadre.dataset.jeton !== jeton) return;
    let pret = false;
    try {
      const d = cadre.contentDocument;
      pret = !!d && d.URL.endsWith(url) && d.readyState !== "loading" && !!d.body && d.body.childElementCount > 0;
    } catch (e) { /* opened from disk: wait for the load event */ }
    if (pret || Date.now() - debut > 10000) cacher(); else setTimeout(verifier, 120);
  };
  setTimeout(verifier, 60);
}

// A full-screen reader to read a notebook without losing your place (tour room, reading chapter)
export function installerLiseuse() {
  const l = document.createElement("div");
  l.className = "liseuse-flottante";
  l.hidden = true;
  l.setAttribute("role", "dialog");
  l.setAttribute("aria-modal", "true");
  l.setAttribute("aria-label", "Notebook");
  l.innerHTML = `<div class="liseuse-barre"><p class="liseuse-titre"></p><a class="liseuse-telecharger" href="#" download>.ipynb ${BAS}</a><a class="liseuse-cabinet" href="#">Open in the cabinet ${FLECHE}</a><button type="button" class="liseuse-fermer">Close</button></div>
    <div class="liseuse-cadre"><p class="liseuse-charge">Opening the notebook…</p><iframe title="Notebook"></iframe></div>`;
  document.body.appendChild(l);
  const cadre = l.querySelector("iframe"), charge = l.querySelector(".liseuse-charge");
  let retour = null;
  cadre.addEventListener("load", () => (charge.style.opacity = 0));
  const fermer = () => { l.hidden = true; document.body.classList.remove("liseuse-ouverte"); retour?.focus(); };
  l.querySelector(".liseuse-fermer").addEventListener("click", fermer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !l.hidden) { e.stopPropagation(); fermer(); } }, true);
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-nb]");
    if (!b) return;
    e.preventDefault();
    retour = b;
    const nom = b.dataset.nb;
    l.querySelector(".liseuse-titre").innerHTML = `<span class="sur-titre">${nomNotebook(nom)}</span> ${titreNotebook(nom)}`;
    l.querySelector(".liseuse-cabinet").href = avecCours(`cabinet.html?nb=${nom}`);
    const dl = l.querySelector(".liseuse-telecharger"), t = telechargement(nom);
    dl.href = t.href; dl.download = t.fichier; dl.title = `Download ${nomNotebook(nom)}`;
    dl.innerHTML = `${etiquetteNb(nom)} ${BAS}`;
    charge.style.opacity = 1;
    ouvrirDansCadre(cadre, `${RACINE}nb/${nom}.html`, () => (charge.style.opacity = 0));
    l.hidden = false;
    document.body.classList.add("liseuse-ouverte");
    l.querySelector(".liseuse-fermer").focus();
  });
  return { estOuverte: () => !l.hidden };
}
