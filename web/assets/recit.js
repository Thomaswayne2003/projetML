/* Projet Nikkei — le récit (/recit).
   Chaque chapitre s'ouvre sur un graphique tracé en SVG à partir des données de l'API, dans sa propre colonne, à côté du
   texte. Les graphiques s'animent quand ils entrent à l'écran : les courbes se tracent, les mois apparaissent dans
   l'ordre du temps, les barres poussent, l'aiguille de la jauge va se placer.
   Sous chaque graphique, la lecture se fait en deux temps : une explication en clair, puis la version technique.
   La page sert aussi de support d'oral : la touche P lance le mode présentation (une diapositive par chapitre).
   Une seule grammaire de couleurs : indigo = hausse, achat ; vermillon = baisse, vente ; encre = le modèle. */
const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ----- Ouverture du site : l'écran est d'abord noir, puis 60 000 gouttes d'encre écrivent « Nikkei » et éclatent
const voile = document.getElementById("voile");
const leverVoile = () => {
  if (!voile?.isConnected) return;
  voile.remove();
  document.querySelector("[data-chapitre=haut]")?.classList.remove("vue");       // l'affiche entre en scène à ce moment-là
  document.querySelector("[data-planche=haut]")?.classList.remove("joue");
};
if (voile && !IMMOBILE) import("./passage3d.js").then((m) => m.passer("日経", "Nikkei 225 · 2010 → 2026", leverVoile, true) || leverVoile()).catch(leverVoile);
else leverVoile();
setTimeout(leverVoile, 3200);

// ----- Les titres sont découpés en mots, pour qu'ils arrivent l'un après l'autre
function decouper(titre) {
  let rang = 0;
  const traiter = (noeud) => [...noeud.childNodes].forEach((enfant) => {
    if (enfant.nodeType === 1) return traiter(enfant);
    if (enfant.nodeType !== 3) return;
    const morceaux = document.createDocumentFragment();
    enfant.textContent.split(/([ \n\t]+)/).forEach((mot) => {
      if (!mot) return;
      if (/^[ \n\t]+$/.test(mot)) return morceaux.append(" ");
      const boite = Object.assign(document.createElement("span"), { className: "mot", textContent: mot });
      boite.style.setProperty("--i", rang++);
      morceaux.append(boite);
    });
    enfant.replaceWith(morceaux);
  });
  traiter(titre);
}
document.querySelectorAll(".affiche h1, .ouverture h2").forEach(decouper);
const api = (route, params = {}) => fetch("/api.php?" + new URLSearchParams({ route, ...params })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const NOMS = { news_attention_6m: "Volume anormal d'articles", news_sent_w: "Sentiment FinBERT", news_dispo: "News disponibles", n225_mom_12m: "Momentum 12 mois",
  n225_mom_3m: "Momentum 3 mois", n225_vol_ewma: "Volatilité du Nikkei", d_jgb10y_bp: "Variation du JGB 10 ans", tankan_large_manuf: "Tankan", carry_1m: "Portage de la couverture",
  eurjpy_rvol_1m: "Volatilité EUR/JPY", "distance au régime agité": "Distance au régime agité", "distance au régime calme": "Distance au régime calme" };
const LOGLOSS_CONSTANTE_CV = 0.672;                 // log-loss du modèle constant en validation croisée (notebook 02)

// ----- Petits outils d'écriture SVG
const L = 640;
const fr = (v, dec = 0) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace("-", "−").replace(/\u202f/g, "\u00a0");
const signe = (v, dec = 1) => (v >= 0 ? "+" : "−") + fr(Math.abs(v), dec);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const lisible = (m) => `${MOIS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const n1 = (v) => +v.toFixed(1);
const dl = (s) => ` style="--d:${s.toFixed(2)}s"`;                                  // délai d'entrée de l'élément
const svg = (h, corps) => `<svg viewBox="0 0 ${L} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${corps}</svg>`;
const txt = (x, y, t, o = {}) => `<text x="${n1(x)}" y="${n1(y)}" text-anchor="${o.anc || "start"}" class="et ${o.c || ""}${o.d != null ? " a-fondu" : ""}"` +
  `${o.rot ? ` transform="rotate(${o.rot} ${n1(x)} ${n1(y)})"` : ""}${o.d != null ? dl(o.d) : ""}>${t}</text>`;
const trait = (x1, y1, x2, y2, c = "grille", extra = "") => `<line class="${c}" x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}"${extra}/>`;
const teinte = (m) => (m.baisse === null ? "enc" : m.baisse ? "ver" : "ind");

/* ---------- La courbe du Nikkei : ouverture de la page, et chapitre sur le changement de régime ---------- */
function courbe(serie, mode) {
  const n = serie.length, x0 = 62, x1 = 612, y0 = 40, y1 = 366, min = Math.log(7500), max = Math.log(72000);
  const X = (j) => x0 + (j / (n - 1)) * (x1 - x0), Y = (v) => y1 - ((Math.log(v) - min) / (max - min)) * (y1 - y0);
  const ligne = "M" + serie.map((m, j) => `${n1(X(j))} ${n1(Y(m.cloture))}`).join(" L"), coupe = serie.findIndex((m) => m.mois === "2022-01");
  let s = mode === "ouverture" ? `<circle class="soleil a-leve" cx="438" cy="176" r="132"/>` : "";
  if (mode === "regime") s += `<rect class="voile a-fondu" x="${n1(X(coupe))}" y="${y0}" width="${n1(x1 - X(coupe))}" height="${y1 - y0}"${dl(1.5)}/>`;
  [10000, 20000, 40000].forEach((v) => { s += trait(x0, Y(v), x1, Y(v)) + txt(x0 - 8, Y(v) + 4, fr(v), { c: "petit", anc: "end" }); });
  serie.forEach((m, j) => { if (m.mois.endsWith("-01") && +m.mois.slice(0, 4) % 4 === 0) s += txt(X(j), y1 + 20, m.mois.slice(0, 4), { c: "petit", anc: "middle" }); });
  s += trait(x0, y1, x1, y1, "axe");
  s += `<path class="aire a-fondu" d="${ligne} L${x1} ${y1} L${x0} ${y1} Z"${dl(1.2)}/><path class="t-enc a-trace epais" pathLength="1" d="${ligne}" style="--t:2.6s"/>`;
  const dernier = serie[n - 1];
  s += `<circle class="f-enc a-pop" cx="${n1(X(n - 1))}" cy="${n1(Y(dernier.cloture))}" r="5"${dl(2.5)}/>`;
  s += txt(X(n - 1), Y(dernier.cloture) - 14, `${fr(dernier.cloture)} en ${lisible(dernier.mois)}`, { c: "fort", anc: "end", d: 2.6 });
  s += `<circle class="f-enc a-pop" cx="${n1(X(0))}" cy="${n1(Y(serie[0].cloture))}" r="4"${dl(0.2)}/>` + trait(X(0), Y(serie[0].cloture) - 7, X(0), Y(serie[0].cloture * 1.7) + 6, "axe fin a-fondu", dl(0.4)) + txt(X(0) - 2, Y(serie[0].cloture * 1.78), `${fr(serie[0].cloture)} en ${lisible(serie[0].mois)}`, { d: 0.5 });
  if (mode === "regime") {
    s += trait(X(coupe), y0 - 6, X(coupe), y1, "axe tiret a-fondu", dl(1.4));
    s += txt(X(coupe) - 8, y0 + 8, "janvier 2022", { c: "fort", anc: "end", d: 1.6 });
    s += txt((x0 + X(coupe)) / 2, y1 + 44, "ce que le modèle a appris", { anc: "middle", d: 1.8 }) + txt((X(coupe) + x1) / 2, y1 + 44, "ce qu'il a dû prédire", { anc: "middle", d: 2 });
    return { h: 424, corps: s, titre: "Le Nikkei avant et après 2022",
      texte: "C'est la même courbe qu'en ouverture, coupée en deux. Le modèle a tout appris sur la partie claire, puis on lui a demandé de prévoir dans la partie grisée, où les conditions avaient changé.",
      precis: `Entraînement sur 2010-2021 (${coupe} mois), sous une politique de taux négatifs. Validation et test sur 2022-2026, après le début de la normalisation monétaire de la Banque du Japon.`,
      legende: [] };
  }
  const fois = dernier.cloture / serie[0].cloture;
  return { h: 400, corps: s, titre: "Le Nikkei 225, de 2010 à 2026",
    texte: `Voici la Bourse japonaise depuis 2010. Elle a été multipliée par ${fr(fois, 1)} en seize ans, avec des hauts et des bas. Tout le projet consiste à deviner, à la fin d'un mois, si le suivant sera une hausse ou une baisse.`,
    precis: `Clôtures mensuelles du Nikkei 225 en échelle logarithmique, soit ${n} mois de février 2010 à octobre 2026.`, legende: [] };
}

/* ---------- 1 € placé sur le test : achat couvert contre règle du modèle ---------- */
function performance(mois) {
  const cumul = (cle) => mois.reduce((a, m) => [...a, a[a.length - 1] * (1 + m[cle])], [1]).map((v) => v - 1);
  const achat = cumul("rendement_achat_couvert"), regle = cumul("rendement_regle"), n = mois.length, x0 = 62, x1 = 440, y0 = 46, y1 = 356;
  const bas = Math.min(-0.05, ...achat, ...regle), haut = Math.max(...achat, ...regle) * 1.04;
  const X = (k) => x0 + (k / n) * (x1 - x0), Y = (v) => y1 - ((v - bas) / (haut - bas)) * (y1 - y0), chemin = (t) => "M" + t.map((v, k) => `${n1(X(k))} ${n1(Y(v))}`).join(" L");
  let s = "";
  [0, 0.4, 0.8].forEach((v) => { s += trait(x0, Y(v), x1, Y(v), v ? "grille" : "axe") + txt(x0 - 8, Y(v) + 4, v ? `+${fr(100 * v)} %` : "0 %", { c: "petit", anc: "end" }); });
  s += txt(X(0), y1 + 22, lisible(mois[0].date), { c: "petit" }) + txt(X(n), y1 + 22, lisible(mois[n - 1].date), { c: "petit", anc: "end" });
  s += `<path class="aire-ind a-fondu" d="${chemin(achat)} L${n1(X(n))} ${n1(Y(0))} L${x0} ${n1(Y(0))} Z"${dl(1.6)}/>`;
  s += `<path class="t-ind a-trace epais" pathLength="1" d="${chemin(achat)}" style="--t:2.2s"/><path class="t-enc a-trace epais" pathLength="1" d="${chemin(regle)}" style="--t:2.2s;--d:.35s"/>`;
  s += `<circle class="f-ind a-pop" cx="${n1(X(n))}" cy="${n1(Y(achat[n]))}" r="5"${dl(2.2)}/><circle class="f-enc a-pop" cx="${n1(X(n))}" cy="${n1(Y(regle[n]))}" r="5"${dl(2.5)}/>`;
  s += txt(X(n) + 14, Y(achat[n]) + 4, `${signe(100 * achat[n])} %`, { c: "grand ind", d: 2.3 }) + txt(X(n) + 14, Y(achat[n]) + 24, "toujours acheter, couvert", { c: "ind", d: 2.4 });
  s += txt(X(n) + 14, Y(regle[n]) - 6, `${signe(100 * regle[n])} %`, { c: "grand", d: 2.6 }) + txt(X(n) + 14, Y(regle[n]) + 14, "règle du modèle", { d: 2.7 });
  const recul = (t) => { let sommet = 0, pire = 0; t.forEach((v) => { sommet = Math.max(sommet, v); pire = Math.min(pire, (1 + v) / (1 + sommet) - 1); }); return pire; };
  return { h: 400, corps: s, titre: `1 € placé pendant les ${n} mois du test`,
    texte: "Imaginez deux épargnants qui placent chacun 1 € au début de 2024. Le premier achète et ne touche plus à rien : sa courbe bleue grimpe. Le second suit les conseils du modèle, qui le tient presque toujours à l'écart, et sa courbe noire reste à plat.",
    precis: `Rendements cumulés en euros sur les ${n} mois du test : ${signe(100 * achat[n])} % pour « toujours acheter, couvert » et ${signe(100 * regle[n])} % pour la règle du modèle, avec un pire recul de ${fr(100 * recul(achat))} % et de ${fr(100 * recul(regle))} %.`,
    legende: [["ind", "toujours acheter, couvert"], ["enc", "règle du modèle"]] };
}

/* ---------- La jauge du signal ---------- */
function jauge(p, seuils, titre) {
  const cx = 320, cy = 288, r = 205, pt = (v, rayon = r) => [cx - Math.cos(v * Math.PI) * rayon, cy - Math.sin(v * Math.PI) * rayon];
  const arc = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${n1(x1)} ${n1(y1)} A${r} ${r} 0 0 1 ${n1(x2)} ${n1(y2)}`; };
  let s = `<path class="arc t-ver a-trace" pathLength="1" d="${arc(0, seuils.theta_v - 0.004)}" style="--t:.8s"/>` +
    `<path class="arc t-gri a-trace" pathLength="1" d="${arc(seuils.theta_v + 0.004, seuils.theta_a - 0.004)}" style="--t:.4s;--d:.7s"/>` +
    `<path class="arc t-ind a-trace" pathLength="1" d="${arc(seuils.theta_a + 0.004, 1)}" style="--t:.8s;--d:1s"/>`;
  [[seuils.theta_v / 2, "vendre", "ver"], [(seuils.theta_v + seuils.theta_a) / 2, "neutre", "gri"], [(1 + seuils.theta_a) / 2, "acheter", "ind"]].forEach(([v, nom, c], k) => {
    const [x, y] = pt(v, r + 34); s += txt(x, y + 4, nom, { c: `fort ${c}`, anc: v < 0.4 ? "end" : v > 0.6 ? "start" : "middle", d: 0.6 + k * 0.4 });
  });
  [seuils.theta_v, seuils.theta_a].forEach((v, k) => { const [x, y] = pt(v, r - 30); s += txt(x, y + 4, fr(v, 3), { c: "petit", anc: k ? "start" : "end", d: 1.4 }); });
  [0, 1].forEach((v) => { const [x, y] = pt(v, r); s += txt(x, y + 30, v ? "100 %" : "0 %", { c: "petit", anc: "middle" }); });
  s += `<g class="aiguille" style="--p:${p.toFixed(4)}"><line class="t-enc" x1="${cx}" y1="${cy}" x2="${cx - r + 34}" y2="${cy}"/></g><circle class="f-enc" cx="${cx}" cy="${cy}" r="12"/>`;
  const action = p < seuils.theta_v ? "vendre" : p < seuils.theta_a ? "rester neutre" : "acheter";
  s += `<text class="et tres-grand a-fondu" id="jauge-valeur" x="${cx}" y="${cy + 74}" text-anchor="middle"${dl(1.5)}>${fr(100 * p, 1)} %</text>`;
  s += `<text class="et a-fondu" id="jauge-action" x="${cx}" y="${cy + 100}" text-anchor="middle"${dl(1.7)}>de probabilité de hausse · la règle dirait « ${action} »</text>`;
  return { h: 400, corps: s, titre,
    texte: "L'aiguille montre à quel point le modèle croit à une hausse le mois prochain. À gauche, il conseillerait de vendre, à droite d'acheter, et au milieu de ne rien faire.",
    precis: `Probabilité de hausse calibrée par Platt, comparée aux seuils θ = ${fr(seuils.theta_v, 3)} et θ = ${fr(seuils.theta_a, 3)} fixés avant le test. Le score vaut S = 2p − 1.`,
    legende: [["ver", "vendre"], ["gri", "rester neutre"], ["ind", "acheter"]] };
}

/* ---------- Le calendrier des 201 mois ---------- */
function calendrier(serie) {
  const a0 = +serie[0].mois.slice(0, 4), a1 = +serie[serie.length - 1].mois.slice(0, 4), px = 39, py = 20.5, x0 = 78, y0 = 40;
  const X = (m) => x0 + m * px, Y = (a) => y0 + (a - a0) * py, premier = serie.find((m) => m.news), aNews = +premier.mois.slice(0, 4);
  let s = "";
  "JFMAMJJASOND".split("").forEach((l, m) => { s += txt(X(m) + 16, y0 - 10, l, { c: "petit", anc: "middle" }); });
  for (let a = a0; a <= a1; a++) s += txt(x0 - 12, Y(a) + 12, a, { c: "petit", anc: "end" });
  serie.forEach((m, j) => {
    const x = X(+m.mois.slice(5) - 1), y = Y(+m.mois.slice(0, 4));
    s += `<rect class="${m.news ? "f-" : "c-"}${teinte(m)} a-pop" x="${x}" y="${n1(y)}" width="32" height="15" rx="2"${dl(j * 0.009)}/>`;
  });
  const xb = X(12) + 6, lien = (ya, yb, nom, d) => `<path class="t-enc fin a-fondu" d="M${xb} ${n1(ya)} h7 V${n1(yb)} h-7"${dl(d)}/>` + txt(xb + 22, (ya + yb) / 2, nom, { c: "petit", anc: "middle", rot: 90, d });
  s += lien(Y(a0), Y(aNews) - 4, "marchés seuls", 1.9) + lien(Y(aNews) + 2, Y(a1) + 15, `avec news, depuis ${lisible(premier.mois)}`, 2.1);
  const fin = serie[serie.length - 1];
  s += txt(X(+fin.mois.slice(5)) + 4, Y(a1) + 12, "← à prédire", { c: "fort", d: 2.2 });
  return { h: 400, corps: s, titre: `Les ${serie.length} mois du jeu de données`,
    texte: "Ce tableau se lit comme un calendrier, avec les années en lignes et les mois en colonnes. Une case bleue signale un mois suivi d'une hausse, une case rouge un mois suivi d'une baisse. Les cases pleines sont les mois pour lesquels nous avons aussi des articles de presse.",
    precis: `La couleur code la cible y, c'est-à-dire la baisse du Nikkei au mois t + 1. Les variables de news, tirées de GDELT et notées par FinBERT, n'existent qu'à partir d'${lisible(premier.mois).replace("avr.", "avril")}, et un indicateur signale leur absence avant cette date.`,
    legende: [["ind", "hausse le mois suivant"], ["ver", "baisse le mois suivant"], ["enc", "pas encore connu"]] };
}

/* ---------- Le découpage chronologique ---------- */
function decoupage(serie) {
  const R = 8, q = 17, blocs = ["entraînement", "validation", "test", "à prédire"], infos = [["Entraînement", "2010 - 2021", "on apprend"], ["Validation", "2022 - 2023", "on règle"], ["Test", "2024 - 2026", "on juge, une fois"], ["?", "", ""]];
  const tailles = blocs.map((b) => serie.filter((m) => m.bloc === b).length), colonnes = tailles.map((t) => Math.ceil(t / R)), ecart = 30;
  const large = colonnes.reduce((a, b) => a + b) * q + ecart * 3, x0 = (L - large) / 2, y0 = 150;
  const departs = colonnes.map((_, k) => x0 + colonnes.slice(0, k).reduce((a, b) => a + b, 0) * q + ecart * k), compte = [0, 0, 0, 0];
  let s = "";
  serie.forEach((m, j) => {
    const b = blocs.indexOf(m.bloc), k = compte[b]++;
    s += `<rect class="f-${teinte(m)} a-pop" x="${n1(departs[b] + Math.floor(k / R) * q)}" y="${y0 + (k % R) * q}" width="13" height="13" rx="1.5"${dl(j * 0.008)}/>`;
  });
  infos.forEach(([nom, annees, verbe], b) => {
    const mx = departs[b] + (colonnes[b] * q - 4) / 2, d = 0.3 + b * 0.5;
    s += txt(mx, y0 - 58, nom, { c: "fort", anc: "middle", d });
    if (annees) s += txt(mx, y0 - 40, `${tailles[b]} mois`, { anc: "middle", d }) + txt(mx, y0 - 22, annees, { c: "petit", anc: "middle", d });
    else s += txt(mx, y0 - 22, "à prédire", { c: "petit", anc: "middle", d });
    if (verbe) s += `<path class="t-enc fin a-fondu" d="M${n1(departs[b])} ${y0 + R * q + 8} v6 H${n1(departs[b] + colonnes[b] * q - 4)} v-6"${dl(1.9 + b * 0.2)}/>` + txt(mx, y0 + R * q + 34, verbe, { anc: "middle", d: 1.9 + b * 0.2 });
  });
  const ya = y0 + R * q + 74;
  s += `<path class="t-enc fin a-trace" pathLength="1" d="M${n1(x0)} ${ya} H${n1(x0 + large - 8)}" style="--t:1.8s"/><path class="f-enc a-fondu" d="M${n1(x0 + large)} ${ya} l-10 -5 v10 Z"${dl(1.8)}/>` + txt(x0, ya + 20, "le temps", { c: "petit" });
  return { h: 400, corps: s, titre: "Trois périodes, dans l'ordre du temps",
    texte: "Nous avons rangé les mois dans l'ordre et tracé deux frontières. Le modèle apprend sur le grand bloc de gauche, nous faisons nos réglages sur celui du milieu, et le bloc de droite sert d'examen final.",
    precis: `Découpage chronologique sans mélange : ${tailles[0]} mois d'entraînement, ${tailles[1]} de validation et ${tailles[2]} de test. La validation croisée temporelle (TimeSeriesSplit) se fait à l'intérieur de l'entraînement.`,
    legende: [["ind", "hausse le mois suivant"], ["ver", "baisse le mois suivant"]] };
}

/* ---------- Hausses et baisses, par période ---------- */
function classes(serie) {
  const blocs = [["entraînement", "Entraînement"], ["validation", "Validation"], ["test", "Test"]], W = 6, q = 14, centres = [150, 330, 510];
  const piles = blocs.map(([b]) => [serie.filter((m) => m.bloc === b && m.baisse === 0).length, serie.filter((m) => m.bloc === b && m.baisse === 1).length]);
  const y0 = 52 + Math.ceil(Math.max(...piles.map((p) => p[0])) / W) * q, compte = blocs.map(() => [0, 0]);
  let s = trait(60, y0, 590, y0, "axe");
  serie.forEach((m, j) => {
    const b = blocs.findIndex(([nom]) => nom === m.bloc); if (b < 0) return;
    const k = compte[b][m.baisse]++, x = centres[b] + (k % W - W / 2) * q, rang = Math.floor(k / W);
    s += `<rect class="f-${teinte(m)} a-pop" x="${x}" y="${m.baisse ? y0 + 5 + rang * q : y0 - 5 - (rang + 1) * q + 3}" width="11" height="11" rx="1.5"${dl(j * 0.008)}/>`;
  });
  piles.forEach(([h, b], k) => {
    const haut = y0 - 5 - Math.ceil(h / W) * q, bas = y0 + 5 + Math.ceil(b / W) * q, d = 1.6 + k * 0.2;
    s += txt(centres[k], haut - 26, blocs[k][1], { c: "fort", anc: "middle", d }) + txt(centres[k], haut - 8, `${h} hausses · ${fr(100 * h / (h + b))} %`, { c: "ind", anc: "middle", d });
    s += txt(centres[k], bas + 16, `${b} baisses · ${fr(100 * b / (h + b))} %`, { c: "ver", anc: "middle", d });
  });
  return { h: 410, corps: s, titre: "Hausses et baisses, période par période",
    texte: "Les mois suivis d'une hausse sont empilés vers le haut, les autres vers le bas. La pile du haut est toujours la plus grande, car la Bourse monte environ six mois sur dix. Quelqu'un qui annoncerait une hausse tous les mois aurait donc déjà souvent raison.",
    precis: `Classes déséquilibrées, avec ${fr(100 * piles[0][1] / (piles[0][0] + piles[0][1]))} % de baisses sur l'entraînement et ${fr(100 * piles[2][1] / (piles[2][0] + piles[2][1]))} % sur le test. Le modèle constant, qui annonce tous les mois la fréquence de l'entraînement, sert de référence à battre.`,
    legende: [["ind", "mois suivi d'une hausse"], ["ver", "mois suivi d'une baisse"]] };
}

/* ---------- Les essais d'Optuna ---------- */
function essais(journal) {
  const modeles = [["logit", "Logistique"], ["rf", "Random Forest"], ["lgbm", "LightGBM"]], E = journal.filter((e) => e.cible === "nikkei");
  const valeurs = E.map((e) => e.logloss).sort((a, b) => a - b), bas = valeurs[0] - 0.012, haut = valeurs[Math.floor(valeurs.length * 0.94)], x0 = 70, y0 = 44, y1 = 340, bande = 160, pas = 18;
  const Y = (v) => y1 - ((Math.min(v, haut) - bas) / (haut - bas)) * (y1 - y0), X = (e) => x0 + modeles.findIndex(([m]) => m === e.modele) * (bande + pas) + 8 + (e.essai / 49) * (bande - 16);
  let s = "";
  modeles.forEach(([, nom], k) => { s += `<rect class="voile" x="${x0 + k * (bande + pas)}" y="${y0 - 8}" width="${bande}" height="${y1 - y0 + 16}"/>` + txt(x0 + k * (bande + pas) + bande / 2, y1 + 34, nom, { c: "fort", anc: "middle" }); });
  [0.6, 0.65, 0.7].filter((v) => v > bas && v < haut).forEach((v) => { s += trait(x0, Y(v), x0 + 3 * bande + 2 * pas, Y(v)) + txt(x0 - 8, Y(v) + 4, fr(v, 2), { c: "petit", anc: "end" }); });
  s += trait(x0, Y(LOGLOSS_CONSTANTE_CV), x0 + 3 * bande + 2 * pas, Y(LOGLOSS_CONSTANTE_CV), "axe tiret a-fondu", dl(0.4)) + txt(x0 + 3 * bande + 2 * pas, Y(LOGLOSS_CONSTANTE_CV) - 7, `modèle constant · ${fr(LOGLOSS_CONSTANTE_CV, 3)}`, { c: "petit", anc: "end", d: 0.4 });
  E.forEach((e) => { s += `<circle class="f-enc clair a-tombe" cx="${n1(X(e))}" cy="${n1(Y(e.logloss))}" r="3.4"${dl(0.3 + e.essai * 0.022)}/>`; });
  modeles.forEach(([m]) => {
    const meilleur = E.filter((e) => e.modele === m).reduce((a, b) => (b.logloss < a.logloss ? b : a));
    s += `<circle class="f-enc a-pop" cx="${n1(X(meilleur))}" cy="${n1(Y(meilleur.logloss))}" r="6.5"${dl(1.7)}/><circle class="t-enc fin a-pop" cx="${n1(X(meilleur))}" cy="${n1(Y(meilleur.logloss))}" r="12"${dl(1.8)}/>`;
    s += txt(X(meilleur), Y(meilleur.logloss) + 30, fr(meilleur.logloss, 3), { c: "fort", anc: "middle", d: 1.9 });
  });
  s += txt(18, (y0 + y1) / 2, "log-loss en validation croisée (plus bas, c'est mieux)", { c: "petit", anc: "middle", rot: -90 });
  return { h: 400, corps: s, titre: `Les ${E.length} essais d'Optuna pour le Nikkei`,
    texte: "Un point correspond à une tentative de réglage, et plus il est bas, meilleur est le résultat. Le modèle le plus sophistiqué, à droite, descend le plus bas. Cette avance ne s'est pas confirmée sur les mois suivants, signe qu'il s'était trop adapté au passé.",
    precis: `Log-loss en validation croisée temporelle pour ${E.length} essais Optuna. Meilleurs essais : ${modeles.map(([m, nom]) => fr(Math.min(...E.filter((e) => e.modele === m).map((e) => e.logloss)), 3) + " pour " + nom).join(", ")}, contre ${fr(LOGLOSS_CONSTANTE_CV, 3)} pour le modèle constant.`,
    legende: [] };
}

/* ---------- Les mois face aux deux seuils ---------- */
function points(mois, seuils, titre, texte, precis) {
  const ps = mois.map((m) => m.p_hausse), bas = Math.min(...ps, seuils.theta_v) - 0.05, haut = Math.max(...ps, seuils.theta_a) + 0.05, x0 = 50, x1 = 600, sol = 300, pas = 21;
  const X = (p) => x0 + ((p - bas) / (haut - bas)) * (x1 - x0), piles = {};
  let s = `<rect class="zone-ver a-fondu" x="${x0}" y="60" width="${n1(X(seuils.theta_v) - x0)}" height="${sol - 60}"/><rect class="zone-ind a-fondu" x="${n1(X(seuils.theta_a))}" y="60" width="${n1(x1 - X(seuils.theta_a))}" height="${sol - 60}"/>`;
  s += trait(x0, sol, x1, sol, "axe");
  for (let v = Math.ceil(bas * 10) / 10; v < haut; v += 0.1) s += trait(X(v), sol, X(v), sol + 5, "axe") + txt(X(v), sol + 20, `${fr(100 * v)} %`, { c: "petit", anc: "middle" });
  s += txt(x1, sol + 42, "probabilité de hausse estimée par le modèle →", { c: "petit", anc: "end" });
  [["theta_v", "end"], ["theta_a", "start"]].forEach(([cle, anc], k) => {
    s += trait(X(seuils[cle]), 44, X(seuils[cle]), sol, "axe tiret a-fondu", dl(0.3 + k * 0.2)) + txt(X(seuils[cle]) + (k ? 6 : -6), 54, `seuil ${fr(seuils[cle], 3)}`, { c: "fort", anc, d: 0.3 + k * 0.2 });
  });
  s += txt((x0 + X(seuils.theta_v)) / 2, 82, "vendre", { c: "fort ver", anc: "middle", d: 0.6 }) + txt((X(seuils.theta_v) + X(seuils.theta_a)) / 2, 82, "neutre", { c: "fort gri", anc: "middle", d: 0.7 }) +
    txt((X(seuils.theta_a) + x1) / 2, 82, "acheter", { c: "fort ind", anc: "middle", d: 0.8 });
  mois.forEach((m, j) => {
    const c = Math.round(X(m.p_hausse) / pas), rang = piles[c] = (piles[c] || 0) + 1;
    s += `<circle class="f-${m.hausse_realisee ? "ind" : "ver"} a-tombe" cx="${c * pas}" cy="${sol - 12 - (rang - 1) * pas}" r="8.5"${dl(0.8 + j * 0.05)}/>`;
  });
  return { h: 360, corps: s, titre, texte, precis, legende: [["ind", "le Nikkei a monté ensuite"], ["ver", "il a baissé ensuite"]] };
}

/* ---------- Le test : action de la règle et issue du mois ---------- */
function confusion(mois) {
  const actions = ["vendre", "neutre", "acheter"], x0 = 96, y0 = 60, lc = 172, hl = 150, compte = {};
  mois.forEach((m) => { const cle = actions.indexOf(m.action) + "-" + (m.hausse_realisee ? 0 : 1); (compte[cle] = compte[cle] || []).push(m); });
  const nb = (c, l) => (compte[c + "-" + l] || []).length;
  const mots = [["vente à tort", "ventes à tort", "baisse évitée", "baisses évitées"], ["hausse manquée", "hausses manquées", "baisse évitée", "baisses évitées"], ["hausse captée", "hausses captées", "baisse subie", "baisses subies"]];
  let s = "";
  actions.forEach((a, c) => { s += txt(x0 + c * lc + lc / 2, y0 - 26, a, { c: "fort", anc: "middle" }) + txt(x0 + c * lc + lc / 2, y0 - 9, `${nb(c, 0) + nb(c, 1)} mois`, { c: "petit", anc: "middle" }); });
  s += txt(x0 - 44, y0 + hl / 2, "le Nikkei a monté", { c: "ind fort", anc: "middle", rot: -90 }) + txt(x0 - 26, y0 + hl / 2, `${mois.filter((m) => m.hausse_realisee).length} mois`, { c: "petit", anc: "middle", rot: -90 });
  s += txt(x0 - 44, y0 + hl * 1.5, "il a baissé", { c: "ver fort", anc: "middle", rot: -90 }) + txt(x0 - 26, y0 + hl * 1.5, `${mois.filter((m) => !m.hausse_realisee).length} mois`, { c: "petit", anc: "middle", rot: -90 });
  for (let c = 0; c <= 3; c++) s += `<path class="t-enc fin a-trace" pathLength="1" d="M${x0 + c * lc} ${y0} V${y0 + 2 * hl}" style="--t:.9s;--d:${(c * 0.08).toFixed(2)}s"/>`;
  for (let l = 0; l <= 2; l++) s += `<path class="t-enc fin a-trace" pathLength="1" d="M${x0} ${y0 + l * hl} H${x0 + 3 * lc}" style="--t:.9s;--d:${(0.3 + l * 0.08).toFixed(2)}s"/>`;
  actions.forEach((_, c) => [0, 1].forEach((l) => {
    const n = nb(c, l), x = x0 + c * lc + 16, y = y0 + l * hl, d = 0.9 + (c + l * 3) * 0.18;
    s += txt(x, y + 44, n, { c: `tres-grand ${l ? "ver" : "ind"}`, d }) + txt(x, y + 64, mots[c][l * 2 + (n > 1 ? 1 : 0)], { d });
    for (let k = 0; k < n; k++) s += `<circle class="f-${l ? "ver" : "ind"} a-pop" cx="${x + 7 + (k % 7) * 20}" cy="${y + 88 + Math.floor(k / 7) * 20}" r="7"${dl(d + 0.2 + k * 0.04)}/>`;
  }));
  const baisses = mois.filter((m) => !m.hausse_realisee).length, hausses = mois.length - baisses;
  return { h: 380, corps: s, titre: "Ce que la règle a fait pendant le test",
    texte: `Ce tableau compte ce que la règle a fait pendant le test. En bas, on voit qu'elle a évité ${nb(0, 1) + nb(1, 1)} baisses sur ${baisses}. En haut, on voit ce que cela a coûté : elle n'a profité que de ${nb(2, 0)} hausses sur ${hausses}.`,
    precis: `Matrice action × issue sur ${mois.length} mois. En prenant la baisse comme classe positive et « ne pas acheter » comme alerte, le rappel vaut ${nb(0, 1) + nb(1, 1)}/${baisses} et la précision ${nb(0, 1) + nb(1, 1)}/${nb(0, 0) + nb(0, 1) + nb(1, 0) + nb(1, 1)}.`,
    legende: [["ind", "le Nikkei a monté"], ["ver", "le Nikkei a baissé"]] };
}

/* ---------- Ce qui pèse dans la prévision du mois ---------- */
function contributions(liste) {
  const C = [...liste].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), max = Math.abs(C[0].contribution), xz = 330, pas = 30, y0 = 38;
  let s = txt(xz - 14, 18, "← vers la hausse", { c: "petit ind", anc: "end" }) + txt(xz + 14, 18, "vers la baisse →", { c: "petit ver" });
  C.forEach((c, k) => {
    const lg = Math.max(2, (Math.abs(c.contribution) / max) * 200), pos = c.contribution > 0, y = y0 + k * pas, d = 0.2 + k * 0.09;
    s += `<rect class="f-${pos ? "ver" : "ind"} ${pos ? "a-droite" : "a-gauche"}" x="${n1(pos ? xz : xz - lg)}" y="${y}" width="${n1(lg)}" height="16" rx="1.5"${dl(d)}/>`;
    s += txt(pos ? xz - 10 : xz + 10, y + 12.5, NOMS[c.variable] || c.variable, { c: k < 3 ? "fort" : "", anc: pos ? "end" : "start", d });
    s += txt(pos ? xz + lg + 8 : xz - lg - 8, y + 12.5, signe(c.contribution, 2), { c: "petit", anc: pos ? "start" : "end", d: d + 0.5 });
  });
  s += `<path class="t-enc fin a-trace" pathLength="1" d="M${xz} ${y0 - 8} V${y0 + C.length * pas}" style="--t:1s"/>`;
  return { h: y0 + C.length * pas + 8, corps: s, titre: "Ce qui pèse dans la prévision de novembre 2026",
    texte: "Ce graphique montre ce qui a fait pencher le modèle pour novembre 2026. Les barres rouges le poussent à annoncer une baisse, les bleues une hausse. La plus longue, tout en haut, vient du fait que la presse a publié deux fois plus d'articles que d'habitude en octobre.",
    precis: "Contributions SHAP du modèle linéaire, en log-odds de la baisse : φ = w × (z − moyenne d'entraînement de z). Leur somme, ajoutée au niveau moyen du modèle puis calibrée, donne la probabilité affichée.",
    legende: [["ver", "pousse vers la baisse"], ["ind", "pousse vers la hausse"]] };
}

/* ---------- Mois par mois, le modèle face au modèle constant ---------- */
function ecarts(mois, pBaisse) {
  const perte = (p, hausse) => -Math.log(hausse ? p : 1 - p), E = mois.map((m) => perte(m.p_hausse, m.hausse_realisee) - perte(1 - pBaisse, m.hausse_realisee));
  const max = Math.max(...E.map(Math.abs)), n = mois.length, x0 = 50, x1 = 610, y0 = 232, pas = (x1 - x0) / n, X = (k) => x0 + k * pas, annees = [...new Set(mois.map((m) => m.date.slice(0, 4)))];
  let s = "";
  annees.forEach((a, k) => {
    const idx = mois.map((m, j) => (m.date.startsWith(a) ? j : -1)).filter((j) => j >= 0), moyenne = idx.reduce((t, j) => t + E[j], 0) / idx.length, mx = (X(idx[0]) + X(idx[idx.length - 1] + 1)) / 2;
    if (k) s += trait(X(idx[0]) - 1, 30, X(idx[0]) - 1, 400, "grille");
    s += txt(mx, 40, a, { c: "fort", anc: "middle" }) + txt(mx, 60, `${signe(moyenne, 3)} en moyenne`, { c: moyenne < 0 ? "ind" : "ver", anc: "middle", d: 1.6 + k * 0.2 });
    s += txt(mx, 78, moyenne < 0 ? "le modèle fait mieux" : "il fait moins bien", { c: "petit", anc: "middle", d: 1.6 + k * 0.2 });
  });
  E.forEach((e, k) => {
    const ht = Math.max(1.5, (Math.abs(e) / max) * 130);
    s += `<rect class="f-${e > 0 ? "ver a-haut" : "ind a-bas"}" x="${n1(X(k) + 2.5)}" y="${n1(e > 0 ? y0 - ht : y0)}" width="${n1(pas - 5)}" height="${n1(ht)}" rx="1"${dl(0.2 + k * 0.035)}/>`;
  });
  s += trait(x0, y0, x1, y0, "axe") + txt(x0, 400, "↑ au-dessus de la ligne, le modèle se trompe plus que le modèle constant", { c: "petit" });
  return { h: 410, corps: s, titre: "Le modèle face au modèle constant, mois par mois",
    texte: "On compare ici, mois par mois, notre modèle à une prévision toute simple qui répéterait toujours la même chose. Une barre rouge vers le haut signale un mois où notre modèle a fait pire, une barre bleue vers le bas un mois où il a fait mieux. Le bleu ne l'emporte qu'en 2024.",
    precis: `Écart de log-loss mensuel entre la logistique calibrée et le modèle constant, qui annonce ${fr(100 * pBaisse)} % de baisses. Moyennes annuelles : ${annees.map((a) => { const idx = mois.map((m, j) => (m.date.startsWith(a) ? j : -1)).filter((j) => j >= 0); return signe(idx.reduce((t, j) => t + E[j], 0) / idx.length, 3) + " en " + a; }).join(", ")}.`,
    legende: [["ver", "le modèle fait moins bien"], ["ind", "le modèle fait mieux"]] };
}

/* ---------- La descente de gradient vue du dessus : courbes de niveau du coût ---------- */
function surface(d) {
  const A = d.axe, n = A.length, x0 = 150, y0 = 24, cote = 356, lim = A[n - 1], X = (w) => x0 + ((w + lim) / (2 * lim)) * cote, Y = (w) => y0 + cote - ((w + lim) / (2 * lim)) * cote;
  const Jmin = d.optimum[2], Jmax = Math.max(...d.cout.flat()), niveaux = Array.from({ length: 9 }, (_, k) => Jmin + (Jmax - Jmin) * Math.pow((k + 1) / 10, 1.7));
  const coupe = (a, b, va, vb, niv) => a + ((niv - va) / (vb - va)) * (b - a);
  const TABLE = { 1: [["g", "b"]], 2: [["b", "d"]], 3: [["g", "d"]], 4: [["h", "d"]], 5: [["h", "g"], ["b", "d"]], 6: [["h", "b"]], 7: [["h", "g"]], 8: [["h", "g"]], 9: [["h", "b"]], 10: [["h", "d"], ["g", "b"]], 11: [["h", "d"]], 12: [["g", "d"]], 13: [["b", "d"]], 14: [["g", "b"]] };
  let s = `<rect class="voile" x="${x0}" y="${y0}" width="${cote}" height="${cote}"/>`;
  niveaux.forEach((niv, q) => {
    let chemin = "";
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const hg = d.cout[j + 1][i], hd = d.cout[j + 1][i + 1], bd = d.cout[j][i + 1], bg = d.cout[j][i];        // j croît vers le haut de la figure
      const cas = (hg > niv ? 8 : 0) | (hd > niv ? 4 : 0) | (bd > niv ? 2 : 0) | (bg > niv ? 1 : 0);
      if (!TABLE[cas]) continue;
      const bords = { h: [coupe(A[i], A[i + 1], hg, hd, niv), A[j + 1]], b: [coupe(A[i], A[i + 1], bg, bd, niv), A[j]], g: [A[i], coupe(A[j], A[j + 1], bg, hg, niv)], d: [A[i + 1], coupe(A[j], A[j + 1], bd, hd, niv)] };
      TABLE[cas].forEach(([u, v]) => { chemin += `M${n1(X(bords[u][0]))} ${n1(Y(bords[u][1]))}L${n1(X(bords[v][0]))} ${n1(Y(bords[v][1]))}`; });
    }
    s += `<path class="niveau a-fondu" d="${chemin}"${dl(1.2 - q * 0.12)}/>`;
  });
  const trajet = d.trajectoires["classique (1/L)"].points, ligne = "M" + trajet.map((p) => `${n1(X(p[0]))} ${n1(Y(p[1]))}`).join(" L");
  s += `<path class="t-enc a-trace epais" pathLength="1" d="${ligne}" style="--t:2.4s;--d:1.3s"/>`;
  trajet.slice(0, 14).forEach((p, k) => { s += `<circle class="f-enc a-pop" cx="${n1(X(p[0]))}" cy="${n1(Y(p[1]))}" r="${k ? 3 : 6}"${dl(1.3 + k * 0.13)}/>`; });
  s += `<circle class="soleil a-pop" cx="${n1(X(d.optimum[0]))}" cy="${n1(Y(d.optimum[1]))}" r="8"${dl(3.4)}/>`;
  s += txt(X(trajet[0][0]) + 12, Y(trajet[0][1]) - 8, "départ", { c: "fort", d: 1.3 }) + txt(X(d.optimum[0]) + 14, Y(d.optimum[1]) + 22, `minimum · J = ${fr(Jmin, 3)}`, { c: "fort", d: 3.5 });
  s += txt(x0 + cote / 2, y0 + cote + 22, `poids w₁ · ${d.variables[0]}`, { c: "petit", anc: "middle" }) + txt(x0 - 14, y0 + cote / 2, `poids w₂ · ${d.variables[1]}`, { c: "petit", anc: "middle", rot: -90 });
  return { h: 412, corps: s, titre: "La descente de gradient, vue du dessus",
    texte: "Imaginez un bol vu du dessus : les cercles sont des lignes d'altitude et le point rouge marque le fond. Le modèle part du point noir et descend pas à pas vers le fond, comme une bille. Le fond est unique, il arrive donc toujours au même endroit.",
    precis: `Courbes de niveau du coût J(w₁, w₂) pour une régression logistique réduite à deux variables (${d.variables.join(", ")}), avec le même λ que le modèle final. Descente de gradient de pas 1/L sur un coût strictement convexe.`,
    legende: [] };
}

/* ---------- Les quarante essais faits après le test, face à la prévision constante ---------- */
function verifier(v) {
  const R = v.vingt_modeles.classement_sur_le_test, n = R.length, x0 = 236, x1 = 600, y0 = 52, pas = 9.4, min = -0.06, max = 0.115;
  const borne = (e) => Math.min(max, Math.max(min, e)), X = (e) => x0 + ((borne(e) - min) / (max - min)) * (x1 - x0), yBas = y0 + n * pas;
  const FENETRE = { croissante: "tout le passé", glissante: "60 mois" };
  let s = "";
  [-0.05, 0.05, 0.1].forEach((e) => { s += trait(X(e), y0 - 8, X(e), yBas, "grille") + txt(X(e), yBas + 16, signe(e, 2), { c: "petit", anc: "middle" }); });
  s += `<rect class="zone-ind a-fondu" x="${x0}" y="${y0 - 8}" width="${n1(X(0) - x0)}" height="${n1(yBas - y0 + 8)}"${dl(0.3)}/>`;
  s += `<path class="t-enc a-trace" pathLength="1" d="M${n1(X(0))} ${y0 - 14} V${n1(yBas)}" style="--t:1s"/>` + txt(X(0), y0 - 22, "prévision constante", { c: "fort", anc: "middle", d: 0.4 });
  s += txt(X(0) - 10, yBas + 34, "← fait mieux", { c: "petit ind", anc: "end" }) + txt(X(0) + 10, yBas + 34, "fait moins bien →", { c: "petit ver" });
  const projet = R.findIndex((r) => r.modele.startsWith("logistique L2 (modèle du projet)") && r.fenetre === "croissante");
  const choisi = R.findIndex((r) => r.modele === v.vingt_modeles.choix_sur_2016_2023 && r.fenetre === "glissante");
  const NOTES = { 0: "le mieux classé", [projet]: "modèle du projet, réentraîné", [choisi]: "le meilleur sur 2016-2023", [n - 1]: R[n - 1].modele };
  R.forEach((r, k) => {
    const y = y0 + k * pas, constant = r.modele.startsWith("constante") && r.fenetre === "croissante", c = constant ? "enc" : r.ecart < 0 ? "ind" : "ver", d = 0.5 + k * 0.045;
    if (!constant) s += `<line class="t-${c} fin clair a-fondu" x1="${n1(X(r.ecart - r.erreur_type))}" y1="${n1(y)}" x2="${n1(X(r.ecart + r.erreur_type))}" y2="${n1(y)}"${dl(d + 0.3)}/>`;
    s += r.ecart > max ? txt(x1 + 6, y + 4, `${signe(r.ecart, 2)} →`, { c: "petit ver", d }) : `<circle class="f-${c} a-pop" cx="${n1(X(r.ecart))}" cy="${n1(y)}" r="${constant ? 5.5 : 3.6}"${dl(d)}/>`;
    if (NOTES[k]) s += txt(x0 - 14, y + 4, `${NOTES[k]}${k === n - 1 ? "" : " · " + FENETRE[r.fenetre]}`, { c: k === projet ? "fort" : "", anc: "end", d }) + trait(x0 - 8, y, X(Math.min(r.ecart - r.erreur_type, 0)) - 6, y, "grille a-fondu", dl(d));
  });
  const gagnent = R.filter((r) => r.ecart < 0 && !r.modele.startsWith("constante")).length;
  return { h: yBas + 44, corps: s, titre: `${n} essais face à la prévision constante`,
    texte: `Les points représentent les ${n} essais, rangés du mieux classé au moins bon sur les 33 mois du test. À gauche du trait noir, un essai fait mieux que la prévision constante, et à droite il fait moins bien. Seuls ${gagnent} points passent à gauche, et leur barre d'incertitude déborde largement de l'autre côté.`,
    precis: `Écart de log-loss avec la constante réentraînée chaque mois, plus ou moins une erreur type, pour ${n / 2} modèles et deux fenêtres d'apprentissage. Le modèle choisi sur 2016-2023 (${v.vingt_modeles.choix_sur_2016_2023}) termine loin du haut du classement.`,
    legende: [["ind", "mieux que la constante"], ["ver", "moins bien"], ["enc", "la prévision constante"]] };
}

/* ---------- Second volet : la volatilité annoncée un mois avant, face à celle qui s'est produite ---------- */
function agitation(v) {
  const S = v.serie.filter((p) => p.reelle !== null), n = S.length, x0 = 56, x1 = 606, y0 = 44, y1 = 348, haut = 0.7, pas = (x1 - x0) / (n + 1);
  const X = (k) => x0 + (k + 0.5) * pas, Y = (vol) => y1 - (Math.min(vol, haut) / haut) * (y1 - y0), debut = S.findIndex((p) => p.bloc === "test");
  const suivant = (mois) => { const a = +mois.slice(0, 4), m = +mois.slice(5); return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`; };
  let s = `<rect class="voile a-fondu" x="${n1(X(debut) - pas / 2)}" y="${y0}" width="${n1(x1 - X(debut) + pas / 2)}" height="${y1 - y0}"${dl(1.2)}/>` + txt((X(debut) + x1) / 2, y0 + 16, "les 33 mois du test", { c: "petit", anc: "middle", d: 1.3 });
  [0.2, 0.4, 0.6].forEach((vol) => { s += trait(x0, Y(vol), x1, Y(vol), vol === 0.2 ? "axe tiret" : "grille") + txt(x0 - 8, Y(vol) + 4, `${fr(100 * vol)} %`, { c: "petit", anc: "end" }); });
  S.forEach((p, k) => {
    const an = suivant(p.mois);
    if (an.endsWith("-01") && +an.slice(0, 4) % 2 === 0) s += txt(X(k), y1 + 20, an.slice(0, 4), { c: "petit", anc: "middle" });
    s += `<rect class="f-${p.agite ? "ver" : "gri"} a-haut" x="${n1(X(k) - pas * 0.36)}" y="${n1(Y(p.reelle))}" width="${n1(pas * 0.72)}" height="${n1(y1 - Y(p.reelle))}"${dl(0.15 + k * 0.012)}/>`;
  });
  s += trait(x0, y1, x1, y1, "axe");
  const tout = v.serie, prevue = "M" + tout.map((p, k) => `${n1(X(k))} ${n1(Y(p.prevue))}`).join(" L");
  s += `<path class="t-ind a-trace epais" pathLength="1" d="${prevue}" style="--t:2.6s;--d:.9s"/>`;
  const pic = S.reduce((a, p, k) => (p.reelle > S[a].reelle ? k : a), 0);
  s += txt(X(pic) - 10, Y(S[pic].reelle) + 14, `${lisible(suivant(S[pic].mois))} · ${fr(100 * S[pic].reelle)} %`, { c: "fort ver", anc: "end", d: 1.9 });
  const dernier = tout[tout.length - 1], k = tout.length - 1;
  s += `<circle class="f-ind a-pop" cx="${n1(X(k))}" cy="${n1(Y(dernier.prevue))}" r="5.5"${dl(3.4)}/>` + trait(X(k), Y(dernier.prevue) - 8, X(k), Y(0.5) + 8, "t-ind fin a-fondu", dl(3.4)) +
    txt(X(k) + 2, Y(0.5) - 22, `prévu pour ${lisible(suivant(dernier.mois))}`, { c: "ind", anc: "end", d: 3.5 }) + txt(X(k) + 2, Y(0.5), `${fr(100 * dernier.prevue)} %`, { c: "grand ind", anc: "end", d: 3.6 });
  const r2 = v.prevision.test_2024_2026.methodes[v.methode.methode_retenue_pour_l_usage].r2_hors_echantillon, auc = v.agitation.test_2024_2026.modeles.logistique.auc;
  return { h: 384, corps: s, titre: "La volatilité du Nikkei, annoncée un mois avant",
    texte: "Les barres donnent l'agitation réelle du Nikkei, mois après mois : grises les mois calmes, rouges les mois agités. La courbe bleue est celle que nous annoncions un mois plus tôt. Elle monte et redescend avec les barres, sans prévoir les secousses soudaines comme celle d'août 2024.",
    precis: `Volatilité réalisée (écart-type annualisé des rendements journaliers du mois) et prévision d'une régression sur les volatilités à 1, 3 et 6 mois, le VIX et le rendement du mois, réentraînée chaque mois. R² hors échantillon de ${fr(r2, 2)} sur le test, AUC de ${fr(auc, 2)} pour les mois agités.`,
    legende: [["gri", "mois calme"], ["ver", "mois agité (plus de 20 %, le trait pointillé)"], ["ind", "volatilité annoncée un mois avant"]] };
}

/* ---------- Le signal fondé sur le risque : 1 € placé en 2003, et la bande du signal ---------- */
function risque(v) {
  const S = v.serie, n = S.length, x0 = 56, x1 = 500, y0 = 40, y1 = 300, b0 = 326, b1 = 350;
  const vals = S.flatMap((p) => [p.garder, p.regle]), bas = Math.log(Math.min(...vals) * 0.92), haut = Math.log(Math.max(...vals) * 1.05);
  const X = (k) => x0 + (k / (n - 1)) * (x1 - x0), Y = (val) => y1 - ((Math.log(val) - bas) / (haut - bas)) * (y1 - y0);
  const chemin = (cle) => "M" + S.map((p, k) => `${n1(X(k))} ${n1(Y(p[cle]))}`).join(" L");
  let s = "";
  [0.5, 1, 2, 4].filter((g) => Math.log(g) > bas && Math.log(g) < haut).forEach((g) => {
    s += trait(x0, Y(g), x1, Y(g), g === 1 ? "axe" : "grille") + txt(x0 - 8, Y(g) + 4, `${fr(g, g < 1 ? 1 : 0)} €`, { c: "petit", anc: "end" });
  });
  // bande du signal : une case par semaine
  const couleur = { 1: "ind", 0.5: "gri", 0: "ver" }, w = (x1 - x0) / (n - 1);
  let debut = 0;
  for (let k = 1; k <= n; k++) {
    if (k === n || S[k].signal !== S[debut].signal) {
      s += `<rect class="f-${couleur[S[debut].signal]} a-fondu" x="${n1(X(debut) - w / 2)}" y="${b0}" width="${n1(w * (k - debut))}" height="${b1 - b0}"${dl(0.6 + (debut / n) * 1.6)}/>`;
      debut = k;
    }
  }
  s += txt(x0 - 8, b1 - 6, "signal", { c: "petit", anc: "end" });
  S.forEach((p, k) => { if (k && p.date.slice(0, 4) !== S[k - 1].date.slice(0, 4) && +p.date.slice(0, 4) % 4 === 0) s += txt(X(k), b1 + 18, p.date.slice(0, 4), { c: "petit", anc: "middle" }); });
  // les trois crises
  [["2008-10", "2008"], ["2020-03", "2020"], ["2024-08", "août 2024"]].forEach(([m, t], i) => {
    const k = S.findIndex((p) => p.date.startsWith(m)); if (k < 0) return;
    s += trait(X(k), y0 + 8, X(k), b0 - 16, "t-gri fin tiret a-fondu", dl(2.4 + i * 0.2)) + txt(X(k) + (i ? -4 : 4), b0 - 6, t, { c: "petit", anc: i ? "end" : "start", d: 2.4 + i * 0.2 });
  });
  s += `<path class="t-ind a-trace epais" pathLength="1" d="${chemin("garder")}" style="--t:2.6s"/><path class="t-enc a-trace epais" pathLength="1" d="${chemin("regle")}" style="--t:2.6s;--d:.35s"/>`;
  const fin = S[n - 1], ecart = Math.abs(Y(fin.garder) - Y(fin.regle)) < 40 ? 22 : 0;
  s += `<circle class="f-ind a-pop" cx="${n1(X(n - 1))}" cy="${n1(Y(fin.garder))}" r="5"${dl(2.8)}/><circle class="f-enc a-pop" cx="${n1(X(n - 1))}" cy="${n1(Y(fin.regle))}" r="5"${dl(3)}/>`;
  s += txt(X(n - 1) + 12, Y(fin.garder) - ecart + 4, `${fr(fin.garder, 2)} €`, { c: "grand ind", d: 2.9 }) + txt(X(n - 1) + 12, Y(fin.garder) - ecart + 22, "acheter et garder", { c: "ind", d: 3 });
  s += txt(X(n - 1) + 12, Y(fin.regle) + ecart + 4, `${fr(fin.regle, 2)} €`, { c: "grand", d: 3.1 }) + txt(X(n - 1) + 12, Y(fin.regle) + ecart + 22, "signal risque", { d: 3.2 });
  const t = v.strategies["2003-2026 (tout)"], g = t["acheter et garder"], r = t["signal risque, chaque jour (règle figée)"];
  return { h: 380, corps: s, titre: `1 € placé en ${S[0].date.slice(0, 4)}, avec et sans le signal`,
    texte: "La courbe bleue suit un épargnant qui achète et ne touche à rien. La noire suit le signal, qui investit plein, à moitié ou pas du tout selon le risque annoncé (la bande du bas). Le signal évite une bonne part de 2008, mais il sort après les chutes éclair de 2020 et d'août 2024 et rate leur rebond.",
    precis: `Euros couverts contre le yen, indices sans dividendes, échelle logarithmique. Rendement par unité de risque ${fr(r.rendement_par_unite_de_risque, 2)} contre ${fr(g.rendement_par_unite_de_risque, 2)} ; volatilité ${fr(r["volatilite_%"])} % contre ${fr(g["volatilite_%"])} % ; pire perte ${fr(r["perte_maximale_%"])} % contre ${fr(g["perte_maximale_%"])} %. Règle figée sur 2000-2015.`,
    legende: [["ind", "acheter et garder, ou signal « acheter plein »"], ["enc", "signal risque (règle figée)"], ["gri", "signal « acheter à moitié »"], ["ver", "signal « ne pas acheter »"]] };
}

// ----- Données, puis un graphique par chapitre
const ouvertures = [...document.querySelectorAll("[data-chapitre]")];
document.documentElement.classList.add("anime");          // les entrées animées ne masquent le texte que si ce script tourne
const planches = Object.fromEntries([...document.querySelectorAll(".planche")].map((el) => [el.dataset.planche, el]));
const [serie, test, validation, signal, evaluation, explication, cout, journal, verifications, volatilite, signalRisque] = await Promise.all([api("serie"), api("historique", { bloc: "test" }),
  api("historique", { bloc: "validation" }), api("signal"), api("evaluation"), api("explication"), api("surface"), api("essais"), api("verifications"), api("volatilite"), api("signal_risque")]);
const seuils = signal?.seuils ?? { theta_v: 0.456, theta_a: 0.58 };
const pConstante = evaluation?.metriques?.["constante (fréquence de l'entraînement)"]?.["proba moyenne"] ?? 0.3916;
const FIGURES = {
  haut: () => serie && courbe(serie, "ouverture"), resultat: () => test && performance(test),
  explorateur: () => signal && jauge(signal.p_hausse, seuils, "Le signal du mois, tel que le modèle le calcule"),
  dataset: () => serie && calendrier(serie), methode: () => serie && decoupage(serie), exploration: () => serie && classes(serie), modeles: () => journal && essais(journal),
  decision: () => validation && points(validation, seuils, "Les 24 mois de validation face aux deux seuils",
    "Les points sont des mois, placés selon la chance de hausse que le modèle leur donnait. S'il voyait juste, les points bleus (hausses) seraient à droite et les rouges (baisses) à gauche. On voit qu'ils sont mélangés.",
    `Probabilités calibrées sur les 24 mois de validation, face aux seuils θ = ${fr(seuils.theta_v, 3)} et θ = ${fr(seuils.theta_a, 3)}. La log-loss y vaut 0,699 contre 0,681 pour le modèle constant.`),
  test: () => test && confusion(test),
  simulateur: () => test && points(test, seuils, "Les 33 mois du test face aux deux seuils",
    "Voici cette fois les 33 mois du test. La plupart tombent dans les zones « vendre » et « neutre », y compris beaucoup de mois bleus qui ont fini en hausse. Dans le simulateur, changer la marge revient à déplacer les deux traits pointillés.",
    "Les seuils découlent de la marge m : θ = (m − B_d) / (B_u − B_d) pour acheter et θ = (S_d − m) / (S_d − S_u) pour vendre, où B et S sont les gains moyens de l'achat et de la vente mesurés sur l'entraînement."),
  projection: () => explication && contributions(explication), regime: () => serie && courbe(serie, "regime"), pourquoi: () => test && ecarts(test, pConstante), maths: () => cout && surface(cout),
  verifications: () => verifications && verifier(verifications), volatilite: () => volatilite && agitation(volatilite), risque: () => signalRisque && risque(signalRisque),
};
Object.entries(planches).forEach(([cle, el]) => {
  const f = FIGURES[cle]?.();
  if (!f) { el.querySelector("figcaption").innerHTML = '<p class="lecture">Graphique indisponible : l\'API Python ne répond pas.</p>'; return; }
  el.querySelector(".dessin").innerHTML = svg(f.h, f.corps);
  el.querySelector("figcaption").innerHTML = `<span class="lecture">Lecture du graphique</span><h4>${f.titre}</h4><p>${f.texte}</p><p class="precis"><b>En termes techniques.</b> ${f.precis}</p>` +
    (f.legende.length ? `<ul>${f.legende.map(([c, t]) => `<li><i class="f-${c}"></i>${t}</li>`).join("")}</ul>` : "");
});

// ----- Les graphiques se jouent quand ils entrent à l'écran, et se rejouent quand on y revient.
// La position est contrôlée directement (au défilement, et deux fois par seconde) : un graphique visible n'attend jamais.
function jouer() {
  Object.values(planches).forEach((el) => {
    const r = el.getBoundingClientRect(), visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (IMMOBILE || visible >= Math.min(r.height, innerHeight) * 0.35) el.classList.add("joue");
    else if (visible <= 0) el.classList.remove("joue");
  });
  ouvertures.forEach((o) => {                         // l'entrée en cascade du titre et des textes, rejouée à chaque passage
    const r = o.getBoundingClientRect(), visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (IMMOBILE || visible >= innerHeight * 0.3) o.classList.add("vue"); else if (visible <= 0) o.classList.remove("vue");
  });
}
addEventListener("scroll", jouer, { passive: true }); addEventListener("resize", jouer); setInterval(jouer, 500); jouer();

// Le prédicteur met à jour la jauge de son chapitre
document.addEventListener("nikkei:prediction", (e) => {
  const s = e.detail, el = planches.explorateur; if (!el || !s || typeof s.p_hausse !== "number") return;
  const t = s.seuils ?? seuils, action = s.p_hausse < t.theta_v ? "vendre" : s.p_hausse < t.theta_a ? "rester neutre" : "acheter";
  el.querySelector(".aiguille")?.style.setProperty("--p", s.p_hausse.toFixed(4));
  const valeur = el.querySelector("#jauge-valeur"), texte = el.querySelector("#jauge-action");
  if (valeur) valeur.textContent = `${fr(100 * s.p_hausse, 1)} %`;
  if (texte) texte.textContent = `de probabilité de hausse · la règle dirait « ${action} »`;
});

// ----- Le rail : les chapitres de la page, sur le bord gauche
const rail = Object.assign(document.createElement("nav"), { id: "rail", ariaLabel: "Chapitres" });
rail.innerHTML = ouvertures.map((o, k) => `<a href="#${o.dataset.chapitre}"><i></i><span>${String(k).padStart(2, "0")} · ${o.dataset.court}</span></a>`).join("");
document.body.append(rail);
const liens = [...rail.querySelectorAll("a")];
const suivre = () => { let k = 0; ouvertures.forEach((o, n) => { if (o.getBoundingClientRect().top < innerHeight * 0.6) k = n; }); liens.forEach((l, n) => l.classList.toggle("actif", n === k)); };
addEventListener("scroll", suivre, { passive: true }); suivre();

// ----- Mode présentation : chaque ouverture devient une diapositive, le détail ne s'ouvre qu'à la demande.
// Une diapositive ne montre d'abord que le message en clair et le graphique : la touche T ajoute la version technique.
// Touches : P pour entrer ou sortir, flèches ou espace pour avancer, T pour la version technique, D pour le détail du chapitre, Échap pour quitter.
const telecommande = Object.assign(document.createElement("div"), { id: "telecommande" });
telecommande.innerHTML = '<button type="button" data-geste="lancer" class="lancer">Présenter <kbd>P</kbd></button>' +
  '<button type="button" data-geste="avant" aria-label="Diapositive précédente">←</button><span id="diapo-numero"></span>' +
  '<button type="button" data-geste="apres" aria-label="Diapositive suivante">→</button>' +
  '<button type="button" data-geste="technique">Technique <kbd>T</kbd></button><button type="button" data-geste="detail">Détail <kbd>D</kbd></button><button type="button" data-geste="quitter">Quitter <kbd>Échap</kbd></button>';
document.body.append(telecommande);
const racine = document.documentElement, numero = telecommande.querySelector("#diapo-numero");
const courante = () => { let k = 0; ouvertures.forEach((o, n) => { if (o.getBoundingClientRect().top < innerHeight * 0.5) k = n; }); return k; };
// Entre deux diapositives : la transition 3D (passage3d.js), chargée à l'entrée dans le mode présentation.
// Si WebGL n'est pas disponible, un rideau d'encre plus simple prend le relais.
const passage = Object.assign(document.createElement("div"), { id: "passage", innerHTML: "<b></b><span></span>" });
document.body.append(passage);
let enPassage = false, passer3d = null;
const charger3d = () => passer3d ?? import("./passage3d.js").then((m) => (passer3d = m.passer)).catch(() => (passer3d = false));
function basculerVers(cible) {                        // le changement de diapositive, pendant que l'écran est couvert
  ouvertures.forEach((o) => o.classList.remove("technique", "vue"));
  cible.querySelector(".planche")?.classList.remove("joue");
  cible.scrollIntoView({ behavior: "instant", block: "start" });
  afficherNumero();
}
function montrer(k) {
  k = Math.max(0, Math.min(ouvertures.length - 1, k));
  const cible = ouvertures[k];
  if (!racine.classList.contains("presente") || IMMOBILE) { cible.scrollIntoView({ behavior: IMMOBILE ? "auto" : "smooth", block: "start" }); return; }
  if (enPassage || k === courante()) return;
  enPassage = true;
  const signe = cible.querySelector("[data-signe]")?.dataset.signe ?? "日経", libelle = `${String(k + 1).padStart(2, "0")} / ${ouvertures.length} · ${cible.dataset.court}`;
  if (typeof passer3d === "function" && passer3d(signe, libelle, () => basculerVers(cible))) {
    setTimeout(() => { jouer(); enPassage = false; }, 1250);       // la diapositive entre en scène pendant que les gouttes éclatent
    return;
  }
  passage.querySelector("b").textContent = signe; passage.querySelector("span").textContent = libelle;
  passage.className = "ferme";
  setTimeout(() => { basculerVers(cible); passage.className = "ouvre"; }, 460);
  setTimeout(() => jouer(), 640);
  setTimeout(() => { passage.className = ""; enPassage = false; }, 1120);
}
const afficherNumero = () => { const k = courante(); numero.textContent = `${String(k + 1).padStart(2, "0")} / ${ouvertures.length} · ${ouvertures[k].dataset.court}`; };
function presenter(actif, parGeste = false) {
  const k = courante();
  racine.classList.toggle("presente", actif);
  document.querySelectorAll(".detail-ouvert").forEach((el) => el.classList.remove("detail-ouvert"));
  ouvertures.forEach((o) => o.classList.remove("technique"));
  history.replaceState(null, "", actif ? "?presenter" : location.pathname);
  setTimeout(() => { ouvertures[k].scrollIntoView({ behavior: "instant", block: "start" }); afficherNumero(); jouer(); }, 60);   // la mise en page a changé : on se recale sur la diapositive
  if (actif && !IMMOBILE) Promise.resolve(charger3d()).then(() => {            // ouverture du mode : les gouttes écrivent « Nikkei »
    if (typeof passer3d !== "function" || enPassage || !parGeste) return;
    enPassage = true; ouvertures[k].classList.remove("vue");
    passer3d("日経", "Projet Nikkei · présentation", () => basculerVers(ouvertures[k]));
    setTimeout(() => { jouer(); enPassage = false; }, 1250);
  });
}
const technique = () => ouvertures[courante()].classList.toggle("technique");      // affiche ou masque la version technique de la diapositive
function detail() {                                   // ouvre ou referme le détail du chapitre affiché
  const k = courante(), section = ouvertures[k].closest("section"); if (!section) return;
  const ouvert = section.classList.toggle("detail-ouvert");
  dispatchEvent(new Event("resize"));                 // les graphiques et la scène 3D du détail se remesurent
  if (ouvert) section.querySelector(".detail")?.scrollIntoView({ behavior: IMMOBILE ? "auto" : "smooth", block: "start" });
  else ouvertures[k].scrollIntoView({ behavior: "instant", block: "start" });
}
telecommande.addEventListener("click", (e) => {
  const bouton = e.target.closest("button"), geste = bouton?.dataset.geste; bouton?.blur();
  if (geste === "lancer") presenter(true, true); else if (geste === "quitter") presenter(false);
  else if (geste === "avant") montrer(courante() - 1); else if (geste === "apres") montrer(courante() + 1); else if (geste === "detail") detail(); else if (geste === "technique") technique();
});
addEventListener("keydown", (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target?.closest?.("input, select, textarea")) return;
  const enMode = racine.classList.contains("presente");
  if (e.key === "p" || e.key === "P") { e.preventDefault(); presenter(!enMode, true); return; }
  if (!enMode) return;
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); montrer(courante() + 1); }
  else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); montrer(courante() - 1); }
  else if (e.key === "d" || e.key === "D") { e.preventDefault(); detail(); }
  else if (e.key === "t" || e.key === "T") { e.preventDefault(); technique(); }
  else if (e.key === "Escape") presenter(false);
});
// La souris donne un peu de profondeur : le graphique et le grand signe glissent en sens inverse
addEventListener("pointermove", (e) => { racine.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3)); racine.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3)); }, { passive: true });
addEventListener("scroll", afficherNumero, { passive: true }); setInterval(afficherNumero, 500); afficherNumero();
document.querySelectorAll("[data-presenter]").forEach((lien) => lien.addEventListener("click", (e) => { e.preventDefault(); presenter(true, true); }));
if (new URLSearchParams(location.search).has("presenter")) presenter(true);
