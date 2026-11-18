<?php
/**
 * The story (/en/recit), English version of web/recit.php.
 * The content comes from en/index.php. This page restages it: each chapter opens on a spread, with its title and the
 * key takeaway on the left and an animated chart drawn from the API data on the right (web/en/assets/recit.js).
 */
declare(strict_types=1);
$theme = 'encre';
$fr = '/recit';
ob_start();
require __DIR__ . '/index.php';
$html = ob_get_clean();

$p = $signal ? pct($signal['p_hausse']) : '45%';
// section id => [act, seal, short rail title, key figure, key sentence, fallback standfirst]
$chapitres = [
    'resultat'    => ['Act I · The verdict', '断', 'Result', decimal($modele['log-loss']) . ' <small>vs ' . decimal($constante['log-loss']) . '</small>',
                      'On the test, the model\'s log-loss stays above the constant model\'s. So we recommend the reference strategy, “always buy, hedged”.'],
    'explorateur' => ['Act I · The verdict', '断', 'Predictor', $p,
                      'probability of a rise for November 2026, computed with October\'s real values. A little further down, the sliders show how this figure moves.'],
    'dataset'     => ['Act II · The data', '数', 'Dataset', '201 months',
                      'from February 2010 to October 2026, one row per month. News only starts in April 2017; before that, the model has market data alone.'],
    'methode'     => ['Act II · The data', '数', 'Method', '143 · 24 · 33',
                      'months to learn, to tune and then to judge, always in time order. We looked at the test only once, after freezing everything.'],
    'exploration' => ['Act II · The data', '数', 'Exploration', '61%',
                      'of months end with a rise in the Nikkei. Among our features, only abnormal article volume stands out from the noise, while news sentiment predicts almost nothing.',
                      'Before modelling, we took a close look at the 200 labelled months: the share of rises, news coverage and the link between our features and the following month, making sure never to use future information.'],
    'modeles'     => ['Act III · The model', '学', 'Models', '200 trials',
                      'of Optuna, split across three models and the hedging model. The most flexible one wins in cross-validation and then loses on 2022-2023, which led us to keep logistic regression.'],
    'decision'    => ['Act III · The model', '学', 'Decision', '0.456 · 0.580',
                      'These are the rule\'s two thresholds. Below the first we sell, above the second we buy, and in between we stay neutral. They were frozen before the test.',
                      'A probability is not enough to act on. We calibrate it, then compare it with two thresholds computed from the gains and losses measured on training data.'],
    'test'        => ['Act IV · The trial', '兆', 'Test', '11 / 12',
                      'falls avoided by the rule, at the cost of 18 missed rises out of 21. In euros it returns ' . signe(100 * $regle, 1, '%') . ' while buying hedged returns ' . signe(100 * $achat_couvert, 1, '%') . '.'],
    'simulateur'  => ['Act IV · The trial', '兆', 'Simulator', signe(100 * $regle, 1, '%'),
                      'with the 0.5% margin used in the project. The simulator lets you try other settings, as exploration only, since the test has already been seen.'],
    'projection'  => ['Act IV · The trial', '兆', 'Projection', $p,
                      'probability of a rise for November 2026, which would lead the rule to sell. We do not follow it and keep the “buy, hedged” recommendation.'],
    'regime'      => ['Act V · Understanding', '転', 'Regime', '2022',
                      'The Bank of Japan starts normalising its policy, and several relationships learned on 2010-2021 flip sign.'],
    'pourquoi'    => ['Act V · Understanding', '転', 'Diagnosis', '2024',
                      'is the only test year in which the model beats the constant model. The chart alongside shows it month by month.',
                      'We found three causes for this failure. They share one thing: the world of 2022-2026 no longer looks like the one the model learned from.'],
    'maths'       => ['Act V · Understanding', '転', 'Maths', '4.6 × 10⁻⁶',
                      'gap between our hand-coded gradient descent and scikit-learn. The cost is strictly convex, so it has a single minimum.',
                      'Log-loss follows from maximum likelihood, its gradient is (1/m)·Xᵀ(p − y) and the L2 penalty amounts to a Gaussian prior on the weights. Our hand-coded gradient descent lets us check this.'],
    'ressources'  => ['Act VI · The exhibits', '入', 'Resources', '6 notebooks',
                      'two PDFs and an API. Every figure on this page can be checked at the source.',
                      'Here you will find the six notebooks, the report, the maths appendix and the API: everything that went into writing this page.'],
];
$sans_graphique = ['ressources'];        // chapters that open without a chart

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
      <div class="retenir"><span class="etiquette">Key takeaway</span><b>' . $chiffre . '</b><p>' . e($phrase) . '</p></div>
    </div>' . $planche . '
  </div></div>
  <p class="detail"><span>The detail</span></p>';
    },
    $html
);
echo $html;
