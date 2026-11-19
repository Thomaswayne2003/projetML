<?php
/**
 * Le récit (/recit) : tout le projet, pensé comme le support d'une présentation orale.
 * Le contenu vient de inc/contenu.php. Cette page le met en scène : chaque chapitre s'ouvre sur une double
 * page, avec à gauche son titre, une explication « En clair » puis la version « En termes techniques », et à droite
 * un graphique animé tracé à partir des données de l'API (web/assets/recit.js). En mode présentation (touche P),
 * ces doubles pages deviennent des diapositives et le détail ne s'ouvre qu'à la demande.
 */
declare(strict_types=1);
ob_start();
require __DIR__ . '/inc/contenu.php';
$html = ob_get_clean();

$p = $signal ? pct($signal['p_hausse']) : '45 %';
$ll = decimal($modele['log-loss']);
$ll0 = decimal($constante['log-loss']);
$gain_regle = signe(100 * $regle, 1, ' %');
$gain_achat = signe(100 * $achat_couvert, 1, ' %');

// identifiant de la section => [acte, sceau, titre court du rail, titre de la diapositive (null : celui de index.php),
//                               explication en clair, chiffre clé, version technique]
$chapitres = [
    'resultat' => ['Acte I · Le verdict', '断', 'Résultat', null,
        "Nous espérions repérer à l'avance les mois où la Bourse japonaise baisse. Notre modèle en repère une partie, mais il s'inquiète beaucoup trop souvent. Quelqu'un qui aurait simplement acheté puis attendu aurait gagné bien davantage, et nous avons choisi de le dire clairement.",
        $ll . ' <small>contre ' . $ll0 . '</small>',
        "Sur le test, la log-loss du modèle reste au-dessus de celle du modèle constant, et sa PR-AUC n'atteint que 0,420 contre 0,364 pour le hasard. Nous recommandons donc la stratégie de référence, « toujours acheter, couvert »."],
    'explorateur' => ['Acte I · Le verdict', '断', 'Prédicteur', null,
        "Ici, vous pouvez jouer avec le modèle. Vous choisissez un mois, vous modifiez par exemple la quantité d'articles parus ou la tendance de la Bourse, et vous voyez tout de suite si le modèle devient plus optimiste ou plus prudent.",
        $p,
        "de probabilité de hausse pour novembre 2026, avec les vraies valeurs d'octobre. Le site interroge l'API, qui recalcule la probabilité calibrée, l'action de la règle et la contribution des variables en log-odds."],
    'dataset' => ['Acte II · Les données', '数', 'Dataset', null,
        "Il n'existait aucun fichier tout prêt pour ce projet. Nous avons rassemblé nous-mêmes des cours de Bourse, des taux d'intérêt et des milliers de titres de presse, puis nous avons tout rangé dans un grand tableau d'une ligne par mois. Nous avons veillé à ne jamais donner au modèle une information qui n'était pas encore connue à la date concernée.",
        '201 mois',
        "de février 2010 à octobre 2026. Les séries sont retardées jusqu'à leur date de publication pour écarter toute fuite temporelle, et les variables de news (GDELT, notées par FinBERT) ne commencent qu'en avril 2017."],
    'methode' => ['Acte II · Les données', '数', 'Méthode', null,
        "Pour savoir si un modèle prévoit vraiment, il faut le tester sur des mois qu'il n'a jamais vus. Nous avons donc coupé nos données en trois périodes qui se suivent. La première sert à apprendre, la deuxième à faire nos réglages, et la dernière à juger le résultat, une seule fois.",
        '143 · 24 · 33',
        "mois d'entraînement, de validation et de test, séparés dans l'ordre chronologique. Les hyperparamètres sont réglés par validation croisée temporelle (TimeSeriesSplit), et la décision est figée par un commit avant l'évaluation sur le test."],
    'exploration' => ['Acte II · Les données', '数', 'Exploration', 'Ce que les données disent avant tout modèle',
        "Avant de construire un modèle, nous avons simplement regardé les données. La Bourse japonaise monte environ six mois sur dix, si bien que parier sur la hausse tous les mois donne déjà souvent raison. Parmi tout ce que nous avons mesuré, une seule chose semble annoncer la suite : les mois où la presse parle beaucoup plus du Japon que d'habitude.",
        '61 %',
        "des mois se terminent par une hausse. Sur l'entraînement, seul le volume anormal d'articles est nettement lié au rendement suivant (corrélation de rang de −0,38), alors que le sentiment FinBERT ne prédit presque rien (+0,03)."],
    'modeles' => ['Acte III · Le modèle', '学', 'Modèles', null,
        "Nous avons essayé trois modèles, du plus simple au plus sophistiqué. Les plus sophistiqués semblaient meilleurs pendant les réglages, puis ils se sont révélés moins bons sur des mois plus récents, parce qu'ils avaient surtout retenu des détails du passé. Nous avons donc gardé le plus simple.",
        '200 essais',
        "d'Optuna au total. En validation croisée, LightGBM atteint une log-loss de 0,584 contre 0,647 pour la régression logistique, mais aucun modèle ne bat le modèle constant sur 2022-2023 (0,681). La règle de baseline nous fait retenir la logistique régularisée L2."],
    'decision' => ['Acte III · Le modèle', '学', 'Décision', null,
        "Le modèle ne dit jamais « achetez » ou « vendez ». Il donne seulement une chance de hausse, par exemple 45 %. Nous avons donc fixé une règle simple : on achète si cette chance est élevée, on vend si elle est faible, et on ne fait rien entre les deux. Cette règle a été écrite noir sur blanc avant de regarder les derniers mois, pour qu'il soit impossible de l'arranger après coup.",
        '0,456 · 0,580',
        "Ces deux seuils découlent de l'espérance de gain, avec les coûts mesurés sur l'entraînement (+3,89 % un mois de hausse, −4,18 % un mois de baisse) et une marge de 0,5 % par mois. La probabilité est d'abord calibrée par Platt sur les prédictions hors fold."],
    'test' => ['Acte IV · L\'épreuve', '兆', 'Test', null,
        "Voici le moment de vérité : nous appliquons la règle aux 33 derniers mois, que le modèle n'a jamais vus. Elle évite presque toutes les baisses, ce qui paraît très bien. Seulement, elle y parvient en restant presque toujours à l'écart de la Bourse, et elle rate ainsi une très forte hausse.",
        '11 / 12',
        "baisses évitées, au prix de 18 hausses manquées sur 21. La log-loss vaut $ll contre $ll0 pour le modèle constant et l'ECE 0,183. En euros, la règle rapporte $gain_regle quand l'achat couvert rapporte $gain_achat."],
    'simulateur' => ['Acte IV · L\'épreuve', '兆', 'Simulateur', null,
        "Et si nous avions choisi une règle plus audacieuse, ou plus prudente ? Ce simulateur permet d'essayer. Il aide à comprendre comment la règle réagit, en gardant à l'esprit que retenir le meilleur réglage après avoir vu les résultats reviendrait à tricher.",
        signe(100 * $regle, 1, '&nbsp;%'),
        "avec la marge de 0,5 % retenue dans le projet. Modifier la marge déplace les deux seuils θ. Il s'agit d'une exploration après coup, puisque le test a déjà été regardé."],
    'projection' => ['Acte IV · L\'épreuve', '兆', 'Projection', null,
        "Voici ce que le modèle annonce pour le mois qui vient, novembre 2026. Il penche légèrement pour une baisse, surtout parce que la presse a beaucoup parlé du Japon en octobre. Comme ce modèle s'est trompé trop souvent, nous ne suivons pas son avis et nous gardons notre conseil d'acheter en se protégeant contre le yen.",
        $p,
        "de probabilité de hausse (score S = −0,10), sous le seuil de vente de 0,456. La contribution la plus forte vient du volume anormal d'articles (+0,58 en log-odds de la baisse), devant la variation du taux japonais à 10 ans (−0,30)."],
    'regime' => ['Acte V · Comprendre', '転', 'Régime', null,
        "Un modèle apprend en observant le passé. Or, en 2022, la banque centrale du Japon a commencé à changer de politique, après des années de taux très bas. Plusieurs choses que le modèle avait apprises sont alors devenues fausses, un peu comme un GPS qui garderait une vieille carte après des travaux.",
        '2022',
        "La Banque du Japon normalise sa politique. La corrélation entre le volume d'articles et le rendement suivant passe de −0,38 à +0,29, et le portage de la couverture de −0,4 % à +2,2 % par an."],
    'pourquoi' => ['Acte V · Comprendre', '転', 'Diagnostic', null,
        "Nous avons cherché pourquoi le modèle se trompe, et la raison tient en une phrase : il a appris dans un monde, puis on lui a demandé de prévoir dans un autre. Il ne fait mieux qu'une prévision toute simple que pendant la première année du test.",
        '2024',
        "seule année où l'écart de log-loss avec le modèle constant est favorable (−0,046, puis +0,077 en 2025 et +0,143 en 2026). Nous retenons trois causes : un signal de news instable, un portage à six écarts-types de sa moyenne d'entraînement, et un pari contrarien sur le momentum 12 mois."],
    'maths' => ['Acte V · Comprendre', '転', 'Maths', 'Les maths du modèle, refaites à la main',
        "Pour être sûrs de comprendre notre modèle, nous l'avons reprogrammé nous-mêmes, sans outil tout fait. Le modèle cherche ses réglages comme une bille qui roule vers le fond d'un bol, en avançant pas à pas dans le sens de la pente. Notre version arrive au même endroit que l'outil standard.",
        '4,6 × 10⁻⁶',
        "d'écart avec scikit-learn. La log-loss vient du maximum de vraisemblance, son gradient vaut (1/m)·Xᵀ(p − y), et la pénalité L2 équivaut à un a priori gaussien sur les poids (λ = 0,117, τ = 0,17). Le coût est strictement convexe."],
    'verifications' => ['Acte VI · Vérifier, puis pivoter', '確', 'Vérifications', 'Vingt modèles, vingt fois plus de données : même réponse',
        "Une fois le résultat connu, nous nous sommes demandé si un autre modèle aurait mieux réussi. Nous en avons essayé vingt, en les réentraînant tous les mois comme on le ferait dans la vraie vie. Nous avons recommencé avec des données jour par jour, puis avec vingt-cinq ans d'historique. Aucun ne fait mieux, de façon fiable, qu'une prévision qui répète toujours la même chose.",
        $nb_battent . ' <small>sur ' . $nb_essais . '</small>',
        "essais passent sous la log-loss du modèle constant sur le test, avec une avance quatre fois plus petite que son erreur type. Sur " . (int) $jour_cloture['observations'] . " séances, l'AUC du sens du lendemain vaut " . decimal((float) $jour_cloture['auc'], 2) . ". Ces essais viennent après l'ouverture du test et laissent le résultat figé intact."],
    'volatilite' => ['Acte VI · Vérifier, puis pivoter', '波', 'Volatilité', "Ce qui se prévoit : l'agitation du marché",
        "Nous ne savons pas dire si la Bourse va monter ou baisser. Nous savons mieux dire si elle va s'agiter, parce qu'un mois nerveux est souvent suivi d'un autre mois nerveux, un peu comme une mer qui met du temps à se calmer. Nous avons donc ajouté un second volet, qui annonce l'ampleur des mouvements à venir et la perte à laquelle il faut se préparer.",
        'AUC ' . decimal($auc_agite, 2),
        "pour reconnaître à l'avance un mois agité (volatilité au-dessus de 20 %) sur le test, contre 0,50 au hasard. La volatilité elle-même se prévoit avec un R² hors échantillon de " . decimal($r2_vol, 2) . ". Doser la position d'après ce risque adoucit le pire mois sans améliorer le rendement par unité de risque."],
    'risque' => ['Acte VI · Vérifier, puis pivoter', '守', 'Signal risque', "Acheter quand le risque est bas",
        "Puisque l'agitation se prévoit, nous en avons tiré un signal d'achat. Chaque soir, on regarde le risque annoncé pour le mois qui vient : s'il est bas, on achète plein ; moyen, à moitié ; très élevé, on reste en euros. Ce signal protège bien dans une crise qui dure, comme en 2008. Il vend trop tard quand la chute est brutale et le rebond immédiat, comme en 2020 ou en août 2024.",
        decimal($sr_ratio_signal, 2) . ' <small>contre ' . decimal($sr_ratio_garder, 2) . '</small>',
        "de rendement par unité de risque sur 2003-2026, en euros couverts, face à « acheter et garder ». Règle figée avec les données 2000-2015 : prévision de la volatilité à 20 séances par régression linéaire sur son logarithme, seuils à " . decimal(100 * $sr_bas, 0) . " et " . decimal(100 * $sr_haut, 0) . " %, confirmation sur trois soirs. Volatilité 16 % contre 23 %, pire perte −41 % contre −59 %."],
    'ressources' => ['Acte VII · Les pièces', '入', 'Ressources', null,
        "Tout ce que vous venez de voir peut être vérifié. Les calculs se trouvent dans six notebooks, et les deux documents rendus aux enseignants sont disponibles en PDF.",
        '6 notebooks',
        "exécutés de bout en bout, un rapport de 9 pages, une annexe mathématique de 4 pages et une API documentée."],
];
$sans_graphique = ['ressources'];        // chapitres qui s'ouvrent sans graphique

$total = count($chapitres);
$html = preg_replace_callback(
    '~<section id="([a-z]+)"((?: class="[^"]*")?)>\s*<p class="surtitre">((?:(?!</p>).)*)</p>\s*<h2>((?:(?!</h2>).)*)</h2>(?:\s*<p class="chapo">((?:(?!</p>).)*)</p>)?~s',
    function (array $m) use ($chapitres, $total, $sans_graphique): string {
        if (!isset($chapitres[$m[1]])) {
            return $m[0];
        }
        [$acte, $sceau, $court, $titre, $clair, $chiffre, $technique] = $chapitres[$m[1]];
        $numero = str_pad((string) (array_search($m[1], array_keys($chapitres), true) + 1), 2, '0', STR_PAD_LEFT);
        $seul = in_array($m[1], $sans_graphique, true);
        $planche = $seul ? '' : '
    <figure class="planche" data-planche="' . $m[1] . '"><div class="dessin"></div><figcaption></figcaption></figure>';
        return '<section id="' . $m[1] . '"' . $m[2] . '>
  <div class="ouverture' . ($seul ? ' sans-planche' : '') . '" data-chapitre="' . $m[1] . '" data-court="' . e($court) . '"><div class="ouverture-in" data-signe="' . $sceau . '">
    <div class="ouverture-texte">
      <p class="acte"><span class="sceau">' . $sceau . '</span><span>' . e($acte) . '</span><i></i><b>' . $numero . '</b><span>/ ' . $total . '</span></p>
      <p class="surtitre">' . $m[3] . '</p>
      <h2>' . ($titre !== null ? e($titre) : $m[4]) . '</h2>
      <div class="en-clair"><span class="etiquette">En clair</span><p>' . e($clair) . '</p></div>
      <div class="retenir"><span class="etiquette">En termes techniques</span><b>' . $chiffre . '</b><p>' . e($technique) . '</p></div>
    </div>' . $planche . '
  </div></div>
  <p class="detail"><span>Le détail</span></p>';
    },
    $html
);

// La diapositive de conclusion, avant les ressources : les quatre idées avec lesquelles repartir.
$bilan = [
    ['Acheter et garder, en se couvrant',
     "Notre modèle ne fait pas mieux qu'une prévision toute simple. Le meilleur conseil reste donc d'acheter le Nikkei et de se protéger contre les variations du yen.",
     "Log-loss de $ll contre $ll0 · $gain_achat contre $gain_regle sur le test"],
    ['Une méthode qui ne triche pas',
     "Le modèle n'a jamais vu le futur, nos choix ont été écrits avant l'examen final, et cet examen n'a eu lieu qu'une seule fois.",
     'Audit des fuites · décision figée au commit 0d8df2f · une seule évaluation du test'],
    ['Un échec que nous savons expliquer',
     "La banque centrale du Japon a changé de politique en 2022, et ce que le modèle avait appris a cessé d'être vrai.",
     'Corrélation news-rendement de −0,38 à +0,29 · portage à 6 écarts-types · modèle meilleur seulement en 2024'],
    ['Le risque, lui, se prévoit un peu',
     "Vingt autres modèles n'ont pas fait mieux. En revanche, nous savons annoncer si le mois prochain sera agité, donc la perte à laquelle se préparer.",
     'AUC de ' . decimal($auc_agite, 2) . ' pour les mois agités · R² de ' . decimal($r2_vol, 2) . ' · volet ajouté après le test'],
];
$points = '';
foreach ($bilan as $i => [$titre, $clair, $technique]) {
    $points .= '
      <li><i>' . ($i + 1) . '</i><div><b>' . e($titre) . '</b><p>' . e($clair) . '</p><small>' . e($technique) . '</small></div></li>';
}
$conclusion = '<section id="conclusion">
  <div class="ouverture" data-chapitre="conclusion" data-court="Conclusion"><div class="ouverture-in" data-signe="結">
    <div class="ouverture-texte">
      <p class="acte"><span class="sceau">結</span><span>Pour conclure</span><i></i></p>
      <p class="surtitre">Ce que nous retenons</p>
      <h2>Quatre idées avec lesquelles repartir</h2>
      <div class="en-clair"><span class="etiquette">En clair</span><p>Nous n\'avons pas trouvé de formule pour prévoir la Bourse japonaise, et nous pensons que ce résultat est utile. Il dit ce qu\'il vaut mieux faire, il a été obtenu sans tricher, et nous savons l\'expliquer.</p></div>
    </div>
    <ol class="bilan">' . $points . '
    </ol>
  </div></div>
</section>

';
$html = str_replace('<section id="ressources">', $conclusion . '<section id="ressources">', $html);
echo $html;
