<?php
/**
 * Immersive home page (English): the project told in eight chapters by a scroll-driven 3D particle cloud.
 * Figures come from the Python API and runs/evaluation_test.json; the full story is at /en/recit.
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$signal = api_get('signal');
$eval = lire_runs('evaluation_test.json');
$modele = $eval['metriques']['logistique']['log-loss'] ?? 0.708;
$constante = $eval['metriques']["constante (fréquence de l'entraînement)"]['log-loss'] ?? 0.657;
$achat = $eval['performance_euros']['toujours acheter, couvert']['cumul'] ?? 0.823;
$regle = $eval['performance_euros']['règle du modèle']['cumul'] ?? 0.035;
// The frozen file rounds cumulative returns to 4 decimals (0.8235 would show +82.4%): recompute them month by month when the API responds.
if ($mois_test = api_get('historique', ['bloc' => 'test'])) {
    $achat = array_product(array_map(fn ($m) => 1 + $m['rendement_achat_couvert'], $mois_test)) - 1;
    $regle = array_product(array_map(fn ($m) => 1 + $m['rendement_regle'], $mois_test)) - 1;
}
$p = $signal['p_hausse'] ?? 0.45;

$chapitres = [
    ['Opening', "Buy, stay neutral or sell the Nikkei\u{00A0}225?", 'Every month, a signal drawn from the news and the markets to help a euro-based investor decide.', 'Scroll'],
    ['Data', '201 months of market data, 13,700 articles', "The cloud draws the Nikkei 225 from 2010 to 2026. The news, scored by FinBERT, only starts in 2017.", '2010 → 2026'],
    ['Split', 'Time does not get shuffled', 'We split training, validation and test in chronological order. The decision was frozen by a commit before we opened the last block.', '143 · 24 · 33 months'],
    ['Learning', 'Descending the cost surface', 'We coded logistic regression by hand, from the likelihood through the Gaussian prior to the gradient. It matches scikit-learn to within 5 × 10⁻⁶.', 'λ = 0.117'],
    ['Signal', pct($p) . ' probability of a rise', $signal ? 'With data up to the end of ' . mois_lisible($signal['mois_des_donnees']) . ', the model\'s rule would say “' . action_en($signal['action_du_modele']) . '”.' : 'The Python API is stopped; this value is only an example.', 'S = ' . signe(2 * $p - 1)],
    ['Verdict', 'The model does not beat the floor', 'Log-loss ' . decimal($modele) . ' versus ' . decimal($constante) . ' for the constant model. We keep our commitment and recommend “always buy, hedged”.', signe(100 * $achat, 1, '%') . ' versus ' . signe(100 * $regle, 1, '%')],
    ['Regime', 'What it had learned flipped sign', 'Since 2022 the Bank of Japan has been normalising its policy. The link between news volume and next-month return reverses.', '−0.38 → +0.29'],
    ['Enter', 'The whole project, in detail', 'You will find the predictor, the simulator, the six executed notebooks, the report and the Maths appendix.', ''],
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nikkei Project</title>
<style>
  :root { --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --papier: #f1eadb; --encre: #15110e; --vermillon: #de3220; --indigo: #26407c; }
  * { box-sizing: border-box; }
  html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }
  body { margin: 0; background: var(--papier); color: var(--encre); font-family: var(--sans); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  .xp { height: <?= count($chapitres) * 100 ?>vh; }
  .scene { position: sticky; top: 0; height: 100vh; overflow: hidden; background: var(--papier); }
  .scene::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5; mix-blend-mode: multiply;   /* grain du papier */
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .4  0 0 0 0 .32  0 0 0 .5 0'/></filter><rect width='220' height='220' filter='url(%23g)'/></svg>"); }
  .soleil { position: absolute; left: 0; top: 0; width: 100vh; height: 100vh; border-radius: 50%; background: var(--vermillon); will-change: transform; transform-origin: 0 0; }
  .scene canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .hud { position: absolute; inset: 0; z-index: 2; pointer-events: none; font: 12px var(--mono); letter-spacing: .08em; }
  .hud a, .hud button { pointer-events: auto; }
  .marque { position: absolute; left: 44px; top: 34px; color: var(--encre); text-decoration: none; display: flex; align-items: center; gap: 14px; }
  .marque .kanji { font: 500 34px/1 "Hiragino Mincho ProN", "Yu Mincho", "Songti SC", serif; letter-spacing: .04em; }
  .marque small { font: 10.5px var(--mono); letter-spacing: .16em; text-transform: uppercase; line-height: 1.5; }
  .coin { position: absolute; right: 44px; top: 34px; text-align: right; text-transform: uppercase; }
  .langue { position: absolute; right: 44px; top: 128px; color: var(--encre); text-decoration: none; border: 1px solid var(--encre); padding: 6px 9px; }
  .langue:hover { background: var(--encre); color: var(--papier); }
  .coin b { display: block; font: 200 60px/1 var(--sans); letter-spacing: -.05em; }
  .vertical { position: absolute; right: 48px; top: 50%; translate: 0 -50%; writing-mode: vertical-rl; text-transform: uppercase; letter-spacing: .3em; opacity: .55; }
  .etat { position: absolute; left: 62px; top: 112px; text-transform: uppercase; opacity: .5; writing-mode: vertical-rl; letter-spacing: .2em; font-size: 10px; }
  .chapitre { position: absolute; left: 44px; top: 50%; width: min(460px, 42vw); opacity: 0; translate: 0 calc(-50% + 40px);
    transition: opacity .6s, translate .9s cubic-bezier(.2, .8, .2, 1); pointer-events: none; }
  .chapitre.actif { opacity: 1; translate: 0 -50%; }
  .chapitre .num { text-transform: uppercase; display: flex; align-items: center; gap: 12px; }
  .chapitre .num::before { content: ""; width: 34px; height: 1px; background: var(--encre); }
  .chapitre h2 { font: 300 clamp(32px, 4vw, 62px)/1.0 var(--sans); letter-spacing: -.045em; margin: 18px 0 18px; }
  .chapitre p { font: 16px/1.5 var(--sans); letter-spacing: 0; margin: 0 0 20px; max-width: 400px; }
  .chapitre .valeur { display: inline-block; padding: 9px 13px; background: var(--encre); color: var(--papier); text-transform: uppercase; }
  .chapitre .liens { display: flex; flex-wrap: wrap; gap: 8px; }
  .chapitre.actif .liens a { pointer-events: auto; }
  .liens a { color: var(--encre); text-decoration: none; text-transform: uppercase; padding: 13px 16px; border: 1px solid var(--encre); transition: background .2s, color .2s; }
  .liens a:hover { background: var(--encre); color: var(--papier); }
  .liens a.plein { background: var(--vermillon); border-color: var(--vermillon); color: #fff; }
  .fil { position: absolute; left: 50%; bottom: 28px; translate: -50% 0; display: flex; gap: 18px; align-items: center; }
  .fil button { position: relative; background: none; border: 0; color: var(--encre); font: 12px var(--mono); letter-spacing: .08em; text-transform: uppercase; padding: 12px 16px; cursor: pointer; opacity: .32; transition: opacity .3s; white-space: nowrap; }
  .fil button.actif { opacity: 1; }
  .fil button::before, .fil button::after { content: ""; position: absolute; width: 9px; height: 9px; border: 1.5px solid var(--vermillon); opacity: 0; transition: opacity .3s, inset .35s; }
  .fil button::before { left: 7px; top: 7px; border-right: 0; border-bottom: 0; }
  .fil button::after { right: 7px; bottom: 7px; border-left: 0; border-top: 0; }
  .fil button.actif::before { opacity: 1; left: 0; top: 0; } .fil button.actif::after { opacity: 1; right: 0; bottom: 0; }
  .jauge-defilement { position: absolute; left: 44px; top: 110px; width: 1px; height: 90px; background: rgba(21, 17, 14, .2); }
  .jauge-defilement i { position: absolute; left: -1px; top: 0; width: 3px; height: 18px; background: var(--vermillon); }
  @media (max-width: 800px) { .chapitre { width: calc(100vw - 48px); left: 24px; top: auto; bottom: 96px; translate: 0 30px; } .chapitre.actif { translate: 0 0; }
    .vertical, .jauge-defilement, .etat { display: none; } .marque { left: 24px; } .coin { right: 24px; } .coin b { font-size: 40px; }
    .fil { gap: 0; } .fil button:not(.actif) { display: none; } }
  /* ----- Ouverture : écran d'encre, puis ouverture circulaire depuis le soleil ----- */
  @media (max-width: 800px) { .langue { right: 24px; top: 104px; } }
  .intro { position: fixed; inset: 0; z-index: 60; background: var(--encre); color: var(--papier); display: grid; place-items: center;
    clip-path: circle(150% at 66% 50%); transition: clip-path 1.25s cubic-bezier(.7, 0, .15, 1); }
  .intro.ouvre { clip-path: circle(0% at 66% 50%); pointer-events: none; }
  .intro .kanji { font: 500 min(34vw, 46vh)/1 "Hiragino Mincho ProN", "Yu Mincho", "Songti SC", serif; letter-spacing: .02em; animation: respire 1.6s ease-in-out infinite alternate; }
  .intro .nombre { position: absolute; left: 44px; bottom: 36px; font: 200 72px/1 var(--sans); letter-spacing: -.05em; }
  .intro .legende { position: absolute; right: 44px; bottom: 44px; font: 11px var(--mono); letter-spacing: .14em; text-transform: uppercase; opacity: .7; text-align: right; }
  .intro .trait { position: absolute; left: 0; bottom: 0; height: 3px; width: 0; background: var(--vermillon); }
  @keyframes respire { from { opacity: .82; transform: scale(.985); } to { opacity: 1; transform: scale(1); } }
  .hud { opacity: 0; transition: opacity 1.2s .7s; } body.pret .hud { opacity: 1; }
  .signe { position: absolute; right: -3vh; bottom: -16vh; font: 500 82vh/1 "Hiragino Mincho ProN", "Yu Mincho", "Songti SC", serif; color: var(--encre); opacity: 0; pointer-events: none; will-change: transform, opacity; }
  .signe.visible { opacity: .055; transition: opacity 1.4s; }
  .soleil { filter: url(#encre); }
  @media (max-width: 800px) { .signe { font-size: 60vh; } .intro .nombre { left: 24px; font-size: 52px; } .intro .legende { right: 24px; } }
  @media (prefers-reduced-motion: reduce) { .intro { display: none; } .hud { opacity: 1; transition: none; } .soleil { filter: none; } }
</style>
<link rel="stylesheet" href="/assets/effets.css">
</head>
<body data-sans-rideau>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="encre" x="-10%" y="-10%" width="120%" height="120%">
  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="3" seed="7" result="bruit"/>
  <feDisplacementMap in="SourceGraphic" in2="bruit" scale="38" xChannelSelector="R" yChannelSelector="G"/></filter></svg>
<div class="intro" id="intro" aria-hidden="true">
  <span class="kanji">日経</span>
  <span class="nombre" id="intro-nombre">000</span>
  <span class="legende">Nikkei 225 · 2010 → 2026<br>16,000 drops of ink</span>
  <i class="trait" id="intro-trait"></i>
</div>
<main class="xp" id="xp">
  <div class="scene">
    <div class="signe" id="signe" aria-hidden="true">序</div>
    <div class="soleil" id="soleil" aria-hidden="true"></div>
    <canvas id="toile" aria-hidden="true"></canvas>
    <div class="hud">
      <a class="marque" href="/en"><span class="kanji">日経</span><small>Nikkei 225<br>Albert School · 2026</small></a>
      <a class="langue" href="/" lang="fr" hreflang="fr" title="Version française">FR</a>
      <div class="coin"><b id="compteur">01</b><span>/ <?= sprintf('%02d', count($chapitres)) ?> · <span id="nom-chapitre">Opening</span></span></div>
<?php foreach ($chapitres as $i => [$nom, $titre, $texte, $valeur]): ?>
      <section class="chapitre<?= $i === 0 ? ' actif' : '' ?>" data-chapitre="<?= $i ?>">
        <div class="num"><?= sprintf('%02d', $i + 1) ?> — <?= e($nom) ?></div>
        <h2 data-texte="<?= e($titre) ?>"><?= e($titre) ?></h2>
        <p><?= e($texte) ?></p>
<?php if ($i === count($chapitres) - 1): ?>
        <div class="liens">
          <a class="plein" href="/en/recit">The full story</a>
          <a href="/en/recit#explorateur">Predict</a>
          <a href="/en/notebooks">Notebooks</a>
          <a href="/rapport.pdf" target="_blank">Report PDF (FR)</a>
        </div>
<?php elseif ($valeur !== ''): ?>
        <span class="valeur"><?= e($valeur) ?></span>
<?php endif; ?>
      </section>
<?php endforeach; ?>
      <div class="vertical">Ink · particles · data</div>
      <nav class="fil" id="fil">
<?php foreach ($chapitres as $i => [$nom]): ?>
        <button data-aller="<?= $i ?>"<?= $i === 0 ? ' class="actif"' : '' ?>><?= e($nom) ?></button>
<?php endforeach; ?>
      </nav>
      <div class="etat" id="etat">16,000 drops of ink · scroll</div>
      <div class="jauge-defilement"><i id="curseur"></i></div>
    </div>
  </div>
</main>
<script>window.PROJET = <?= json_encode(['p' => $p, 'seuils' => $signal['seuils'] ?? ['theta_v' => 0.456, 'theta_a' => 0.58], 'regle' => $regle, 'achat' => $achat, 'noms' => array_column($chapitres, 0)], JSON_UNESCAPED_UNICODE) ?>;</script>
<script src="/assets/effets.js"></script>
<script type="module" src="/assets/experience.js"></script>
</body>
</html>
