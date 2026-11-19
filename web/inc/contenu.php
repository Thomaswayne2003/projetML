<?php
/**
 * Le contenu du site : l'affiche d'ouverture et les seize chapitres, avec leurs tableaux, figures et outils.
 * index.php inclut ce fichier, puis met en scène l'ouverture de chaque chapitre.
 * Les chiffres figés viennent de runs/evaluation_test.json ; le signal du mois vient de l'API Python.
 */
declare(strict_types=1);
require __DIR__ . '/config.php';

$theme = 'encre';
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
require __DIR__ . '/entete.php';
?>
<!-- ============ En-tête, avec la scène 3D ============ -->
<div id="voile" aria-hidden="true"></div>
<header class="hero3d affiche" id="haut" data-chapitre="haut" data-court="Ouverture">
  <div class="page affiche-in">
    <div class="affiche-texte">
      <p class="surtitre"><span class="sceau">序</span>Albert School · MSc 1 · Applied ML &amp; Maths for ML</p>
      <h1>Acheter, rester neutre ou vendre le <em>Nikkei&nbsp;225</em>&nbsp;?</h1>
      <p class="chapo">Peut-on deviner, à la fin d'un mois, ce que fera la Bourse japonaise le mois suivant ? Nous avons
        essayé, en nous appuyant sur l'actualité et sur les chiffres des marchés, pour en tirer un conseil simple
        destiné à un épargnant européen : acheter, attendre ou vendre.</p>
      <dl class="reponse">
        <div class="large"><dt>Notre réponse, en clair</dt><dd>Mieux vaut acheter et garder, en se protégeant contre le yen.</dd>
          <p>Notre modèle n'a pas fait mieux qu'une prévision toute simple. Nous nous étions engagés à le dire si
            cela arrivait, et c'est ce que nous faisons.</p></div>
        <div><dt>En termes techniques</dt><dd><?= decimal($modele['log-loss']) ?> <small>contre <?= decimal($constante['log-loss']) ?></small></dd>
          <p>Log-loss du modèle sur le test, à comparer à celle du modèle constant. La plus basse est la meilleure.</p></div>
        <div><dt>En euros, 2024-2026</dt><dd><?= signe(100 * $achat_couvert, 1, '&nbsp;%') ?> <small>contre <?= signe(100 * $regle, 1, '&nbsp;%') ?></small></dd>
          <p>Rendement de « toujours acheter, couvert », face à celui de la règle du modèle.</p></div>
      </dl>
      <div class="boutons">
        <a class="btn plein" href="?presenter" data-presenter>Présenter ▸</a>
        <a class="btn contour" href="#resultat">Lire le récit ↓</a>
        <a class="btn contour" href="#explorateur">Essayer le prédicteur</a>
      </div>
    </div>
    <figure class="planche" data-planche="haut"><div class="dessin"></div><figcaption></figcaption></figure>
  </div>
</header>

<div class="progression" id="progression"></div>
<main class="page">
<!-- ============ Résultat ============ -->
<section id="resultat">
  <p class="surtitre">Le résultat, sans détour</p>
  <h2>Un résultat négatif, obtenu proprement</h2>
  <p class="chapo">Notre modèle repère les mois à risque un peu mieux que le hasard, mais il annonce des baisses bien plus
    souvent qu'il n'en arrive. Nous nous étions engagés, avant de regarder le test, à recommander la stratégie de
    référence dans ce cas, et c'est ce que nous faisons.</p>
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
  <p class="chapo">Choisissez un mois réel, puis déplacez les curseurs pour modifier le volume de news, le sentiment, le
    momentum ou les taux. Le site interroge alors l'API, qui recalcule la probabilité de hausse, l'action de la règle et
    le poids des différentes variables.</p>
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
      <h3 style="margin-top:18px">Ce qui pèse dans cette prédiction</h3>
      <p class="note">En log-odds de la baisse. Rouge : pousse vers « baisse ». Bleu : pousse vers « hausse ».</p>
      <div class="graphe" id="graphe-shap"></div>
    </div>
  </div>
  <p class="note" style="margin-top:12px">Ce prédicteur montre comment le modèle réagit quand l'information change. Il ne
    dit rien de ce que fera réellement le marché, d'autant que ce modèle n'a pas battu le modèle constant sur le test.</p>
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
    ['FinBERT', 'Score de sentiment des titres, égal à P(positif) − P(négatif)', 'calculé sur le titre, donc aucun'],
];
$etapes_dataset = [
    ['Collecter', "Nous téléchargeons toutes les sources et nous les gardons telles quelles dans data/1_brutes, ce qui permet de rejouer le projet sans connexion."],
    ['Nettoyer', "Une fausse séance recopiée par Yahoo un jour férié est supprimée. Un split non ajusté et un prix divisé par 10 sont corrigés sur l'ETF TOPIX. Les jours sans news sont conservés et signalés par un indicateur."],
    ['Aligner', "Tout est ramené sur le calendrier de Tokyo. Quand une valeur manque, nous reprenons la dernière connue, sans jamais aller chercher une valeur future."],
    ['Décaler', "Toutes les séries sont retardées jusqu'à leur date de publication réelle, pour que le modèle ne dispose d'aucune information avant le marché."],
    ['Agréger', "Nous gardons une ligne par mois, datée de la dernière séance, avec les niveaux de fin de mois, les rendements et variations du mois et les moyennes des news."],
    ['Construire', "Nous ajoutons trois variables de news (volume anormal, sentiment pondéré, indicateur de présence) ainsi que les cibles du mois suivant."],
    ['Contrôler', "Un audit codé vérifie la cible, l'absence de recopie d'une cible, les dates de publication et l'unicité de la ligne à prédire."],
];
?>
<section id="dataset">
  <p class="surtitre">Construction du dataset</p>
  <h2>De douze sources à une table de 201 mois</h2>
  <p class="chapo">Ce jeu de données n'existait pas, nous l'avons construit source par source. Toutes les séries sont
    retardées jusqu'à leur date de publication, afin que le modèle ne voie jamais une information en avance.</p>
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
        couverture, connu à l'avance. Nous prenons la baisse comme classe positive, parce que c'est l'événement rare et coûteux.</p>
    </div>
    <div class="carte">
      <h3>Les news, de l'article à la variable</h3>
      <ul class="points">
        <li>13 694 titres collectés, 13 015 après suppression des reprises d'un même titre.</li>
        <li>FinBERT classe 32 % des titres en positif, 42 % en négatif, 26 % en neutre. Le score moyen vaut −0,10.</li>
        <li>Les articles sont rattachés à la première séance de Tokyo qui clôture après leur détection (6h30 UTC).</li>
        <li>Le volume anormal compare le nombre d'articles du mois à sa moyenne des six mois précédents.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Nous disposons d'un tableau propre de 201 mois, dans lequel le modèle ne voit jamais le futur.
    <span class="precis">Plus précisément, la cible correspond exactement au rendement du mois suivant (écart 0), l'identité de la
    couverture tient à 7 × 10⁻⁷ près et le Tankan ne change qu'à ses mois de publication.</span></div>
</section>

<!-- ============ Méthode ============ -->
<section id="methode">
  <p class="surtitre">La méthode</p>
  <h2>Des données brutes à la décision, étape par étape</h2>
  <p class="chapo">Les étapes suivent les séances du cours, et un notebook exécuté accompagne chacune d'elles. Un clic sur
    une étape ouvre le notebook correspondant.</p>

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
      <h3>Un audit des fuites vérifié par du code</h3>
      <ul class="points">
        <li>La cible du mois <i>t</i> est exactement le rendement du mois <i>t</i> + 1 (écart 0).</li>
        <li>Les séries sont décalées jusqu'à leur date de publication, par exemple le CPI au 25 du mois suivant, le Tankan cinq jours après le trimestre et les facteurs Fama-French à <i>t</i> − 2.</li>
        <li>Aucune variable ne recopie une cible. Le contrôle porte sur les valeurs, et un test injecte volontairement une fuite pour vérifier qu'elle est bien détectée.</li>
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
        <li>Le Nikkei monte 61 % des mois, ce qui rend la prévision « toujours hausse » difficile à battre.</li>
        <li>Sur l'entraînement, seul le volume anormal d'articles est nettement lié au rendement suivant (corrélation de rang −0,38).</li>
        <li>Le sentiment FinBERT ne prédit presque rien (+0,03).</li>
        <li>Rien ne prédit l'avantage de la couverture.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> La Bourse monte six mois sur dix, et une seule de nos mesures semble annoncer la suite. <span class="precis">Plus précisément, le marché monte 61 % des mois, les news ne couvrent que 57 des 143 mois d'entraînement, et seul le volume anormal d'articles se détache du bruit. Le sentiment des news, sur lequel reposait pourtant notre idée de départ, ne prédit presque rien.</span></div>
</section>


<!-- ============ Modèles ============ -->
<section id="modeles">
  <p class="surtitre">Les modèles</p>
  <h2>Trois modèles, un même constat</h2>
  <p class="chapo">La régression logistique, le Random Forest et LightGBM battent tous les trois le modèle constant en
    validation croisée. Aucun n'y parvient sur la validation 2022-2023, et l'écart se creuse à mesure que le modèle
    devient plus flexible.</p>
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
      <p class="note" style="margin-top:16px">Une log-loss plus basse est meilleure. Pour choisir le modèle final, nous
        appliquons la règle de baseline du cours, qui consiste à garder le modèle simple tant qu'un modèle plus complexe
        ne le bat pas clairement en classement <i>et</i> en qualité des probabilités.</p>
    </div>
    <figure class="figure"><img src="/figures/02_coefficients_logistiques.png" alt="Coefficients des régressions logistiques">
      <figcaption>Dans la régression logistique, un écart-type de plus sur le volume d'articles ou sur le momentum 12 mois
        multiplie les odds de baisse par 1,22. Le modèle de couverture n'a aucun coefficient non nul.</figcaption></figure>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/02_optuna_historique.png" alt="Historique des essais Optuna">
    <figcaption>Les 200 essais Optuna, tous journalisés, avec leur log-loss, le meilleur résultat obtenu jusque-là et le niveau du modèle constant.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> Les modèles les plus sophistiqués ont surtout retenu des détails du passé, et nous gardons le plus simple. <span class="precis">Plus précisément, LightGBM gagne 0,089 de log-loss en validation croisée, puis en perd 0,029 sur 2022-2023. La règle de baseline nous fait retenir la régression logistique. Quant au modèle de couverture, il ne trouve aucun signal et tous ses coefficients sont nuls.</span></div>
</section>


<!-- ============ Décision ============ -->
<section id="decision">
  <p class="surtitre">De la probabilité à l'action</p>
  <h2>Comment une probabilité devient une action</h2>
  <div class="grille g2">
    <div class="carte">
      <h3>La formule complète</h3>
      <p class="note">Les variables sont standardisées (<i>z</i>), les poids sont appris par descente de gradient, la probabilité est calibrée par Platt puis comparée à deux seuils.</p>
      <div class="formule">p<sub>t</sub> = 1 − σ( a·(b + w<sup>⊤</sup>z<sub>t</sub>) + c ), &nbsp;&nbsp; S<sub>t</sub> = 2p<sub>t</sub> − 1</div>
      <div class="formule"><span class="droit">acheter si</span> p<sub>t</sub> ≥ θ<sub>a</sub> = (m − B<sub>d</sub>) / (B<sub>u</sub> − B<sub>d</sub>) = <span class="droit">0,580</span><br>
        <span class="droit">vendre si</span> p<sub>t</sub> ≤ θ<sub>v</sub> = (S<sub>d</sub> − m) / (S<sub>d</sub> − S<sub>u</sub>) = <span class="droit">0,456</span></div>
      <ul class="points">
        <li>Les coûts sont mesurés sur l'entraînement, où un achat couvert rapporte +3,89 % un mois de hausse et perd 4,18 % un mois de baisse.</li>
        <li>La marge <i>m</i> = 0,5 % par mois a été fixée à l'avance, sans la régler sur la validation.</li>
        <li>Pour la couverture, nous n'avons trouvé aucun signal et nous restons donc toujours couverts.</li>
      </ul>
    </div>
    <div class="carte">
      <h3>Figée avant de voir le test</h3>
      <p>Le modèle, la calibration, les coûts, la marge et la couverture sont écrits dans un fichier, commité
        (<code>0d8df2f</code>) avant toute évaluation sur le test (<code>775a352</code>).</p>
      <div class="alerte"><b>Engagement pris à l'avance.</b> Si le modèle perd aussi contre le modèle constant sur le
        test, la recommandation sera « toujours acheter, couvert ».</div>
      <p class="note" style="margin-top:14px">La calibration de Platt est apprise sur les prédictions hors fold. Un premier
        essai sur la validation donnait des pentes négatives, ce qui inversait les modèles, et nous l'avons écarté.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/03_fiabilite_brute.png" alt="Reliability diagrams">
    <figcaption>Reliability diagrams codés à la main. Hors fold, les points suivent la diagonale. Sur la validation, la
      courbe de la logistique descend, ce qui veut dire que les baisses arrivent moins souvent quand elle les annonce avec
      plus d'assurance.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> Avant même l'examen final, le modèle ne convainc pas. Nous figeons tout de même nos choix, pour pouvoir le juger honnêtement. <span class="precis">Plus précisément, sur la validation, la logistique calibrée ne bat pas le modèle constant (log-loss de 0,699 contre 0,681), et la règle évite 7 baisses sur 10 mais rate la hausse de 2023.</span></div>
</section>


<!-- ============ Test ============ -->
<section id="test">
  <p class="surtitre">Le test 2024-2026</p>
  <h2>Une seule évaluation, et un engagement tenu</h2>
  <p class="chapo">La règle évite presque toutes les baisses, mais elle reste hors du marché pendant une hausse de
    82 %. Sur la courbe, la couleur des points indique l'action prise ce mois-là.</p>
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
      <p class="note" style="margin-top:14px">Le modèle est <b>trop confiant dans la baisse</b>. Il en annonce 52 % en
        moyenne alors qu'on en observe 36 %, et nous ne nous fierions pas à ces probabilités pour décider.</p>
    </div>
    <div class="carte">
      <h3>Actions et réalité du mois suivant</h3>
      <table class="tableau" id="tableau-actions">
        <thead><tr><th>Action</th><th class="num">Hausses réalisées</th><th class="num">Baisses réalisées</th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="note" style="margin-top:14px">La couverture permanente, en revanche, était le bon choix, avec +82,3 % sur
        le test contre +57,9 % sans couverture.</p>
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
    <p class="note" style="margin-top:12px">Avec 3 à 9 baisses par sous-groupe, ces écarts restent fragiles. Nos données ne
      concernent aucune personne et ne contiennent donc pas d'attribut sensible. Nous avons transposé l'analyse d'équité
      à ces groupes de mois.</p>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Le modèle échoue à l'examen final, et nous recommandons donc d'acheter et de garder, en se protégeant contre le yen. <span class="precis">Plus précisément, il ne fait mieux que le modèle constant qu'en 2024, année où il détecte les six baisses. La couverture permanente, de son côté, était le bon choix (+82,3 % contre +57,9 %).</span></div>
</section>


<!-- ============ Simulateur ============ -->
<section id="simulateur">
  <p class="surtitre">Simulateur · paramétrable</p>
  <h2>Et si la règle avait été réglée autrement&nbsp;?</h2>
  <p class="chapo">Vous pouvez déplacer la marge, changer la couverture ou interdire la vente. Les seuils, les actions et
    la courbe se recalculent aussitôt.</p>
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
  <p class="chapo">Voici ce que le système produit avec les données de fin octobre 2026, le dernier mois disponible, et
    comment lire ce résultat.</p>
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
        <li><b>Volume d'articles (+0,58).</b> Il y a eu en octobre deux fois plus d'articles que d'habitude, et c'est ce qui pousse le plus le signal vers la baisse.</li>
        <li><b>Taux japonais à 10 ans (−0,30).</b> Il a reculé de 21 points de base, ce qui pousse vers la hausse.</li>
        <li><b>Portage (+0,14).</b> Sa valeur sort du domaine vu à l'entraînement, cette contribution est donc à lire avec prudence.</li>
        <li><b>Momentum 12 mois (+0,10).</b> Le Nikkei a gagné 21 % en un an et le modèle parie à contre-courant.</li>
      </ul>
      <p class="note" style="margin-top:12px">Contributions en log-odds de la baisse. Leur somme, ajoutée au niveau moyen du
        modèle puis calibrée, donne la probabilité affichée.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:18px"><img src="/figures/04_shap_waterfall_2026-10.png" alt="Décomposition SHAP de la prédiction d'octobre 2026">
    <figcaption>Décomposition complète de la prédiction, variable par variable (notebook 04).</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> Le modèle annonce plutôt une baisse pour novembre, mais nous ne suivons pas son avis et nous
    maintenons notre conseil d'acheter en se couvrant. <span class="precis">Plus précisément, la moitié des vingt dernières séances
    n'ont aucun article collecté, si bien que le pic d'articles d'octobre repose sur peu de jours, et le modèle s'est
    montré trop pessimiste sur l'ensemble du test.</span></div>
</section>

<!-- ============ Changement de régime ============ -->
<?php
// Ce qui a changé après 2021 : chaque ligne devient une carte recto (avant) / verso (depuis 2022).
$bascules = [
    ['Portage de la couverture', '−0,4 % / an', '+2,2 % / an', "La BoJ sort des taux négatifs. Couvrir le yen coûtait de l'argent, cela en rapporte désormais."],
    ["Volume d'articles et rendement du mois suivant", '−0,38', '+0,29', "Cette corrélation de rang change de signe en 2022-2023, puis reste instable."],
    ['Articles sur la BoJ, par mois', '55', '73', "La normalisation monétaire occupe la presse."],
    ['Probabilité de baisse annoncée par le modèle', '40 %', '52 %', "Alors que les baisses réelles passent de 39 % à 36 % des mois."],
    ['Variation du taux japonais à 10 ans', 'neutre', 'nuisible', "Son importance par permutation passe de +0,001 à −0,027 sur le test."],
    ['Momentum 12 mois, lu à contre-courant', 'payant', 'perdant', "Rebonds en V jusqu'en 2021, tendance durable ensuite."],
];
?>
<section id="regime" class="regime">
  <p class="surtitre">Changement de régime</p>
  <h2>Ce que le modèle avait appris a changé de sens</h2>
  <p class="chapo">Le modèle a appris sur 2010-2021. Depuis 2022, la Banque du Japon normalise sa politique et plusieurs
    relations se retournent. Les deux boutons font passer d'une époque à l'autre, et un clic retourne une carte.</p>
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
      <p>Sur le test, le portage se trouve à 6 écarts-types de sa moyenne d'entraînement. Le modèle linéaire prolonge
        alors une pente apprise sur un intervalle étroit, ce qui ajoute tous les mois +0,25 de log-odds vers « baisse ».</p></div>
    <div class="carte"><h3>Un pari contrarien</h3>
      <p>Le momentum 12 mois, contrarien pendant les rebonds en V de 2018-2021, parie contre une tendance qui a duré
        de 2024 à 2026.</p></div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/04_inversion_signal_news.png" alt="Signal des news mois par mois">
      <figcaption>En haut, la corrélation glissante sur 24 mois entre volume d'articles et rendement suivant. En bas,
        la contribution SHAP de cette variable.</figcaption></figure>
    <figure class="figure"><img src="/figures/04_shap_beeswarm_test.png" alt="SHAP global sur le test">
      <figcaption>SHAP global sur le test. Le portage, le momentum 12 mois et le JGB 10 ans poussent vers « baisse »
        presque tous les mois.</figcaption></figure>
  </div>
  <div class="carte" style="margin-top:20px">
    <h3>Les limites que nous déclarons</h3>
    <ul class="points">
      <li><b>Un petit échantillon.</b> Nous n'avons que 143 mois d'entraînement et 12 baisses dans le test, ce qui rend fragiles les écarts entre modèles et entre sous-groupes.</li>
      <li><b>Un test qui n'était pas entièrement invisible.</b> Notre exploration affichait déjà des statistiques du bloc test avant le gel, et la couverture permanente n'a donc pas été choisie à l'aveugle.</li>
      <li><b>Des variables choisies</b> à partir d'une analyse de 2017-2026, période qui recouvre la validation et le test.</li>
      <li><b>L'équité.</b> Nos données ne concernent aucune personne et ne contiennent aucun attribut sensible. Nous avons transposé l'analyse à des groupes de mois, sans trouver d'écart au-delà du bruit.</li>
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
      <p class="note">Le coût est l'opposé de la log-vraisemblance de Bernoulli.</p>
      <div class="formule">J(w, b) = − (1/m) Σ [ y log p + (1 − y) log(1 − p) ]</div>
      <p class="note">La règle de la chaîne donne son gradient, qui vaut l'erreur multipliée par l'entrée.</p>
      <div class="formule">∇<sub>w</sub> J = (1/m) X<sup>⊤</sup>(p − y)</div>
      <p class="note">La pénalité L2 revient à poser un a priori gaussien sur les poids.</p>
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
      <figcaption>Sensibilité au pas α. Quand il est trop petit la descente est lente, et au-delà de la limite elle ne converge plus.</figcaption></figure>
    <figure class="figure"><img src="/figures/05_sensibilite_lambda.png" alt="Sensibilité à lambda">
      <figcaption>Sensibilité à λ. Sans pénalité le modèle sur-apprend, et la log-loss de validation croisée est la plus basse au λ choisi par Optuna.</figcaption></figure>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Notre calcul fait à la main retombe sur celui de l'outil standard, et tout indique que le signal recherché est faible. <span class="precis">Plus précisément, une régularisation plus forte ou un arrêt plus précoce rapprochent le modèle de la constante, ce que l'on attend d'un signal faible et instable dans le temps.</span></div>
</section>


<!-- ============ Vérifications après coup ============ -->
<?php
$verif = api_get('verifications');
$vol = api_get('volatilite');
$nb_battent = $verif['vingt_modeles']['battent_la_constante']['test'] ?? 3;
$nb_essais = $verif['vingt_modeles']['battent_la_constante']['sur'] ?? 38;
$jour = $verif['base_journaliere'] ?? [];
$jour_cloture = $jour['lendemain, décision à la clôture de Tokyo'] ?? ['observations' => 668, 'auc' => 0.492];
$jour_piege = $jour['lendemain, en connaissant Wall Street du soir (piège : pas encore connu à la clôture)'] ?? ['auc' => 0.711];
$long = $verif['historique_long'] ?? [];
$libelle_fenetre = ['croissante' => 'tout le passé', 'glissante' => '60 derniers mois'];
?>
<section id="verifications">
  <p class="surtitre">Après le test · trois vérifications</p>
  <h2>Un autre modèle aurait-il fait mieux ?</h2>
  <p class="chapo">Une fois le résultat connu, la question s'impose. Nous y avons répondu de trois façons, en gardant en tête que ces
    essais viennent après l'ouverture du test : ils éclairent le résultat du projet, ils ne le remplacent pas.</p>
  <div class="grille g3">
    <div class="carte"><h3>Vingt modèles, réentraînés chaque mois</h3>
      <p>Régressions logistiques, forêts, LightGBM, réseau de neurones, modèles de séries temporelles… Pour prédire un mois,
        ils n'apprennent que sur les mois précédents, puis ils réapprennent le mois suivant.</p>
      <p class="note"><?= $nb_battent ?> essais sur <?= $nb_essais ?> passent devant la prévision constante, avec une avance
        quatre fois plus petite que leur incertitude.</p></div>
    <div class="carte"><h3>La base jour par jour</h3>
      <p>Avec <?= number_format(4118, 0, ',', ' ') ?> séances au lieu de 201 mois, les modèles ont vingt fois plus d'exemples. Sur les
        <?= (int) $jour_cloture['observations'] ?> séances du test, ils ne devinent pas mieux le sens du lendemain qu'un tirage à pile ou face.</p>
      <p class="note">AUC de <?= decimal((float) $jour_cloture['auc'], 2) ?>, pour 0,50 au hasard. Rien non plus à 5 et à 20 séances.</p></div>
    <div class="carte"><h3>Vingt-cinq ans d'historique</h3>
      <p>Faire apprendre le modèle depuis 2000 plutôt que depuis 2010 n'aide pas : le Japon des années 2000 baissait plus
        souvent, et ce qui annonçait alors une baisse annonce plutôt une hausse aujourd'hui.</p>
      <p class="note">Log-loss de la prévision constante sur le test : <?= decimal((float) ($long['2000-01']['constante'] ?? 0.667)) ?> en partant de 2000,
        <?= decimal((float) ($long['2010-02']['constante'] ?? 0.660)) ?> en partant de 2010.</p></div>
  </div>
<?php if ($verif): ?>
  <div class="grille g2" style="margin-top:20px">
    <div class="carte">
      <h3>Les mieux classés sur le test, et quelques repères</h3>
      <table class="tableau">
        <thead><tr><th>Modèle</th><th>Apprend sur</th><th class="num">Log-loss</th><th class="num">Écart</th></tr></thead>
        <tbody>
<?php
$classement = $verif['vingt_modeles']['classement_sur_le_test'];
$reperes = ['logistique L2 (modèle du projet)|croissante', 'LightGBM (projet)|croissante', 'réseau de neurones (8 neurones)|croissante', 'Bayes naïf gaussien|croissante'];
foreach ($classement as $rang => $ligne):
    if ($rang >= 4 && !in_array($ligne['modele'] . '|' . $ligne['fenetre'], $reperes, true)) { continue; }
    $constant = str_starts_with($ligne['modele'], 'constante') && $ligne['fenetre'] === 'croissante'; ?>
          <tr<?= $constant ? ' class="repere"' : '' ?>><td><?= $constant ? '<b>Prévision constante</b>' : e(ucfirst($ligne['modele'])) ?></td><td><?= e($libelle_fenetre[$ligne['fenetre']]) ?></td>
            <td class="num"><?= decimal((float) $ligne['log_loss']) ?></td>
            <td class="num"><?= $constant ? 'référence' : signe((float) $ligne['ecart'], 3) . ' ± ' . decimal((float) $ligne['erreur_type']) ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Un écart négatif veut dire « mieux que la prévision constante ». Le modèle qui paraissait le meilleur
        sur 2016-2023 (<?= e($verif['vingt_modeles']['choix_sur_2016_2023']) ?>, sur 60 mois) finit parmi les moins bons sur le test.</p>
    </div>
    <div class="carte">
      <h3>Un piège que la base journalière contenait</h3>
      <p>Dans notre base, la ligne d'un jour donné contient la clôture de Wall Street de ce même jour. Or New York ferme plusieurs heures
        après Tokyo. Un modèle qui lit cette colonne « devine » le lendemain <?= pct(0.66) ?> du temps, avec une information qu'il
        n'aurait pas eue au moment de décider.</p>
      <table class="tableau">
        <tbody>
          <tr><td>Décision à la clôture de Tokyo, données décalées d'un jour</td><td class="num">AUC <?= decimal((float) $jour_cloture['auc'], 2) ?></td></tr>
          <tr><td>La même, en lisant Wall Street du soir</td><td class="num">AUC <?= decimal((float) $jour_piege['auc'], 2) ?></td></tr>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Nous avons donc décalé d'un jour tout ce qui ne vient pas de la Bourse de Tokyo. Un signal subsiste à
        l'ouverture du lendemain (AUC 0,59), mais l'indice ouvre avec des cours en partie périmés et nous n'avons pas de quoi le vérifier.</p>
    </div>
  </div>
<?php endif; ?>
  <div class="conclusion"><b>Conclusion.</b> Changer de modèle, le réentraîner chaque mois ou lui donner vingt fois plus de données ne change pas la réponse. <span class="precis">Plus précisément, le blocage vient de l'information disponible : des prix, des taux et des titres de presse publics sont déjà intégrés dans le cours. Continuer à essayer des variantes sur les mêmes 33 mois finirait par en trouver une qui réussit par hasard.</span></div>
</section>


<!-- ============ Second volet : la volatilité ============ -->
<?php
$vp = $vol['prevision'] ?? [];
$va = $vol['agitation'] ?? [];
$vu = $vol['usage'] ?? [];
$prochain = $vol['mois_prochain'] ?? null;
$retenue = $vol['methode']['methode_retenue_pour_l_usage'] ?? '';
$auc_agite = (float) ($va['test_2024_2026']['modeles']['logistique']['auc'] ?? 0.707);
$r2_vol = (float) ($vp['test_2024_2026']['methodes'][$retenue]['r2_hors_echantillon'] ?? 0.183);
$position = $vu['test_2024_2026']['position'] ?? null;
?>
<section id="volatilite">
  <p class="surtitre">Second volet · ajouté après le test</p>
  <h2>Le sens ne se prévoit pas. L'agitation, un peu.</h2>
  <p class="chapo">Puisque nous ne savons pas dire si le Nikkei va monter ou baisser, nous avons changé de question : le mois prochain
    sera-t-il calme ou agité ? Les mêmes mois, le même découpage, la même discipline de réentraînement, mais une autre cible.</p>
<?php if ($vol): ?>
  <div class="grille g2">
    <div class="carte">
      <h3>Sept façons de prévoir la volatilité du mois suivant</h3>
      <table class="tableau">
        <thead><tr><th>Méthode</th><th class="num">R² 2016-2023</th><th class="num">R² test</th></tr></thead>
        <tbody>
<?php foreach ($vp['test_2024_2026']['methodes'] as $nom => $m): if ($nom === 'moyenne passée') { continue; } ?>
          <tr><td><?= e(ucfirst($nom)) ?></td><td class="num"><?= signe((float) $vp['avant_test_2016_2023']['methodes'][$nom]['r2_hors_echantillon'], 2) ?></td>
            <td class="num"><?= signe((float) $m['r2_hors_echantillon'], 2) ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Le R² se lit par rapport à une prévision qui annoncerait toujours la volatilité moyenne : 0 veut dire
        « pas mieux », 1 « parfait ». Presque toutes les méthodes sont au-dessus de zéro sur les deux périodes, ce que nous n'avons jamais
        obtenu pour le sens du marché. Leur classement change d'une période à l'autre.</p>
    </div>
    <div class="carte">
      <h3>Le mois prochain sera-t-il agité ?</h3>
      <p class="note">Un mois est dit agité quand sa volatilité dépasse 20 % par an, la moyenne du Nikkei. La démarche est celle du projet :
        une régression logistique, comparée à une prévision constante.</p>
      <table class="tableau">
        <thead><tr><th>Modèle</th><th class="num">AUC 2016-2023</th><th class="num">AUC test</th><th class="num">Écart de log-loss, test</th></tr></thead>
        <tbody>
<?php foreach (['logistique' => 'Régression logistique', 'LightGBM bridé' => 'LightGBM bridé'] as $cle => $nom): $t = $va['test_2024_2026']['modeles'][$cle]; ?>
          <tr><td><?= e($nom) ?></td><td class="num"><?= decimal((float) $va['avant_test_2016_2023']['modeles'][$cle]['auc'], 2) ?></td>
            <td class="num"><?= decimal((float) $t['auc'], 2) ?></td><td class="num"><?= signe((float) $t['ecart_vs_constante'], 3) ?> ± <?= decimal((float) $t['erreur_type']) ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Une AUC de 0,50 correspond au hasard. Le modèle classe bien les mois, sur les deux périodes. Sur 33 mois,
        l'avantage en log-loss reste plus petit que son incertitude : le test compte <?= (int) $va['test_2024_2026']['mois_agites'] ?> mois agités sur 33,
        bien plus qu'avant, et les probabilités annoncées sont trop basses.</p>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <div class="carte">
      <h3>À quoi cela sert : doser la position</h3>
      <p class="note">On investit moins quand un mois agité est annoncé : la part placée vaut 15 % divisés par la volatilité prévue, plafonnée à 100 %.
        Le reste attend au taux sans risque. Rendements en euros couverts, comme dans le projet.</p>
      <table class="tableau">
        <thead><tr><th>Sur le test</th><th class="num">Rendement</th><th class="num">Pire mois</th><th class="num">Par unité de risque</th></tr></thead>
        <tbody>
<?php foreach (['acheter_et_garder' => 'Acheter et garder', 'position_dosee' => 'Position dosée'] as $cle => $nom): $b = $position[$cle]; ?>
          <tr><td><?= e($nom) ?></td><td class="num"><?= signe(100 * (float) $b['cumul'], 1, ' %') ?></td><td class="num"><?= signe(100 * (float) $b['pire_mois'], 1, ' %') ?></td>
            <td class="num"><?= decimal((float) $b['rendement_par_unite_de_risque'], 2) ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">La position dosée perd moins dans le pire mois et gagne moins au total. Rapporté au risque pris, le résultat
        est le même. Nous ne présentons donc pas ce dosage comme une meilleure stratégie.</p>
    </div>
    <div class="carte">
      <h3>Ce que le volet annonce pour novembre 2026</h3>
<?php if ($prochain): ?>
      <table class="tableau">
        <tbody>
          <tr><td>Volatilité prévue <span class="note">(moyenne passée : <?= decimal((float) $prochain['volatilite_moyenne_passee_%'], 0) ?> %)</span></td><td class="num"><b><?= decimal((float) $prochain['volatilite_prevue_%'], 0) ?> % par an</b></td></tr>
          <tr><td>Chance d'un mois agité</td><td class="num"><b><?= decimal((float) $prochain['probabilite_mois_agite_%'], 0) ?> %</b></td></tr>
          <tr><td>Perte mensuelle dépassée environ une fois sur vingt</td><td class="num"><b><?= signe((float) $prochain['perte_mensuelle_depassee_1_fois_sur_20_%'], 1) ?> %</b></td></tr>
          <tr><td>Part investie par la position dosée</td><td class="num"><b><?= decimal((float) $prochain['part_investie_conseillee_%'], 0) ?> %</b></td></tr>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Octobre 2026 a été nerveux, d'où une chance sur deux d'un nouveau mois agité. Sur 2016-2023, le seuil
        de perte annoncé a été dépassé <?= (int) $vu['avant_test_2016_2023']['volatilité prévue']['pertes_au_dela_du_seuil_5_%'] ?> fois pour
        <?= decimal((float) $vu['avant_test_2016_2023']['volatilité prévue']['attendues_5_%'], 1) ?> attendues, et sur le test
        <?= (int) $vu['test_2024_2026']['volatilité prévue']['pertes_au_dela_du_seuil_5_%'] ?> fois pour <?= decimal((float) $vu['test_2024_2026']['volatilité prévue']['attendues_5_%'], 1) ?>.
        Une volatilité constante aurait donné les mêmes comptes : le risque annoncé est fiable, sans être plus fin.</p>
<?php endif; ?>
    </div>
  </div>
<?php else: ?>
  <p class="note">Les chiffres de ce volet viennent de l'API Python, qui ne répond pas.</p>
<?php endif; ?>
  <div class="conclusion"><b>Conclusion.</b> Nous ne savons pas annoncer où va le Nikkei, mais nous savons dire, mieux que le hasard, s'il va s'agiter. <span class="precis">Plus précisément, la volatilité se prévoit avec un R² hors échantillon proche de 0,2 et les mois agités se reconnaissent avec une AUC de <?= decimal($auc_agite, 2) ?>. Cette prévision sert à annoncer le risque et à doser la position, sans battre « acheter et garder » à risque égal. Le volet a été construit après l'ouverture du test.</span></div>
</section>


<!-- ============ Signal d'achat fondé sur le risque ============ -->
<?php
$sr = api_get('signal_risque');
$sr_regle = $sr['regle'] ?? ['seuils_volatilite_annuelle' => [0.20, 0.27], 'confirmation_soirs' => 3];
[$sr_bas, $sr_haut] = $sr_regle['seuils_volatilite_annuelle'];
$sr_tout = $sr['strategies']['2003-2026 (tout)'] ?? [];
$sr_cle = 'signal risque, chaque jour (règle figée)';
$sr_ratio_signal = (float) ($sr_tout[$sr_cle]['rendement_par_unite_de_risque'] ?? 0.37);
$sr_ratio_garder = (float) ($sr_tout['acheter et garder']['rendement_par_unite_de_risque'] ?? 0.48);
$sr_jour = $sr['aujourd_hui'] ?? null;
$sr_noms = ['acheter et garder' => 'Acheter et garder', $sr_cle => 'Signal chaque jour (règle figée)',
            'signal risque, seulement en fin de mois' => 'Signal en fin de mois', 'position dosée en continu (risque visé / risque prévu)' => 'Position dosée en continu'];
?>
<section id="risque">
  <p class="surtitre">Second volet · un signal d'achat fondé sur le risque</p>
  <h2>Acheter quand le risque est bas, depuis 2000</h2>
  <p class="chapo">Nous ne cherchons plus à deviner la hausse ou la baisse. Chaque soir, après la clôture de Tokyo, nous prévoyons la volatilité
    des vingt séances à venir, et ce risque prévu dit combien investir. La règle a été choisie avec les seules années 2000-2015, puis figée
    avant de regarder 2016-2026. Elle s'ajoute au résultat du projet, elle ne le remplace pas.</p>
<?php if ($sr): ?>
  <div class="grille g2">
    <div class="carte">
      <h3>La règle, figée sur 2000-2015</h3>
      <table class="tableau">
        <thead><tr><th>Risque prévu pour le mois qui vient</th><th class="num">Signal</th></tr></thead>
        <tbody>
          <tr><td>sous <?= decimal(100 * $sr_bas, 0) ?> % par an</td><td class="num"><b>acheter plein</b></td></tr>
          <tr><td>entre <?= decimal(100 * $sr_bas, 0) ?> et <?= decimal(100 * $sr_haut, 0) ?> %</td><td class="num"><b>acheter à moitié</b></td></tr>
          <tr><td>au-dessus de <?= decimal(100 * $sr_haut, 0) ?> %</td><td class="num"><b>ne pas acheter</b></td></tr>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">La prévision vient d'une régression linéaire sur le logarithme de la volatilité : volatilité du Nikkei
        sur un jour, une semaine, un mois et un trimestre, écart entre le plus haut et le plus bas, VIX, S&amp;P 500 et dollar-yen de la veille,
        baisse récente. Un changement de niveau doit se confirmer <?= (int) $sr_regle['confirmation_soirs'] ?> soirs de suite. On achète ou on vend
        à la clôture du lendemain, avec 0,05 % de frais. L'argent non investi rapporte l'Euribor.</p>
    </div>
    <div class="carte">
      <h3>Ce qu'il a donné, en euros couverts</h3>
      <table class="tableau">
        <thead><tr><th>2003-2026</th><th class="num">Par an</th><th class="num">Volatilité</th><th class="num">Pire perte</th><th class="num">Par unité de risque</th></tr></thead>
        <tbody>
<?php foreach ($sr_noms as $cle => $nom): $b = $sr_tout[$cle] ?? null; if (!$b) { continue; } ?>
          <tr<?= $cle === $sr_cle ? ' class="repere"' : '' ?>><td><?= e($nom) ?></td><td class="num"><?= signe((float) $b['rendement_annuel_%'], 1, ' %') ?></td>
            <td class="num"><?= decimal((float) $b['volatilite_%'], 0) ?> %</td><td class="num"><?= signe((float) $b['perte_maximale_%'], 0, ' %') ?></td>
            <td class="num"><?= decimal((float) $b['rendement_par_unite_de_risque'], 2) ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Par période, le rendement par unité de risque du signal face à « acheter et garder » :
<?php foreach (['2003-2015 (réglage)' => '2003-2015', '2016-2023' => '2016-2023', '2024-2026' => '2024-2026'] as $per => $lib):
    $st = $sr['strategies'][$per]; ?>
        <?= $lib ?> : <?= decimal((float) $st[$sr_cle]['rendement_par_unite_de_risque'], 2) ?> contre <?= decimal((float) $st['acheter et garder']['rendement_par_unite_de_risque'], 2) ?><?= $per === '2024-2026' ? '.' : ' ;' ?>
<?php endforeach; ?>
        Sur l'ensemble, l'écart vaut <?= signe((float) $sr['comparaisons']['2003-2026 (tout)']['ecart'], 2) ?> ± <?= decimal((float) $sr['comparaisons']['2003-2026 (tout)']['erreur_type'], 2) ?>.</p>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <div class="carte">
      <h3>Trois crises, trois histoires</h3>
      <table class="tableau">
        <thead><tr><th>Épisode</th><th class="num">Acheter et garder</th><th class="num">Signal</th></tr></thead>
        <tbody>
<?php foreach ($sr['episodes'] as $nom => $x): ?>
          <tr><td><?= e(ucfirst($nom)) ?></td><td class="num"><?= signe(100 * (float) $x['garder'], 1, ' %') ?></td><td class="num"><?= signe(100 * (float) $x['regle'], 1, ' %') ?></td></tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">En 2008, la baisse a duré des mois : le signal était sorti à temps. En 2020 et en août 2024, la chute a
        été brutale et le rebond immédiat : le signal a vendu après la chute, près du creux, et raté la remontée. Un signal fondé sur le risque
        réagit toujours un peu après le choc.</p>
    </div>
    <div class="carte">
      <h3>Le signal aujourd'hui</h3>
<?php if ($sr_jour): ?>
      <table class="tableau">
        <tbody>
          <tr><td>Date</td><td class="num"><?= e($sr_jour['date']) ?></td></tr>
          <tr><td>Volatilité prévue pour les vingt prochaines séances</td><td class="num"><b><?= decimal((float) $sr_jour['volatilite_prevue_%'], 1) ?> % par an</b></td></tr>
          <tr><td>Zone de risque</td><td class="num"><?= e($sr_jour['zone_du_jour']) ?></td></tr>
          <tr class="repere"><td>Signal</td><td class="num"><b><?= e($sr_jour['signal']) ?></b></td></tr>
        </tbody>
      </table>
<?php endif; ?>
      <p class="note" style="margin-top:12px">La prévision du risque s'est dégradée avec le temps : R² hors échantillon de
        <?= decimal((float) ($sr['prevision']['2003-2015 (réglage)'][$sr_regle['modele']] ?? 0.37), 2) ?> sur 2003-2015,
        <?= decimal((float) ($sr['prevision']['2016-2023'][$sr_regle['modele']] ?? 0.21), 2) ?> sur 2016-2023 et proche de zéro sur 2024-2026,
        où les secousses sont arrivées sans prévenir.</p>
    </div>
  </div>
<?php else: ?>
  <p class="note">Les chiffres de ce volet viennent de l'API Python, qui ne répond pas.</p>
<?php endif; ?>
  <div class="conclusion"><b>Conclusion.</b> Le signal fondé sur le risque réduit les pertes et la volatilité, surtout dans les crises longues, mais il ne fait pas gagner davantage par unité de risque. <span class="precis">Plus précisément, sur 2003-2026, son rendement par unité de risque vaut <?= decimal($sr_ratio_signal, 2) ?> contre <?= decimal($sr_ratio_garder, 2) ?> pour « acheter et garder », un écart qui reste dans l'incertitude. La version en fin de mois fait un peu mieux, mais elle n'était pas la règle figée : la choisir maintenant reviendrait à régler la règle sur les années qui servent à la juger.</span></div>
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
<script type="module" src="/assets/recit.js"></script>
<?php require __DIR__ . '/pied.php'; ?>

