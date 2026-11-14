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
app/
  api.py             API FastAPI : /signal, /prediction, /explication, /historique, /decision, /serie, /essais, /surface, ...
  build_site.py      convertit les notebooks en pages HTML pour le site
  dashboard.py       tableau de bord Streamlit (variante)
web/                 site de présentation, en PHP
  experience.php     accueil immersif (/) : le projet en huit chapitres, nuage de 16 000 particules 3D
  recit.php          le récit (/recit) : tout le projet en 14 chapitres, chacun ouvert par un graphique animé
  index.php          dossier complet (/dossier) : même contenu, en version classique
  notebooks.php      lecteur des six notebooks
  api.php            relais entre le navigateur et l'API Python
  router.php         routeur du serveur de développement de PHP
  inc/               configuration, en-tête, pied de page
  assets/            style, graphiques SVG, scènes 3D (Three.js en copie locale)
  nb/                notebooks convertis en HTML par app/build_site.py
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

Le site est en PHP ; le modèle reste en Python. Deux serveurs à lancer depuis la racine du dépôt, dans deux terminaux :

```bash
uvicorn app.api:app --port 8000
```

```bash
PHP_CLI_SERVER_WORKERS=4 php -S localhost:8080 -t web web/router.php
```

Le site est alors sur http://localhost:8080, et la documentation de l'API sur http://127.0.0.1:8000/docs.
PHP 8.1 ou plus récent est nécessaire (`brew install php` sur macOS).

Le site a trois niveaux de lecture :
- **l'expérience** (`/`) : huit chapitres plein écran. Un nuage de 16 000 gouttes d'encre se recompose en 3D au fil
  du défilement : ensō, relief du Nikkei, blocs du split, surface de coût, jauge du signal, verdict, hélice du
  changement de régime. Les chiffres viennent de l'API et de `runs/` ;
- **le récit** (`/recit`) : tout le projet en 14 chapitres et 6 actes. Chaque chapitre s'ouvre sur une double page, avec
  à gauche son titre et ce qu'il faut en retenir, à droite un graphique SVG tracé à partir des données de l'API
  (`web/assets/recit.js`) : la courbe du Nikkei, le calendrier des 201 mois, le découpage, les classes, les essais
  Optuna, les seuils, la matrice du test, la performance en euros, les contributions, les écarts mois par mois, les
  courbes de niveau du coût. Les graphiques s'animent quand ils entrent à l'écran. Une seule grammaire de couleurs :
  indigo pour la hausse et l'achat, vermillon pour la baisse et la vente, encre pour le modèle. Les graphiques du
  détail, la surface 3D de l'annexe et le lecteur de notebooks suivent la même grammaire ; les figures des notebooks
  s'affichent en estampes et retrouvent leurs couleurs au survol ;
- **le dossier** (`/dossier`) : le même contenu dans un premier habillage, gardé à cette adresse mais plus lié depuis le
  site, pour que toutes les pages visibles partagent la même identité. Il détaille, avec la conclusion de chaque étape :
  - la construction du dataset : sources, délais de publication, nettoyage, cibles ;
  - l'exploration, les trois modèles, la calibration et la règle de décision ;
  - le test, par sous-groupe, et la projection de novembre 2026 ;
  - le **prédicteur** : on règle l'information (volume de news, sentiment, momentum, taux) et l'API renvoie la
    probabilité, l'action et la contribution de chaque variable ;
  - le **simulateur** : marge, couverture, vente autorisée ou non. C'est une exploration après coup : la marge du
    projet est restée fixée avant le test ;
  - le **changement de régime** : des cartes qui se retournent pour comparer avant et après 2022 ;
  - la **surface de coût en 3D** et la descente de gradient pour quatre pas ;
- **le lecteur de notebooks** (`/notebooks`), le rapport et l'annexe en PDF.

Après avoir modifié un notebook, régénérer ses pages avec `python -m app.build_site`. Une variante en tableau de
bord Streamlit existe aussi : `streamlit run app/dashboard.py`.

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
