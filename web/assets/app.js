/* Projet Nikkei — interactions du site. Le navigateur interroge api.php, qui relaie vers l'API Python.
   Les graphiques 2D sont en SVG ; les scènes 3D sont dans scene3d.js. */
const NOMS = {
  news_attention_6m: "Volume anormal d'articles",
  news_sent_w: "Sentiment FinBERT pondéré",
  news_dispo: "News disponibles",
  n225_mom_12m: "Momentum 12 mois",
  n225_mom_3m: "Momentum 3 mois",
  n225_vol_ewma: "Volatilité du Nikkei",
  d_jgb10y_bp: "Variation du JGB 10 ans",
  tankan_large_manuf: "Tankan",
  carry_1m: "Portage de la couverture",
  eurjpy_rvol_1m: "Volatilité EUR/JPY",
  "distance au régime agité": "Distance au régime agité",
  "distance au régime calme": "Distance au régime calme",
};
const COULEUR = { acheter: "#1faa59", neutre: "#8b90a0", vendre: "#e5484d" };
const MOIS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

const $ = (id) => document.getElementById(id);
const api = (route, params = {}) => {
  const url = "/api.php?" + new URLSearchParams({ route, ...params });
  return fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.json(); });
};
const pct = (x, d = 0) => (100 * x).toFixed(d).replace(".", ",") + " %";
const nombre = (x, d = 2) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d).replace(".", ",");
const moisLisible = (m) => { const [a, mm] = m.split("-"); return `${MOIS_FR[+mm - 1]} ${a}`; };
const svg = (l, h, contenu) => `<svg viewBox="0 0 ${l} ${h}" role="img">${contenu}</svg>`;

/* ---------- Jauge : zones vendre / neutre / acheter et position de p ---------- */
function jauge(p, seuils) {
  const L = 520, x = (v) => 10 + v * (L - 20), tv = seuils.theta_v, ta = seuils.theta_a;
  const zone = (a, b, couleur, texte) => b - a < 0.005 ? "" :
    `<rect x="${x(a)}" y="18" width="${x(b) - x(a)}" height="26" fill="${couleur}" opacity=".22"/>
     <text x="${(x(a) + x(b)) / 2}" y="36" text-anchor="middle" font-size="13" fill="${couleur}" font-weight="600">${b - a < 0.11 ? "" : texte}</text>`;
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((v) =>
    `<text x="${x(v)}" y="64" text-anchor="${v === 0 ? "start" : v === 1 ? "end" : "middle"}" font-size="11.5" fill="#8b90a0">${pct(v)}</text>`).join("");
  return svg(L, 70,
    zone(0, tv, COULEUR.vendre, "vendre") + zone(tv, ta, "#8b90a0", "neutre") + zone(ta, 1, COULEUR.acheter, "acheter") +
    `<rect x="${x(0)}" y="18" width="${x(1) - x(0)}" height="26" fill="none" stroke="currentColor" stroke-opacity=".18" rx="3"/>` + (p === null ? "" :
    `<line x1="${x(p)}" x2="${x(p)}" y1="8" y2="50" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>
     <circle cx="${x(p)}" cy="8" r="5" fill="currentColor"/>`) + graduations);
}

function afficherSignal(prefixe, s) {
  $(`${prefixe}-proba`).textContent = pct(s.p_hausse);
  $(`${prefixe}-score`).textContent = nombre(s.score);
  $(`${prefixe}-action`).innerHTML = `<span class="badge ${s.action_du_modele}">${s.action_du_modele}</span>`;
  $(`${prefixe}-jauge`).innerHTML = jauge(s.p_hausse, s.seuils);
}

/* ---------- Contributions SHAP : barres divergentes ---------- */
function barresShap(contrib) {
  const lignes = contrib.slice(0, 8), H = 34, L = 560, gauche = 215, droite = 50;
  const max = Math.max(...lignes.map((c) => Math.abs(c.contribution)), 0.05);
  const zero = gauche + (L - gauche - droite) / 2, echelle = (L - gauche - droite) / 2 / max;
  const corps = lignes.map((c, i) => {
    const y = 8 + i * H, l = Math.abs(c.contribution) * echelle, positif = c.contribution >= 0;
    return `<text x="${gauche - 12}" y="${y + 17}" text-anchor="end" font-size="13.5" fill="currentColor">${NOMS[c.variable] || c.variable}</text>
      <rect x="${positif ? zero : zero - l}" y="${y + 4}" width="${Math.max(l, 1)}" height="19" rx="4" fill="${positif ? "#ff7a45" : "#b4ff1a"}"/>
      <text x="${positif ? zero + l + 6 : zero - l - 6}" y="${y + 18}" text-anchor="${positif ? "start" : "end"}" font-size="12.5" fill="currentColor" fill-opacity=".6">${nombre(c.contribution)}</text>`;
  }).join("");
  return svg(L, lignes.length * H + 16, `<line x1="${zero}" x2="${zero}" y1="4" y2="${lignes.length * H + 10}" stroke="currentColor" stroke-opacity=".3"/>` + corps);
}

/* ---------- Historique : 1 € suivant la règle, contre les références ---------- */
function courbeHistorique(h) {
  const L = 1060, H = 360, m = { g: 52, d: 20, h: 16, b: 34 };
  const cumul = (cle) => { let v = 1; return h.map((r) => (v *= 1 + r[cle])); };
  const series = { achat: cumul("rendement_achat_couvert"), regle: cumul("rendement_regle"), cash: cumul("rendement_cash") };
  const tout = [...series.achat, ...series.regle, ...series.cash, 1];
  const min = Math.min(...tout) - 0.03, max = Math.max(...tout) + 0.03, n = h.length;
  const x = (i) => m.g + (i / (n - 1)) * (L - m.g - m.d), y = (v) => m.h + (1 - (v - min) / (max - min)) * (H - m.h - m.b);
  const chemin = (s) => s.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  let axes = "";
  for (let v = Math.ceil(min * 5) / 5; v <= max; v += 0.2) {
    axes += `<line x1="${m.g}" x2="${L - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="#eeeeec"/>
             <text x="${m.g - 8}" y="${y(v) + 4}" text-anchor="end" font-size="12" fill="#8b90a0">${v.toFixed(1).replace(".", ",")} €</text>`;
  }
  h.forEach((r, i) => { if (r.date.endsWith("-01") || i === 0) axes +=
    `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="12" fill="#8b90a0">${r.date.slice(0, 4)}</text>`; });
  const points = h.map((r, i) =>
    `<circle cx="${x(i)}" cy="${y(series.regle[i])}" r="5" fill="${COULEUR[r.action]}" stroke="#fff" stroke-width="1.5">
       <title>${moisLisible(r.date)} · ${r.action} · p(hausse) ${pct(r.p_hausse)} · ${r.hausse_realisee ? "hausse" : "baisse"} réalisée</title></circle>`).join("");
  return svg(L, H, axes +
    `<path d="${chemin(series.cash)}" fill="none" stroke="#8b90a0" stroke-width="1.5" stroke-dasharray="5 5"/>
     <path d="${chemin(series.achat)}" fill="none" stroke="#ff7a45" stroke-width="2.2"/>
     <path d="${chemin(series.regle)}" fill="none" stroke="#052424" stroke-width="2.6"/>` + points);
}

function tableauActions(h) {
  const compte = (action, hausse) => h.filter((r) => r.action === action && r.hausse_realisee === hausse).length;
  $("tableau-actions").querySelector("tbody").innerHTML = ["acheter", "neutre", "vendre"].map((a) =>
    `<tr><td><span class="badge ${a}">${a}</span></td><td class="num">${compte(a, 1)}</td><td class="num">${compte(a, 0)}</td></tr>`).join("");
  const fin = (cle) => h.reduce((v, r) => v * (1 + r[cle]), 1) - 1;
  $("resume-historique").textContent =
    `${h.length} mois · règle ${nombre(100 * fin("rendement_regle"), 1)} % · toujours acheter, couvert ${nombre(100 * fin("rendement_achat_couvert"), 1)} %`;
}

async function chargerHistorique(bloc) {
  const h = await api("historique", { bloc });
  $("graphe-historique").innerHTML = courbeHistorique(h);
  tableauActions(h);
}

/* ---------- Prédicteur : on part d'un mois réel et on règle l'information ---------- */
const FORMATS = {
  ratio: (v) => `${v >= 0 ? "+" : "−"}${Math.abs((Math.exp(v) - 1) * 100).toFixed(0)} % d'articles`,
  score: (v) => nombre(v),
  pourcent: (v) => `${nombre(100 * v, 1)} %`,
  pb: (v) => `${nombre(v, 0)} pb`,
  annuel: (v) => `${nombre(1200 * v, 2)} % / an`,
};
let variables = [], attente = null;
const touchees = new Set();          // variables dont le curseur a été déplacé depuis le chargement du mois

function afficherReglages() {
  variables.forEach((v) => { $(`o-${v.nom}`).textContent = FORMATS[v.affichage](touchees.has(v.nom) ? +$(`c-${v.nom}`).value : v.valeur); });
}

async function predire() {
  const mois = $("choix-mois").value, params = { mois };
  touchees.forEach((nom) => { params[nom] = +$(`c-${nom}`).value; });
  const modifiees = Object.keys(params).length - 1;
  const s = await api("prediction", params);
  afficherSignal("exp", s);
  document.dispatchEvent(new CustomEvent("nikkei:prediction", { detail: s }));   // le nuage du récit suit le prédicteur
  $("exp-proba").style.color = { acheter: "#b4ff1a", vendre: "#ff8a8d" }[s.action_du_modele] || "";
  $("exp-bloc").textContent = modifiees ? "information modifiée" : "valeurs réelles du mois";
  $("graphe-shap").innerHTML = barresShap(s.contributions);
  if (modifiees) {
    $("exp-suite").textContent = `Scénario hypothétique : ${modifiees} variable${modifiees > 1 ? "s" : ""} modifiée${modifiees > 1 ? "s" : ""} par rapport à ${moisLisible(mois)}.`;
  } else {
    const r = (await api("signal", { mois })).rendement_realise_mois_suivant;
    $("exp-suite").textContent = r === null ? "Valeurs réelles. Le mois suivant n'est pas encore connu."
      : `Valeurs réelles. Ce qui s'est passé ensuite : Nikkei ${nombre(100 * r, 1)} % le mois suivant.`;
  }
}

async function chargerMois(mois) {
  variables = await api("variables", { mois });
  touchees.clear();
  $("curseurs").innerHTML = variables.map((v) => {
    const min = Math.min(v.min, v.valeur), max = Math.max(v.max, v.valeur);
    return `<div class="reglage"><label for="c-${v.nom}">${v.libelle} <output id="o-${v.nom}"></output></label>
      <input type="range" id="c-${v.nom}" data-nom="${v.nom}" min="${min}" max="${max}" step="${(max - min) / 200}" value="${v.valeur}"></div>`;
  }).join("");
  $("curseurs").querySelectorAll("input").forEach((c) => c.addEventListener("input", () => {
    touchees.add(c.dataset.nom);
    afficherReglages();
    clearTimeout(attente);
    attente = setTimeout(predire, 80);
  }));
  afficherReglages();
  await predire();
}

/* ---------- Simulateur : la règle de décision recalculée dans le navigateur ---------- */
const sim = { decision: null, donnees: {}, couvert: true, bloc: "test" };

async function simuler() {
  if (!sim.donnees[sim.bloc]) sim.donnees[sim.bloc] = await api("historique", { bloc: sim.bloc });
  const h = sim.donnees[sim.bloc], k = sim.decision.couts, m = +$("sim-marge").value / 100, vente = $("sim-vente").checked;
  const lignes = h.map((r) => {
    const p = r.p_hausse, gainAchat = p * k.B_u + (1 - p) * k.B_d, gainVente = p * k.S_u + (1 - p) * k.S_d;
    let action = Math.max(gainAchat, gainVente) >= m ? (gainAchat >= gainVente ? "acheter" : "vendre") : "neutre";
    if (action === "vendre" && !vente) action = gainAchat >= m ? "acheter" : "neutre";
    const achat = sim.couvert ? r.rendement_achat_couvert : r.rendement_achat_non_couvert;
    const rendement = action === "acheter" ? achat : action === "vendre" ? r.rendement_vente : r.rendement_cash;
    return { ...r, action, rendement_regle: rendement, rendement_achat_couvert: achat };
  });
  const cumul = (cle) => lignes.reduce((v, r) => v * (1 + r[cle]), 1) - 1;
  let valeur = 1, sommet = 1, perte = 0;
  lignes.forEach((r) => { valeur *= 1 + r.rendement_regle; sommet = Math.max(sommet, valeur); perte = Math.min(perte, valeur / sommet - 1); });
  const baisses = lignes.filter((r) => !r.hausse_realisee), evitees = baisses.filter((r) => r.action !== "acheter").length;
  const compte = (a) => lignes.filter((r) => r.action === a).length;

  $("sim-marge-valeur").textContent = `${(+$("sim-marge").value).toFixed(2).replace(".", ",")} % / mois`;
  $("sim-regle").textContent = `${nombre(100 * cumul("rendement_regle"), 1)} %`;
  $("sim-regle").style.color = cumul("rendement_regle") >= cumul("rendement_achat_couvert") ? "#1faa59" : "#e5484d";
  $("sim-reference").textContent = `${nombre(100 * cumul("rendement_achat_couvert"), 1)} %`;
  $("sim-perte").textContent = `${nombre(100 * perte, 1)} %`;
  $("sim-baisses").textContent = `${evitees} / ${baisses.length}`;
  $("sim-actions").textContent = `${compte("acheter")} achats · ${compte("neutre")} mois neutres · ${compte("vendre")} ventes, sur ${lignes.length} mois`;
  [...$("sim-repartition").children].forEach((barre, i) => { barre.style.width = `${(100 * compte(["acheter", "neutre", "vendre"][i])) / lignes.length}%`; });
  $("sim-jauge").innerHTML = jauge(null, { theta_a: Math.min(1, Math.max(0, (m - k.B_d) / (k.B_u - k.B_d))),
    theta_v: vente ? Math.min(1, Math.max(0, (k.S_d - m) / (k.S_d - k.S_u))) : 0 });
  $("sim-graphe").innerHTML = courbeHistorique(lignes);
}

function onglets(id, action) {
  document.querySelectorAll(`#${id} .onglet`).forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(`#${id} .onglet`).forEach((o) => o.classList.toggle("actif", o === b));
    action(b.dataset.v ?? b.dataset.bloc);
  }));
}

async function demarrer() {
  // Jauges rendues par PHP : la probabilité et les seuils sont dans les attributs data-*
  document.querySelectorAll("[data-jauge]").forEach((el) => {
    el.innerHTML = jauge(+el.dataset.p, { theta_v: +el.dataset.tv, theta_a: +el.dataset.ta });
  });
  try {
    const choix = $("choix-mois");                 // options rendues par PHP
    choix.addEventListener("change", (e) => chargerMois(e.target.value));
    $("pred-reinit").addEventListener("click", () => chargerMois(choix.value));
    if (choix.value) await chargerMois(choix.value);

    await chargerHistorique("test");
    onglets("onglets-bloc", chargerHistorique);

    sim.decision = await api("decision");
    $("sim-marge").addEventListener("input", simuler);
    $("sim-vente").addEventListener("change", simuler);
    onglets("sim-couverture", (v) => { sim.couvert = v === "1"; simuler(); });
    onglets("sim-bloc", (v) => { sim.bloc = v; simuler(); });
    $("sim-reinit").addEventListener("click", () => {
      $("sim-marge").value = 100 * sim.decision.marge;
      $("sim-vente").checked = true;
      document.querySelector("#sim-couverture .onglet").click();
      document.querySelector("#sim-bloc .onglet").click();
    });
    await simuler();
  } catch (erreur) {
    $("exp-suite").textContent = "API Python indisponible : lancez « uvicorn app.api:app --port 8000 ».";
    console.error(erreur);
  }
}

/* ---------- Changement de régime : les cartes se retournent ---------- */
const volets = [...document.querySelectorAll(".volet")];
onglets("bascule-regime", (epoque) => {
  $("regime").classList.toggle("est-apres", epoque === "apres");
  volets.forEach((v, i) => setTimeout(() => v.classList.toggle("tourne", epoque === "apres"), i * 90));
});
volets.forEach((v) => {
  v.addEventListener("click", () => v.classList.toggle("tourne"));
  v.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); v.classList.toggle("tourne"); } });
});

/* ---------- Animations : apparition au défilement, compteurs, barre de progression ---------- */
const ANIME = !matchMedia("(prefers-reduced-motion: reduce)").matches;
function compter(el) {
  const cible = +el.dataset.compte, d = +el.dataset.decimales, debut = performance.now();
  const ecrire = (v) => { el.textContent = (el.dataset.prefixe || "") + v.toFixed(d).replace(".", ",") + (el.dataset.suffixe || ""); };
  const pas = (t) => { const u = Math.min(1, (t - debut) / 1300); ecrire(cible * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(pas); };
  requestAnimationFrame(pas);
}
if (ANIME) {
  const vus = new IntersectionObserver((entrees) => entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    vus.unobserve(e.target);
    e.target.classList.add("vu");
    e.target.querySelectorAll("[data-compte]").forEach(compter);
    setTimeout(() => e.target.classList.remove("apparait", "vu"), 950);   // rend la main aux autres transitions
  }), { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll("main .carte, main .figure, main .flux, main h2, main .chapo").forEach((el) => { el.classList.add("apparait"); vus.observe(el); });

  /* Les petits titres de section se « décodent » lettre par lettre en apparaissant */
  const SIGNES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·";
  const decodage = new IntersectionObserver((entrees) => entrees.forEach((e) => {
    if (!e.isIntersecting) return;
    decodage.unobserve(e.target);
    const texte = e.target.textContent, debut = performance.now();
    const pas = (t) => {
      const u = Math.min(1, (t - debut) / 700), fixes = Math.floor(u * texte.length);
      e.target.textContent = texte.slice(0, fixes) + [...texte.slice(fixes)].map((car) => (car === " " ? " " : SIGNES[Math.floor(Math.random() * SIGNES.length)])).join("");
      if (u < 1) requestAnimationFrame(pas); else e.target.textContent = texte;
    };
    requestAnimationFrame(pas);
  }));
  document.querySelectorAll("main .surtitre").forEach((el) => decodage.observe(el));
  addEventListener("scroll", () => {
    const total = document.documentElement.scrollHeight - innerHeight;
    $("progression").style.width = `${total > 0 ? (100 * scrollY) / total : 0}%`;
  }, { passive: true });

  /* Cartes en relief : inclinaison 3D qui suit la souris */
  if (matchMedia("(hover: hover)").matches) {
    document.querySelectorAll(".relief").forEach((carte) => {
      carte.addEventListener("pointermove", (e) => {
        const r = carte.getBoundingClientRect();
        carte.style.setProperty("--ry", `${(((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2)}deg`);
        carte.style.setProperty("--rx", `${((0.5 - (e.clientY - r.top) / r.height) * 9).toFixed(2)}deg`);
      });
      carte.addEventListener("pointerleave", () => { carte.style.setProperty("--rx", "0deg"); carte.style.setProperty("--ry", "0deg"); });
    });
  }
}

/* ---------- Lien de navigation actif selon la section visible ---------- */
const liens = [...document.querySelectorAll("#nav-liens a[href^='#']")];
const observateur = new IntersectionObserver((entrees) => entrees.forEach((e) => {
  if (e.isIntersecting) liens.forEach((l) => l.classList.toggle("actif", l.getAttribute("href") === `#${e.target.id}`));
}), { rootMargin: "-40% 0px -55% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => observateur.observe(s));

demarrer();
