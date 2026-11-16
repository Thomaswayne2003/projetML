<?php
/**
 * Accueil immersif : le projet raconté en neuf scènes 3D, que la caméra traverse au fil du défilement (assets/monde.js).
 * Les chiffres viennent de l'API Python et de runs/evaluation_test.json ; le détail est dans le récit (/recit).
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$signal = api_get('signal');
$eval = lire_runs('evaluation_test.json');
$modele = $eval['metriques']['logistique']['log-loss'] ?? 0.708;
$constante = $eval['metriques']["constante (fréquence de l'entraînement)"]['log-loss'] ?? 0.657;
$achat = $eval['performance_euros']['toujours acheter, couvert']['cumul'] ?? 0.823;
$regle = $eval['performance_euros']['règle du modèle']['cumul'] ?? 0.035;
// Le fichier figé arrondit les cumuls à 4 décimales (0,8235 s'afficherait +82,4 %) : on les recalcule mois par mois quand l'API répond.
if ($mois_test = api_get('historique', ['bloc' => 'test'])) {
    $achat = array_product(array_map(fn ($m) => 1 + $m['rendement_achat_couvert'], $mois_test)) - 1;
    $regle = array_product(array_map(fn ($m) => 1 + $m['rendement_regle'], $mois_test)) - 1;
}
$p = $signal['p_hausse'] ?? 0.45;
$volatilite = api_get('volatilite');
$auc_agite = (float) ($volatilite['agitation']['test_2024_2026']['modeles']['logistique']['auc'] ?? 0.71);

$chapitres = [
    ['Ouverture', "Acheter, rester neutre ou vendre le Nikkei\u{00A0}225\u{00A0}?", "Peut-on deviner ce que fera la Bourse japonaise le mois prochain ? Nous avons essayé, avec l'actualité et les chiffres des marchés.", 'Faire défiler'],
    ['Données', '201 mois de marché, 13 700 articles', "Voici seize ans de Bourse japonaise, avec une barre par mois. Elle est bleue quand le mois suivant a monté, rouge quand il a baissé. Nous y avons ajouté des milliers de titres de presse, notés par un outil appelé FinBERT.", '2010 → 2026'],
    ['Découpage', 'Le temps ne se mélange pas', "Les mois se rangent en trois blocs, dans l'ordre du temps. Le modèle apprend sur le premier, nous faisons nos réglages sur le deuxième, et le troisième sert d'examen final, regardé une seule fois.", '143 · 24 · 33 mois'],
    ['Apprentissage', 'Descendre la surface de coût', "Le modèle cherche ses réglages comme cette bille, qui roule vers le fond d'un bol. Nous avons reprogrammé ce calcul (la descente de gradient) à la main, et nous retrouvons le résultat de scikit-learn à 5 × 10⁻⁶ près.", 'λ = 0,117'],
    ['Signal', pct($p) . ' de probabilité de hausse', $signal ? 'Avec les données de fin ' . mois_lisible($signal['mois_des_donnees']) . ", la règle du modèle conduirait à « " . $signal['action_du_modele'] . " »." : "L'API Python est arrêtée, cette valeur est donnée à titre d'exemple.", 'S = ' . signe(2 * $p - 1)],
    ['Verdict', 'Le modèle ne fait pas mieux qu\'une prévision toute simple', "Acheter et garder a rapporté bien plus que suivre le modèle. " . 'Son erreur (log-loss) atteint ' . decimal($modele) . ' contre ' . decimal($constante) . " pour le modèle constant, et nous recommandons donc d'acheter en se couvrant contre le yen.", signe(100 * $achat, 1, ' %') . ' contre ' . signe(100 * $regle, 1, ' %')],
    ['Régime', "Ce qu'il avait appris a changé de sens", "En 2022, la banque centrale du Japon change de politique, et la courbe pivote. Ce que le modèle avait appris sur la presse s'est alors inversé : la corrélation est passée de −0,38 à +0,29.", '−0,38 → +0,29'],
    ['Risque', "Le sens ne se prévoit pas. L'agitation, un peu.", "Les lames montrent l'agitation du Nikkei mois après mois, en rouge quand elle a été forte. Les deux fils bleus sont ce que nous annoncions un mois plus tôt. Nous avons ajouté ce second volet après le test : il annonce le risque, sans battre « acheter et garder ».", 'AUC ' . decimal($auc_agite, 2) . ' contre 0,50'],
    ['Entrer', 'Tout le projet, en détail', "Vous y trouverez le prédicteur, le simulateur, les six notebooks exécutés, le rapport et l'annexe de Maths.", ''],
];
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Projet Nikkei · expérience</title>
<style>
  :root { --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; --sans: "Helvetica Neue", Helvetica, Arial, sans-serif;
    --papier: #f1eadb; --encre: #15110e; --vermillon: #de3220; --indigo: #26407c; }
  * { box-sizing: border-box; }
  html { scrollbar-width: none; } html::-webkit-scrollbar { display: none; }
  body { margin: 0; background: var(--papier); color: var(--encre); font-family: var(--sans); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  html { scroll-snap-type: y proximity; }
  .xp { height: <?= count($chapitres) * 100 ?>vh; position: relative; }
  .arret { position: absolute; left: 0; width: 1px; height: 100vh; scroll-snap-align: start; pointer-events: none; }
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
  <span class="legende">Nikkei 225 · 2010 → 2026<br>neuf scènes en 3D</span>
  <i class="trait" id="intro-trait"></i>
</div>
<main class="xp" id="xp">
<?php foreach ($chapitres as $i => $c): ?>  <i class="arret" style="top: <?= $i * 100 ?>vh"></i>
<?php endforeach; ?>  <div class="scene">
    <div class="signe" id="signe" aria-hidden="true">序</div>
    <canvas id="toile" aria-hidden="true"></canvas>
    <div class="hud">
      <a class="marque" href="/"><span class="kanji">日経</span><small>Nikkei 225<br>Albert School · 2026</small></a>
      <div class="coin"><b id="compteur">01</b><span>/ <?= sprintf('%02d', count($chapitres)) ?> · <span id="nom-chapitre">Ouverture</span></span></div>
<?php foreach ($chapitres as $i => [$nom, $titre, $texte, $valeur]): ?>
      <section class="chapitre<?= $i === 0 ? ' actif' : '' ?>" data-chapitre="<?= $i ?>">
        <div class="num"><?= sprintf('%02d', $i + 1) ?> — <?= e($nom) ?></div>
        <h2 data-texte="<?= e($titre) ?>"><?= e($titre) ?></h2>
        <p><?= e($texte) ?></p>
<?php if ($i === count($chapitres) - 1): ?>
        <div class="liens">
          <a class="plein" href="/recit?presenter">Présenter</a>
          <a href="/recit">Lire le récit</a>
          <a href="/recit#explorateur">Prédire</a>
          <a href="/notebooks">Notebooks</a>
          <a href="/rapport.pdf" target="_blank">Rapport PDF</a>
        </div>
<?php elseif ($valeur !== ''): ?>
        <span class="valeur"><?= e($valeur) ?></span>
<?php endif; ?>
      </section>
<?php endforeach; ?>
      <div class="vertical">Encre · volume · données</div>
      <nav class="fil" id="fil">
<?php foreach ($chapitres as $i => [$nom]): ?>
        <button data-aller="<?= $i ?>"<?= $i === 0 ? ' class="actif"' : '' ?>><?= e($nom) ?></button>
<?php endforeach; ?>
      </nav>
      <div class="etat" id="etat">Neuf scènes en 3D · faire défiler</div>
      <div class="jauge-defilement"><i id="curseur"></i></div>
    </div>
  </div>
</main>
<script>window.PROJET = <?= json_encode(['p' => $p, 'seuils' => $signal['seuils'] ?? ['theta_v' => 0.456, 'theta_a' => 0.58], 'regle' => $regle, 'achat' => $achat, 'noms' => array_column($chapitres, 0)], JSON_UNESCAPED_UNICODE) ?>;</script>
<script src="/assets/effets.js"></script>
<script type="module" src="/assets/monde.js"></script>
</body>
</html>
