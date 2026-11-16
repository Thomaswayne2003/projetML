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
const SALLES_ML = [
  {
    id: "question", num: "I", nom: "La question",
    notebooks: ["01_cadrage_eda_variables"], docs: ["rapport"],
    titre: "Acheter, rester neutre ou vendre",
    oeuvre: "Le vase des 201 mois",
    legende: "Son profil suit la clôture mensuelle du Nikkei, de février 2010 (au pied) à octobre 2026 (au col). Deux sillons marquent le début de la validation et celui du test.",
    clair: "Chaque fin de mois, un investisseur en euros se demande quoi faire du Nikkei 225 le mois suivant : acheter, rester neutre ou vendre et, s'il achète, se couvrir ou non contre le yen. Un modèle estime la probabilité que l'indice monte, puis une règle en tire l'action.",
    technique: `La cible vaut 1 si le Nikkei, en yens, monte le mois suivant. Le découpage suit le temps : entraînement de 2010 à 2021 (${CHIFFRES.moisEntrainement} mois), validation 2022-2023 (${CHIFFRES.moisValidation} mois), test 2024-2026 (${CHIFFRES.moisTest} mois), ouvert une seule fois. La métrique principale est la log-loss, comparée à une prévision constante qui annonce toujours la fréquence des hausses de l'entraînement.`,
    chiffres: [
      [nombre(CHIFFRES.moisTotal), "mois, de 2010 à 2026"],
      [`${CHIFFRES.moisEntrainement} · ${CHIFFRES.moisValidation} · ${CHIFFRES.moisTest}`, "entraînement · validation · test"],
      [pct(CHIFFRES.baissesTest / CHIFFRES.moisTest, 0), "de mois en baisse sur le test"],
    ],
    ton: { mur: "#2f3a3a", sol: "#b9b1a5", ciel: "#dfe6e4", texte: "#f3efe8", accent: "#9fb5ae" },
  },
  {
    id: "donnees", num: "II", nom: "Les données",
    notebooks: ["01_cadrage_eda_variables"], docs: [],
    titre: "Ce qu'on savait vraiment à la fin du mois",
    oeuvre: "La pile des mois",
    legende: "Un disque par mois. Chacun est décalé selon le rendement du mois : la pile se tord dans les mois agités. Les disques foncés sont les mois de baisse.",
    clair: "Prix, taux, change, conjoncture japonaise et news : des articles GDELT dont la tonalité est notée par FinBERT. Une variable n'entre dans le modèle qu'à la date où elle était réellement publiée, et un audit écrit en code vérifie qu'aucune ligne n'utilise d'information venue après.",
    technique: "Dix variables, plus un régime de marché appris par k-means dans la pipeline. News : volume anormal d'articles sur six mois, tonalité pondérée, disponibilité. Prix : momentum à 12 et 3 mois, volatilité lissée. Macro : variation du taux japonais à 10 ans, Tankan des grandes entreprises (celui de décembre est daté de janvier, par prudence). Change : portage à un mois et volatilité de l'euro-yen. Le décalage de publication de chaque colonne est écrit dans le dictionnaire des variables ; l'audit contrôle les valeurs, pas seulement les noms de colonnes.",
    chiffres: [
      ["10 + 1", "variables, plus un régime k-means"],
      ["5", "familles : news, prix, taux, conjoncture, change"],
      [moisLong(D.serie.find((m) => m.news).mois).replace(/^\w/, (c) => c.toUpperCase()), "premier mois avec des news"],
    ],
    ton: { mur: "#cbb796", sol: "#a8957a", ciel: "#fbf4e8", texte: "#fffaf2", accent: "#7d6a4f" },
  },
  {
    id: "apprentissage", num: "III", nom: "L'apprentissage",
    notebooks: ["02_pipeline_modeles_optuna"], docs: [],
    titre: "Trois modèles, deux cents essais",
    oeuvre: "Le champ des essais",
    legende: "Une tige par essai Optuna, en trois rangées : logistique, forêt aléatoire, LightGBM. Plus la tige est haute, plus la log-loss de validation croisée est basse. La tige teintée est l'essai retenu.",
    clair: "Une régression logistique, une forêt aléatoire et un LightGBM, réglés par Optuna sur des plis qui respectent l'ordre du temps. La logistique, la plus simple, est retenue. L'annexe de maths la refait à la main, de la vraisemblance jusqu'à la descente de gradient.",
    technique: `Pipeline scikit-learn : imputation, standardisation, régime k-means, modèle. ${CHIFFRES.essais} essais Optuna sur la cible principale (50 par modèle), avec un découpage TimeSeriesSplit ; la logistique retenue obtient ${dec(CHIFFRES.llCV)} de log-loss en validation croisée. Calibration de Platt sur les prédictions hors pli. Annexe : gradient (1/m)·Xᵀ(p − y), hessienne, convexité stricte, et une descente qui converge pour un pas α < 2/L.`,
    chiffres: [
      ["3", "modèles comparés"],
      [nombre(CHIFFRES.essais), "essais Optuna"],
      [dec(CHIFFRES.llCV), "log-loss de la logistique en validation croisée"],
    ],
    ton: { mur: "#a26a52", sol: "#8c6b5c", ciel: "#fae9de", texte: "#fff5ee", accent: "#f0c7b0" },
  },
  {
    id: "regle", num: "IV", nom: "La règle",
    notebooks: ["03_calibration_seuils"], docs: [],
    titre: "D'une probabilité à une action",
    oeuvre: "Le cadran",
    legende: "Le cadran va de 0 à 100 % de probabilité de hausse. À gauche la zone « vendre », au centre « neutre », à droite « acheter ». Le style pointe la prévision pour " + moisLong(moisSuivant(CHIFFRES.moisDernier)) + ".",
    clair: `Le modèle donne une probabilité de hausse. La règle compare le gain espéré d'un achat et d'une vente à une marge de ${pct(CHIFFRES.marge, 1)} : au-dessus de ${pct(CHIFFRES.thetaA, 0)}, acheter ; sous ${pct(CHIFFRES.thetaV, 0)}, vendre ; entre les deux, rester neutre. Les seuils ont été figés et commités avant d'ouvrir le test.`,
    technique: `Les gains moyens viennent de l'entraînement : un achat rapporte ${pct(D.decision.couts.B_u, 1, true)} un mois de hausse et ${pct(D.decision.couts.B_d, 1, true)} un mois de baisse ; une vente fait l'inverse. Acheter si p·B_u + (1 − p)·B_d dépasse la marge, vendre si p·S_u + (1 − p)·S_d la dépasse. D'où les seuils θ_achat = ${dec(CHIFFRES.thetaA)} et θ_vente = ${dec(CHIFFRES.thetaV)}. Calibration de Platt : a = ${dec(D.decision.platt.a)}, c = ${dec(D.decision.platt.c)}. Couverture : toujours couvert. Décision figée au commit 75712cf. Sans signal, la même règle appliquée à la prévision constante achète tous les mois.`,
    chiffres: [
      [pct(CHIFFRES.thetaA, 1), "seuil d'achat"],
      [pct(CHIFFRES.thetaV, 1), "seuil de vente"],
      [pct(CHIFFRES.marge, 1), "marge exigée"],
    ],
    ton: { mur: "#8d9883", sol: "#7a7f70", ciel: "#f1f3e9", texte: "#fbfcf6", accent: "#e3e8d5" },
  },
  {
    id: "epreuve", num: "V", nom: "L'épreuve",
    notebooks: ["03b_test_final", "04_explicabilite_diagnostics"], docs: ["rapport"],
    titre: `${CHIFFRES.moisTest} mois, une seule fois`,
    oeuvre: "Le cercle des mois de test",
    legende: "Une pierre par mois de test, de janvier 2024 à septembre 2026. Sa hauteur suit l'ampleur du mois ; claire s'il a monté, sombre s'il a baissé. La pastille au pied montre l'action du modèle : verte pour acheter, rouge brique pour vendre.",
    clair: `Sur 2024-2026, le modèle ne fait pas mieux que la prévision constante : ${dec(CHIFFRES.llModele)} de log-loss contre ${dec(CHIFFRES.llConstante)}. Sur ${CHIFFRES.moisTest} mois, l'écart ne permet de conclure ni dans un sens ni dans l'autre. Comme prévu avant le test, la recommandation retombe sur « toujours acheter, couvert ».`,
    technique: `Écart moyen de log-loss, mois par mois : ${dec(ECART_TEST.moyenne, 3)} pour une erreur type de ${dec(ECART_TEST.erreurType, 3)}. Les cibles mensuelles ne se chevauchent pas, l'erreur type simple suffit. La règle du modèle finit à ${pct(CHIFFRES.regle, 1, true)} ; acheter et garder couvert, à ${pct(CHIFFRES.couvert, 1, true)}. Ce second chiffre décrit le marché de 2024-2026 plus qu'un savoir-faire : sans signal, la règle n'a rien à ajouter au marché. Les indices sont des indices de prix, sans dividendes, et aucun frais n'est compté.`,
    chiffres: [
      [`${dec(CHIFFRES.llModele)} / ${dec(CHIFFRES.llConstante)}`, "log-loss : modèle / constante"],
      [pct(CHIFFRES.regle, 1, true), "règle du modèle, en euros"],
      [pct(CHIFFRES.couvert, 1, true), "acheter et garder, couvert"],
    ],
    ton: { mur: "#262a35", sol: "#545660", ciel: "#d4d9e6", texte: "#eef0f6", accent: "#a9b3cb" },
  },
  {
    id: "agitation", num: "VI", nom: "L'agitation",
    notebooks: [], docs: ["rapport"],
    titre: "Le sens ne se prévoit pas. L'agitation, un peu.",
    oeuvre: "Le souffle",
    legende: "Une spirale de 2016 (en bas) à 2026 (en haut), dont l'épaisseur suit la volatilité réalisée de chaque mois. Les parties teintées sont les mois agités, au-dessus de 20 % de volatilité annuelle.",
    clair: "Après le test, un second volet a cherché à prévoir l'agitation du mois suivant plutôt que son sens. Elle se prévoit en partie : un mois agité se reconnaît bien mieux qu'un mois de hausse. Mais réduire la position quand le risque monte n'a pas fait mieux qu'acheter et garder, une fois sorti des années de réglage.",
    technique: `Exploration faite après l'ouverture du test, hors résultat officiel. Volatilité du mois suivant : R² hors échantillon de ${dec(RISQUE.r2Avant, 2)} sur 2016-2023 et de ${dec(RISQUE.r2Test, 2)} sur 2024-2026 en mensuel ; en journalier, sur 2024-2026, il tombe à ${dec(RISQUE.r2JourTest, 2)}. Mois agité : AUC de ${dec(RISQUE.aucAgite, 2)} sur 2016-2023, contre 0,50 pour le sens du marché. Le signal d'achat fondé sur le risque, réglé sur 2000-2015, donne un rendement par unité de risque de ${dec(RISQUE.ratio("2016-2023").signal, 2)} contre ${dec(RISQUE.ratio("2016-2023").garder, 2)} pour acheter et garder sur 2016-2023, et ${dec(RISQUE.ratio("2024-2026").signal, 2)} contre ${dec(RISQUE.ratio("2024-2026").garder, 2)} sur 2024-2026.`,
    chiffres: [
      [dec(RISQUE.r2Avant, 2), "R² de la volatilité, 2016-2023"],
      [dec(RISQUE.aucAgite, 2), "AUC pour un mois agité"],
      [`${dec(RISQUE.ratio("2016-2023").signal, 2)} / ${dec(RISQUE.ratio("2016-2023").garder, 2)}`, "rendement par unité de risque : signal / acheter et garder"],
    ],
    ton: { mur: "#95a3ac", sol: "#7c858b", ciel: "#f2f6f8", texte: "#fbfdfe", accent: "#e1e8ec" },
  },
  {
    id: "cabinet", num: "VII", nom: "Le cabinet",
    notebooks: ["01_cadrage_eda_variables", "02_pipeline_modeles_optuna", "03_calibration_seuils", "03b_test_final", "04_explicabilite_diagnostics", "05_annexe_maths_logistique"], docs: ["rapport", "annexe"],
    titre: "Toutes les pièces du projet",
    oeuvre: "Les volumes",
    legende: "Six cahiers pour les six notebooks, deux volumes pour le rapport et l'annexe de maths.",
    clair: "Les six notebooks, le rapport, l'annexe de maths et les figures, à ouvrir tels quels. Tout ce que montrent la visite et la lecture en vient.",
    technique: "Le code est en modules Python (src/), testé, et chaque résultat figé se revérifie : python -m src.decision --verifier et python -m src.evaluate --verifier recalculent la décision et l'évaluation du test et les comparent aux fichiers commités.",
    chiffres: [
      ["6", "notebooks"],
      [nombre(D.figures.length), "figures"],
      ["2", "documents PDF"],
    ],
    ton: { mur: "#55443a", sol: "#6f5d50", ciel: "#f6ebe0", texte: "#fbf4ec", accent: "#d9c2ab" },
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
    id: "m-modele", num: "I", nom: "Le modèle",
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
    id: "m-cout", num: "II", nom: "Le coût",
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
    id: "m-gradient", num: "III", nom: "Le gradient",
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
    id: "m-prior", num: "IV", nom: "Le prior",
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
    id: "m-convexite", num: "V", nom: "La convexité",
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
    id: "m-descente", num: "VI", nom: "La descente",
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
    id: "m-preuve", num: "VII", nom: "La preuve",
    notebooks: ["03b_test_final", "05_annexe_maths_logistique"], docs: ["annexe", "rapport"],
    titre: `Ce que ${CHIFFRES.moisTest} mois peuvent prouver`,
    oeuvre: "Les deux colonnes",
    legende: `À gauche, une pile de ${CHIFFRES.moisTest} disques : les mois de test. À droite, la hauteur qu'il faudrait atteindre, environ ${nombre(Math.round(MATHS.moisPourPreuve / 10) * 10)} mois, pour qu'un gain de 0,02 de log-loss dépasse deux erreurs types.`,
    clair: `Un écart entre deux modèles ne veut rien dire sans sa marge d'erreur. Sur ${CHIFFRES.moisTest} mois, l'écart de log-loss entre le modèle et la constante vaut à peine une erreur type : on ne peut conclure ni dans un sens ni dans l'autre. Pour prouver un gain réaliste, il faudrait des centaines de mois.`,
    technique: `Écart moyen, mois par mois : ${f(`d̄ = ${dec(ECART_TEST.moyenne, 3)}`)}, écart-type ${dec(ECART_TEST.ecartType, 3)}, erreur type ${f(`s/√n = ${dec(ECART_TEST.erreurType, 3)}`)}. Les cibles mensuelles ne se chevauchent pas : l'erreur type simple suffit, et Newey-West donne presque la même. Pour qu'un gain de 0,02 dépasse deux erreurs types, il faut ${f("n ≥ (2s / 0,02)²")} ≈ ${nombre(MATHS.moisPourPreuve)} mois. Même verdict en régression : sur le rendement lui-même, les équations normales résolues à la main donnent R² = 0,12 sur l'entraînement, mais −1,77 sur la validation.`,
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
  ["Le second volet est venu après le test.", "La volatilité et le signal fondé sur le risque ont été explorés après l'ouverture de 2024-2026 : ce sont des pistes, pas des résultats confirmés."],
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
};
const nomNotebook = (nom) => `Notebook ${nom.split("_")[0]}`;

return { D, nombre, pct, dec, moisLong, moisSuivant, ECART_TEST, CHIFFRES, RISQUE, MATHS, COURS, SALLES, TOUTES_SALLES, avecCours, COURS_INFO, ENTREE, LIMITES, FIGURES, nomNotebook };
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
  const nbs = salle.notebooks.map((n) => `<li><button type="button" class="piece-lien" data-nb="${n}"><span class="sur-titre">${nomNotebook(n)}</span><span class="t">${titreNotebook(n)}</span>${FLECHE}</button></li>`);
  const docs = salle.docs.map((d) => `<li><a class="piece-lien" href="${DOCS[d][1]}" target="_blank" rel="noopener"><span class="sur-titre">PDF</span><span class="t">${DOCS[d][0]}</span>${FLECHE}</a></li>`);
  if (!nbs.length && !docs.length) return "";
  return `<ul class="pieces-salle">${nbs.join("")}${docs.join("")}</ul>`;
}

// Une liseuse plein écran pour lire un notebook sans perdre sa place (salle de la visite, chapitre de la lecture)
function installerLiseuse() {
  const l = document.createElement("div");
  l.className = "liseuse-flottante";
  l.hidden = true;
  l.setAttribute("role", "dialog");
  l.setAttribute("aria-modal", "true");
  l.setAttribute("aria-label", "Notebook");
  l.innerHTML = `<div class="liseuse-barre"><p class="liseuse-titre"></p><a class="liseuse-cabinet" href="#">Ouvrir dans le cabinet ${FLECHE}</a><button type="button" class="liseuse-fermer">Fermer</button></div>
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
    charge.style.opacity = 1;
    if (!cadre.src.endsWith(`nb/${nom}.html`)) cadre.src = `nb/${nom}.html`; else charge.style.opacity = 0;
    l.hidden = false;
    document.body.classList.add("liseuse-ouverte");
    l.querySelector(".liseuse-fermer").focus();
  });
  return { estOuverte: () => !l.hidden };
}

return { FLECHE, FLECHE_G, stocker, lire, titreNotebook, installerEntete, installerMenu, liensPieces, installerLiseuse };
})();
const __cabinet = (() => {
"use strict";
// Le cabinet : la liste des notebooks et la liseuse, sur une page à part.
const { installerMenu, installerEntete, FLECHE } = __commun;
const { COURS } = __contenu;
// le parcours Maths met l'annexe en tête
const nbs = COURS === "maths"
  ? [...window.NIKKEI.notebooks].sort((a, b) => (b.nom.startsWith("05") ? 1 : 0) - (a.nom.startsWith("05") ? 1 : 0))
  : window.NIKKEI.notebooks;
const liste = document.getElementById("liste"), choix = document.getElementById("choix"), cadre = document.getElementById("cadre"), charge = document.getElementById("charge");
liste.innerHTML = nbs.map((n) => `<li><a href="?nb=${n.nom}&cours=${COURS}" data-nb="${n.nom}"><span class="n">${n.nom.split("_")[0]}</span><span class="t">${n.titre}</span></a></li>`).join("");
choix.innerHTML = nbs.map((n) => `<option value="${n.nom}">${n.nom.split("_")[0]} · ${n.titre}</option>`).join("");
document.getElementById("docs").innerHTML = `<a href="docs/rapport.pdf"><span class="t">Le rapport, en PDF</span>${FLECHE}</a><a href="docs/annexe_maths.pdf"><span class="t">L'annexe de maths, en PDF</span>${FLECHE}</a>`;

function ouvrir(nom, pousser) {
  if (!nbs.some((n) => n.nom === nom)) nom = nbs[0].nom;
  charge.style.opacity = 1;
  cadre.src = `nb/${nom}.html`;
  choix.value = nom;
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
