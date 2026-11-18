<?php
/**
 * English version of web/inc/config.php: same API access, English number and date formatting.
 * The site is in PHP; the model stays in Python and the site queries its API (FastAPI).
 * Internal keys returned by the API (block and action names) stay in French; they are translated only for display.
 */
declare(strict_types=1);

define('API', rtrim(getenv('NIKKEI_API') ?: 'http://127.0.0.1:8000', '/'));
define('RACINE', dirname(__DIR__, 3));          // project folder
define('GITHUB', 'https://github.com/Thomaswayne2003/projetML');

const MOIS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Display labels for the values the API returns in French. */
const BLOCS_EN = ['entraînement' => 'training', 'validation' => 'validation', 'test' => 'test', 'à prédire' => 'to predict'];
const ACTIONS_EN = ['acheter' => 'buy', 'neutre' => 'neutral', 'vendre' => 'sell'];

const NOTEBOOKS = [
    ['01_cadrage_eda_variables', '01', 'Framing, leakage, EDA', 'The five questions, the leakage audit, the features, the split', 'S1 · L1 · L2'],
    ['02_pipeline_modeles_optuna', '02', 'Pipeline and Optuna', 'One pipeline, three models, 200 logged trials', 'S2 to S5 · L3B'],
    ['03_calibration_seuils', '03', 'Calibration and thresholds', 'Out-of-fold Platt, costs, decision frozen before the test', 'S7 · S8'],
    ['03b_test_final', '03b', 'Final test', 'The single evaluation on 2024-2026', 'S1'],
    ['04_explicabilite_diagnostics', '04', 'Explainability', 'Slices, permutation, SHAP, PDP', 'S9'],
    ['05_annexe_maths_logistique', '05', 'Maths appendix', 'Logistic regression coded by hand, and its sensitivity', 'L1 · L2 · L5 · L7'],
];

/** Calls the Python API. Returns null if it does not respond. */
function api_get(string $route, array $params = []): ?array
{
    $url = API . '/' . $route . ($params ? '?' . http_build_query($params) : '');
    $contexte = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]);
    $corps = @file_get_contents($url, false, $contexte);
    if ($corps === false) {
        return null;
    }
    $donnees = json_decode($corps, true);
    return is_array($donnees) ? $donnees : null;
}

/** Reads a frozen JSON file from runs/ (available even when the API is stopped). */
function lire_runs(string $fichier): array
{
    $chemin = RACINE . '/runs/' . $fichier;
    return is_file($chemin) ? (json_decode((string) file_get_contents($chemin), true) ?: []) : [];
}

function e(mixed $texte): string
{
    return htmlspecialchars((string) $texte, ENT_QUOTES, 'UTF-8');
}

function decimal(float $x, int $decimales = 3): string
{
    return number_format($x, $decimales, '.', ',');
}

function pct(float $x, int $decimales = 0): string
{
    return number_format(100 * $x, $decimales, '.', ',') . '%';
}

function signe(float $x, int $decimales = 2, string $suffixe = ''): string
{
    return ($x >= 0 ? '+' : '−') . number_format(abs($x), $decimales, '.', ',') . $suffixe;
}

function mois_lisible(string $mois): string
{
    [$annee, $numero] = explode('-', $mois);
    return MOIS_EN[(int) $numero - 1] . ' ' . $annee;
}

function bloc_en(string $bloc): string
{
    return BLOCS_EN[$bloc] ?? $bloc;
}

function action_en(string $action): string
{
    return ACTIONS_EN[$action] ?? $action;
}
