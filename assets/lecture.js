// La lecture : sept chapitres, les mêmes que les salles de la visite, avec graphiques, tableaux et figures.
// Deux parcours : Applied ML (le projet) et Maths (l'annexe), selon le cours choisi en haut de page.
import { D, SALLES, ENTREE, LIMITES, CHIFFRES, ECART_TEST, MATHS, COURS, COURS_INFO, FIGURES, V2_INFO, V3_INFO, avecCours, nomNotebook, nombre, pct, dec, moisLong, moisSuivant } from "./contenu.js";
import { installerMenu, installerEntete, installerLiseuse, liensPieces, titreNotebook, arrivee, FLECHE, FLECHE_G } from "./commun.js";

const $ = (s, r = document) => r.querySelector(s);
const css = getComputedStyle(document.documentElement);
const C = Object.fromEntries(["pin", "argile", "ocre", "ardoise", "encre", "encre-2", "encre-3", "filet", "papier", "carte"].map((k) => [k, css.getPropertyValue(`--${k}`).trim()]));
const Maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------- figures des notebooks : des planches avec titre, légende et notebook d'origine ----------
const FIG_CHAPITRE = {
  exploration: ["01_nikkei_split", "01_cibles_couverture", "01_correlations"],
  dataset: ["07_bloomberg_controles"],
  apprentissage: ["02_optuna_historique", "02_coefficients_logistiques", "02_coude_kmeans"],
  apres: ["07_test_euros", "07_optuna_v1_v2", "07_permutation_v2", "07_shap_v2_test", "07_coefficients_v1_v2", "07_stabilite_signaux",
          "08_ecarts_log_loss", "08_regle_au_cash", "08_leviers_sharpe", "08_richesse", "08_coefficients_dans_le_temps", "08_contributions_mois_prochain"],
  regle: ["03_fiabilite_brute", "03_fiabilite_platt", "03_regle_validation"],
  epreuve: ["03b_test_probabilites", "03b_test_regle"],
  explication: ["04_permutation", "04_shap_beeswarm_test", "04_shap_waterfall_2026-10", "04_pdp_ice_news", "07_stabilite_signaux", "07_shap_v2_derniere"],
  "m-modele": ["02_coefficients_logistiques"],
  "m-prior": ["05_sensibilite_lambda"],
  "m-convexite": ["05_sensibilite_depart"],
  "m-descente": ["05_sensibilite_pas", "05_sensibilite_iterations"],
  "m-moindres": [],
};
const existe = (n) => D.figures.includes(`${n}.png`);
function planches(noms, groupe) {
  const liste = noms.filter(existe);
  if (!liste.length) return "";
  return `<div class="planches${liste.length === 1 ? " seule" : ""}" data-groupe="${groupe}">${liste.map((n, i) => {
    const [titre, texte, nb] = FIGURES[n] ?? [n, "", ""];
    return `<figure class="planche${i === 0 && liste.length % 2 && liste.length > 1 ? " large" : ""}">
      <button type="button" class="planche-image" data-fig="${n}" aria-label="Agrandir : ${titre}"><img src="figures/${n}.png" alt="${titre}" loading="lazy"><span class="loupe" aria-hidden="true">Agrandir</span></button>
      <figcaption><span class="sur-titre">${nb ? nomNotebook(nb) : "Figure"}</span><strong>${titre}</strong><span>${texte}</span></figcaption>
    </figure>`;
  }).join("")}</div>`;
}

// ---------- outils de dessin ----------
const echelle = (d0, d1, r0, r1) => { const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0); return f; };
function graduations(min, max, n = 5) {
  const pas0 = (max - min) / n, p = Math.pow(10, Math.floor(Math.log10(pas0))), r = pas0 / p;
  const pas = (r >= 5 ? 10 : r >= 2 ? 5 : r >= 1 ? 2 : 1) * p;
  const t = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max + 1e-9; v += pas) t.push(+v.toFixed(10));
  return t;
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Un graphe se redessine à chaque changement de largeur ; dessiner(l) renvoie { svg, survol(x, y) -> { x, y, html } | null }
function graphe(conteneur, dessiner) {
  const zone = document.createElement("div");
  zone.className = "graphe";
  const bulle = document.createElement("div");
  bulle.className = "bulle";
  conteneur.appendChild(zone);
  let rendu = null, largeur = 0;
  const peindre = () => {
    const l = Math.round(zone.clientWidth);
    if (!l || l === largeur) return;
    largeur = l;
    rendu = dessiner(l);
    zone.innerHTML = rendu.svg;
    zone.appendChild(bulle);
  };
  peindre();                                            // tout de suite, sans attendre une image du navigateur
  new ResizeObserver(() => peindre()).observe(zone);   // puis à chaque changement de largeur
  const montrer = (e) => {
    if (!rendu?.survol) return;
    const b = zone.getBoundingClientRect();
    const r = rendu.survol(e.clientX - b.left, e.clientY - b.top);
    const marque = zone.querySelector(".marque-survol");
    if (!r) { bulle.classList.remove("vue"); marque?.setAttribute("opacity", 0); return; }
    bulle.innerHTML = r.html;
    bulle.style.left = `${Math.min(Math.max(r.x, 80), largeur - 80)}px`;
    // la bulle s'ouvre au-dessus du point visé, sans jamais sortir par le haut du tracé (où est la légende)
    bulle.style.top = `${Math.max(r.y, bulle.offsetHeight + 16)}px`;
    bulle.classList.add("vue");
    if (marque && r.marque) { marque.setAttribute("opacity", 1); for (const [k, v] of Object.entries(r.marque)) marque.setAttribute(k, v); }
  };
  zone.addEventListener("pointermove", montrer);
  zone.addEventListener("pointerdown", montrer);
  zone.addEventListener("pointerleave", () => { bulle.classList.remove("vue"); zone.querySelector(".marque-survol")?.setAttribute("opacity", 0); });
  return zone;
}
const axeY = (y, ticks, x0, x1, fmt) => `<g class="grille">${ticks.map((t) => `<line x1="${x0}" x2="${x1}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>
  <g class="axe">${ticks.map((t) => `<text x="${x0 - 8}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join("")}</g>`;
const axeAnnees = (mois, x, y0) => {
  const annees = [...new Set(mois.map((m) => m.slice(0, 4)))];
  const pas = annees.length > 12 ? 2 : 1;
  let dernier = -Infinity;
  const textes = annees.filter((_, i) => i % pas === 0).map((a) => {
    const i = mois.findIndex((m) => m.startsWith(a)), px = x(i);
    if (px - dernier < 36) return "";      // pas deux années collées
    dernier = px;
    return `<text x="${px}" y="${y0 + 18}" text-anchor="middle">${a}</text>`;
  });
  return `<g class="axe"><line x1="${x(0)}" x2="${x(mois.length - 1)}" y1="${y0}" y2="${y0}"/>${textes.join("")}</g>`;
};
const legende = (items) => `<ul class="legende">${items.map(([nom, c, forme = ""]) => `<li><i class="${forme}" style="--c:${c}"></i>${nom}</li>`).join("")}</ul>`;
const ligneBulle = (nom, c, valeur) => `<div class="ligne"><i style="--c:${c}"></i><span>${nom}</span><span>${valeur}</span></div>`;

// positions d'étiquettes en bout de courbe, écartées pour ne pas se chevaucher
function ecarter(ys, ecart = 15) {
  const o = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < o.length; k++) if (o[k].y - o[k - 1].y < ecart) o[k].y = o[k - 1].y + ecart;
  const r = []; o.forEach((e) => (r[e.i] = e.y)); return r;
}

// ---------- I. le Nikkei ----------
const SERIE = D.v2?.serie ?? D.serie;   // table 1999-2026 (seconde version) si elle est là
function figNikkei(boite) {
  const s = SERIE, mois = s.map((m) => m.mois), v = s.map((m) => m.cloture);
  graphe(boite, (l) => {
    const h = Math.round(Math.min(380, l * 0.52)), g = 54, d = 16, hh = 26, b = 30;
    const x = echelle(0, s.length - 1, g, l - d), ticks = graduations(0, Math.max(...v), 4), y = echelle(0, Math.max(ticks[ticks.length - 1], Math.max(...v) * 1.03), h - b, hh);
    const iv = s.findIndex((m) => m.bloc === "validation"), it = s.findIndex((m) => m.bloc === "test"), ip = s.findIndex((m) => m.bloc === "à prédire");
    const bande = (i0, i1, op, nom, fin) => `<rect x="${x(i0)}" y="${hh - 14}" width="${x(i1) - x(i0)}" height="${h - b - hh + 14}" fill="${C.encre}" opacity="${op}"/><text class="etiquette" x="${fin ? x(i1) - 4 : x(i0) + 4}" y="${hh - 2}" text-anchor="${fin ? "end" : "start"}">${nom}</text>`;
    const chemin = v.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Clôture mensuelle du Nikkei 225 de ${s[0].mois.slice(0, 4)} à 2026, avec les périodes d'entraînement, de validation et de test">
      ${axeY(y, ticks, g, l - d, (t) => nombre(t))}
      ${bande(iv, it, 0.035, "Validation", true)}${bande(it, ip, 0.075, "Test")}
      <text class="etiquette" x="${g + 6}" y="${hh - 2}">Entraînement</text>
      <path d="${chemin}" fill="none" stroke="${C.encre}" stroke-width="2" stroke-linejoin="round"/>
      ${axeAnnees(mois, x, h - b)}
      <circle class="marque-survol" r="4.5" fill="${C.encre}" stroke="${C.carte}" stroke-width="2" opacity="0"/>
    </svg>`;
    return { svg, survol: (px) => {
      const i = Math.round(x.inv(px)); if (i < 0 || i >= s.length) return null;
      return { x: x(i), y: y(v[i]), marque: { cx: x(i), cy: y(v[i]) }, html: `<b>${Maj(moisLong(mois[i]))}</b>${nombre(v[i])} points · ${s[i].bloc}` };
    } };
  });
}

// ---------- II. les rendements mensuels ----------
function figRendements(boite) {
  const s = SERIE, r = s.slice(1).map((m, i) => ({ mois: m.mois, r: m.cloture / s[i].cloture - 1 }));
  boite.insertAdjacentHTML("beforeend", legende([["Mois en hausse", C.pin, "bloc"], ["Mois en baisse", C.argile, "bloc"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(300, l * 0.42)), g = 46, d = 10, hh = 12, b = 30;
    const m = Math.max(...r.map((e) => Math.abs(e.r)));
    const x = echelle(0, r.length, g, l - d), y = echelle(-m, m, h - b, hh), w = (l - g - d) / r.length;
    const ticks = graduations(-m, m, 4);
    const barres = r.map((e, i) => { const y0 = y(0), y1 = y(e.r); return `<rect x="${(x(i) + 0.5).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(w - 1, 1).toFixed(1)}" height="${Math.max(Math.abs(y1 - y0), 0.8).toFixed(1)}" rx="${w > 4 ? 1 : 0}" fill="${e.r >= 0 ? C.pin : C.argile}"/>`; }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Rendement mensuel du Nikkei, mois par mois, de ${s[0].mois.slice(0, 4)} à 2026">
      ${axeY(y, ticks, g, l - d, (t) => pct(t, 0))}
      ${barres}
      <line x1="${g}" x2="${l - d}" y1="${y(0)}" y2="${y(0)}" stroke="${C["encre-3"]}"/>
      ${axeAnnees(r.map((e) => e.mois), (i) => x(i) + w / 2, h - b)}
      <rect class="marque-survol" width="${w + 2}" height="${h - b - hh}" y="${hh}" fill="${C.encre}" opacity="0" style="mix-blend-mode:multiply" fill-opacity=".08"/>
    </svg>`;
    return { svg, survol: (px) => {
      const i = Math.floor(x.inv(px)); if (i < 0 || i >= r.length) return null;
      return { x: x(i) + w / 2, y: y(Math.max(r[i].r, 0)), marque: { x: x(i) - 1 }, html: `<b>${Maj(moisLong(r[i].mois))}</b>${pct(r[i].r, 1, true)}` };
    } };
  });
}

// ---------- III. les essais Optuna ----------
function figEssais(boite) {
  const noms = { logit: "Logistique", rf: "Forêt aléatoire", lgbm: "LightGBM" };
  const essais = D.essais.filter((e) => e.cible === "nikkei");
  const MAX = 0.95;
  boite.insertAdjacentHTML("beforeend", legende([["Un essai", C["encre-2"], "rond"], ["Essai retenu", C.argile, "rond"]]));
  graphe(boite, (l) => {
    const g = Math.min(130, l * 0.26), d = 22, hh = 10, ligne = 52, h = hh + ligne * 3 + 34;
    const x = echelle(0.55, MAX, g, l - d), ticks = graduations(0.55, MAX, 4);
    const lignes = Object.keys(noms).map((k, j) => {
      const yc = hh + ligne * j + ligne / 2;
      const pts = essais.filter((e) => e.modele === k);
      const dots = pts.map((e) => {
        const v = Math.min(e.logloss, MAX), dy = ((e.essai * 37) % 13) - 6;
        return e.retenu ? "" : `<circle cx="${x(v).toFixed(1)}" cy="${yc + dy}" r="4" fill="${C["encre-2"]}" fill-opacity=".38"/>`;
      }).join("");
      const r = pts.find((e) => e.retenu), horsCadre = pts.filter((e) => e.logloss > MAX).length;
      return `<line x1="${g}" x2="${l - d}" y1="${yc}" y2="${yc}" stroke="${C.filet}"/>
        <text class="etiquette-forte" x="${g - 12}" y="${yc + 4}" text-anchor="end">${noms[k]}</text>${dots}
        <circle cx="${x(r.logloss)}" cy="${yc}" r="6.5" fill="${C.argile}" stroke="${C.carte}" stroke-width="2"/>
        <text class="etiquette" x="${x(r.logloss)}" y="${yc - 12}" text-anchor="middle">${dec(r.logloss)}</text>
        ${horsCadre ? `<text class="etiquette" x="${l - d + 4}" y="${yc + 4}">›</text>` : ""}`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Log-loss en validation croisée des ${essais.length} essais Optuna, par modèle">
      <g class="grille">${ticks.map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${hh}" y2="${h - 30}"/>`).join("")}</g>
      ${lignes}
      <g class="axe">${ticks.map((t) => `<text x="${x(t)}" y="${h - 12}" text-anchor="middle">${dec(t, 2)}</text>`).join("")}</g>
    </svg>`;
    return { svg, survol: (px, py) => {
      const j = Math.floor((py - hh) / ligne); if (j < 0 || j > 2) return null;
      const k = Object.keys(noms)[j], pts = essais.filter((e) => e.modele === k);
      const meilleur = pts.find((e) => e.retenu);
      const proches = pts.filter((e) => Math.abs(x(Math.min(e.logloss, MAX)) - px) < 6);
      if (!proches.length) return null;
      return { x: px, y: hh + ligne * j + 8, html: `<b>${noms[k]}</b>${proches.length} essai${proches.length > 1 ? "s" : ""} près de ${dec(Math.min(x.inv(px), MAX), 3)}<br>meilleur : ${dec(meilleur.logloss)} (essai ${meilleur.essai})` };
    } };
  });
}

// ---------- III. la surface de coût et la descente de gradient : quatre panneaux, un par pas ----------
let surfaces = 0;
function figSurface(boite, cles = null) {
  const S = D.surface, ax = S.axe, n = ax.length, lim = ax[n - 1];
  const idFond = `fond-surface-${++surfaces}`;   // un identifiant par figure : deux figures peuvent coexister
  const traj = [
    ["trop petit", "Pas trop petit", "n'arrive pas au minimum en 60 pas"],
    ["classique (1/L)", "Pas classique, 1/L", "converge en quelques pas"],
    ["près de la limite", "Près de la limite 2/L", "oscille, puis converge"],
    ["au-delà de la limite", "Au-delà de 2/L", "oscille de plus en plus : diverge"],
  ].filter(([k]) => !cles || cles.includes(k));
  const plat = S.cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const teinte = (c) => {   // une seule teinte, du papier (coût bas) à la terre (coût haut)
    const t = Math.pow((c - cmin) / (cmax - cmin), 0.5), a = [248, 245, 239], b = [158, 133, 110];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  };
  boite.insertAdjacentHTML("beforeend", legende([["Coût bas", "rgb(248,245,239)", "bloc"], ["Coût élevé", "rgb(158,133,110)", "bloc"], ["Départ", C.carte, "rond"], ["Pas de la descente", C.encre, "rond"]]));
  graphe(boite, (l) => {
    const cols = traj.length > 1 && l >= 460 ? 2 : 1, ecart = 22, cote = Math.min(Math.floor((l - (cols - 1) * ecart) / cols), cols === 1 ? 520 : 999), titre = 38;
    const lignes = Math.ceil(traj.length / cols), h = lignes * (cote + titre) + (lignes - 1) * ecart;
    const pas = cote / (n - 1);
    let fond = "";
    const panneaux = traj.map(([k, nom, effet], j) => {
      const ox = (j % cols) * (cote + ecart), oy = Math.floor(j / cols) * (cote + titre + ecart) + titre;
      const x = echelle(-lim, lim, ox, ox + cote), y = echelle(-lim, lim, oy + cote, oy);
      if (!fond) for (let jj = 0; jj < n; jj++) for (let i = 0; i < n; i++) fond += `<rect x="${(x(ax[i]) - ox - pas / 2).toFixed(1)}" y="${(y(ax[jj]) - oy - pas / 2).toFixed(1)}" width="${(pas + 0.6).toFixed(1)}" height="${(pas + 0.6).toFixed(1)}" fill="${teinte(S.cout[jj][i])}"/>`;
      const p = S.trajectoires[k].points.slice(0, 40), dep = p[0], [w1, w2] = S.optimum;
      return `<text class="etiquette-forte" x="${ox}" y="${oy - 20}">${nom} · α = ${dec(S.trajectoires[k].alpha, 2)}</text>
        <text class="etiquette" x="${ox}" y="${oy - 6}">${effet}</text>
        <svg x="${ox}" y="${oy}" width="${cote}" height="${cote}" viewBox="${ox} ${oy} ${cote} ${cote}" overflow="hidden">
          <use href="#${idFond}" x="${ox}" y="${oy}"/>
          <polyline points="${p.map((q) => `${x(q[0]).toFixed(1)},${y(q[1]).toFixed(1)}`).join(" ")}" fill="none" stroke="${C.encre}" stroke-width="1.5" stroke-linejoin="round" opacity=".85"/>
          ${p.slice(1, 25).map((q) => `<circle cx="${x(q[0]).toFixed(1)}" cy="${y(q[1]).toFixed(1)}" r="2.4" fill="${C.encre}"/>`).join("")}
          <path d="M${x(w1) - 5},${y(w2) - 5}l10,10M${x(w1) + 5},${y(w2) - 5}l-10,10" stroke="${C.argile}" stroke-width="2"/>
          <circle cx="${x(dep[0])}" cy="${y(dep[1])}" r="5" fill="${C.carte}" stroke="${C.encre}" stroke-width="1.5"/>
        </svg>
        <rect x="${ox}" y="${oy}" width="${cote}" height="${cote}" fill="none" stroke="${C.filet}"/>`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Quatre descentes de gradient sur la même surface de log-loss pénalisée, avec des pas différents">
      <defs><g id="${idFond}">${fond}</g></defs>${panneaux}</svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Axe horizontal : coefficient du ${esc(S.variables[0])} ; axe vertical : coefficient du ${esc(S.variables[1])}, de ${dec(-lim, 1)} à ${dec(lim, 1)}. La croix marque le minimum. λ = ${dec(S.lambda, 3)} et L = ${dec(S.L, 3)} : la descente converge tant que le pas reste sous 2/L ≈ ${dec(2 / S.L, 2)}.</figcaption>`);
}

// ---------- IV. de la probabilité à l'action ----------
function figRegle(boite) {
  const { theta_a: ta, theta_v: tv } = D.decision.seuils;
  const pc = 1 - D.evaluation.metriques["constante (fréquence de l'entraînement)"]["proba moyenne"];
  const blocs = [["Validation 2022-2023", D.historique_validation], ["Test 2024-2026", D.historique_test]];
  boite.insertAdjacentHTML("beforeend", legende([["Le mois a monté (plein)", C.pin, "rond"], ["Le mois a baissé (cerclé)", C.argile, "rond anneau"], [`Prévision pour ${moisLong(moisSuivant(D.signal.mois_des_donnees))}`, C.encre, "rond anneau"]]));
  graphe(boite, (l) => {
    const g = Math.min(150, l * 0.27), d = 16, hh = 34, ligne = 70, h = hh + ligne * 2 + 64;
    const x = echelle(0.25, 0.8, g, l - d);
    const zone = (a, b, c, op, nom) => `<rect x="${x(a)}" y="${hh - 10}" width="${x(b) - x(a)}" height="${ligne * 2 + 28}" fill="${c}" opacity="${op}"/><text class="etiquette-forte" x="${(x(a) + x(b)) / 2}" y="${hh - 16}" text-anchor="middle">${nom}</text>`;
    const tous = [];
    const lignes = blocs.map(([nom, mois], j) => {
      const yc = hh + ligne * j + ligne / 2;
      const tri = [...mois].sort((a, b) => a.p_hausse - b.p_hausse);
      const places = [];
      const pts = tri.map((m) => {
        const px = x(m.p_hausse);
        let k = 0; while (places.some((q) => Math.abs(q.px - px) < 10 && q.k === k)) k++;
        places.push({ px, k });
        const py = yc + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 10;
        tous.push({ px, py, m });
        return m.hausse_realisee
          ? `<circle cx="${px.toFixed(1)}" cy="${py}" r="4.6" fill="${C.pin}" stroke="${C.carte}" stroke-width="1.5"/>`
          : `<circle cx="${px.toFixed(1)}" cy="${py}" r="3.8" fill="${C.carte}" stroke="${C.argile}" stroke-width="2"/>`;
      }).join("");
      return `<text class="etiquette-forte" x="${g - 12}" y="${yc + 4}" text-anchor="end">${nom}</text>${pts}`;
    }).join("");
    const yp = hh + ligne * 2 + 14, pp = D.signal.p_hausse;
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Probabilités de hausse annoncées chaque mois de validation et de test, avec les seuils de la règle">
      ${zone(0.25, tv, C.argile, 0.09, "Vendre")}${zone(tv, ta, C.encre, 0.03, "Neutre")}${zone(ta, 0.8, C.pin, 0.09, "Acheter")}
      ${[tv, ta].map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${hh - 10}" y2="${hh + ligne * 2 + 18}" stroke="${C["encre-2"]}" stroke-width="1"/>`).join("")}
      <line x1="${x(pc)}" x2="${x(pc)}" y1="${hh - 4}" y2="${hh + ligne * 2 + 18}" stroke="${C.encre}" stroke-dasharray="4 4"/>
      <text class="etiquette" x="${x(pc) + 6}" y="${hh + ligne * 2 + 14}">constante : ${pct(pc, 1)}</text>
      ${lignes}
      <circle cx="${x(pp)}" cy="${yp}" r="6" fill="${C.carte}" stroke="${C.encre}" stroke-width="2"/>
      <text class="etiquette" x="${x(pp) - 10}" y="${yp + 4}" text-anchor="end">${Maj(moisLong(moisSuivant(D.signal.mois_des_donnees)))} : ${pct(pp, 1)}</text>
      <g class="axe">${[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t) => `<text x="${x(t)}" y="${h - 10}" text-anchor="middle">${pct(t, 0)}</text>`).join("")}
        <text x="${x(tv)}" y="${h - 26}" text-anchor="middle">θ vente ${pct(tv, 1)}</text><text x="${x(ta)}" y="${h - 26}" text-anchor="middle">θ achat ${pct(ta, 1)}</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 12;
      for (const t of tous) { const dd = Math.hypot(t.px - px, t.py - py); if (dd < dmin) { dmin = dd; best = t; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>proba de hausse : ${pct(m.p_hausse, 1)}<br>action : ${m.action}<br>le mois a ${m.hausse_realisee ? "monté" : "baissé"}` };
    } };
  });
}

// ---------- V. les euros sur le test ----------
function figEuros(boite, h = D.historique_test) {
  const series = [
    ["Acheter et garder, couvert", C.pin, "rendement_achat_couvert"],
    ["Acheter et garder, non couvert", C.ocre, "rendement_achat_non_couvert"],
    ["Rester neutre (cash)", C.ardoise, "rendement_cash"],
    ["Règle du modèle", C.argile, "rendement_regle"],
  ].map(([nom, c, cle]) => { let v = 1; return { nom, c, val: [0, ...h.map((m) => (v *= 1 + m[cle]) - 1)] }; });
  const mois = ["2023-12", ...h.map((m) => moisSuivant(m.date))];
  boite.insertAdjacentHTML("beforeend", legende(series.map((s) => [s.nom, s.c])));
  graphe(boite, (l) => {
    const etroit = l < 560, hgt = Math.round(Math.min(380, l * 0.56)), g = 50, d = etroit ? 16 : 150, hh = 14, b = 30;
    const tout = series.flatMap((s) => s.val), ticks = graduations(Math.min(...tout), Math.max(...tout), 5);
    const x = echelle(0, mois.length - 1, g, l - d), y = echelle(Math.min(ticks[0], Math.min(...tout)), Math.max(ticks[ticks.length - 1], Math.max(...tout) * 1.02), hgt - b, hh);
    const fins = ecarter(series.map((s) => y(s.val[s.val.length - 1])), 15);
    const svg = `<svg viewBox="0 0 ${l} ${hgt}" role="img" aria-label="Gain cumulé en euros sur le test 2024-2026 de quatre façons de faire">
      ${axeY(y, ticks, g, l - d, (t) => pct(t, 0, true))}
      <line x1="${g}" x2="${l - d}" y1="${y(0)}" y2="${y(0)}" stroke="${C["encre-3"]}"/>
      ${series.map((s) => `<path d="${s.val.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round"/>`).join("")}
      ${etroit ? "" : series.map((s, k) => `<text class="etiquette" x="${l - d + 8}" y="${fins[k] + 4}">${pct(s.val[s.val.length - 1], 1, true)} · ${s.nom.split(",")[0].replace("Acheter et garder", s.nom.includes("non") ? "non couvert" : "couvert").replace("Rester neutre (cash)", "cash").replace("Règle du modèle", "règle")}</text>`).join("")}
      ${axeAnnees(mois.map((m, i) => (i ? m : "2024-00")), x, hgt - b)}
      <line class="marque-survol" y1="${hh}" y2="${hgt - b}" stroke="${C["encre-3"]}" opacity="0"/>
    </svg>`;
    return { svg, survol: (px, py) => {
      const i = Math.round(x.inv(px)); if (i < 0 || i >= mois.length) return null;
      return { x: x(i), y: py, marque: { x1: x(i), x2: x(i) }, html: `<b>Fin ${moisLong(mois[i])}</b>${series.map((s) => ligneBulle(s.nom, s.c, pct(s.val[i], 1, true))).join("")}` };
    } };
  });
}
function tableMetriques() {
  const m = D.evaluation.metriques, lignes = Object.keys(m);
  const cols = [["log-loss", "Log-loss", 3], ["Brier", "Brier", 3], ["ECE", "ECE", 3], ["PR-AUC", "PR-AUC", 3], ["proba moyenne", "P(baisse) moyenne", 3]];
  return `<div class="tableau-defile"><table><thead><tr><th>Modèle, sur les ${D.evaluation.mois_test} mois de test</th>${cols.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>
    ${lignes.map((k) => `<tr class="${k === "logistique" || k.startsWith("constante") ? "mis-en-avant" : ""}"><td>${k === "logistique" ? "Logistique (modèle retenu)" : Maj(k)}</td>${cols.map(([c, , d]) => `<td>${dec(m[k][c], d)}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div><p class="note">Plus bas, c'est mieux, sauf pour la PR-AUC. La classe positive est la baisse : ${D.evaluation.baisses_test} mois sur ${D.evaluation.mois_test}, soit ${pct(D.evaluation.baisses_test / D.evaluation.mois_test, 1)}.</p>`;
}
function tablePerf() {
  const p = D.evaluation.performance_euros;
  const couleur = { "règle du modèle": C.argile, "toujours acheter, couvert": C.pin, "toujours acheter, non couvert": C.ocre, "toujours neutre (cash)": C.ardoise, "même exposition moyenne (-18%), sans timing": C["encre-3"] };
  return `<div class="tableau-defile"><table><thead><tr><th>Façon de faire, en euros, 2024-2026</th><th>Cumul</th><th>Par an</th><th>Pire baisse</th></tr></thead><tbody>
    ${Object.entries(p).map(([k, v]) => `<tr><td><span class="pastille" style="--c:${couleur[k] ?? C["encre-3"]}"></span>${Maj(k.replace("(-18%)", "(−18 %)"))}</td><td>${pct(v.cumul, 1, true)}</td><td>${pct(v["annualisé"], 1, true)}</td><td>${pct(v["perte maximale"], 1)}</td></tr>`).join("")}
  </tbody></table></div><p class="note">« Même exposition moyenne, sans timing » garde en permanence la position moyenne de la règle : c'est la référence qui isole ce que le choix du moment apporte. Indices de prix, sans dividendes ni frais.</p>`;
}

// ---------- VI. l'agitation ----------
function figVolatilite(boite) {
  const s = D.volatilite.serie;
  const reelle = s.map((m) => m.reelle), prevue = s.map((m) => m.prevue), mois = s.map((m) => moisSuivant(m.mois));
  boite.insertAdjacentHTML("beforeend", legende([["Volatilité réalisée le mois suivant", C.ardoise], ["Volatilité prévue à la fin du mois", C.argile], ["Seuil d'un mois agité, 20 %", C["encre-2"], "tirets"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(340, l * 0.5)), g = 46, d = 14, hh = 24, b = 30;
    const vmax = Math.max(...reelle.filter((v) => v != null)), ticks = graduations(0, vmax, 4);
    const x = echelle(0, s.length - 1, g, l - d), y = echelle(0, Math.max(ticks[ticks.length - 1], vmax * 1.03), h - b, hh);
    const it = s.findIndex((m) => m.bloc === "test");
    const trace = (v, c, ep) => `<path d="${v.map((e, i) => (e == null ? "" : `${i && v[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(e).toFixed(1)}`)).join("")}" fill="none" stroke="${c}" stroke-width="${ep}" stroke-linejoin="round"/>`;
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Volatilité mensuelle du Nikkei, réalisée et prévue, de 2016 à 2026">
      ${axeY(y, ticks, g, l - d, (t) => pct(t, 0))}
      <rect x="${x(it)}" y="${hh - 14}" width="${x(s.length - 1) - x(it)}" height="${h - b - hh + 14}" fill="${C.encre}" opacity=".06"/>
      <text class="etiquette" x="${x(s.length - 1) - 4}" y="${hh - 2}" text-anchor="end">Test</text>
      <line x1="${g}" x2="${l - d}" y1="${y(0.2)}" y2="${y(0.2)}" stroke="${C["encre-2"]}" stroke-dasharray="4 4"/>
      ${trace(reelle, C.ardoise, 2)}${trace(prevue, C.argile, 2)}
      ${axeAnnees(mois, x, h - b)}
      <line class="marque-survol" y1="${hh}" y2="${h - b}" stroke="${C["encre-3"]}" opacity="0"/>
    </svg>`;
    return { svg, survol: (px, py) => {
      const i = Math.round(x.inv(px)); if (i < 0 || i >= s.length) return null;
      return { x: x(i), y: py, marque: { x1: x(i), x2: x(i) }, html: `<b>${Maj(moisLong(mois[i]))}</b>${ligneBulle("réalisée", C.ardoise, reelle[i] == null ? "à venir" : pct(reelle[i], 1))}${ligneBulle("prévue", C.argile, pct(prevue[i], 1))}` };
    } };
  });
}
function tableSignalRisque() {
  const sr = D.signal_risque, periodes = [["2003-2015 (réglage)", "2003-2015", "réglage"], ["2016-2023", "2016-2023", "hors échantillon"], ["2024-2026", "2024-2026", "hors échantillon"]];
  const G = "acheter et garder", S = "signal risque, chaque jour (règle figée)";
  return `<div class="tableau-defile"><table class="groupes"><thead>
    <tr><th rowspan="2">Période</th><th colspan="3" class="groupe">Rendement par unité de risque</th><th colspan="2" class="groupe">Pire baisse</th></tr>
    <tr><th>Garder</th><th>Signal</th><th>Écart ± e.t.</th><th>Garder</th><th>Signal</th></tr></thead><tbody>
    ${periodes.map(([p, nom, note]) => { const g = sr.strategies[p][G], si = sr.strategies[p][S], c = sr.comparaisons[p];
      return `<tr${note === "réglage" ? "" : ' class="mis-en-avant"'}><td>${nom}<br><small>${note}</small></td><td>${dec(g.rendement_par_unite_de_risque, 2)}</td><td>${dec(si.rendement_par_unite_de_risque, 2)}</td><td>${dec(c.ecart, 2)} ± ${dec(c.erreur_type, 2)}</td><td>${pct(g["perte_maximale_%"] / 100, 0)}</td><td>${pct(si["perte_maximale_%"] / 100, 0)}</td></tr>`; }).join("")}
  </tbody></table></div><p class="note">« Garder » : acheter et garder ; « Signal » : la règle figée avec les seules données 2000-2015 (risque prévu sous ${pct(sr.regle.seuils_volatilite_annuelle[0], 0)}, acheter plein ; au-dessus de ${pct(sr.regle.seuils_volatilite_annuelle[1], 0)}, ne pas acheter ; entre les deux, à moitié). Le signal reste investi ${pct(sr.strategies["2003-2026 (tout)"][S]["part_investie_moyenne_%"] / 100, 0)} du temps en moyenne : sa pire baisse se compare mal à celle d'une position pleine.</p>`;
}

// ---------- Maths I. la sigmoïde et les mois qu'elle doit séparer ----------
const logit = (p) => Math.log(p / (1 - p));
const sigma = (u) => 1 / (1 + Math.exp(-u));
// parcours Maths : les mois d'entraînement, au score que le modèle figé leur donne (pas de mois de test ici)
const moisMaths = () => (D.maths?.scores_entrainement ?? []).map(([date, u, baisse]) => ({ date, u, pb: Math.min(1 - 1e-6, Math.max(1e-6, sigma(u))), baisse }));
function figSigmoide(boite) {
  const mois = moisMaths();
  boite.insertAdjacentHTML("beforeend", legende([["σ(u), la probabilité de baisse", C.encre], ["Mois qui a baissé (cerclé)", C.argile, "rond anneau"], ["Mois qui a monté (plein)", C.pin, "rond"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(360, l * 0.55)), g = 46, d = 16, hh = 22, b = 40;
    const x = echelle(-5, 5, g, l - d), y = echelle(0, 1, h - b, hh);
    const courbe = [...Array(201).keys()].map((i) => { const u = -5 + i * 0.05; return `${i ? "L" : "M"}${x(u).toFixed(1)},${y(sigma(u)).toFixed(1)}`; }).join("");
    const umin = Math.min(...mois.map((m) => logit(m.pb))), umax = Math.max(...mois.map((m) => logit(m.pb)));
    const pts = [];
    const dots = mois.map((m, k) => {
      const u = logit(m.pb), py = (m.baisse ? y(1) + 12 : y(0) - 12) + ((k * 7) % 5 - 2) * 3.2;
      pts.push({ px: x(u), py, m });
      return m.baisse ? `<circle cx="${x(u).toFixed(1)}" cy="${py.toFixed(1)}" r="3.6" fill="${C.carte}" stroke="${C.argile}" stroke-width="1.8"/>` : `<circle cx="${x(u).toFixed(1)}" cy="${py.toFixed(1)}" r="4.2" fill="${C.pin}" stroke="${C.carte}" stroke-width="1.2"/>`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="La fonction sigmoïde, et les mois d'entraînement placés à leur score">
      ${axeY(y, [0, 0.25, 0.5, 0.75, 1], g, l - d, (t) => pct(t, 0))}
      <rect x="${x(umin)}" y="${hh}" width="${x(umax) - x(umin)}" height="${h - b - hh}" fill="${C.encre}" opacity=".05"/>
      <text class="etiquette" x="${x(umax) + 6}" y="${y(0.5) + 18}">les scores du modèle</text>
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - b}" stroke="${C.filet}"/>
      <path d="${courbe}" fill="none" stroke="${C.encre}" stroke-width="2"/>
      <circle cx="${x(0)}" cy="${y(0.5)}" r="3.5" fill="${C.encre}"/><text class="etiquette-forte" x="${x(0) - 8}" y="${y(0.5) - 8}" text-anchor="end">σ(0) = 50 %</text>
      ${dots}
      <g class="axe">${[-4, -2, 0, 2, 4].map((t) => `<text x="${x(t)}" y="${h - b + 18}" text-anchor="middle">${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">score u = wᵀx + b</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const t of pts) { const dd = Math.hypot(t.px - px, t.py - py); if (dd < dmin) { dmin = dd; best = t; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>score ${dec(m.u, 2)}, soit ${pct(m.pb, 1)} de baisse<br>le mois a ${m.baisse ? "baissé" : "monté"}` };
    } };
  });
}

// ---------- Maths II. les deux branches de la log-loss ----------
function figPertes(boite) {
  const t = moisMaths().map((m) => ({ ...m, p: m.pb, y: m.baisse, perte: m.baisse ? -Math.log(m.pb) : -Math.log(1 - m.pb) }));
  const pc = t.reduce((a, m) => a + m.y, 0) / (t.length || 1), moyenne = MATHS.llEntrainement ?? t.reduce((a, m) => a + m.perte, 0) / (t.length || 1);
  boite.insertAdjacentHTML("beforeend", legende([["Perte si le mois baisse, −log p", C.argile], ["Perte si le mois monte, −log(1 − p)", C.pin], ["Un mois d'entraînement", C.encre, "rond"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(360, l * 0.56)), g = 40, d = 16, hh = 14, b = 40;
    const x = echelle(0, 1, g, l - d), y = echelle(0, 3, h - b, hh);
    const trace = (f, c) => `<path d="${[...Array(97).keys()].map((i) => { const p = 0.02 + i * 0.01; return `${i ? "L" : "M"}${x(p).toFixed(1)},${y(Math.min(f(p), 3)).toFixed(1)}`; }).join("")}" fill="none" stroke="${c}" stroke-width="2"/>`;
    const pts = t.map((m) => ({ px: x(m.p), py: y(m.perte), m }));
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Les deux branches de la log-loss, et la perte payée chaque mois d'entraînement">
      ${axeY(y, [0, 1, 2, 3], g, l - d, (v) => dec(v, 0))}
      ${trace((p) => -Math.log(p), C.argile)}${trace((p) => -Math.log(1 - p), C.pin)}
      <line x1="${g}" x2="${l - d}" y1="${y(moyenne)}" y2="${y(moyenne)}" stroke="${C.encre}" stroke-dasharray="4 4"/>
      <text class="etiquette" x="${l - d}" y="${y(moyenne) - 6}" text-anchor="end">J au minimum : ${dec(moyenne)}</text>
      <line x1="${x(pc)}" x2="${x(pc)}" y1="${hh}" y2="${h - b}" stroke="${C["encre-3"]}" stroke-dasharray="2 4"/>
      <text class="etiquette" x="${x(pc) + 6}" y="${hh + 12}">fréquence des baisses : ${pct(pc, 1)}</text>
      ${pts.map((q) => `<circle cx="${q.px.toFixed(1)}" cy="${Math.max(hh, q.py).toFixed(1)}" r="3.4" fill="${q.m.y ? C.argile : C.pin}" stroke="${C.carte}" stroke-width="1.2"/>`).join("")}
      <g class="axe">${[0, 0.25, 0.5, 0.75, 1].map((v) => `<text x="${x(v)}" y="${h - b + 18}" text-anchor="middle">${pct(v, 0)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">probabilité de baisse annoncée, p</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const q of pts) { const dd = Math.hypot(q.px - px, q.py - py); if (dd < dmin) { dmin = dd; best = q; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>p = ${pct(m.p, 1)}, le mois a ${m.y ? "baissé" : "monté"}<br>perte payée : ${dec(m.perte, 3)}` };
    } };
  });
}

// ---------- Maths III. la carte des pentes ----------
function figPentes(boite) {
  const S = D.surface, ax = S.axe, n = ax.length, lim = ax[n - 1];
  const plat = S.cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const teinte = (c) => { const t = Math.pow((c - cmin) / (cmax - cmin), 0.5), a = [248, 245, 239], b = [158, 133, 110]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; };
  const coutEn = (w1, w2) => {
    const fx = Math.min(Math.max(((w1 + lim) / (2 * lim)) * (n - 1), 0), n - 1 - 1e-6), fy = Math.min(Math.max(((w2 + lim) / (2 * lim)) * (n - 1), 0), n - 1 - 1e-6);
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    return S.cout[j][i] * (1 - u) * (1 - v) + S.cout[j][i + 1] * u * (1 - v) + S.cout[j + 1][i] * (1 - u) * v + S.cout[j + 1][i + 1] * u * v;
  };
  boite.insertAdjacentHTML("beforeend", legende([["Coût bas", "rgb(248,245,239)", "bloc"], ["Coût élevé", "rgb(158,133,110)", "bloc"], ["−∇J, la direction de plus forte descente", C.encre]]));
  graphe(boite, (l) => {
    const cote = Math.min(l - 60, 520), g = 50, hh = 6, h = cote + hh + 44;
    const x = echelle(-lim, lim, g, g + cote), y = echelle(-lim, lim, hh + cote, hh), pas = cote / (n - 1);
    let fond = "";
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) fond += `<rect x="${(x(ax[i]) - pas / 2).toFixed(1)}" y="${(y(ax[j]) - pas / 2).toFixed(1)}" width="${(pas + 0.6).toFixed(1)}" height="${(pas + 0.6).toFixed(1)}" fill="${teinte(S.cout[j][i])}"/>`;
    const k = 11, e = 0.02, fl = [];
    let gmax = 0;
    for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
      const w1 = (-1 + (2 * (i + 0.5)) / k) * lim, w2 = (-1 + (2 * (j + 0.5)) / k) * lim;
      const g1 = (coutEn(w1 + e, w2) - coutEn(w1 - e, w2)) / (2 * e), g2 = (coutEn(w1, w2 + e) - coutEn(w1, w2 - e)) / (2 * e);
      const nn = Math.hypot(g1, g2); gmax = Math.max(gmax, nn); fl.push({ w1, w2, g1, g2, nn });
    }
    const maille = cote / k;
    const fleches = fl.map((f) => {
      const long = maille * (0.25 + 0.55 * Math.sqrt(f.nn / gmax)), ux = -f.g1 / f.nn, uy = f.g2 / f.nn;   // −∇J ; l'axe vertical de l'écran descend
      const x0 = x(f.w1) - (ux * long) / 2, y0 = y(f.w2) - (uy * long) / 2, x1 = x0 + ux * long, y1 = y0 + uy * long;
      const ang = Math.atan2(uy, ux), a1 = ang + 2.6, a2 = ang - 2.6;
      return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}M${(x1 + 5 * Math.cos(a1)).toFixed(1)},${(y1 + 5 * Math.sin(a1)).toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}L${(x1 + 5 * Math.cos(a2)).toFixed(1)},${(y1 + 5 * Math.sin(a2)).toFixed(1)}" fill="none" stroke="${C.encre}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join("");
    const [w1, w2] = S.optimum, ticks = graduations(-lim, lim, 4);
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Le champ des gradients sur la surface de coût : toutes les flèches descendent vers le minimum">
      ${fond}${fleches}
      <rect x="${g}" y="${hh}" width="${cote}" height="${cote}" fill="none" stroke="${C.filet}"/>
      <path d="M${x(w1) - 6},${y(w2) - 6}l12,12M${x(w1) + 6},${y(w2) - 6}l-12,12" stroke="${C.argile}" stroke-width="2.4"/>
      <g class="axe">${ticks.map((t) => `<text x="${x(t)}" y="${hh + cote + 16}" text-anchor="middle">${dec(t, 1)}</text><text x="${g - 8}" y="${y(t) + 4}" text-anchor="end">${dec(t, 1)}</text>`).join("")}
        <text x="${g + cote / 2}" y="${hh + cote + 36}" text-anchor="middle">coefficient : ${esc(S.variables[0])}</text></g>
    </svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Axe vertical : coefficient du ${esc(S.variables[1])}. Les gradients sont calculés par différences finies sur la grille du coût ; la croix marque le minimum, là où ∇J = 0.</figcaption>`);
}

// ---------- Maths IV. le prior gaussien et les poids appris ----------
function figPrior(boite) {
  setTimeout(() => {   // la liste des douze poids, sous le graphique
    const M = D.modele, ordre = M.coefficients.map((c, k) => ({ c, k })).sort((a, z) => Math.abs(z.c) - Math.abs(a.c));
    boite.insertAdjacentHTML("beforeend", `<ol class="poids">${ordre.map(({ c, k }) => `<li><span>${Maj(M.libelles[k])}</span><b>${c > 0 ? "+" : ""}${dec(c, 3)}</b></li>`).join("")}</ol>`);
  });
  const M = D.modele, tau = MATHS.tau, W = 0.6;
  const dens = (w) => Math.exp(-(w * w) / (2 * tau * tau)) / (tau * Math.sqrt(2 * Math.PI));
  boite.insertAdjacentHTML("beforeend", legende([[`Prior N(0, τ²), τ = ${dec(tau, 2)}`, C.encre], ["± 2τ : 95 % de la masse", C["encre-3"], "bloc"], ["Poids positif (pousse vers la baisse)", C.encre, "rond"], ["Poids négatif", C.argile, "rond anneau"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(320, l * 0.5)), g = 46, d = 16, hh = 16, b = 30;
    const x = echelle(-W, W, g, l - d), dmax = dens(0), y = echelle(0, dmax * 1.08, h - b, hh);
    const courbe = [...Array(241).keys()].map((i) => { const w = -W + i * 0.005; return `${i ? "L" : "M"}${x(w).toFixed(1)},${y(dens(w)).toFixed(1)}`; }).join("");
    const rug = M.coefficients.map((c, k) => {
      const px = x(c);
      const marque = c >= 0 ? `<circle cx="${px.toFixed(1)}" cy="${h - b + 12}" r="4.2" fill="${C.encre}"/>` : `<circle cx="${px.toFixed(1)}" cy="${h - b + 12}" r="3.6" fill="${C.carte}" stroke="${C.argile}" stroke-width="1.8"/>`;
      return `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${y(dens(c))}" y2="${h - b + 8}" stroke="${C["encre-3"]}" stroke-width="1"/>${marque}`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="La densité du prior gaussien, et les douze poids appris par le modèle final">
      <rect x="${x(-2 * tau)}" y="${hh}" width="${x(2 * tau) - x(-2 * tau)}" height="${h - b - hh}" fill="${C.encre}" opacity=".05"/>
      <path d="${courbe}L${x(W)},${y(0)}L${x(-W)},${y(0)}Z" fill="${C.encre}" opacity=".06"/>
      <path d="${courbe}" fill="none" stroke="${C.encre}" stroke-width="2"/>
      <line x1="${g}" x2="${l - d}" y1="${y(0)}" y2="${y(0)}" stroke="${C["encre-3"]}"/>
      ${rug}
      <g class="axe">${[-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6].map((t) => `<text x="${x(t)}" y="${y(0) - 6}" text-anchor="middle" opacity=".8">${dec(t, 1)}</text>`).join("")}</g>
    </svg>`;
    return { svg, survol: (px) => {
      let best = null, dmin = 8;
      M.coefficients.forEach((c, k) => { const dd = Math.abs(x(c) - px); if (dd < dmin) { dmin = dd; best = k; } });
      if (best === null) return null;
      return { x: x(M.coefficients[best]), y: h - b - 10, html: `<b>${Maj(M.libelles[best])}</b>poids ${dec(M.coefficients[best], 3)}<br>${dec(Math.abs(M.coefficients[best]) / tau, 2)} τ` };
    } };
  });
}

// ---------- Maths VII. ce que 33 mois peuvent prouver ----------
function figMoindres(boite) {
  const O = MATHS.ols ?? {}, tr = O.entrainement ?? [], va = O.validation ?? [];
  boite.insertAdjacentHTML("beforeend", legende([[`Mois d'entraînement (R² = ${dec(O.r2_entrainement ?? 0, 2)})`, C.pin, "rond"], [`Mois de validation (R² = ${dec(O.r2_validation ?? 0, 2)})`, C.argile, "rond"], ["Prévision parfaite, r̂ = r", C.encre]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(380, l * 0.62)), g = 52, d = 16, hh = 14, b = 40;
    const tous = tr.concat(va).flatMap(([, a, c]) => [a, c]), lim = Math.max(0.1, ...tous.map(Math.abs)) * 1.05;
    const ticks = graduations(-lim, lim, 5);
    const x = echelle(-lim, lim, g, l - d), y = echelle(-lim, lim, h - b, hh);
    const pts = [...tr.map((q) => ({ q, v: false })), ...va.map((q) => ({ q, v: true }))].map((p) => ({ ...p, px: x(p.q[1]), py: y(p.q[2]) }));
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Rendement prévu par les moindres carrés face au rendement réel, mois d'entraînement et de validation">
      ${axeY(y, ticks, g, l - d, (v) => pct(v, 0))}
      <line x1="${x(-lim)}" y1="${y(-lim)}" x2="${x(lim)}" y2="${y(lim)}" stroke="${C.encre}" stroke-width="1.6"/>
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - b}" stroke="${C.filet}"/>
      ${pts.filter((p) => !p.v).map((p) => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="3.4" fill="${C.pin}" fill-opacity=".75" stroke="${C.carte}" stroke-width="1"/>`).join("")}
      ${pts.filter((p) => p.v).map((p) => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="4.6" fill="${C.argile}" stroke="${C.carte}" stroke-width="1.3"/>`).join("")}
      <g class="axe">${ticks.map((t) => `<text x="${x(t)}" y="${h - b + 18}" text-anchor="middle">${pct(t, 0)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">rendement prévu par les équations normales, r̂</text></g>
      <text class="etiquette" x="${g + 6}" y="${hh + 12}">rendement réel du mois suivant, r</text>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const p of pts) { const dd = Math.hypot(p.px - px, p.py - py); if (dd < dmin) { dmin = dd; best = p; } }
      if (!best) return null;
      const [date, prevu, reel] = best.q;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(date)))}</b>${best.v ? "validation" : "entraînement"}<br>prévu ${pct(prevu, 1, true)}, réel ${pct(reel, 1, true)}` };
    } };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Sur l'entraînement, les points suivent un peu la diagonale (R² = ${dec(O.r2_entrainement ?? 0, 2)}). Sur la validation, ils s'en écartent : R² = ${dec(O.r2_validation ?? 0, 2)}, pire que de prédire chaque mois la moyenne.</figcaption>`);
}


// ---------- VI. ce qui pèse dans la dernière prédiction ----------
function figContributions(boite) {
  const lib = Object.fromEntries((D.modele?.variables ?? []).map((v, i) => [v, D.modele.libelles[i]]));
  const items = [...(D.explication ?? [])].sort((a, b) => b.contribution - a.contribution).map((e) => ({ ...e, nom: Maj(lib[e.variable] ?? e.variable) }));
  boite.insertAdjacentHTML("beforeend", legende([["Pousse vers la baisse", C.argile, "bloc"], ["Pousse vers la hausse", C.pin, "bloc"]]));
  graphe(boite, (l) => {
    const ligne = 26, g = Math.min(210, l * 0.4), d = 56, hh = 8, h = hh + ligne * items.length + 26;
    const m = Math.max(...items.map((e) => Math.abs(e.contribution)));
    const x = echelle(-m, m, g, l - d);
    const barres = items.map((e, k) => {
      const y = hh + k * ligne, x0 = x(0), x1 = x(e.contribution);
      return `<text class="etiquette" x="${g - 10}" y="${y + ligne / 2 + 4}" text-anchor="end">${esc(e.nom)}</text>
        <rect x="${Math.min(x0, x1).toFixed(1)}" y="${y + 5}" width="${Math.max(Math.abs(x1 - x0), 1).toFixed(1)}" height="${ligne - 10}" rx="2" fill="${e.contribution > 0 ? C.argile : C.pin}"/>
        <text class="etiquette" x="${(e.contribution > 0 ? x1 + 6 : x1 - 6).toFixed(1)}" y="${y + ligne / 2 + 4}" text-anchor="${e.contribution > 0 ? "start" : "end"}">${e.contribution > 0 ? "+" : "−"}${dec(Math.abs(e.contribution), 2)}</text>`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Contribution de chaque variable à la dernière prédiction du modèle">
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - 22}" stroke="${C["encre-3"]}"/>
      ${barres}
      <g class="axe"><text x="${x(-m)}" y="${h - 6}">vers la hausse</text><text x="${x(m)}" y="${h - 6}" text-anchor="end">vers la baisse</text></g>
    </svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Contribution au log-odds de la baisse : poids de la logistique fois la valeur standardisée de la variable, pour la prédiction faite avec les données de fin ${moisLong(D.signal.mois_des_donnees)}.</figcaption>`);
}


// ---------- VI. comprendre chaque décision du test, mois par mois ----------
function figExplorateur(boite) {
  const lib = Object.fromEntries((D.modele?.variables ?? []).map((v, i) => [v, D.modele.libelles[i]]));
  const nomVar = (v) => Maj(lib[v] ?? v);
  const v1 = D.explications_test ?? {}, v2 = D.v2?.shap_test?.mois ?? {};
  const hist = { v1: Object.fromEntries(D.historique_test.map((m) => [m.date, m])),
                 v2: Object.fromEntries((D.v2?.evaluation_test?.historique_test ?? []).map((m) => [m.date, m])) };
  const versions = [["v1", "Première version · logistique (figée)"]].concat(Object.keys(v2).length ? [["v2", `Seconde version · ${D.v2.shap_test.modele} (après coup)`]] : []);
  const mois = Object.keys(v1);
  let version = "v1", choisi = mois[mois.length - 1];

  const decision = (date) => {
    const h = hist[version][date];
    if (version === "v1") return h ? { p: h.p_hausse, action: h.action } : { p: D.signal.p_hausse, action: D.signal.action_du_modele };
    return { p: v2[date].p_hausse, action: v2[date].action };
  };
  const contributions = (date) => (version === "v1"
    ? [...(v1[date] ?? [])].map((e) => ({ nom: nomVar(e.variable), c: e.contribution }))
    : (v2[date]?.contributions ?? []).map((e) => ({ nom: Maj(e.variable), c: e.contribution })))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 9);

  boite.insertAdjacentHTML("beforeend", `<div class="explorateur">
    <div class="versions" role="group" aria-label="Version du modèle">${versions.map(([k, nom]) => `<button type="button" data-version="${k}">${nom}</button>`).join("")}</div>
    <div class="mois-puces" role="group" aria-label="Mois du test">${mois.map((d) => {
      const h = hist.v1[d], issue = h ? (h.hausse_realisee ? "hausse" : "baisse") : "avenir";
      const [an, m] = moisSuivant(d).split("-");
      const court = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][+m - 1];
      return `<button type="button" data-mois="${d}" class="${issue}" title="${Maj(moisLong(moisSuivant(d)))}">${court} ${an.slice(2)}</button>`;
    }).join("")}</div>
    <div class="explorateur-corps"><div class="explorateur-resume"></div><div class="explorateur-barres"></div></div>
    <ul class="legende"><li><i class="rond" style="--c:${C.pin}"></i>le mois a monté</li><li><i class="rond anneau" style="--c:${C.argile}"></i>le mois a baissé</li><li><i class="rond anneau" style="--c:${C["encre-3"]}"></i>à venir</li></ul>
  </div>`);
  const zone = boite.querySelector(".explorateur");

  function afficher() {
    zone.querySelectorAll("[data-version]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.version === version));
    zone.querySelectorAll("[data-mois]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mois === choisi));
    const { p, action } = decision(choisi), h = hist.v1[choisi];
    const suite = h ? `Le Nikkei a ${h.hausse_realisee ? "monté" : "baissé"} : ${pct(h.rendement_achat_couvert, 1, true)} pour un achat couvert.` : "Le mois n'est pas encore connu.";
    zone.querySelector(".explorateur-resume").innerHTML = `
      <p class="sur-titre">${Maj(moisLong(moisSuivant(choisi)))}, avec les données de fin ${moisLong(choisi)}</p>
      <dl><div><dt>${pct(p, 1)}</dt><dd>probabilité de hausse annoncée</dd></div>
      <div><dt class="action ${action}">${Maj(action)}</dt><dd>action de la règle</dd></div></dl>
      <p class="suite">${suite}</p>`;
    const items = contributions(choisi);
    const m = Math.max(...items.map((e) => Math.abs(e.c)), 1e-6);
    zone.querySelector(".explorateur-barres").innerHTML = `<p class="sous">Ce qui a pesé, en log-odds de la baisse${version === "v2" ? " (valeurs SHAP)" : ""}</p>
      <ul>${items.map((e) => `<li><span>${esc(e.nom)}</span><span class="piste"><i class="${e.c > 0 ? "vers-baisse" : "vers-hausse"}" style="--l:${(Math.abs(e.c) / m) * 50}%"></i></span><b>${e.c > 0 ? "+" : "−"}${dec(Math.abs(e.c), 2)}</b></li>`).join("")}</ul>
      <p class="note">À droite du trait, la variable pousse vers la baisse ; à gauche, vers la hausse.</p>`;
  }
  zone.addEventListener("click", (e) => {
    const b = e.target.closest("[data-version], [data-mois]");
    if (!b) return;
    if (b.dataset.version) version = b.dataset.version; else choisi = b.dataset.mois;
    afficher();
  });
  afficher();
}

// ---------- VII. la seconde version face à la première ----------
function tableVersions() {
  if (!V2_INFO) return "";
  const e1 = D.evaluation, e2 = D.v2.evaluation_test, d2 = D.v2.decision_finale, C1 = "constante (fréquence de l'entraînement)";
  const lignes = [
    ["Mois d'entraînement", `${CHIFFRES.moisEntrainement} (2010-2021)`, `${V2_INFO.mois} (1999-2021)`],
    ["Modèle retenu sur la validation", "logistique", e2.modele],
    ["Log-loss de validation, modèle / constante", "0,699 / 0,681", `${dec(d2.validation.log_loss_calibree[d2.modele_nikkei])} / ${dec(d2.validation.log_loss_constante)}`],
    ["Log-loss du test, modèle / constante", `${dec(e1.metriques.logistique["log-loss"])} / ${dec(e1.metriques[C1]["log-loss"])}`, `${dec(V2_INFO.ll)} / ${dec(V2_INFO.llConst)}`],
    ["Écart de log-loss ± erreur type", `${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}`, `${dec(V2_INFO.ecart.moyenne, 3)} ± ${dec(V2_INFO.ecart.erreur_type, 3)}`],
    ["Règle du modèle, en euros", pct(CHIFFRES.regle, 1, true), pct(V2_INFO.regle, 1, true)],
    ["Acheter et garder, couvert", pct(CHIFFRES.couvert, 1, true), pct(V2_INFO.couvert, 1, true)],
    ["Actions : acheter · neutre · vendre", `${e1.actions.acheter} · ${e1.actions.neutre} · ${e1.actions.vendre}`, `${V2_INFO.actions.acheter ?? 0} · ${V2_INFO.actions.neutre ?? 0} · ${V2_INFO.actions.vendre ?? 0}`],
  ];
  return `<div class="tableau-defile"><table><thead><tr><th>Sur le test 2024-2026</th><th>Première version (figée)</th><th>Seconde version (après coup)</th></tr></thead><tbody>
    ${lignes.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">La première version est la seule évaluée à l'aveugle : sa décision a été commitée avant d'ouvrir le test. La seconde a été réglée et choisie par la même règle, mais après avoir vu ce test : son résultat sur 2024-2026 n'a pas valeur de preuve.</p>`;
}

// ---------- VII. les leviers d'amélioration, protocole figé, jugés sur 2010-2023 ----------
function tableAmeliorations() {
  if (!V3_INFO) return "";
  const v3 = D.v3, J = V3_INFO.J, oui = '<span class="ok">oui</span>', non = '<span class="non">non</span>';
  const sp = (m) => `${m["2010-2016"] ? "✓" : "✗"} · ${m["2017-2023"] ? "✓" : "✗"}`;
  const probas = Object.entries(v3.probabilites[J]).map(([v, b]) => {
    const t = v3.tests_probabilites[v];
    return `<tr><td>${esc(v)}</td><td>${dec(b.log_loss, 4)}</td><td>${t ? `${dec(b.ecart_vs_constante, 4)} ± ${dec(b.erreur_type, 4)}` : "référence"}</td>
      <td>${dec(b.auc, 2)}</td><td>${t ? dec(t.p_holm, 2) : ""}</td><td>${t ? sp(t.mieux_sur) : ""}</td><td>${t ? (t.retenue ? oui : non) : ""}</td></tr>`;
  }).join("");
  const leviers = Object.entries(v3.euros[J]).filter(([s]) => s !== "assemblage final").map(([s, b]) => {
    const t = v3.tests_euros[s];
    return `<tr><td>${esc(s)}</td><td>${dec(b.sharpe, 2)}</td><td>${pct(b.perte_maximale, 1, true)}</td><td>${pct(b.cumul, 0, true)}</td>
      <td>${t ? dec(t.p_holm, 2) : "référence"}</td><td>${t ? sp(t.mieux_sur) : ""}</td><td>${t ? (t.retenu ? oui : non) : ""}</td></tr>`;
  }).join("");
  const a = v3.assemblage_final, mp = v3.mois_prochain;
  return `<p class="sous">Protocole écrit et figé le ${esc(V3_INFO.fige.slice(0, 10))} avant tout calcul (empreinte SHA-256 ${esc(V3_INFO.sha.slice(0, 12))}…). Chaque variante est réapprise chaque mois sur le passé connu depuis 1999 ; réglages fixés d'avance ; une variante n'est retenue que si elle bat la référence après correction de Holm et sur les deux sous-périodes. 2024-2026, déjà vu, n'a servi à rien choisir.</p>
    <div class="tableau-defile"><table class="leviers"><thead><tr><th>Probabilité de baisse, ${V3_INFO.mois} mois</th><th>Log-loss</th><th>Écart à la constante</th><th>AUC</th><th>p (Holm)</th><th>Mieux 2010-16 · 2017-23</th><th>Retenue</th></tr></thead><tbody>${probas}</tbody></table></div>
    <div class="tableau-defile"><table class="leviers"><thead><tr><th>En euros, 2010-2023</th><th>Sharpe</th><th>Perte maximale</th><th>Cumul</th><th>p (Holm)</th><th>Mieux 2010-16 · 2017-23</th><th>Retenu</th></tr></thead><tbody>${leviers}</tbody></table></div>
    <p class="note">Avec la probabilité constante, la règle du projet reste neutre ${V3_INFO.neutreConstante} mois sur ${V3_INFO.mois} : sa marge de 0,5 % par mois dépasse le gain espéré appris sur le passé. Couvrir le yen à moitié ramène la perte maximale de ${pct(V3_INFO.ref.perte_maximale, 1, true)} à ${pct(V3_INFO.moitie.perte_maximale, 1, true)}, sans gain net de Sharpe. Assemblage final : ${a.probabilite === "constante" && !a.dosage_par_la_volatilite && !a.regle_de_decision ? "la référence, probabilité constante et achat couvert" : esc(JSON.stringify(a))} ; pour ${moisLong(mp.mois_prevu)}, il ${mp.assemblage.sens === "acheter" ? "achète" : mp.assemblage.sens}, couvert à ${pct(mp.assemblage.part_couverte, 0)}.</p>`;
}

// ---------- assemblage ----------
const tuiles = (chiffres) => `<dl class="tuiles">${chiffres.map(([v, l]) => `<div><dt>${v}</dt><dd>${l}</dd></div>`).join("")}</dl>`;
const figure = (titre, sous, id) => `<figure class="figure" id="${id}"><h3>${titre}</h3>${sous ? `<p class="sous">${sous}</p>` : ""}</figure>`;

const FIG_MATHS = {
  "m-modele": ["La sigmoïde, et les mois qu'elle doit séparer", "Chaque point est un mois d'entraînement, placé au score que le modèle lui donne. En haut, les mois qui ont baissé ; en bas, ceux qui ont monté. Même sur les mois qu'il a appris, les deux groupes se superposent : le score les sépare à peine.", "fig-sigmoide", figSigmoide],
  "m-cout": ["Ce que coûte une erreur assurée", "La perte d'un mois selon la probabilité annoncée. Elle reste modérée quand le modèle hésite, et explose quand il se trompe avec assurance. Les points sont les mois d'entraînement, à la perte que le modèle y paie.", "fig-pertes", figPertes],
  "m-gradient": ["Le champ des gradients", "En chaque point de la surface, la flèche montre −∇J : la direction dans laquelle le coût baisse le plus vite. Toutes convergent vers le minimum.", "fig-pentes", figPentes],
  "m-prior": ["Le prior, et les poids qu'il a laissés passer", "La densité a priori d'un poids standardisé, et les douze poids appris par le modèle final. Aucun ne sort de la zone qui contient 95 % de la masse du prior.", "fig-prior", figPrior],
  "m-convexite": ["Une seule vallée", "La log-loss pénalisée sur deux coefficients, l'intercept fixé à son optimum. Depuis le départ, la descente rejoint le seul minimum.", "fig-convexite", (b) => figSurface(b, ["classique (1/L)"])],
  "m-descente": ["Quatre pas, quatre destins", "La même surface, le même départ, quatre tailles de pas.", "fig-surface", (b) => figSurface(b)],
  "m-moindres": ["La meilleure droite, et ce qu'elle vaut hors échantillon", "Chaque point est un mois, placé à son rendement prévu par les équations normales et à son rendement réel. Sur la diagonale, la prévision est exacte.", "fig-moindres", figMoindres],
};
const FIG_ML = {
  "fig-nikkei": figNikkei, "fig-rendements": figRendements, "fig-essais": figEssais, "fig-regle": figRegle, "fig-euros": (b) => figEuros(b),
  "fig-volatilite": figVolatilite, "fig-contributions": figContributions, "fig-explorateur": figExplorateur,
  "fig-euros-v2": (b) => figEuros(b, D.v2.evaluation_test.historique_test),
};

const pieces = (s) => {
  const l = liensPieces(s);
  return l ? `<div class="pieces-chapitre"><h3 class="sur-titre">Dans le cabinet</h3>${l}</div>` : "";
};
const blocFigures = (s) => {
  const p = FIG_CHAPITRE[s.id] ? planches(FIG_CHAPITRE[s.id], s.id) : "";
  return p ? `<div class="figures-chapitre"><h3 class="sur-titre">Figures des notebooks</h3>${p}</div>` : "";
};

function galerie() {
  return D.notebooks.map((nb) => {
    const noms = Object.keys(FIGURES).filter((f) => FIGURES[f][2] === nb.nom);
    if (!noms.some(existe)) return "";
    return `<section class="galerie-groupe"><h4><span class="sur-titre">${nomNotebook(nb.nom)}</span> ${nb.titre}</h4>${planches(noms, `galerie-${nb.nom}`)}</section>`;
  }).join("");
}

function corps(s) {
  const part = [];
  if (s.id === "cabinet") {
    part.push(`<p class="clair">${s.clair}</p>`);
    part.push(`<div class="pieces">${D.notebooks.map((n) => `<button type="button" class="piece" data-nb="${n.nom}"><span class="sur-titre">${nomNotebook(n.nom)}</span><strong>${n.titre}</strong><span>Ouvrir ${FLECHE}</span></button>`).join("")}
      <a class="piece" href="docs/rapport.pdf" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><strong>Le rapport Applied ML</strong><span>Ouvrir ${FLECHE}</span></a>
      <a class="piece" href="docs/annexe_maths.pdf" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><strong>L'annexe de mathématiques</strong><span>Ouvrir ${FLECHE}</span></a></div>`);
    part.push(`<div class="technique"><span class="sur-titre">En termes techniques</span><p>${s.technique}</p></div>`);
    part.push(`<div class="figures-chapitre"><h3 class="sur-titre">Toutes les figures, notebook par notebook</h3>${galerie()}</div>`);
    return part.join("");
  }
  part.push(arrivee(s), `<p class="clair">${s.clair}</p>`, tuiles(s.chiffres));
  if (FIG_MATHS[s.id]) { const [t, sous, id] = FIG_MATHS[s.id]; part.push(figure(t, sous, id)); }
  if (s.id === "dataset") {
    const ds = D.dataset ?? {}, cb = D.v2?.controle_bloomberg ?? {};
    const sources = Object.entries(ds.sources ?? {}).sort((a, b) => b[1] - a[1]);
    part.push(`<figure class="figure"><h3>Une décision, deux dates</h3><p class="sous">Toutes les variables d'une ligne sont connues à la clôture de Tokyo, le dernier jour du mois. La cible ne l'est qu'un mois plus tard.</p>
      <div class="chrono"><div><h4>Fin du mois t</h4><p>Prix et volatilité du Nikkei, courbe des taux japonais, dernier Tankan publié, portage et volatilité de l'euro-yen, incertitude, news jusqu'à 6 h 30 UTC.</p></div>
      <div class="pivot">la règle décide${FLECHE}</div>
      <div><h4>Fin du mois t + 1</h4><p>On mesure le rendement du Nikkei, en yens pour la cible, en euros couverts ou non pour le gain de l'investisseur.</p></div></div></figure>`);
    if (sources.length) part.push(`<figure class="figure"><h3>D'où viennent les ${nombre(ds.colonnes)} colonnes</h3><p class="sous">Colonnes de la table mensuelle, par source. Chaque colonne porte, dans le dictionnaire des variables, le délai après lequel elle était réellement connue.</p>
      <ul class="barres-sources">${sources.map(([nom, n]) => `<li><span>${esc(nom)}</span><i style="--n:${n / sources[0][1]}"></i><b>${n}</b></li>`).join("")}</ul></figure>`);
    if (cb.tankan) part.push(`<figure class="figure"><h3>Bloomberg en référence</h3><p class="sous">Les séries exportées de Bloomberg servent à contrôler la table, une fois chacune remise à sa date de publication.</p>
      <div class="tableau-defile"><table><thead><tr><th>Série</th><th>Contrôle</th><th>Décision</th></tr></thead><tbody>
      <tr><td>Tankan des grandes industries</td><td>${cb.tankan.valeurs_identiques} trimestres identiques sur ${cb.tankan.trimestres_compares}, une fois décalés au mois de publication ; à sa date Bloomberg, ${cb.tankan.erreur_si_date_bloomberg_prise_telle_quelle}</td><td>gardé, avec son décalage</td></tr>
      <tr><td>Inflation (IPC, sur un an)</td><td>même série une fois décalée d'un mois, sa publication : corrélation ${dec(cb.ipc.correlations.decalage_1, 3)}, écart moyen ${dec(cb.ipc.ecart_moyen_points ?? 0, 2)} point, au plus ${dec(cb.ipc.ecart_max_points ?? 0, 2)} (la table la recalcule à partir de l'indice)</td><td>en référence ; pas une variable du modèle</td></tr>
      <tr><td>VIX</td><td>exporté « en euros » : ${dec(cb.vix.ratio_median_bloomberg_sur_vix, 2)} fois le VIX en médiane, de ${dec(cb.vix.ratio_min, 2)} à ${dec(cb.vix.ratio_max, 2)}</td><td>non utilisé : à réexporter sans conversion</td></tr>
      <tr><td>Calendrier des publications</td><td>${nombre(cb.calendrier.lignes)} lignes, ${cb.calendrier.couvre}</td><td>tronqué à 5 000 lignes : à réexporter par périodes</td></tr>
      </tbody></table></div></figure>`);
  }
  if (s.id === "exploration") {
    part.push(figure(`${Math.round(SERIE.length / 12)} ans de Nikkei, coupés dans l'ordre du temps`, "Clôture mensuelle de l'indice, en points. Le modèle apprend sur l'entraînement, se règle sur la validation, et n'a vu le test qu'une fois.", "fig-nikkei"));
    part.push(figure(`${nombre(SERIE.length - 1)} rendements mensuels`, "Chaque barre est un mois. La prévision constante annonce la fréquence des baisses de l'entraînement, la référence que tout modèle doit battre.", "fig-rendements"));
  }
  if (s.id === "apprentissage") part.push(figure(`${CHIFFRES.essais} essais, trois modèles`, "Log-loss en validation croisée de chaque essai Optuna (plus bas, c'est mieux). Le LightGBM retenu paraît le meilleur ici ; sur le test, il fera pire que la logistique : le meilleur de cinquante essais est toujours flatteur.", "fig-essais"));
  if (s.id === "regle") part.push(figure("Chaque mois, une probabilité et une action", "Probabilité de hausse annoncée pour chaque mois de validation et de test, et ce qui s'est passé ensuite. Les points d'une même couleur se mélangent : c'est le signe d'un modèle qui ne sépare pas les hausses des baisses.", "fig-regle"));
  if (s.id === "epreuve") {
    part.push(figure("Ce que chaque façon de faire aurait rapporté", `Gain cumulé en euros, de janvier 2024 à septembre 2026. La règle du modèle est restée neutre ${D.evaluation.actions.neutre} mois, a vendu ${D.evaluation.actions.vendre} mois et acheté ${D.evaluation.actions.acheter} mois.`, "fig-euros"));
    part.push(`<figure class="figure"><h3>Le modèle face à la constante</h3><p class="sous">Écart de log-loss mois par mois, modèle moins constante : ${dec(ECART_TEST.moyenne, 3)} en moyenne, pour une erreur type de ${dec(ECART_TEST.erreurType, 3)}. Un écart d'une erreur type ne tranche dans aucun sens.</p>${tableMetriques()}</figure>`);
    part.push(`<figure class="figure"><h3>En euros</h3>${tablePerf()}</figure>`);
    const sig = D.signal;
    part.push(`<figure class="figure"><h3>Et pour ${moisLong(moisSuivant(sig.mois_des_donnees))} ?</h3><p class="sous">Avec les données de fin ${moisLong(sig.mois_des_donnees)}, le modèle annonce ${pct(sig.p_hausse, 1)} de chances de hausse : sa règle vendrait. Comme il n'a pas battu la constante, la recommandation du projet reste : ${sig.recommandation_finale.split("(")[0].trim()}.</p></figure>`);
  }
  if (s.id === "explication") part.push(figure("Comprendre chaque décision du test", "Choisissez un mois : la probabilité annoncée, l'action de la règle, ce qui s'est passé, et les variables qui ont fait la prédiction. La seconde version, réentraînée après coup sur 1999-2026, s'explique avec les valeurs SHAP de son LightGBM.", "fig-explorateur"));
  if (s.id === "apres") {
    part.push(`<p><span class="apres-coup">Exploration après coup</span></p>`);
    if (V2_INFO) {
      part.push(`<figure class="figure"><h3>La même méthode, sur 1999-2026</h3><p class="sous">Mêmes variables, même pipeline, même règle de choix du modèle et même découpage final ; seule l'histoire d'entraînement s'allonge, avec Bloomberg en référence.</p>${tableVersions()}</figure>`);
      part.push(figure("La seconde version, en euros", `Gain cumulé de janvier 2024 à septembre 2026 avec la règle de la seconde version (${V2_INFO.modele}).`, "fig-euros-v2"));
    }
    if (V3_INFO) part.push(`<figure class="figure"><h3>Améliorer sans surapprendre : ${V3_INFO.retenus} levier${V3_INFO.retenus > 1 ? "s" : ""} retenu${V3_INFO.retenus > 1 ? "s" : ""} sur ${V3_INFO.tests}</h3>${tableAmeliorations()}</figure>`);
    part.push(figure("L'agitation se lit un peu à l'avance", "Volatilité annualisée du Nikkei, réalisée chaque mois et prévue à la fin du mois précédent par une régression sur les volatilités passées, le VIX et le rendement.", "fig-volatilite"));
    part.push(`<figure class="figure"><h3>Acheter quand le risque est bas, depuis 2003</h3><p class="sous">Le signal réduit la position quand le risque prévu monte. Il protège en 2008, mais vend après les chutes brutales de 2020 et d'août 2024 et rate le rebond.</p>${tableSignalRisque()}</figure>`);
  }
  part.push(`<div class="technique"><span class="sur-titre">En termes techniques</span><p>${s.technique}</p></div>`);
  part.push(blocFigures(s), pieces(s));
  return part.join("");
}

function page() {
  const info = COURS_INFO[COURS];
  const sections = SALLES.map((s) => `
    <section class="chapitre large" id="${s.id}" style="--accent:${s.ton.mur}" aria-labelledby="titre-${s.id}">
      <div class="chapitre-grille">
        <header class="chapitre-tete">
          <span class="num" aria-hidden="true">${s.num}<span class="sceau">${s.kanji}</span></span>
          <span class="sur-titre">${info.nom} · chapitre ${s.num} · ${s.nom}</span>
          <h2 id="titre-${s.id}">${s.titre}</h2>
          <a class="vers-salle" href="${avecCours(`index.html#${s.id}`)}"><i></i>Visiter la salle ${s.num} ${FLECHE}</a>
        </header>
        <div class="chapitre-corps">${corps(s)}</div>
      </div>
    </section>`).join("");
  $("main").innerHTML = `
    <section class="ouverture large">
      <p class="sur-titre">Parcours ${info.nom} · ${info.cours}</p>
      <h1>${info.h1}</h1>
      <div class="ouverture-bas">
        <p class="devise">${info.devise}</p>
        <div class="verdict">
          <span class="sur-titre">${COURS === "maths" ? "Ce qu'il faut retenir" : "Le résultat, en une phrase"}</span>
          <p>${info.verdict}</p>
          <div class="liens-ouverture"><a href="#${SALLES[0].id}">Commencer la lecture ${FLECHE}</a><a href="${avecCours("index.html")}">Faire la visite en 3D ${FLECHE}</a><a href="${avecCours("lecture.html", COURS === "maths" ? "ml" : "maths")}">Parcours ${COURS_INFO[COURS === "maths" ? "ml" : "maths"].nom} ${FLECHE}</a></div>
        </div>
      </div>
    </section>
    <nav class="sommaire large" aria-label="Sommaire"><ol>${SALLES.map((s) => `<li><a href="#${s.id}"><span class="n">${s.num}</span><span class="t">${s.nom}<small>${s.titre}</small></span>${FLECHE}</a></li>`).join("")}
      <li><a href="#limites"><span class="n">—</span><span class="t">Les limites<small>Ce qu'il faut garder en tête</small></span>${FLECHE}</a></li></ol></nav>
    ${sections}
    <section class="chapitre large limites" id="limites" style="--accent:#8a8379">
      <div class="chapitre-grille">
        <header class="chapitre-tete"><span class="sur-titre">Pour finir</span><h2>Les limites</h2></header>
        <div class="chapitre-corps"><ol>${LIMITES.map(([t, d]) => `<li><div><b>${t}</b><span>${d}</span></div></li>`).join("")}</ol></div>
      </div>
    </section>
    <footer class="pied large"><span>${ENTREE.ecole}</span><span>Données : FRED, Banque du Japon, ministère des Finances japonais, BCE, Yahoo Finance, GDELT. <a href="${avecCours("cabinet.html")}">Notebooks</a> · ${(D.telechargements?.archives ?? []).map((a) => `<a href="${a.href}" download="${a.fichier}">${a.titre.toLowerCase().replace(/^./, (c) => c.toUpperCase())} (.zip)</a>`).join(" · ")} · <a href="docs/rapport.pdf">Rapport</a> · <a href="docs/annexe_maths.pdf">Annexe</a></span></footer>`;

  for (const [id, f] of Object.entries(FIG_ML)) { const e = document.getElementById(id); if (e) f(e); }
  for (const [, , id, f] of Object.values(FIG_MATHS)) { const e = document.getElementById(id); if (e) f(e); }
}

// ---------- la visionneuse des figures : grande image, légende, figure précédente et suivante ----------
function visionneuse() {
  const boite = $("#boite");
  boite.innerHTML = `<div class="boite-barre"><span class="boite-compte"></span><button type="button" class="boite-fermer">Fermer</button></div>
    <button type="button" class="boite-nav" data-sens="-1" aria-label="Figure précédente">${FLECHE_G}</button>
    <figure class="boite-figure"><div class="boite-papier"><img alt=""></div>
      <figcaption><span class="sur-titre"></span><strong></strong><span class="boite-texte"></span><button type="button" class="boite-nb" data-nb="">Ouvrir le notebook ${FLECHE}</button></figcaption></figure>
    <button type="button" class="boite-nav" data-sens="1" aria-label="Figure suivante">${FLECHE}</button>`;
  const img = boite.querySelector("img");
  let liste = [], i = 0, retour = null;
  const montrer = () => {
    const n = liste[i], [titre, texte, nb] = FIGURES[n] ?? [n, "", ""];
    img.src = `figures/${n}.png`; img.alt = titre;
    boite.querySelector("figcaption .sur-titre").textContent = nb ? `${nomNotebook(nb)} · ${titreNotebook(nb)}` : "";
    boite.querySelector("figcaption strong").textContent = titre;
    boite.querySelector(".boite-texte").textContent = texte;
    const lien = boite.querySelector(".boite-nb");
    lien.dataset.nb = nb; lien.hidden = !nb;
    boite.querySelector(".boite-compte").textContent = liste.length > 1 ? `${i + 1} / ${liste.length}` : "";
    boite.querySelectorAll(".boite-nav").forEach((b) => (b.hidden = liste.length < 2));
  };
  const aller = (sens) => { i = (i + sens + liste.length) % liste.length; montrer(); };
  const fermer = () => { boite.hidden = true; document.body.classList.remove("boite-ouverte"); retour?.focus(); };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-fig]");
    if (!b) return;
    retour = b;
    const groupe = b.closest("[data-groupe]");
    liste = groupe ? [...groupe.querySelectorAll("[data-fig]")].map((x) => x.dataset.fig) : [b.dataset.fig];
    i = Math.max(0, liste.indexOf(b.dataset.fig));
    montrer();
    boite.hidden = false;
    document.body.classList.add("boite-ouverte");
    boite.querySelector(".boite-fermer").focus();
  });
  boite.querySelector(".boite-fermer").addEventListener("click", fermer);
  boite.querySelectorAll(".boite-nav").forEach((b) => b.addEventListener("click", () => aller(+b.dataset.sens)));
  boite.addEventListener("click", (e) => { if (e.target === boite) fermer(); });
  document.addEventListener("keydown", (e) => {
    if (boite.hidden || liseuse.estOuverte()) return;
    if (e.key === "Escape") fermer();
    else if (e.key === "ArrowRight") aller(1);
    else if (e.key === "ArrowLeft") aller(-1);
  });
}

// ---------- en-tête et lien vers la salle en cours de lecture ----------
function suivre() {
  const entete = $("#entete"), vers = $("#vers-visite");
  addEventListener("scroll", () => entete.classList.toggle("colle", scrollY > 40), { passive: true });
  const io = new IntersectionObserver((entrees) => {
    for (const e of entrees) if (e.isIntersecting && SALLES.some((s) => s.id === e.target.id)) vers.href = avecCours(`index.html#${e.target.id}`);
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll(".chapitre").forEach((c) => io.observe(c));
}

installerEntete("lecture");
const liseuse = installerLiseuse();
page();
visionneuse();
suivre();
installerMenu({ page: "lecture" });
// les graphiques changent la hauteur de la page en se dessinant : on rejoint l'ancre une fois la mise en page posée
if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 250);
