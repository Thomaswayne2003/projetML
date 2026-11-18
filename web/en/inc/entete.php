<?php /** Shared header (English). Expected variables: $titre, $page ('accueil' or 'notebooks'), $fr (URL of the French page). */ ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titre) ?></title>
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/assets/effets.css">
<?php if (($theme ?? '') === 'encre'): ?><link rel="stylesheet" href="/assets/encre.css"><?php endif; ?>
</head>
<body class="page-<?= e($page) ?><?= ($theme ?? '') === 'encre' ? ' theme-encre' : '' ?>">
<nav class="nav">
  <div class="nav-in">
    <a class="marque" href="/en"><span class="soleil"></span>Nikkei</a>
    <div class="nav-liens" id="nav-liens">
<?php $racine = $page === 'accueil' ? '' : '/en/recit'; ?>
<?php foreach (['resultat' => 'Result', 'dataset' => 'Dataset', 'methode' => 'Method', 'modeles' => 'Models', 'test' => 'Test',
               'explorateur' => 'Predict', 'simulateur' => 'Simulate', 'projection' => 'Projection', 'regime' => 'Regime', 'maths' => '3D Maths'] as $ancre => $libelle): ?>
      <a href="<?= $racine ?>#<?= $ancre ?>"><?= e($libelle) ?></a>
<?php endforeach; ?>
      <a class="cta" href="/en/notebooks">Notebooks</a>
      <a class="cta blanc" href="/rapport.pdf" target="_blank" title="In French">Report (FR)</a>
      <a class="cta" href="<?= e($fr ?? '/') ?>" lang="fr" hreflang="fr" title="Version française">FR</a>
    </div>
  </div>
</nav>
