/* Projet Nikkei — les tableaux du récit (/recit). Chaque tableau est une figure réelle du projet, dessinée par le nuage
   de gouttes d'encre à partir des données de l'API. Un tableau = { forme, reperes, titre, texte, legende, tourne }.
   Une seule grammaire de couleurs sur toute la page :
     indigo    = hausse, achat, ce qui joue pour nous
     vermillon = baisse, vente, ce qui joue contre nous
     encre     = le modèle, la structure, ce qui n'est pas encore connu
   Repères : { p: [x, y, z], t: texte, a: ancrage (h, b, g, d, hg, hd, bg, bd), fort } */
import { h, ENCRE, VERMILLON, INDIGO, GRIS, melange, surface as surfaceDeCout } from "./formes.js";

const PAPIER = [0.945, 0.918, 0.859];
export const TEINTES = { encre: "#15110e", vermillon: "#de3220", indigo: "#26407c", gris: "#8c8276" };
export const fr = (v, d = 0) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−");
export const signe = (v, d = 1) => (v >= 0 ? "+" : "−") + fr(Math.abs(v), d);
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const lisible = (m) => `${MOIS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? "s" : ""}`;
const classe = (m) => (m.baisse === null ? ENCRE : m.baisse ? VERMILLON : INDIGO);

// Les trois gestes : remplir une case, remplir un disque, tirer un trait. Les mêmes hasards d'un tableau à l'autre,
// pour que chaque goutte garde sa place dans son mois quand le nuage se recompose.
const caseDe = (i, cx, cy, l, ht, creuse = false) => {
  let u = h(i, 2), v = h(i, 3);
  if (creuse) { const c = h(i, 4); if (c < 0.25) u = 0; else if (c < 0.5) u = 1; else if (c < 0.75) v = 0; else v = 1; }
  return [cx + (u - 0.5) * l, cy + (v - 0.5) * ht, (h(i, 5) - 0.5) * 0.05];
};
const disque = (i, cx, cy, r) => { const a = h(i, 2) * 6.2832, d = Math.sqrt(h(i, 3)) * r; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, (h(i, 5) - 0.5) * 0.05]; };
const trait = (i, x1, y1, x2, y2, e = 0.018) => { const t = h(i, 2); return [x1 + (x2 - x1) * t + (h(i, 3) - 0.5) * e, y1 + (y2 - y1) * t + (h(i, 4) - 0.5) * e, 0]; };

/* ---------- 1. La courbe : le Nikkei 225, une colonne d'encre par mois ---------- */
export function courbe(serie, mode = "encre") {
  const n = serie.length, logs = serie.map((d) => Math.log(d.cloture)), min = Math.min(...logs), max = Math.max(...logs), bas = -1.75;
  const X = (j) => (j / (n - 1) - 0.5) * 5.2, Y = (j) => ((logs[j] - min) / (max - min)) * 3.15 - 1.45;
  const coupe = serie.findIndex((d) => d.mois === "2022-01"), teinte = (j) => (mode === "regime" && j >= coupe ? VERMILLON : ENCRE);
  const forme = (i) => {
    if (mode === "regime" && h(i, 9) < 0.04) return [...trait(i, X(coupe), bas, X(coupe), 1.8), ...ENCRE];
    const j = i % n, k = Math.min(n - 1, j + 1);
    if (h(i, 6) < 0.36) { const t = h(i, 2); return [X(j) + (X(k) - X(j)) * t, Y(j) + (Y(k) - Y(j)) * t + (h(i, 3) - 0.5) * 0.05, (h(i, 5) - 0.5) * 0.07, ...teinte(j)]; }
    return [X(j) + (h(i, 2) - 0.5) * 0.02, bas + (Y(j) - bas) * Math.sqrt(h(i, 3)), (h(i, 5) - 0.5) * 0.05, ...melange(teinte(j), PAPIER, 0.25 + 0.5 * h(i, 7))];
  };
  const debut = { p: [X(0), bas, 0], t: `${lisible(serie[0].mois)} · ${fr(serie[0].cloture)}`, a: "bd" };
  const fin = { p: [X(n - 1), Y(n - 1), 0], t: `${lisible(serie[n - 1].mois)} · ${fr(serie[n - 1].cloture)}`, a: "hg", fort: true };
  if (mode === "regime") return { forme, titre: "Le Nikkei, coupé en deux époques",
    texte: "La même courbe qu'en ouverture. À gauche du trait, les 143 mois sur lesquels le modèle a appris. À droite, le monde dans lequel il a dû prédire.",
    legende: [["encre", "2010 → 2021 : entraînement"], ["vermillon", "depuis 2022 : validation et test"]],
    reperes: [{ p: [X(coupe), 1.8, 0], t: "janv. 2022 · la Banque du Japon normalise", a: "hg", fort: true },
      { p: [X(coupe / 2), bas, 0], t: "ce que le modèle a appris", a: "b" }, { p: [X((coupe + n) / 2), bas, 0], t: "ce qu'il a dû prédire", a: "b" }] };
  return { forme, titre: "Le Nikkei 225, de 2010 à 2026",
    texte: `${n} clôtures mensuelles, en échelle logarithmique. Chaque colonne d'encre est un mois : ce sont ces ${n} mois que le nuage va trier, découper et juger tout au long de la page.`,
    legende: [["encre", "une colonne = un mois"]], reperes: [debut, fin] };
}

/* ---------- 2. Le calendrier : le dataset, une case par mois ---------- */
export function calendrier(serie) {
  const a0 = +serie[0].mois.slice(0, 4), a1 = +serie[serie.length - 1].mois.slice(0, 4), px = 0.405, py = 3.5 / (a1 - a0);
  const X = (m) => (m - 5.5) * px + 0.2, Y = (a) => 1.6 - (a - a0) * py, place = (d) => [X(+d.mois.slice(5) - 1), Y(+d.mois.slice(0, 4))];
  const forme = (i) => { const d = serie[i % serie.length], [x, y] = place(d); return d.news ? [...caseDe(i, x, y, 0.33, 0.15), ...classe(d)] : [...caseDe(i, x, y, 0.3, 0.03), ...melange(classe(d), PAPIER, 0.35)]; };
  const dernier = serie[serie.length - 1], news = serie.find((d) => d.news);
  const reperes = [...[a0, 2014, +news.mois.slice(0, 4), 2022, a1].map((a) => ({ p: [X(0) - 0.3, Y(a), 0], t: String(a), a: "g" })),
    ...["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"].map((l, m) => ({ p: [X(m), Y(a0) + 0.14, 0], t: l, a: "h" })),
    { p: [X(+dernier.mois.slice(5) - 1), Y(a1) - 0.1, 0], t: `${lisible(dernier.mois)} · à prédire`, a: "b", fort: true }];
  return { forme, reperes, titre: `Le dataset : ${serie.length} mois, une case par mois`,
    texte: `Une ligne par année, une colonne par mois. Les cases pleines ont des news (à partir d'${lisible(news.mois).replace("avr.", "avril")}) ; les simples traits n'ont que les marchés. La couleur dit ce que le Nikkei a fait le mois suivant : c'est la cible.`,
    legende: [["indigo", "le mois suivant a monté"], ["vermillon", "il a baissé"], ["encre", "pas encore connu"]] };
}

/* ---------- 3. Le découpage : les mêmes mois, rangés dans l'ordre du temps ---------- */
export function decoupage(serie) {
  const R = 10, blocs = ["entraînement", "validation", "test", "à prédire"], tailles = blocs.map((b) => serie.filter((d) => d.bloc === b).length);
  const colonnes = tailles.map((t) => Math.ceil(t / R)), ecart = 2.2, q = 5.2 / (colonnes.reduce((a, b) => a + b) + ecart * 3);
  const departs = colonnes.map((_, k) => -2.6 + q * (colonnes.slice(0, k).reduce((a, b) => a + b, 0) + ecart * k));
  const rangs = {}; const compte = [0, 0, 0, 0];
  serie.forEach((d, j) => { const b = blocs.indexOf(d.bloc); rangs[j] = [b, compte[b]++]; });
  const haut = (R * q) / 2;
  const forme = (i) => {
    if (h(i, 9) < 0.03) return [...trait(i, -2.6, -haut - 0.22, 2.6, -haut - 0.22), ...GRIS];
    const j = i % serie.length, [b, k] = rangs[j];
    return [...caseDe(i, departs[b] + (Math.floor(k / R) + 0.5) * q, haut - (k % R + 0.5) * q, q * 0.74, q * 0.74), ...classe(serie[j])];
  };
  const milieu = (b) => departs[b] + (colonnes[b] * q) / 2;
  return { forme, titre: "Le découpage : apprendre, régler, juger",
    texte: "Les mêmes mois, rangés dans l'ordre du temps et jamais mélangés : on apprend sur le passé, on règle sur 2022-2023, on juge une seule fois sur 2024-2026.",
    legende: [["indigo", "hausse le mois suivant"], ["vermillon", "baisse"], ["encre", "à prédire"]],
    reperes: [{ p: [milieu(0), haut + 0.08, 0], t: `entraînement · ${tailles[0]} mois · 2010 → 2021`, a: "h", fort: true },
      { p: [milieu(1), haut + 0.08, 0], t: `validation · ${tailles[1]}`, a: "h", fort: true }, { p: [milieu(2), haut + 0.08, 0], t: `test · ${tailles[2]}`, a: "h", fort: true },
      { p: [milieu(3), haut - q, 0], t: "à prédire", a: "bd" }, { p: [2.6, -haut - 0.26, 0], t: "le temps →", a: "bg" }] };
}

/* ---------- 4. Les classes : hausses empilées vers le haut, baisses vers le bas ---------- */
export function classes(serie) {
  const blocs = ["entraînement", "validation", "test"], L = 6, q = 0.148, centres = [-1.75, 0, 1.75];
  const piles = blocs.map((b) => ({ h: serie.filter((d) => d.bloc === b && d.baisse === 0).length, b: serie.filter((d) => d.bloc === b && d.baisse === 1).length }));
  const y0 = -1.85 + Math.ceil(Math.max(...piles.map((p) => p.b)) / L) * q + 0.05, places = {}, compte = blocs.map(() => [0, 0]);
  serie.forEach((d, j) => {
    const b = blocs.indexOf(d.bloc);
    if (b < 0) { places[j] = [2.45, y0]; return; }
    const k = compte[b][d.baisse]++, sens = d.baisse ? -1 : 1;
    places[j] = [centres[b] + (k % L - (L - 1) / 2) * q, y0 + sens * (0.07 + (Math.floor(k / L) + 0.5) * q)];
  });
  const forme = (i) => {
    if (h(i, 9) < 0.03) return [...trait(i, -2.6, y0, 2.6, y0), ...GRIS];
    const j = i % serie.length; return [...caseDe(i, places[j][0], places[j][1], q * 0.76, q * 0.76), ...classe(serie[j])];
  };
  const reperes = piles.flatMap((p, b) => [
    { p: [centres[b], y0 + 0.12 + Math.ceil(p.h / L) * q, 0], t: `${blocs[b]} · ${p.h} hausses (${fr(100 * p.h / (p.h + p.b))} %)`, a: "h", fort: true },
    { p: [centres[b], y0 - 0.12 - Math.ceil(p.b / L) * q, 0], t: `${p.b} baisses`, a: "b" }]);
  const hausses = piles.reduce((a, p) => a + p.h, 0), total = piles.reduce((a, p) => a + p.h + p.b, 0);
  return { forme, reperes, titre: "La cible : hausses au-dessus, baisses en dessous",
    texte: `Chaque case est un mois, empilé selon ce que le Nikkei a fait ensuite. Il monte ${fr(100 * hausses / total)} % du temps : répondre « hausse » sans réfléchir est déjà un adversaire sérieux.`,
    legende: [["indigo", "mois suivi d'une hausse"], ["vermillon", "mois suivi d'une baisse"]] };
}

/* ---------- 5. Les essais : chaque point est un essai d'Optuna ---------- */
export function essais(journal) {
  const modeles = [["logit", "logistique"], ["rf", "Random Forest"], ["lgbm", "LightGBM"]];
  const E = journal.filter((e) => e.cible === "nikkei"), valeurs = E.map((e) => e.logloss).sort((a, b) => a - b);
  const bas = valeurs[0] - 0.012, haut = valeurs[Math.floor(valeurs.length * 0.94)], Y = (v) => -1.5 + ((Math.min(v, haut) - bas) / (haut - bas)) * 3.1;
  const X = (e) => -2.45 + modeles.findIndex((m) => m[0] === e.modele) * 1.8 + (e.essai / 49) * 1.3;
  const meilleurs = modeles.map(([m]) => E.filter((e) => e.modele === m).reduce((a, b) => (b.logloss < a.logloss ? b : a)));
  const forme = (i) => {
    if (h(i, 9) < 0.04) return [...trait(i, -2.6, -1.62, 2.6, -1.62), ...GRIS];
    if (h(i, 9) < 0.16) { const e = meilleurs[i % 3]; return [...disque(i, X(e), Y(e.logloss), 0.1), ...ENCRE]; }
    const e = E[i % E.length]; return [...disque(i, X(e), Y(e.logloss), 0.04), ...melange(ENCRE, PAPIER, 0.42)];
  };
  const reperes = [...modeles.map(([, nom], k) => ({ p: [-2.45 + k * 1.8 + 0.65, -1.68, 0], t: nom, a: "b", fort: true })),
    ...meilleurs.map((e) => ({ p: [X(e), Y(e.logloss) - 0.12, 0], t: fr(e.logloss, 3), a: "b" })),
    { p: [-2.6, 1.6, 0], t: `log-loss ${fr(haut, 2)} et plus`, a: "hd" }, { p: [-2.6, -1.5, 0], t: "↓ plus bas = meilleur", a: "hd" }];
  return { forme, reperes, titre: `${E.length} essais pour le Nikkei, trois modèles`,
    texte: "Chaque point est un essai d'Optuna, placé à sa log-loss de validation croisée. Le gros point est le meilleur essai de chaque modèle. Les modèles flexibles descendent plus bas ici, puis perdent sur 2022-2023. Les 50 autres essais règlent le modèle de couverture.",
    legende: [["gris", "un essai"], ["encre", "le meilleur essai du modèle"]] };
}

/* ---------- 6. Les points : chaque mois posé à sa probabilité, entre les deux seuils ---------- */
export function points(mois, seuils, periode) {
  const ps = mois.map((d) => d.p_hausse), lo = Math.min(...ps, seuils.theta_v) - 0.05, hi = Math.max(...ps, seuils.theta_a) + 0.05, pas = 0.21, sol = -0.9;
  const X = (p) => -2.5 + ((p - lo) / (hi - lo)) * 5, piles = {}, places = mois.map((d) => { const c = Math.round(X(d.p_hausse) / pas); piles[c] = (piles[c] || 0) + 1; return [c * pas, sol + (piles[c] - 0.5) * pas]; });
  const forme = (i) => {
    const u = h(i, 9);
    if (u < 0.05) return [...trait(i, -2.6, sol - 0.08, 2.6, sol - 0.08), ...GRIS];
    if (u < 0.11) return [...trait(i, X(seuils.theta_v), sol - 0.08, X(seuils.theta_v), 1.0), ...ENCRE];
    if (u < 0.17) return [...trait(i, X(seuils.theta_a), sol - 0.08, X(seuils.theta_a), 1.0), ...ENCRE];
    const j = i % mois.length; return [...disque(i, places[j][0], places[j][1], pas * 0.4), ...(mois[j].hausse_realisee ? INDIGO : VERMILLON)];
  };
  const vendus = mois.filter((d) => d.action === "vendre").length, achetes = mois.filter((d) => d.action === "acheter").length;
  return { forme, titre: `La règle : deux seuils, trois actions (${periode})`,
    texte: `Chaque point est un mois, posé à la probabilité de hausse que le modèle lui donnait. À gauche du premier trait on vend (${vendus} mois), à droite du second on achète (${achetes}), entre les deux on reste neutre. Si le modèle séparait bien, l'indigo serait à droite et le vermillon à gauche.`,
    legende: [["indigo", "le Nikkei a monté ensuite"], ["vermillon", "il a baissé"]],
    reperes: [{ p: [X(seuils.theta_v), 1.05, 0], t: `θ = ${fr(seuils.theta_v, 3)}`, a: "h", fort: true }, { p: [X(seuils.theta_a), 1.05, 0], t: `θ = ${fr(seuils.theta_a, 3)}`, a: "h", fort: true },
      { p: [(-2.5 + X(seuils.theta_v)) / 2, sol - 0.14, 0], t: "vendre", a: "b" }, { p: [(X(seuils.theta_v) + X(seuils.theta_a)) / 2, sol - 0.14, 0], t: "neutre", a: "b" },
      { p: [(X(seuils.theta_a) + 2.5) / 2, sol - 0.14, 0], t: "acheter", a: "b" }, { p: [2.6, sol - 0.5, 0], t: "probabilité de hausse →", a: "bg" }] };
}

/* ---------- 7. La matrice : les 33 mois du test, rangés par action et par issue ---------- */
export function confusion(mois) {
  const actions = ["vendre", "neutre", "acheter"], cx = [-1.74, 0, 1.74], cy = [0.86, -0.86], L = 6, q = 0.215, compte = {}, places = [];
  mois.forEach((d) => { const c = actions.indexOf(d.action), l = d.hausse_realisee ? 0 : 1, cle = c + "-" + l, k = compte[cle] = (compte[cle] || 0) + 1; places.push([c, l, k - 1]); });
  const n = (c, l) => compte[c + "-" + l] || 0;
  const forme = (i) => {
    const u = h(i, 9);
    if (u < 0.1) { const t = Math.floor(h(i, 8) * 3); return [...(t === 0 ? trait(i, -2.6, 0, 2.6, 0) : trait(i, t === 1 ? -0.87 : 0.87, -1.72, t === 1 ? -0.87 : 0.87, 1.72)), ...GRIS]; }
    const j = i % mois.length, [c, l, k] = places[j], lignes = Math.ceil(n(c, l) / L), large = Math.min(L, n(c, l));
    return [...disque(i, cx[c] + (k % L - (large - 1) / 2) * q, cy[l] + ((lignes - 1) / 2 - Math.floor(k / L)) * q + 0.12, q * 0.37), ...(l ? VERMILLON : INDIGO)];
  };
  const mots = [["vente à tort", "ventes à tort", "baisse évitée", "baisses évitées"], ["hausse manquée", "hausses manquées", "baisse évitée", "baisses évitées"], ["hausse captée", "hausses captées", "baisse subie", "baisses subies"]];
  const reperes = [...actions.map((a, c) => ({ p: [cx[c], 1.78, 0], t: `${a} · ${n(c, 0) + n(c, 1)} mois`, a: "h", fort: true })),
    ...actions.flatMap((_, c) => [0, 1].map((l) => ({ p: [cx[c], cy[l] - 0.4, 0], t: `${n(c, l)} ${mots[c][l * 2 + (n(c, l) > 1 ? 1 : 0)]}`, a: "b" })))];
  const baisses = mois.filter((d) => !d.hausse_realisee).length, hausses = mois.length - baisses;
  return { forme, reperes, titre: `Le test : ${mois.length} mois, rangés par action`,
    texte: `Une colonne par action de la règle. En haut, les ${hausses} mois où le Nikkei a monté ensuite ; en bas, les ${baisses} où il a baissé. La règle évite ${n(0, 1) + n(1, 1)} baisses sur ${baisses}, mais ne capte que ${pluriel(n(2, 0), "hausse")} sur ${hausses}.`,
    legende: [["indigo", "le Nikkei a monté"], ["vermillon", "le Nikkei a baissé"]] };
}

/* ---------- 8. La performance : 1 € placé sur le test, mois après mois ---------- */
export function performance(mois) {
  const cumul = (cle) => mois.reduce((a, d) => [...a, a[a.length - 1] * (1 + d[cle])], [1]).map((v) => v - 1);
  const achat = cumul("rendement_achat_couvert"), regle = cumul("rendement_regle"), n = mois.length;
  const min = Math.min(0, ...achat, ...regle), max = Math.max(...achat, ...regle), X = (t) => -2.5 + (t / n) * 5, Y = (v) => -1.5 + ((v - min) / (max - min)) * 3.05;
  const sur = (serie, i) => { const t = h(i, 1) * n, k = Math.floor(t), f = t - k; return [X(t), Y(serie[k] + (serie[k + 1] - serie[k]) * f)]; };
  const forme = (i) => {
    const u = h(i, 9);
    if (u < 0.06) return [...trait(i, -2.5, Y(0), 2.5, Y(0)), ...GRIS];
    if (u < 0.36) { const [x, y] = sur(regle, i); return [x, y + (h(i, 3) - 0.5) * 0.07, (h(i, 5) - 0.5) * 0.06, ...ENCRE]; }
    const [x, y] = sur(achat, i);
    if (u < 0.7) return [x, y + (h(i, 3) - 0.5) * 0.07, (h(i, 5) - 0.5) * 0.06, ...INDIGO];
    return [x, Y(0) + (y - Y(0)) * h(i, 3), (h(i, 5) - 0.5) * 0.05, ...melange(INDIGO, PAPIER, 0.55 + 0.3 * h(i, 7))];
  };
  return { forme, titre: "1 € placé sur le test, mois après mois",
    texte: "Deux façons de traverser les 33 mois du test. En indigo, acheter le Nikkei couvert contre le yen et ne plus y toucher. En encre, suivre la règle du modèle, qui vend ou reste neutre presque tout le temps.",
    legende: [["indigo", "toujours acheter, couvert"], ["encre", "la règle du modèle"]],
    reperes: [{ p: [X(n), Y(achat[n]), 0], t: `${signe(100 * achat[n])} % · toujours acheter, couvert`, a: "hg", fort: true },
      { p: [X(n), Y(regle[n]) + 0.05, 0], t: `${signe(100 * regle[n])} % · règle du modèle`, a: "hg", fort: true },
      { p: [X(0), Y(min) - 0.08, 0], t: lisible(mois[0].date), a: "bd" }, { p: [X(n), Y(min) - 0.08, 0], t: lisible(mois[n - 1].date), a: "bg" }] };
}

/* ---------- 9. La jauge : la probabilité du mois, entre vendre, neutre et acheter ---------- */
export function jauge(p, seuils, contexte) {
  const angle = (v) => ((210 - v * 240) * Math.PI) / 180, sur = (v, r) => [Math.cos(angle(v)) * r, Math.sin(angle(v)) * r - 0.5, 0];
  const forme = (i) => {
    const u = h(i, 9);
    if (u < 0.16) { const r = h(i, 1) * 2.05, a = angle(p); return [Math.cos(a) * r + (h(i, 2) - 0.5) * 0.06, Math.sin(a) * r - 0.5 + (h(i, 3) - 0.5) * 0.06, (h(i, 4) - 0.5) * 0.08, ...ENCRE]; }
    if (u < 0.21) return [...disque(i, 0, -0.5, 0.17), ...ENCRE];
    const v = h(i, 1), a = angle(v), r = 2.4 + (h(i, 2) - 0.5) * 0.36;
    return [Math.cos(a) * r, Math.sin(a) * r - 0.5, (h(i, 3) - 0.5) * 0.1, ...(v < seuils.theta_v ? VERMILLON : v < seuils.theta_a ? melange(GRIS, PAPIER, 0.3) : INDIGO)];
  };
  const action = p < seuils.theta_v ? "vendre" : p < seuils.theta_a ? "rester neutre" : "acheter";
  return { forme, titre: contexte, texte: `L'arc va de 0 à 100 % de probabilité de hausse. L'aiguille est à ${fr(100 * p, 1)} % : la règle dirait « ${action} ». Les deux seuils ont été fixés avant le test.`,
    legende: [["vermillon", "vendre"], ["gris", "neutre"], ["indigo", "acheter"]],
    reperes: [{ p: sur(seuils.theta_v / 2, 2.72), t: "vendre", a: "g" }, { p: sur((1 + seuils.theta_a) / 2, 2.72), t: "acheter", a: "d" },
      { p: sur(seuils.theta_v, 2.68), t: fr(seuils.theta_v, 3), a: "hg" }, { p: sur(seuils.theta_a, 2.68), t: fr(seuils.theta_a, 3), a: "hd" },
      { p: [0, -0.78, 0], t: `p(hausse) = ${fr(100 * p, 1)} % · ${action}`, a: "b", fort: true }] };
}

/* ---------- 10. Les contributions : ce qui pousse la prévision du mois ---------- */
export function contributions(liste, noms, mois) {
  const C = [...liste].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), max = Math.abs(C[0].contribution), x0 = 0.55, pas = 3.5 / C.length;
  const poids = C.map((c) => 0.25 + Math.abs(c.contribution) / max), total = poids.reduce((a, b) => a + b), bornes = poids.map(((s) => (w) => (s += w / total))(0));
  const Y = (k) => 1.7 - (k + 0.5) * pas, long = (c) => (c.contribution / max) * 1.95;
  const forme = (i) => {
    if (h(i, 9) < 0.05) return [...trait(i, x0, -1.85, x0, 1.85), ...ENCRE];
    const u = h(i, 1), k = Math.max(0, bornes.findIndex((b) => u < b)), c = C[k];
    return [x0 + long(c) * h(i, 2), Y(k) + (h(i, 3) - 0.5) * pas * 0.56, (h(i, 5) - 0.5) * 0.05, ...(c.contribution > 0 ? VERMILLON : INDIGO)];
  };
  return { forme, titre: `Pourquoi cette prévision pour ${mois}`,
    texte: "Une barre par variable du modèle, de la plus influente à la moins influente. Vers la droite, la variable pousse la prévision vers la baisse ; vers la gauche, vers la hausse. Leur somme donne la probabilité du mois.",
    legende: [["vermillon", "pousse vers la baisse"], ["indigo", "pousse vers la hausse"]],
    reperes: C.map((c, k) => ({ p: [x0 + (c.contribution > 0 ? -0.08 : 0.08), Y(k), 0], t: `${noms[c.variable] || c.variable} ${signe(c.contribution, 2)}`, a: c.contribution > 0 ? "g" : "d", fort: k < 3 })) };
}

/* ---------- 11. Les écarts : mois par mois, le modèle contre le modèle constant ---------- */
export function ecarts(mois, pBaisseConstante) {
  const perte = (p, hausse) => -Math.log(hausse ? p : 1 - p), E = mois.map((d) => perte(d.p_hausse, d.hausse_realisee) - perte(1 - pBaisseConstante, d.hausse_realisee));
  const max = Math.max(...E.map(Math.abs)), n = mois.length, pas = 5 / n, X = (k) => -2.5 + (k + 0.5) * pas, annees = [...new Set(mois.map((d) => d.date.slice(0, 4)))];
  const forme = (i) => {
    if (h(i, 9) < 0.05) return [...trait(i, -2.6, 0, 2.6, 0), ...ENCRE];
    const k = i % n; return [X(k) + (h(i, 2) - 0.5) * pas * 0.66, (E[k] / max) * 1.45 * h(i, 3), (h(i, 5) - 0.5) * 0.05, ...(E[k] > 0 ? VERMILLON : INDIGO)];
  };
  const reperes = annees.map((a) => {
    const idx = mois.map((d, k) => (d.date.startsWith(a) ? k : -1)).filter((k) => k >= 0), moyenne = idx.reduce((s, k) => s + E[k], 0) / idx.length;
    return { p: [(X(idx[0]) + X(idx[idx.length - 1])) / 2, 1.62, 0], t: `${a} · ${signe(moyenne, 3)} · ${moyenne < 0 ? "mieux" : "pire"}`, a: "h", fort: true };
  });
  return { forme, reperes: [...reperes, { p: [-2.6, -1.6, 0], t: "↓ le modèle se trompe moins que la constante", a: "hd" }],
    titre: "Mois par mois : le modèle contre le modèle constant",
    texte: "Une barre par mois du test : l'erreur du modèle (log-loss) moins celle du modèle constant. Vers le haut, le modèle fait moins bien que répéter la fréquence de l'entraînement ; vers le bas, il fait mieux. L'étiquette de chaque année donne l'écart moyen.",
    legende: [["vermillon", "le modèle fait moins bien"], ["indigo", "le modèle fait mieux"]] };
}

/* ---------- 12. La surface de coût et la descente de gradient ---------- */
export function surface(d) {
  const Jmax = Math.max(...d.cout.flat()), H = (J) => ((J - d.optimum[2]) / (Jmax - d.optimum[2])) * 2.9 - 1.5, depart = d.trajectoires["trop petit"].points[0];
  return { forme: surfaceDeCout(d), tourne: true, echelle: 0.7, titre: "La surface de coût, et la descente de gradient",
    texte: `Le coût J(w) d'une logistique réduite à deux variables (${d.variables.join(", ")}). C'est un bol strictement convexe : un seul minimum. Les gouttes vermillon suivent la descente de gradient depuis le départ jusqu'au fond.`,
    legende: [["encre", "le coût J(w)"], ["vermillon", "le chemin de la descente"]],
    reperes: [{ p: [d.optimum[0] * 1.6, H(d.optimum[2]) - 0.05, d.optimum[1] * 1.6], t: `minimum · J = ${fr(d.optimum[2], 3)}`, a: "b", fort: true },
      { p: [depart[0] * 1.6, H(depart[2]) + 0.1, depart[1] * 1.6], t: `départ · J = ${fr(depart[2], 3)}`, a: "h" }] };
}
