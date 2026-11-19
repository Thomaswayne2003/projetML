<?php /** En-tête commun. Variables attendues : $titre, $page ('accueil' ou 'notebooks'). */ ?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= e($titre) ?></title>
<link rel="stylesheet" href="/assets/style.css">
<link rel="stylesheet" href="/assets/effets.css">
<?php if (($theme ?? '') === 'encre'): ?><link rel="stylesheet" href="/assets/encre.css"><?php endif; ?>
</head>
<body class="page-<?= e($page) ?><?= ($theme ?? '') === 'encre' ? ' theme-encre' : '' ?>"<?= $page === 'accueil' ? ' data-sans-rideau' : '' ?>>
<nav class="nav">
  <div class="nav-in">
    <a class="marque" href="/"><span class="soleil"></span>Nikkei</a>
    <div class="nav-liens" id="nav-liens">
<?php $racine = $page === 'accueil' ? '' : '/recit'; ?>
<?php foreach (['resultat' => 'Résultat', 'dataset' => 'Dataset', 'methode' => 'Méthode', 'modeles' => 'Modèles', 'test' => 'Test',
               'explorateur' => 'Prédire', 'simulateur' => 'Simuler', 'projection' => 'Projection', 'regime' => 'Régime', 'maths' => 'Maths 3D'] as $ancre => $libelle): ?>
      <a href="<?= $racine ?>#<?= $ancre ?>"><?= e($libelle) ?></a>
<?php endforeach; ?>
      <a href="/bloomberg">Bloomberg</a>
      <a class="cta" href="/notebooks">Notebooks</a>
      <a class="cta blanc" href="/rapport.pdf" target="_blank">Rapport</a>
    </div>
  </div>
</nav>
