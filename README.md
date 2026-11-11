# Projet Nikkei : acheter, rester neutre ou vendre, couvert ou non

Chaque fin de mois, un modèle estime la probabilité que le Nikkei 225 monte le mois suivant, à partir des news
(GDELT, FinBERT) et de variables de marché, de taux et de change. Une règle en tire l'action d'un investisseur
en euros : acheter (couvert ou non couvert contre le yen), rester neutre ou vendre.

Projet commun aux cours *Applied ML: Foundations, Engineering & Evaluation* et *Mathematics & Statistics for
Machine Learning* (Albert School, MSc 1, automne 2026).

## Données

- `data/dataset_monthly.csv` : une ligne par mois, de 2010 à 2026, construite par les notebooks de collecte
  (V1 et V2). Les news n'existent qu'à partir de 2017.
- `data/dictionnaire_variables.csv` : définition, fréquence et décalage de publication de chaque colonne.

## Structure

```text
config.yaml        dates du split, variables, graine
data/              données mensuelles et table de modélisation (data/processed/)
notebooks/         notebooks d'analyse, dans l'ordre des étapes
figures/           figures exportées
runs/              journal des essais et modèles sauvegardés
src/               code Python (étape 6)
```

## Lancer

```bash
jupyter nbconvert --to notebook --execute --inplace notebooks/01_cadrage_eda_variables.ipynb
```

## Avancement

| Étape | Contenu | État |
| --- | --- | --- |
| 1 | Cadrage, audit des fuites, EDA, variables, split | fait |
| 2 | Pipeline, 3 modèles, Optuna, journal des essais | à faire |
| 3 | Métriques, calibration, seuils, couverture | à faire |
| 4 | SHAP, permutation importance, slices | à faire |
| 5 | Annexe de Maths : régression logistique à la main | à faire |
| 6 | Code en `.py` | à faire |
| 7 | Plateforme : API et tableau de bord | à faire |

## Usage d'assistants IA

Ce projet a été développé avec l'aide de Claude (Anthropic). La note détaillée sera dans le rapport.
