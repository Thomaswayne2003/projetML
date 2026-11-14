<?php
/**
 * Page d'accueil : présentation complète du projet.
 * Les chiffres figés viennent de runs/evaluation_test.json ; le signal du mois vient de l'API Python.
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$theme = $theme ?? 'industriel';       // 'encre' pour la version /recit
$signal = api_get('signal');                 // null si l'API Python est arrêtée
$mois = api_get('mois') ?? [];
$eval = lire_runs('evaluation_test.json');
$metriques = $eval['metriques'] ?? [];
$perf = $eval['performance_euros'] ?? [];
$modele = $metriques['logistique'] ?? ['log-loss' => 0.0, 'Brier' => 0.0, 'ECE' => 0.0, 'PR-AUC' => 0.0];
$constante = $metriques["constante (fréquence de l'entraînement)"] ?? $modele;
$regle = $perf['règle du modèle']['cumul'] ?? 0.0;
$achat_couvert = $perf['toujours acheter, couvert']['cumul'] ?? 0.0;
// Le fichier figé arrondit les cumuls à 4 décimales (0,8235 s'afficherait +82,4 %) : on les recalcule mois par mois quand l'API répond.
if ($mois_test = api_get('historique', ['bloc' => 'test'])) {
    $achat_couvert = array_product(array_map(fn ($m) => 1 + $m['rendement_achat_couvert'], $mois_test)) - 1;
    $regle = array_product(array_map(fn ($m) => 1 + $m['rendement_regle'], $mois_test)) - 1;
}

$titre = 'Projet Nikkei · acheter, rester neutre ou vendre ?';
$page = 'accueil';
require __DIR__ . '/inc/entete.php';
?>
<!-- ============ En-tête, avec la scène 3D ============ -->
<?php if ($theme === 'encre'): ?>
<header class="hero3d affiche" id="haut" data-chapitre="haut" data-court="Ouverture">
  <div class="soleil-recit" aria-hidden="true"></div>
  <span class="signe-recit" aria-hidden="true">日経</span>
  <div class="page affiche-in">
    <div class="affiche-texte">
      <p class="surtitre"><span class="sceau">序</span>Albert School · MSc 1 · Applied ML &amp; Maths for ML</p>
      <h1>Acheter, rester neutre ou vendre le <em>Nikkei&nbsp;225</em>&nbsp;?</h1>
      <p class="chapo">Chaque fin de mois, un modèle estime la probabilité que l'indice japonais monte le mois suivant,
        à partir des news et des marchés. Une règle en tire l'action d'un investisseur en euros, et dit s'il faut
        couvrir le yen.</p>
      <dl class="reponse">
        <div class="large"><dt>La réponse du projet</dt><dd>Toujours acheter, couvert contre le yen.</dd>
          <p>Le modèle n'a pas battu le modèle constant sur le test. Nous tenons l'engagement écrit avant de le regarder.</p></div>
        <div><dt>Le modèle, sur le test</dt><dd><?= decimal($modele['log-loss']) ?> <small>contre <?= decimal($constante['log-loss']) ?></small></dd>
          <p>log-loss du modèle, contre celle du modèle constant. Plus bas est meilleur.</p></div>
        <div><dt>En euros, 2024-2026</dt><dd><?= signe(100 * $achat_couvert, 1, '&nbsp;%') ?> <small>contre <?= signe(100 * $regle, 1, '&nbsp;%') ?></small></dd>
          <p>« toujours acheter, couvert », contre la règle du modèle.</p></div>
      </dl>
      <div class="boutons">
        <a class="btn plein" href="#resultat">Lire le récit ↓</a>
        <a class="btn contour" href="#explorateur">Essayer le prédicteur</a>
      </div>
    </div>
  </div>
</header>
<?php else: ?>
<header class="hero3d" id="haut">
  <canvas id="scene-hero" aria-hidden="true"></canvas>
  <div class="hud" aria-hidden="true">
    <span class="hud-hg">NIKKEI 225 // 2010 → 2026</span>
    <span class="hud-hd" id="hud-mois">—</span>
    <span class="hud-bg">201 MOIS · 12 VARIABLES · 1 MODÈLE</span>
    <span class="hud-bd">FAIRE DÉFILER ↓</span>
  </div>
  <div class="page hero">
    <div>
      <p class="surtitre">Albert School · MSc 1 · Applied ML &amp; Maths for ML</p>
      <h1>Acheter, rester neutre ou vendre le <em>Nikkei&nbsp;225</em>&nbsp;?</h1>
      <p class="chapo">Chaque fin de mois, un modèle estime la probabilité que l'indice japonais monte le mois suivant,
        à partir des news et des marchés. Une règle en tire l'action d'un investisseur en euros, et dit s'il faut
        couvrir le yen.</p>
      <div class="puces">
        <span class="puce"><b>200 mois</b> · 2010 → 2026</span>
        <span class="puce"><b>13 700 articles</b> notés par FinBERT</span>
        <span class="puce"><b>3 modèles</b> · 200 essais Optuna</span>
        <span class="puce"><b>1 seule</b> évaluation sur le test</span>
      </div>
      <div class="boutons">
        <a class="btn plein" href="#explorateur">Explorer le signal</a>
        <a class="btn contour" href="/notebooks">Ouvrir les notebooks</a>
        <a class="btn contour" href="/rapport.pdf" target="_blank">Rapport PDF</a>
      </div>
    </div>

    <div class="carte signal verre relief">
      <div class="entete">
        <span class="etiquette">Signal du modèle</span>
        <span class="mois"><?= $signal ? 'données de fin ' . e(mois_lisible($signal['mois_des_donnees'])) : 'API arrêtée' ?></span>
      </div>
<?php if ($signal): ?>
      <div class="proba"><?= pct($signal['p_hausse']) ?><small>de probabilité de hausse</small></div>
      <div class="jauge" data-jauge data-p="<?= e($signal['p_hausse']) ?>" data-tv="<?= e($signal['seuils']['theta_v']) ?>" data-ta="<?= e($signal['seuils']['theta_a']) ?>"></div>
      <div class="duo">
        <div class="mini"><span>Score S = 2p − 1</span><b><?= signe($signal['score']) ?></b></div>
        <div class="mini"><span>Action de la règle</span><b><span class="badge <?= e($signal['action_du_modele']) ?>"><?= e($signal['action_du_modele']) ?></span></b></div>
      </div>
<?php else: ?>
      <p class="alerte" style="margin-top:14px">L'API Python ne répond pas. Lancez-la depuis la racine du projet :<br>
        <code>uvicorn app.api:app --port 8000</code></p>
<?php endif; ?>
      <div class="verdict"><b>Recommandation finale : toujours acheter, couvert.</b><br>
        Sur le test, le modèle n'a pas battu le modèle constant : sa règle est montrée à titre d'analyse.</div>
    </div>
  </div>
  <p class="page legende-3d">Relief : Nikkei 225, 2010 → 2026, échelle log ·
    <i style="background:#5b8cff"></i>entraînement <i style="background:#ffb347"></i>validation <i style="background:#b4ff1a"></i>test</p>
</header>
<?php endif; ?>

<div class="progression" id="progression"></div>
<main class="page">
<!-- ============ Résultat ============ -->
<section id="resultat">
  <p class="surtitre">Le résultat, sans détour</p>
  <h2>Un résultat négatif, obtenu proprement</h2>
  <p class="chapo">Le modèle classe un peu mieux que le hasard les mois à risque, mais ses probabilités sont trop
    pessimistes. Comme nous nous y étions engagés avant de regarder le test, nous recommandons la stratégie de
    référence.</p>
  <div class="grille g4">
    <div class="carte kpi rouge relief"><b data-compte="<?= e($modele['log-loss']) ?>" data-decimales="3"><?= decimal($modele['log-loss']) ?></b><span>log-loss du modèle sur le test</span><div class="contre">contre <?= decimal($constante['log-loss']) ?> pour le modèle constant</div></div>
    <div class="carte kpi relief"><b data-compte="<?= e($modele['PR-AUC']) ?>" data-decimales="3"><?= decimal($modele['PR-AUC']) ?></b><span>PR-AUC de la classe « baisse »</span><div class="contre">contre <?= decimal($constante['PR-AUC']) ?> pour le hasard</div></div>
    <div class="carte kpi relief"><b>11 / 12</b><span>baisses évitées par la règle</span><div class="contre">mais 18 hausses manquées</div></div>
    <div class="carte kpi vert relief"><b data-compte="<?= e(100 * $achat_couvert) ?>" data-decimales="1" data-prefixe="+" data-suffixe=" %"><?= signe(100 * $achat_couvert, 1, '&nbsp;%') ?></b><span>« toujours acheter, couvert » en euros</span><div class="contre">contre <?= signe(100 * $regle, 1, ' %') ?> pour la règle du modèle</div></div>
  </div>
</section>
<!-- ============ Prédicteur ============ -->
<section id="explorateur">
  <p class="surtitre">Prédicteur · en direct depuis le modèle</p>
  <h2>Changez l'information, le modèle répond</h2>
  <p class="chapo">Partez d'un mois réel, puis déplacez les curseurs : volume de news, sentiment, momentum, taux.
    Le site interroge l'API, qui recalcule la probabilité de hausse, l'action et la contribution de chaque variable.</p>
  <div class="grille labo">
    <div class="carte">
      <div class="reglage">
        <label for="choix-mois">Mois de départ</label>
        <select id="choix-mois" style="width:100%">
<?php foreach ($mois as $m): ?>
          <option value="<?= e($m['mois']) ?>"><?= e(mois_lisible($m['mois'])) ?> · <?= e($m['bloc']) ?></option>
<?php endforeach; ?>
        </select>
      </div>
      <div id="curseurs"></div>
      <button class="btn contour" id="pred-reinit" type="button">Revenir aux vraies valeurs du mois</button>
    </div>
    <div class="carte signal">
      <div class="entete"><span class="etiquette">Prédiction du modèle</span><span class="mois" id="exp-bloc"></span></div>
      <div class="grand-resultat">
        <span class="proba" id="exp-proba">–</span>
        <div><div class="note">de probabilité de hausse le mois suivant · score <b id="exp-score">–</b></div>
          <div id="exp-action" style="margin-top:8px"></div></div>
      </div>
      <div class="jauge" id="exp-jauge"></div>
      <p class="note" id="exp-suite"></p>
      <h3 style="margin-top:18px">Pourquoi : la contribution de chaque variable</h3>
      <p class="note">En log-odds de la baisse. <?= $theme === 'encre' ? 'Rouge' : 'Orange' ?> : pousse vers « baisse ». <?= $theme === 'encre' ? 'Bleu' : 'Vert' ?> : pousse vers « hausse ».</p>
      <div class="graphe" id="graphe-shap"></div>
    </div>
  </div>
  <p class="note" style="margin-top:12px">Simulation « et si » : elle montre comment le modèle réagit à l'information,
    pas ce que le marché fera. Sur le test, ce modèle n'a pas battu le modèle constant.</p>
</section>
<!-- ============ Construction du dataset ============ -->
<?php
// Les sources du dataset : nom, contenu, délai appliqué pour ne jamais utiliser une donnée avant sa publication.
$sources = [
    ['Yahoo Finance', 'Nikkei 225 (ouverture, plus haut, plus bas, clôture), S&P 500, TAIEX, Shanghai, Nifty, MSCI EM, ETF japonais', 'aucun pour Tokyo ; 1 séance pour les marchés qui ferment après'],
    ['FRED', 'Taux américain à 10 ans, USD/JPY, VIX', '1 séance'],
    ['Ministère des Finances du Japon', 'Taux japonais (JGB) à 2, 5, 10 et 30 ans', '1 séance'],
    ['Bundesbank et BCE', 'Bund 10 ans, €STR / EONIA, Euribor 3 mois', '1 à 2 séances'],
    ['Banque du Japon', 'TONA (taux au jour le jour), enquête Tankan, calendrier des réunions', 'Tankan : 5 jours après la fin du trimestre'],
    ['e-Stat', "Inflation japonaise (CPI global, core, core-core)", 'le 25 du mois suivant'],
    ['Kenneth French', 'Facteurs Fama-French du Japon (taille, value)', '2 mois'],
    ['GDELT', '13 694 titres de presse sur le Japon et la Banque du Japon, depuis 2017', 'rattachés à la première séance qui clôture après leur détection'],
    ['FinBERT', 'Score de sentiment de chaque titre : P(positif) − P(négatif)', 'calculé sur le titre, donc aucun'],
];
$etapes_dataset = [
    ['Collecter', "Chaque source est téléchargée et sauvegardée telle quelle dans data/raw : le projet se rejoue sans réseau."],
    ['Nettoyer', "Une fausse séance recopiée par Yahoo un jour férié est supprimée. Un split non ajusté et un prix divisé par 10 sont corrigés sur l'ETF TOPIX. Les jours sans news sont gardés et signalés, au lieu d'être supprimés."],
    ['Aligner', "Tout est ramené sur le calendrier de Tokyo, avec la dernière valeur connue. On propage vers l'avant, jamais vers l'arrière."],
    ['Décaler', "Chaque série est retardée jusqu'à sa date de publication réelle. C'est la protection contre la fuite temporelle."],
    ['Agréger', "Une ligne par mois, datée de la dernière séance : niveaux de fin de mois, rendements et variations du mois, moyennes des news."],
    ['Construire', "Trois variables de news (volume anormal, sentiment pondéré, indicateur de présence) et les cibles du mois suivant."],
    ['Contrôler', "Un audit codé vérifie la cible, l'absence de recopie d'une cible, les dates de publication et l'unicité de la ligne à prédire."],
];
?>
<section id="dataset">
  <p class="surtitre">Construction du dataset</p>
  <h2>De douze sources à une table de 201 mois</h2>
  <p class="chapo">Le jeu de données n'existait pas : il a été construit, source par source. Chaque série est retardée
    jusqu'à sa date de publication, pour que le modèle ne voie jamais une information en avance.</p>
  <div class="carte">
    <table class="tableau">
      <thead><tr><th>Source</th><th>Ce qu'on y prend</th><th>Délai appliqué</th></tr></thead>
      <tbody>
<?php foreach ($sources as [$source, $contenu, $delai]): ?>
        <tr><td><b><?= e($source) ?></b></td><td><?= e($contenu) ?></td><td><?= e($delai) ?></td></tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="grille g4 etapes" style="margin-top:18px">
<?php foreach ($etapes_dataset as [$nom, $detail]): ?>
    <div class="carte etape"><h3><?= e($nom) ?></h3><p><?= e($detail) ?></p></div>
<?php endforeach; ?>
    <div class="carte kpi vert"><b>201</b><span>mois, 24 colonnes</span><div class="contre">200 mois étiquetés + 1 mois à prédire</div></div>
  </div>
  <div class="grille g2" style="margin-top:18px">
    <div class="carte">
      <h3>Les cibles, définies sur le mois suivant</h3>
      <div class="formule">R<sup>N</sup><sub>t+1</sub> = P<sub>t+1</sub> / P<sub>t</sub> − 1 &nbsp;·&nbsp; y = 1 si R<sup>N</sup><sub>t+1</sub> ≤ 0</div>
      <div class="formule">E<sub>t+1</sub> = S<sub>t</sub> / S<sub>t+1</sub> − 1 &nbsp;·&nbsp; C<sub>t</sub> = (1 + i<sup>EUR</sup>/12) / (1 + i<sup>JPY</sup>/12) − 1</div>
      <div class="formule">couvert : R<sup>N</sup> + C<sub>t</sub> + R<sup>N</sup>E &nbsp;·&nbsp; non couvert : R<sup>N</sup> + E + R<sup>N</sup>E</div>
      <p class="note">R<sup>N</sup> : rendement du Nikkei en yens. E : rendement du yen en euros. C<sub>t</sub> : portage de la
        couverture, connu à l'avance. La classe positive est la baisse, l'événement rare et coûteux.</p>
    </div>
    <div class="carte">
      <h3>Les news, de l'article à la variable</h3>
      <ul class="points">
        <li>13 694 titres collectés, 13 015 après suppression des reprises d'un même titre.</li>
        <li>FinBERT classe 32 % des titres en positif, 42 % en négatif, 26 % en neutre. Le score moyen vaut −0,10.</li>
        <li>Chaque article est rattaché à la première séance de Tokyo qui clôture après sa détection (6h30 UTC).</li>
        <li>Volume anormal : le nombre d'articles du mois comparé à sa moyenne des six mois précédents.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> La table finale compte 201 mois, de février 2010 à octobre 2026. L'audit ne trouve
    aucune fuite : la cible est exactement le rendement du mois suivant (écart 0), l'identité de la couverture tient à
    7 × 10⁻⁷ près, et le Tankan ne change qu'à ses mois de publication.</div>
</section>

<!-- ============ Méthode ============ -->
<section id="methode">
  <p class="surtitre">La méthode</p>
  <h2>Des données brutes à la décision, étape par étape</h2>
  <p class="chapo">Chaque étape s'appuie sur une séance de cours et sur un notebook exécuté. Cliquez sur une étape pour
    ouvrir son notebook.</p>

  <div class="flux">
    <div><b>Données</b><span>12 sources, décalées à leur date de publication</span></div>
    <div><b>Table mensuelle</b><span>200 mois, 10 variables, audit des fuites</span></div>
    <div><b>Pipeline</b><span>imputation, k-means, standardisation</span></div>
    <div><b>Modèle</b><span>logistique L2, calibrée par Platt</span></div>
    <div><b>Règle</b><span>espérance de gain en euros, deux seuils</span></div>
    <div><b>Action</b><span>acheter couvert · neutre · vendre</span></div>
  </div>

  <div class="grille g3 etapes" style="margin-top:24px">
    <a class="carte plate etape relief" href="/notebooks?nb=01_cadrage_eda_variables"><h3>Cadrage et fuites</h3>
      <p>Les cinq questions, l'audit des fuites vérifié par du code, l'exploration, le split chronologique.</p><span class="cours">S1 · L1 · L2</span></a>
    <a class="carte plate etape relief" href="/notebooks?nb=02_pipeline_modeles_optuna"><h3>Pipeline et modèles</h3>
      <p>Une seule pipeline, trois modèles réglés par Optuna sur une validation croisée temporelle.</p><span class="cours">S2 à S5 · L3B</span></a>
    <a class="carte plate etape relief" href="/notebooks?nb=03_calibration_seuils"><h3>Calibration et décision</h3>
      <p>Platt appris hors fold, seuils tirés des coûts, décision figée par un commit avant le test.</p><span class="cours">S7 · S8</span></a>
    <a class="carte plate etape relief" href="/notebooks?nb=03b_test_final"><h3>Le test, une seule fois</h3>
      <p>La décision figée est appliquée aux 33 mois du test. Le plancher n'est pas battu.</p><span class="cours">S1</span></a>
    <a class="carte plate etape relief" href="/notebooks?nb=04_explicabilite_diagnostics"><h3>Explicabilité</h3>
      <p>Slices, importance par permutation, SHAP global et local, PDP : pourquoi le modèle échoue.</p><span class="cours">S9</span></a>
    <a class="carte plate etape relief" href="/notebooks?nb=05_annexe_maths_logistique"><h3>Annexe de Maths</h3>
      <p>La logistique codée à la main : vraisemblance, gradient, prior gaussien, sensibilité.</p><span class="cours">L1 · L2 · L5 · L7</span></a>
  </div>
</section>


<!-- ============ Données ============ -->
<section id="exploration">
  <p class="surtitre">Exploration</p>
  <h2>200 mois, et aucune information venue du futur</h2>
  <div class="grille g2">
    <figure class="figure"><img src="/figures/01_nikkei_split.png" alt="Nikkei 225 et découpage chronologique">
      <figcaption>Le Nikkei 225 en fin de mois et les trois blocs : entraînement (143 mois), validation (24), test (33).</figcaption></figure>
    <div class="carte">
      <h3>Un audit des fuites codé, pas affirmé</h3>
      <ul class="points">
        <li>La cible du mois <i>t</i> est exactement le rendement du mois <i>t</i> + 1 (écart 0).</li>
        <li>Chaque série est décalée jusqu'à sa date de publication : CPI au 25 du mois suivant, Tankan cinq jours après le trimestre, facteurs Fama-French à <i>t</i> − 2.</li>
        <li>Aucune variable ne recopie une cible : le contrôle porte sur les valeurs, et un test injecte une fuite pour vérifier qu'elle est détectée.</li>
        <li>Les variables de news sont identiques quand on coupe le futur.</li>
      </ul>
      <p class="note" style="margin-top:14px">Trois variables sont construites : le <b>volume anormal d'articles</b>, le
        <b>sentiment FinBERT pondéré</b> et un indicateur de présence des news, absentes avant 2017.</p>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/01_cibles_couverture.png" alt="Cibles et couverture">
      <figcaption>Rendements mensuels, 1 € investi couvert ou non, et portage de la couverture, qui change de signe après 2022.</figcaption></figure>
    <div class="carte">
      <h3>Ce que l'exploration annonce</h3>
      <ul class="points">
        <li>Le Nikkei monte 61 % des mois : « toujours hausse » est difficile à battre.</li>
        <li>Sur l'entraînement, une seule variable est nettement liée au rendement suivant : le volume anormal d'articles (corrélation de rang −0,38).</li>
        <li>Le sentiment FinBERT ne prédit presque rien (+0,03).</li>
        <li>Rien ne prédit l'avantage de la couverture.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Le marché monte 61 % des mois, les news ne couvrent que 57 des 143 mois d'entraînement, et une seule variable sort du bruit : le volume anormal d'articles. Le sentiment des news, pourtant au cœur de l'idée de départ, ne prédit presque rien.</div>
</section>


<!-- ============ Modèles ============ -->
<section id="modeles">
  <p class="surtitre">Les modèles</p>
  <h2>Trois modèles, un même constat</h2>
  <p class="chapo">Régression logistique, Random Forest et LightGBM battent tous le modèle constant en validation
    croisée. Aucun ne le bat sur la validation 2022-2023 : plus le modèle est flexible, plus l'écart est grand.</p>
  <div class="grille g2">
    <div class="carte">
      <table class="tableau">
        <thead><tr><th>Modèle</th><th class="num">Log-loss CV</th><th class="num">Log-loss validation</th><th class="num">PR-AUC validation</th></tr></thead>
        <tbody>
          <tr class="ref"><td>Constant (référence)</td><td class="num">0,672</td><td class="num fort">0,681</td><td class="num">0,417</td></tr>
          <tr><td><b>Logistique</b> · retenue</td><td class="num">0,647</td><td class="num">0,701</td><td class="num">0,489</td></tr>
          <tr><td>Random Forest</td><td class="num">0,629</td><td class="num">0,742</td><td class="num">0,440</td></tr>
          <tr><td>LightGBM</td><td class="num fort">0,584</td><td class="num">0,710</td><td class="num fort">0,524</td></tr>
        </tbody>
      </table>
      <p class="note" style="margin-top:16px">Log-loss : plus bas = mieux. Le modèle final est choisi par la règle de
        baseline du cours : on garde le modèle simple, sauf si un modèle plus complexe le bat clairement en classement
        <i>et</i> en qualité des probabilités.</p>
    </div>
    <figure class="figure"><img src="/figures/02_coefficients_logistiques.png" alt="Coefficients des régressions logistiques">
      <figcaption>Ce que dit la logistique : un écart-type de plus sur le volume d'articles ou sur le momentum 12 mois
        multiplie les odds de baisse par 1,22. Le modèle de couverture n'a aucun coefficient non nul.</figcaption></figure>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/02_optuna_historique.png" alt="Historique des essais Optuna">
    <figcaption>Les 200 essais Optuna, journalisés un par un : log-loss de chaque essai, meilleur jusqu'ici et modèle constant.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> Plus un modèle est flexible, plus il s'ajuste au bruit des 48 mois de validation croisée : LightGBM y gagne 0,089 de log-loss et en perd 0,029 sur 2022-2023. La logistique est retenue par la règle de baseline. Le modèle de couverture n'a aucun signal : tous ses coefficients sont nuls.</div>
</section>


<!-- ============ Décision ============ -->
<section id="decision">
  <p class="surtitre">De la probabilité à l'action</p>
  <h2>Le modèle estime, la règle décide</h2>
  <div class="grille g2">
    <div class="carte">
      <h3>La formule complète</h3>
      <p class="note">Variables standardisées <i>z</i>, poids appris par descente de gradient, calibration de Platt, puis deux seuils.</p>
      <div class="formule">p<sub>t</sub> = 1 − σ( a·(b + w<sup>⊤</sup>z<sub>t</sub>) + c ), &nbsp;&nbsp; S<sub>t</sub> = 2p<sub>t</sub> − 1</div>
      <div class="formule"><span class="droit">acheter si</span> p<sub>t</sub> ≥ θ<sub>a</sub> = (m − B<sub>d</sub>) / (B<sub>u</sub> − B<sub>d</sub>) = <span class="droit">0,580</span><br>
        <span class="droit">vendre si</span> p<sub>t</sub> ≤ θ<sub>v</sub> = (S<sub>d</sub> − m) / (S<sub>d</sub> − S<sub>u</sub>) = <span class="droit">0,456</span></div>
      <ul class="points">
        <li>Les coûts viennent de l'entraînement : un achat couvert rapporte +3,89 % un mois de hausse et perd 4,18 % un mois de baisse.</li>
        <li>La marge <i>m</i> = 0,5 % par mois est fixée à l'avance, pas réglée sur la validation.</li>
        <li>Couverture : aucun signal trouvé, donc « toujours couvert ».</li>
      </ul>
    </div>
    <div class="carte">
      <h3>Figée avant de voir le test</h3>
      <p>Le modèle, la calibration, les coûts, la marge et la couverture sont écrits dans un fichier, commité
        (<code>75712cf</code>) avant toute évaluation sur le test (<code>6efd12c</code>).</p>
      <div class="alerte"><b>Engagement pris à l'avance.</b> Si le modèle perd aussi contre le modèle constant sur le
        test, la recommandation sera « toujours acheter, couvert ».</div>
      <p class="note" style="margin-top:14px">Calibration : Platt est appris sur les prédictions hors fold. Un premier
        essai sur la validation donnait des pentes négatives, il inversait les modèles, et a été écarté.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/03_fiabilite_brute.png" alt="Reliability diagrams">
    <figcaption>Reliability diagrams codés à la main. Hors fold, les points suivent la diagonale ; sur la validation,
      la courbe de la logistique descend : plus elle annonce une baisse, moins elle arrive.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> Sur la validation, la logistique calibrée ne bat pas le modèle constant (log-loss 0,699 contre 0,681), et la règle évite 7 baisses sur 10 mais rate la hausse de 2023. Tout est tout de même figé avant le test, avec un engagement écrit sur la suite.</div>
</section>


<!-- ============ Test ============ -->
<section id="test">
  <p class="surtitre">Le test 2024-2026</p>
  <h2>Une seule évaluation, et un engagement tenu</h2>
  <p class="chapo">La règle évite presque toutes les baisses, mais elle reste hors du marché pendant une hausse de
    82 %. Les points sont colorés par l'action prise chaque mois.</p>
  <div class="carte">
    <div class="barre-outils">
      <div class="onglets" id="onglets-bloc">
        <button class="onglet actif" data-bloc="test">Test 2024-2026</button>
        <button class="onglet" data-bloc="validation">Validation 2022-2023</button>
      </div>
      <span class="note" id="resume-historique"></span>
    </div>
    <div class="graphe" id="graphe-historique"></div>
    <div class="legende">
      <span><i class="ligne" style="background:#c55a11"></i>toujours acheter, couvert</span>
      <span><i class="ligne" style="background:#052424"></i>règle du modèle</span>
      <span><i class="ligne" style="background:#8b90a0"></i>cash</span>
      <span><i style="background:#1faa59"></i>acheter</span>
      <span><i style="background:#8b90a0"></i>neutre</span>
      <span><i style="background:#e5484d"></i>vendre</span>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <div class="carte">
      <h3>Probabilités sur le test</h3>
      <table class="tableau">
        <thead><tr><th>Modèle</th><th class="num">Log-loss</th><th class="num">Brier</th><th class="num">ECE</th><th class="num">PR-AUC</th></tr></thead>
        <tbody>
<?php foreach (['logistique' => 'Logistique calibrée · retenue', 'Random Forest' => 'Random Forest', 'LightGBM' => 'LightGBM',
               "constante (fréquence de l'entraînement)" => 'Constant (référence)'] as $cle => $libelle):
        $ligne = $metriques[$cle] ?? null;
        if ($ligne === null) { continue; } ?>
          <tr<?= str_starts_with($cle, 'constante') ? ' class="ref"' : '' ?>><td><?= e($libelle) ?></td>
<?php   foreach (['log-loss', 'Brier', 'ECE', 'PR-AUC'] as $mesure):
            $valeurs = array_column($metriques, $mesure);
            $meilleur = $mesure === 'PR-AUC' ? max($valeurs) : min($valeurs); ?>
            <td class="num<?= abs($ligne[$mesure] - $meilleur) < 1e-9 ? ' fort' : '' ?>"><?= decimal($ligne[$mesure]) ?></td>
<?php   endforeach; ?>
          </tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:14px">Le modèle est <b>sur-confiant dans la baisse</b> : 52 % de baisses
        annoncées en moyenne, 36 % observées. Nous ne ferions pas confiance à ces probabilités pour décider.</p>
    </div>
    <div class="carte">
      <h3>Actions et réalité du mois suivant</h3>
      <table class="tableau" id="tableau-actions">
        <thead><tr><th>Action</th><th class="num">Hausses réalisées</th><th class="num">Baisses réalisées</th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="note" style="margin-top:14px">La couverture permanente, elle, était le bon choix : +82,3 % contre
        +57,9 % sans couverture sur le test.</p>
    </div>
  </div>
  <div class="carte" style="margin-top:18px">
    <h3>Où le modèle réussit et où il échoue</h3>
    <table class="tableau">
      <thead><tr><th>Sous-groupe du test</th><th class="num">Mois</th><th class="num">Baisses</th><th class="num">Log-loss modèle</th><th class="num">Log-loss constante</th></tr></thead>
      <tbody>
        <tr><td>Année 2024</td><td class="num">12</td><td class="num">6</td><td class="num fort">0,672</td><td class="num">0,717</td></tr>
        <tr><td>Année 2025</td><td class="num">12</td><td class="num">3</td><td class="num">0,684</td><td class="num fort">0,607</td></tr>
        <tr><td>Année 2026</td><td class="num">9</td><td class="num">3</td><td class="num">0,787</td><td class="num fort">0,644</td></tr>
        <tr><td>Régime calme</td><td class="num">24</td><td class="num">9</td><td class="num">0,725</td><td class="num fort">0,662</td></tr>
        <tr><td>Régime agité</td><td class="num">9</td><td class="num">3</td><td class="num">0,660</td><td class="num fort">0,644</td></tr>
      </tbody>
    </table>
    <p class="note" style="margin-top:12px">Avec 3 à 9 baisses par sous-groupe, les écarts restent fragiles. Il n'y a aucune
      personne dans les données, donc pas d'attribut sensible : l'analyse d'équité est transposée à ces groupes de mois.</p>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Le plancher n'est pas battu : le modèle ne fait mieux que le modèle constant qu'en 2024, où il détecte les six baisses de l'année. L'engagement est tenu : la recommandation est « toujours acheter, couvert ». La couverture permanente, elle, était le bon choix (+82,3 % contre +57,9 %).</div>
</section>


<!-- ============ Simulateur ============ -->
<section id="simulateur">
  <p class="surtitre">Simulateur · paramétrable</p>
  <h2>Et si la règle avait été réglée autrement&nbsp;?</h2>
  <p class="chapo">Déplacez la marge, changez la couverture, interdisez la vente : les seuils, les actions et la courbe
    se recalculent aussitôt.</p>
  <div class="grille labo">
    <div class="carte">
      <div class="reglage">
        <label for="sim-marge">Marge exigée au-dessus du cash <output id="sim-marge-valeur"></output></label>
        <input type="range" id="sim-marge" min="0" max="1.5" step="0.05" value="0.5">
      </div>
      <div class="reglage"><label>Couverture du yen quand on achète</label>
        <div class="onglets" id="sim-couverture"><button class="onglet actif" data-v="1" type="button">Couvert</button><button class="onglet" data-v="0" type="button">Non couvert</button></div></div>
      <div class="reglage"><label>Période</label>
        <div class="onglets" id="sim-bloc"><button class="onglet actif" data-v="test" type="button">Test 2024-2026</button><button class="onglet" data-v="validation" type="button">Validation 2022-2023</button></div></div>
      <label class="interrupteur"><input type="checkbox" id="sim-vente" checked> Autoriser la vente du Nikkei</label>
      <div class="jauge" id="sim-jauge"></div>
      <button class="btn contour" id="sim-reinit" type="button">Revenir au réglage du projet</button>
    </div>
    <div class="carte">
      <div class="labo-kpis">
        <div class="mini"><span>Règle simulée</span><b id="sim-regle">–</b></div>
        <div class="mini"><span>Toujours acheter</span><b id="sim-reference">–</b></div>
        <div class="mini"><span>Perte maximale</span><b id="sim-perte">–</b></div>
        <div class="mini"><span>Baisses évitées</span><b id="sim-baisses">–</b></div>
      </div>
      <div class="note" id="sim-actions"></div>
      <div class="repartition" id="sim-repartition"><i style="background:#1faa59"></i><i style="background:#8b90a0"></i><i style="background:#e5484d"></i></div>
      <div class="graphe" id="sim-graphe"></div>
    </div>
  </div>
  <p class="alerte" style="margin-top:16px"><b>Exploration après coup.</b> Dans le projet, la marge est restée fixée à
    0,5 % par mois avant de regarder le test. Choisir ici le meilleur réglage reviendrait à régler la règle sur le test.</p>
</section>
<!-- ============ Projection ============ -->
<section id="projection">
  <p class="surtitre">Projection</p>
  <h2>Ce que le modèle projette pour novembre 2026</h2>
  <p class="chapo">Avec les données de fin octobre 2026, le dernier mois disponible, voici la sortie complète du système
    et la façon de la lire.</p>
  <div class="grille g2">
    <div class="carte signal">
      <div class="entete"><span class="etiquette">Sortie du système</span><span class="mois"><?= $signal ? e(mois_lisible($signal['mois_des_donnees'])) : 'API arrêtée' ?></span></div>
<?php if ($signal): ?>
      <div class="proba"><?= pct($signal['p_hausse'], 1) ?><small>de probabilité de hausse en novembre</small></div>
      <div class="jauge" data-jauge data-p="<?= e($signal['p_hausse']) ?>" data-tv="<?= e($signal['seuils']['theta_v']) ?>" data-ta="<?= e($signal['seuils']['theta_a']) ?>"></div>
      <div class="duo">
        <div class="mini"><span>Score S = 2p − 1</span><b><?= signe($signal['score']) ?></b></div>
        <div class="mini"><span>Action de la règle</span><b><span class="badge <?= e($signal['action_du_modele']) ?>"><?= e($signal['action_du_modele']) ?></span></b></div>
      </div>
<?php endif; ?>
      <div class="verdict"><b>Recommandation retenue : acheter, couvert.</b><br>La règle du modèle n'est pas suivie, puisqu'il
        n'a pas battu le modèle constant sur le test.</div>
    </div>
    <div class="carte">
      <h3>Comment le modèle arrive à ce chiffre</h3>
      <ul class="points">
        <li><b>Volume d'articles : +0,58.</b> Deux fois plus d'articles que d'habitude en octobre. C'est le premier moteur du signal de baisse.</li>
        <li><b>Taux japonais à 10 ans : −0,30.</b> Il a reculé de 21 points de base, ce qui pousse vers la hausse.</li>
        <li><b>Portage : +0,14.</b> Une valeur hors du domaine d'entraînement, donc une contribution à lire avec prudence.</li>
        <li><b>Momentum 12 mois : +0,10.</b> Le Nikkei a gagné 21 % sur un an, et le modèle parie à contre-courant.</li>
      </ul>
      <p class="note" style="margin-top:12px">Contributions en log-odds de la baisse. Leur somme, ajoutée au niveau moyen du
        modèle puis calibrée, donne la probabilité affichée.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:18px"><img src="/figures/04_shap_waterfall_2026-10.png" alt="Décomposition SHAP de la prédiction d'octobre 2026">
    <figcaption>Décomposition complète de la prédiction, variable par variable (notebook 04).</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> La projection est fragile pour deux raisons. La moitié des vingt dernières séances
    n'ont aucun article collecté, donc le pic d'articles d'octobre repose sur peu de jours. Et le modèle a été trop pessimiste
    sur tout le test. Nous ne la suivons pas : la recommandation reste « acheter, couvert ».</div>
</section>

<!-- ============ Changement de régime ============ -->
<?php
// Ce qui a changé après 2021 : chaque ligne devient une carte recto (avant) / verso (depuis 2022).
$bascules = [
    ['Portage de la couverture', '−0,4 % / an', '+2,2 % / an', "La BoJ sort des taux négatifs : couvrir le yen coûtait, cela rapporte."],
    ["Volume d'articles et rendement du mois suivant", '−0,38', '+0,29', "Corrélation de rang : elle change de signe en 2022-2023, puis reste instable."],
    ['Articles sur la BoJ, par mois', '55', '73', "La normalisation monétaire occupe la presse."],
    ['Probabilité de baisse annoncée par le modèle', '40 %', '52 %', "Alors que les baisses réelles passent de 39 % à 36 % des mois."],
    ['Variation du taux japonais à 10 ans', 'neutre', 'nuisible', "Importance par permutation : de +0,001 à −0,027 sur le test."],
    ['Momentum 12 mois, lu à contre-courant', 'payant', 'perdant', "Rebonds en V jusqu'en 2021, tendance durable ensuite."],
];
?>
<section id="regime" class="regime">
  <p class="surtitre">Changement de régime</p>
  <h2>Ce que le modèle avait appris a changé de sens</h2>
  <p class="chapo">Le modèle a appris sur 2010-2021. Depuis 2022, la Banque du Japon normalise sa politique et plusieurs
    relations se retournent. Basculez d'une époque à l'autre, ou cliquez sur une carte.</p>
  <div class="onglets" id="bascule-regime">
    <button class="onglet actif" data-v="avant" type="button">Jusqu'en 2021 · entraînement</button>
    <button class="onglet" data-v="apres" type="button">Depuis 2022 · validation et test</button>
  </div>
  <div class="grille g3 volets">
<?php foreach ($bascules as [$libelle, $avant, $apres, $commentaire]): ?>
    <div class="volet" tabindex="0" role="button" aria-label="<?= e($libelle) ?> : retourner la carte">
      <div class="face face-avant"><span class="epoque">Jusqu'en 2021</span><h3><?= e($libelle) ?></h3><span class="valeur"><?= e($avant) ?></span><p><?= e($commentaire) ?></p></div>
      <div class="face face-apres"><span class="epoque">Depuis 2022</span><h3><?= e($libelle) ?></h3><span class="valeur"><?= e($apres) ?></span><p><?= e($commentaire) ?></p></div>
    </div>
<?php endforeach; ?>
  </div>
</section>

<!-- ============ Pourquoi ============ -->
<section id="pourquoi">
  <p class="surtitre">Le diagnostic</p>
  <h2>Pourquoi le modèle échoue après 2021</h2>
  <div class="grille g3">
    <div class="carte"><h3>Un signal de news instable</h3>
      <p>Le volume d'articles annonçait des baisses jusqu'en 2021. Sa corrélation avec le rendement suivant oscille
        ensuite entre −0,5 et +0,3, quand la Banque du Japon normalise sa politique.</p></div>
    <div class="carte"><h3>Une extrapolation</h3>
      <p>Sur le test, le portage est à 6 écarts-types de sa moyenne d'entraînement. Le modèle linéaire prolonge une
        pente apprise sur un intervalle étroit : +0,25 de log-odds vers « baisse », chaque mois.</p></div>
    <div class="carte"><h3>Un pari contrarien</h3>
      <p>Le momentum 12 mois, contrarien pendant les rebonds en V de 2018-2021, parie contre une tendance qui a duré
        de 2024 à 2026.</p></div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/04_inversion_signal_news.png" alt="Signal des news mois par mois">
      <figcaption>En haut, la corrélation glissante sur 24 mois entre volume d'articles et rendement suivant. En bas,
        la contribution SHAP de cette variable.</figcaption></figure>
    <figure class="figure"><img src="/figures/04_shap_beeswarm_test.png" alt="SHAP global sur le test">
      <figcaption>SHAP global sur le test : le portage, le momentum 12 mois et le JGB 10 ans poussent presque tous les
        mois vers « baisse ».</figcaption></figure>
  </div>
  <div class="carte" style="margin-top:20px">
    <h3>Les limites que nous déclarons</h3>
    <ul class="points">
      <li><b>Petit échantillon</b> : 143 mois d'entraînement, 12 baisses dans le test. Les écarts entre modèles et entre slices sont fragiles.</li>
      <li><b>Un test pas entièrement invisible</b> : l'exploration affichait déjà des statistiques du bloc test avant le gel. La couverture permanente n'a pas été choisie à l'aveugle.</li>
      <li><b>Des variables choisies</b> à partir d'une analyse de 2017-2026, qui recouvre la validation et le test.</li>
      <li><b>Équité</b> : aucune personne dans les données, donc aucun attribut sensible. L'analyse est transposée à des groupes de mois, sans écart au-delà du bruit.</li>
    </ul>
  </div>
</section>


<!-- ============ Maths ============ -->
<section id="maths">
  <p class="surtitre">Annexe de Maths · en 3D</p>
  <h2>La régression logistique, de la vraisemblance à la descente de gradient</h2>
  <div class="grille g2">
    <div class="carte">
      <h3>Trois dérivations</h3>
      <p class="note">Le coût est l'opposé de la log-vraisemblance de Bernoulli :</p>
      <div class="formule">J(w, b) = − (1/m) Σ [ y log p + (1 − y) log(1 − p) ]</div>
      <p class="note">Son gradient, par la règle de la chaîne, est l'erreur fois l'entrée :</p>
      <div class="formule">∇<sub>w</sub> J = (1/m) X<sup>⊤</sup>(p − y)</div>
      <p class="note">La pénalité L2 est un prior gaussien sur les poids :</p>
      <div class="formule">J<sub>λ</sub> = J + λ‖w‖², &nbsp; λ = 1 / (2mτ²)</div>
    </div>
    <div class="carte">
      <h3>Vérifié par le calcul</h3>
      <table class="tableau">
        <tbody>
          <tr><td>Gradient analytique contre différences finies</td><td class="num">1,3 × 10⁻⁹</td></tr>
          <tr><td>Descente à la main contre scikit-learn</td><td class="num">4,6 × 10⁻⁶</td></tr>
          <tr><td>Borne de convergence 2/L</td><td class="num">2,08</td></tr>
          <tr><td>Limite locale 2/λ<sub>max</sub>(H*)</td><td class="num">2,23</td></tr>
          <tr><td>Écart-type a priori τ pour λ = 0,117</td><td class="num">0,17</td></tr>
        </tbody>
      </table>
      <p style="margin-top:16px"><a class="btn contour" href="/annexe_maths.pdf" target="_blank">Annexe PDF (4 pages)</a></p>
    </div>
  </div>
  <div class="carte" style="margin-top:20px">
    <h3>La descente de gradient sur la surface de coût, en 3D</h3>
    <p class="note">Modèle réduit à deux variables (volume anormal d'articles et momentum 12 mois), avec le même λ
      que le modèle final. La hauteur est le coût J(w₁, w₂). Choisissez un pas α, puis faites glisser pour tourner.</p>
    <div class="barre-outils">
      <div class="onglets" id="choix-pas"></div>
      <span class="note" id="etat-pas"></span>
    </div>
    <div class="scene" id="scene-surface"><canvas aria-label="Surface de coût en 3D et trajectoire de la descente de gradient"></canvas></div>
    <div class="legende">
      <span><i style="background:#f2c14e"></i>point de départ</span>
      <span><i style="background:#e5484d"></i>minimum</span>
      <span><i class="ligne" style="background:#15171f"></i>trajectoire de la descente</span>
      <span>couleur : du bleu (coût faible) au rouge (coût élevé)</span>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/05_sensibilite_pas.png" alt="Sensibilité au pas">
      <figcaption>Sensibilité au pas α : trop petit, la descente est lente ; au-delà de la limite, elle ne converge plus.</figcaption></figure>
    <figure class="figure"><img src="/figures/05_sensibilite_lambda.png" alt="Sensibilité à lambda">
      <figcaption>Sensibilité à λ : sans pénalité, le modèle sur-apprend ; la validation croisée est minimale au λ choisi par Optuna.</figcaption></figure>
  </div>
  <div class="conclusion"><b>Conclusion.</b> La descente codée à la main retrouve scikit-learn, et toutes les sensibilités pointent dans le même sens : plus de régularisation, ou un arrêt plus précoce, rapproche le modèle de la constante. C'est la signature d'un signal faible et instable dans le temps.</div>
</section>


<!-- ============ Ressources ============ -->
<section id="ressources">
  <p class="surtitre">Ressources</p>
  <h2>Tout le projet, en accès direct</h2>
  <div class="grille g3">
    <a class="carte ressource relief" href="/notebooks?nb=01_cadrage_eda_variables"><span class="fleche">→</span><span class="num">Notebook 01</span><h3>Cadrage, fuites, EDA</h3><p>Les cinq questions, l'audit, les variables, le split.</p></a>
    <a class="carte ressource relief" href="/notebooks?nb=02_pipeline_modeles_optuna"><span class="fleche">→</span><span class="num">Notebook 02</span><h3>Pipeline et Optuna</h3><p>Trois modèles, 200 essais journalisés.</p></a>
    <a class="carte ressource relief" href="/notebooks?nb=03_calibration_seuils"><span class="fleche">→</span><span class="num">Notebook 03</span><h3>Calibration et seuils</h3><p>Platt, coûts, décision figée.</p></a>
    <a class="carte ressource relief" href="/notebooks?nb=03b_test_final"><span class="fleche">→</span><span class="num">Notebook 03b</span><h3>Test final</h3><p>L'évaluation unique sur 2024-2026.</p></a>
    <a class="carte ressource relief" href="/notebooks?nb=04_explicabilite_diagnostics"><span class="fleche">→</span><span class="num">Notebook 04</span><h3>Explicabilité</h3><p>Slices, permutation, SHAP, PDP.</p></a>
    <a class="carte ressource relief" href="/notebooks?nb=05_annexe_maths_logistique"><span class="fleche">→</span><span class="num">Notebook 05</span><h3>Annexe de Maths</h3><p>La logistique codée à la main.</p></a>
    <a class="carte ressource relief" href="/rapport.pdf" target="_blank"><span class="fleche">→</span><span class="num">PDF · 9 pages</span><h3>Rapport Applied ML</h3><p>Les dix exigences, dans l'ordre.</p></a>
    <a class="carte ressource relief" href="/annexe_maths.pdf" target="_blank"><span class="fleche">→</span><span class="num">PDF · 4 pages</span><h3>Annexe mathématique</h3><p>Loss, gradient, prior, sensibilité.</p></a>
    <a class="carte ressource relief" href="<?= e(API) ?>/docs" target="_blank"><span class="fleche">→</span><span class="num">API</span><h3>Documentation de l'API</h3><p>/signal, /explication, /historique, /evaluation.</p></a>
  </div>
</section>


</main>

<script src="/assets/app.js"></script>
<script type="module" src="/assets/scene3d.js"></script>
<?php if ($theme === 'encre'): ?>
<canvas id="toile-recit" aria-hidden="true"></canvas>
<script type="module" src="/assets/recit.js"></script>
<?php endif; ?>
<?php require __DIR__ . '/inc/pied.php'; ?>

