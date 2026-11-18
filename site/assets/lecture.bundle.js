// Fichier écrit par python -m app.export_site à partir de assets/*.js : ne pas modifier à la main.
const __contenu = (() => {
"use strict";
// Contenu commun aux deux modes : les sept salles de la visite sont les sept chapitres de la lecture.
// Les chiffres sont lus dans window.NIKKEI (écrit par python -m app.export_site), jamais recopiés à la main.

const D = window.NIKKEI;

// ---------- formats français ----------
const nf = (d) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const nombre = (x, d = 0) => nf(d).format(x);
const pct = (x, d = 1, signe = false) =>
  (signe && x > 0 ? "+" : x < 0 ? "−" : "") + nf(d).format(Math.abs(x * 100)) + " %";
const Maj = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const dec = (x, d = 3) => (x < 0 ? "−" : "") + nf(d).format(Math.abs(x));
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const moisLong = (am) => { const [a, m] = am.split("-").map(Number); return `${MOIS[m - 1]} ${a}`; };
const moisSuivant = (am) => { let [a, m] = am.split("-").map(Number); m += 1; if (m > 12) { m = 1; a += 1; } return `${a}-${String(m).padStart(2, "0")}`; };

// ---------- chiffres dérivés des données ----------
const ev = D.evaluation;
const met = ev.metriques;
const CONST = "constante (fréquence de l'entraînement)";
const perf = ev.performance_euros;

// Écart de log-loss mois par mois entre le modèle et la constante, sur le test : moyenne et erreur type
function ecartLogLoss(historique) {
  const pc = 1 - met[CONST]["proba moyenne"];                       // proba de hausse de la constante
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

// ---------- les sept salles ----------
// ton : couleurs de la salle (murs, sol, lumière), pour la visite ; les mêmes servent d'accent dans la lecture
// ---------- parcours Applied ML : les étapes du projet, dans l'ordre des notebooks ----------
const DS = D.dataset ?? {};
const V2 = D.v2 ?? {};
const CB = V2.controle_bloomberg ?? {};
const E2 = V2.evaluation_test;
const CONST2 = "constante (fréquence de l'entraînement)";
const serieV2 = V2.serie ?? D.serie;
const blocsV2 = ["entraînement", "validation", "test"].map((b) => serieV2.filter((m) => m.bloc === b).length);
const baissesEntrainement = (() => {   // part des mois en baisse sur l'entraînement, d'après les clôtures
  const s = serieV2; let n = 0, b = 0;
  for (let i = 1; i < s.length; i++) if (s[i - 1].bloc === "entraînement") { n++; if (s[i].cloture <= s[i - 1].cloture) b++; }
  return n ? b / n : null;
})();
const LIBELLES_VAR = Object.fromEntries((D.modele?.variables ?? []).map((v, i) => [v, D.modele.libelles[i]]));
const libelleVar = (v) => LIBELLES_VAR[v] ?? v.replace("distance au régime", "distance au régime").replace(/_/g, " ");
const contribs = [...(D.explication ?? [])].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
const V2_INFO = E2 ? {
  modele: E2.modele, mois: E2.mois_entrainement,
  ll: E2.metriques[E2.modele]["log-loss"], llConst: E2.metriques[CONST2]["log-loss"],
  llLogit: E2.metriques["logistique"]["log-loss"], llLogitVal: V2.decision_finale.validation.log_loss_calibree.logit,
  ecart: E2.ecart_log_loss, regle: E2.performance_euros["règle du modèle"].cumul,
  couvert: E2.performance_euros["toujours acheter, couvert"].cumul, actions: E2.actions,
} : null;

// Troisième étape : les leviers d'amélioration, jugés sur 2010-2023 selon un protocole figé avant le calcul
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
    id: "dataset", num: "I", nom: "Le dataset", kanji: "集",
    notebooks: ["00a_collecte_V1", "00b_collecte_V2"], docs: [],
    seances: [["S1", "Données, test de l'instant de prédiction, fuites"], ["Consigne 1", "EDA et cadrage du problème"]],
    presenter: [
      `<b>La question (S1).</b> À la fin de chaque mois, prédire si le Nikkei baisse le mois suivant. Une ligne par fin de mois : ${nombre(DS.mois ?? serieV2.length)} mois, de ${(DS.premier_mois ?? "").slice(0, 4)} à ${(DS.dernier_mois ?? "").slice(0, 4)}.`,
      "<b>Le test de l'instant de prédiction (S1).</b> Chaque colonne est décalée jusqu'à sa publication : elle n'entre dans la table qu'à la date où on la connaissait vraiment.",
      `<b>Les fuites (S1).</b> Pris à sa date Bloomberg, le Tankan aurait fui : ${CB.tankan?.erreur_si_date_bloomberg_prise_telle_quelle ?? "il aurait été utilisé avant sa publication"}. Un audit automatique arrête la construction si une variable regarde le futur.`,
    ],
    titre: "Construire la table, mois par mois",
    oeuvre: "La pile des mois",
    legende: `Un disque par mois, de ${moisLong(serieV2[0].mois)} (en bas) à ${moisLong(serieV2[serieV2.length - 1].mois)} (en haut). Chaque disque est décalé selon le rendement du mois : la pile se tord dans les mois agités. Les disques foncés sont les mois de baisse.`,
    clair: "Tout commence par la table. Chaque ligne est une fin de mois, chaque colonne une information que l'on connaissait vraiment ce jour-là : prix, taux, change, conjoncture, incertitude et news, rassemblés depuis 1999, ramenés au calendrier de Tokyo et décalés jusqu'à leur publication. À ce stade, la table ne sert qu'à explorer.",
    technique: `${nombre(DS.colonnes ?? 0)} colonnes mensuelles et ${nombre(DS.variables_journalieres ?? 0)} journalières, ${nombre(DS.mois ?? serieV2.length)} mois de ${DS.premier_mois ?? ""} à ${DS.dernier_mois ?? ""}. Sources : Yahoo Finance pour les marchés, ministère des Finances pour la courbe des taux japonais, Banque du Japon pour le Tankan, les agrégats et le change, BCE et Bundesbank, OCDE pour les indicateurs avancés et l'inflation, indices d'incertitude et de risque géopolitique, news GDELT notées par FinBERT. Chaque colonne porte son décalage de publication dans le dictionnaire des variables. Bloomberg sert de référence : une fois décalé à sa date de publication, le Tankan de la table coïncide avec Bloomberg sur ${CB.tankan?.valeurs_identiques ?? "—"} trimestres sur ${CB.tankan?.trimestres_compares ?? "—"} ; pris à sa date Bloomberg, il aurait été utilisé avant d'être publié. L'export Bloomberg du VIX, converti en euros, n'est pas utilisé, et le calendrier des publications, tronqué à 5 000 lignes, ne couvre que 1999-2006.`,
    chiffres: [
      [nombre(DS.mois ?? serieV2.length), `mois, de ${(DS.premier_mois ?? "").slice(0, 4)} à ${(DS.dernier_mois ?? "").slice(0, 4)}`],
      [nombre(DS.colonnes ?? 0), "colonnes mensuelles"],
      [`${CB.tankan?.valeurs_identiques ?? "—"}/${CB.tankan?.trimestres_compares ?? "—"}`, "trimestres de Tankan identiques à Bloomberg"],
    ],
    ton: { mur: "#2f3a3a", sol: "#b9b1a5", ciel: "#dfe6e4", texte: "#f3efe8", accent: "#9fb5ae" },
  },
  {
    id: "exploration", num: "II", nom: "L'exploration", kanji: "探",
    notebooks: ["01_cadrage_eda_variables"], docs: [],
    seances: [["S1", "EDA et découpage entraînement, validation, test"], ["S7", "Équilibre des classes"], ["Consignes 1 à 3", "Cadrage, variables, déséquilibre"]],
    presenter: [
      `<b>La cible et son équilibre (S1, S7).</b> 1 si le Nikkei baisse le mois suivant : ${baissesEntrainement == null ? "—" : pct(baissesEntrainement, 0)} des mois d'entraînement. Les classes sont presque équilibrées ; on juge quand même sur la log-loss et la PR-AUC, pas sur l'exactitude.`,
      "<b>Un découpage dans l'ordre du temps (S1).</b> Entraînement jusqu'en 2021, validation 2022-2023, test 2024-2026 ouvert une seule fois. Un découpage au hasard ferait voir le futur au modèle.",
      "<b>Des variables justifiées (consigne 2).</b> Momentum à 3 et 12 mois, volatilité lissée, variation du taux à 10 ans, Tankan, portage et volatilité de l'euro-yen, volume et tonalité des news, plus un régime de marché par k-means. Deux références sans compétence : la constante et « toujours acheter ».",
    ],
    titre: "Regarder avant de modéliser",
    oeuvre: `Le vase des ${serieV2.length} mois`,
    legende: `Son profil suit la clôture mensuelle du Nikkei, de ${moisLong(serieV2[0].mois)} (au pied) à ${moisLong(serieV2[serieV2.length - 1].mois)} (au col). Deux sillons marquent le début de la validation et celui du test.`,
    clair: "Avant tout modèle, on regarde : la trajectoire du Nikkei, la part des mois en baisse, ce qui bouge ensemble, et comment couper le temps. L'exploration fixe la cible, les variables candidates, les références sans compétence et le découpage.",
    technique: `La cible vaut 1 si le Nikkei, en yens, baisse le mois suivant : c'est la classe positive des métriques. Découpage dans l'ordre du temps : entraînement jusqu'en 2021, validation 2022-2023, test 2024-2026, ouvert une seule fois. Deux références sans compétence : la prévision constante (la fréquence des baisses de l'entraînement) et « toujours acheter ». Dix variables sont retenues, plus un régime de marché appris par k-means. Réserve : elles ont été choisies sur une exploration de 2017-2026, qui recouvre la validation et le test.`,
    chiffres: [
      [`${blocsV2[0]} · ${blocsV2[1]} · ${blocsV2[2]}`, "mois d'entraînement · validation · test"],
      [baissesEntrainement == null ? "—" : pct(baissesEntrainement, 0), "de mois en baisse sur l'entraînement"],
      ["10 + 1", "variables, plus un régime k-means"],
    ],
    ton: { mur: "#cbb796", sol: "#a8957a", ciel: "#fbf4e8", texte: "#fffaf2", accent: "#7d6a4f" },
  },
  {
    id: "apprentissage", num: "III", nom: "L'apprentissage", kanji: "学",
    notebooks: ["02_pipeline_modeles_optuna"], docs: [],
    seances: [["S2", "Régression logistique et log-loss"], ["S3", "Régularisation"], ["S4", "Arbres de décision"], ["S5", "Forêts aléatoires et boosting"], ["Consignes 4 à 7", "Progression, pipeline, Optuna, journal"]],
    presenter: [
      "<b>Une progression de trois modèles (S2 à S5, consigne 4).</b> Une logistique pénalisée (S2, S3), une forêt aléatoire (S4, S5) et un LightGBM (S5), comparés sur la même log-loss.",
      "<b>Une seule pipeline (consigne 5).</b> Imputation, standardisation, régime k-means et modèle s'ajustent ensemble, pli par pli : aucune statistique du futur ne fuit dans le passé.",
      `<b>Optuna sans score optimiste (S3, consignes 6 et 7).</b> ${nombre(CHIFFRES.essais)} essais sur des plis qui respectent le temps (TimeSeriesSplit), tous journalisés ; pénalité et pondération des classes sont choisies en validation croisée. La logistique retenue : ${dec(CHIFFRES.llCV)} de log-loss.`,
    ],
    titre: `Trois modèles, ${nombre(CHIFFRES.essais)} essais`,
    oeuvre: "Le champ des essais",
    legende: "Une tige par essai Optuna, en trois rangées : logistique, forêt aléatoire, LightGBM. Plus la tige est haute, plus la log-loss de validation croisée est basse. La tige teintée est l'essai retenu.",
    clair: "Une régression logistique, une forêt aléatoire et un LightGBM, réglés par Optuna sur des plis qui respectent l'ordre du temps. Tout ce qui apprend un paramètre, imputation et régimes compris, reste dans la pipeline.",
    technique: `Pipeline scikit-learn : imputation, standardisation, régime k-means, modèle. ${CHIFFRES.essais} essais Optuna sur la cible principale (50 par modèle), avec un découpage TimeSeriesSplit ; la logistique retenue obtient ${dec(CHIFFRES.llCV)} de log-loss en validation croisée. Calibration de Platt sur les prédictions hors pli. Le meilleur de cinquante essais est toujours flatteur : le LightGBM paraît excellent en validation croisée et fait pire que la logistique sur le test.`,
    chiffres: [["3", "modèles comparés"], [nombre(CHIFFRES.essais), "essais Optuna"], [dec(CHIFFRES.llCV), "log-loss de la logistique en validation croisée"]],
    ton: { mur: "#a26a52", sol: "#8c6b5c", ciel: "#fae9de", texte: "#fff5ee", accent: "#f0c7b0" },
  },
  {
    id: "regle", num: "IV", nom: "La règle", kanji: "律",
    notebooks: ["03_calibration_seuils"], docs: [],
    seances: [["S7", "Seuil de décision"], ["S8", "Calibration des probabilités"], ["Consigne 9", "Diagnostic de calibration"]],
    presenter: [
      `<b>Calibrer avant de décider (S8).</b> La calibration de Platt est apprise sur les prédictions hors pli (a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}) : une probabilité annoncée doit correspondre à une fréquence observée.`,
      `<b>Un seuil qui n'est pas 50 % (S7).</b> Il vient des gains en euros : acheter au-dessus de ${pct(CHIFFRES.thetaA, 0)} de hausse, vendre sous ${pct(CHIFFRES.thetaV, 0)}, rester neutre entre les deux, avec une marge de ${pct(CHIFFRES.marge, 1)} par mois.`,
      "<b>Figée avant le test.</b> Modèle, calibration et seuils ont été commités avant d'ouvrir 2024-2026 (commit 75712cf) : rien ne se règle sur le test.",
    ],
    titre: "D'une probabilité à une action",
    oeuvre: "Le cadran",
    legende: "Le cadran va de 0 à 100 % de probabilité de hausse. À gauche la zone « vendre », au centre « neutre », à droite « acheter ». Le style pointe la prévision pour " + moisLong(moisSuivant(CHIFFRES.moisDernier)) + ".",
    clair: `Le modèle donne une probabilité de hausse. La règle compare le gain espéré d'un achat et d'une vente à une marge de ${pct(CHIFFRES.marge, 1)} : au-dessus de ${pct(CHIFFRES.thetaA, 0)}, acheter ; sous ${pct(CHIFFRES.thetaV, 0)}, vendre ; entre les deux, rester neutre. Les seuils ont été figés et commités avant d'ouvrir le test.`,
    technique: `Les gains moyens viennent de l'entraînement : un achat rapporte ${pct(D.decision.couts.B_u, 1, true)} un mois de hausse et ${pct(D.decision.couts.B_d, 1, true)} un mois de baisse ; une vente fait l'inverse. Acheter si p·B_u + (1 − p)·B_d dépasse la marge, vendre si p·S_u + (1 − p)·S_d la dépasse. D'où les seuils θ_achat = ${dec(CHIFFRES.thetaA)} et θ_vente = ${dec(CHIFFRES.thetaV)}. Calibration de Platt : a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}. Couverture : toujours couvert. Décision figée au commit 75712cf. Sans signal, la même règle appliquée à la prévision constante achète tous les mois.`,
    chiffres: [[pct(CHIFFRES.thetaA, 1), "seuil d'achat"], [pct(CHIFFRES.thetaV, 1), "seuil de vente"], [pct(CHIFFRES.marge, 1), "marge exigée"]],
    ton: { mur: "#8d9883", sol: "#7a7f70", ciel: "#f1f3e9", texte: "#fbfcf6", accent: "#e3e8d5" },
  },
  {
    id: "epreuve", num: "V", nom: "L'épreuve", kanji: "試",
    notebooks: ["03b_test_final"], docs: ["rapport"],
    seances: [["S1", "Le test, ouvert une seule fois"], ["S7", "PR-AUC face à la référence"], ["S8", "Brier, ECE, fiabilité"], ["Consigne 9", "Peut-on se fier aux probabilités ?"]],
    presenter: [
      `<b>Une seule ouverture (S1).</b> ${CHIFFRES.moisTest} mois, de 2024 à 2026, évalués avec la décision figée, sans aucun réglage.`,
      `<b>Les métriques du cours face à la constante (S7, S8).</b> Log-loss ${dec(met.logistique["log-loss"])} contre ${dec(met[CONST]["log-loss"])}, PR-AUC ${dec(met.logistique["PR-AUC"], 2)} contre ${dec(met[CONST]["PR-AUC"], 2)}, Brier ${dec(met.logistique.Brier)} contre ${dec(met[CONST].Brier)}. Le modèle annonce ${pct(met.logistique["proba moyenne"], 0)} de baisse en moyenne pour ${pct(met.logistique["fréquence observée"], 0)} observés : il surestime les baisses (ECE ${dec(met.logistique.ECE, 2)}), ses probabilités ne sont pas utilisables telles quelles.`,
      `<b>Le verdict.</b> L'écart de log-loss (${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}) ne tranche pas ; la règle fait ${pct(CHIFFRES.regle, 1, true)} contre ${pct(CHIFFRES.couvert, 1, true)} pour l'achat couvert. Comme annoncé avant le test : acheter, couvert.`,
    ],
    titre: `${CHIFFRES.moisTest} mois, une seule fois`,
    oeuvre: "Le cercle des mois de test",
    legende: "Une pierre par mois de test, de janvier 2024 à septembre 2026. Sa hauteur suit l'ampleur du mois ; claire s'il a monté, sombre s'il a baissé. La pastille au pied montre l'action du modèle : verte pour acheter, rouge brique pour vendre.",
    clair: `Sur 2024-2026, le modèle ne fait pas mieux que la prévision constante : ${dec(CHIFFRES.llModele)} de log-loss contre ${dec(CHIFFRES.llConstante)}. Sur ${CHIFFRES.moisTest} mois, l'écart ne permet de conclure ni dans un sens ni dans l'autre. Comme prévu avant le test, la recommandation retombe sur « toujours acheter, couvert ».`,
    technique: `Écart moyen de log-loss, mois par mois : ${dec(ECART_TEST.moyenne, 3)} pour une erreur type de ${dec(ECART_TEST.erreurType, 3)}. Les cibles mensuelles ne se chevauchent pas, l'erreur type simple suffit. La règle du modèle finit à ${pct(CHIFFRES.regle, 1, true)} ; acheter et garder couvert, à ${pct(CHIFFRES.couvert, 1, true)}. Ce second chiffre décrit le marché de 2024-2026 plus qu'un savoir-faire : sans signal, la règle n'a rien à ajouter au marché. Les indices sont des indices de prix, sans dividendes, et aucun frais n'est compté.`,
    chiffres: [[`${dec(CHIFFRES.llModele)} / ${dec(CHIFFRES.llConstante)}`, "log-loss : modèle / constante"], [pct(CHIFFRES.regle, 1, true), "règle du modèle, en euros"], [pct(CHIFFRES.couvert, 1, true), "acheter et garder, couvert"]],
    ton: { mur: "#262a35", sol: "#545660", ciel: "#d4d9e6", texte: "#eef0f6", accent: "#a9b3cb" },
  },
  {
    id: "explication", num: "VI", nom: "L'explication", kanji: "解",
    notebooks: ["04_explicabilite_diagnostics", "07_seconde_version_bloomberg"], docs: [],
    seances: [["S9", "Diagnostics par tranches, permutation, SHAP"], ["Consigne 8", "Importance globale et explications locales"]],
    presenter: [
      "<b>Les tranches (S9).</b> Un bon score global peut cacher un échec : on découpe le test par régime de volatilité et par mois de réunion de la Banque du Japon.",
      "<b>La permutation (S9).</b> On mélange une variable et on mesure la log-loss perdue. Piège vu en cours : deux variables corrélées se remplacent, et chacune paraît inutile.",
      `<b>SHAP (S9, consigne 8).</b> La prédiction de ${moisLong(moisSuivant(CHIFFRES.moisDernier))} se décompose variable par variable ; « ${libelleVar(contribs[0]?.variable ?? "")} » pèse le plus. A-t-elle un sens économique ? Son lien avec le rendement change de signe après 2021 : non, pas de façon stable.`,
    ],
    titre: "Ce qui pèse dans une prédiction",
    oeuvre: "La balance",
    legende: `Les douze variables de la dernière prédiction (${moisLong(moisSuivant(CHIFFRES.moisDernier))}) suspendues à un fléau : à droite celles qui poussent vers la baisse, à gauche celles qui poussent vers la hausse. La taille de chaque poids suit sa contribution.`,
    clair: "Un modèle qu'on ne sait pas expliquer ne se défend pas. On mesure ce que chaque variable apporte : en la mélangeant pour voir ce que le modèle perd, en décomposant chaque prédiction, et en regardant où le modèle réussit et où il échoue.",
    technique: `Importance par permutation sur le test, valeurs SHAP, dépendance partielle et tranches (régimes de volatilité, mois de réunion de la BoJ). Pour la dernière prédiction, la variable qui pèse le plus est « ${libelleVar(contribs[0]?.variable ?? "")} » (${dec(contribs[0]?.contribution ?? 0, 2)} sur le log-odds de la baisse). C'est aussi la plus fragile : son lien avec le rendement change de signe après 2021, et GDELT plafonne chaque requête trimestrielle à 250 articles, si bien que le compte d'un mois dépend du reste du trimestre.`,
    chiffres: [[nombre(contribs.length), "variables dans la balance"], [Maj(libelleVar(contribs[0]?.variable ?? "—")), `pèse le plus en ${moisLong(moisSuivant(CHIFFRES.moisDernier))}`], [pct(CHIFFRES.pDernier, 1), "probabilité de hausse annoncée"]],
    ton: { mur: "#9b8466", sol: "#857563", ciel: "#f7efe2", texte: "#fffaf2", accent: "#e9d8bd" },
  },
  {
    id: "apres", num: "VII", nom: "Après le test", kanji: "後",
    notebooks: ["06_annexe_news_prix", "07_seconde_version_bloomberg", "08_ameliorations_sans_surapprentissage"], docs: ["rapport"],
    seances: [["S1", "Généralisation, fuites"], ["S3", "Choisir sans regarder le test"], ["Après coup", "Exploration, sans valeur de preuve"]],
    presenter: [
      V2_INFO ? `<b>Réentraîner sur 1999-2026.</b> Même pipeline et même règle de choix : ${V2_INFO.modele}, ${dec(V2_INFO.ll)} de log-loss sur le test contre ${dec(V2_INFO.llConst)} pour la constante. Mieux que la première version, toujours pas mieux que la constante.` : "<b>Réentraîner sur une histoire plus longue.</b>",
      V3_INFO ? `<b>Améliorer sans surapprendre.</b> Protocole figé avant tout calcul, réentraînement mois par mois sur ${V3_INFO.mois} mois (2010-2023), correction de Holm : ${V3_INFO.retenus} levier retenu sur ${V3_INFO.tests}.` : "<b>Améliorer sans surapprendre.</b>",
      "<b>Ce qu'on en retient.</b> Le test ayant été vu, tout cela reste exploratoire. Avec ces données, le mois suivant du Nikkei ne se prévoit pas ; la meilleure décision reste d'acheter, couvert.",
    ],
    titre: "Ce qu'on a tenté ensuite",
    oeuvre: "Le souffle",
    legende: "Une spirale de 2016 (en bas) à 2026 (en haut), dont l'épaisseur suit la volatilité réalisée de chaque mois. Les parties teintées sont les mois agités, au-dessus de 20 % de volatilité annuelle.",
    clair: "Une fois le test ouvert, trois pistes ont été suivies. D'abord, réentraîner le même modèle sur une histoire plus longue, de 1999 à 2026, avec Bloomberg en référence. Ensuite, appliquer tous les leviers d'amélioration réalisables, selon un protocole figé avant le moindre calcul et jugé sur 2010-2023 : aucun ne passe. Enfin, prévoir l'agitation du marché plutôt que son sens.",
    technique: V2_INFO
      ? `Avec ${V2_INFO.mois} mois d'entraînement au lieu de ${CHIFFRES.moisEntrainement}, la règle du notebook 03 retient ${V2_INFO.modele} sur la validation. Sur le test, sa log-loss vaut ${dec(V2_INFO.ll)} contre ${dec(V2_INFO.llConst)} pour la constante (écart ${dec(V2_INFO.ecart.moyenne, 3)} ± ${dec(V2_INFO.ecart.erreur_type, 3)}), et sa règle rapporte ${pct(V2_INFO.regle, 1, true)} contre ${pct(V2_INFO.couvert, 1, true)} pour l'achat couvert. Mieux que la première version, toujours pas mieux que la constante. La logistique aurait battu la constante sur le test (${dec(V2_INFO.llLogit)}), mais la règle annoncée l'avait écartée sur la validation (${dec(V2_INFO.llLogitVal)}) : la choisir maintenant reviendrait à choisir sur le test.${V3_INFO ? ` Les leviers d'amélioration, réentraînés chaque mois sur ${V3_INFO.mois} mois de 2010-2023 : ${V3_INFO.retenus} sur ${V3_INFO.tests} passent le test de Diebold-Mariano ou le bootstrap du Sharpe après correction de Holm (plus petite p corrigée : ${dec(V3_INFO.pMin, 2)}). Le meilleur, « ${V3_INFO.meilleure} », gagne ${dec(-V3_INFO.ecart, 4)} de log-loss, soit ${dec(-V3_INFO.ecart / V3_INFO.se, 1)} erreur type.` : ""} Volatilité du mois suivant : R² hors échantillon de ${dec(RISQUE.r2Avant, 2)} sur 2016-2023 ; un mois agité se reconnaît avec une AUC de ${dec(RISQUE.aucAgite, 2)}.`
      : `Volatilité du mois suivant : R² hors échantillon de ${dec(RISQUE.r2Avant, 2)} sur 2016-2023 ; un mois agité se reconnaît avec une AUC de ${dec(RISQUE.aucAgite, 2)}.`,
    chiffres: V2_INFO
      ? [[`${dec(V2_INFO.ll)} / ${dec(V2_INFO.llConst)}`, "log-loss 1999-2026 : modèle / constante"], [pct(V2_INFO.regle, 1, true), "règle de la seconde version, en euros"],
         V3_INFO ? [`${V3_INFO.retenus} sur ${V3_INFO.tests}`, "leviers retenus par le protocole figé"] : [dec(RISQUE.r2Avant, 2), "R² de la volatilité, 2016-2023"]]
      : [[dec(RISQUE.r2Avant, 2), "R² de la volatilité, 2016-2023"], [dec(RISQUE.aucAgite, 2), "AUC pour un mois agité"], ["—", ""]],
    ton: { mur: "#95a3ac", sol: "#7c858b", ciel: "#f2f6f8", texte: "#fbfdfe", accent: "#e1e8ec" },
  },
];

// ---------- parcours Maths : l'annexe du cours Mathematics & Statistics for ML ----------
// Elle doit dériver le coût, le gradient et le prior du modèle du projet, puis étudier la sensibilité de son
// optimisation ; le plan suit la recette de L1 (données, modèle, coût, optimiseur), et finit par l'option L2.
const MOD = D.modele;
const M = CHIFFRES.moisEntrainement;
const LAMBDA = 1 / (2 * M * MOD.C), TAU = Math.sqrt(MOD.C);
const MC = D.maths ?? {};
const OLS = MC.ols ?? {};
const MATHS = { lambda: LAMBDA, tau: TAU, ols: OLS, llEntrainement: MC.logloss_entrainement, coutPenalise: MC.cout_penalise_entrainement };
const f = (t) => `<span class="f">${t}</span>`;   // une formule, en italique serif

const SALLES_MATHS = [
  {
    id: "m-modele", num: "I", nom: "Le modèle", kanji: "型",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "La recette : données, modèle, coût, optimiseur"], ["L2", "La matrice de conception"]],
    presenter: [
      `<b>La recette de L1.</b> Données : m = ${M} mois d'entraînement et d = ${MOD.coefficients.length} variables standardisées. Le modèle, le coût et l'optimiseur viennent ensuite, une salle chacun.`,
      `<b>Le modèle.</b> Un score linéaire ${f("u = wᵀx + b")}, écrit pour tous les mois à la fois avec la matrice de conception de L2, puis la sigmoïde ${f("σ(u) = 1 / (1 + e<sup>−u</sup>)")} en fait une probabilité de baisse.`,
      `<b>La propriété à retenir.</b> ${f("σ′(u) = σ(u)(1 − σ(u))")} : c'est elle qui rendra le gradient si simple, salle III.`,
    ],
    titre: "Une probabilité par mois",
    oeuvre: "La sigmoïde",
    legende: `Un bloc de céramique dont l'arête suit σ(u) = 1 / (1 + e⁻ᵘ). Les perles sont les ${M} mois d'entraînement, posées au score que le modèle leur donne : claires si le Nikkei a monté, sombres s'il a baissé.`,
    clair: "Chaque fin de mois, le modèle combine douze variables en un score, puis la sigmoïde transforme ce score en une probabilité de baisse, entre 0 et 1. Tout le parcours explique comment on choisit les poids de cette combinaison, et comment on vérifie qu'ils sont les bons.",
    technique: `On dispose de m = ${M} mois d'entraînement et de d = ${MOD.coefficients.length} variables standardisées (news, prix, taux, change, et deux distances aux régimes k-means). La matrice de conception X̃ = [X, 1] a une ligne par mois et une colonne de 1 pour l'intercept. Le modèle est ${f("p = σ(wᵀx + b)")}, avec ${f("σ(u) = 1 / (1 + e<sup>−u</sup>)")}. En dérivant (1 + e<sup>−u</sup>)<sup>−1</sup>, ${f("σ′(u) = e<sup>−u</sup> / (1 + e<sup>−u</sup>)² = σ(u)(1 − σ(u))")}.`,
    chiffres: [[nombre(M), "mois d'entraînement, m"], [nombre(MOD.coefficients.length), "variables standardisées, d"], [dec(MOD.intercept, 3), "intercept b appris"]],
    ton: { mur: "#2e3a4e", sol: "#b7b2aa", ciel: "#dde4ee", texte: "#f1f3f7", accent: "#9fb0c9" },
  },
  {
    id: "m-cout", num: "II", nom: "Le coût", kanji: "損",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L5", "Maximum de vraisemblance"], ["Aide-mémoire", "Loi de Bernoulli"]],
    presenter: [
      `<b>Chaque mois est un tirage de Bernoulli.</b> ${f("P(y | x) = p<sup>y</sup>(1 − p)<sup>1−y</sup>")}, où p est la probabilité de baisse et y vaut 1 si le mois a baissé.`,
      `<b>De la vraisemblance à la log-loss (L5).</b> Mois supposés indépendants : la vraisemblance est un produit ; son logarithme, changé de signe et divisé par m, donne ${f("J(w, b) = −(1/m) Σ [y log p + (1 − y) log(1 − p)]")}.`,
      `<b>Sur nos données.</b> J vaut ln 2 ≈ 0,693 au départ (w = 0, p = 50 %) et ${MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—"} au minimum, sur l'entraînement. L'indépendance des mois est une approximation, à discuter.`,
    ],
    titre: "De la vraisemblance à la log-loss",
    oeuvre: "Les deux branches",
    legende: `Deux courbes de céramique : la perte −log p quand le mois baisse, et −log(1 − p) quand il monte. Les perles sont les ${M} mois d'entraînement, posées à la perte que le modèle y paie.`,
    clair: "Chaque mois est un tirage à pile ou face, de probabilité p. Rendre les mois observés aussi probables que possible revient à minimiser la log-loss : elle est faible quand le modèle annonce avec assurance ce qui arrive, et très grande quand il se trompe avec assurance.",
    technique: `${f("P(y | x) = p<sup>y</sup>(1 − p)<sup>1−y</sup>")}. Si les mois sont indépendants, la vraisemblance ${f("L = Π p<sup>y</sup>(1 − p)<sup>1−y</sup>")} est un produit ; maximiser son logarithme revient à minimiser ${f("J(w, b) = −(1/m) log L")}. Le logarithme change le produit en somme et ne déplace pas le maximum. Hypothèse à discuter : les rendements mensuels sont peu corrélés, pas exactement indépendants. Au minimum, sur les ${M} mois d'entraînement, J vaut ${MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—"}, et le coût pénalisé de la salle IV ${MC.cout_penalise_entrainement != null ? dec(MC.cout_penalise_entrainement) : "—"} ; un pile ou face à 50 % donnerait ln 2 ≈ 0,693.`,
    chiffres: [[dec(Math.log(2)), "ln 2 : le coût au départ, w = 0"], [MC.logloss_entrainement != null ? dec(MC.logloss_entrainement) : "—", "log-loss au minimum, entraînement"], [MC.cout_penalise_entrainement != null ? dec(MC.cout_penalise_entrainement) : "—", "coût pénalisé J<sub>λ</sub> au minimum"]],
    ton: { mur: "#c9bca6", sol: "#a99c86", ciel: "#fbf6ec", texte: "#fffaf1", accent: "#8a7a5f" },
  },
  {
    id: "m-gradient", num: "III", nom: "Le gradient", kanji: "勾",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "Le gradient d'un coût"], ["L2", "Le gradient, un poids à la fois"]],
    presenter: [
      `<b>La règle de la chaîne.</b> ${f("∂J/∂w<sub>j</sub> = (−y/p + (1 − y)/(1 − p)) · p(1 − p) · x<sub>j</sub> = (p − y) x<sub>j</sub>")} : la dérivée de la sigmoïde simplifie tout.`,
      `<b>La forme des moindres carrés (L2).</b> En matrice, ${f("∇<sub>w</sub>J = (1/m) Xᵀ(p − y)")} : l'erreur de prédiction fois l'entrée, exactement comme pour la régression linéaire.`,
      "<b>Vérifié.</b> En un point tiré au hasard, le gradient analytique et les différences finies centrées s'accordent à 1,3 × 10⁻⁹ près.",
    ],
    titre: "L'erreur, fois l'entrée",
    oeuvre: "La carte des pentes",
    legende: "Une plaque gravée des courbes de niveau du coût, sur deux coefficients. Chaque flèche montre la direction de plus forte descente, −∇J ; sa longueur dit la raideur de la pente.",
    clair: "Pour savoir dans quel sens bouger les poids, on dérive le coût. Le résultat est d'une grande simplicité : pour chaque mois, l'erreur de prédiction, p − y, multipliée par les variables du mois.",
    technique: `Règle de la chaîne, pour un mois : ${f("∂J/∂w<sub>j</sub> = (−y/p + (1 − y)/(1 − p)) · p(1 − p) · x<sub>j</sub> = (p − y) x<sub>j</sub>")}. En matrice : ${f("∇<sub>w</sub>J = (1/m) Xᵀ(p − y)")} et ${f("∂J/∂b = (1/m) Σ (p − y)")}. Pour la régression linéaire de L2, ${f("∇J = (1/m) Xᵀ(Xw − y)")} : même forme, avec p à la place de Xw. Vérification numérique : en un point tiré au hasard, le gradient analytique et les différences finies centrées s'accordent à 1,3 × 10⁻⁹ près.`,
    chiffres: [["(p − y)·x", "le gradient d'un mois"], ["1,3 × 10⁻⁹", "écart avec les différences finies"], [nombre(MOD.coefficients.length + 1), "dérivées partielles, w et b"]],
    ton: { mur: "#5f7066", sol: "#8c8f86", ciel: "#e6eee8", texte: "#f2f6f2", accent: "#b9c9bd" },
  },
  {
    id: "m-prior", num: "IV", nom: "Le prior", kanji: "先",
    notebooks: ["05_annexe_maths_logistique", "02_pipeline_modeles_optuna"], docs: ["annexe"],
    seances: [["L7", "Ridge : la pénalité L2"], ["L2", "Quand XᵀX n'est pas inversible"]],
    presenter: [
      `<b>Le prior.</b> Avant de voir les données, on suppose chaque poids petit : ${f("w ∼ N(0, τ²I)")}.`,
      `<b>Le maximum a posteriori.</b> Il ajoute ${f("λ‖w‖²")} au coût, avec ${f("λ = 1/(2mτ²)")} : la pénalité ridge de L7 est un prior gaussien.`,
      `<b>Sur nos données.</b> Le C = ${dec(MOD.C, 4)} choisi par Optuna donne λ = ${dec(LAMBDA, 3)} et τ = ${dec(TAU, 2)} ; l'intercept n'est pas pénalisé. Réserve : λ vient d'une validation croisée, pas d'une croyance posée avant les données.`,
    ],
    titre: "La pénalité, une croyance a priori",
    oeuvre: "La cloche",
    legende: `La densité du prior gaussien N(0, τ²), avec τ = ${dec(TAU, 2)}. Les douze tiges sont les poids appris par le modèle final : tous restent au cœur de la cloche.`,
    clair: "Avant de voir les données, on suppose que chaque poids est probablement petit. Écrire cette croyance comme une loi normale centrée, puis chercher les poids les plus probables a posteriori, revient exactement à ajouter une pénalité L2 au coût.",
    technique: `Prior ${f("w ∼ N(0, τ²I)")}. Le maximum a posteriori ajoute ${f("−(1/m) log p(w) = ‖w‖² / (2mτ²)")} : ${f("J<sub>λ</sub> = J + λ‖w‖²")}, avec ${f("λ = 1/(2mτ²)")}, et ${f("∇J<sub>λ</sub> = (1/m) Xᵀ(p − y) + 2λw")}. scikit-learn minimise ½‖w‖² + C Σ ℓ ; en divisant par Cm, on retrouve J<sub>λ</sub> avec λ = 1/(2mC). Le C = ${dec(MOD.C, 4)} choisi par Optuna donne λ = ${dec(LAMBDA, 3)} et τ = ${dec(TAU, 2)}. Comme en L2, où ridge rend XᵀX + λI inversible quand des variables se répètent, la pénalité stabilise les poids. L'intercept n'a pas de prior : liblinear le pénalisait et tirait les probabilités vers 50 %, d'où le solveur ${MOD.solveur}.`,
    chiffres: [[dec(MOD.C, 4), "C, choisi par Optuna"], [dec(LAMBDA, 3), "λ = 1/(2mC)"], [dec(TAU, 2), "τ, écart-type a priori d'un poids"]],
    ton: { mur: "#a87b66", sol: "#8f7466", ciel: "#fbe9de", texte: "#fff4ec", accent: "#efc9b4" },
  },
  {
    id: "m-convexite", num: "V", nom: "La convexité", kanji: "凸",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L7", "Le coût pénalisé, strictement convexe"], ["L8", "Sensibilité au point de départ"]],
    presenter: [
      `<b>La hessienne.</b> ${f("H = (1/m) X̃ᵀ S X̃ + 2λ diag(1, …, 1, 0)")}, avec ${f("S = diag(p(1 − p))")} : elle est définie positive.`,
      "<b>Donc un seul minimum.</b> Le coût pénalisé est strictement convexe : il a au plus un minimum, et la pénalité, qui le fait croître sans limite, garantit qu'il existe.",
      "<b>Vérifié (L8).</b> Trois départs très différents, de J = 0,69 à 12,4, arrivent au même minimum à 10⁻¹⁷ près.",
    ],
    titre: "Un seul fond de vallée",
    oeuvre: "Le paysage du coût",
    legende: "La surface de log-loss pénalisée sur deux coefficients, gravée de ses courbes de niveau. La bille suit la descente de gradient jusqu'au minimum.",
    clair: "Le coût pénalisé a la forme d'un bol : d'où que l'on parte, on descend vers le même point. Le notebook le vérifie en lançant la descente depuis trois départs très différents.",
    technique: `Hessienne : ${f("H = (1/m) X̃ᵀ S X̃ + 2λ diag(1, …, 1, 0)")}, avec ${f("S = diag(p(1 − p))")}. Pour (v, c) ≠ 0, ${f("(v, c)ᵀ H (v, c) = (1/m)(Xv + c𝟏)ᵀ S (Xv + c𝟏) + 2λ‖v‖² > 0")} : J<sub>λ</sub> est strictement convexe, donc son minimum est unique. Il existe parce que la pénalité fait croître J<sub>λ</sub> sans limite quand ‖w‖ grandit (coercivité). Trois départs, de J = 0,69 à 12,4, arrivent au même minimum à 10⁻¹⁷ près.`,
    chiffres: [["H ≻ 0", "hessienne définie positive"], ["3 → 1", "trois départs, un seul minimum"], ["10⁻¹⁷", "écart entre les minima trouvés"]],
    ton: { mur: "#35302e", sol: "#5e5853", ciel: "#e6dfd8", texte: "#f4efe9", accent: "#bdb0a3" },
  },
  {
    id: "m-descente", num: "VI", nom: "La descente", kanji: "降",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L1", "La descente de gradient, un pas à la main"], ["L8", "Sensibilité au pas et aux itérations"]],
    presenter: [
      `<b>L'optimiseur de L1.</b> ${f("w ← w − α ∇J<sub>λ</sub>")}, répété jusqu'à ce que le gradient s'annule.`,
      "<b>Le bon pas (L8).</b> Comme p(1 − p) ≤ ¼, L ≤ 0,962 : la descente converge pour α < 2/L = 2,08. Trop petit, elle traîne ; au-delà, elle oscille et s'éloigne.",
      "<b>Vérifié.</b> Avec α = 1/L, la descente codée à la main retrouve lbfgs, le solveur de scikit-learn, à 4,6 × 10⁻⁶ près.",
    ],
    titre: "Choisir la taille du pas",
    oeuvre: "Les quatre pas",
    legende: "Quatre tables, une par taille de pas, et le même point de départ. Trop petit, la bille n'arrive pas ; au-delà de 2/L, elle oscille et s'éloigne.",
    clair: "La descente de gradient avance par petits pas dans la direction qui descend le plus. Tout se joue sur la taille du pas : trop petit, on n'arrive jamais ; trop grand, on saute par-dessus la vallée. La théorie donne la limite, et la descente codée à la main retrouve scikit-learn.",
    technique: `${f("w ← w − α ∇J<sub>λ</sub>")}. Comme p(1 − p) ≤ ¼, le gradient est L-lipschitzien, avec ${f("L ≤ ¼ λ<sub>max</sub>(X̃ᵀX̃/m) + 2λ = 0,962")} : pas classique α = 1/L = 1,04, convergence garantie pour α < 2/L = 2,08. Cette borne est prudente : au minimum, la limite locale vaut 2/λ<sub>max</sub>(H*) = 2,23. Avec α = 1/L et 20 000 itérations, la descente à la main retrouve lbfgs à 4,6 × 10⁻⁶ près, et ‖∇J<sub>λ</sub>‖ = 1,5 × 10⁻¹⁷ au point trouvé. Arrêter tôt garde les poids près de 0 : c'est une autre façon de régulariser.`,
    chiffres: [["0,962", "L, constante de Lipschitz"], ["2,08", "pas maximal garanti, 2/L"], ["4,6 × 10⁻⁶", "écart avec scikit-learn"]],
    ton: { mur: "#8ea2b1", sol: "#7a8791", ciel: "#eef3f7", texte: "#fafcfd", accent: "#dbe5ec" },
  },
  {
    id: "m-moindres", num: "VII", nom: "Les moindres carrés", kanji: "線",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    seances: [["L2", "Moindres carrés, équations normales, R²"], ["L1", "Sur-apprentissage"]],
    presenter: [
      `<b>L'idée (L2).</b> Pourquoi ne pas prédire directement le rendement du mois suivant, par une régression linéaire sur les ${OLS.variables ?? 12} mêmes variables ?`,
      `<b>Les équations normales, à la main.</b> ${f("X̃ᵀX̃β = X̃ᵀr")}, résolues sans inverser la matrice : elles retrouvent scikit-learn à ${OLS.ecart_scikit_learn != null ? "7 × 10⁻¹⁷" : "—"} près.`,
      `<b>Le R² tranche.</b> ${OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 2) : "—"} sur l'entraînement, ${OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—"} sur la validation : hors échantillon, la droite fait pire que la moyenne. D'où le choix d'une probabilité et d'un coût pénalisé.`,
    ],
    titre: "Et si l'on prédisait le rendement ?",
    oeuvre: "Les deux nuages",
    legende: `Une plaque et sa diagonale, où le rendement prévu égale le rendement réel. Chaque perle est un mois, posée à ces deux rendements : claires pour les ${M} mois d'entraînement, terre cuite pour les ${OLS.mois_validation ?? 24} mois de validation, qui s'écartent de la diagonale.`,
    clair: "Avant de prédire une probabilité, on peut tenter la régression linéaire de L2 sur le rendement lui-même. Les équations normales donnent la meilleure droite sur l'entraînement ; sur la validation, elle fait pire que la simple moyenne. C'est ce qui justifie de prédire une probabilité, avec un coût pénalisé.",
    technique: `Mêmes ${OLS.variables ?? 12} variables, plus une colonne de 1 : au fond du bol, le gradient de ${f("Σ (r − X̃β)²")} s'annule, ce qui donne les équations normales ${f("X̃ᵀX̃β = X̃ᵀr")}. Résolues avec np.linalg.solve, sans calculer d'inverse, elles retrouvent scikit-learn à 7 × 10⁻¹⁷ près. ${f("R² = 1 − Σ(r − r̂)² / Σ(r − r̄)²")} vaut ${OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 3) : "—"} sur l'entraînement et ${OLS.r2_validation != null ? dec(OLS.r2_validation, 3) : "—"} sur la validation. Un R² négatif veut dire que la droite prédit moins bien que la moyenne : le R² d'entraînement est optimiste, c'est le sur-apprentissage de L1.`,
    chiffres: [[OLS.r2_entrainement != null ? dec(OLS.r2_entrainement, 2) : "—", "R² sur l'entraînement"], [OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—", "R² sur la validation"], ["7 × 10⁻¹⁷", "écart des équations normales avec scikit-learn"]],
    ton: { mur: "#56485e", sol: "#6c6270", ciel: "#efe6f1", texte: "#f7f2f8", accent: "#cdbdd3" },
  },
];

// ---------- le cours choisi : Applied ML ou Maths ----------
let choix = new URLSearchParams(location.search).get("cours");
if (choix !== "ml" && choix !== "maths") { try { choix = localStorage.getItem("nikkei-cours"); } catch (e) { choix = null; } }
const COURS = choix === "maths" ? "maths" : "ml";
try { localStorage.setItem("nikkei-cours", COURS); } catch (e) { /* stockage indisponible */ }
const SALLES = COURS === "maths" ? SALLES_MATHS : SALLES_ML;
const TOUTES_SALLES = { ml: SALLES_ML, maths: SALLES_MATHS };

// ajoute le cours à une adresse du site, pour que le choix suive d'une page à l'autre
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
    h1: "Acheter, rester neutre ou vendre <em>le Nikkei</em>",
    devise: "Peut-on savoir, à la fin d'un mois, s'il faut acheter le Nikkei le mois suivant ? Un modèle répond chaque mois par une probabilité ; une règle, figée avant le test, en tire une action.",
    verdict: `Sur les ${CHIFFRES.moisTest} mois de test, le modèle ne fait pas mieux qu'une prévision constante (log-loss ${dec(CHIFFRES.llModele)} contre ${dec(CHIFFRES.llConstante)}). Comme promis avant le test, la recommandation est d'acheter le Nikkei et de se couvrir contre le yen.`,
    rotonde: { mur: 0xd4c6b7, sol: 0xcdb3a4, fond: 0xcfc6ba },
  },
  maths: {
    nom: "Maths", cours: "Mathematics & Statistics for Machine Learning",
    h1: "La régression logistique, <em>refaite à la main</em>",
    devise: "Ce que demande l'annexe du cours : dériver le coût, le gradient et le prior du modèle du projet, puis étudier la sensibilité de son optimisation, jusqu'à une descente codée à la main qui retrouve scikit-learn.",
    verdict: `La log-loss est l'opposé d'une log-vraisemblance ; son gradient vaut (1/m)·Xᵀ(p − y) ; la pénalité L2 est un prior gaussien qui rend le problème strictement convexe ; la descente converge pour α < 2/L. Et une régression linéaire sur le rendement, résolue par les équations normales, fait pire que la moyenne hors échantillon (R² = ${OLS.r2_validation != null ? dec(OLS.r2_validation, 2) : "—"}).`,
    rotonde: { mur: 0xcdd0cd, sol: 0xb8b2ab, fond: 0xc9ccc9 },
  },
};

const ENTREE = {
  titre: "Le Nikkei, mois après mois",
  devise: COURS === "maths"
    ? "Comment le modèle du projet apprend-il ses poids, et comment le vérifier ?"
    : "Peut-on savoir, à la fin d'un mois, s'il faut acheter le Nikkei le mois suivant ?",
  ecole: "Applied ML · Mathematics & Statistics for ML — Albert School, MSc 1, automne 2026",
};

const LIMITES_ML = [
  ["Le test n'était pas entièrement invisible.", "Le notebook 01 affichait déjà des statistiques de 2024-2026, dont la courbe « achat couvert ou non ». La couverture permanente n'a donc pas été choisie à l'aveugle ; sur 2010-2021, ne pas couvrir faisait même un peu mieux."],
  ["Les variables ont été choisies sur 2017-2026.", "L'analyse exploratoire qui a guidé le choix des variables recouvre la validation et le test."],
  ["Les écarts sont petits devant le bruit.", `Sur ${CHIFFRES.moisTest} mois, l'écart de log-loss entre le modèle et la constante (${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}) ne tranche dans aucun sens. Il faudrait des centaines de mois pour voir un gain réaliste.`],
  ["Les rendements sont simplifiés.", "Indice de prix sans dividendes (environ 2 % par an), pas de frais, couverture approchée par l'écart des taux à court terme."],
  ["Tout ce qui a suivi le test est exploratoire.", "La seconde version sur 1999-2026, la volatilité et le signal fondé sur le risque ont été faits après l'ouverture de 2024-2026 : ce sont des pistes, pas des résultats confirmés. Les confirmer demande des données que personne n'a encore vues, d'autres marchés ou les mois à venir."],
  ["La variable de news la plus influente est fragile.", "GDELT plafonne chaque requête trimestrielle à 250 articles : le nombre d'articles d'un mois dépend alors du reste du trimestre. Il faudrait la reconstruire à partir des volumes totaux de GDELT, ou par fenêtres plus courtes."],
];

const LIMITES_MATHS = [
  ["Les mois ne sont pas tout à fait indépendants.", "La vraisemblance est un produit sur des mois supposés indépendants ; les rendements mensuels sont peu corrélés, mais pas exactement. La log-loss reste un bon coût ; son interprétation probabiliste est une approximation."],
  ["Le prior n'est pas fixé à l'avance.", "λ, donc τ, vient d'une validation croisée : c'est un réglage appris sur les données, pas une croyance posée avant de les voir."],
  ["La surface en deux dimensions est une simplification.", "Pour dessiner le coût, l'intercept est fixé à son optimum et seules deux variables sont gardées ; les constantes L et la limite locale de cette surface diffèrent de celles du modèle complet (0,962 et 2,23)."],
  ["La borne 2/L est prudente.", "Elle vaut partout, mais près du minimum p(1 − p) reste nettement sous ¼ : la descente converge encore un peu au-delà, jusqu'à la limite locale."],
  ["Le R² d'entraînement est optimiste.", "Il est mesuré sur les mois qui ont servi à calculer β. Seul le R² de validation dit ce que la droite vaut sur des mois nouveaux : ici, moins que la moyenne."],
];
const LIMITES = COURS === "maths" ? LIMITES_MATHS : LIMITES_ML;

// ---------- les figures des notebooks : titre, ce qu'il faut y voir, notebook d'origine ----------
const FIGURES = {
  "01_nikkei_split": ["Le Nikkei et le découpage dans le temps", "Clôture mensuelle de l'indice et les trois blocs : entraînement, validation, test.", "01_cadrage_eda_variables"],
  "01_cibles_couverture": ["Les cibles, et l'intérêt de se couvrir", "Les cibles du projet, et l'achat couvert face à l'achat non couvert contre le yen.", "01_cadrage_eda_variables"],
  "01_correlations": ["Corrélations entre les variables", "Les variables candidates deux à deux, pour repérer celles qui disent la même chose.", "01_cadrage_eda_variables"],
  "02_optuna_historique": ["Les essais Optuna, un par un", "Log-loss de validation croisée au fil des essais, pour chaque modèle.", "02_pipeline_modeles_optuna"],
  "02_coefficients_logistiques": ["Les poids de la logistique", "Le poids de chaque variable standardisée dans le modèle retenu.", "02_pipeline_modeles_optuna"],
  "02_coude_kmeans": ["Combien de régimes de marché ?", "La méthode du coude, qui fixe le nombre de groupes du k-means.", "02_pipeline_modeles_optuna"],
  "03_fiabilite_brute": ["Fiabilité des probabilités, avant calibration", "Probabilité annoncée face à la fréquence observée : sur la diagonale, le modèle dit vrai.", "03_calibration_seuils"],
  "03_fiabilite_platt": ["Fiabilité après la calibration de Platt", "La même courbe, une fois les probabilités recalibrées.", "03_calibration_seuils"],
  "03_regle_validation": ["La règle sur la validation", "La règle de décision appliquée à 2022-2023, en euros.", "03_calibration_seuils"],
  "03b_test_probabilites": ["Les probabilités sur le test", "À gauche, la fiabilité ; à droite, la probabilité de baisse annoncée chaque mois, face aux baisses réalisées.", "03b_test_final"],
  "03b_test_regle": ["La règle figée, sur le test", "Ce que la règle aurait rapporté en 2024-2026, face à l'achat couvert et non couvert.", "03b_test_final"],
  "04_permutation": ["Importance par permutation", "Ce que coûte, en log-loss, le fait de mélanger chaque variable.", "04_explicabilite_diagnostics"],
  "04_shap_beeswarm_test": ["Valeurs SHAP sur le test", "L'effet de chaque variable sur chaque prédiction du test.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2024-07": ["Une prédiction expliquée : juillet 2024", "La prédiction décomposée variable par variable.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2025-03": ["Une prédiction expliquée : mars 2025", "La prédiction décomposée variable par variable.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2026-09": ["Une prédiction expliquée : septembre 2026", "La prédiction décomposée variable par variable.", "04_explicabilite_diagnostics"],
  "04_shap_waterfall_2026-10": ["Une prédiction expliquée : octobre 2026", "La dernière prédiction, décomposée variable par variable.", "04_explicabilite_diagnostics"],
  "04_pdp_ice_news": ["Dépendance partielle : le volume d'articles", "Comment la prédiction varie avec le volume anormal d'articles, en moyenne et mois par mois.", "04_explicabilite_diagnostics"],
  "04_inversion_signal_news": ["News et rendement selon la période", "Le lien entre volume d'articles et rendement, avant et après 2021.", "04_explicabilite_diagnostics"],
  "05_sensibilite_lambda": ["L'effet de la pénalité λ", "Log-loss d'entraînement, de validation croisée et de validation, et norme des poids, selon λ.", "05_annexe_maths_logistique"],
  "05_sensibilite_pas": ["L'effet du pas de descente", "J(wₜ) − J* selon le pas : trop petit, c'est lent ; trop grand, ça ne converge pas.", "05_annexe_maths_logistique"],
  "05_sensibilite_depart": ["Trois départs, un seul minimum", "Trois points de départ très différents mènent au même minimum : la convexité, observée.", "05_annexe_maths_logistique"],
  "05_sensibilite_iterations": ["Le nombre d'itérations", "Log-loss d'entraînement et de validation selon le nombre d'itérations, avec α = 1/L.", "05_annexe_maths_logistique"],
  "07_nikkei_1999_2026": ["Le Nikkei de 1999 à 2026", "La clôture mensuelle sur toute la table de la seconde version, en échelle logarithmique.", "07_seconde_version_bloomberg"],
  "07_bloomberg_controles": ["Bloomberg en référence", "À gauche, le Tankan de la table et celui de Bloomberg, décalé d'un mois ; à droite, l'export du VIX « en euros » rapporté au VIX.", "07_seconde_version_bloomberg"],
  "07_optuna_v1_v2": ["Les essais Optuna des deux versions", "Log-loss en validation croisée de chaque essai, 2010-2021 contre 1999-2021.", "07_seconde_version_bloomberg"],
  "07_test_euros": ["Les deux règles sur le test", "1 € investi selon la règle de chaque version, face à l'achat couvert.", "07_seconde_version_bloomberg"],
  "07_permutation_v2": ["Permutation, seconde version", "Ce que perd le LightGBM retenu quand on mélange chaque variable, sur la validation et sur le test.", "07_seconde_version_bloomberg"],
  "07_shap_v2_test": ["SHAP, seconde version", "L'effet de chaque variable sur chaque prédiction du LightGBM, sur le test.", "07_seconde_version_bloomberg"],
  "07_shap_v2_derniere": ["La dernière prédiction, seconde version", "La prédiction pour novembre 2026 décomposée variable par variable.", "07_seconde_version_bloomberg"],
  "07_coefficients_v1_v2": ["La logistique, réentraînée", "Les coefficients de la logistique sur 2010-2021 et sur 1999-2021 : la pénalité L1 n'en garde que cinq.", "07_seconde_version_bloomberg"],
  "07_stabilite_signaux": ["Des signaux qui changent de signe", "Corrélation de rang de chaque variable avec le rendement du mois suivant, période par période.", "07_seconde_version_bloomberg"],
  "08_ecarts_log_loss": ["Six variantes face à la constante", "Écart de log-loss avec la constante, chaque variante réapprise chaque mois, par sous-période ; les barres couvrent 95 %.", "08_ameliorations_sans_surapprentissage"],
  "08_log_loss_cumulee": ["L'écart, cumulé mois après mois", "Au-dessus de zéro, la variante a perdu contre la constante depuis janvier 2010.", "08_ameliorations_sans_surapprentissage"],
  "08_fiabilite": ["Fiabilité sur 2010-2023", "Probabilité de baisse annoncée, par quintile, face à la fréquence observée des baisses.", "08_ameliorations_sans_surapprentissage"],
  "08_regle_au_cash": ["Pourquoi la règle reste au cash", "La zone neutre de la règle (en gris) et les probabilités annoncées : la constante n'en sort jamais.", "08_ameliorations_sans_surapprentissage"],
  "08_leviers_sharpe": ["Les leviers en euros", "Écart de Sharpe avec l'achat couvert sur 2010-2023, avec un intervalle bootstrap à 90 %.", "08_ameliorations_sans_surapprentissage"],
  "08_richesse": ["100 € investis, levier par levier", "À gauche, 2010-2023 pour juger ; à droite, 2024-2026, déjà vu, à titre indicatif.", "08_ameliorations_sans_surapprentissage"],
  "08_coefficients_dans_le_temps": ["Des coefficients réappris chaque mois", "Les six coefficients standardisés de la logistique économique, de 2010 à 2026.", "08_ameliorations_sans_surapprentissage"],
  "08_contributions_mois_prochain": ["La prévision de novembre 2026, décomposée", "Coefficient × écart standardisé de chaque variable, pour la logistique économique.", "08_ameliorations_sans_surapprentissage"],
};
const nomNotebook = (nom) => `Notebook ${nom.split("_")[0]}`;

return { D, nombre, pct, Maj, dec, moisLong, moisSuivant, ECART_TEST, CHIFFRES, RISQUE, V2_INFO, V3_INFO, MATHS, COURS, SALLES, TOUTES_SALLES, avecCours, COURS_INFO, ENTREE, LIMITES, FIGURES, nomNotebook };
})();
const __commun = (() => {
"use strict";
// En-tête, choix du cours, menu et liseuse de notebooks, communs à la visite, à la lecture et au cabinet.
const { SALLES, ENTREE, COURS, COURS_INFO, avecCours, D, nomNotebook } = __contenu;
const FLECHE = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M0 5h32M27 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
const FLECHE_G = '<svg class="fleche" viewBox="0 0 34 10" aria-hidden="true"><path d="M34 5H2M7 1 2 5l5 4" fill="none" stroke="currentColor" stroke-width="1"/></svg>';

function stocker(cle, valeur) { try { localStorage.setItem(cle, valeur); } catch (e) { /* stockage indisponible */ } }
function lire(cle) { try { return localStorage.getItem(cle); } catch (e) { return null; } }

const DOCS = { rapport: ["Le rapport Applied ML", "docs/rapport.pdf"], annexe: ["L'annexe de mathématiques", "docs/annexe_maths.pdf"] };
const titreNotebook = (nom) => D.notebooks.find((n) => n.nom === nom)?.titre ?? nom;
const BAS = '<svg class="bas" viewBox="0 0 10 12" aria-hidden="true"><path d="M5 0v10M1 6l4 4 4-4M0 11.5h10" fill="none" stroke="currentColor" stroke-width="1"/></svg>';
// Ce qui se télécharge : chaque notebook en .ipynb (ou son dossier en .zip), et deux archives (site/data/donnees.js)
const TL = D.telechargements ?? { notebooks: {}, archives: [] };
const telechargement = (nom) => TL.notebooks[nom] ?? { href: `nb/${nom}.ipynb`, fichier: `${nom}.ipynb`, dossier: false };
const etiquetteNb = (nom) => (telechargement(nom).dossier ? "dossier .zip" : ".ipynb");
const lienIpynb = (nom, classe = "telecharger") => {
  const t = telechargement(nom);
  const aide = t.dossier ? `Télécharger ${nomNotebook(nom)} avec tout son dossier (${t.fichiers} fichiers : notebook, scripts, figures)` : `Télécharger ${nomNotebook(nom)} (.ipynb, à ouvrir dans Jupyter)`;
  return `<a class="${classe}" href="${t.href}" download="${t.fichier}" title="${aide}">${etiquetteNb(nom)} ${BAS}</a>`;
};
const mo = (o) => `${(o / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
const archives = () => TL.archives;
const lienArchive = (cle, classe = "telecharger") => {
  const a = TL.archives.find((x) => x.cle === cle);
  return a ? `<a class="${classe}" href="${a.href}" download="${a.fichier}" title="${a.fichiers} fichiers, ${mo(a.octets)}">${a.titre} (.zip, ${mo(a.octets)}) ${BAS}</a>` : "";
};

// Le choix du cours (Applied ML ou Maths) et le mode (visite ou lecture) restent d'une page à l'autre.
function installerEntete(page) {
  document.body.dataset.cours = COURS;
  document.querySelectorAll("[data-cours]").forEach((a) => {
    const ici = page === "cabinet" ? `cabinet.html${location.search.includes("nb=") ? `?nb=${new URLSearchParams(location.search).get("nb")}` : ""}` : page === "lecture" ? "lecture.html" : "index.html";
    a.href = avecCours(ici, a.dataset.cours);
    a.setAttribute("aria-current", a.dataset.cours === COURS ? "page" : "false");
  });
  document.querySelectorAll("a[data-lien]").forEach((a) => (a.href = avecCours(a.dataset.lien)));
}

// page : "visite" | "lecture" | "cabinet" ; allerSalle(id) : appelé par la visite pour se déplacer sans recharger
function installerMenu({ page, allerSalle = null, salleActive = () => null }) {
  const lienSalle = (s) => (page === "visite" || page === "lecture" ? `#${s.id}` : avecCours(`lecture.html#${s.id}`));
  const autre = COURS === "maths" ? "ml" : "maths";
  const menu = document.createElement("div");
  menu.className = "menu";
  menu.setAttribute("role", "dialog");
  menu.setAttribute("aria-modal", "true");
  menu.setAttribute("aria-label", "Menu");
  menu.innerHTML = `
    <button class="menu-fermer" type="button">Fermer <span class="points" aria-hidden="true"><i></i><i></i><i></i><i></i></span></button>
    <div class="menu-corps">
      <nav class="menu-liste">
        <div>
          <p class="menu-titre">${COURS_INFO[COURS].nom} · ${page === "visite" ? "les salles" : "les chapitres"}</p>
          <ul class="menu-salles">
            ${SALLES.map((s) => `<li><a href="${lienSalle(s)}" data-salle="${s.id}"><span class="n">${s.num}</span><span class="t">${s.nom}</span>${FLECHE}</a></li>`).join("")}
          </ul>
        </div>
        <div class="menu-autres">
          <p class="menu-titre">Ailleurs</p>
          <a href="${avecCours(page === "cabinet" ? "index.html" : page === "lecture" ? "lecture.html" : "index.html", autre)}"><span class="t">Passer au parcours ${COURS_INFO[autre].nom}</span>${FLECHE}</a>
          ${page !== "visite" ? `<a href="${avecCours("index.html")}"><span class="t">La visite en 3D</span>${FLECHE}</a>` : ""}
          ${page !== "lecture" ? `<a href="${avecCours("lecture.html")}"><span class="t">La lecture</span>${FLECHE}</a>` : ""}
          ${page !== "cabinet" ? `<a href="${avecCours("cabinet.html")}"><span class="t">Les notebooks</span>${FLECHE}</a>` : ""}
          <a href="docs/rapport.pdf"><span class="t">Le rapport, en PDF</span>${FLECHE}</a>
          <a href="docs/annexe_maths.pdf"><span class="t">L'annexe de maths, en PDF</span>${FLECHE}</a>
        </div>
        <p class="menu-pied"><span>${ENTREE.ecole}</span></p>
      </nav>
      <div class="menu-cartes">
        ${page === "lecture"
          ? `<a class="carte-menu" href="${avecCours("index.html")}" style="--fond:${SALLES[4].ton.mur}"><span class="num">V</span><span>La visite en 3D ${FLECHE}</span><small>Sept salles, une œuvre faite de données dans chacune.</small></a>`
          : `<a class="carte-menu" href="${avecCours("lecture.html")}" style="--fond:${SALLES[0].ton.mur}"><span class="num">¶</span><span>La lecture ${FLECHE}</span><small>Le même parcours en texte, avec les graphiques, les tableaux et les figures.</small></a>`}
        <a class="carte-menu" href="${avecCours("cabinet.html")}" style="--fond:${COURS === "maths" ? "#3b3533" : "#55443a"}"><span class="num">⌘</span><span>Le cabinet ${FLECHE}</span><small>Les six notebooks, tels qu'ils ont été exécutés.</small></a>
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

// En arrivant dans une salle : les séances du cours qu'elle mobilise, puis les trois points à présenter
function arrivee(salle) {
  if (!salle.presenter?.length) return "";
  const seances = (salle.seances ?? []).map(([code, nom]) => `<li><b>${code}</b>${nom}</li>`).join("");
  return `<div class="arrivee">
    ${seances ? `<p class="sur-titre">Vu en cours · ${COURS_INFO[COURS].nom}</p><ul class="seances">${seances}</ul>` : ""}
    <p class="sur-titre">À présenter en arrivant</p>
    <ol class="a-presenter">${salle.presenter.map((p) => `<li>${p}</li>`).join("")}</ol>
  </div>`;
}

// Les notebooks et documents d'une salle, en boutons ; data-nb ouvre la liseuse sans quitter la page
function liensPieces(salle) {
  const nbs = salle.notebooks.map((n) => `<li class="piece-nb"><button type="button" class="piece-lien" data-nb="${n}"><span class="sur-titre">${nomNotebook(n)}</span><span class="t">${titreNotebook(n)}</span>${FLECHE}</button>${lienIpynb(n, "piece-telecharger")}</li>`);
  const docs = salle.docs.map((d) => `<li><a class="piece-lien" href="${DOCS[d][1]}" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><span class="t">${DOCS[d][0]}</span>${FLECHE}</a></li>`);
  if (!nbs.length && !docs.length) return "";
  return `<ul class="pieces-salle">${nbs.join("")}${docs.join("")}</ul>`;
}

// Ouvre un notebook dans un cadre et cache le voile « Ouverture… » dès que la page est lisible, sans attendre ses scripts
// externes (MathJax) : hors ligne, l'événement load peut tarder longtemps.
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
    } catch (e) { /* ouvert depuis le disque : on attend l'événement load */ }
    if (pret || Date.now() - debut > 10000) cacher(); else setTimeout(verifier, 120);
  };
  setTimeout(verifier, 60);
}

// Une liseuse plein écran pour lire un notebook sans perdre sa place (salle de la visite, chapitre de la lecture)
function installerLiseuse() {
  const l = document.createElement("div");
  l.className = "liseuse-flottante";
  l.hidden = true;
  l.setAttribute("role", "dialog");
  l.setAttribute("aria-modal", "true");
  l.setAttribute("aria-label", "Notebook");
  l.innerHTML = `<div class="liseuse-barre"><p class="liseuse-titre"></p><a class="liseuse-telecharger" href="#" download>.ipynb ${BAS}</a><a class="liseuse-cabinet" href="#">Ouvrir dans le cabinet ${FLECHE}</a><button type="button" class="liseuse-fermer">Fermer</button></div>
    <div class="liseuse-cadre"><p class="liseuse-charge">Ouverture du notebook…</p><iframe title="Notebook"></iframe></div>`;
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
    dl.href = t.href; dl.download = t.fichier; dl.title = `Télécharger ${nomNotebook(nom)}`;
    dl.innerHTML = `${etiquetteNb(nom)} ${BAS}`;
    charge.style.opacity = 1;
    ouvrirDansCadre(cadre, `nb/${nom}.html`, () => (charge.style.opacity = 0));
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
// La lecture : sept chapitres, les mêmes que les salles de la visite, avec graphiques, tableaux et figures.
// Deux parcours : Applied ML (le projet) et Maths (l'annexe), selon le cours choisi en haut de page.
const { D, SALLES, ENTREE, LIMITES, CHIFFRES, ECART_TEST, MATHS, COURS, COURS_INFO, FIGURES, V2_INFO, V3_INFO, avecCours, nomNotebook, nombre, pct, dec, moisLong, moisSuivant } = __contenu;
const { installerMenu, installerEntete, installerLiseuse, liensPieces, titreNotebook, arrivee, FLECHE, FLECHE_G } = __commun;
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

return {  };
})();
