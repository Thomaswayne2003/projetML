<?php
/**
 * Relais vers l'API Python : le navigateur parle au site PHP, qui interroge FastAPI.
 * Exemple : /api.php?route=signal&mois=2026-10
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

header('Content-Type: application/json; charset=utf-8');

$routes = ['sante', 'mois', 'signal', 'explication', 'historique', 'evaluation', 'decision', 'variables', 'prediction', 'serie', 'surface', 'essais'];
$route = $_GET['route'] ?? '';
if (!in_array($route, $routes, true)) {
    http_response_code(404);
    echo json_encode(['detail' => 'route inconnue']);
    exit;
}

$params = [];
if (isset($_GET['mois'])) {
    if (!preg_match('/^\d{4}-\d{2}$/', $_GET['mois'])) {
        http_response_code(422);
        echo json_encode(['detail' => 'mois attendu au format AAAA-MM']);
        exit;
    }
    $params['mois'] = $_GET['mois'];
}
if (isset($_GET['bloc'])) {
    if (!in_array($_GET['bloc'], ['validation', 'test'], true)) {
        http_response_code(422);
        echo json_encode(['detail' => 'bloc attendu : validation ou test']);
        exit;
    }
    $params['bloc'] = $_GET['bloc'];
}

// Variables d'information réglables du prédicteur : nombres uniquement
foreach (['news_attention_6m', 'news_sent_w', 'n225_mom_12m', 'n225_mom_3m', 'd_jgb10y_bp', 'carry_1m'] as $variable) {
    if (isset($_GET[$variable])) {
        if (!is_numeric($_GET[$variable])) {
            http_response_code(422);
            echo json_encode(['detail' => "$variable doit être un nombre"]);
            exit;
        }
        $params[$variable] = (float) $_GET[$variable];
    }
}

$donnees = api_get($route, $params);
if ($donnees === null) {
    http_response_code(503);
    echo json_encode(['detail' => "API Python indisponible : lancer « uvicorn app.api:app --port 8000 »"]);
    exit;
}
if (isset($donnees['detail']) && count($donnees) === 1) {      // erreur renvoyée par l'API (mois inconnu, par exemple)
    http_response_code(404);
}
echo json_encode($donnees, JSON_UNESCAPED_UNICODE);
