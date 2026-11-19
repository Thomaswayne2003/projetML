# Résumé de la discussion — projet Nikkei

Rédigé le 16 novembre 2026. Tout ce qui suit est **en local** : rien n'a été commité ni poussé depuis le commit `9f0c197`.

## 1. Où en est le projet

- **Résultat officiel, figé avant le test** : la règle du modèle rapporte +3,5 % contre +82,3 % pour « acheter et garder, couvert contre le yen ». Log-loss 0,708 contre 0,657 pour la prévision constante. Recommandation : acheter et garder.
- Les fichiers `runs/decision_finale.json` et `runs/evaluation_test.json` n'ont jamais été modifiés (vérifié à chaque étape).
- Les 21 tests passent.

## 2. Pourquoi le modèle est faible

1. Deviner le sens d'une Bourse d'un mois sur l'autre est presque impossible avec des données publiques.
2. Peu de mois pour apprendre : 143, dont 57 seulement avec l'actualité.
3. Le lien appris s'est inversé après 2022 (corrélation presse-rendement de −0,38 à +0,29).
4. La règle est trop prudente dans un marché qui monte : 11 baisses évitées sur 12, mais 18 hausses manquées sur 21.

## 3. Les six pistes testées après coup pour améliorer le sens du marché

Toutes ont été lancées après l'ouverture du test. Aucune ne bat la prévision constante de façon fiable.

| # | Piste | Script | Résultat sur le test |
|---|---|---|---|
| 1 | Vingt modèles réentraînés chaque mois | `src/banc_essai.py` | 3 essais sur 38 devant la constante, avance 4 fois plus petite que l'incertitude |
| 2 | Base journalière (4 118 séances), décision à la clôture | `src/banc_essai_jour.py` | AUC 0,49 sur 668 séances ; rien à 5 et 20 jours |
| 3 | Apprendre depuis 2000 (ou 1985, 1970) | `src/banc_essai_long.py` | constante 0,667 au lieu de 0,660 ; logistique sous le hasard (AUC 0,38) |
| 4 | Normalisation sur fenêtre glissante (24, 36, 60 mois) | `src/banc_essai_normalisation.py` | meilleur essai à +0,002 de la constante |
| 5 | Décision à l'ouverture, sur l'indice | `src/banc_essai_jour.py` | AUC 0,59, mais artefact (voir 6) |
| 6 | Décision à l'ouverture, sur l'ETF 1321.T | `src/banc_essai_ouverture.py` | AUC 0,55, écart −0,004 ± 0,004 ; +3,4 % avec 0,05 % de frais contre +101,7 % en gardant l'ETF |

Deux découvertes utiles pour l'oral :

- **Piège de Wall Street.** Dans la base journalière, la ligne d'un jour contient la clôture de New York du même jour, connue après celle de Tokyo. L'utiliser telle quelle donne une AUC de 0,71 sans décision possible. Les séries étrangères ont été décalées d'un jour.
- **Artefact de l'indice.** L'indice Nikkei ouvre avec des cours en partie périmés. Sur l'indice, le saut d'ouverture est suivi d'une séance dans le même sens (corrélation 0,22) ; sur l'ETF réellement achetable, −0,01.

Résultats détaillés : `runs/exploration_apres_coup.json`, `exploration_journaliere.json`, `exploration_historique_long.json`, `exploration_normalisation.json`, `exploration_ouverture.json`.

Données téléchargées (Yahoo Finance) dans `data/1_brutes/` : `nikkei_etf_1321.csv`, `nikkei_futures_niy.csv`, `nikkei_futures_nkd.csv`.

## 4. Le pivot : prévoir l'agitation (second volet)

Script `src/volatilite.py`, résultats dans `runs/exploration_volatilite.json`.

| Ce qu'on prévoit | Test 2024-2026 | Repère |
|---|---|---|
| Un mois agité (volatilité > 20 %) | AUC 0,71 | 0,50 au hasard |
| Le niveau de volatilité | R² 0,18 | 0 = pas mieux que la moyenne |

Limites à dire soi-même :

- Sur 33 mois, l'avantage en log-loss (−0,065 ± 0,088) reste sous son incertitude.
- Le risque annoncé est fiable, sans être plus fin qu'avec une volatilité constante.
- Doser la position adoucit le pire mois (−9,7 % au lieu de −13,2 %) mais le rendement par unité de risque ne change pas (1,00 contre 0,98).
- Le volet a été construit après le test : il s'ajoute au résultat officiel, il ne le remplace pas.

Pour novembre 2026 : volatilité prévue 21 %, une chance sur deux d'un mois agité, perte mensuelle de −9,9 % dépassée environ une fois sur vingt.

## 5. Le site

Serveurs à lancer depuis `projet-nikkei` :

```bash
/opt/anaconda3/bin/python3 -m uvicorn app.api:app --port 8000
```

```bash
PHP_CLI_SERVER_WORKERS=4 /opt/homebrew/bin/php -S localhost:8080 -t web web/router.php
```

- **Accueil 3D** `http://localhost:8080/` : neuf scènes (la huitième, « Risque », est nouvelle). Rendu en sept passes : reflets au sol, profondeur de champ, halo des reflets, gouttes d'encre qui voyagent d'une scène à l'autre. Lien direct vers une scène : `/?scene=8`.
- **Récit** `http://localhost:8080/recit` : 16 chapitres, dont « Vérifications » et « Volatilité », conclusion en quatre idées.
- **Mode présentation** `http://localhost:8080/recit?presenter` : 18 diapositives.
- **API** : nouvelles routes `/volatilite` et `/verifications`.

## 6. Ce qui n'est pas fait

- **Rapport PDF** : pas de LaTeX sur la machine. La section est prête dans `report/section_apres_coup.tex`, à insérer avant « Limites » ; `rapport.tex` et le PDF sont inchangés. Vérifier la limite de pages de l'énoncé.
- **Précision et rappel dans le chapitre « Test »** : demandé, pas encore fait. Chiffres prêts : au seuil 0,5, rappel 75 % (9 baisses sur 12), précision 45 % (9 alertes justes sur 20), F1 0,56. Avec la règle, « ne pas acheter » : rappel 92 %, précision 38 %, pour 36 % de baisses dans le test.
- **Couleurs de l'accueil** : jugées pas belles, pas encore reprises. Pistes : reculer la brume qui délave, calmer les reflets, renforcer contraste et saturation, gouttes presque toutes en encre noire.
- **Fluidité** du nouvel accueil : non mesurée, à juger sur votre machine.
- Les leviers 3 et 4 de la liste d'amélioration (mélange avec la constante, règle « acheter par défaut ») n'ont pas été testés à part ; les pistes 1 et 4 les recouvrent en partie.
- La fiche du site sur claude.ai et `report/comprendre_le_projet.pdf` ne parlent pas des explorations ni de la volatilité.
- Tableau des contributions du rapport, ajout des collaborateurs sur le dépôt privé, commit et push : à votre initiative.

## 7. Pour reprendre le travail avec un autre assistant

Ce fichier ne suffit pas seul : il faut lui donner aussi l'accès au dossier `projet-nikkei`, qui contient maintenant toutes les données (`data/1_brutes`, `data/2_construites`, `data/3_modele`) et tous les notebooks (`notebooks/00a` à `06`). Les règles ci-dessous ont été fixées par l'auteur du projet et doivent être respectées.

**Règles fermes**

- Ne jamais réécrire `runs/decision_finale.json` ni `runs/evaluation_test.json`. Ne pas réévaluer le test pour régler un modèle. Contrôle : `python -m src.evaluate --verifier` et `python -m src.decision --verifier`.
- Ne rien commiter ni pousser sans demande explicite. Pas de ligne `Co-Authored-By` dans les commits. Ne pas réécrire l'historique Git (les commits `0d8df2f` et `775a352` prouvent que la décision a été figée avant le test).
- Le dépôt GitHub (`Thomaswayne2003/projetML`) reste privé. L'assistant ne saisit aucun mot de passe.
- Tout résultat obtenu après l'ouverture du test se présente comme une exploration après coup, jamais comme le résultat du projet.
- Le volet volatilité ne se vend pas comme une meilleure stratégie.

**Ton des textes en français**

- Ton humain, phrases simples. D'abord l'explication en clair, ensuite la version technique.
- Éviter les tournures « chaque X est Y » et « c'est X, pas Y ».
- Les explications du mécanisme et des choix se donnent dans la conversation, pas seulement dans un fichier.

**Environnement**

- Python : `/opt/anaconda3/bin/python3`. PHP : `/opt/homebrew/bin/php`. Pas de LaTeX ni de Node sur la machine.
- Tests : `/opt/anaconda3/bin/python3 -W ignore -m pytest -q` depuis `projet-nikkei` (21 attendus).
- Après une modification de `app/api.py`, relancer le serveur de l'API (il ne se recharge pas seul).

**Où se trouve quoi**

| Sujet | Fichiers |
|---|---|
| Données, pipeline, décision, évaluation | `src/data.py`, `src/pipeline.py`, `src/tune.py`, `src/decision.py`, `src/evaluate.py`, `config.yaml` |
| Explorations après coup | `src/banc_essai*.py`, `src/volatilite.py`, `runs/exploration_*.json` |
| API | `app/api.py`, relais PHP `web/api.php`, tests `tests/test_api.py` |
| Accueil 3D | `web/experience.php`, `web/assets/monde.js` (Three.js 0.160 en local, sans modules annexes) |
| Récit et mode présentation | `web/recit.php` (mise en scène), `web/inc/contenu.php` (contenu), `web/assets/recit.js` (graphiques SVG), `web/assets/encre.css` |
| Transition en particules du récit | `web/assets/passage3d.js` |
| Rapport | `report/rapport.tex`, `report/annexe_maths.tex`, section en attente `report/section_apres_coup.tex` |

**Identité visuelle** : papier `#f1eadb`, encre `#15110e`, vermillon `#de3220`, indigo `#26407c`. Indigo = hausse, achat, modèle meilleur ; vermillon = baisse, vente, modèle moins bon ; encre = le modèle.

**Vérifier la 3D** : `/?scene=N` (1 à 9) ouvre directement une scène. Les erreurs de shader apparaissent dans la console du navigateur.

## 8. Trois phrases pour l'oral

- « Prédire le sens du Nikkei d'un mois sur l'autre ne marche pas avec des données publiques, et nous le montrons de six façons. »
- « La décision a été figée avant d'ouvrir le test : le résultat n'est pas arrangé. »
- « Ce qui se prévoit un peu, c'est l'agitation du marché, donc le risque à venir. »

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
