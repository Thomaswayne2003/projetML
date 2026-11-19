// Fichier écrit par python -m app.export_site à partir de en/assets/*.js : ne pas modifier à la main.
const __contenu = (() => {
"use strict";
// English version of site/assets/contenu.js: content shared by both modes (the seven rooms of the tour are the seven
// chapters of the reading). Figures are read from window.NIKKEI (written by python -m app.export_site), never copied by hand.
// The data file is shared with the French site: its keys and some of its labels are in French and are translated here.

const D = window.NIKKEI;

// The English pages live in site/en/: figures, notebooks, PDFs and data are one folder up.
const RACINE = "../";

// ---------- English formats ----------
const nf = (d) => new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const nombre = (x, d = 0) => nf(d).format(x);
const pct = (x, d = 1, signe = false) =>
  (signe && x > 0 ? "+" : x < 0 ? "−" : "") + nf(d).format(Math.abs(x * 100)) + "%";
const Maj = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dec = (x, d = 3) => (x < 0 ? "−" : "") + nf(d).format(Math.abs(x));
const MOIS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const moisLong = (am) => { const [a, m] = am.split("-").map(Number); return `${MOIS[m - 1]} ${a}`; };
const moisSuivant = (am) => { let [a, m] = am.split("-").map(Number); m += 1; if (m > 12) { m = 1; a += 1; } return `${a}-${String(m).padStart(2, "0")}`; };

// ---------- English labels for the French strings stored in the shared data file ----------
const VARIABLES_EN = {
  news_attention_6m: "abnormal article volume", news_sent_w: "news tone", news_dispo: "news available",
  n225_mom_12m: "12-month momentum", n225_mom_3m: "3-month momentum", n225_vol_ewma: "smoothed volatility",
  d_jgb10y_bp: "change in the 10-year yield", tankan_large_manuf: "Tankan", carry_1m: "one-month carry",
  eurjpy_rvol_1m: "euro-yen volatility", kmeans0: "distance to regime 1", kmeans1: "distance to regime 2",
  "distance au régime 1": "distance to regime 1", "distance au régime 2": "distance to regime 2",
  "distance au régime agité": "distance to the turbulent regime", "distance au régime calme": "distance to the calm regime",
};
const NB_TITRES = {
  "00a_collecte_V1": "Data collection, first version: prices, rates, FX, news",
  "00b_collecte_V2": "Data collection, second version: 1999-2026, new sources",
  "01_cadrage_eda_variables": "Framing, leakage audit, exploration, features, split",
  "02_pipeline_modeles_optuna": "Pipeline, three models, Optuna, trial log",
  "03_calibration_seuils": "Calibration, model choice, frozen decision rule",
  "03b_test_final": "Single evaluation on the 2024-2026 test",
  "04_explicabilite_diagnostics": "Slices, permutation, SHAP, partial dependence",
  "05_annexe_maths_logistique": "Maths appendix: logistic regression by hand",
  "06_annexe_news_prix": "Appendix: news signal × price signal, realisation time, backtests, HMM",
  "07_seconde_version_bloomberg": "Second version: 1999-2026, Bloomberg, results and explainability",
  "08_ameliorations_sans_surapprentissage": "Improvements without overfitting: frozen protocol, judged on 2010-2023",
};
const titreNb = (nom) => NB_TITRES[nom] ?? D.notebooks.find((n) => n.nom === nom)?.titre ?? nom;
const ARCHIVES_TITRES = { notebooks: "All the notebooks", projet: "The complete project" };
const LEVIERS_EN = {
  "logistique du projet": "the project's logistic", "logistique très pénalisée": "heavily penalised logistic",
  "logistique du projet, mélangée à la constante": "the project's logistic, blended with the constant",
  "logistique économique": "economic logistic", "logistique économique, mélangée à la constante": "economic logistic, blended with the constant",
  "ridge sur le rendement": "ridge on the return",
};
const levier = (t) => LEVIERS_EN[t] ?? t;

// ---------- figures derived from the data ----------
const ev = D.evaluation;
const met = ev.metriques;
const CONST = "constante (fréquence de l'entraînement)";
const perf = ev.performance_euros;

// Month-by-month log-loss gap between the model and the constant, on the test: mean and standard error
function ecartLogLoss(historique) {
  const pc = 1 - met[CONST]["proba moyenne"];                       // the constant's probability of a rise
  const ll = (p, y) => -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  const d = historique.map((m) => ll(m.p_hausse, m.hausse_realisee) - ll(pc, m.hausse_realisee));
  const n = d.length, moy = d.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(d.reduce((a, b) => a + (b - moy) ** 2, 0) / (n - 1));
  return { moyenne: moy, ecartType: sd, erreurType: sd / Math.sqrt(n), n };
}
const ECART_TEST = ecartLogLoss(D.historique_test);

const CHIFFRES = {
  moisTotal: D.serie.length,
  moisEntrainement: D.serie.filter((m) => m.bloc === "entraînement").length,
  moisValidation: D.serie.filter((m) => m.bloc === "validation").length,
  moisTest: ev.mois_test,
  baissesTest: ev.baisses_test,
  llModele: met.logistique["log-loss"],
  llConstante: met[CONST]["log-loss"],
  regle: perf["règle du modèle"].cumul,
  couvert: perf["toujours acheter, couvert"].cumul,
  nonCouvert: perf["toujours acheter, non couvert"].cumul,
  thetaA: D.decision.seuils.theta_a,
  thetaV: D.decision.seuils.theta_v,
  marge: D.decision.marge,
  essais: D.essais.filter((e) => e.cible === "nikkei").length,
  llCV: D.essais.find((e) => e.retenu && e.modele === "logit" && e.cible === "nikkei").logloss,
  pDernier: D.signal.p_hausse,
  moisDernier: D.signal.mois_des_donnees,
  actionDernier: D.signal.action_du_modele,
};

const vol = D.volatilite;
const volAvant = vol.prevision.avant_test_2016_2023.methodes["régression : 1, 3, 6 mois + VIX + rendement"];
const volTest = vol.prevision.test_2024_2026.methodes["régression : 1, 3, 6 mois + VIX + rendement"];
const agiteAvant = vol.agitation.avant_test_2016_2023.modeles.logistique;
const sr = D.signal_risque;
const srRatio = (periode, strat) => sr.strategies[periode][strat].rendement_par_unite_de_risque;
const RISQUE = {
  r2Avant: volAvant.r2_hors_echantillon,
  r2Test: volTest.r2_hors_echantillon,
  aucAgite: agiteAvant.auc,
  r2JourTest: sr.prevision["2024-2026"][sr.regle.modele],
  ratio: (periode) => ({
    garder: srRatio(periode, "acheter et garder"),
    signal: srRatio(periode, "signal risque, chaque jour (règle figée)"),
  }),
};

// ---------- the seven rooms ----------
// ton: the room's colours (walls, floor, light) for the tour; the same serve as accents in the reading
// ---------- Applied ML path: the project's steps, in notebook order ----------
const DS = D.dataset ?? {};
const V2 = D.v2 ?? {};
const CB = V2.controle_bloomberg ?? {};
const E2 = V2.evaluation_test;
const CONST2 = "constante (fréquence de l'entraînement)";
const serieV2 = V2.serie ?? D.serie;
const blocsV2 = ["entraînement", "validation", "test"].map((b) => serieV2.filter((m) => m.bloc === b).length);
const baissesEntrainement = (() => {   // share of falling months in training, from the closes
  const s = serieV2; let n = 0, b = 0;
  for (let i = 1; i < s.length; i++) if (s[i - 1].bloc === "entraînement") { n++; if (s[i].cloture <= s[i - 1].cloture) b++; }
  return n ? b / n : null;
})();
const libelleVar = (v) => VARIABLES_EN[v] ?? v.replace(/_/g, " ");
const contribs = [...(D.explication ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
const V2_INFO = E2 ? {
  modele: E2.modele, mois: E2.mois_entrainement,
  ll: E2.metriques[E2.modele]["log-loss"], llConst: E2.metriques[CONST2]["log-loss"],
  llLogit: E2.metriques["logistique"]["log-loss"], llLogitVal: V2.decision_finale.validation.log_loss_calibree.logit,
  ecart: E2.ecart_log_loss, regle: E2.performance_euros["règle du modèle"].cumul,
  couvert: E2.performance_euros["toujours acheter, couvert"].cumul, actions: E2.actions,
} : null;

// Third stage: the improvement levers, judged on 2010-2023 under a protocol frozen before any computation
const V3 = D.v3 ?? {};
const J3 = "2010-2023 (jugement)";
const V3_INFO = V3.tests_probabilites ? (() => {
  const tp = V3.tests_probabilites, te = V3.tests_euros;
  const meilleure = Object.keys(tp).sort((a, b) => tp[a].ecart_vs_constante - tp[b].ecart_vs_constante)[0];
  return {
    J: J3, mois: V3.mois_par_periode[J3], fige: V3.protocole.fige_le, sha: V3.protocole.sha256,
    tests: Object.keys(tp).length + Object.keys(te).length, retenus: V3.retenus.probabilites.length + V3.retenus.euros.length,
    meilleure, ecart: tp[meilleure].ecart_vs_constante, se: tp[meilleure].erreur_type,
    pMin: Math.min(...[...Object.values(tp), ...Object.values(te)].map((t) => t.p_holm)),
    ref: V3.euros[J3]["achat couvert, toujours"], moitie: V3.euros[J3]["couverture à moitié"],
    dose: V3.euros[J3]["achat couvert, dosé par la volatilité"], neutreConstante: V3.actions_2010_2023?.constante?.neutre ?? 0,
  };
})() : null;

// Room III: each model's best cross-validation trial, against its log-loss on the test
const ESSAIS_PAR_MODELE = Math.round(CHIFFRES.essais / 3);
const CV_TEST = Object.fromEntries([["logit", "logistique"], ["rf", "Random Forest"], ["lgbm", "LightGBM"]].map(([m, nomTest]) => [m, {
  cv: D.essais.find((e) => e.retenu && e.modele === m && e.cible === "nikkei")?.logloss,
  test: D.evaluation.metriques[nomTest]?.["log-loss"],
}]));
const parcours = (m) => `${dec(CV_TEST[m].cv)} → ${dec(CV_TEST[m].test)}`;

const SALLES_ML = [
  {
    id: "dataset", num: "I", nom: "The dataset", kanji: "集",
    notebooks: ["00a_collecte_V1", "00b_collecte_V2"], docs: [],
    seances: [["S1", "Data, the prediction-time test, leakage"], ["Brief 1", "EDA and problem framing"]],
    presenter: [
      `<b>The question (S1).</b> At the end of each month, predict whether the Nikkei falls the following month. One row per month end: ${nombre(DS.mois ?? serieV2.length)} months, from ${(DS.premier_mois ?? "").slice(0, 4)} to ${(DS.dernier_mois ?? "").slice(0, 4)}.`,
      "<b>The prediction-time test (S1).</b> Every column is lagged to its publication date: it only enters the table on the date it was actually known.",
      `<b>Leakage (S1).</b> Taken at its Bloomberg date, the Tankan would have leaked: it would have been used before its publication. An automatic audit stops the build if a feature looks into the future.`,
    ],
    titre: "Building the table, month by month",
    oeuvre: "The stack of months",
    legende: `One disc per month, from ${moisLong(serieV2[0].mois)} (bottom) to ${moisLong(serieV2[serieV2.length - 1].mois)} (top). Each disc is shifted by the month's return: the stack twists in turbulent months. Dark discs are falling months.`,
    clair: "Everything starts with the table. Each row is a month end, each column a piece of information that was really known that day: prices, rates, FX, business conditions, uncertainty and news, gathered since 1999, mapped onto the Tokyo calendar and lagged to their publication. At this stage the table is only for exploring.",
    technique: `${nombre(DS.colonnes ?? 0)} monthly columns and ${nombre(DS.variables_journalieres ?? 0)} daily ones, ${nombre(DS.mois ?? serieV2.length)} months from ${DS.premier_mois ?? ""} to ${DS.dernier_mois ?? ""}. Sources: Yahoo Finance for markets, the Ministry of Finance for the Japanese yield curve, the Bank of Japan for the Tankan, monetary aggregates and FX, the ECB and Bundesbank, the OECD for leading indicators and inflation, uncertainty and geopolitical-risk indices, and GDELT news scored by FinBERT. Each column carries its publication lag in the variable dictionary. Bloomberg serves as the reference: once lagged to its publication date, the table's Tankan matches Bloomberg on ${CB.tankan?.valeurs_identiques ?? "—"} quarters out of ${CB.tankan?.trimestres_compares ?? "—"}; taken at its Bloomberg date, it would have been used before being published. The Bloomberg VIX export, converted to euros, is not used, and the release calendar, truncated at 5,000 rows, only covers 1999-2006.`,
    chiffres: [
      [nombre(DS.mois ?? serieV2.length), `months, from ${(DS.premier_mois ?? "").slice(0, 4)} to ${(DS.dernier_mois ?? "").slice(0, 4)}`],
      [nombre(DS.colonnes ?? 0), "monthly columns"],
      [`${CB.tankan?.valeurs_identiques ?? "—"}/${CB.tankan?.trimestres_compares ?? "—"}`, "Tankan quarters identical to Bloomberg"],
    ],
    ton: { mur: "#2f3a3a", sol: "#b9b1a5", ciel: "#dfe6e4", texte: "#f3efe8", accent: "#9fb5ae" },
  },
  {
    id: "exploration", num: "II", nom: "The exploration", kanji: "探",
    notebooks: ["01_cadrage_eda_variables"], docs: [],
    seances: [["S1", "EDA and the training, validation, test split"], ["S7", "Class balance"], ["Briefs 1 to 3", "Framing, features, imbalance"]],
    presenter: [
      `<b>The target and its balance (S1, S7).</b> 1 if the Nikkei falls the following month: ${baissesEntrainement == null ? "—" : pct(baissesEntrainement, 0)} of training months. The classes are nearly balanced; we still judge on log-loss and PR-AUC, not accuracy.`,
      "<b>A split in time order (S1).</b> Training up to 2021, validation 2022-2023, and a 2024-2026 test opened only once. A random split would let the model see the future.",
      "<b>Justified features (brief 2).</b> 3- and 12-month momentum, smoothed volatility, change in the 10-year yield, Tankan, carry and euro-yen volatility, news volume and tone, plus a k-means market regime. Two no-skill baselines: the constant and “always buy”.",
    ],
    titre: "Look before you model",
    oeuvre: `The vase of ${serieV2.length} months`,
    legende: `Its profile follows the Nikkei's monthly close, from ${moisLong(serieV2[0].mois)} (at the foot) to ${moisLong(serieV2[serieV2.length - 1].mois)} (at the neck). Two grooves mark the start of validation and the start of the test.`,
    clair: "Before any model, we look: the Nikkei's path, the share of falling months, what moves together, and how to cut time. Exploration fixes the target, the candidate features, the no-skill baselines and the split.",
    technique: `The target is 1 if the Nikkei, in yen, falls the following month: it is the positive class of the metrics. The split follows time: training up to 2021, validation 2022-2023, and a 2024-2026 test opened only once. Two no-skill baselines: the constant forecast (the training frequency of falls) and “always buy”. Ten features are kept, plus a market regime learned by k-means. Caveat: they were chosen from an exploration of 2017-2026, which overlaps validation and test.`,
    chiffres: [
      [`${blocsV2[0]} · ${blocsV2[1]} · ${blocsV2[2]}`, "training · validation · test months"],
      [baissesEntrainement == null ? "—" : pct(baissesEntrainement, 0), "of training months are falls"],
      ["10 + 1", "features, plus a k-means regime"],
    ],
    ton: { mur: "#cbb796", sol: "#a8957a", ciel: "#fbf4e8", texte: "#fffaf2", accent: "#7d6a4f" },
  },
  {
    id: "apprentissage", num: "III", nom: "The learning", kanji: "学",
    notebooks: ["02_pipeline_modeles_optuna"], docs: [],
    seances: [["S2", "Logistic regression and log-loss"], ["S3", "Regularisation"], ["S4", "Decision trees"], ["S5", "Random forests and boosting"], ["Briefs 4 to 7", "Progression, pipeline, Optuna, log"]],
    presenter: [
      "<b>A progression of three models (S2 to S5, brief 4).</b> A penalised logistic (S2, S3), a random forest (S4, S5) and a LightGBM (S5), compared on the same log-loss.",
      "<b>A single pipeline (brief 5).</b> Imputation, standardisation, k-means regime and model are fitted together, fold by fold: no statistic from the future leaks into the past.",
      `<b>Optuna without an optimistic score (S3, briefs 6 and 7).</b> ${nombre(CHIFFRES.essais)} trials on folds that respect time (TimeSeriesSplit), all logged. The best of ${ESSAIS_PAR_MODELE} trials is always flattering: LightGBM goes from ${dec(CV_TEST.lgbm.cv)} in cross-validation to ${dec(CV_TEST.lgbm.test)} on the test, the logistic from ${dec(CV_TEST.logit.cv)} to ${dec(CV_TEST.logit.test)}. Hence the rule announced before the test: the logistic, unless a more complex model beats it on validation in both PR-AUC and calibrated log-loss.`,
    ],
    titre: `Three models, ${nombre(CHIFFRES.essais)} trials`,
    oeuvre: "The field of trials",
    legende: "One stem per Optuna trial, in three rows: logistic, random forest, LightGBM. The taller the stem, the lower the cross-validation log-loss. The tinted stem is the selected trial.",
    clair: "A logistic regression, a random forest and a LightGBM, tuned by Optuna on folds that respect time order. Everything that learns a parameter, imputation and regimes included, stays inside the pipeline.",
    technique: `scikit-learn pipeline: imputation, standardisation, k-means regime, model. ${CHIFFRES.essais} Optuna trials on the main target (${ESSAIS_PAR_MODELE} per model), with a TimeSeriesSplit; the penalty and class weighting are chosen in cross-validation. Best cross-validation trial: LightGBM ${dec(CV_TEST.lgbm.cv)}, random forest ${dec(CV_TEST.rf.cv)}, logistic ${dec(CV_TEST.logit.cv)}. On the test, the order flips: logistic ${dec(CV_TEST.logit.test)}, LightGBM ${dec(CV_TEST.lgbm.test)}, forest ${dec(CV_TEST.rf.test)}, and the constant (${dec(CHIFFRES.llConstante)}) beats all three. Keeping the best of ${ESSAIS_PAR_MODELE} trials means keeping the one the folds favoured most by chance: the more flexible the model, the wider the gap. No more complex model met the selection rule on validation, so the logistic is kept. Platt calibration on the out-of-fold predictions.`,
    chiffres: [["3", "models compared"], [nombre(CHIFFRES.essais), "Optuna trials"], [parcours("lgbm"), "LightGBM: cross-validation → test"]],
    ton: { mur: "#a26a52", sol: "#8c6b5c", ciel: "#fae9de", texte: "#fff5ee", accent: "#f0c7b0" },
  },
  {
    id: "regle", num: "IV", nom: "The rule", kanji: "律",
    notebooks: ["03_calibration_seuils"], docs: [],
    seances: [["S7", "Decision threshold"], ["S8", "Probability calibration"], ["Brief 9", "Calibration diagnostics"]],
    presenter: [
      `<b>Calibrate before deciding (S8).</b> Platt calibration is learned on the out-of-fold predictions (a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}): a stated probability must match an observed frequency.`,
      `<b>A threshold that is not 50% (S7).</b> It comes from the gains in euros: buy above ${pct(CHIFFRES.thetaA, 0)} probability of a rise, sell below ${pct(CHIFFRES.thetaV, 0)}, stay neutral in between, with a margin of ${pct(CHIFFRES.marge, 1)} per month.`,
      "<b>Frozen before the test.</b> Model, calibration and thresholds were committed before opening 2024-2026 (commit 0d8df2f): nothing is tuned on the test.",
    ],
    titre: "From a probability to an action",
    oeuvre: "The dial",
    legende: "The dial runs from 0 to 100% probability of a rise. On the left the “sell” zone, in the middle “neutral”, on the right “buy”. The gnomon points to the forecast for " + moisLong(moisSuivant(CHIFFRES.moisDernier)) + ".",
    clair: `The model gives a probability of a rise. The rule compares the expected gain of a buy and of a sell with a margin of ${pct(CHIFFRES.marge, 1)}: above ${pct(CHIFFRES.thetaA, 0)}, buy; below ${pct(CHIFFRES.thetaV, 0)}, sell; in between, stay neutral. The thresholds were frozen and committed before opening the test.`,
    technique: `The average gains come from training: a buy earns ${pct(D.decision.couts.B_u, 1, true)} in a rising month and ${pct(D.decision.couts.B_d, 1, true)} in a falling month; a sell does the opposite. Buy if p·B_u + (1 − p)·B_d exceeds the margin, sell if p·S_u + (1 − p)·S_d exceeds it. Hence the thresholds θ_buy = ${dec(CHIFFRES.thetaA)} and θ_sell = ${dec(CHIFFRES.thetaV)}. Platt calibration: a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}. Hedging: always hedged. Decision frozen at commit 0d8df2f. With no signal, the same rule applied to the constant forecast buys every month.`,
    chiffres: [[pct(CHIFFRES.thetaA, 1), "buy threshold"], [pct(CHIFFRES.thetaV, 1), "sell threshold"], [pct(CHIFFRES.marge, 1), "required margin"]],
    ton: { mur: "#8d9883", sol: "#7a7f70", ciel: "#f1f3e9", texte: "#fbfcf6", accent: "#e3e8d5" },
  },
  {
    id: "epreuve", num: "V", nom: "The trial", kanji: "試",
    notebooks: ["03b_test_final"], docs: ["rapport"],
    seances: [["S1", "The test, opened only once"], ["S7", "PR-AUC against the baseline"], ["S8", "Brier, ECE, reliability"], ["Brief 9", "Can the probabilities be trusted?"]],
    presenter: [
      `<b>A single opening (S1).</b> ${CHIFFRES.moisTest} months, from 2024 to 2026, evaluated with the frozen decision, without any tuning.`,
      `<b>The course metrics against the constant (S7, S8).</b> Log-loss ${dec(met.logistique["log-loss"])} vs ${dec(met[CONST]["log-loss"])}, PR-AUC ${dec(met.logistique["PR-AUC"], 2)} vs ${dec(met[CONST]["PR-AUC"], 2)}, Brier ${dec(met.logistique.Brier)} vs ${dec(met[CONST].Brier)}. The model forecasts a ${pct(met.logistique["proba moyenne"], 0)} chance of a fall on average, against ${pct(met.logistique["fréquence observée"], 0)} observed: it overestimates falls (ECE ${dec(met.logistique.ECE, 2)}), so its probabilities cannot be used as they are.`,
      `<b>The verdict.</b> The log-loss gap (${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}) is inconclusive; the rule returns ${pct(CHIFFRES.regle, 1, true)} vs ${pct(CHIFFRES.couvert, 1, true)} for buying hedged. As announced before the test: buy, hedged.`,
    ],
    titre: `${CHIFFRES.moisTest} months, only once`,
    oeuvre: "The circle of test months",
    legende: "One stone per test month, from January 2024 to September 2026. Its height follows the size of the month's move; light if it rose, dark if it fell. The dot at its foot shows the model's action: green for buy, brick red for sell.",
    clair: `On 2024-2026, the model does no better than the constant forecast: ${dec(CHIFFRES.llModele)} log-loss vs ${dec(CHIFFRES.llConstante)}. Over ${CHIFFRES.moisTest} months, the gap allows no conclusion either way. As planned before the test, the recommendation falls back on “always buy, hedged”.`,
    technique: `Mean month-by-month log-loss gap: ${dec(ECART_TEST.moyenne, 3)}, with a standard error of ${dec(ECART_TEST.erreurType, 3)}. The monthly targets do not overlap, so the plain standard error is enough. The model's rule ends at ${pct(CHIFFRES.regle, 1, true)}; buy-and-hold hedged, at ${pct(CHIFFRES.couvert, 1, true)}. That second figure describes the 2024-2026 market more than any skill: with no signal, the rule has nothing to add to the market. The indices are price indices, without dividends, and no costs are counted.`,
    chiffres: [[`${dec(CHIFFRES.llModele)} / ${dec(CHIFFRES.llConstante)}`, "log-loss: model / constant"], [pct(CHIFFRES.regle, 1, true), "model's rule, in euros"], [pct(CHIFFRES.couvert, 1, true), "buy and hold, hedged"]],
    ton: { mur: "#262a35", sol: "#545660", ciel: "#d4d9e6", texte: "#eef0f6", accent: "#a9b3cb" },
  },
  {
    id: "explication", num: "VI", nom: "The explanation", kanji: "解",
    notebooks: ["04_explicabilite_diagnostics", "07_seconde_version_bloomberg"], docs: [],
    seances: [["S9", "Slice diagnostics, permutation, SHAP"], ["Brief 8", "Global importance and local explanations"]],
    presenter: [
      "<b>Slices (S9).</b> A good overall score can hide a failure: we cut the test by volatility regime and by Bank of Japan meeting month.",
      "<b>Permutation (S9).</b> We shuffle a feature and measure the log-loss lost. A trap seen in class: two correlated features stand in for each other, and each looks useless.",
      `<b>SHAP (S9, brief 8).</b> The prediction for ${moisLong(moisSuivant(CHIFFRES.moisDernier))} is broken down feature by feature; “${libelleVar(contribs[0]?.variable ?? "")}” weighs the most. Does it make economic sense? Its link with the return changes sign after 2021: no, not in a stable way.`,
    ],
    titre: "What drives a prediction",
    oeuvre: "The balance",
    legende: `The twelve features of the latest prediction (${moisLong(moisSuivant(CHIFFRES.moisDernier))}) hanging from a beam: on the right those that push towards a fall, on the left those that push towards a rise. Each weight's size follows its contribution.`,
    clair: "A model you cannot explain cannot be defended. We measure what each feature brings: by shuffling it to see what the model loses, by breaking down each prediction, and by looking at where the model succeeds and where it fails.",
    technique: `Permutation importance on the test, SHAP values, partial dependence and slices (volatility regimes, BoJ meeting months). For the latest prediction, the feature that weighs the most is “${libelleVar(contribs[0]?.variable ?? "")}” (${dec(contribs[0]?.contribution ?? 0, 2)} on the log-odds of a fall). It is also the most fragile: its link with the return changes sign after 2021, and GDELT caps each quarterly query at 250 articles, so a month's count depends on the rest of the quarter.`,
    chiffres: [[nombre(contribs.length), "features in the balance"], [Maj(libelleVar(contribs[0]?.variable ?? "—")), `weighs the most in ${moisLong(moisSuivant(CHIFFRES.moisDernier))}`], [pct(CHIFFRES.pDernier, 1), "stated probability of a rise"]],
    ton: { mur: "#9b8466", sol: "#857563", ciel: "#f7efe2", texte: "#fffaf2", accent: "#e9d8bd" },
  },
  {
    id: "apres", num: "VII", nom: "After the test", kanji: "後",
    notebooks: ["06_annexe_news_prix", "07_seconde_version_bloomberg", "08_ameliorations_sans_surapprentissage"], docs: ["rapport"],
    seances: [["S1", "Generalisation, leakage"], ["S3", "Choosing without looking at the test"], ["Afterwards", "Exploration, with no value as proof"]],
    presenter: [
      V2_INFO ? `<b>Retraining on 1999-2026 (S1).</b> Same pipeline, same selection rule, same 2024-2026 test: ${V2_INFO.modele}, ${dec(V2_INFO.ll)} log-loss vs ${dec(V2_INFO.llConst)} for the constant. The gap to the constant shrinks from ${dec(ECART_TEST.moyenne)} to ${dec(V2_INFO.ecart.moyenne)}: better, not enough.${CB.ipc ? ` Bloomberg serves as a check: the table's CPI is the same series, shifted one month for its release (correlation ${dec(CB.ipc.correlations.decalage_1)}).` : ""}` : "<b>Retraining on a longer history.</b>",
      V3_INFO ? `<b>Improving without overfitting (S3).</b> Protocol frozen before any computation, ${V3_INFO.tests} levers retrained month by month over ${V3_INFO.mois} months (2010-2023), Holm correction: ${V3_INFO.retenus === 0 ? "none is kept" : `${V3_INFO.retenus} kept`}. The best gains ${dec(-V3_INFO.ecart, 4)} of log-loss, i.e. ${dec(-V3_INFO.ecart / V3_INFO.se, 1)} standard errors: noise.` : "<b>Improving without overfitting.</b>",
      `<b>Risk can be forecast, direction cannot.</b> Next month's volatility can be forecast (out-of-sample R² ${dec(RISQUE.r2Avant, 2)} on 2016-2023, ${dec(RISQUE.r2Test, 2)} on the test), and a turbulent month is recognised with an AUC of ${dec(RISQUE.aucAgite, 2)}.${V3_INFO ? ` Yet sizing the purchase by volatility does not beat buying hedged (Sharpe ${dec(V3_INFO.dose.sharpe, 2)} vs ${dec(V3_INFO.ref.sharpe, 2)}).` : ""} Since the test had been seen, all of this remains exploratory: the decision is still to buy, hedged.`,
    ],
    titre: "What we tried next",
    oeuvre: "The breath",
    legende: "A spiral from 2016 (bottom) to 2026 (top), whose thickness follows each month's realised volatility. The tinted parts are turbulent months, above 20% annual volatility.",
    clair: "Once the test was opened, three leads were followed. First, retrain the same model on a longer history, from 1999 to 2026, with Bloomberg as the reference. Next, apply every feasible improvement lever, under a protocol frozen before any computation and judged on 2010-2023: none passes. Finally, forecast how turbulent the market will be rather than its direction: turbulence can be forecast, direction cannot. One lead remains open: the table has no valuation or earnings variable (P/E, revisions of expected earnings), which Bloomberg provides.",
    technique: V2_INFO
      ? `With ${V2_INFO.mois} training months instead of ${CHIFFRES.moisEntrainement}, the rule from notebook 03 selects ${V2_INFO.modele} on validation. On the same 2024-2026 test, already seen, its log-loss is ${dec(V2_INFO.ll)} vs ${dec(V2_INFO.llConst)} for the constant (gap ${dec(V2_INFO.ecart.moyenne, 3)} ± ${dec(V2_INFO.ecart.erreur_type, 3)}), and its rule returns ${pct(V2_INFO.regle, 1, true)} vs ${pct(V2_INFO.couvert, 1, true)} for buying hedged. Better than the first version, still no better than the constant. The logistic would have beaten the constant on the test (${dec(V2_INFO.llLogit)}), but the announced rule had ruled it out on validation (${dec(V2_INFO.llLogitVal)}): choosing it now would mean choosing on the test.${V3_INFO ? ` The improvement levers, retrained each month over ${V3_INFO.mois} months of 2010-2023: ${V3_INFO.retenus === 0 ? `none of the ${V3_INFO.tests} passes` : `${V3_INFO.retenus} of ${V3_INFO.tests} pass`} the Diebold-Mariano test or the Sharpe bootstrap after Holm correction (${V3_INFO.pMin >= 0.995 ? "every corrected p equals 1" : `smallest corrected p: ${dec(V3_INFO.pMin, 2)}`}). The best, “${levier(V3_INFO.meilleure)}”, gains ${dec(-V3_INFO.ecart, 4)} of log-loss, i.e. ${dec(-V3_INFO.ecart / V3_INFO.se, 1)} standard errors.` : ""} Next month's volatility: out-of-sample R² of ${dec(RISQUE.r2Avant, 2)} on 2016-2023 and ${dec(RISQUE.r2Test, 2)} on 2024-2026; a turbulent month is recognised with an AUC of ${dec(RISQUE.aucAgite, 2)}.`
      : `Next month's volatility: out-of-sample R² of ${dec(RISQUE.r2Avant, 2)} on 2016-2023; a turbulent month is recognised with an AUC of ${dec(RISQUE.aucAgite, 2)}.`,
    chiffres: V2_INFO
      ? [[`${dec(V2_INFO.ll)} / ${dec(V2_INFO.llConst)}`, "log-loss 1999-2026: model / constant"],
         V3_INFO ? [V3_INFO.retenus === 0 ? `None of ${V3_INFO.tests}` : `${V3_INFO.retenus} of ${V3_INFO.tests}`, "levers kept by the frozen protocol"] : [pct(V2_INFO.regle, 1, true), "second version's rule, in euros"],
         [dec(RISQUE.aucAgite, 2), "AUC: spotting a turbulent month"]]
      : [[dec(RISQUE.r2Avant, 2), "volatility R², 2016-2023"], [dec(RISQUE.aucAgite, 2), "AUC for a turbulent month"], ["—", ""]],
    ton: { mur: "#95a3ac", sol: "#7c858b", ciel: "#f2f6f8", texte: "#fbfdfe", accent: "#e1e8ec" },
  },
];

// ---------- Maths path: the appendix for Mathematics & Statistics for ML ----------
// It must derive the cost, the gradient and the prior of the project's model, then study the sensitivity of its
// optimisation; the plan follows the L1 recipe (data, model, cost, optimiser) and ends with the L2 option.
const MOD = D.modele;
const M = CHIFFRES.moisEntrainement;
const LAMBDA = 1 / (2 * M * MOD.C), TAU = Math.sqrt(MOD.C);
const MC = D.maths ?? {};
const OLS = MC.ols ?? {};
const MATHS = { lambda: LAMBDA, tau: TAU, ols: OLS, llEntrainement: MC.logloss_entrainement, coutPenalise: MC.cout_penalise_entrainement };
const f = (t) => `<span class="f">${t}</span>`;   // a formula, in serif italics

const SALLES_MATHS = [
  {
    id: "m-modele", num: "I", nom: "The model", kanji: "型",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "The recipe: data, model, cost, optimiser"], ["L2", "The design matrix"]],
    presenter: [
      `<b>The L1 recipe.</b> Data: m = ${M} training months and d = ${MOD.coefficients.length} standardised features. The model, the cost and the optimiser come next, one room each.`,
      `<b>The model.</b> A linear score ${f("u = wᵀx + b")}, written for all months at once with the L2 design matrix, then the sigmoid ${f("σ(u) = 1 / (1 + e<sup>−u</sup>)")} turns it into a probability of a fall.`,
      `<b>The property to remember.</b> ${f("σ′(u) = σ(u)(1 − σ(u))")}: this is what will make the gradient so simple, room III.`,
    ],
    titre: "One probability per month",
    oeuvre: "The sigmoid",
    legende: `A ceramic block whose edge follows σ(u) = 1 / (1 + e⁻ᵘ). The beads are the ${M} training months, placed at the score the model gives them: light if the Nikkei rose, dark if it fell.`,
    clair: "At each month end, the model combines twelve features into a score, then the sigmoid turns that score into a probability of a fall, between 0 and 1. The whole path explains how the weights of that combination are chosen, and how to check they are the right ones.",
    technique: `We have m = ${M} training months and d = ${MOD.coefficients.length} standardised features (news, prices, rates, FX, and two distances to the k-means regimes). The design matrix X̃ = [X, 1] has one row per month and a column of 1s for the intercept. The model is ${f("p = σ(wᵀx + b)")}, with ${f("σ(u) = 1 / (1 + e<sup>−u</sup>)")}. Differentiating (1 + e<sup>−u</sup>)<sup>−1</sup>, ${f("σ′(u) = e<sup>−u</sup> / (1 + e<sup>−u</sup>)² = σ(u)(1 − σ(u))")}.`,
    chiffres: [[nombre(M), "training months, m"], [nombre(MOD.coefficients.length), "standardised features, d"], [dec(MOD.intercept, 3), "learned intercept b"]],
    ton: { mur: "#2e3a4e", sol: "#b7b2aa", ciel: "#dde4ee", texte: "#f1f3f7", accent: "#9fb0c9" },
  },
  {
    id: "m-cout", num: "II", nom: "The cost", kanji: "損",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L5", "Maximum likelihood"], ["Cheat sheet", "The Bernoulli distribution"]],
    presenter: [
      `<b>Each month is a Bernoulli draw.</b> ${f("P(y | x) = p<sup>y</sup>(1 − p)<sup>1−y</sup>")}, where p is the probability of a fall and y is 1 if the month fell.`,
      `<b>From likelihood to log-loss (L5).</b> Assuming independent months, the likelihood is a product; its logarithm, sign-flipped and divided by m, gives ${f("J(w, b) = −(1/m) Σ [y log p + (1 − y) log(1 − p)]")}.`,
      `<b>On our data.</b> J equals ln 2 ≈ 0.693 at the start (w = 0, p = 50%) and ${MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—"} at the minimum, on training. Independence of the months is an approximation, open to discussion.`,
    ],
    titre: "From likelihood to log-loss",
    oeuvre: "The two branches",
    legende: `Two ceramic curves: the loss −log p when the month falls, and −log(1 − p) when it rises. The beads are the ${M} training months, placed at the loss the model pays on them.`,
    clair: "Each month is a coin toss with probability p. Making the observed months as likely as possible amounts to minimising the log-loss: it is small when the model confidently states what happens, and very large when it is confidently wrong.",
    technique: `${f("P(y | x) = p<sup>y</sup>(1 − p)<sup>1−y</sup>")}. If the months are independent, the likelihood ${f("L = Π p<sup>y</sup>(1 − p)<sup>1−y</sup>")} is a product; maximising its logarithm amounts to minimising ${f("J(w, b) = −(1/m) log L")}. The logarithm turns the product into a sum and does not move the maximum. An assumption to discuss: monthly returns are weakly correlated, not exactly independent. At the minimum, over the ${M} training months, J equals ${MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—"}, and the penalised cost of room IV ${MC.cout_penalise_entrainement != null ? dec(MC.cout_penalise_entrainement) : "—"}; a fair coin toss at 50% would give ln 2 ≈ 0.693.`,
    chiffres: [[dec(Math.log(2)), "ln 2: the cost at the start, w = 0"], [MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—", "log-loss at the minimum, training"], [MC.cout_penalise_entrainement != null ? dec(MC.cout_penalise_entrainement) : "—", "penalised cost J<sub>λ</sub> at the minimum"]],
    ton: { mur: "#c9bca6", sol: "#a99c86", ciel: "#fbf6ec", texte: "#fffaf1", accent: "#8a7a5f" },
  },
  {
    id: "m-gradient", num: "III", nom: "The gradient", kanji: "勾",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "The gradient of a cost"], ["L2", "The gradient, one weight at a time"]],
    presenter: [
      `<b>The chain rule.</b> ${f("∂J/∂w<sub>j</sub> = (−y/p + (1 − y)/(1 − p)) · p(1 − p) · x<sub>j</sub> = (p − y) x<sub>j</sub>")}: the sigmoid's derivative simplifies everything.`,
      `<b>The least-squares form (L2).</b> In matrix form, ${f("∇<sub>w</sub>J = (1/m) Xᵀ(p − y)")}: the prediction error times the input, exactly as for linear regression.`,
      "<b>Checked.</b> At a random point, the analytic gradient and centred finite differences agree to within 1.3 × 10⁻⁹.",
    ],
    titre: "The error, times the input",
    oeuvre: "The map of slopes",
    legende: "A plate engraved with the cost's contour lines, over two coefficients. Each arrow shows the direction of steepest descent, −∇J; its length shows how steep the slope is.",
    clair: "To know which way to move the weights, we differentiate the cost. The result is strikingly simple: for each month, the prediction error, p − y, multiplied by the month's features.",
    technique: `Chain rule, for one month: ${f("∂J/∂w<sub>j</sub> = (−y/p + (1 − y)/(1 − p)) · p(1 − p) · x<sub>j</sub> = (p − y) x<sub>j</sub>")}. In matrix form: ${f("∇<sub>w</sub>J = (1/m) Xᵀ(p − y)")} and ${f("∂J/∂b = (1/m) Σ (p − y)")}. For the linear regression of L2, ${f("∇J = (1/m) Xᵀ(Xw − y)")}: same form, with p in place of Xw. Numerical check: at a random point, the analytic gradient and centred finite differences agree to within 1.3 × 10⁻⁹.`,
    chiffres: [["(p − y)·x", "the gradient of one month"], ["1.3 × 10⁻⁹", "gap with finite differences"], [nombre(MOD.coefficients.length + 1), "partial derivatives, w and b"]],
    ton: { mur: "#5f7066", sol: "#8c8f86", ciel: "#e6eee8", texte: "#f2f6f2", accent: "#b9c9bd" },
  },
  {
    id: "m-prior", num: "IV", nom: "The prior", kanji: "先",
    notebooks: ["05_annexe_maths_logistique", "02_pipeline_modeles_optuna"], docs: ["annexe"],
    seances: [["L7", "Ridge: the L2 penalty"], ["L2", "When XᵀX is not invertible"]],
    presenter: [
      `<b>The prior.</b> Before seeing the data, we assume each weight is small: ${f("w ∼ N(0, τ²I)")}.`,
      `<b>The maximum a posteriori.</b> It adds ${f("λ‖w‖²")} to the cost, with ${f("λ = 1/(2mτ²)")}: the ridge penalty of L7 is a Gaussian prior.`,
      `<b>On our data.</b> The C = ${dec(MOD.C, 4)} chosen by Optuna gives λ = ${dec(LAMBDA, 3)} and τ = ${dec(TAU, 2)}; the intercept is not penalised. Caveat: λ comes from cross-validation, not from a belief set before seeing the data.`,
    ],
    titre: "The penalty, a prior belief",
    oeuvre: "The bell",
    legende: `The density of the Gaussian prior N(0, τ²), with τ = ${dec(TAU, 2)}. The twelve stems are the weights learned by the final model: all stay in the heart of the bell.`,
    clair: "Before seeing the data, we assume each weight is probably small. Writing that belief as a centred normal distribution, then looking for the most probable weights a posteriori, is exactly the same as adding an L2 penalty to the cost.",
    technique: `Prior ${f("w ∼ N(0, τ²I)")}. The maximum a posteriori adds ${f("−(1/m) log p(w) = ‖w‖² / (2mτ²)")}: ${f("J<sub>λ</sub> = J + λ‖w‖²")}, with ${f("λ = 1/(2mτ²)")}, and ${f("∇J<sub>λ</sub> = (1/m) Xᵀ(p − y) + 2λw")}. scikit-learn minimises ½‖w‖² + C Σ ℓ; dividing by Cm gives back J<sub>λ</sub> with λ = 1/(2mC). The C = ${dec(MOD.C, 4)} chosen by Optuna gives λ = ${dec(LAMBDA, 3)} and τ = ${dec(TAU, 2)}. As in L2, where ridge makes XᵀX + λI invertible when features repeat, the penalty stabilises the weights. The intercept has no prior: liblinear penalised it and pulled the probabilities towards 50%, hence the ${MOD.solveur} solver.`,
    chiffres: [[dec(MOD.C, 4), "C, chosen by Optuna"], [dec(LAMBDA, 3), "λ = 1/(2mC)"], [dec(TAU, 2), "τ, prior standard deviation of a weight"]],
    ton: { mur: "#a87b66", sol: "#8f7466", ciel: "#fbe9de", texte: "#fff4ec", accent: "#efc9b4" },
  },
  {
    id: "m-convexite", num: "V", nom: "Convexity", kanji: "凸",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L7", "The penalised cost, strictly convex"], ["L8", "Sensitivity to the starting point"]],
    presenter: [
      `<b>The Hessian.</b> ${f("H = (1/m) X̃ᵀ S X̃ + 2λ diag(1, …, 1, 0)")}, with ${f("S = diag(p(1 − p))")}: it is positive definite.`,
      "<b>So a single minimum.</b> The penalised cost is strictly convex: it has at most one minimum, and the penalty, which makes it grow without bound, guarantees that it exists.",
      "<b>Checked (L8).</b> Three very different starts, from J = 0.69 to 12.4, reach the same minimum to within 10⁻¹⁷.",
    ],
    titre: "A single valley floor",
    oeuvre: "The cost landscape",
    legende: "The penalised log-loss surface over two coefficients, engraved with its contour lines. The ball follows gradient descent down to the minimum.",
    clair: "The penalised cost is shaped like a bowl: wherever you start, you roll down to the same point. The notebook checks this by running the descent from three very different starts.",
    technique: `Hessian: ${f("H = (1/m) X̃ᵀ S X̃ + 2λ diag(1, …, 1, 0)")}, with ${f("S = diag(p(1 − p))")}. For (v, c) ≠ 0, ${f("(v, c)ᵀ H (v, c) = (1/m)(Xv + c𝟏)ᵀ S (Xv + c𝟏) + 2λ‖v‖² > 0")}: J<sub>λ</sub> is strictly convex, so its minimum is unique. It exists because the penalty makes J<sub>λ</sub> grow without bound as ‖w‖ grows (coercivity). Three starts, from J = 0.69 to 12.4, reach the same minimum to within 10⁻¹⁷.`,
    chiffres: [["H ≻ 0", "positive definite Hessian"], ["3 → 1", "three starts, a single minimum"], ["10⁻¹⁷", "gap between the minima found"]],
    ton: { mur: "#35302e", sol: "#5e5853", ciel: "#e6dfd8", texte: "#f4efe9", accent: "#bdb0a3" },
  },
  {
    id: "m-descente", num: "VI", nom: "The descent", kanji: "降",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "Gradient descent, one step by hand"], ["L8", "Sensitivity to step size and iterations"]],
    presenter: [
      `<b>The L1 optimiser.</b> ${f("w ← w − α ∇J<sub>λ</sub>")}, repeated until the gradient vanishes.`,
      "<b>The right step (L8).</b> Since p(1 − p) ≤ ¼, L ≤ 0.962: descent converges for α < 2/L = 2.08. Too small and it crawls; beyond that, it oscillates and diverges.",
      "<b>Checked.</b> With α = 1/L, the hand-coded descent matches lbfgs, scikit-learn's solver, to within 4.6 × 10⁻⁶.",
    ],
    titre: "Choosing the step size",
    oeuvre: "The four steps",
    legende: "Four tables, one per step size, and the same starting point. Too small and the ball never arrives; beyond 2/L, it oscillates and moves away.",
    clair: "Gradient descent moves in small steps in the direction that goes down the most. Everything depends on the step size: too small and you never get there; too large and you jump over the valley. Theory gives the limit, and the hand-coded descent matches scikit-learn.",
    technique: `${f("w ← w − α ∇J<sub>λ</sub>")}. Since p(1 − p) ≤ ¼, the gradient is L-Lipschitz, with ${f("L ≤ ¼ λ<sub>max</sub>(X̃ᵀX̃/m) + 2λ = 0.962")}: standard step α = 1/L = 1.04, guaranteed convergence for α < 2/L = 2.08. This bound is conservative: at the minimum, the local limit is 2/λ<sub>max</sub>(H*) = 2.23. With α = 1/L and 20,000 iterations, the hand-coded descent matches lbfgs to within 4.6 × 10⁻⁶, and ‖∇J<sub>λ</sub>‖ = 1.5 × 10⁻¹⁷ at the point found. Stopping early keeps the weights near 0: it is another way to regularise.`,
    chiffres: [["0.962", "L, Lipschitz constant"], ["2.08", "largest guaranteed step, 2/L"], ["4.6 × 10⁻⁶", "gap with scikit-learn"]],
    ton: { mur: "#8ea2b1", sol: "#7a8791", ciel: "#eef3f7", texte: "#fafcfd", accent: "#dbe5ec" },
  },
  {
    id: "m-moindres", num: "VII", nom: "Least squares", kanji: "線",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L2", "Least squares, normal equations, R²"], ["L1", "Overfitting"]],
    presenter: [
      `<b>The idea (L2).</b> Why not predict next month's return directly, with a linear regression on the same ${OLS.variables ?? 12} features?`,
      `<b>The normal equations, by hand.</b> ${f("X̃ᵀX̃β = X̃ᵀr")}, solved without inverting the matrix: they match scikit-learn to within ${OLS.ecart_scikit_learn != null ? "7 × 10⁻¹⁷" : "—"}.`,
      `<b>R² settles it.</b> ${OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 2) : "—"} on training, ${OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—"} on validation: out of sample, the line does worse than the mean. Hence the choice of a probability and a penalised cost.`,
    ],
    titre: "What if we predicted the return?",
    oeuvre: "The two clouds",
    legende: `A plate and its diagonal, where the predicted return equals the actual return. Each bead is a month, placed at those two returns: light for the ${M} training months, terracotta for the ${OLS.mois_validation ?? 24} validation months, which drift away from the diagonal.`,
    clair: "Before predicting a probability, we can try L2's linear regression on the return itself. The normal equations give the best line on training; on validation, it does worse than the plain mean. That is what justifies predicting a probability, with a penalised cost.",
    technique: `The same ${OLS.variables ?? 12} features, plus a column of 1s: at the bottom of the bowl, the gradient of ${f("Σ (r − X̃β)²")} vanishes, which gives the normal equations ${f("X̃ᵀX̃β = X̃ᵀr")}. Solved with np.linalg.solve, without computing an inverse, they match scikit-learn to within 7 × 10⁻¹⁷. ${f("R² = 1 − Σ(r − r̂)² / Σ(r − r̄)²")} is ${OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 3) : "—"} on training and ${OLS.r2_validation != null ? dec(OLS.r2_validation, 3) : "—"} on validation. A negative R² means the line predicts worse than the mean: the training R² is optimistic, which is the overfitting of L1.`,
    chiffres: [[OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 2) : "—", "R² on training"], [OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—", "R² on validation"], ["7 × 10⁻¹⁷", "gap of the normal equations with scikit-learn"]],
    ton: { mur: "#56485e", sol: "#6c6270", ciel: "#efe6f1", texte: "#f7f2f8", accent: "#cdbdd3" },
  },
];

// ---------- the chosen course: Applied ML or Maths ----------
let choix = new URLSearchParams(location.search).get("cours");
if (choix !== "ml" && choix !== "maths") { try { choix = localStorage.getItem("nikkei-cours"); } catch (e) { choix = null; } }
const COURS = choix === "maths" ? "maths" : "ml";
try { localStorage.setItem("nikkei-cours", COURS); } catch (e) { /* storage unavailable */ }
const SALLES = COURS === "maths" ? SALLES_MATHS : SALLES_ML;
const TOUTES_SALLES = { ml: SALLES_ML, maths: SALLES_MATHS };

// adds the course to a site address, so the choice follows from page to page
function avecCours(href, cours = COURS) {
  const [avant, ancre] = href.split("#");
  const [chemin, requete] = avant.split("?");
  const p = new URLSearchParams(requete || "");
  p.set("cours", cours);
  return `${chemin}?${p}${ancre ? `#${ancre}` : ""}`;
}

const COURS_INFO = {
  ml: {
    nom: "Applied ML", cours: "Applied ML: Foundations, Engineering & Evaluation",
    h1: "Buy, stay neutral or sell <em>the Nikkei</em>",
    devise: "At the end of a month, can we tell whether to buy the Nikkei the following month? A model answers each month with a probability; a rule, frozen before the test, turns it into an action.",
    verdict: `Over the ${CHIFFRES.moisTest} test months, the model does no better than a constant forecast (log-loss ${dec(CHIFFRES.llModele)} vs ${dec(CHIFFRES.llConstante)}). As promised before the test, the recommendation is to buy the Nikkei and hedge against the yen.`,
    rotonde: { mur: 0xd4c6b7, sol: 0xcdb3a4, fond: 0xcfc6ba },
  },
  maths: {
    nom: "Maths", cours: "Mathematics & Statistics for Machine Learning",
    h1: "Logistic regression, <em>redone by hand</em>",
    devise: "What the course appendix asks for: derive the cost, the gradient and the prior of the project's model, then study the sensitivity of its optimisation, up to a hand-coded descent that matches scikit-learn.",
    verdict: `The log-loss is a negative log-likelihood; its gradient is (1/m)·Xᵀ(p − y); the L2 penalty is a Gaussian prior that makes the problem strictly convex; descent converges for α < 2/L. And a linear regression on the return, solved by the normal equations, does worse than the mean out of sample (R² = ${OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—"}).`,
    rotonde: { mur: 0xcdd0cd, sol: 0xb8b2ab, fond: 0xc9ccc9 },
  },
};

const ENTREE = {
  titre: "The Nikkei, month after month",
  devise: COURS === "maths"
    ? "How does the project's model learn its weights, and how do we check them?"
    : "At the end of a month, can we tell whether to buy the Nikkei the following month?",
  ecole: "Applied ML · Mathematics & Statistics for ML — Albert School, MSc 1, fall 2026",
};

const LIMITES_ML = [
  ["The test was not entirely unseen.", "Notebook 01 already displayed statistics from 2024-2026, including the “hedged or unhedged” curve. Permanent hedging was therefore not chosen blind; on 2010-2021, not hedging even did slightly better."],
  ["The features were chosen on 2017-2026.", "The exploratory analysis that guided the choice of features overlaps validation and test."],
  ["The gaps are small compared with the noise.", `Over ${CHIFFRES.moisTest} months, the log-loss gap between the model and the constant (${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}) is inconclusive either way. It would take hundreds of months to see a realistic gain.`],
  ["Returns are simplified.", "Price index without dividends (about 2% a year), no costs, hedging approximated by the short-term rate differential."],
  ["Everything after the test is exploratory.", "The second version on 1999-2026, the volatility work and the risk-based signal were done after 2024-2026 had been opened: they are leads, not confirmed results. Confirming them needs data no one has seen yet: other markets or the months to come."],
  ["The most influential news feature is fragile.", "GDELT caps each quarterly query at 250 articles, so a month's article count depends on the rest of the quarter. It should be rebuilt from GDELT's total volumes, or over shorter windows."],
];

const LIMITES_MATHS = [
  ["The months are not quite independent.", "The likelihood is a product over months assumed independent; monthly returns are weakly correlated, but not exactly uncorrelated. The log-loss is still a good cost; its probabilistic interpretation is an approximation."],
  ["The prior is not set in advance.", "λ, and so τ, comes from cross-validation: it is a setting learned from the data, not a belief set before seeing them."],
  ["The two-dimensional surface is a simplification.", "To draw the cost, the intercept is fixed at its optimum and only two features are kept; the constants L and the local limit of this surface differ from those of the full model (0.962 and 2.23)."],
  ["The 2/L bound is conservative.", "It holds everywhere, but near the minimum p(1 − p) stays well below ¼: descent still converges a little beyond it, up to the local limit."],
  ["The training R² is optimistic.", "It is measured on the months used to compute β. Only the validation R² says what the line is worth on new months: here, less than the mean."],
];
const LIMITES = COURS === "maths" ? LIMITES_MATHS : LIMITES_ML;

// ---------- the notebook figures: title, what to see in it, source notebook ----------
const FIGURES = {
  "01_nikkei_split": ["The Nikkei and the time split", "The index's monthly close and the three blocks: training, validation, test.", "01_cadrage_eda_variables"],
  "01_cibles_couverture": ["The targets, and the case for hedging", "The project's targets, and buying hedged versus buying unhedged against the yen.", "01_cadrage_eda_variables"],
  "01_correlations": ["Correlations between features", "The candidate features pair by pair, to spot those that say the same thing.", "01_cadrage_eda_variables"],
  "02_optuna_historique": ["The Optuna trials, one by one", "Cross-validation log-loss over the trials, for each model.", "02_pipeline_modeles_optuna"],
  "02_coefficients_logistiques": ["The logistic's weights", "The weight of each standardised feature in the selected model.", "02_pipeline_modeles_optuna"],
  "02_coude_kmeans": ["How many market regimes?", "The elbow method, which sets the number of k-means clusters.", "02_pipeline_modeles_optuna"],
  "03_fiabilite_brute": ["Reliability of the probabilities, before calibration", "Stated probability against observed frequency: on the diagonal, the model tells the truth.", "03_calibration_seuils"],
  "03_fiabilite_platt": ["Reliability after Platt calibration", "The same curve, once the probabilities are recalibrated.", "03_calibration_seuils"],
  "03_regle_validation": ["The rule on validation", "The decision rule applied to 2022-2023, in euros.", "03_calibration_seuils"],
  "03b_test_probabilites": ["The probabilities on the test", "Left, reliability; right, the probability of a fall stated each month, against the falls that happened.", "03b_test_final"],
  "03b_test_regle": ["The frozen rule, on the test", "What the rule would have returned in 2024-2026, against buying hedged and unhedged.", "03b_test_final"],
  "04_permutation": ["Permutation importance", "What shuffling each feature costs, in log-loss.", "04_explicabilite_diagnostics"],
  "04_shap_beeswarm_test": ["SHAP values on the test", "The effect of each feature on each test prediction.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2024-07": ["One prediction explained: July 2024", "The prediction broken down feature by feature.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2025-03": ["One prediction explained: March 2025", "The prediction broken down feature by feature.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2026-09": ["One prediction explained: September 2026", "The prediction broken down feature by feature.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2026-10": ["One prediction explained: October 2026", "The latest prediction, broken down feature by feature.", "04_explicabilite_diagnostics"],
  "04_pdp_ice_news": ["Partial dependence: article volume", "How the prediction varies with abnormal article volume, on average and month by month.", "04_explicabilite_diagnostics"],
  "04_inversion_signal_news": ["News and returns by period", "The link between article volume and returns, before and after 2021.", "04_explicabilite_diagnostics"],
  "05_sensibilite_lambda": ["The effect of the penalty λ", "Training, cross-validation and validation log-loss, and the norm of the weights, as a function of λ.", "05_annexe_maths_logistique"],
  "05_sensibilite_pas": ["The effect of the step size", "J(wₜ) − J* by step size: too small is slow; too large does not converge.", "05_annexe_maths_logistique"],
  "05_sensibilite_depart": ["Three starts, a single minimum", "Three very different starting points lead to the same minimum: convexity, observed.", "05_annexe_maths_logistique"],
  "05_sensibilite_iterations": ["The number of iterations", "Training and validation log-loss by number of iterations, with α = 1/L.", "05_annexe_maths_logistique"],
  "07_nikkei_1999_2026": ["The Nikkei from 1999 to 2026", "The monthly close over the whole second-version table, on a log scale.", "07_seconde_version_bloomberg"],
  "07_bloomberg_controles": ["Bloomberg as the reference", "Left, the table's Tankan and Bloomberg's, shifted by one month; right, the VIX export “in euros” compared with the VIX.", "07_seconde_version_bloomberg"],
  "07_optuna_v1_v2": ["The Optuna trials of both versions", "Cross-validation log-loss of each trial, 2010-2021 against 1999-2021.", "07_seconde_version_bloomberg"],
  "07_test_euros": ["The two rules on the test", "€1 invested following each version's rule, against buying hedged.", "07_seconde_version_bloomberg"],
  "07_permutation_v2": ["Permutation, second version", "What the selected LightGBM loses when each feature is shuffled, on validation and on the test.", "07_seconde_version_bloomberg"],
  "07_shap_v2_test": ["SHAP, second version", "The effect of each feature on each LightGBM prediction, on the test.", "07_seconde_version_bloomberg"],
  "07_shap_v2_derniere": ["The latest prediction, second version", "The prediction for November 2026 broken down feature by feature.", "07_seconde_version_bloomberg"],
  "07_coefficients_v1_v2": ["The logistic, retrained", "The logistic's coefficients on 2010-2021 and on 1999-2021: the L1 penalty keeps only five.", "07_seconde_version_bloomberg"],
  "07_stabilite_signaux": ["Signals that change sign", "Rank correlation of each feature with next month's return, period by period.", "07_seconde_version_bloomberg"],
  "08_ecarts_log_loss": ["Six variants against the constant", "Log-loss gap with the constant, each variant relearned every month, by sub-period; the bars cover 95%.", "08_ameliorations_sans_surapprentissage"],
  "08_log_loss_cumulee": ["The gap, accumulated month after month", "Above zero, the variant has lost to the constant since January 2010.", "08_ameliorations_sans_surapprentissage"],
  "08_fiabilite": ["Reliability on 2010-2023", "Stated probability of a fall, by quintile, against the observed frequency of falls.", "08_ameliorations_sans_surapprentissage"],
  "08_regle_au_cash": ["Why the rule stays in cash", "The rule's neutral zone (in grey) and the stated probabilities: the constant never leaves it.", "08_ameliorations_sans_surapprentissage"],
  "08_leviers_sharpe": ["The levers in euros", "Sharpe gap with buying hedged on 2010-2023, with a 90% bootstrap interval.", "08_ameliorations_sans_surapprentissage"],
  "08_richesse": ["€100 invested, lever by lever", "Left, 2010-2023 for judging; right, 2024-2026, already seen, for reference only.", "08_ameliorations_sans_surapprentissage"],
  "08_coefficients_dans_le_temps": ["Coefficients relearned every month", "The six standardised coefficients of the economic logistic, from 2010 to 2026.", "08_ameliorations_sans_surapprentissage"],
  "08_contributions_mois_prochain": ["The November 2026 forecast, broken down", "Coefficient × standardised deviation of each feature, for the economic logistic.", "08_ameliorations_sans_surapprentissage"],
};
const nomNotebook = (nom) => `Notebook ${nom.split("_")[0]}`;

return { D, RACINE, nombre, pct, Maj, dec, moisLong, moisSuivant, VARIABLES_EN, titreNb, ARCHIVES_TITRES, ECART_TEST, CHIFFRES, RISQUE, V2_INFO, V3_INFO, MATHS, COURS, SALLES, TOUTES_SALLES, avecCours, COURS_INFO, ENTREE, LIMITES, FIGURES, nomNotebook };
})();
const __commun = (() => {
"use strict";
// English version of site/assets/commun.js: header, course choice, menu and notebook reader, shared by the tour,
// the reading and the cabinet. Files outside site/en/ (PDFs, notebooks, downloads) are reached through RACINE ("../").
const { SALLES, ENTREE, COURS, COURS_INFO, avecCours, D, nomNotebook, RACINE, titreNb, ARCHIVES_TITRES } = __contenu;
const FLECHE = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5h32M27 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const FLECHE_G = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M34 5H2M7 1 2 5l5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';

function stocker(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* stockage indisponible */ } }
function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }

const DOCS = { rapport: ["The Applied ML report (in French)", `${RACINE}docs/rapport.pdf`], annexe: ["The maths report (in French)", `${RACINE}docs/rapport_maths.pdf`] };
const titreNotebook = (nom) => titreNb(nom);
const BAS = '<svg class="bas" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0v10M1 6l4 4 4-4M0 11.5h10" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
// What can be downloaded: each notebook as .ipynb (or its folder as .zip), and two archives (site/data/donnees.js)
const TL = D.telechargements ?? { notebooks: {}, archives: [] };
const telechargement = (nom) => { const t = TL.notebooks[nom] ?? { href: `nb/${nom}.ipynb`, fichier: `${nom}.ipynb`, dossier: false }; return { ...t, href: RACINE + t.href }; };
const etiquetteNb = (nom) => (telechargement(nom).dossier ? "folder .zip" : ".ipynb");
const lienIpynb = (nom, classe = "telecharger") => {
  const t = telechargement(nom);
  const aide = t.dossier ? `Download ${nomNotebook(nom)} with its whole folder (${t.fichiers} files: notebook, scripts, figures)` : `Download ${nomNotebook(nom)} (.ipynb, to open in Jupyter)`;
  return `<a class="${classe}" href="${t.href}" download="${t.fichier}" title="${aide}">${etiquetteNb(nom)} ${BAS}</a>`;
};
const mo = (o) => `${(o / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`;
const archives = () => TL.archives;
const lienArchive = (cle, classe = "telecharger") => {
  const a = TL.archives.find((x) => x.cle === cle);
  return a ? `<a class="${classe}" href="${RACINE}${a.href}" download="${a.fichier}" title="${a.fichiers} files, ${mo(a.octets)}">${ARCHIVES_TITRES[a.cle] ?? a.titre} (.zip, ${mo(a.octets)}) ${BAS}</a>` : "";
};

// The course choice (Applied ML or Maths) and the mode (tour or reading) carry over from page to page.
function installerEntete(page) {
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
function installerMenu({ page, allerSalle = null, salleActive = () => null }) {
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
          <a href="${RACINE}docs/rapport_maths.pdf"><span class="t">The maths report, PDF (French)</span>${FLECHE}</a>
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
function arrivee(salle) {
  if (!salle.presenter?.length) return "";
  const seances = (salle.seances ?? []).map(([code, nom]) => `<li><b>${code}</b>${nom}</li>`).join("");
  return `<div class="arrivee">
    ${seances ? `<p class="sur-titre">Seen in class · ${COURS_INFO[COURS].nom}</p><ul class="seances">${seances}</ul>` : ""}
    <p class="sur-titre">To present on arrival</p>
    <ol class="a-presenter">${salle.presenter.map((p) => `<li>${p}</li>`).join("")}</ol>
  </div>`;
}

// A room's notebooks and documents, as buttons; data-nb opens the reader without leaving the page
function liensPieces(salle) {
  const nbs = salle.notebooks.map((n) => `<li class="piece-nb"><button type="button" class="piece-lien" data-nb="${n}"><span class="sur-titre">${nomNotebook(n)}</span><span class="t">${titreNotebook(n)}</span>${FLECHE}</button>${lienIpynb(n, "piece-telecharger")}</li>`);
  const docs = salle.docs.map((d) => `<li><a class="piece-lien" href="${DOCS[d][1]}" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><span class="t">${DOCS[d][0]}</span>${FLECHE}</a></li>`);
  if (!nbs.length && !docs.length) return "";
  return `<ul class="pieces-salle">${nbs.join("")}${docs.join("")}</ul>`;
}

// Opens a notebook in a frame and hides the “Opening…” veil as soon as the page is readable, without waiting for its
// external scripts (MathJax): offline, the load event can take a long time.
function ouvrirDansCadre(cadre, url, cacher) {
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
function installerLiseuse() {
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

return { FLECHE, FLECHE_G, stocker, lire, titreNotebook, BAS, telechargement, etiquetteNb, lienIpynb, archives, lienArchive, installerEntete, installerMenu, arrivee, liensPieces, ouvrirDansCadre, installerLiseuse };
})();
const __cabinet = (() => {
"use strict";
// English version of site/assets/cabinet.js: the notebook list and the reader, on a page of their own.
const { installerMenu, installerEntete, FLECHE, BAS, lienIpynb, lienArchive, telechargement, ouvrirDansCadre } = __commun;
const { COURS, RACINE, titreNb } = __contenu;
// the Maths path puts the appendix first
const nbs = COURS === "maths"
  ? [...window.NIKKEI.notebooks].sort((a, b) => (b.nom.startsWith("05") ? 1 : 0) - (a.nom.startsWith("05") ? 1 : 0))
  : window.NIKKEI.notebooks;
const liste = document.getElementById("liste"), choix = document.getElementById("choix"), cadre = document.getElementById("cadre"), charge = document.getElementById("charge");
liste.innerHTML = nbs.map((n) => `<li><a href="?nb=${n.nom}&cours=${COURS}" data-nb="${n.nom}"><span class="n">${n.nom.split("_")[0]}</span><span class="t">${titreNb(n.nom)}</span></a>${lienIpynb(n.nom, "telecharger mini")}</li>`).join("");
choix.innerHTML = nbs.map((n) => `<option value="${n.nom}">${n.nom.split("_")[0]} · ${titreNb(n.nom)}</option>`).join("");
document.getElementById("archive").innerHTML = lienArchive("notebooks") + lienArchive("projet");
const courant = document.getElementById("courant");
document.getElementById("docs").innerHTML = `<a href="${RACINE}docs/rapport.pdf"><span class="t">The report, PDF (French)</span>${FLECHE}</a><a href="${RACINE}docs/rapport_maths.pdf"><span class="t">The maths report, PDF (French)</span>${FLECHE}</a>`;

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

return {  };
})();
