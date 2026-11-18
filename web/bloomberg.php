<?php
/**
 * Captures Bloomberg (/bloomberg) : huit écrans du 18 novembre 2026, non utilisés par le modèle.
 * Chacune est commentée : ce qu'elle montre, ce qu'elle confirme ou contredit dans le projet.
 * Les images sont dans data/bloomberg/ (servies par router.php sous /bloomberg/) ; le détail est dans
 * data/bloomberg/README.md.
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$titre = 'Captures Bloomberg · Projet Nikkei';
$page = 'bloomberg';
$theme = 'encre';

// [fichier, écran, titre, ce qu'on y voit, ce qu'on en tire pour le projet]
$captures = [
    ['05_nky_earnings_yield_vs_ust10y_10ans_g1037.png', 'G1037 · 10 ans', "Le Nikkei rapporte moins qu'une obligation américaine",
     "Earnings yield LTM du Nikkei (blanc) contre UST 10 ans (bleu), et leur écart en bas. L'écart vaut −0,38 pour une moyenne de 1,81 sur dix ans.",
     "L'écart passe sous zéro en 2022, l'année où, selon le rapport, les variables de taux sortent de leur domaine d'entraînement. On voit ici la rupture de régime de l'extérieur."],
    ['06_nky_earnings_yield_vs_ust10y_1999_g1037.png', 'G1037 · depuis 1999', 'Un écart négatif rare',
     "Même écart sur 27 ans : moyenne 1,65, aujourd'hui −0,50. Il n'avait été négatif que par épisodes : 2004-2007, 2009, puis 2022-2023.",
     "Le modèle a été entraîné de 2010 à 2021, une période où l'écart était toujours positif. Il n'a donc jamais vu le régime actuel."],
    ['03_nky_decomposition_rendement_g1032.png', 'G1032', 'La hausse vient des bénéfices',
     "Depuis 2005 : cours +342 %, BPA attendu à 12 mois +422 %, PER +3,6 %. L'aire bleue (bénéfices) explique presque toute la courbe blanche (cours).",
     "Une partie de ce que le modèle lit comme du momentum (n225_mom_12m) est en fait de la croissance des bénéfices, qu'aucune variable du dataset ne mesure."],
    ['04_nky_revisions_estimations_g1036.png', 'G1036', 'La plus forte révision en baisse depuis 2023',
     "BPA attendu FY1, FY2, FY3 (en haut) et chiffre d'affaires (en bas). Le BPA FY1 est révisé d'environ 3 090 à 2 930 en novembre 2026 ; FY2 et FY3 continuent de monter.",
     "Le modèle penchait vers la baisse pour novembre, et nous ne l'avons pas suivi. Le Nikkei a pris −5,7 % entre le 30 octobre et le 18 novembre. Le mois n'est pas fini : ce n'est pas une validation, mais un signal à surveiller."],
    ['08_nky_worm_chart_bpa_5ans_g1235.png', 'G1235 · 5 ans', 'Les estimations annuelles, année par année',
     "Chaque couleur suit l'estimation d'une année fiscale (2022 à 2028), la ligne blanche le BPA attendu à 12 mois. L'estimation 2026 (cyan) décroche à 2 912.",
     "C'est la même révision que sur G1036, vue sur l'année fiscale en cours. Une variable de révision (eps_fy1_rev_3m) l'aurait captée."],
    ['07_nky_worm_chart_bpa_2005_g1235.png', 'G1235 · depuis 2005', 'Vingt ans de BPA',
     "BPA attendu à 12 mois depuis 2005 : chute de 2008-2009, creux de 2020, puis accélération depuis 2023 jusqu'à 3 340.",
     "Le BPA attendu est passé de 1 000 à 3 300 environ en dix ans. Le niveau des bénéfices change d'échelle, ce qui plaide pour des variables en taux (révision, croissance) plutôt qu'en niveau."],
    ['02_nky_fondamentaux_gf.png', 'GF', 'Les fondamentaux réunis',
     "Revenus, BPA, earnings yield (4,75 %), PER LTM (21,9) et PER attendu (17,9), rendement du dividende (1,65 %), de 2004 à 2028 (estimations en pointillés).",
     "Aucune de ces séries ne figure dans le dataset. Ce sont les candidates naturelles pour une version 3 du modèle."],
    ['01_jncpiyoy_cpi_japon.png', 'JNCPIYOY', 'CPI Japon : une vérification à faire',
     "CPI national en glissement annuel : 2,1 % en septembre 2026, publié en octobre ; le chiffre d'octobre paraîtra le 20 novembre.",
     "Le dataset donne 1,96 (ligne de septembre) et 2,23 (ligne d'octobre), et le dictionnaire n'indique aucun décalage de publication. Le CPI ne fait pas partie des 11 variables du modèle, mais il faut corriger le dictionnaire."],
];

$variables = [
    ['ey_ltm', 'Earnings yield sur 12 mois glissants'],
    ['ey_minus_us10y', 'Écart avec le taux à 10 ans (US ou JGB)'],
    ['pe_fwd_12m', 'PER sur le BPA attendu à 12 mois'],
    ['eps_fy1_rev_3m', 'Révision du BPA FY1 sur 3 mois'],
    ['eps_fwd_growth', 'Croissance attendue, FY2 / FY1 − 1'],
];

require __DIR__ . '/inc/entete.php';
?>
<main class="page">
<section id="bloomberg">
  <p class="surtitre">Sources externes</p>
  <h2>Ce que Bloomberg dit du projet</h2>
  <p class="chapo">Huit écrans Bloomberg du 18 novembre 2026 (NKY à 59 662). Le modèle ne les utilise pas : ils servent
    à vérifier nos conclusions avec une source indépendante, et à repérer les variables qui lui manquent.</p>

<?php foreach ($captures as [$fichier, $ecran, $titre_capture, $lecture, $apport]): ?>
  <div class="grille g2 capture">
    <figure class="figure">
      <a href="/bloomberg/<?= e($fichier) ?>" target="_blank"><img src="/bloomberg/<?= e($fichier) ?>" alt="<?= e($ecran . ' : ' . $titre_capture) ?>" loading="lazy"></a>
      <figcaption>Bloomberg, écran <?= e($ecran) ?>. Cliquer pour agrandir.</figcaption>
    </figure>
    <div class="carte">
      <p class="surtitre"><?= e($ecran) ?></p>
      <h3><?= e($titre_capture) ?></h3>
      <p><?= e($lecture) ?></p>
      <p><b>Pour le projet.</b> <?= e($apport) ?></p>
    </div>
  </div>
<?php endforeach; ?>

  <div class="carte" style="margin-top:18px">
    <h3>Variables proposées (piste non testée)</h3>
    <ul class="points">
<?php foreach ($variables as [$nom, $definition]): ?>
      <li><b><code><?= e($nom) ?></code></b> : <?= e($definition) ?>.</li>
<?php endforeach; ?>
    </ul>
    <p class="note">Il faudrait des estimations point-in-time (BEst), prises à la clôture du mois et auditées comme
      les autres colonnes. On ne pourra les juger que sur des mois postérieurs à septembre 2026, puisque le test a déjà
      servi. Les séries brutes de Bloomberg ne peuvent pas être republiées.</p>
  </div>

  <div class="conclusion"><b>Ce qu'on en retient.</b> Le Nikkei est de nouveau cher par rapport aux taux
    américains, comme en 2022-2023 et jamais entre 2010 et 2021. Sa hausse est portée par les bénéfices, et ces bénéfices viennent d'être révisés en
    baisse. Le modèle ne voit aucun de ces trois faits. Le détail est dans <code>data/bloomberg/README.md</code>.</div>
</section>
</main>
<style>
  .capture { margin-top: 18px; align-items: start; }
  .capture img { width: 100%; height: auto; display: block; border-radius: 6px; }
  .capture .carte p { line-height: 1.5; }
  @media (max-width: 800px) { .capture.g2 { grid-template-columns: 1fr; } }
</style>
<?php require __DIR__ . '/inc/pied.php'; ?>
