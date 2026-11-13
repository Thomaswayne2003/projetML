# Projet Nikkei : acheter, rester neutre ou vendre, couvert ou non

Chaque fin de mois, un modèle estime la probabilité que le Nikkei 225 monte le mois suivant, à partir des news
(GDELT, FinBERT) et de variables de marché, de taux et de change. Une règle en tire l'action d'un investisseur
en euros : acheter (couvert ou non couvert contre le yen), rester neutre ou vendre.

Projet commun aux cours *Applied ML: Foundations, Engineering & Evaluation* et *Mathematics & Statistics for
Machine Learning* (Albert School, MSc 1, automne 2026).

## Résultat principal

Sur le test 2024-2026, le modèle ne bat pas le modèle constant (log-loss 0,708 contre 0,657). Conformément à
l'engagement pris avant le test, la recommandation est **« toujours acheter le Nikkei, couvert contre le yen »**
(+82,3 % sur la période). Les notebooks 03b et 04 expliquent pourquoi.

## Données

- `data/dataset_monthly.csv` : une ligne par mois, de 2010 à 2026, construite par les notebooks de collecte
  (V1 et V2, hors de ce dépôt). Les news n'existent qu'à partir de 2017.
- `data/dictionnaire_variables.csv` : définition, fréquence et décalage de publication de chaque colonne.

## Structure

```text
config.yaml          dates du split, variables, graine
src/                 code principal
  config.py          chemins et configuration
  data.py            table de modélisation : cibles, variables de news, split, audit des fuites
  pipeline.py        pipeline scikit-learn et espaces de recherche des trois modèles
  tune.py            Optuna + TimeSeriesSplit, journal des essais, modèles retenus
  decision.py        calibration de Platt, seuils par espérance de gain, décision figée
  evaluate.py        évaluation sur le test avec la décision figée
  predict.py         signal du mois (utilisé par la plateforme)
  logreg_scratch.py  régression logistique codée à la main (annexe de Maths)
app/                 plateforme
  api.py             API FastAPI : /signal, /explication, /historique, /evaluation, /sante
  dashboard.py       tableau de bord Streamlit (démo de l'oral)
tests/               tests (fuites, pipeline, gradient, règle de décision, API)
notebooks/           analyses et figures, dans l'ordre des étapes (matériel complémentaire)
runs/                journal des essais, prédictions, modèles, décision figée, évaluation du test
figures/             figures exportées
report/              rapport.tex/.pdf (Applied ML), annexe_maths.tex/.pdf (Maths), plan_oral.md
```

## Installation

```bash
pip install -r requirements.txt
```

## Lancer

Depuis la racine du dépôt :

```bash
python -m src.data                  # reconstruit data/processed/dataset_model.csv et passe l'audit des fuites
python -m src.tune --sortie /tmp/runs  # refait le réglage Optuna dans un dossier à part
python -m src.decision --verifier   # recalcule la décision et la compare à la décision figée
python -m src.evaluate --verifier   # recalcule l'évaluation du test et la compare au fichier
python -m src.predict               # signal du dernier mois disponible
python -m pytest -q                 # tests
```

## Plateforme

```bash
uvicorn app.api:app --reload            # API, documentation sur http://127.0.0.1:8000/docs
streamlit run app/dashboard.py          # tableau de bord sur http://localhost:8501
```

Exemple : `curl "http://127.0.0.1:8000/signal?mois=2026-10"` renvoie la probabilité de hausse, le score, l'action
de la règle et la recommandation finale.

`src.decision` et `src.evaluate` ne réécrivent jamais les fichiers figés : la décision a été commitée avant le test
(commit `75712cf`), et le test n'a été évalué qu'une fois (commit `6efd12c`).

## Reproductibilité

Toutes les graines sont fixées : deux exécutions de `python -m src.tune` donnent les mêmes 200 essais et les mêmes
prédictions. Deux sources de hasard ont été corrigées en passant des notebooks au code :
- le solveur `saga` de la régression logistique mélange les données ; il a maintenant une graine ;
- le Random Forest calculé en parallèle (`n_jobs=-1`) additionnait les arbres dans un ordre variable ; il tourne
  maintenant sur un seul cœur.

Les modèles de `runs/models/` sont ceux du notebook 02, figés avant le test, et ne sont pas réentraînés. Pour la
logistique, le réglage refait par le script retrouve la même log-loss de validation croisée (0,6473) avec un C très
proche (0,032 au lieu de 0,030).

## Limites connues (revue finale)

- **Le test n'était pas entièrement invisible avant le gel.** Le notebook 01 affichait déjà des statistiques du bloc
  test : part de baisses, rendement moyen, portage, courbe « achat couvert ou non ». La couverture permanente et la
  règle de repli « toujours acheter, couvert » sont les références naturelles du problème, mais elles n'ont pas été
  choisies à l'aveugle.
- **Les variables ont été choisies** à partir d'une analyse exploratoire de 2017-2026, qui recouvre la validation et le test.
- **Platt est appris sur les prédictions hors fold** des hyperparamètres qu'Optuna a choisis sur ces mêmes folds :
  ce fold de calibration n'est pas totalement indépendant. Un premier essai de Platt sur la validation (pentes
  négatives) a été écarté après coup.
- **Le notebook 04 réutilise le test** pour des diagnostics (borner le portage) : c'est une analyse exploratoire, pas un score.
- **Deux commits figurent dans les fichiers figés.** Dans `runs/evaluation_test.json`, le champ
  `decision_figee_au_commit` vaut `2aa4b40` : c'est le commit du code qui a calculé la décision. Le fichier de
  décision lui-même a été figé par le commit `75712cf`.
- **Le dictionnaire des variables** indique « aucun » décalage pour les colonnes `target_*`, alors que ces cibles ne
  sont connues qu'en t+1. Elles ne sont jamais utilisées comme variables (contrôlé par l'audit de `src/data.py`).
- **Petit échantillon** : 143 mois d'entraînement et 12 baisses dans le test. Les écarts entre modèles et entre
  slices restent fragiles.

## Avancement

| Étape | Contenu | État |
| --- | --- | --- |
| 1 | Cadrage, audit des fuites, EDA, variables, split | fait |
| 2 | Pipeline, 3 modèles, Optuna, journal des essais | fait |
| 3 | Calibration, choix du modèle, règle de décision figée avant le test | fait |
| 3b | Évaluation unique sur le test 2024-2026 | fait |
| 4 | SHAP, permutation importance, slices | fait |
| 5 | Annexe de Maths : régression logistique à la main | fait |
| 6 | Code en `.py`, tests | fait |
| 7 | Plateforme : API et tableau de bord | fait |
| 8 | Revue finale indépendante et corrections | fait |
| 9 | Rapport, annexe de Maths, plan des oraux (`report/`) | fait, contributions à compléter |
