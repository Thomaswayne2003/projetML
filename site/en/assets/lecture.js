// English version of site/assets/lecture.js: seven chapters, the same as the rooms of the tour, with charts, tables and
// figures. Two paths: Applied ML (the project) and Maths (the appendix), depending on the course chosen at the top.
// The shared data file holds French labels (models, strategies, sources, levers…): tr() translates them for display.
import { D, SALLES, ENTREE, LIMITES, CHIFFRES, ECART_TEST, MATHS, COURS, COURS_INFO, FIGURES, V2_INFO, V3_INFO, avecCours, nomNotebook, nombre, pct, dec, moisLong, moisSuivant, RACINE, VARIABLES_EN, titreNb } from "./contenu.js";
import { installerMenu, installerEntete, installerLiseuse, liensPieces, titreNotebook, arrivee, FLECHE, FLECHE_G } from "./commun.js";

const $ = (s, r = document) => r.querySelector(s);
const css = getComputedStyle(document.documentElement);
const C = Object.fromEntries(["pin", "argile", "ocre", "ardoise", "encre", "encre-2", "encre-3", "filet", "papier", "carte"].map((k) => [k, css.getPropertyValue(`--${k}`).trim()]));
const Maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const TR = {
  // blocks and actions
  "entraînement": "training", "validation": "validation", "test": "test", "à prédire": "to predict",
  "acheter": "buy", "neutre": "neutral", "vendre": "sell",
  // models
  "logistique": "logistic", "constante (fréquence de l'entraînement)": "constant (training frequency)", "constante": "constant",
  // strategies in euros
  "règle du modèle": "model's rule", "toujours acheter, couvert": "always buy, hedged", "toujours acheter, non couvert": "always buy, unhedged",
  "toujours neutre (cash)": "always neutral (cash)", "même exposition moyenne (-18%), sans timing": "same average exposure (−18%), no timing",
  // data sources
  "Ministère des Finances": "Ministry of Finance", "Banque du Japon": "Bank of Japan", "BCE et Bundesbank": "ECB and Bundesbank", "OCDE": "OECD",
  "Inflation (OCDE, e-Stat)": "Inflation (OECD, e-Stat)", "Incertitude et géopolitique": "Uncertainty and geopolitics",
  "Calendrier et dérivées": "Calendar and derived", "Facteurs Fama-French": "Fama-French factors", "Volatilité implicite (Nikkei VI)": "Implied volatility (Nikkei VI)",
  // improvement levers (probabilities and euros)
  "logistique du projet": "the project's logistic", "logistique très pénalisée": "heavily penalised logistic",
  "logistique du projet, mélangée à la constante": "the project's logistic, blended with the constant", "logistique économique": "economic logistic",
  "logistique économique, mélangée à la constante": "economic logistic, blended with the constant", "ridge sur le rendement": "ridge on the return",
  "achat couvert, toujours": "buy hedged, always", "achat non couvert": "buy unhedged", "couverture à moitié": "half hedged",
  "couvert seulement si le carry est positif": "hedged only if the carry is positive", "achat couvert, dosé par la volatilité": "buy hedged, sized by volatility",
  "règle : constante": "rule: constant", "règle : logistique du projet": "rule: the project's logistic", "règle : logistique très pénalisée": "rule: heavily penalised logistic",
  "règle : logistique du projet, mélangée à la constante": "rule: the project's logistic, blended with the constant", "règle : logistique économique": "rule: economic logistic",
  "règle : logistique économique, mélangée à la constante": "rule: economic logistic, blended with the constant", "règle : ridge sur le rendement": "rule: ridge on the return",
  // French feature labels (second version's SHAP values, surface axes)
  "volume anormal d'articles": "abnormal article volume", "tonalité des news": "news tone", "news disponibles": "news available",
  "momentum 12 mois": "12-month momentum", "momentum 3 mois": "3-month momentum", "volatilité lissée": "smoothed volatility",
  "variation du taux à 10 ans": "change in the 10-year yield", "portage à un mois": "one-month carry", "volatilité de l'euro-yen": "euro-yen volatility",
  "distance au régime calme": "distance to the calm regime", "distance au régime agité": "distance to the turbulent regime",
  "distance au régime 1": "distance to regime 1", "distance au régime 2": "distance to regime 2",
};
const tr = (t) => TR[t] ?? t;
const libelle = (k) => VARIABLES_EN[D.modele.variables[k]] ?? tr(D.modele.libelles[k]);   // English label of the k-th model feature

// ---------- notebook figures: plates with title, caption and source notebook ----------
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
      <button type="button" class="planche-image" data-fig="${n}" aria-label="Enlarge: ${titre}"><img src="${RACINE}figures/${n}.png" alt="${titre}" loading="lazy"><span class="loupe" aria-hidden="true">Enlarge</span></button>
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

// ---------- I. the Nikkei ----------
const SERIE = D.v2?.serie ?? D.serie;   // 1999-2026 table (second version) if present
function figNikkei(boite) {
  const s = SERIE, mois = s.map((m) => m.mois), v = s.map((m) => m.cloture);
  graphe(boite, (l) => {
    const h = Math.round(Math.min(380, l * 0.52)), g = 54, d = 16, hh = 26, b = 30;
    const x = echelle(0, s.length - 1, g, l - d), ticks = graduations(0, Math.max(...v), 4), y = echelle(0, Math.max(ticks[ticks.length - 1], Math.max(...v) * 1.03), h - b, hh);
    const iv = s.findIndex((m) => m.bloc === "validation"), it = s.findIndex((m) => m.bloc === "test"), ip = s.findIndex((m) => m.bloc === "à prédire");
    const bande = (i0, i1, op, nom, fin) => `<rect x="${x(i0)}" y="${hh - 14}" width="${x(i1) - x(i0)}" height="${h - b - hh + 14}" fill="${C.encre}" opacity="${op}"/><text class="etiquette" x="${fin ? x(i1) - 4 : x(i0) + 4}" y="${hh - 2}" text-anchor="${fin ? "end" : "start"}">${nom}</text>`;
    const chemin = v.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c).toFixed(1)}`).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Monthly close of the Nikkei 225 from ${s[0].mois.slice(0, 4)} to 2026, with the training, validation and test periods">
      ${axeY(y, ticks, g, l - d, (t) => nombre(t))}
      ${bande(iv, it, 0.035, "Validation", true)}${bande(it, ip, 0.075, "Test")}
      <text class="etiquette" x="${g + 6}" y="${hh - 2}">Training</text>
      <path d="${chemin}" fill="none" stroke="${C.encre}" stroke-width="2" stroke-linejoin="round"/>
      ${axeAnnees(mois, x, h - b)}
      <circle class="marque-survol" r="4.5" fill="${C.encre}" stroke="${C.carte}" stroke-width="2" opacity="0"/>
    </svg>`;
    return { svg, survol: (px) => {
      const i = Math.round(x.inv(px)); if (i < 0 || i >= s.length) return null;
      return { x: x(i), y: y(v[i]), marque: { cx: x(i), cy: y(v[i]) }, html: `<b>${Maj(moisLong(mois[i]))}</b>${nombre(v[i])} points · ${tr(s[i].bloc)}` };
    } };
  });
}

// ---------- II. monthly returns ----------
function figRendements(boite) {
  const s = SERIE, r = s.slice(1).map((m, i) => ({ mois: m.mois, r: m.cloture / s[i].cloture - 1 }));
  boite.insertAdjacentHTML("beforeend", legende([["Rising month", C.pin, "bloc"], ["Falling month", C.argile, "bloc"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(300, l * 0.42)), g = 46, d = 10, hh = 12, b = 30;
    const m = Math.max(...r.map((e) => Math.abs(e.r)));
    const x = echelle(0, r.length, g, l - d), y = echelle(-m, m, h - b, hh), w = (l - g - d) / r.length;
    const ticks = graduations(-m, m, 4);
    const barres = r.map((e, i) => { const y0 = y(0), y1 = y(e.r); return `<rect x="${(x(i) + 0.5).toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${Math.max(w - 1, 1).toFixed(1)}" height="${Math.max(Math.abs(y1 - y0), 0.8).toFixed(1)}" rx="${w > 4 ? 1 : 0}" fill="${e.r >= 0 ? C.pin : C.argile}"/>`; }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Monthly return of the Nikkei, month by month, from ${s[0].mois.slice(0, 4)} to 2026">
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

// ---------- III. the Optuna trials ----------
function figEssais(boite) {
  const noms = { logit: "Logistic", rf: "Random forest", lgbm: "LightGBM" };
  const essais = D.essais.filter((e) => e.cible === "nikkei");
  const MAX = 0.95;
  boite.insertAdjacentHTML("beforeend", legende([["One trial", C["encre-2"], "rond"], ["Selected trial", C.argile, "rond"]]));
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
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Cross-validation log-loss of the ${essais.length} Optuna trials, by model">
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
      return { x: px, y: hh + ligne * j + 8, html: `<b>${noms[k]}</b>${proches.length} trial${proches.length > 1 ? "s" : ""} near ${dec(Math.min(x.inv(px), MAX), 3)}<br>best: ${dec(meilleur.logloss)} (trial ${meilleur.essai})` };
    } };
  });
}

// ---------- III. the cost surface and gradient descent: four panels, one per step size ----------
let surfaces = 0;
function figSurface(boite, cles = null) {
  const S = D.surface, ax = S.axe, n = ax.length, lim = ax[n - 1];
  const idFond = `fond-surface-${++surfaces}`;   // one id per figure: two figures can coexist
  const traj = [
    ["trop petit", "Step too small", "does not reach the minimum in 60 steps"],
    ["classique (1/L)", "Standard step, 1/L", "converges in a few steps"],
    ["près de la limite", "Near the 2/L limit", "oscillates, then converges"],
    ["au-delà de la limite", "Beyond 2/L", "oscillates more and more: diverges"],
  ].filter(([k]) => !cles || cles.includes(k));
  const plat = S.cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const teinte = (c) => {   // a single hue, from paper (low cost) to earth (high cost)
    const t = Math.pow((c - cmin) / (cmax - cmin), 0.5), a = [248, 245, 239], b = [158, 133, 110];
    return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
  };
  boite.insertAdjacentHTML("beforeend", legende([["Low cost", "rgb(248,245,239)", "bloc"], ["High cost", "rgb(158,133,110)", "bloc"], ["Start", C.carte, "rond"], ["Descent step", C.encre, "rond"]]));
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
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Four gradient descents on the same penalised log-loss surface, with different step sizes">
      <defs><g id="${idFond}">${fond}</g></defs>${panneaux}</svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Horizontal axis: coefficient of ${esc(tr(S.variables[0]))}; vertical axis: coefficient of ${esc(tr(S.variables[1]))}, from ${dec(-lim, 1)} to ${dec(lim, 1)}. The cross marks the minimum. λ = ${dec(S.lambda, 3)} and L = ${dec(S.L, 3)}: descent converges as long as the step stays below 2/L ≈ ${dec(2 / S.L, 2)}.</figcaption>`);
}

// ---------- IV. from probability to action ----------
function figRegle(boite) {
  const { theta_a: ta, theta_v: tv } = D.decision.seuils;
  const pc = 1 - D.evaluation.metriques["constante (fréquence de l'entraînement)"]["proba moyenne"];
  const blocs = [["Validation 2022-2023", D.historique_validation], ["Test 2024-2026", D.historique_test]];
  boite.insertAdjacentHTML("beforeend", legende([["The month rose (filled)", C.pin, "rond"], ["The month fell (ringed)", C.argile, "rond anneau"], [`Forecast for ${moisLong(moisSuivant(D.signal.mois_des_donnees))}`, C.encre, "rond anneau"]]));
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
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Probability of a rise stated each validation and test month, with the rule's thresholds">
      ${zone(0.25, tv, C.argile, 0.09, "Sell")}${zone(tv, ta, C.encre, 0.03, "Neutral")}${zone(ta, 0.8, C.pin, 0.09, "Buy")}
      ${[tv, ta].map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="${hh - 10}" y2="${hh + ligne * 2 + 18}" stroke="${C["encre-2"]}" stroke-width="1"/>`).join("")}
      <line x1="${x(pc)}" x2="${x(pc)}" y1="${hh - 4}" y2="${hh + ligne * 2 + 18}" stroke="${C.encre}" stroke-dasharray="4 4"/>
      <text class="etiquette" x="${x(pc) + 6}" y="${hh + ligne * 2 + 14}">constant: ${pct(pc, 1)}</text>
      ${lignes}
      <circle cx="${x(pp)}" cy="${yp}" r="6" fill="${C.carte}" stroke="${C.encre}" stroke-width="2"/>
      <text class="etiquette" x="${x(pp) - 10}" y="${yp + 4}" text-anchor="end">${Maj(moisLong(moisSuivant(D.signal.mois_des_donnees)))}: ${pct(pp, 1)}</text>
      <g class="axe">${[0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map((t) => `<text x="${x(t)}" y="${h - 10}" text-anchor="middle">${pct(t, 0)}</text>`).join("")}
        <text x="${x(tv)}" y="${h - 26}" text-anchor="middle">θ sell ${pct(tv, 1)}</text><text x="${x(ta)}" y="${h - 26}" text-anchor="middle">θ buy ${pct(ta, 1)}</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 12;
      for (const t of tous) { const dd = Math.hypot(t.px - px, t.py - py); if (dd < dmin) { dmin = dd; best = t; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>probability of a rise: ${pct(m.p_hausse, 1)}<br>action: ${tr(m.action)}<br>the month ${m.hausse_realisee ? "rose" : "fell"}` };
    } };
  });
}

// ---------- V. euros on the test ----------
function figEuros(boite, h = D.historique_test) {
  const series = [
    ["Buy and hold, hedged", C.pin, "rendement_achat_couvert", "hedged"],
    ["Buy and hold, unhedged", C.ocre, "rendement_achat_non_couvert", "unhedged"],
    ["Stay neutral (cash)", C.ardoise, "rendement_cash", "cash"],
    ["Model's rule", C.argile, "rendement_regle", "rule"],
  ].map(([nom, c, cle, court]) => { let v = 1; return { nom, c, court, val: [0, ...h.map((m) => (v *= 1 + m[cle]) - 1)] }; });
  const mois = ["2023-12", ...h.map((m) => moisSuivant(m.date))];
  boite.insertAdjacentHTML("beforeend", legende(series.map((s) => [s.nom, s.c])));
  graphe(boite, (l) => {
    const etroit = l < 560, hgt = Math.round(Math.min(380, l * 0.56)), g = 50, d = etroit ? 16 : 150, hh = 14, b = 30;
    const tout = series.flatMap((s) => s.val), ticks = graduations(Math.min(...tout), Math.max(...tout), 5);
    const x = echelle(0, mois.length - 1, g, l - d), y = echelle(Math.min(ticks[0], Math.min(...tout)), Math.max(ticks[ticks.length - 1], Math.max(...tout) * 1.02), hgt - b, hh);
    const fins = ecarter(series.map((s) => y(s.val[s.val.length - 1])), 15);
    const svg = `<svg viewBox="0 0 ${l} ${hgt}" role="img" aria-label="Cumulative gain in euros on the 2024-2026 test for four approaches">
      ${axeY(y, ticks, g, l - d, (t) => pct(t, 0, true))}
      <line x1="${g}" x2="${l - d}" y1="${y(0)}" y2="${y(0)}" stroke="${C["encre-3"]}"/>
      ${series.map((s) => `<path d="${s.val.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("")}" fill="none" stroke="${s.c}" stroke-width="2" stroke-linejoin="round"/>`).join("")}
      ${etroit ? "" : series.map((s, k) => `<text class="etiquette" x="${l - d + 8}" y="${fins[k] + 4}">${pct(s.val[s.val.length - 1], 1, true)} · ${s.court}</text>`).join("")}
      ${axeAnnees(mois.map((m, i) => (i ? m : "2024-00")), x, hgt - b)}
      <line class="marque-survol" y1="${hh}" y2="${hgt - b}" stroke="${C["encre-3"]}" opacity="0"/>
    </svg>`;
    return { svg, survol: (px, py) => {
      const i = Math.round(x.inv(px)); if (i < 0 || i >= mois.length) return null;
      return { x: x(i), y: py, marque: { x1: x(i), x2: x(i) }, html: `<b>End of ${moisLong(mois[i])}</b>${series.map((s) => ligneBulle(s.nom, s.c, pct(s.val[i], 1, true))).join("")}` };
    } };
  });
}
function tableMetriques() {
  const m = D.evaluation.metriques, lignes = Object.keys(m);
  const cols = [["log-loss", "Log-loss", 3], ["Brier", "Brier", 3], ["ECE", "ECE", 3], ["PR-AUC", "PR-AUC", 3], ["proba moyenne", "Mean P(fall)", 3]];
  return `<div class="tableau-defile"><table><thead><tr><th>Model, over the ${D.evaluation.mois_test} test months</th>${cols.map((c) => `<th>${c[1]}</th>`).join("")}</tr></thead><tbody>
    ${lignes.map((k) => `<tr class="${k === "logistique" || k.startsWith("constante") ? "mis-en-avant" : ""}"><td>${k === "logistique" ? "Logistic (selected model)" : Maj(tr(k))}</td>${cols.map(([c, , d]) => `<td>${dec(m[k][c], d)}</td>`).join("")}</tr>`).join("")}
  </tbody></table></div><p class="note">Lower is better, except for PR-AUC. The positive class is a fall: ${D.evaluation.baisses_test} months out of ${D.evaluation.mois_test}, i.e. ${pct(D.evaluation.baisses_test / D.evaluation.mois_test, 1)}.</p>`;
}
function tablePerf() {
  const p = D.evaluation.performance_euros;
  const couleur = { "règle du modèle": C.argile, "toujours acheter, couvert": C.pin, "toujours acheter, non couvert": C.ocre, "toujours neutre (cash)": C.ardoise, "même exposition moyenne (-18%), sans timing": C["encre-3"] };
  return `<div class="tableau-defile"><table><thead><tr><th>Approach, in euros, 2024-2026</th><th>Cumulative</th><th>Per year</th><th>Worst drawdown</th></tr></thead><tbody>
    ${Object.entries(p).map(([k, v]) => `<tr><td><span class="pastille" style="--c:${couleur[k] ?? C["encre-3"]}"></span>${Maj(tr(k))}</td><td>${pct(v.cumul, 1, true)}</td><td>${pct(v["annualisé"], 1, true)}</td><td>${pct(v["perte maximale"], 1)}</td></tr>`).join("")}
  </tbody></table></div><p class="note">“Same average exposure, no timing” permanently holds the rule's average position: it is the benchmark that isolates what timing adds. Price indices, with no dividends or costs.</p>`;
}

// ---------- VI. turbulence ----------
function figVolatilite(boite) {
  const s = D.volatilite.serie;
  const reelle = s.map((m) => m.reelle), prevue = s.map((m) => m.prevue), mois = s.map((m) => moisSuivant(m.mois));
  boite.insertAdjacentHTML("beforeend", legende([["Volatility realised the following month", C.ardoise], ["Volatility forecast at the end of the month", C.argile], ["Turbulent-month threshold, 20%", C["encre-2"], "tirets"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(340, l * 0.5)), g = 46, d = 14, hh = 24, b = 30;
    const vmax = Math.max(...reelle.filter((v) => v != null)), ticks = graduations(0, vmax, 4);
    const x = echelle(0, s.length - 1, g, l - d), y = echelle(0, Math.max(ticks[ticks.length - 1], vmax * 1.03), h - b, hh);
    const it = s.findIndex((m) => m.bloc === "test");
    const trace = (v, c, ep) => `<path d="${v.map((e, i) => (e == null ? "" : `${i && v[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(e).toFixed(1)}`)).join("")}" fill="none" stroke="${c}" stroke-width="${ep}" stroke-linejoin="round"/>`;
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Monthly volatility of the Nikkei, realised and forecast, from 2016 to 2026">
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
      return { x: x(i), y: py, marque: { x1: x(i), x2: x(i) }, html: `<b>${Maj(moisLong(mois[i]))}</b>${ligneBulle("realised", C.ardoise, reelle[i] == null ? "to come" : pct(reelle[i], 1))}${ligneBulle("forecast", C.argile, pct(prevue[i], 1))}` };
    } };
  });
}
function tableSignalRisque() {
  const sr = D.signal_risque, periodes = [["2003-2015 (réglage)", "2003-2015", "tuning"], ["2016-2023", "2016-2023", "out of sample"], ["2024-2026", "2024-2026", "out of sample"]];
  const G = "acheter et garder", S = "signal risque, chaque jour (règle figée)";
  return `<div class="tableau-defile"><table class="groupes"><thead>
    <tr><th rowspan="2">Period</th><th colspan="3" class="groupe">Return per unit of risk</th><th colspan="2" class="groupe">Worst drawdown</th></tr>
    <tr><th>Hold</th><th>Signal</th><th>Gap ± s.e.</th><th>Hold</th><th>Signal</th></tr></thead><tbody>
    ${periodes.map(([p, nom, note]) => { const g = sr.strategies[p][G], si = sr.strategies[p][S], c = sr.comparaisons[p];
      return `<tr${note === "tuning" ? "" : ' class="mis-en-avant"'}><td>${nom}<br><small>${note}</small></td><td>${dec(g.rendement_par_unite_de_risque, 2)}</td><td>${dec(si.rendement_par_unite_de_risque, 2)}</td><td>${dec(c.ecart, 2)} ± ${dec(c.erreur_type, 2)}</td><td>${pct(g["perte_maximale_%"] / 100, 0)}</td><td>${pct(si["perte_maximale_%"] / 100, 0)}</td></tr>`; }).join("")}
  </tbody></table></div><p class="note">“Hold”: buy and hold; “Signal”: the rule frozen using only 2000-2015 data (forecast risk below ${pct(sr.regle.seuils_volatilite_annuelle[0], 0)}, buy fully; above ${pct(sr.regle.seuils_volatilite_annuelle[1], 0)}, do not buy; in between, buy half). The signal stays invested ${pct(sr.strategies["2003-2026 (tout)"][S]["part_investie_moyenne_%"] / 100, 0)} of the time on average: its worst drawdown does not compare directly with that of a full position.</p>`;
}

// ---------- Maths I. the sigmoid and the months it must separate ----------
const logit = (p) => Math.log(p / (1 - p));
const sigma = (u) => 1 / (1 + Math.exp(-u));
// Maths path: the training months, at the score the frozen model gives them (no test months here)
const moisMaths = () => (D.maths?.scores_entrainement ?? []).map(([date, u, baisse]) => ({ date, u, pb: Math.min(1 - 1e-6, Math.max(1e-6, sigma(u))), baisse }));
function figSigmoide(boite) {
  const mois = moisMaths();
  boite.insertAdjacentHTML("beforeend", legende([["σ(u), the probability of a fall", C.encre], ["Month that fell (ringed)", C.argile, "rond anneau"], ["Month that rose (filled)", C.pin, "rond"]]));
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
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="The sigmoid function, and the training months placed at their score">
      ${axeY(y, [0, 0.25, 0.5, 0.75, 1], g, l - d, (t) => pct(t, 0))}
      <rect x="${x(umin)}" y="${hh}" width="${x(umax) - x(umin)}" height="${h - b - hh}" fill="${C.encre}" opacity=".05"/>
      <text class="etiquette" x="${x(umax) + 6}" y="${y(0.5) + 18}">the model's scores</text>
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - b}" stroke="${C.filet}"/>
      <path d="${courbe}" fill="none" stroke="${C.encre}" stroke-width="2"/>
      <circle cx="${x(0)}" cy="${y(0.5)}" r="3.5" fill="${C.encre}"/><text class="etiquette-forte" x="${x(0) - 8}" y="${y(0.5) - 8}" text-anchor="end">σ(0) = 50%</text>
      ${dots}
      <g class="axe">${[-4, -2, 0, 2, 4].map((t) => `<text x="${x(t)}" y="${h - b + 18}" text-anchor="middle">${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">score u = wᵀx + b</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const t of pts) { const dd = Math.hypot(t.px - px, t.py - py); if (dd < dmin) { dmin = dd; best = t; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>score ${dec(m.u, 2)}, i.e. ${pct(m.pb, 1)} chance of a fall<br>the month ${m.baisse ? "fell" : "rose"}` };
    } };
  });
}

// ---------- Maths II. the two branches of the log-loss ----------
function figPertes(boite) {
  const t = moisMaths().map((m) => ({ ...m, p: m.pb, y: m.baisse, perte: m.baisse ? -Math.log(m.pb) : -Math.log(1 - m.pb) }));
  const pc = t.reduce((a, m) => a + m.y, 0) / (t.length || 1), moyenne = MATHS.llEntrainement ?? t.reduce((a, m) => a + m.perte, 0) / (t.length || 1);
  boite.insertAdjacentHTML("beforeend", legende([["Loss if the month falls, −log p", C.argile], ["Loss if the month rises, −log(1 − p)", C.pin], ["A training month", C.encre, "rond"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(360, l * 0.56)), g = 40, d = 16, hh = 14, b = 40;
    const x = echelle(0, 1, g, l - d), y = echelle(0, 3, h - b, hh);
    const trace = (f, c) => `<path d="${[...Array(97).keys()].map((i) => { const p = 0.02 + i * 0.01; return `${i ? "L" : "M"}${x(p).toFixed(1)},${y(Math.min(f(p), 3)).toFixed(1)}`; }).join("")}" fill="none" stroke="${c}" stroke-width="2"/>`;
    const pts = t.map((m) => ({ px: x(m.p), py: y(m.perte), m }));
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="The two branches of the log-loss, and the loss paid on each training month">
      ${axeY(y, [0, 1, 2, 3], g, l - d, (v) => dec(v, 0))}
      ${trace((p) => -Math.log(p), C.argile)}${trace((p) => -Math.log(1 - p), C.pin)}
      <line x1="${g}" x2="${l - d}" y1="${y(moyenne)}" y2="${y(moyenne)}" stroke="${C.encre}" stroke-dasharray="4 4"/>
      <text class="etiquette" x="${l - d}" y="${y(moyenne) - 6}" text-anchor="end">J at the minimum: ${dec(moyenne)}</text>
      <line x1="${x(pc)}" x2="${x(pc)}" y1="${hh}" y2="${h - b}" stroke="${C["encre-3"]}" stroke-dasharray="2 4"/>
      <text class="etiquette" x="${x(pc) + 6}" y="${hh + 12}">frequency of falls: ${pct(pc, 1)}</text>
      ${pts.map((q) => `<circle cx="${q.px.toFixed(1)}" cy="${Math.max(hh, q.py).toFixed(1)}" r="3.4" fill="${q.m.y ? C.argile : C.pin}" stroke="${C.carte}" stroke-width="1.2"/>`).join("")}
      <g class="axe">${[0, 0.25, 0.5, 0.75, 1].map((v) => `<text x="${x(v)}" y="${h - b + 18}" text-anchor="middle">${pct(v, 0)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">stated probability of a fall, p</text></g>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const q of pts) { const dd = Math.hypot(q.px - px, q.py - py); if (dd < dmin) { dmin = dd; best = q; } }
      if (!best) return null;
      const m = best.m;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(m.date)))}</b>p = ${pct(m.p, 1)}, the month ${m.y ? "fell" : "rose"}<br>loss paid: ${dec(m.perte, 3)}` };
    } };
  });
}

// ---------- Maths III. the map of slopes ----------
function figPentes(boite) {
  const S = D.surface, ax = S.axe, n = ax.length, lim = ax[n - 1];
  const plat = S.cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const teinte = (c) => { const t = Math.pow((c - cmin) / (cmax - cmin), 0.5), a = [248, 245, 239], b = [158, 133, 110]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`; };
  const coutEn = (w1, w2) => {
    const fx = Math.min(Math.max(((w1 + lim) / (2 * lim)) * (n - 1), 0), n - 1 - 1e-6), fy = Math.min(Math.max(((w2 + lim) / (2 * lim)) * (n - 1), 0), n - 1 - 1e-6);
    const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
    return S.cout[j][i] * (1 - u) * (1 - v) + S.cout[j][i + 1] * u * (1 - v) + S.cout[j + 1][i] * (1 - u) * v + S.cout[j + 1][i + 1] * u * v;
  };
  boite.insertAdjacentHTML("beforeend", legende([["Low cost", "rgb(248,245,239)", "bloc"], ["High cost", "rgb(158,133,110)", "bloc"], ["−∇J, the direction of steepest descent", C.encre]]));
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
      const long = maille * (0.25 + 0.55 * Math.sqrt(f.nn / gmax)), ux = -f.g1 / f.nn, uy = f.g2 / f.nn;   // −∇J; the screen's vertical axis points down
      const x0 = x(f.w1) - (ux * long) / 2, y0 = y(f.w2) - (uy * long) / 2, x1 = x0 + ux * long, y1 = y0 + uy * long;
      const ang = Math.atan2(uy, ux), a1 = ang + 2.6, a2 = ang - 2.6;
      return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}M${(x1 + 5 * Math.cos(a1)).toFixed(1)},${(y1 + 5 * Math.sin(a1)).toFixed(1)}L${x1.toFixed(1)},${y1.toFixed(1)}L${(x1 + 5 * Math.cos(a2)).toFixed(1)},${(y1 + 5 * Math.sin(a2)).toFixed(1)}" fill="none" stroke="${C.encre}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    }).join("");
    const [w1, w2] = S.optimum, ticks = graduations(-lim, lim, 4);
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="The gradient field on the cost surface: every arrow points down towards the minimum">
      ${fond}${fleches}
      <rect x="${g}" y="${hh}" width="${cote}" height="${cote}" fill="none" stroke="${C.filet}"/>
      <path d="M${x(w1) - 6},${y(w2) - 6}l12,12M${x(w1) + 6},${y(w2) - 6}l-12,12" stroke="${C.argile}" stroke-width="2.4"/>
      <g class="axe">${ticks.map((t) => `<text x="${x(t)}" y="${hh + cote + 16}" text-anchor="middle">${dec(t, 1)}</text><text x="${g - 8}" y="${y(t) + 4}" text-anchor="end">${dec(t, 1)}</text>`).join("")}
        <text x="${g + cote / 2}" y="${hh + cote + 36}" text-anchor="middle">coefficient: ${esc(tr(S.variables[0]))}</text></g>
    </svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Vertical axis: coefficient of ${esc(tr(S.variables[1]))}. Gradients are computed by finite differences on the cost grid; the cross marks the minimum, where ∇J = 0.</figcaption>`);
}

// ---------- Maths IV. the Gaussian prior and the learned weights ----------
function figPrior(boite) {
  setTimeout(() => {   // the list of the twelve weights, below the chart
    const M = D.modele, ordre = M.coefficients.map((c, k) => ({ c, k })).sort((a, z) => Math.abs(z.c) - Math.abs(a.c));
    boite.insertAdjacentHTML("beforeend", `<ol class="poids">${ordre.map(({ c, k }) => `<li><span>${Maj(libelle(k))}</span><b>${c > 0 ? "+" : ""}${dec(c, 3)}</b></li>`).join("")}</ol>`);
  });
  const M = D.modele, tau = MATHS.tau, W = 0.6;
  const dens = (w) => Math.exp(-(w * w) / (2 * tau * tau)) / (tau * Math.sqrt(2 * Math.PI));
  boite.insertAdjacentHTML("beforeend", legende([[`Prior N(0, τ²), τ = ${dec(tau, 2)}`, C.encre], ["± 2τ: 95% of the mass", C["encre-3"], "bloc"], ["Positive weight (pushes towards a fall)", C.encre, "rond"], ["Negative weight", C.argile, "rond anneau"]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(320, l * 0.5)), g = 46, d = 16, hh = 16, b = 30;
    const x = echelle(-W, W, g, l - d), dmax = dens(0), y = echelle(0, dmax * 1.08, h - b, hh);
    const courbe = [...Array(241).keys()].map((i) => { const w = -W + i * 0.005; return `${i ? "L" : "M"}${x(w).toFixed(1)},${y(dens(w)).toFixed(1)}`; }).join("");
    const rug = M.coefficients.map((c, k) => {
      const px = x(c);
      const marque = c >= 0 ? `<circle cx="${px.toFixed(1)}" cy="${h - b + 12}" r="4.2" fill="${C.encre}"/>` : `<circle cx="${px.toFixed(1)}" cy="${h - b + 12}" r="3.6" fill="${C.carte}" stroke="${C.argile}" stroke-width="1.8"/>`;
      return `<line x1="${px.toFixed(1)}" x2="${px.toFixed(1)}" y1="${y(dens(c))}" y2="${h - b + 8}" stroke="${C["encre-3"]}" stroke-width="1"/>${marque}`;
    }).join("");
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="The density of the Gaussian prior, and the twelve weights learned by the final model">
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
      return { x: x(M.coefficients[best]), y: h - b - 10, html: `<b>${Maj(libelle(best))}</b>weight ${dec(M.coefficients[best], 3)}<br>${dec(Math.abs(M.coefficients[best]) / tau, 2)} τ` };
    } };
  });
}

// ---------- Maths VII. what 33 months can prove ----------
function figMoindres(boite) {
  const O = MATHS.ols ?? {}, tr = O.entrainement ?? [], va = O.validation ?? [];
  boite.insertAdjacentHTML("beforeend", legende([[`Training months (R² = ${dec(O.r2_entrainement ?? 0, 2)})`, C.pin, "rond"], [`Validation months (R² = ${dec(O.r2_validation ?? 0, 2)})`, C.argile, "rond"], ["Perfect forecast, r̂ = r", C.encre]]));
  graphe(boite, (l) => {
    const h = Math.round(Math.min(380, l * 0.62)), g = 52, d = 16, hh = 14, b = 40;
    const tous = tr.concat(va).flatMap(([, a, c]) => [a, c]), lim = Math.max(0.1, ...tous.map(Math.abs)) * 1.05;
    const ticks = graduations(-lim, lim, 5);
    const x = echelle(-lim, lim, g, l - d), y = echelle(-lim, lim, h - b, hh);
    const pts = [...tr.map((q) => ({ q, v: false })), ...va.map((q) => ({ q, v: true }))].map((p) => ({ ...p, px: x(p.q[1]), py: y(p.q[2]) }));
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Return predicted by least squares against the actual return, training and validation months">
      ${axeY(y, ticks, g, l - d, (v) => pct(v, 0))}
      <line x1="${x(-lim)}" y1="${y(-lim)}" x2="${x(lim)}" y2="${y(lim)}" stroke="${C.encre}" stroke-width="1.6"/>
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - b}" stroke="${C.filet}"/>
      ${pts.filter((p) => !p.v).map((p) => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="3.4" fill="${C.pin}" fill-opacity=".75" stroke="${C.carte}" stroke-width="1"/>`).join("")}
      ${pts.filter((p) => p.v).map((p) => `<circle cx="${p.px.toFixed(1)}" cy="${p.py.toFixed(1)}" r="4.6" fill="${C.argile}" stroke="${C.carte}" stroke-width="1.3"/>`).join("")}
      <g class="axe">${ticks.map((t) => `<text x="${x(t)}" y="${h - b + 18}" text-anchor="middle">${pct(t, 0)}</text>`).join("")}
        <text x="${(g + l - d) / 2}" y="${h - 4}" text-anchor="middle">return predicted by the normal equations, r̂</text></g>
      <text class="etiquette" x="${g + 6}" y="${hh + 12}">actual return the following month, r</text>
    </svg>`;
    return { svg, survol: (px, py) => {
      let best = null, dmin = 10;
      for (const p of pts) { const dd = Math.hypot(p.px - px, p.py - py); if (dd < dmin) { dmin = dd; best = p; } }
      if (!best) return null;
      const [date, prevu, reel] = best.q;
      return { x: best.px, y: best.py - 6, html: `<b>${Maj(moisLong(moisSuivant(date)))}</b>${best.v ? "validation" : "training"}<br>predicted ${pct(prevu, 1, true)}, actual ${pct(reel, 1, true)}` };
    } };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>On training, the points loosely follow the diagonal (R² = ${dec(O.r2_entrainement ?? 0, 2)}). On validation, they drift away: R² = ${dec(O.r2_validation ?? 0, 2)}, worse than predicting the mean every month.</figcaption>`);
}


// ---------- VI. what drives the latest prediction ----------
function figContributions(boite) {
  const lib = Object.fromEntries((D.modele?.variables ?? []).map((v, i) => [v, libelle(i)]));
  const items = [...(D.explication ?? [])].sort((a, b) => b.contribution - a.contribution).map((e) => ({ ...e, nom: Maj(lib[e.variable] ?? VARIABLES_EN[e.variable] ?? e.variable) }));
  boite.insertAdjacentHTML("beforeend", legende([["Pushes towards a fall", C.argile, "bloc"], ["Pushes towards a rise", C.pin, "bloc"]]));
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
    const svg = `<svg viewBox="0 0 ${l} ${h}" role="img" aria-label="Contribution of each feature to the model's latest prediction">
      <line x1="${x(0)}" x2="${x(0)}" y1="${hh}" y2="${h - 22}" stroke="${C["encre-3"]}"/>
      ${barres}
      <g class="axe"><text x="${x(-m)}" y="${h - 6}">towards a rise</text><text x="${x(m)}" y="${h - 6}" text-anchor="end">towards a fall</text></g>
    </svg>`;
    return { svg, survol: null };
  });
  boite.insertAdjacentHTML("beforeend", `<figcaption>Contribution to the log-odds of a fall: the logistic's weight times the feature's standardised value, for the prediction made with data to the end of ${moisLong(D.signal.mois_des_donnees)}.</figcaption>`);
}


// ---------- VI. understanding each test decision, month by month ----------
function figExplorateur(boite) {
  const lib = Object.fromEntries((D.modele?.variables ?? []).map((v, i) => [v, libelle(i)]));
  const nomVar = (v) => Maj(lib[v] ?? VARIABLES_EN[v] ?? v);
  const v1 = D.explications_test ?? {}, v2 = D.v2?.shap_test?.mois ?? {};
  const hist = { v1: Object.fromEntries(D.historique_test.map((m) => [m.date, m])),
                 v2: Object.fromEntries((D.v2?.evaluation_test?.historique_test ?? []).map((m) => [m.date, m])) };
  const versions = [["v1", "First version · logistic (frozen)"]].concat(Object.keys(v2).length ? [["v2", `Second version · ${D.v2.shap_test.modele} (afterwards)`]] : []);
  const mois = Object.keys(v1);
  let version = "v1", choisi = mois[mois.length - 1];

  const decision = (date) => {
    const h = hist[version][date];
    if (version === "v1") return h ? { p: h.p_hausse, action: h.action } : { p: D.signal.p_hausse, action: D.signal.action_du_modele };
    return { p: v2[date].p_hausse, action: v2[date].action };
  };
  const contributions = (date) => (version === "v1"
    ? [...(v1[date] ?? [])].map((e) => ({ nom: nomVar(e.variable), c: e.contribution }))
    : (v2[date]?.contributions ?? []).map((e) => ({ nom: Maj(tr(e.variable)), c: e.contribution })))
    .sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 9);

  boite.insertAdjacentHTML("beforeend", `<div class="explorateur">
    <div class="versions" role="group" aria-label="Model version">${versions.map(([k, nom]) => `<button type="button" data-version="${k}">${nom}</button>`).join("")}</div>
    <div class="mois-puces" role="group" aria-label="Test months">${mois.map((d) => {
      const h = hist.v1[d], issue = h ? (h.hausse_realisee ? "hausse" : "baisse") : "avenir";
      const [an, m] = moisSuivant(d).split("-");
      const court = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1];
      return `<button type="button" data-mois="${d}" class="${issue}" title="${Maj(moisLong(moisSuivant(d)))}">${court} ${an.slice(2)}</button>`;
    }).join("")}</div>
    <div class="explorateur-corps"><div class="explorateur-resume"></div><div class="explorateur-barres"></div></div>
    <ul class="legende"><li><i class="rond" style="--c:${C.pin}"></i>the month rose</li><li><i class="rond anneau" style="--c:${C.argile}"></i>the month fell</li><li><i class="rond anneau" style="--c:${C["encre-3"]}"></i>to come</li></ul>
  </div>`);
  const zone = boite.querySelector(".explorateur");

  function afficher() {
    zone.querySelectorAll("[data-version]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.version === version));
    zone.querySelectorAll("[data-mois]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mois === choisi));
    const { p, action } = decision(choisi), h = hist.v1[choisi];
    const suite = h ? `The Nikkei ${h.hausse_realisee ? "rose" : "fell"}: ${pct(h.rendement_achat_couvert, 1, true)} for a hedged buy.` : "The month is not known yet.";
    zone.querySelector(".explorateur-resume").innerHTML = `
      <p class="sur-titre">${Maj(moisLong(moisSuivant(choisi)))}, with data to the end of ${moisLong(choisi)}</p>
      <dl><div><dt>${pct(p, 1)}</dt><dd>stated probability of a rise</dd></div>
      <div><dt class="action ${action}">${Maj(tr(action))}</dt><dd>the rule's action</dd></div></dl>
      <p class="suite">${suite}</p>`;
    const items = contributions(choisi);
    const m = Math.max(...items.map((e) => Math.abs(e.c)), 1e-6);
    zone.querySelector(".explorateur-barres").innerHTML = `<p class="sous">What weighed, in log-odds of a fall${version === "v2" ? " (SHAP values)" : ""}</p>
      <ul>${items.map((e) => `<li><span>${esc(e.nom)}</span><span class="piste"><i class="${e.c > 0 ? "vers-baisse" : "vers-hausse"}" style="--l:${(Math.abs(e.c) / m) * 50}%"></i></span><b>${e.c > 0 ? "+" : "−"}${dec(Math.abs(e.c), 2)}</b></li>`).join("")}</ul>
      <p class="note">Right of the line, the feature pushes towards a fall; left, towards a rise.</p>`;
  }
  zone.addEventListener("click", (e) => {
    const b = e.target.closest("[data-version], [data-mois]");
    if (!b) return;
    if (b.dataset.version) version = b.dataset.version; else choisi = b.dataset.mois;
    afficher();
  });
  afficher();
}

// ---------- VII. the second version against the first ----------
function tableVersions() {
  if (!V2_INFO) return "";
  const e1 = D.evaluation, e2 = D.v2.evaluation_test, d2 = D.v2.decision_finale, C1 = "constante (fréquence de l'entraînement)";
  const lignes = [
    ["Training months", `${CHIFFRES.moisEntrainement} (2010-2021)`, `${V2_INFO.mois} (1999-2021)`],
    ["Model selected on validation", "logistic", tr(e2.modele)],
    ["Validation log-loss, model / constant", "0.699 / 0.681", `${dec(d2.validation.log_loss_calibree[d2.modele_nikkei])} / ${dec(d2.validation.log_loss_constante)}`],
    ["Test log-loss, model / constant", `${dec(e1.metriques.logistique["log-loss"])} / ${dec(e1.metriques[C1]["log-loss"])}`, `${dec(V2_INFO.ll)} / ${dec(V2_INFO.llConst)}`],
    ["Log-loss gap ± standard error", `${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}`, `${dec(V2_INFO.ecart.moyenne, 3)} ± ${dec(V2_INFO.ecart.erreur_type, 3)}`],
    ["Model's rule, in euros", pct(CHIFFRES.regle, 1, true), pct(V2_INFO.regle, 1, true)],
    ["Buy and hold, hedged", pct(CHIFFRES.couvert, 1, true), pct(V2_INFO.couvert, 1, true)],
    ["Actions: buy · neutral · sell", `${e1.actions.acheter} · ${e1.actions.neutre} · ${e1.actions.vendre}`, `${V2_INFO.actions.acheter ?? 0} · ${V2_INFO.actions.neutre ?? 0} · ${V2_INFO.actions.vendre ?? 0}`],
  ];
  return `<div class="tableau-defile"><table><thead><tr><th>On the 2024-2026 test</th><th>First version (frozen)</th><th>Second version (afterwards)</th></tr></thead><tbody>
    ${lignes.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">The first version is the only one evaluated blind: its decision was committed before the test was opened. The second was tuned and chosen by the same rule, but after seeing that test: its 2024-2026 result has no value as proof.</p>`;
}

// ---------- VII. the improvement levers, frozen protocol, judged on 2010-2023 ----------
function tableAmeliorations() {
  if (!V3_INFO) return "";
  const v3 = D.v3, J = V3_INFO.J, oui = '<span class="ok">yes</span>', non = '<span class="non">no</span>';
  const sp = (m) => `${m["2010-2016"] ? "✓" : "✗"} · ${m["2017-2023"] ? "✓" : "✗"}`;
  const probas = Object.entries(v3.probabilites[J]).map(([v, b]) => {
    const t = v3.tests_probabilites[v];
    return `<tr><td>${esc(tr(v))}</td><td>${dec(b.log_loss, 4)}</td><td>${t ? `${dec(b.ecart_vs_constante, 4)} ± ${dec(b.erreur_type, 4)}` : "reference"}</td>
      <td>${dec(b.auc, 2)}</td><td>${t ? dec(t.p_holm, 2) : ""}</td><td>${t ? sp(t.mieux_sur) : ""}</td><td>${t ? (t.retenue ? oui : non) : ""}</td></tr>`;
  }).join("");
  const leviers = Object.entries(v3.euros[J]).filter(([s]) => s !== "assemblage final").map(([s, b]) => {
    const t = v3.tests_euros[s];
    return `<tr><td>${esc(tr(s))}</td><td>${dec(b.sharpe, 2)}</td><td>${pct(b.perte_maximale, 1, true)}</td><td>${pct(b.cumul, 0, true)}</td>
      <td>${t ? dec(t.p_holm, 2) : "reference"}</td><td>${t ? sp(t.mieux_sur) : ""}</td><td>${t ? (t.retenu ? oui : non) : ""}</td></tr>`;
  }).join("");
  const a = v3.assemblage_final, mp = v3.mois_prochain;
  return `<p class="sous">Protocol written and frozen on ${esc(V3_INFO.fige.slice(0, 10))} before any computation (SHA-256 fingerprint ${esc(V3_INFO.sha.slice(0, 12))}…). Each variant is relearned every month on the past known since 1999; settings fixed in advance; a variant is kept only if it beats the reference after Holm correction and on both sub-periods. 2024-2026, already seen, was not used to choose anything.</p>
    <div class="tableau-defile"><table class="leviers"><thead><tr><th>Probability of a fall, ${V3_INFO.mois} months</th><th>Log-loss</th><th>Gap to the constant</th><th>AUC</th><th>p (Holm)</th><th>Better 2010-16 · 2017-23</th><th>Kept</th></tr></thead><tbody>${probas}</tbody></table></div>
    <div class="tableau-defile"><table class="leviers"><thead><tr><th>In euros, 2010-2023</th><th>Sharpe</th><th>Max drawdown</th><th>Cumulative</th><th>p (Holm)</th><th>Better 2010-16 · 2017-23</th><th>Kept</th></tr></thead><tbody>${leviers}</tbody></table></div>
    <p class="note">With the constant probability, the project's rule stays neutral ${V3_INFO.neutreConstante} months out of ${V3_INFO.mois}: its 0.5% monthly margin exceeds the expected gain learned from the past. Hedging half the yen brings the maximum drawdown from ${pct(V3_INFO.ref.perte_maximale, 1, true)} to ${pct(V3_INFO.moitie.perte_maximale, 1, true)}, with no net Sharpe gain. Final combination: ${a.probabilite === "constante" && !a.dosage_par_la_volatilite && !a.regle_de_decision ? "the reference, constant probability and hedged buying" : esc(JSON.stringify(a))}; for ${moisLong(mp.mois_prevu)}, it ${mp.assemblage.sens === "acheter" ? "buys" : tr(mp.assemblage.sens)}, ${pct(mp.assemblage.part_couverte, 0)} hedged.</p>`;
}

// ---------- assembly ----------
const tuiles = (chiffres) => `<dl class="tuiles">${chiffres.map(([v, l]) => `<div><dt>${v}</dt><dd>${l}</dd></div>`).join("")}</dl>`;
const figure = (titre, sous, id) => `<figure class="figure" id="${id}"><h3>${titre}</h3>${sous ? `<p class="sous">${sous}</p>` : ""}</figure>`;

const FIG_MATHS = {
  "m-modele": ["The sigmoid, and the months it must separate", "Each point is a training month, placed at the score the model gives it. At the top, the months that fell; at the bottom, those that rose. Even on the months it learned from, the two groups overlap: the score barely separates them.", "fig-sigmoide", figSigmoide],
  "m-cout": ["The cost of a confident mistake", "A month's loss as a function of the stated probability. It stays moderate when the model hesitates, and explodes when it is confidently wrong. The points are the training months, at the loss the model pays on them.", "fig-pertes", figPertes],
  "m-gradient": ["The gradient field", "At each point of the surface, the arrow shows −∇J: the direction in which the cost falls fastest. They all converge on the minimum.", "fig-pentes", figPentes],
  "m-prior": ["The prior, and the weights it let through", "The prior density of a standardised weight, and the twelve weights learned by the final model. None leaves the zone that holds 95% of the prior's mass.", "fig-prior", figPrior],
  "m-convexite": ["A single valley", "The penalised log-loss over two coefficients, with the intercept fixed at its optimum. From the start, the descent reaches the only minimum.", "fig-convexite", (b) => figSurface(b, ["classique (1/L)"])],
  "m-descente": ["Four steps, four fates", "The same surface, the same start, four step sizes.", "fig-surface", (b) => figSurface(b)],
  "m-moindres": ["The best line, and what it is worth out of sample", "Each point is a month, placed at its return predicted by the normal equations and at its actual return. On the diagonal, the forecast is exact.", "fig-moindres", figMoindres],
};
const FIG_ML = {
  "fig-nikkei": figNikkei, "fig-rendements": figRendements, "fig-essais": figEssais, "fig-regle": figRegle, "fig-euros": (b) => figEuros(b),
  "fig-volatilite": figVolatilite, "fig-contributions": figContributions, "fig-explorateur": figExplorateur,
  "fig-euros-v2": (b) => figEuros(b, D.v2.evaluation_test.historique_test),
};

const pieces = (s) => {
  const l = liensPieces(s);
  return l ? `<div class="pieces-chapitre"><h3 class="sur-titre">In the cabinet</h3>${l}</div>` : "";
};
const blocFigures = (s) => {
  const p = FIG_CHAPITRE[s.id] ? planches(FIG_CHAPITRE[s.id], s.id) : "";
  return p ? `<div class="figures-chapitre"><h3 class="sur-titre">Notebook figures</h3>${p}</div>` : "";
};

function galerie() {
  return D.notebooks.map((nb) => {
    const noms = Object.keys(FIGURES).filter((f) => FIGURES[f][2] === nb.nom);
    if (!noms.some(existe)) return "";
    return `<section class="galerie-groupe"><h4><span class="sur-titre">${nomNotebook(nb.nom)}</span> ${titreNb(nb.nom)}</h4>${planches(noms, `galerie-${nb.nom}`)}</section>`;
  }).join("");
}

function corps(s) {
  const part = [];
  if (s.id === "cabinet") {
    part.push(`<p class="clair">${s.clair}</p>`);
    part.push(`<div class="pieces">${D.notebooks.map((n) => `<button type="button" class="piece" data-nb="${n.nom}"><span class="sur-titre">${nomNotebook(n.nom)}</span><strong>${titreNb(n.nom)}</strong><span>Open ${FLECHE}</span></button>`).join("")}
      <a class="piece" href="${RACINE}docs/rapport.pdf" target="_blank" rel="noopener"><span class="sur-titre">PDF · French</span><strong>The Applied ML report</strong><span>Open ${FLECHE}</span></a>
      <a class="piece" href="${RACINE}docs/annexe_maths.pdf" target="_blank" rel="noopener"><span class="sur-titre">PDF · French</span><strong>The maths appendix</strong><span>Open ${FLECHE}</span></a></div>`);
    part.push(`<div class="technique"><span class="sur-titre">In technical terms</span><p>${s.technique}</p></div>`);
    part.push(`<div class="figures-chapitre"><h3 class="sur-titre">All the figures, notebook by notebook</h3>${galerie()}</div>`);
    return part.join("");
  }
  part.push(arrivee(s), `<p class="clair">${s.clair}</p>`, tuiles(s.chiffres));
  if (FIG_MATHS[s.id]) { const [t, sous, id] = FIG_MATHS[s.id]; part.push(figure(t, sous, id)); }
  if (s.id === "dataset") {
    const ds = D.dataset ?? {}, cb = D.v2?.controle_bloomberg ?? {};
    const sources = Object.entries(ds.sources ?? {}).sort((a, b) => b[1] - a[1]);
    part.push(`<figure class="figure"><h3>One decision, two dates</h3><p class="sous">All the features in a row are known at the Tokyo close on the last day of the month. The target is only known a month later.</p>
      <div class="chrono"><div><h4>End of month t</h4><p>Nikkei price and volatility, Japanese yield curve, latest published Tankan, euro-yen carry and volatility, uncertainty, news up to 6:30 UTC.</p></div>
      <div class="pivot">the rule decides${FLECHE}</div>
      <div><h4>End of month t + 1</h4><p>We measure the Nikkei's return: in yen for the target, in euros, hedged or not, for the investor's gain.</p></div></div></figure>`);
    if (sources.length) part.push(`<figure class="figure"><h3>Where the ${nombre(ds.colonnes)} columns come from</h3><p class="sous">Columns of the monthly table, by source. Each column carries, in the variable dictionary, the delay after which it was actually known.</p>
      <ul class="barres-sources">${sources.map(([nom, n]) => `<li><span>${esc(tr(nom))}</span><i style="--n:${n / sources[0][1]}"></i><b>${n}</b></li>`).join("")}</ul></figure>`);
    if (cb.tankan) part.push(`<figure class="figure"><h3>Bloomberg as the reference</h3><p class="sous">The series exported from Bloomberg are used to check the table, each once moved back to its publication date.</p>
      <div class="tableau-defile"><table><thead><tr><th>Series</th><th>Check</th><th>Decision</th></tr></thead><tbody>
      <tr><td>Tankan, large manufacturers</td><td>${cb.tankan.valeurs_identiques} quarters identical out of ${cb.tankan.trimestres_compares}, once shifted to the publication month; at its Bloomberg date, ${(cb.tankan.erreur_si_date_bloomberg_prise_telle_quelle.match(/^\d+/) ?? ["some"])[0]} quarters would have used the survey before its publication</td><td>kept, with its lag</td></tr>
      <tr><td>Inflation (CPI, year on year)</td><td>same series once shifted by one month, its publication: correlation ${dec(cb.ipc.correlations.decalage_1, 3)}, mean gap ${dec(cb.ipc.ecart_moyen_points ?? 0, 2)} point, at most ${dec(cb.ipc.ecart_max_points ?? 0, 2)} (the table recomputes it from the index)</td><td>as a reference; not a model feature</td></tr>
      <tr><td>VIX</td><td>exported “in euros”: ${dec(cb.vix.ratio_median_bloomberg_sur_vix, 2)} times the VIX at the median, from ${dec(cb.vix.ratio_min, 2)} to ${dec(cb.vix.ratio_max, 2)}</td><td>not used: to be re-exported without conversion</td></tr>
      <tr><td>Release calendar</td><td>${nombre(cb.calendrier.lignes)} rows, ${cb.calendrier.couvre}</td><td>truncated at 5,000 rows: to be re-exported by period</td></tr>
      </tbody></table></div></figure>`);
  }
  if (s.id === "exploration") {
    part.push(figure(`${Math.round(SERIE.length / 12)} years of the Nikkei, cut in time order`, "The index's monthly close, in points. The model learns on training, is tuned on validation, and saw the test only once.", "fig-nikkei"));
    part.push(figure(`${nombre(SERIE.length - 1)} monthly returns`, "Each bar is a month. The constant forecast states the training frequency of falls: the benchmark every model must beat.", "fig-rendements"));
  }
  if (s.id === "apprentissage") part.push(figure(`${CHIFFRES.essais} trials, three models`, "Cross-validation log-loss of each Optuna trial (lower is better). The selected LightGBM looks best here; on the test, it will do worse than the logistic: the best of fifty trials is always flattering.", "fig-essais"));
  if (s.id === "regle") part.push(figure("Each month, a probability and an action", "The probability of a rise stated for each validation and test month, and what happened next. Points of the same colour are mixed together: the sign of a model that does not separate rises from falls.", "fig-regle"));
  if (s.id === "epreuve") {
    part.push(figure("What each approach would have returned", `Cumulative gain in euros, from January 2024 to September 2026. The model's rule stayed neutral ${D.evaluation.actions.neutre} months, sold ${D.evaluation.actions.vendre} months and bought ${D.evaluation.actions.acheter} months.`, "fig-euros"));
    part.push(`<figure class="figure"><h3>The model against the constant</h3><p class="sous">Month-by-month log-loss gap, model minus constant: ${dec(ECART_TEST.moyenne, 3)} on average, with a standard error of ${dec(ECART_TEST.erreurType, 3)}. A gap of one standard error is inconclusive either way.</p>${tableMetriques()}</figure>`);
    part.push(`<figure class="figure"><h3>In euros</h3>${tablePerf()}</figure>`);
    const sig = D.signal;
    part.push(`<figure class="figure"><h3>And for ${moisLong(moisSuivant(sig.mois_des_donnees))}?</h3><p class="sous">With data to the end of ${moisLong(sig.mois_des_donnees)}, the model states a ${pct(sig.p_hausse, 1)} chance of a rise: its rule would ${({ vendre: "sell", acheter: "buy", neutre: "stay neutral" })[sig.action_du_modele] ?? tr(sig.action_du_modele)}. Since it did not beat the constant, the project's recommendation remains: ${tr(sig.recommandation_finale.split("(")[0].trim())}.</p></figure>`);
  }
  if (s.id === "explication") part.push(figure("Understanding each test decision", "Pick a month: the stated probability, the rule's action, what happened, and the features that made the prediction. The second version, retrained afterwards on 1999-2026, is explained with the SHAP values of its LightGBM.", "fig-explorateur"));
  if (s.id === "apres") {
    part.push(`<p><span class="apres-coup">After-the-fact exploration</span></p>`);
    if (V2_INFO) {
      part.push(`<figure class="figure"><h3>The same method, on 1999-2026</h3><p class="sous">Same features, same pipeline, same model-selection rule and same final split; only the training history gets longer, with Bloomberg as the reference.</p>${tableVersions()}</figure>`);
      part.push(figure("The second version, in euros", `Cumulative gain from January 2024 to September 2026 with the second version's rule (${V2_INFO.modele}).`, "fig-euros-v2"));
    }
    if (V3_INFO) part.push(`<figure class="figure"><h3>Improving without overfitting: ${V3_INFO.retenus} lever${V3_INFO.retenus !== 1 ? "s" : ""} kept out of ${V3_INFO.tests}</h3>${tableAmeliorations()}</figure>`);
    part.push(figure("Turbulence can be read a little in advance", "Annualised Nikkei volatility, realised each month and forecast at the end of the previous month by a regression on past volatilities, the VIX and the return.", "fig-volatilite"));
    part.push(`<figure class="figure"><h3>Buying when risk is low, since 2003</h3><p class="sous">The signal cuts the position when forecast risk rises. It protects in 2008, but sells after the sharp falls of 2020 and August 2024 and misses the rebound.</p>${tableSignalRisque()}</figure>`);
  }
  part.push(`<div class="technique"><span class="sur-titre">In technical terms</span><p>${s.technique}</p></div>`);
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
          <span class="sur-titre">${info.nom} · chapter ${s.num} · ${s.nom}</span>
          <h2 id="titre-${s.id}">${s.titre}</h2>
          <a class="vers-salle" href="${avecCours(`index.html#${s.id}`)}"><i></i>Visit room ${s.num} ${FLECHE}</a>
        </header>
        <div class="chapitre-corps">${corps(s)}</div>
      </div>
    </section>`).join("");
  $("main").innerHTML = `
    <section class="ouverture large">
      <p class="sur-titre">${info.nom} path · ${info.cours}</p>
      <h1>${info.h1}</h1>
      <div class="ouverture-bas">
        <p class="devise">${info.devise}</p>
        <div class="verdict">
          <span class="sur-titre">${COURS === "maths" ? "What to remember" : "The result, in one sentence"}</span>
          <p>${info.verdict}</p>
          <div class="liens-ouverture"><a href="#${SALLES[0].id}">Start reading ${FLECHE}</a><a href="${avecCours("index.html")}">Take the 3D tour ${FLECHE}</a><a href="${avecCours("lecture.html", COURS === "maths" ? "ml" : "maths")}">${COURS_INFO[COURS === "maths" ? "ml" : "maths"].nom} path ${FLECHE}</a></div>
        </div>
      </div>
    </section>
    <nav class="sommaire large" aria-label="Contents"><ol>${SALLES.map((s) => `<li><a href="#${s.id}"><span class="n">${s.num}</span><span class="t">${s.nom}<small>${s.titre}</small></span>${FLECHE}</a></li>`).join("")}
      <li><a href="#limites"><span class="n">—</span><span class="t">The limitations<small>What to keep in mind</small></span>${FLECHE}</a></li></ol></nav>
    ${sections}
    <section class="chapitre large limites" id="limites" style="--accent:#8a8379">
      <div class="chapitre-grille">
        <header class="chapitre-tete"><span class="sur-titre">To finish</span><h2>The limitations</h2></header>
        <div class="chapitre-corps"><ol>${LIMITES.map(([t, d]) => `<li><div><b>${t}</b><span>${d}</span></div></li>`).join("")}</ol></div>
      </div>
    </section>
    <footer class="pied large"><span>${ENTREE.ecole}</span><span>Data: FRED, Bank of Japan, Japanese Ministry of Finance, ECB, Yahoo Finance, GDELT. <a href="${avecCours("cabinet.html")}">Notebooks</a> · ${(D.telechargements?.archives ?? []).map((a) => `<a href="${RACINE}${a.href}" download="${a.fichier}">${({ notebooks: "All the notebooks", projet: "The complete project" })[a.cle] ?? a.titre} (.zip)</a>`).join(" · ")} · <a href="${RACINE}docs/rapport.pdf">Report (FR)</a> · <a href="${RACINE}docs/annexe_maths.pdf">Appendix (FR)</a> · <a href="${RACINE}lecture.html${location.search}" lang="fr" hreflang="fr">Version française</a></span></footer>`;

  for (const [id, f] of Object.entries(FIG_ML)) { const e = document.getElementById(id); if (e) f(e); }
  for (const [, , id, f] of Object.values(FIG_MATHS)) { const e = document.getElementById(id); if (e) f(e); }
}

// ---------- the figure viewer: large image, caption, previous and next figure ----------
function visionneuse() {
  const boite = $("#boite");
  boite.innerHTML = `<div class="boite-barre"><span class="boite-compte"></span><button type="button" class="boite-fermer">Close</button></div>
    <button type="button" class="boite-nav" data-sens="-1" aria-label="Previous figure">${FLECHE_G}</button>
    <figure class="boite-figure"><div class="boite-papier"><img alt=""></div>
      <figcaption><span class="sur-titre"></span><strong></strong><span class="boite-texte"></span><button type="button" class="boite-nb" data-nb="">Open the notebook ${FLECHE}</button></figcaption></figure>
    <button type="button" class="boite-nav" data-sens="1" aria-label="Next figure">${FLECHE}</button>`;
  const img = boite.querySelector("img");
  let liste = [], i = 0, retour = null;
  const montrer = () => {
    const n = liste[i], [titre, texte, nb] = FIGURES[n] ?? [n, "", ""];
    img.src = `${RACINE}figures/${n}.png`; img.alt = titre;
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

// ---------- header and link to the room being read ----------
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
// the charts change the page height as they draw: jump to the anchor once the layout has settled
if (location.hash) setTimeout(() => document.querySelector(location.hash)?.scrollIntoView(), 250);
