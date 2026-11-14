<?php
/**
 * Routeur du serveur de développement de PHP.
 * Lancer depuis la racine du projet : php -S localhost:8080 -t web web/router.php
 * Il sert les pages, et donne accès aux figures, aux notebooks et aux PDF rangés hors du dossier web/.
 */
declare(strict_types=1);

$chemin = urldecode((string) parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$projet = dirname(__DIR__);

$pages = ['/' => 'experience.php', '/dossier' => 'index.php', '/recit' => 'recit.php', '/notebooks' => 'notebooks.php'];
if (isset($pages[$chemin])) {
    require __DIR__ . '/' . $pages[$chemin];
    return true;
}

$fichiers = ['/rapport.pdf' => $projet . '/report/rapport.pdf', '/annexe_maths.pdf' => $projet . '/report/annexe_maths.pdf'];
$dossiers = ['/figures/' => $projet . '/figures', '/ipynb/' => $projet . '/notebooks'];
$types = ['png' => 'image/png', 'pdf' => 'application/pdf', 'ipynb' => 'application/x-ipynb+json'];

$cible = $fichiers[$chemin] ?? null;
foreach ($dossiers as $prefixe => $dossier) {
    if ($cible === null && str_starts_with($chemin, $prefixe)) {
        $candidat = realpath($dossier . '/' . substr($chemin, strlen($prefixe)));
        // realpath + préfixe : interdit de sortir du dossier autorisé (../)
        if ($candidat !== false && str_starts_with($candidat, realpath($dossier) . DIRECTORY_SEPARATOR)) {
            $cible = $candidat;
        }
    }
}
if ($cible !== null && is_file($cible)) {
    $extension = strtolower(pathinfo($cible, PATHINFO_EXTENSION));
    if (!isset($types[$extension])) {
        http_response_code(403);
        return true;
    }
    header('Content-Type: ' . $types[$extension]);
    header('Content-Length: ' . filesize($cible));
    readfile($cible);
    return true;
}

// Le reste doit être un vrai fichier du dossier web/ ; sinon 404 (PHP renverrait la page d'accueil par défaut)
$local = realpath(__DIR__ . $chemin);
if ($local === false || !is_file($local) || !str_starts_with($local, __DIR__ . DIRECTORY_SEPARATOR) || str_contains($local, DIRECTORY_SEPARATOR . 'inc' . DIRECTORY_SEPARATOR)) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Page introuvable';
    return true;
}
return false;   // fichiers du dossier web/ (assets, pages de notebooks, api.php) : servis directement
