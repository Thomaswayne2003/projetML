// Contenu commun aux deux modes : les sept salles de la visite sont les sept chapitres de la lecture.
// Les chiffres sont lus dans window.NIKKEI (écrit par python -m app.export_site), jamais recopiés à la main.

export const D = window.NIKKEI;

// ---------- formats français ----------
const nf = (d) => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
export const nombre = (x, d = 0) => nf(d).format(x);
export const pct = (x, d = 1, signe = false) =>
  (signe && x > 0 ? "+" : x < 0 ? "−" : "") + nf(d).format(Math.abs(x * 100)) + " %";
export const dec = (x, d = 3) => (x < 0 ? "−" : "") + nf(d).format(Math.abs(x));
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export const moisLong = (am) => { const [a, m] = am.split("-").map(Number); return `${MOIS[m - 1]} ${a}`; };
export const moisSuivant = (am) => { let [a, m] = am.split("-").map(Number); m += 1; if (m > 12) { m = 1; a += 1; } return `${a}-${String(m).padStart(2, "0")}`; };

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
  return { moyenne: moy, erreurType: sd / Math.sqrt(n), n };
}
export const ECART_TEST = ecartLogLoss(D.historique_test);

export const CHIFFRES = {
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
export const RISQUE = {
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
export const SALLES = [
  {
    id: "question", num: "I", nom: "La question",
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
    titre: "Trois modèles, deux cents essais",
    oeuvre: "Le paysage du coût",
    legende: "La surface de log-loss d'une régression logistique sur deux variables. La bille suit la descente de gradient, du point de départ jusqu'au minimum.",
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

export const ENTREE = {
  titre: "Le Nikkei, mois après mois",
  devise: "Peut-on savoir, à la fin d'un mois, s'il faut acheter le Nikkei le mois suivant ?",
  ecole: "Applied ML · Mathematics & Statistics for ML — Albert School, MSc 1, automne 2026",
};

export const LIMITES = [
  ["Le test n'était pas entièrement invisible.", "Le notebook 01 affichait déjà des statistiques de 2024-2026, dont la courbe « achat couvert ou non ». La couverture permanente n'a donc pas été choisie à l'aveugle ; sur 2010-2021, ne pas couvrir faisait même un peu mieux."],
  ["Les variables ont été choisies sur 2017-2026.", "L'analyse exploratoire qui a guidé le choix des variables recouvre la validation et le test."],
  ["Les écarts sont petits devant le bruit.", `Sur ${CHIFFRES.moisTest} mois, l'écart de log-loss entre le modèle et la constante (${dec(ECART_TEST.moyenne, 3)} ± ${dec(ECART_TEST.erreurType, 3)}) ne tranche dans aucun sens. Il faudrait des centaines de mois pour voir un gain réaliste.`],
  ["Les rendements sont simplifiés.", "Indice de prix sans dividendes (environ 2 % par an), pas de frais, couverture approchée par l'écart des taux à court terme."],
  ["Le second volet est venu après le test.", "La volatilité et le signal fondé sur le risque ont été explorés après l'ouverture de 2024-2026 : ce sont des pistes, pas des résultats confirmés."],
];
