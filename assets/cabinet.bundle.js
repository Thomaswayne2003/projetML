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
    titre: "Trois modèles, deux cents essais",
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

// ---------- parcours Maths : l'annexe, de la vraisemblance à la descente de gradient ----------
const MOD = D.modele;
const M = CHIFFRES.moisEntrainement;
const LAMBDA = 1 / (2 * M * MOD.C), TAU = Math.sqrt(MOD.C);
const MATHS = {
  lambda: LAMBDA, tau: TAU,
  moisPourPreuve: Math.ceil(Math.pow((2 * ECART_TEST.ecartType) / 0.02, 2)),
};
const f = (t) => `<span class="f">${t}</span>`;   // une formule, en italique serif

const SALLES_MATHS = [
  {
    id: "m-modele", num: "I", nom: "Le modèle", kanji: "型",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    titre: "Une probabilité par mois",
    oeuvre: "La sigmoïde",
    legende: "Un bloc de céramique dont l'arête suit σ(u) = 1 / (1 + e⁻ᵘ). Les perles sont les mois de validation et de test, posées à leur score : claires si le Nikkei a monté, sombres s'il a baissé.",
    clair: "Chaque fin de mois, le modèle combine douze variables en un score, puis la sigmoïde transforme ce score en une probabilité de baisse, entre 0 et 1. Tout le parcours explique comment on choisit les poids de cette combinaison.",
    technique: `On dispose de m = ${M} mois d'entraînement et de d = ${MOD.coefficients.length} variables standardisées (news, prix, taux, change, et deux distances aux régimes k-means). Le modèle est ${f("p = σ(wᵀx + b)")}, avec ${f("σ(u) = 1 / (1 + e<sup>−u</sup>)")}. En dérivant, ${f("σ′(u) = σ(u)(1 − σ(u))")} : c'est cette propriété qui rendra le gradient très simple.`,
    chiffres: [[nombre(M), "mois d'entraînement, m"], [nombre(MOD.coefficients.length), "variables standardisées, d"], [dec(MOD.intercept, 3), "intercept b appris"]],
    ton: { mur: "#2e3a4e", sol: "#b7b2aa", ciel: "#dde4ee", texte: "#f1f3f7", accent: "#9fb0c9" },
  },
  {
    id: "m-cout", num: "II", nom: "Le coût", kanji: "損",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    titre: "De la vraisemblance à la log-loss",
    oeuvre: "Les deux branches",
    legende: "Deux courbes de céramique : la perte −log p quand le mois baisse, et −log(1 − p) quand il monte. Les perles sont les 33 mois de test, posées à la perte que le modèle a payée.",
    clair: "Chaque mois est un tirage à pile ou face, de probabilité p. Rendre les mois observés aussi probables que possible revient à minimiser la log-loss : elle est faible quand le modèle annonce avec assurance ce qui arrive, et très grande quand il se trompe avec assurance.",
    technique: `${f("P(y | x) = p<sup>y</sup>(1 − p)<sup>1−y</sup>")}. Si les mois sont indépendants, la vraisemblance est un produit ; maximiser son logarithme revient à minimiser ${f("J(w, b) = −(1/m) Σ [y log p + (1 − y) log(1 − p)]")}. Hypothèse à discuter : les rendements mensuels sont peu corrélés, pas exactement indépendants, et la vraisemblance n'est qu'une approximation. Sur le test, la log-loss moyenne vaut ${dec(CHIFFRES.llModele)} pour le modèle et ${dec(CHIFFRES.llConstante)} pour la constante ; un pile ou face à 50 % donnerait ln 2 ≈ 0,693.`,
    chiffres: [[dec(CHIFFRES.llModele), "log-loss du modèle sur le test"], [dec(CHIFFRES.llConstante), "log-loss de la constante"], [dec(Math.log(2)), "pile ou face à 50 %, ln 2"]],
    ton: { mur: "#c9bca6", sol: "#a99c86", ciel: "#fbf6ec", texte: "#fffaf1", accent: "#8a7a5f" },
  },
  {
    id: "m-gradient", num: "III", nom: "Le gradient", kanji: "勾",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
    titre: "L'erreur, fois l'entrée",
    oeuvre: "La carte des pentes",
    legende: "Une plaque gravée des courbes de niveau du coût, sur deux coefficients. Chaque flèche montre la direction de plus forte descente, −∇J ; sa longueur dit la raideur de la pente.",
    clair: "Pour savoir dans quel sens bouger les poids, on dérive le coût. Le résultat est d'une grande simplicité : pour chaque mois, l'erreur de prédiction, p − y, multipliée par les variables du mois.",
    technique: `Règle de la chaîne, pour un mois : ${f("∂J/∂w<sub>j</sub> = (−y/p + (1 − y)/(1 − p)) · p(1 − p) · x<sub>j</sub> = (p − y) x<sub>j</sub>")}. En matrice : ${f("∇<sub>w</sub>J = (1/m) Xᵀ(p − y)")} et ${f("∂J/∂b = (1/m) Σ (p − y)")}. C'est la forme de la régression linéaire. Vérification numérique : en un point tiré au hasard, le gradient analytique et les différences finies centrées s'accordent à 1,3 × 10⁻⁹ près.`,
    chiffres: [["(p − y)·x", "le gradient d'un mois"], ["1,3 × 10⁻⁹", "écart avec les différences finies"], [nombre(MOD.coefficients.length + 1), "dérivées partielles, w et b"]],
    ton: { mur: "#5f7066", sol: "#8c8f86", ciel: "#e6eee8", texte: "#f2f6f2", accent: "#b9c9bd" },
  },
  {
    id: "m-prior", num: "IV", nom: "Le prior", kanji: "先",
    notebooks: ["05_annexe_maths_logistique", "02_pipeline_modeles_optuna"], docs: ["annexe"],
    titre: "La pénalité, une croyance a priori",
    oeuvre: "La cloche",
    legende: `La densité du prior gaussien N(0, τ²), avec τ = ${dec(TAU, 2)}. Les douze tiges sont les poids appris par le modèle final : tous restent au cœur de la cloche.`,
    clair: "Avant de voir les données, on suppose que chaque poids est probablement petit. Écrire cette croyance comme une loi normale centrée, puis chercher les poids les plus probables a posteriori, revient exactement à ajouter une pénalité L2 au coût.",
    technique: `Prior ${f("w ∼ N(0, τ²I)")}. Le maximum a posteriori ajoute ${f("−(1/m) log p(w) = ‖w‖² / (2mτ²)")} : ${f("J<sub>λ</sub> = J + λ‖w‖²")}, avec ${f("λ = 1/(2mτ²)")}, et ${f("∇J<sub>λ</sub> = (1/m) Xᵀ(p − y) + 2λw")}. scikit-learn minimise ½‖w‖² + C Σ ℓ ; en divisant par Cm, on retrouve J<sub>λ</sub> avec λ = 1/(2mC). Le C = ${dec(MOD.C, 4)} choisi par Optuna donne λ = ${dec(LAMBDA, 3)} et τ = ${dec(TAU, 2)}. L'intercept n'a pas de prior : liblinear le pénalisait et tirait les probabilités vers 50 %, d'où le solveur ${MOD.solveur}. Réserve : λ vient d'une validation croisée, ce n'est donc pas un prior fixé avant de voir les données.`,
    chiffres: [[dec(MOD.C, 4), "C, choisi par Optuna"], [dec(LAMBDA, 3), "λ = 1/(2mC)"], [dec(TAU, 2), "τ, écart-type a priori d'un poids"]],
    ton: { mur: "#a87b66", sol: "#8f7466", ciel: "#fbe9de", texte: "#fff4ec", accent: "#efc9b4" },
  },
  {
    id: "m-convexite", num: "V", nom: "La convexité", kanji: "凸",
    notebooks: ["05_annexe_maths_logistique"], docs: ["annexe"],
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
    titre: "Choisir la taille du pas",
    oeuvre: "Les quatre pas",
    legende: "Quatre tables, une par taille de pas, et le même point de départ. Trop petit, la bille n'arrive pas ; au-delà de 2/L, elle oscille et s'éloigne.",
    clair: "La descente de gradient avance par petits pas dans la direction qui descend le plus. Tout se joue sur la taille du pas : trop petit, on n'arrive jamais ; trop grand, on saute par-dessus la vallée. La théorie donne la limite, et la descente codée à la main retrouve scikit-learn.",
    technique: `${f("w ← w − α ∇J<sub>λ</sub>")}. Comme p(1 − p) ≤ ¼, le gradient est L-lipschitzien, avec ${f("L ≤ ¼ λ<sub>max</sub>(X̃ᵀX̃/m) + 2λ = 0,962")} : pas classique α = 1/L = 1,04, convergence garantie pour α < 2/L = 2,08. Cette borne est prudente : au minimum, la limite locale vaut 2/λ<sub>max</sub>(H*) = 2,23. Avec α = 1/L et 20 000 itérations, la descente à la main retrouve lbfgs à 4,6 × 10⁻⁶ près, et ‖∇J<sub>λ</sub>‖ = 1,5 × 10⁻¹⁷ au point trouvé. Arrêter tôt garde les poids près de 0 : c'est une autre façon de régulariser.`,
    chiffres: [["0,962", "L, constante de Lipschitz"], ["2,08", "pas maximal garanti, 2/L"], ["4,6 × 10⁻⁶", "écart avec scikit-learn"]],
    ton: { mur: "#8ea2b1", sol: "#7a8791", ciel: "#eef3f7", texte: "#fafcfd", accent: "#dbe5ec" },
  },
  {
    id: "m-preuve", num: "VII", nom: "La preuve", kanji: "証",
    notebooks: ["03b_test_final", "05_annexe_maths_logistique", "08_ameliorations_sans_surapprentissage"], docs: ["annexe", "rapport"],
    titre: `Ce que ${CHIFFRES.moisTest} mois peuvent prouver`,
    oeuvre: "Les deux colonnes",
    legende: `À gauche, une pile de ${CHIFFRES.moisTest} disques : les mois de test. À droite, la hauteur qu'il faudrait atteindre, environ ${nombre(Math.round(MATHS.moisPourPreuve / 10) * 10)} mois, pour qu'un gain de 0,02 de log-loss dépasse deux erreurs types.`,
    clair: `Un écart entre deux modèles ne veut rien dire sans sa marge d'erreur. Sur ${CHIFFRES.moisTest} mois, l'écart de log-loss entre le modèle et la constante vaut à peine une erreur type : on ne peut conclure ni dans un sens ni dans l'autre. Pour prouver un gain réaliste, il faudrait des centaines de mois.`,
    technique: `Écart moyen, mois par mois : ${f(`d̄ = ${dec(ECART_TEST.moyenne, 3)}`)}, écart-type ${dec(ECART_TEST.ecartType, 3)}, erreur type ${f(`s/√n = ${dec(ECART_TEST.erreurType, 3)}`)}. Les cibles mensuelles ne se chevauchent pas : l'erreur type simple suffit, et Newey-West donne presque la même. Pour qu'un gain de 0,02 dépasse deux erreurs types, il faut ${f("n ≥ (2s / 0,02)²")} ≈ ${nombre(MATHS.moisPourPreuve)} mois. Même verdict en régression : sur le rendement lui-même, les équations normales résolues à la main donnent R² = 0,12 sur l'entraînement, mais −1,77 sur la validation.${V3_INFO ? ` Tester plusieurs variantes demande plus encore : avec ${V3_INFO.tests} comparaisons sur ${V3_INFO.mois} mois, la correction de Holm multiplie la plus petite p-valeur par ${V3_INFO.tests}, puis la deuxième par ${V3_INFO.tests - 1}, et ainsi de suite (notebook 08) ; aucune ne reste sous 5 %.` : ""}`,
    chiffres: [[dec(ECART_TEST.moyenne, 3), "écart moyen de log-loss, modèle − constante"], [`± ${dec(ECART_TEST.erreurType, 3)}`, "une erreur type"], [`≈ ${nombre(MATHS.moisPourPreuve)}`, "mois pour prouver un gain de 0,02"]],
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
    devise: "D'une vraisemblance de Bernoulli à une descente de gradient qui retrouve scikit-learn : le modèle du projet, dérivé et vérifié pas à pas.",
    verdict: `La log-loss est l'opposé d'une log-vraisemblance ; son gradient vaut (1/m)·Xᵀ(p − y) ; la pénalité L2 est un prior gaussien qui rend le problème strictement convexe ; la descente converge pour α < 2/L. Et sur ${CHIFFRES.moisTest} mois de test, aucun écart entre modèles n'est assez grand pour être prouvé.`,
    rotonde: { mur: 0xcdd0cd, sol: 0xb8b2ab, fond: 0xc9ccc9 },
  },
};

const ENTREE = {
  titre: "Le Nikkei, mois après mois",
  devise: COURS === "maths"
    ? "Comment un modèle apprend-il ses poids, et que peut-on en prouver ?"
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
  ["L'erreur type suppose des écarts indépendants.", "C'est raisonnable pour des cibles mensuelles qui ne se chevauchent pas ; sur des cibles qui se chevauchent, il faudrait Newey-West ou un bootstrap par blocs."],
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

return { FLECHE, FLECHE_G, stocker, lire, titreNotebook, BAS, telechargement, etiquetteNb, lienIpynb, archives, lienArchive, installerEntete, installerMenu, liensPieces, ouvrirDansCadre, installerLiseuse };
})();
const __cabinet = (() => {
"use strict";
// Le cabinet : la liste des notebooks et la liseuse, sur une page à part.
const { installerMenu, installerEntete, FLECHE, BAS, lienIpynb, lienArchive, telechargement, ouvrirDansCadre } = __commun;
const { COURS } = __contenu;
// le parcours Maths met l'annexe en tête
const nbs = COURS === "maths"
  ? [...window.NIKKEI.notebooks].sort((a, b) => (b.nom.startsWith("05") ? 1 : 0) - (a.nom.startsWith("05") ? 1 : 0))
  : window.NIKKEI.notebooks;
const liste = document.getElementById("liste"), choix = document.getElementById("choix"), cadre = document.getElementById("cadre"), charge = document.getElementById("charge");
liste.innerHTML = nbs.map((n) => `<li><a href="?nb=${n.nom}&cours=${COURS}" data-nb="${n.nom}"><span class="n">${n.nom.split("_")[0]}</span><span class="t">${n.titre}</span></a>${lienIpynb(n.nom, "telecharger mini")}</li>`).join("");
choix.innerHTML = nbs.map((n) => `<option value="${n.nom}">${n.nom.split("_")[0]} · ${n.titre}</option>`).join("");
document.getElementById("archive").innerHTML = lienArchive("notebooks") + lienArchive("projet");
const courant = document.getElementById("courant");
document.getElementById("docs").innerHTML = `<a href="docs/rapport.pdf"><span class="t">Le rapport, en PDF</span>${FLECHE}</a><a href="docs/annexe_maths.pdf"><span class="t">L'annexe de maths, en PDF</span>${FLECHE}</a>`;

function ouvrir(nom, pousser) {
  if (!nbs.some((n) => n.nom === nom)) nom = nbs[0].nom;
  charge.style.opacity = 1;
  ouvrirDansCadre(cadre, `nb/${nom}.html`, () => { charge.style.opacity = 0; });
  choix.value = nom;
  const t = telechargement(nom);
  courant.href = t.href; courant.download = t.fichier;
  courant.innerHTML = t.dossier ? `Télécharger le notebook ${nom.split("_")[0]} et son dossier (.zip) ${BAS}` : `Télécharger le notebook ${nom.split("_")[0]} (.ipynb) ${BAS}`;
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

return {  };
})();
