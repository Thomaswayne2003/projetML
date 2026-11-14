<?php
/**
 * Configuration et fonctions communes du site.
 * Le site est en PHP ; le modèle reste en Python et le site interroge son API (FastAPI).
 */
declare(strict_types=1);

define('API', rtrim(getenv('NIKKEI_API') ?: 'http://127.0.0.1:8000', '/'));
define('RACINE', dirname(__DIR__, 2));          // dossier du projet
define('GITHUB', 'https://github.com/Thomaswayne2003/projetML');

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const NOTEBOOKS = [
    ['01_cadrage_eda_variables', '01', 'Cadrage, fuites, EDA', "Les cinq questions, l'audit des fuites, les variables, le split", 'S1 · L1 · L2'],
    ['02_pipeline_modeles_optuna', '02', 'Pipeline et Optuna', 'Une pipeline, trois modèles, 200 essais journalisés', 'S2 à S5 · L3B'],
    ['03_calibration_seuils', '03', 'Calibration et seuils', 'Platt hors fold, coûts, décision figée avant le test', 'S7 · S8'],
    ['03b_test_final', '03b', 'Test final', "L'évaluation unique sur 2024-2026", 'S1'],
    ['04_explicabilite_diagnostics', '04', 'Explicabilité', 'Slices, permutation, SHAP, PDP', 'S9'],
    ['05_annexe_maths_logistique', '05', 'Annexe de Maths', 'La logistique codée à la main et sa sensibilité', 'L1 · L2 · L5 · L7'],
];

/** Appelle l'API Python. Renvoie null si elle ne répond pas. */
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

/** Lit un fichier JSON figé du dossier runs/ (disponible même si l'API est arrêtée). */
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
    return number_format($x, $decimales, ',', ' ');
}

function pct(float $x, int $decimales = 0): string
{
    return number_format(100 * $x, $decimales, ',', ' ') . ' %';
}

function signe(float $x, int $decimales = 2, string $suffixe = ''): string
{
    return ($x >= 0 ? '+' : '−') . number_format(abs($x), $decimales, ',', ' ') . $suffixe;
}

function mois_lisible(string $mois): string
{
    [$annee, $numero] = explode('-', $mois);
    return MOIS_FR[(int) $numero - 1] . ' ' . $annee;
}
