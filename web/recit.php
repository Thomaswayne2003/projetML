<?php
/**
 * Le récit (/recit) : le dossier complet, dans l'identité d'encre de l'expérience.
 * Le contenu est celui de index.php. Cette page le remet en scène : chaque chapitre s'ouvre sur une planche plein
 * écran (acte, numéro, titre, ce qu'il faut retenir) pendant que le nuage de particules dessine la figure du chapitre.
 */
declare(strict_types=1);
$theme = 'encre';
ob_start();
require __DIR__ . '/index.php';
$html = ob_get_clean();

$p = $signal ? pct($signal['p_hausse']) : '45 %';
// identifiant de la section => [acte, sceau, titre court du rail, chiffre à retenir, phrase à retenir]
$chapitres = [
    'resultat'    => ['Acte I · Le verdict', '断', 'Résultat', decimal($modele['log-loss']) . ' <small>contre ' . decimal($constante['log-loss']) . '</small>',
                      "Log-loss du modèle contre celle du modèle constant, sur le test. Le plancher n'est pas battu : la recommandation est « toujours acheter, couvert »."],
    'explorateur' => ['Acte I · Le verdict', '断', 'Prédicteur', $p,
                      "de probabilité de hausse pour novembre 2026, avec les vraies valeurs d'octobre. Déplacez un curseur : l'aiguille de la jauge, à droite, suit le modèle."],
    'dataset'     => ['Acte II · Les données', '数', 'Dataset', '201 mois',
                      "Une ligne par mois, de février 2010 à octobre 2026. Les news n'existent qu'à partir d'avril 2017 : avant, le modèle n'a que les marchés."],
    'methode'     => ['Acte II · Les données', '数', 'Méthode', '143 · 24 · 33',
                      "mois pour apprendre, régler et juger, dans l'ordre du temps. Le test n'est regardé qu'une seule fois, après avoir tout figé."],
    'exploration' => ['Acte II · Les données', '数', 'Exploration', '61 %',
                      "des mois, le Nikkei monte. Une seule variable sort du bruit : le volume anormal d'articles. Le sentiment des news ne prédit presque rien.",
                      "Avant de modéliser, on regarde les 200 mois étiquetés : la part de hausses, la couverture des news, et ce que chaque variable dit du mois suivant, sans jamais utiliser d'information future."],
    'modeles'     => ['Acte III · Le modèle', '学', 'Modèles', '200 essais',
                      "d'Optuna pour trois modèles. Le plus flexible gagne en validation croisée, puis perd sur 2022-2023 : la régression logistique est retenue."],
    'decision'    => ['Acte III · Le modèle', '学', 'Décision', '0,456 · 0,580',
                      "Les deux seuils de la règle. Sous le premier on vend, au-dessus du second on achète, entre les deux on reste neutre. Tout est figé avant le test.",
                      "Une probabilité n'est pas encore une action. On la calibre, puis on la compare à deux seuils, calculés à partir des gains et des pertes mesurés sur l'entraînement."],
    'test'        => ['Acte IV · L\'épreuve', '兆', 'Test', '11 / 12',
                      "baisses évitées par la règle, mais 18 hausses manquées sur 21. En euros : " . signe(100 * $regle, 1, ' %') . " contre " . signe(100 * $achat_couvert, 1, ' %') . " pour l'achat couvert."],
    'simulateur'  => ['Acte IV · L\'épreuve', '兆', 'Simulateur', signe(100 * $regle, 1, '&nbsp;%'),
                      "pour la règle du projet, marge de 0,5 %. Changez la marge, la couverture ou la vente : c'est une exploration après coup, pas un nouveau réglage."],
    'projection'  => ['Acte IV · L\'épreuve', '兆', 'Projection', $p,
                      "de probabilité de hausse pour novembre 2026 : la règle dirait « vendre ». Nous ne la suivons pas, la recommandation reste « acheter, couvert »."],
    'regime'      => ['Acte V · Comprendre', '転', 'Régime', '2022',
                      "La Banque du Japon normalise sa politique. Plusieurs relations apprises sur 2010-2021 changent de sens."],
    'pourquoi'    => ['Acte V · Comprendre', '転', 'Diagnostic', '2024',
                      "est la seule année du test où le modèle fait mieux que le modèle constant. Les barres, à droite, le montrent mois par mois.",
                      "Trois causes expliquent l'échec, et toutes viennent du même fait : le monde de 2022-2026 ne ressemble plus à celui sur lequel le modèle a appris."],
    'maths'       => ['Acte V · Comprendre', '転', 'Maths', '4,6 × 10⁻⁶',
                      "L'écart entre la descente de gradient codée à la main et scikit-learn. Le coût est strictement convexe : un seul minimum.",
                      "La log-loss se dérive du maximum de vraisemblance, son gradient s'écrit (1/m)·Xᵀ(p − y), et la pénalité L2 est un a priori gaussien sur les poids. La descente codée à la main le vérifie."],
    'ressources'  => ['Acte VI · Les pièces', '入', 'Ressources', '6 notebooks',
                      "deux PDF et une API : chaque chiffre de cette page peut être vérifié à la source.",
                      "Les six notebooks, le rapport, l'annexe mathématique et l'API : tout ce qui a servi à écrire cette page."],
];

$total = count($chapitres);
$html = preg_replace_callback(
    '~<section id="([a-z]+)"((?: class="[^"]*")?)>\s*<p class="surtitre">((?:(?!</p>).)*)</p>\s*<h2>((?:(?!</h2>).)*)</h2>(?:\s*<p class="chapo">((?:(?!</p>).)*)</p>)?~s',
    function (array $m) use ($chapitres, $total): string {
        if (!isset($chapitres[$m[1]])) {
            return $m[0];
        }
        [$acte, $sceau, $court, $chiffre, $phrase] = $chapitres[$m[1]];
        $chapo = $m[5] ?? '' ?: e($chapitres[$m[1]][5] ?? '');
        $numero = str_pad((string) (array_search($m[1], array_keys($chapitres), true) + 1), 2, '0', STR_PAD_LEFT);
        return '<section id="' . $m[1] . '"' . $m[2] . '>
  <div class="ouverture" data-chapitre="' . $m[1] . '" data-court="' . e($court) . '"><div class="ouverture-in">
    <p class="acte"><span class="sceau">' . $sceau . '</span><span>' . e($acte) . '</span><i></i><b>' . $numero . '</b><span>/ ' . $total . '</span></p>
    <p class="surtitre">' . $m[3] . '</p>
    <h2>' . $m[4] . '</h2>
    <p class="chapo">' . $chapo . '</p>
    <div class="retenir"><span class="etiquette">À retenir</span><b>' . $chiffre . '</b><p>' . e($phrase) . '</p></div>
  </div></div>
  <p class="detail"><span>Le détail</span></p>';
    },
    $html
);
echo $html;
