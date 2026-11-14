<?php
/**
 * Le récit (/recit) : le dossier complet, dans l'identité d'encre de l'expérience.
 * Le contenu est celui de index.php. Cette page le remet en scène : chaque chapitre s'ouvre sur une double page,
 * avec à gauche son titre et ce qu'il faut en retenir, à droite un graphique animé tracé à partir des données de l'API
 * (web/assets/recit.js).
 */
declare(strict_types=1);
$theme = 'encre';
ob_start();
require __DIR__ . '/index.php';
$html = ob_get_clean();

$p = $signal ? pct($signal['p_hausse']) : '45 %';
// identifiant de la section => [acte, sceau, titre court du rail, chiffre à retenir, phrase à retenir, chapô de secours]
$chapitres = [
    'resultat'    => ['Acte I · Le verdict', '断', 'Résultat', decimal($modele['log-loss']) . ' <small>contre ' . decimal($constante['log-loss']) . '</small>',
                      "Sur le test, la log-loss du modèle reste au-dessus de celle du modèle constant. Nous recommandons donc la stratégie de référence, « toujours acheter, couvert »."],
    'explorateur' => ['Acte I · Le verdict', '断', 'Prédicteur', $p,
                      "de probabilité de hausse pour novembre 2026, calculée avec les vraies valeurs d'octobre. Un peu plus bas, les curseurs permettent de voir comment ce chiffre bouge."],
    'dataset'     => ['Acte II · Les données', '数', 'Dataset', '201 mois',
                      "de février 2010 à octobre 2026, à raison d'une ligne par mois. Les news ne commencent qu'en avril 2017 ; avant cette date, le modèle ne dispose que des données de marché."],
    'methode'     => ['Acte II · Les données', '数', 'Méthode', '143 · 24 · 33',
                      "mois pour apprendre, pour régler puis pour juger, toujours dans l'ordre du temps. Nous n'avons regardé le test qu'une seule fois, après avoir tout figé."],
    'exploration' => ['Acte II · Les données', '数', 'Exploration', '61 %',
                      "des mois se terminent par une hausse du Nikkei. Parmi nos variables, seul le volume anormal d'articles se détache du bruit, alors que le sentiment des news ne prédit presque rien.",
                      "Avant de modéliser, nous avons regardé de près les 200 mois étiquetés : la part de hausses, la couverture des news et le lien entre nos variables et le mois suivant, en veillant à ne jamais utiliser d'information future."],
    'modeles'     => ['Acte III · Le modèle', '学', 'Modèles', '200 essais',
                      "d'Optuna, répartis entre trois modèles et le modèle de couverture. Le plus flexible l'emporte en validation croisée puis perd sur 2022-2023, ce qui nous a fait retenir la régression logistique."],
    'decision'    => ['Acte III · Le modèle', '学', 'Décision', '0,456 · 0,580',
                      "Voici les deux seuils de la règle. En dessous du premier on vend, au-dessus du second on achète, et entre les deux on reste neutre. Ils ont été figés avant le test.",
                      "Une probabilité ne suffit pas pour agir. Nous la calibrons, puis nous la comparons à deux seuils calculés à partir des gains et des pertes mesurés sur l'entraînement."],
    'test'        => ['Acte IV · L\'épreuve', '兆', 'Test', '11 / 12',
                      "baisses évitées par la règle, au prix de 18 hausses manquées sur 21. En euros, elle rapporte " . signe(100 * $regle, 1, ' %') . " quand l'achat couvert rapporte " . signe(100 * $achat_couvert, 1, ' %') . "."],
    'simulateur'  => ['Acte IV · L\'épreuve', '兆', 'Simulateur', signe(100 * $regle, 1, '&nbsp;%'),
                      "avec la marge de 0,5 % retenue dans le projet. Le simulateur permet d'essayer d'autres réglages, à titre d'exploration puisque le test a déjà été regardé."],
    'projection'  => ['Acte IV · L\'épreuve', '兆', 'Projection', $p,
                      "de probabilité de hausse pour novembre 2026, ce qui conduirait la règle à vendre. Nous ne la suivons pas et nous gardons la recommandation « acheter, couvert »."],
    'regime'      => ['Acte V · Comprendre', '転', 'Régime', '2022',
                      "La Banque du Japon commence à normaliser sa politique, et plusieurs relations apprises sur 2010-2021 changent de sens."],
    'pourquoi'    => ['Acte V · Comprendre', '転', 'Diagnostic', '2024',
                      "reste la seule année du test où le modèle fait mieux que le modèle constant. Le graphique ci-contre le montre mois par mois.",
                      "Nous avons trouvé trois causes à cet échec. Elles ont un point commun : le monde de 2022-2026 ne ressemble plus à celui sur lequel le modèle a appris."],
    'maths'       => ['Acte V · Comprendre', '転', 'Maths', '4,6 × 10⁻⁶',
                      "d'écart entre notre descente de gradient codée à la main et scikit-learn. Le coût est strictement convexe, il n'a donc qu'un seul minimum.",
                      "La log-loss se déduit du maximum de vraisemblance, son gradient s'écrit (1/m)·Xᵀ(p − y) et la pénalité L2 revient à poser un a priori gaussien sur les poids. Notre descente de gradient codée à la main permet de le vérifier."],
    'ressources'  => ['Acte VI · Les pièces', '入', 'Ressources', '6 notebooks',
                      "deux PDF et une API. Tous les chiffres de cette page peuvent être vérifiés à la source.",
                      "Vous trouverez ici les six notebooks, le rapport, l'annexe mathématique et l'API, c'est-à-dire tout ce qui a servi à écrire cette page."],
];
$sans_graphique = ['ressources'];        // chapitres qui s'ouvrent sans graphique

$total = count($chapitres);
$html = preg_replace_callback(
    '~<section id="([a-z]+)"((?: class="[^"]*")?)>\s*<p class="surtitre">((?:(?!</p>).)*)</p>\s*<h2>((?:(?!</h2>).)*)</h2>(?:\s*<p class="chapo">((?:(?!</p>).)*)</p>)?~s',
    function (array $m) use ($chapitres, $total, $sans_graphique): string {
        if (!isset($chapitres[$m[1]])) {
            return $m[0];
        }
        [$acte, $sceau, $court, $chiffre, $phrase] = $chapitres[$m[1]];
        $chapo = $m[5] ?? '' ?: e($chapitres[$m[1]][5] ?? '');
        $numero = str_pad((string) (array_search($m[1], array_keys($chapitres), true) + 1), 2, '0', STR_PAD_LEFT);
        $seul = in_array($m[1], $sans_graphique, true);
        $planche = $seul ? '' : '
    <figure class="planche" data-planche="' . $m[1] . '"><div class="dessin"></div><figcaption></figcaption></figure>';
        return '<section id="' . $m[1] . '"' . $m[2] . '>
  <div class="ouverture' . ($seul ? ' sans-planche' : '') . '" data-chapitre="' . $m[1] . '" data-court="' . e($court) . '"><div class="ouverture-in" data-signe="' . $sceau . '">
    <div class="ouverture-texte">
      <p class="acte"><span class="sceau">' . $sceau . '</span><span>' . e($acte) . '</span><i></i><b>' . $numero . '</b><span>/ ' . $total . '</span></p>
      <p class="surtitre">' . $m[3] . '</p>
      <h2>' . $m[4] . '</h2>
      <p class="chapo">' . $chapo . '</p>
      <div class="retenir"><span class="etiquette">À retenir</span><b>' . $chiffre . '</b><p>' . e($phrase) . '</p></div>
    </div>' . $planche . '
  </div></div>
  <p class="detail"><span>Le détail</span></p>';
    },
    $html
);
echo $html;
