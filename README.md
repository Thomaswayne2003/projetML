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

Les données sont rangées dans l'ordre où elles sont produites :

```text
data/
  1_brutes/          sources téléchargées telles quelles (FRED, BoJ, MoF, BCE, Yahoo, GDELT, ETF 1321, Nikkei depuis 1970)
    saisie_manuelle/   CSV déposés à la main (facultatif, lu par le notebook 00a)
  2_construites/     jeux fabriqués par les notebooks de collecte 00a et 00b
    dataset_monthly.csv         une ligne par mois, 2010-2026 : entrée du projet (news à partir de 2017)
    dictionnaire_variables.csv  définition, fréquence et décalage de publication de chaque colonne
    dataset_daily_v2.csv        base journalière (explorations après coup)
    news_articles.csv, dataset_ml_news_v2.csv, dataset_monthly_ml.csv   news et versions intermédiaires
    dataset_daily.csv, dataset_ml.csv, dataset_ml_news.csv              premières versions (notebook 00a)
  3_modele/          dataset_model.csv : table de modélisation écrite par `python -m src.data`
  archives/          version provisoire du 10 novembre, gardée pour mémoire
```

Seuls `dataset_monthly.csv`, `dictionnaire_variables.csv` et `dataset_model.csv` sont suivis par Git ; le reste
est trop lourd et se refait avec les notebooks 00a et 00b.

Les notebooks sont numérotés dans l'ordre du projet : `00a` et `00b` collectent les données, `01` à `05`
construisent et évaluent le modèle, `06_annexe_news_prix/` est l'étude préalable sur les news et les prix
(avec ses propres modules Python).

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
  experience.php     accueil (/) : neuf scènes en 3D que la caméra traverse au défilement
  recit.php          récit (/recit) : affiche, 14 chapitres, mode présentation
  notebooks.php      lecteur des six notebooks
  api.php            relais entre le navigateur et l'API Python
  router.php         routeur du serveur de développement de PHP
  inc/               configuration, en-tête, pied de page, et contenu des chapitres (contenu.php)
  assets/            monde.js (accueil 3D), recit.js (graphiques SVG animés), passage3d.js (transition 3D du mode
                     présentation), scene3d.js (surface 3D de l'annexe), styles, Three.js en copie locale
  nb/                notebooks convertis en HTML par app/build_site.py
tests/               tests (fuites, pipeline, gradient, règle de décision, API)
notebooks/           analyses et figures, dans l'ordre des étapes (matériel complémentaire)
runs/                journal des essais, prédictions, modèles, décision figée, évaluation du test
figures/             figures exportées
report/              rapport.tex/.pdf (Applied ML), annexe_maths.tex/.pdf (Maths), plan_oral.md
                     comprendre_le_projet.pdf : le projet expliqué simplement, avec un avis sur chaque choix
```

## Installation

```bash
pip install -r requirements.txt
```

## Lancer

Depuis la racine du dépôt :

```bash
python -m src.data                  # reconstruit data/3_modele/dataset_model.csv et passe l'audit des fuites
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

Le site est alors sur http://localhost:8080 (mode présentation : http://localhost:8080/recit?presenter), et la documentation de l'API sur http://127.0.0.1:8000/docs.
PHP 8.1 ou plus récent est nécessaire (`brew install php` sur macOS).

Le site s'enchaîne en deux temps, puis donne accès aux pièces :
- **l'accueil en 3D** (`/`) : un monde en volume que la caméra traverse au fil du défilement (`web/assets/monde.js`).
  Huit scènes posées sur une table de papier, éclairées avec des ombres portées : le cercle d'encre et le soleil, les
  201 mois en barres, les mêmes barres qui s'envolent pour se ranger en trois blocs, la surface de coût avec une bille
  qui descend vers son minimum, la jauge du signal, deux tours pour le gain en euros, la courbe du Nikkei qui pivote
  en 2022, et un torii qui mène au récit. Les scènes viennent des données de l'API. Un lien peut ouvrir une scène
  précise, par exemple `/?scene=4` ;
- **le récit** (`/recit`) : quatorze chapitres en six actes. Chacun s'ouvre sur une double page : à gauche son titre,
  une explication « En clair » puis la version « En termes techniques » ; à droite un graphique SVG animé, tracé à
  partir des données de l'API (`web/assets/recit.js`). Le détail vient ensuite : tableaux, figures des notebooks,
  conclusion, et quatre outils (prédicteur, simulateur, cartes du changement de régime, surface de coût en 3D).
  Le simulateur est une exploration après coup : la marge du projet est restée fixée avant le test ;
- **le mode présentation** : touche `P`, bouton « Présenter » ou adresse `/recit?presenter`. Les ouvertures deviennent
  seize diapositives. Les flèches ou la barre d'espace passent de l'une à l'autre par une transition 3D (60 000 gouttes
  d'encre forment le signe du chapitre, puis éclatent), `T` affiche la version technique, `D` ouvre le détail du
  chapitre et `Échap` quitte le mode ;
- **le lecteur de notebooks** (`/notebooks`), le rapport et l'annexe en PDF.

Une seule grammaire de couleurs : indigo pour la hausse et l'achat, vermillon pour la baisse et la vente, encre pour
le modèle. L'ancienne adresse `/dossier` redirige vers le récit.

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

## Exploration après coup : vingt modèles réentraînés chaque mois

Faite après l'ouverture du test, donc hors résultat officiel. `python -m src.banc_essai` (une minute environ)
réentraîne vingt modèles à chaque mois, sur tout le passé ou sur les 60 derniers mois, et écrit
`runs/exploration_apres_coup.json`. Sur les 33 mois de test, 3 configurations sur 38 font mieux que la prévision
constante, toutes de moins d'un quart d'erreur type. Le modèle qui paraissait le meilleur sur 2016-2023 (15 plus
proches voisins, fenêtre glissante) finit parmi les moins bons sur le test. Réentraîner la logistique du projet
l'améliore (log-loss 0,681 au lieu de 0,708) sans lui faire battre la constante (0,660).

`python -m src.banc_essai_jour` (trois minutes environ) refait l'exercice sur la base journalière
(`data/2_construites/dataset_daily_v2.csv`, 4 118 séances) et écrit `runs/exploration_journaliere.json`. Avec une décision
prise à la clôture de Tokyo, aucun modèle ne bat la constante, ni à 1 jour (668 séances de test, AUC 0,49), ni à
5 jours, ni à 20 jours. Le script montre aussi un piège : la ligne du jour contient la clôture de Wall Street,
connue après celle de Tokyo ; l'utiliser telle quelle donne une AUC de 0,71 qui ne correspond à aucune décision
possible. La volatilité, elle, se prévoit (R² hors échantillon de 0,16 sur le test), mais doser la position
d'après cette prévision n'a pas amélioré le rendement par unité de risque sur 2024-2026.

`python -m src.banc_essai_long` compare la date de départ de l'apprentissage (2010, 2000, 1985, 1970) avec les
seules variables de prix, le cours du Nikkei étant la seule série aussi longue dans nos fichiers
(`data/1_brutes/nikkei225_long.csv`). Il écrit `runs/exploration_historique_long.json`. Remonter à 2000
n'aide pas : la prévision constante passe de 0,660 à 0,667 de log-loss sur le test, parce que le Nikkei baissait
plus souvent avant 2010 (44 % des mois contre 40 %), et la logistique classe moins bien que le hasard (AUC 0,38).

## Second volet, ajouté après le test : prévoir l'agitation

`python -m src.volatilite` écrit `runs/exploration_volatilite.json`. Avec les mêmes mois et le même découpage, la
cible devient la volatilité réalisée du mois suivant. Elle se prévoit un peu : R² hors échantillon de 0,18 sur le test
pour une régression sur les volatilités passées et le VIX, et AUC de 0,71 pour reconnaître un mois agité (volatilité
au-dessus de 20 %), contre 0,50 pour le sens du marché. Doser la position d'après ce risque adoucit le pire mois
(−9,7 % au lieu de −13,2 %) sans améliorer le rendement par unité de risque (1,00 contre 0,98). Le volet annonce donc
le risque, et la recommandation du projet reste « toujours acheter, couvert ». L'API le sert sur `/volatilite`, les
trois vérifications sur `/verifications`. Le site les présente dans deux chapitres du récit et dans la scène
« Risque » de l'accueil. Une section prête à insérer dans le rapport se trouve dans `report/section_apres_coup.tex`
(le rapport n'a pas été recompilé).

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

### Signal d'achat fondé sur le risque, depuis 2000 (après coup)

`python -m src.signal_risque --figer` choisit le modèle de volatilité et les seuils avec les seules données
2000-2015 (`runs/signal_risque_regle.json`) ; `python -m src.signal_risque` applique cette règle figée chaque jour
de 2003 à 2026 (`runs/signal_risque.json`). Risque prévu sous 20 % : acheter plein ; entre 20 et 27 % : à moitié ;
au-dessus : ne pas acheter. La règle réduit la volatilité (16 % contre 23 %) et la pire perte (−41 % contre −59 %),
protège bien en 2008, mais vend après les chutes brutales de 2020 et d'août 2024 et rate le rebond. Son rendement par
unité de risque reste sous celui de « acheter et garder » (0,37 contre 0,48, écart −0,11 ± 0,12). Données dans
`data/1_brutes/depuis_2000` (Yahoo Finance, BCE, OCDE).

`python -m src.signal_risque_variantes --figer`, puis sans option : trois améliorations écrites avant d'en voir les
résultats (levier jusqu'à 150 % en période calme, sortie lente et retour rapide avec filtre de tendance, décision en fin
de mois) et leur combinaison, réglées sur 2000-2015 (`runs/signal_risque_variantes_regle.json`) puis appliquées à
2003-2026 (`runs/signal_risque_variantes.json`). La combinaison obtient le meilleur rendement par unité de risque sur
2003-2026 (0,53 contre 0,48), mais l'écart (+0,05 ± 0,09) reste dans le bruit et elle fait moins bien sur 2016-2023
(0,30 contre 0,47). Aucune variante n'est meilleure de façon fiable.
