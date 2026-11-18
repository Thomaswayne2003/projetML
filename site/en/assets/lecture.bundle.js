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
      `<b>Optuna without an optimistic score (S3, briefs 6 and 7).</b> ${nombre(CHIFFRES.essais)} trials on folds that respect time (TimeSeriesSplit), all logged; the penalty and class weighting are chosen in cross-validation. The selected logistic: ${dec(CHIFFRES.llCV)} log-loss.`,
    ],
    titre: `Three models, ${nombre(CHIFFRES.essais)} trials`,
    oeuvre: "The field of trials",
    legende: "One stem per Optuna trial, in three rows: logistic, random forest, LightGBM. The taller the stem, the lower the cross-validation log-loss. The tinted stem is the selected trial.",
    clair: "A logistic regression, a random forest and a LightGBM, tuned by Optuna on folds that respect time order. Everything that learns a parameter, imputation and regimes included, stays inside the pipeline.",
    technique: `scikit-learn pipeline: imputation, standardisation, k-means regime, model. ${CHIFFRES.essais} Optuna trials on the main target (50 per model), with a TimeSeriesSplit; the selected logistic reaches ${dec(CHIFFRES.llCV)} log-loss in cross-validation. Platt calibration on the out-of-fold predictions. The best of fifty trials is always flattering: LightGBM looks excellent in cross-validation and does worse than the logistic on the test.`,
    chiffres: [["3", "models compared"], [nombre(CHIFFRES.essais), "Optuna trials"], [dec(CHIFFRES.llCV), "logistic log-loss in cross-validation"]],
    ton: { mur: "#a26a52", sol: "#8c6b5c", ciel: "#fae9de", texte: "#fff5ee", accent: "#f0c7b0" },
  },
  {
    id: "regle", num: "IV", nom: "The rule", kanji: "律",
    notebooks: ["03_calibration_seuils"], docs: [],
    seances: [["S7", "Decision threshold"], ["S8", "Probability calibration"], ["Brief 9", "Calibration diagnostics"]],
    presenter: [
      `<b>Calibrate before deciding (S8).</b> Platt calibration is learned on the out-of-fold predictions (a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}): a stated probability must match an observed frequency.`,
      `<b>A threshold that is not 50% (S7).</b> It comes from the gains in euros: buy above ${pct(CHIFFRES.thetaA, 0)} probability of a rise, sell below ${pct(CHIFFRES.thetaV, 0)}, stay neutral in between, with a margin of ${pct(CHIFFRES.marge, 1)} per month.`,
      "<b>Frozen before the test.</b> Model, calibration and thresholds were committed before opening 2024-2026 (commit 75712cf): nothing is tuned on the test.",
    ],
    titre: "From a probability to an action",
    oeuvre: "The dial",
    legende: "The dial runs from 0 to 100% probability of a rise. On the left the “sell” zone, in the middle “neutral”, on the right “buy”. The gnomon points to the forecast for " + moisLong(moisSuivant(CHIFFRES.moisDernier)) + ".",
    clair: `The model gives a probability of a rise. The rule compares the expected gain of a buy and of a sell with a margin of ${pct(CHIFFRES.marge, 1)}: above ${pct(CHIFFRES.thetaA, 0)}, buy; below ${pct(CHIFFRES.thetaV, 0)}, sell; in between, stay neutral. The thresholds were frozen and committed before opening the test.`,
    technique: `The average gains come from training: a buy earns ${pct(D.decision.couts.B_u, 1, true)} in a rising month and ${pct(D.decision.couts.B_d, 1, true)} in a falling month; a sell does the opposite. Buy if p·B_u + (1 − p)·B_d exceeds the margin, sell if p·S_u + (1 − p)·S_d exceeds it. Hence the thresholds θ_buy = ${dec(CHIFFRES.thetaA)} and θ_sell = ${dec(CHIFFRES.thetaV)}. Platt calibration: a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}. Hedging: always hedged. Decision frozen at commit 75712cf. With no signal, the same rule applied to the constant forecast buys every month.`,
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
      V2_INFO ? `<b>Retraining on 1999-2026.</b> Same pipeline and same selection rule: ${V2_INFO.modele}, ${dec(V2_INFO.ll)} log-loss on the test vs ${dec(V2_INFO.llConst)} for the constant. Better than the first version, still no better than the constant.` : "<b>Retraining on a longer history.</b>",
      V3_INFO ? `<b>Improving without overfitting.</b> Protocol frozen before any computation, month-by-month retraining over ${V3_INFO.mois} months (2010-2023), Holm correction: ${V3_INFO.retenus} lever kept out of ${V3_INFO.tests}.` : "<b>Improving without overfitting.</b>",
      "<b>What we take from it.</b> Since the test had been seen, all of this remains exploratory. With these data, the Nikkei's next month cannot be forecast; the best decision is still to buy, hedged.",
    ],
    titre: "What we tried next",
    oeuvre: "The breath",
    legende: "A spiral from 2016 (bottom) to 2026 (top), whose thickness follows each month's realised volatility. The tinted parts are turbulent months, above 20% annual volatility.",
    clair: "Once the test was opened, three leads were followed. First, retrain the same model on a longer history, from 1999 to 2026, with Bloomberg as the reference. Next, apply every feasible improvement lever, under a protocol frozen before any computation and judged on 2010-2023: none passes. Finally, forecast how turbulent the market will be rather than its direction.",
    technique: V2_INFO
      ? `With ${V2_INFO.mois} training months instead of ${CHIFFRES.moisEntrainement}, the rule from notebook 03 selects ${V2_INFO.modele} on validation. On the test, its log-loss is ${dec(V2_INFO.ll)} vs ${dec(V2_INFO.llConst)} for the constant (gap ${dec(V2_INFO.ecart.moyenne, 3)} ± ${dec(V2_INFO.ecart.erreur_type, 3)}), and its rule returns ${pct(V2_INFO.regle, 1, true)} vs ${pct(V2_INFO.couvert, 1, true)} for buying hedged. Better than the first version, still no better than the constant. The logistic would have beaten the constant on the test (${dec(V2_INFO.llLogit)}), but the announced rule had ruled it out on validation (${dec(V2_INFO.llLogitVal)}): choosing it now would mean choosing on the test.${V3_INFO ? ` The improvement levers, retrained each month over ${V3_INFO.mois} months of 2010-2023: ${V3_INFO.retenus} of ${V3_INFO.tests} pass the Diebold-Mariano test or the Sharpe bootstrap after Holm correction (smallest corrected p: ${dec(V3_INFO.pMin, 2)}). The best, “${levier(V3_INFO.meilleure)}”, gains ${dec(-V3_INFO.ecart, 4)} of log-loss, i.e. ${dec(-V3_INFO.ecart / V3_INFO.se, 1)} standard errors.` : ""} Next month's volatility: out-of-sample R² of ${dec(RISQUE.r2Avant, 2)} on 2016-2023; a turbulent month is recognised with an AUC of ${dec(RISQUE.aucAgite, 2)}.`
      : `Next month's volatility: out-of-sample R² of ${dec(RISQUE.r2Avant, 2)} on 2016-2023; a turbulent month is recognised with an AUC of ${dec(RISQUE.aucAgite, 2)}.`,
    chiffres: V2_INFO
      ? [[`${dec(V2_INFO.ll)} / ${dec(V2_INFO.llConst)}`, "log-loss 1999-2026: model / constant"], [pct(V2_INFO.regle, 1, true), "second version's rule, in euros"],
         V3_INFO ? [`${V3_INFO.retenus} of ${V3_INFO.tests}`, "levers kept by the frozen protocol"] : [dec(RISQUE.r2Avant, 2), "volatility R², 2016-2023"]]
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

const DOCS = { rapport: ["The Applied ML report (in French)", `${RACINE}docs/rapport.pdf`], annexe: ["The maths appendix (in French)", `${RACINE}docs/annexe_maths.pdf`] };
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
const __lecture = (() => {
"use strict";
// English version of site/assets/lecture.js: seven chapters, the same as the rooms of the tour, with charts, tables and
// figures. Two paths: Applied ML (the project) and Maths (the appendix), depending on the course chosen at the top.
// The shared data file holds French labels (models, strategies, sources, levers…): tr() translates them for display.
const { D, SALLES, ENTREE, LIMITES, CHIFFRES, ECART_TEST, MATHS, COURS, COURS_INFO, FIGURES, V2_INFO, V3_INFO, avecCours, nomNotebook, nombre, pct, dec, moisLong, moisSuivant, RACINE, VARIABLES_EN, titreNb } = __contenu;
const { installerMenu, installerEntete, installerLiseuse, liensPieces, titreNotebook, arrivee, FLECHE, FLECHE_G } = __commun;
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

return {  };
})();
