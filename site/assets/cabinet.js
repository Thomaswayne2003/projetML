// Le cabinet : la liste des notebooks et la liseuse, sur une page à part.
import { installerMenu, installerEntete, FLECHE } from "./commun.js";
import { COURS } from "./contenu.js";

// le parcours Maths met l'annexe en tête
const nbs = COURS === "maths"
  ? [...window.NIKKEI.notebooks].sort((a, b) => (b.nom.startsWith("05") ? 1 : 0) - (a.nom.startsWith("05") ? 1 : 0))
  : window.NIKKEI.notebooks;
const liste = document.getElementById("liste"), choix = document.getElementById("choix"), cadre = document.getElementById("cadre"), charge = document.getElementById("charge");
liste.innerHTML = nbs.map((n) => `<li><a href="?nb=${n.nom}&cours=${COURS}" data-nb="${n.nom}"><span class="n">${n.nom.split("_")[0]}</span><span class="t">${n.titre}</span></a></li>`).join("");
choix.innerHTML = nbs.map((n) => `<option value="${n.nom}">${n.nom.split("_")[0]} · ${n.titre}</option>`).join("");
document.getElementById("docs").innerHTML = `<a href="docs/rapport.pdf"><span class="t">Le rapport, en PDF</span>${FLECHE}</a><a href="docs/annexe_maths.pdf"><span class="t">L'annexe de maths, en PDF</span>${FLECHE}</a>`;

function ouvrir(nom, pousser) {
  if (!nbs.some((n) => n.nom === nom)) nom = nbs[0].nom;
  charge.style.opacity = 1;
  cadre.src = `nb/${nom}.html`;
  choix.value = nom;
  liste.querySelectorAll("a").forEach((a) => a.setAttribute("aria-current", a.dataset.nb === nom ? "page" : "false"));
  document.title = `Nikkei · Notebook ${nom.split("_")[0]}`;
  // ouvert directement depuis le disque, certains navigateurs refusent de changer l'adresse : ce n'est pas grave
  if (pousser) try { history.pushState(null, "", `?nb=${nom}&cours=${COURS}`); } catch (e) { /* adresse inchangée */ }
}
cadre.addEventListener("load", () => { charge.style.opacity = 0; });
liste.addEventListener("click", (e) => { const a = e.target.closest("a[data-nb]"); if (!a) return; e.preventDefault(); ouvrir(a.dataset.nb, true); });
choix.addEventListener("change", () => ouvrir(choix.value, true));
addEventListener("popstate", () => ouvrir(new URLSearchParams(location.search).get("nb"), false));
ouvrir(new URLSearchParams(location.search).get("nb"), false);
installerEntete("cabinet");
installerMenu({ page: "cabinet" });
