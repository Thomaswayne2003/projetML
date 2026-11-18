/* Nikkei project — the story (/en/recit), English version of web/assets/recit.js.
   Each chapter opens on an SVG chart drawn from the API data, in its own column next to the text. Charts animate as
   they enter the screen. One colour grammar: indigo = rise, buy; vermilion = fall, sell; ink = the model.
   The API's French keys (block names, actions) drive the logic and are only translated for display. */
const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const api = (route, params = {}) => fetch("/api.php?" + new URLSearchParams({ route, ...params })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const NOMS = { news_attention_6m: "Abnormal article volume", news_sent_w: "FinBERT sentiment", news_dispo: "News available", n225_mom_12m: "12-month momentum",
  n225_mom_3m: "3-month momentum", n225_vol_ewma: "Nikkei volatility", d_jgb10y_bp: "Change in 10-year JGB", tankan_large_manuf: "Tankan", carry_1m: "Hedge carry",
  eurjpy_rvol_1m: "EUR/JPY volatility", "distance au régime agité": "Distance to turbulent regime", "distance au régime calme": "Distance to calm regime" };
const LOGLOSS_CONSTANTE_CV = 0.672;                 // constant model's cross-validation log-loss (notebook 02)

// ----- Small SVG-writing helpers
const L = 640;
const fr = (v, dec = 0) => Number(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec }).replace("-", "−");
const signe = (v, dec = 1) => (v >= 0 ? "+" : "−") + fr(Math.abs(v), dec);
const MOIS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const lisible = (m) => `${MOIS[+m.slice(5) - 1]} ${m.slice(0, 4)}`;
const n1 = (v) => +v.toFixed(1);
const dl = (s) => ` style="--d:${s.toFixed(2)}s"`;                                  // element's entry delay
const svg = (h, corps) => `<svg viewBox="0 0 ${L} ${h}" xmlns="http://www.w3.org/2000/svg" role="img">${corps}</svg>`;
const txt = (x, y, t, o = {}) => `<text x="${n1(x)}" y="${n1(y)}" text-anchor="${o.anc || "start"}" class="et ${o.c || ""}${o.d != null ? " a-fondu" : ""}"` +
  `${o.rot ? ` transform="rotate(${o.rot} ${n1(x)} ${n1(y)})"` : ""}${o.d != null ? dl(o.d) : ""}>${t}</text>`;
const trait = (x1, y1, x2, y2, c = "grille", extra = "") => `<line class="${c}" x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}"${extra}/>`;
const teinte = (m) => (m.baisse === null ? "enc" : m.baisse ? "ver" : "ind");

/* ---------- The Nikkei curve: page opening, and the regime-change chapter ---------- */
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
  s += txt(X(n - 1), Y(dernier.cloture) - 14, `${fr(dernier.cloture)} in ${lisible(dernier.mois)}`, { c: "fort", anc: "end", d: 2.6 });
  s += `<circle class="f-enc a-pop" cx="${n1(X(0))}" cy="${n1(Y(serie[0].cloture))}" r="4"${dl(0.2)}/>` + trait(X(0), Y(serie[0].cloture) - 7, X(0), Y(serie[0].cloture * 1.7) + 6, "axe fin a-fondu", dl(0.4)) + txt(X(0) - 2, Y(serie[0].cloture * 1.78), `${fr(serie[0].cloture)} in ${lisible(serie[0].mois)}`, { d: 0.5 });
  if (mode === "regime") {
    s += trait(X(coupe), y0 - 6, X(coupe), y1, "axe tiret a-fondu", dl(1.4));
    s += txt(X(coupe) - 8, y0 + 8, "January 2022", { c: "fort", anc: "end", d: 1.6 });
    s += txt((x0 + X(coupe)) / 2, y1 + 44, "what the model learned", { anc: "middle", d: 1.8 }) + txt((X(coupe) + x1) / 2, y1 + 44, "what it had to predict", { anc: "middle", d: 2 });
    return { h: 424, corps: s, titre: "The Nikkei before and after 2022",
      texte: "The model learned on the light part, when the Bank of Japan kept rates negative. It then had to predict in the shaded part, after monetary normalisation began.",
      legende: [] };
  }
  const fois = dernier.cloture / serie[0].cloture;
  return { h: 400, corps: s, titre: "The Nikkei 225, from 2010 to 2026",
    texte: `Month-end closes, on a log scale. The index was multiplied by ${fr(fois, 1)} over the period, and these ${n} months are what the project tries to anticipate.`, legende: [] };
}

/* ---------- €1 invested over the test: hedged buy vs the model's rule ---------- */
function performance(mois) {
  const cumul = (cle) => mois.reduce((a, m) => [...a, a[a.length - 1] * (1 + m[cle])], [1]).map((v) => v - 1);
  const achat = cumul("rendement_achat_couvert"), regle = cumul("rendement_regle"), n = mois.length, x0 = 62, x1 = 440, y0 = 46, y1 = 356;
  const bas = Math.min(-0.05, ...achat, ...regle), haut = Math.max(...achat, ...regle) * 1.04;
  const X = (k) => x0 + (k / n) * (x1 - x0), Y = (v) => y1 - ((v - bas) / (haut - bas)) * (y1 - y0), chemin = (t) => "M" + t.map((v, k) => `${n1(X(k))} ${n1(Y(v))}`).join(" L");
  let s = "";
  [0, 0.4, 0.8].forEach((v) => { s += trait(x0, Y(v), x1, Y(v), v ? "grille" : "axe") + txt(x0 - 8, Y(v) + 4, v ? `+${fr(100 * v)}%` : "0%", { c: "petit", anc: "end" }); });
  s += txt(X(0), y1 + 22, lisible(mois[0].date), { c: "petit" }) + txt(X(n), y1 + 22, lisible(mois[n - 1].date), { c: "petit", anc: "end" });
  s += `<path class="aire-ind a-fondu" d="${chemin(achat)} L${n1(X(n))} ${n1(Y(0))} L${x0} ${n1(Y(0))} Z"${dl(1.6)}/>`;
  s += `<path class="t-ind a-trace epais" pathLength="1" d="${chemin(achat)}" style="--t:2.2s"/><path class="t-enc a-trace epais" pathLength="1" d="${chemin(regle)}" style="--t:2.2s;--d:.35s"/>`;
  s += `<circle class="f-ind a-pop" cx="${n1(X(n))}" cy="${n1(Y(achat[n]))}" r="5"${dl(2.2)}/><circle class="f-enc a-pop" cx="${n1(X(n))}" cy="${n1(Y(regle[n]))}" r="5"${dl(2.5)}/>`;
  s += txt(X(n) + 14, Y(achat[n]) + 4, `${signe(100 * achat[n])}%`, { c: "grand ind", d: 2.3 }) + txt(X(n) + 14, Y(achat[n]) + 24, "always buy, hedged", { c: "ind", d: 2.4 });
  s += txt(X(n) + 14, Y(regle[n]) - 6, `${signe(100 * regle[n])}%`, { c: "grand", d: 2.6 }) + txt(X(n) + 14, Y(regle[n]) + 14, "model's rule", { d: 2.7 });
  return { h: 400, corps: s, titre: `€1 invested over the ${n} test months`,
    texte: "In indigo, the investor buys the Nikkei hedged against the yen and then leaves it alone. In black, they follow the model's rule, which mostly stays neutral or short and misses the rally.",
    legende: [["ind", "always buy, hedged"], ["enc", "model's rule"]] };
}

/* ---------- The signal gauge ---------- */
function jauge(p, seuils, titre) {
  const cx = 320, cy = 288, r = 205, pt = (v, rayon = r) => [cx - Math.cos(v * Math.PI) * rayon, cy - Math.sin(v * Math.PI) * rayon];
  const arc = (a, b) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `M${n1(x1)} ${n1(y1)} A${r} ${r} 0 0 1 ${n1(x2)} ${n1(y2)}`; };
  let s = `<path class="arc t-ver a-trace" pathLength="1" d="${arc(0, seuils.theta_v - 0.004)}" style="--t:.8s"/>` +
    `<path class="arc t-gri a-trace" pathLength="1" d="${arc(seuils.theta_v + 0.004, seuils.theta_a - 0.004)}" style="--t:.4s;--d:.7s"/>` +
    `<path class="arc t-ind a-trace" pathLength="1" d="${arc(seuils.theta_a + 0.004, 1)}" style="--t:.8s;--d:1s"/>`;
  [[seuils.theta_v / 2, "sell", "ver"], [(seuils.theta_v + seuils.theta_a) / 2, "neutral", "gri"], [(1 + seuils.theta_a) / 2, "buy", "ind"]].forEach(([v, nom, c], k) => {
    const [x, y] = pt(v, r + 34); s += txt(x, y + 4, nom, { c: `fort ${c}`, anc: v < 0.4 ? "end" : v > 0.6 ? "start" : "middle", d: 0.6 + k * 0.4 });
  });
  [seuils.theta_v, seuils.theta_a].forEach((v, k) => { const [x, y] = pt(v, r - 30); s += txt(x, y + 4, fr(v, 3), { c: "petit", anc: k ? "start" : "end", d: 1.4 }); });
  [0, 1].forEach((v) => { const [x, y] = pt(v, r); s += txt(x, y + 30, v ? "100%" : "0%", { c: "petit", anc: "middle" }); });
  s += `<g class="aiguille" style="--p:${p.toFixed(4)}"><line class="t-enc" x1="${cx}" y1="${cy}" x2="${cx - r + 34}" y2="${cy}"/></g><circle class="f-enc" cx="${cx}" cy="${cy}" r="12"/>`;
  const action = p < seuils.theta_v ? "sell" : p < seuils.theta_a ? "stay neutral" : "buy";
  s += `<text class="et tres-grand a-fondu" id="jauge-valeur" x="${cx}" y="${cy + 74}" text-anchor="middle"${dl(1.5)}>${fr(100 * p, 1)}%</text>`;
  s += `<text class="et a-fondu" id="jauge-action" x="${cx}" y="${cy + 100}" text-anchor="middle"${dl(1.7)}>probability of a rise · the rule would say “${action}”</text>`;
  return { h: 400, corps: s, titre,
    texte: "The needle shows the probability of a rise the model estimates for the following month. The two thresholds, set before the test, separate the three possible actions.",
    legende: [["ver", "sell"], ["gri", "stay neutral"], ["ind", "buy"]] };
}

/* ---------- The 201-month calendar ---------- */
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
  s += lien(Y(a0), Y(aNews) - 4, "markets only", 1.9) + lien(Y(aNews) + 2, Y(a1) + 15, `with news, since ${lisible(premier.mois)}`, 2.1);
  const fin = serie[serie.length - 1];
  s += txt(X(+fin.mois.slice(5)) + 4, Y(a1) + 12, "← to predict", { c: "fort", d: 2.2 });
  return { h: 400, corps: s, titre: `The ${serie.length} months of the dataset`,
    texte: "Each row is a year, each column a month. The colour shows what the Nikkei did the following month, in other words the target to predict. Filled cells have news; empty cells have market data only.",
    legende: [["ind", "rise the following month"], ["ver", "fall the following month"], ["enc", "not known yet"]] };
}

/* ---------- The chronological split ---------- */
function decoupage(serie) {
  const R = 8, q = 17, blocs = ["entraînement", "validation", "test", "à prédire"], infos = [["Training", "2010 - 2021", "we learn"], ["Validation", "2022 - 2023", "we tune"], ["Test", "2024 - 2026", "we judge, once"], ["?", "", ""]];
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
    if (annees) s += txt(mx, y0 - 40, `${tailles[b]} months`, { anc: "middle", d }) + txt(mx, y0 - 22, annees, { c: "petit", anc: "middle", d });
    else s += txt(mx, y0 - 22, "to predict", { c: "petit", anc: "middle", d });
    if (verbe) s += `<path class="t-enc fin a-fondu" d="M${n1(departs[b])} ${y0 + R * q + 8} v6 H${n1(departs[b] + colonnes[b] * q - 4)} v-6"${dl(1.9 + b * 0.2)}/>` + txt(mx, y0 + R * q + 34, verbe, { anc: "middle", d: 1.9 + b * 0.2 });
  });
  const ya = y0 + R * q + 74;
  s += `<path class="t-enc fin a-trace" pathLength="1" d="M${n1(x0)} ${ya} H${n1(x0 + large - 8)}" style="--t:1.8s"/><path class="f-enc a-fondu" d="M${n1(x0 + large)} ${ya} l-10 -5 v10 Z"${dl(1.8)}/>` + txt(x0, ya + 20, "time", { c: "petit" });
  return { h: 400, corps: s, titre: "Three periods, in time order",
    texte: "Months are never shuffled. The model learns on 2010-2021, we tune our choices on 2022-2023 and we judge the result only once, on 2024-2026.",
    legende: [["ind", "rise the following month"], ["ver", "fall the following month"]] };
}

/* ---------- Rises and falls, by period ---------- */
function classes(serie) {
  const blocs = [["entraînement", "Training"], ["validation", "Validation"], ["test", "Test"]], W = 6, q = 14, centres = [150, 330, 510];
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
    s += txt(centres[k], haut - 26, blocs[k][1], { c: "fort", anc: "middle", d }) + txt(centres[k], haut - 8, `${h} rises · ${fr(100 * h / (h + b))}%`, { c: "ind", anc: "middle", d });
    s += txt(centres[k], bas + 16, `${b} falls · ${fr(100 * b / (h + b))}%`, { c: "ver", anc: "middle", d });
  });
  return { h: 410, corps: s, titre: "Rises and falls, period by period",
    texte: "Months followed by a rise are stacked upwards, the others downwards. The Nikkei rises about six months in ten, so always forecasting a rise is already a hard benchmark to beat.",
    legende: [["ind", "month followed by a rise"], ["ver", "month followed by a fall"]] };
}

/* ---------- The Optuna trials ---------- */
function essais(journal) {
  const modeles = [["logit", "Logistic"], ["rf", "Random Forest"], ["lgbm", "LightGBM"]], E = journal.filter((e) => e.cible === "nikkei");
  const valeurs = E.map((e) => e.logloss).sort((a, b) => a - b), bas = valeurs[0] - 0.012, haut = valeurs[Math.floor(valeurs.length * 0.94)], x0 = 70, y0 = 44, y1 = 340, bande = 160, pas = 18;
  const Y = (v) => y1 - ((Math.min(v, haut) - bas) / (haut - bas)) * (y1 - y0), X = (e) => x0 + modeles.findIndex(([m]) => m === e.modele) * (bande + pas) + 8 + (e.essai / 49) * (bande - 16);
  let s = "";
  modeles.forEach(([, nom], k) => { s += `<rect class="voile" x="${x0 + k * (bande + pas)}" y="${y0 - 8}" width="${bande}" height="${y1 - y0 + 16}"/>` + txt(x0 + k * (bande + pas) + bande / 2, y1 + 34, nom, { c: "fort", anc: "middle" }); });
  [0.6, 0.65, 0.7].filter((v) => v > bas && v < haut).forEach((v) => { s += trait(x0, Y(v), x0 + 3 * bande + 2 * pas, Y(v)) + txt(x0 - 8, Y(v) + 4, fr(v, 2), { c: "petit", anc: "end" }); });
  s += trait(x0, Y(LOGLOSS_CONSTANTE_CV), x0 + 3 * bande + 2 * pas, Y(LOGLOSS_CONSTANTE_CV), "axe tiret a-fondu", dl(0.4)) + txt(x0 + 3 * bande + 2 * pas, Y(LOGLOSS_CONSTANTE_CV) - 7, `constant model · ${fr(LOGLOSS_CONSTANTE_CV, 3)}`, { c: "petit", anc: "end", d: 0.4 });
  E.forEach((e) => { s += `<circle class="f-enc clair a-tombe" cx="${n1(X(e))}" cy="${n1(Y(e.logloss))}" r="3.4"${dl(0.3 + e.essai * 0.022)}/>`; });
  modeles.forEach(([m]) => {
    const meilleur = E.filter((e) => e.modele === m).reduce((a, b) => (b.logloss < a.logloss ? b : a));
    s += `<circle class="f-enc a-pop" cx="${n1(X(meilleur))}" cy="${n1(Y(meilleur.logloss))}" r="6.5"${dl(1.7)}/><circle class="t-enc fin a-pop" cx="${n1(X(meilleur))}" cy="${n1(Y(meilleur.logloss))}" r="12"${dl(1.8)}/>`;
    s += txt(X(meilleur), Y(meilleur.logloss) + 30, fr(meilleur.logloss, 3), { c: "fort", anc: "middle", d: 1.9 });
  });
  s += txt(18, (y0 + y1) / 2, "cross-validation log-loss (lower is better)", { c: "petit", anc: "middle", rot: -90 });
  return { h: 400, corps: s, titre: `The ${E.length} Optuna trials for the Nikkei`,
    texte: "Points sit at the height of their cross-validation log-loss, and each model's best trial is circled. LightGBM drops well below the constant model here, before losing that edge on 2022-2023.",
    legende: [] };
}

/* ---------- The months against the two thresholds ---------- */
function points(mois, seuils, titre, texte) {
  const ps = mois.map((m) => m.p_hausse), bas = Math.min(...ps, seuils.theta_v) - 0.05, haut = Math.max(...ps, seuils.theta_a) + 0.05, x0 = 50, x1 = 600, sol = 300, pas = 21;
  const X = (p) => x0 + ((p - bas) / (haut - bas)) * (x1 - x0), piles = {};
  let s = `<rect class="zone-ver a-fondu" x="${x0}" y="60" width="${n1(X(seuils.theta_v) - x0)}" height="${sol - 60}"/><rect class="zone-ind a-fondu" x="${n1(X(seuils.theta_a))}" y="60" width="${n1(x1 - X(seuils.theta_a))}" height="${sol - 60}"/>`;
  s += trait(x0, sol, x1, sol, "axe");
  for (let v = Math.ceil(bas * 10) / 10; v < haut; v += 0.1) s += trait(X(v), sol, X(v), sol + 5, "axe") + txt(X(v), sol + 20, `${fr(100 * v)}%`, { c: "petit", anc: "middle" });
  s += txt(x1, sol + 42, "probability of a rise estimated by the model →", { c: "petit", anc: "end" });
  [["theta_v", "end"], ["theta_a", "start"]].forEach(([cle, anc], k) => {
    s += trait(X(seuils[cle]), 44, X(seuils[cle]), sol, "axe tiret a-fondu", dl(0.3 + k * 0.2)) + txt(X(seuils[cle]) + (k ? 6 : -6), 54, `threshold ${fr(seuils[cle], 3)}`, { c: "fort", anc, d: 0.3 + k * 0.2 });
  });
  s += txt((x0 + X(seuils.theta_v)) / 2, 82, "sell", { c: "fort ver", anc: "middle", d: 0.6 }) + txt((X(seuils.theta_v) + X(seuils.theta_a)) / 2, 82, "neutral", { c: "fort gri", anc: "middle", d: 0.7 }) +
    txt((X(seuils.theta_a) + x1) / 2, 82, "buy", { c: "fort ind", anc: "middle", d: 0.8 });
  mois.forEach((m, j) => {
    const c = Math.round(X(m.p_hausse) / pas), rang = piles[c] = (piles[c] || 0) + 1;
    s += `<circle class="f-${m.hausse_realisee ? "ind" : "ver"} a-tombe" cx="${c * pas}" cy="${sol - 12 - (rang - 1) * pas}" r="8.5"${dl(0.8 + j * 0.05)}/>`;
  });
  return { h: 360, corps: s, titre, texte, legende: [["ind", "the Nikkei rose afterwards"], ["ver", "it fell afterwards"]] };
}

/* ---------- The test: the rule's action and the month's outcome ---------- */
function confusion(mois) {
  const actions = ["vendre", "neutre", "acheter"], ACTION = { vendre: "sell", neutre: "neutral", acheter: "buy" }, x0 = 96, y0 = 60, lc = 172, hl = 150, compte = {};
  mois.forEach((m) => { const cle = actions.indexOf(m.action) + "-" + (m.hausse_realisee ? 0 : 1); (compte[cle] = compte[cle] || []).push(m); });
  const nb = (c, l) => (compte[c + "-" + l] || []).length;
  const mots = [["wrong sell", "wrong sells", "fall avoided", "falls avoided"], ["rise missed", "rises missed", "fall avoided", "falls avoided"], ["rise captured", "rises captured", "fall suffered", "falls suffered"]];
  let s = "";
  actions.forEach((a, c) => { s += txt(x0 + c * lc + lc / 2, y0 - 26, ACTION[a], { c: "fort", anc: "middle" }) + txt(x0 + c * lc + lc / 2, y0 - 9, `${nb(c, 0) + nb(c, 1)} months`, { c: "petit", anc: "middle" }); });
  s += txt(x0 - 44, y0 + hl / 2, "the Nikkei rose", { c: "ind fort", anc: "middle", rot: -90 }) + txt(x0 - 26, y0 + hl / 2, `${mois.filter((m) => m.hausse_realisee).length} months`, { c: "petit", anc: "middle", rot: -90 });
  s += txt(x0 - 44, y0 + hl * 1.5, "it fell", { c: "ver fort", anc: "middle", rot: -90 }) + txt(x0 - 26, y0 + hl * 1.5, `${mois.filter((m) => !m.hausse_realisee).length} months`, { c: "petit", anc: "middle", rot: -90 });
  for (let c = 0; c <= 3; c++) s += `<path class="t-enc fin a-trace" pathLength="1" d="M${x0 + c * lc} ${y0} V${y0 + 2 * hl}" style="--t:.9s;--d:${(c * 0.08).toFixed(2)}s"/>`;
  for (let l = 0; l <= 2; l++) s += `<path class="t-enc fin a-trace" pathLength="1" d="M${x0} ${y0 + l * hl} H${x0 + 3 * lc}" style="--t:.9s;--d:${(0.3 + l * 0.08).toFixed(2)}s"/>`;
  actions.forEach((_, c) => [0, 1].forEach((l) => {
    const n = nb(c, l), x = x0 + c * lc + 16, y = y0 + l * hl, d = 0.9 + (c + l * 3) * 0.18;
    s += txt(x, y + 44, n, { c: `tres-grand ${l ? "ver" : "ind"}`, d }) + txt(x, y + 64, mots[c][l * 2 + (n > 1 ? 1 : 0)], { d });
    for (let k = 0; k < n; k++) s += `<circle class="f-${l ? "ver" : "ind"} a-pop" cx="${x + 7 + (k % 7) * 20}" cy="${y + 88 + Math.floor(k / 7) * 20}" r="7"${dl(d + 0.2 + k * 0.04)}/>`;
  }));
  const baisses = mois.filter((m) => !m.hausse_realisee).length, hausses = mois.length - baisses;
  return { h: 380, corps: s, titre: "What the rule did during the test",
    texte: `Columns give the rule's action, rows what the Nikkei did the following month. The rule avoids ${nb(0, 1) + nb(1, 1)} of ${baisses} falls, but it only buys for ${nb(2, 0)} of the ${hausses} rises.`,
    legende: [["ind", "the Nikkei rose"], ["ver", "the Nikkei fell"]] };
}

/* ---------- What drives the month's forecast ---------- */
function contributions(liste) {
  const C = [...liste].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)), max = Math.abs(C[0].contribution), xz = 330, pas = 30, y0 = 38;
  let s = txt(xz - 14, 18, "← towards a rise", { c: "petit ind", anc: "end" }) + txt(xz + 14, 18, "towards a fall →", { c: "petit ver" });
  C.forEach((c, k) => {
    const lg = Math.max(2, (Math.abs(c.contribution) / max) * 200), pos = c.contribution > 0, y = y0 + k * pas, d = 0.2 + k * 0.09;
    s += `<rect class="f-${pos ? "ver" : "ind"} ${pos ? "a-droite" : "a-gauche"}" x="${n1(pos ? xz : xz - lg)}" y="${y}" width="${n1(lg)}" height="16" rx="1.5"${dl(d)}/>`;
    s += txt(pos ? xz - 10 : xz + 10, y + 12.5, NOMS[c.variable] || c.variable, { c: k < 3 ? "fort" : "", anc: pos ? "end" : "start", d });
    s += txt(pos ? xz + lg + 8 : xz - lg - 8, y + 12.5, signe(c.contribution, 2), { c: "petit", anc: pos ? "start" : "end", d: d + 0.5 });
  });
  s += `<path class="t-enc fin a-trace" pathLength="1" d="M${xz} ${y0 - 8} V${y0 + C.length * pas}" style="--t:1s"/>`;
  return { h: y0 + C.length * pas + 8, corps: s, titre: "What drives the November 2026 forecast",
    texte: "Bars to the right push the forecast towards a fall, bars to the left towards a rise. The feature at the top weighs most: October had twice as many articles as usual.",
    legende: [["ver", "pushes towards a fall"], ["ind", "pushes towards a rise"]] };
}

/* ---------- Month by month, the model vs the constant model ---------- */
function ecarts(mois, pBaisse) {
  const perte = (p, hausse) => -Math.log(hausse ? p : 1 - p), E = mois.map((m) => perte(m.p_hausse, m.hausse_realisee) - perte(1 - pBaisse, m.hausse_realisee));
  const max = Math.max(...E.map(Math.abs)), n = mois.length, x0 = 50, x1 = 610, y0 = 232, pas = (x1 - x0) / n, X = (k) => x0 + k * pas, annees = [...new Set(mois.map((m) => m.date.slice(0, 4)))];
  let s = "";
  annees.forEach((a, k) => {
    const idx = mois.map((m, j) => (m.date.startsWith(a) ? j : -1)).filter((j) => j >= 0), moyenne = idx.reduce((t, j) => t + E[j], 0) / idx.length, mx = (X(idx[0]) + X(idx[idx.length - 1] + 1)) / 2;
    if (k) s += trait(X(idx[0]) - 1, 30, X(idx[0]) - 1, 400, "grille");
    s += txt(mx, 40, a, { c: "fort", anc: "middle" }) + txt(mx, 60, `${signe(moyenne, 3)} on average`, { c: moyenne < 0 ? "ind" : "ver", anc: "middle", d: 1.6 + k * 0.2 });
    s += txt(mx, 78, moyenne < 0 ? "the model does better" : "it does worse", { c: "petit", anc: "middle", d: 1.6 + k * 0.2 });
  });
  E.forEach((e, k) => {
    const ht = Math.max(1.5, (Math.abs(e) / max) * 130);
    s += `<rect class="f-${e > 0 ? "ver a-haut" : "ind a-bas"}" x="${n1(X(k) + 2.5)}" y="${n1(e > 0 ? y0 - ht : y0)}" width="${n1(pas - 5)}" height="${n1(ht)}" rx="1"${dl(0.2 + k * 0.035)}/>`;
  });
  s += trait(x0, y0, x1, y0, "axe") + txt(x0, 400, "↑ above the line, the model errs more than the constant model", { c: "petit" });
  return { h: 410, corps: s, titre: "The model vs the constant model, month by month",
    texte: "Bar height gives the error gap (log-loss) between the model and the constant model. Above the line the model errs more; below it does better, which on average only happens in 2024.",
    legende: [["ver", "the model does worse"], ["ind", "the model does better"]] };
}

/* ---------- Gradient descent seen from above: cost contour lines ---------- */
function surface(d) {
  const A = d.axe, n = A.length, x0 = 150, y0 = 24, cote = 356, lim = A[n - 1], X = (w) => x0 + ((w + lim) / (2 * lim)) * cote, Y = (w) => y0 + cote - ((w + lim) / (2 * lim)) * cote;
  const Jmin = d.optimum[2], Jmax = Math.max(...d.cout.flat()), niveaux = Array.from({ length: 9 }, (_, k) => Jmin + (Jmax - Jmin) * Math.pow((k + 1) / 10, 1.7));
  const coupe = (a, b, va, vb, niv) => a + ((niv - va) / (vb - va)) * (b - a);
  const TABLE = { 1: [["g", "b"]], 2: [["b", "d"]], 3: [["g", "d"]], 4: [["h", "d"]], 5: [["h", "g"], ["b", "d"]], 6: [["h", "b"]], 7: [["h", "g"]], 8: [["h", "g"]], 9: [["h", "b"]], 10: [["h", "d"], ["g", "b"]], 11: [["h", "d"]], 12: [["g", "d"]], 13: [["b", "d"]], 14: [["g", "b"]] };
  let s = `<rect class="voile" x="${x0}" y="${y0}" width="${cote}" height="${cote}"/>`;
  niveaux.forEach((niv, q) => {
    let chemin = "";
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
      const hg = d.cout[j + 1][i], hd = d.cout[j + 1][i + 1], bd = d.cout[j][i + 1], bg = d.cout[j][i];        // j grows towards the top of the figure
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
  s += txt(X(trajet[0][0]) + 12, Y(trajet[0][1]) - 8, "start", { c: "fort", d: 1.3 }) + txt(X(d.optimum[0]) + 14, Y(d.optimum[1]) + 22, `minimum · J = ${fr(Jmin, 3)}`, { c: "fort", d: 3.5 });
  s += txt(x0 + cote / 2, y0 + cote + 22, `weight w₁ · abnormal article volume`, { c: "petit", anc: "middle" }) + txt(x0 - 14, y0 + cote / 2, `weight w₂ · 12-month momentum`, { c: "petit", anc: "middle", rot: -90 });
  return { h: 412, corps: s, titre: "Gradient descent, seen from above",
    texte: "The contour lines show the cost J(w₁, w₂) of a logistic regression reduced to two features. The black line follows gradient descent from its starting point to the minimum, which is unique since the cost is convex.",
    legende: [] };
}

// ----- Data, then one chart per chapter
const planches = Object.fromEntries([...document.querySelectorAll(".planche")].map((el) => [el.dataset.planche, el]));
const [serie, test, validation, signal, evaluation, explication, cout, journal] = await Promise.all([api("serie"), api("historique", { bloc: "test" }),
  api("historique", { bloc: "validation" }), api("signal"), api("evaluation"), api("explication"), api("surface"), api("essais")]);
const seuils = signal?.seuils ?? { theta_v: 0.456, theta_a: 0.58 };
const pConstante = evaluation?.metriques?.["constante (fréquence de l'entraînement)"]?.["proba moyenne"] ?? 0.3916;
const FIGURES = {
  haut: () => serie && courbe(serie, "ouverture"), resultat: () => test && performance(test),
  explorateur: () => signal && jauge(signal.p_hausse, seuils, "This month's signal, as the model computes it"),
  dataset: () => serie && calendrier(serie), methode: () => serie && decoupage(serie), exploration: () => serie && classes(serie), modeles: () => journal && essais(journal),
  decision: () => validation && points(validation, seuils, "The 24 validation months against the two thresholds",
    "Months are placed by the probability of a rise the model gave them. A model that separated the two cases well would put indigo on the right and vermilion on the left, which is not what we see here."),
  test: () => test && confusion(test),
  simulateur: () => test && points(test, seuils, "The 33 test months against the two thresholds",
    "Changing the margin in the simulator moves these two thresholds apart or together. Most months, rises included, fall in the “sell” and “neutral” zones."),
  projection: () => explication && contributions(explication), regime: () => serie && courbe(serie, "regime"), pourquoi: () => test && ecarts(test, pConstante), maths: () => cout && surface(cout),
};
Object.entries(planches).forEach(([cle, el]) => {
  const f = FIGURES[cle]?.();
  if (!f) { el.querySelector("figcaption").innerHTML = '<p class="lecture">Chart unavailable: the Python API is not responding.</p>'; return; }
  el.querySelector(".dessin").innerHTML = svg(f.h, f.corps);
  el.querySelector("figcaption").innerHTML = `<span class="lecture">Reading the chart</span><h4>${f.titre}</h4><p>${f.texte}</p>` +
    (f.legende.length ? `<ul>${f.legende.map(([c, t]) => `<li><i class="f-${c}"></i>${t}</li>`).join("")}</ul>` : "");
});

// ----- Charts play when they enter the screen, and replay when you come back to them.
// Position is checked directly (on scroll, and twice a second): a visible chart never waits.
function jouer() {
  Object.values(planches).forEach((el) => {
    const r = el.getBoundingClientRect(), visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
    if (IMMOBILE || visible >= Math.min(r.height, innerHeight) * 0.35) el.classList.add("joue");
    else if (visible <= 0) el.classList.remove("joue");
  });
}
addEventListener("scroll", jouer, { passive: true }); addEventListener("resize", jouer); setInterval(jouer, 500); jouer();

// The predictor updates its chapter's gauge
document.addEventListener("nikkei:prediction", (e) => {
  const s = e.detail, el = planches.explorateur; if (!el || !s || typeof s.p_hausse !== "number") return;
  const t = s.seuils ?? seuils, action = s.p_hausse < t.theta_v ? "sell" : s.p_hausse < t.theta_a ? "stay neutral" : "buy";
  el.querySelector(".aiguille")?.style.setProperty("--p", s.p_hausse.toFixed(4));
  const valeur = el.querySelector("#jauge-valeur"), texte = el.querySelector("#jauge-action");
  if (valeur) valeur.textContent = `${fr(100 * s.p_hausse, 1)}%`;
  if (texte) texte.textContent = `probability of a rise · the rule would say “${action}”`;
});

// ----- The rail: the page's chapters, on the left edge
const ouvertures = [...document.querySelectorAll("[data-chapitre]")];
const rail = Object.assign(document.createElement("nav"), { id: "rail", ariaLabel: "Chapters" });
rail.innerHTML = ouvertures.map((o, k) => `<a href="#${o.dataset.chapitre}"><i></i><span>${String(k).padStart(2, "0")} · ${o.dataset.court}</span></a>`).join("");
document.body.append(rail);
const liens = [...rail.querySelectorAll("a")];
const suivre = () => { let k = 0; ouvertures.forEach((o, n) => { if (o.getBoundingClientRect().top < innerHeight * 0.6) k = n; }); liens.forEach((l, n) => l.classList.toggle("actif", n === k)); };
addEventListener("scroll", suivre, { passive: true }); suivre();
