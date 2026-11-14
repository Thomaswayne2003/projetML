<?php
/**
 * Lecteur de notebooks : la liste vient de la configuration, le notebook choisi vient de l'URL (?nb=...).
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$noms = array_column(NOTEBOOKS, 0);
$demande = $_GET['nb'] ?? $noms[0];
$courant = NOTEBOOKS[array_search($demande, $noms, true) ?: 0];   // nom inconnu : premier notebook
$disponible = is_file(__DIR__ . '/nb/' . $courant[0] . '.html');

$titre = 'Notebook ' . $courant[1] . ' · Projet Nikkei';
$page = 'notebooks';
$theme = 'encre';
require __DIR__ . '/inc/entete.php';
?>
<div class="lecteur">
  <aside>
    <h2><span class="sceau">入</span>Notebooks</h2>
<?php foreach (NOTEBOOKS as [$nom, $numero, $libelle, $resume, $cours]): ?>
    <a class="nb<?= $nom === $courant[0] ? ' actif' : '' ?>" href="/notebooks?nb=<?= e($nom) ?>">
      <span class="num">Notebook <?= e($numero) ?> · <?= e($cours) ?></span>
      <b><?= e($libelle) ?></b>
      <span><?= e($resume) ?></span>
    </a>
<?php endforeach; ?>
    <p class="note" style="margin:16px 8px 0">Les notebooks sont affichés tels qu'ils ont été exécutés, avec leurs
      résultats et leurs figures. Les formules ont besoin d'une connexion internet pour s'afficher.</p>
  </aside>
  <div class="cadre">
    <div class="bandeau">
      <b>Notebook <?= e($courant[1]) ?> · <?= e($courant[2]) ?></b>
      <a href="/nb/<?= e($courant[0]) ?>.html" target="_blank">Ouvrir en pleine page</a>
      <a href="/ipynb/<?= e($courant[0]) ?>.ipynb" download>Télécharger le .ipynb</a>
    </div>
<?php if ($disponible): ?>
    <iframe src="/nb/<?= e($courant[0]) ?>.html" title="Notebook <?= e($courant[1]) ?>"></iframe>
<?php else: ?>
    <p class="alerte" style="margin:24px">Cette page n'a pas encore été générée. Lancez <code>python -m app.build_site</code>
      depuis la racine du projet.</p>
<?php endif; ?>
  </div>
</div>
<script>
// Les notebooks sont des pages HTML générées par Jupyter : on leur donne le papier et l'encre du site.
document.querySelector(".lecteur iframe")?.addEventListener("load", (e) => {
  const style = e.target.contentDocument.createElement("style");
  style.textContent = `:root { --jp-layout-color0: #f7f2e6; --jp-layout-color1: #f7f2e6; --jp-cell-editor-background: #efe8d8; --jp-cell-editor-border-color: #d9cfbb;
      --jp-content-link-color: #de3220; --jp-content-font-color1: #15110e; --jp-ui-font-color1: #15110e; --jp-border-color2: #d9cfbb; }
    body { background: #f7f2e6 !important; } h1, h2, h3 { font-weight: 300; letter-spacing: -.03em; }
    .jp-OutputArea-output img { mix-blend-mode: multiply; } .jp-RenderedHTMLCommon tbody tr:nth-child(odd) { background: rgba(21, 17, 14, .04); }`;
  e.target.contentDocument.head.appendChild(style);
});
</script>
<script src="/assets/effets.js"></script>
</body>
</html>
