<?php
/*
 * Lance le site du projet Nikkei avec le serveur intégré de PHP, puis l'ouvre dans le navigateur.
 *
 *     php lancer.php                     (PHP 8 ou plus récent ; sur macOS : brew install php)
 *     php lancer.php --sans-navigateur   (lance le serveur sans ouvrir de fenêtre)
 *
 * Ctrl+C arrête le serveur. Sans PHP, un double-clic sur « Ouvrir le site.html » suffit aussi.
 */

$dossier = __DIR__ . DIRECTORY_SEPARATOR . 'site';
if (!is_file($dossier . '/data/donnees.js') || !is_file($dossier . '/assets/visite.bundle.js')) {
    fwrite(STDERR, "Le site n'est pas prêt : lancer d'abord « python -m app.export_site » depuis ce dossier.\n");
    exit(1);
}

// premier port libre à partir de 8095
$port = 8095;
while ($port < 8195) {
    $essai = @fsockopen('127.0.0.1', $port, $code, $message, 0.2);
    if (!$essai) break;
    fclose($essai);
    $port++;
}
$adresse = "http://localhost:$port/";

echo "Site du projet Nikkei\n";
echo "  visite 3D   {$adresse}\n";
echo "  lecture     {$adresse}lecture.html\n";
echo "  notebooks   {$adresse}cabinet.html\n";
echo "  parcours Maths : ajouter ?cours=maths à l'adresse, ou le choisir en haut de la page\n";
echo "Ctrl+C pour arrêter.\n\n";

if (!in_array('--sans-navigateur', $argv, true)) {
    $ouvrir = match (PHP_OS_FAMILY) {
        'Darwin'  => "(sleep 1; open " . escapeshellarg($adresse) . ") > /dev/null 2>&1 &",
        'Windows' => 'start "" ' . escapeshellarg($adresse),
        default   => "(sleep 1; xdg-open " . escapeshellarg($adresse) . ") > /dev/null 2>&1 &",
    };
    PHP_OS_FAMILY === 'Windows' ? pclose(popen($ouvrir, 'r')) : exec($ouvrir);
}

passthru(escapeshellarg(PHP_BINARY) . " -S localhost:$port -t " . escapeshellarg($dossier));
