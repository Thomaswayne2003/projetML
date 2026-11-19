"""Écrit notebooks/09_code_et_concepts.ipynb : tout le code du projet, module par module, avec les concepts expliqués.

Usage : python notebooks/fabriquer_09.py   puis   jupyter nbconvert --execute --inplace notebooks/09_code_et_concepts.ipynb
"""
from pathlib import Path

import nbformat as nbf

CELLULES = []
md = lambda t: CELLULES.append(nbf.v4.new_markdown_cell(t.strip()))
code = lambda t: CELLULES.append(nbf.v4.new_code_cell(t.strip()))

md(r"""
# Notebook 09 · Tout le code du projet, et les concepts derrière

Ce notebook rassemble **tout le code Python du projet** (dossiers `src/`, `app/` et `notebooks/06_annexe_news_prix/`),
dans l'ordre où il sert. Avant chaque fichier : ce qu'il fait, les concepts qu'il utilise expliqués simplement, et la
séance du cours qui les introduit (S = Applied ML, L = Maths & Stats).

Le code est **affiché, pas exécuté** : chaque cellule relit le fichier du dépôt, si bien que ce notebook montre toujours
la version à jour. Pour lancer un module : `python -m src.<module>` depuis la racine du projet.

| Partie | Contenu |
|---|---|
| 0 | Le projet en une page, et le lexique de tous les concepts |
| 1 | Configuration et données (dont Bloomberg) |
| 2 | Modèles, réglage, calibration, décision, test |
| 3 | Explicabilité et prédiction |
| 4 | Seconde version Bloomberg et améliorations sans surapprentissage |
| 5 | Explorations après coup : bancs d'essai, volatilité, signal de risque |
| 6 | Annexe news × prix (HMM, backtests) |
| 7 | La plateforme : API, tableau de bord, site |
""")

code(r"""
from pathlib import Path
import json
from IPython.display import Code, Markdown, display

RACINE = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()

def montrer(chemin):
    '''Affiche un fichier du dépôt avec la coloration Python, précédé de sa taille.'''
    f = RACINE / chemin
    texte = f.read_text(encoding="utf-8")
    display(Markdown(f"**`{chemin}`** · {len(texte.splitlines())} lignes"))
    display(Code(texte, language="python"))

def lire_json(chemin):
    return json.loads((RACINE / chemin).read_text(encoding="utf-8"))

fichiers = sorted(p.relative_to(RACINE).as_posix() for d in ["src", "app", "notebooks/06_annexe_news_prix"]
                  for p in (RACINE / d).glob("*.py"))
print(len(fichiers), "fichiers Python,", sum(len((RACINE / f).read_text().splitlines()) for f in fichiers), "lignes")
""")

md(r"""
## 0 · Le projet en une page

**La question.** Chaque fin de mois, faut-il acheter le Nikkei 225, rester neutre ou le vendre pour le mois suivant, et
faut-il couvrir le risque de change yen/euro ?

**La chaîne.**
1. *Collecte* (notebooks 00a, 00b) : prix, taux, change, enquêtes (Tankan), news GDELT notées par FinBERT, puis
   Bloomberg comme référence pour la seconde version. Chaque série est décalée à sa **date de publication**.
2. *Table de modélisation* (`src/data.py`) : une ligne par mois, les cibles du mois suivant, un audit des fuites.
3. *Découpage chronologique* : entraînement jusqu'à fin 2021, validation 2022-2023, test 2024-2026 ouvert une seule fois.
4. *Trois modèles* (logistique, forêt aléatoire, gradient boosting) dans une même pipeline, réglés par Optuna avec une
   validation croisée temporelle (`src/pipeline.py`, `src/tune.py`).
5. *Calibration de Platt et règle de décision* par espérance de gain, figées avant le test (`src/decision.py`).
6. *Test unique* (`src/evaluate.py`), puis *explicabilité* : tranches, permutation, SHAP (`src/predict.py`, notebook 04).
7. *Après coup* : seconde version 1999-2026 avec Bloomberg (`src/v2_bloomberg.py`), améliorations sous protocole figé
   (`src/ameliorations.py`), et prévision de la volatilité plutôt que du sens (`src/volatilite.py`, `src/signal_risque.py`).
""")

md(r"""
## 0 · Lexique des concepts

### Cadrer et préparer les données (S1)
- **Fuite d'information (leakage).** Utiliser, pour prédire le mois t, une donnée qui n'était pas connue à la fin du
  mois t. Exemple du projet : le Tankan est daté par Bloomberg à la fin du trimestre, mais publié le mois suivant ;
  pris à sa date Bloomberg, il aurait fui. D'où le décalage de chaque série à sa date de publication, et un **audit
  automatique** qui arrête la construction si une variable regarde le futur.
- **Découpage chronologique.** En série temporelle, on n'apprend que sur le passé et on évalue sur le futur ; un
  mélange aléatoire ferait apprendre l'avenir. Trois blocs : entraînement, validation (pour choisir), test (pour juger,
  une seule fois).
- **Cible.** `y_baisse` = 1 si le Nikkei baisse le mois suivant (la classe positive des métriques est la baisse) ;
  `y_non_couvert` = 1 si ne pas couvrir le yen était meilleur.
- **Variables construites.** Momentum (rendement passé sur 3 et 12 mois), volatilité EWMA (moyenne exponentielle des
  rendements au carré, qui pèse davantage les jours récents), variation du taux japonais à 10 ans en points de base,
  portage (*carry* : écart de taux entre l'euro et le yen), attention et tonalité des news.
- **Standardisation.** z = (x − moyenne) / écart-type, calculés sur l'entraînement seulement, pour que les variables
  soient comparables et que la pénalité traite chaque coefficient de la même façon.

### Modèles (S2 à S5, L1, L2, L3)
- **Régression logistique (S2, L5).** p = σ(w·x + b), avec σ(u) = 1 / (1 + e^(−u)). Elle sort une probabilité ; w·x + b
  est la *log-cote* (log-odds).
- **Log-loss (S2, L5).** −[y log p + (1 − y) log(1 − p)], moyennée sur les mois. C'est l'opposé de la log-vraisemblance :
  minimiser la log-loss revient à maximiser la vraisemblance. Elle punit fort une probabilité confiante et fausse.
- **Descente de gradient (L1).** On part de w = 0 et on avance de −η ∇J à chaque pas. Pour la logistique,
  ∇J = (1/m) Xᵀ(p − y) + 2λw. Le coût est convexe : il n'a qu'un minimum, que la descente atteint si le pas η est
  inférieur à 2/L (L : constante de Lipschitz du gradient). Codé à la main dans `src/logreg_scratch.py`.
- **Régularisation (S3, L7).** On ajoute λ‖w‖² (L2, *ridge*) ou λ‖w‖₁ (L1, *lasso*) au coût. Elle rétrécit les
  coefficients et limite le surapprentissage. Vue bayésienne (L7) : L2 = un *prior* gaussien centré sur 0.
- **Moindres carrés (L2).** Régression linéaire : w = (XᵀX)⁻¹Xᵀy (équations normales). R² = 1 − SCR/SCT ; un R² négatif
  en validation veut dire « pire que la moyenne ».
- **Arbre de décision (S4, L3B).** Coupe l'espace en rectangles en choisissant à chaque nœud la coupe qui réduit le plus
  l'impureté (Gini ou entropie).
- **Forêt aléatoire (S5).** Beaucoup d'arbres, chacun sur un rééchantillon et un sous-ensemble de variables ; on fait la
  moyenne. Réduit la variance.
- **Gradient boosting (S5).** Des arbres peu profonds ajoutés un par un, chacun corrigeant les erreurs des précédents.
  Réduit le biais ; se surajuste vite sans régularisation.
- **k-means (L3C).** Regroupe les mois en k groupes autour de centres ; ici, deux régimes de marché (calme, agité),
  dont la distance sert de variable.

### Réglage et validation (S3, S5, S6)
- **Pipeline scikit-learn.** Enchaîne standardisation, régimes et modèle dans un seul objet, ajusté uniquement sur les
  données d'apprentissage de chaque pli : pas de fuite par le prétraitement.
- **TimeSeriesSplit.** Validation croisée temporelle : chaque pli apprend sur un début de période et valide sur la
  suite.
- **Optuna (TPE).** Cherche les hyperparamètres (λ, profondeur, taux d'apprentissage…) en proposant de nouveaux essais
  là où les précédents étaient bons. Chaque essai est journalisé.

### Classes, seuil, calibration (S7, S8)
- **Déséquilibre et PR-AUC (S7).** Quand une classe est rare, l'exactitude trompe ; la courbe précision-rappel et son
  aire jugent mieux la classe positive. La référence d'une PR-AUC est la fréquence de la classe.
- **Calibration (S8).** Un modèle est calibré si, parmi les mois où il annonce 60 %, la baisse arrive environ 6 fois
  sur 10. **Platt** ajuste une petite logistique sur les scores : p = σ(a·s + c). **Score de Brier** = moyenne de
  (p − y)² ; **ECE** = écart moyen entre probabilité annoncée et fréquence observée, par paquets.
- **Règle de décision (S8).** Agir seulement si l'espérance de gain dépasse le coût : on achète si la probabilité de
  hausse est assez haute, on vend si elle est assez basse, sinon on reste neutre. Les seuils sont choisis sur la
  validation puis **figés** avant le test.

### Explicabilité (S9)
- **Tranches (slices).** La performance par sous-période ou par régime : un score global peut cacher une période où le
  modèle se trompe toujours.
- **Importance par permutation.** On garde le modèle figé, on mélange une variable (ou un groupe de variables
  corrélées) entre les lignes, et on mesure combien la log-loss augmente. Grande hausse = variable utile ; valeur
  négative = le modèle ferait mieux sans elle.
- **SHAP.** Décompose une prédiction : f(x) = φ₀ + Σ φⱼ, sur l'échelle des log-cotes. Pour un modèle linéaire,
  φⱼ = wⱼ(zⱼ − E[zⱼ]). Les valeurs de Shapley répartissent l'écart à la moyenne entre variables, en moyenne sur tous les
  ordres d'arrivée. SHAP décrit le modèle, pas l'économie : aucune causalité.
- **Dépendance partielle (PDP).** La prédiction moyenne quand on fait varier une seule variable.

### Évaluer honnêtement après coup
- **Walk-forward.** Réentraîner chaque mois sur tous les mois passés, prédire le suivant : c'est ce qu'on aurait fait
  en vrai.
- **Test de Diebold-Mariano.** Compare les pertes de deux prévisions mois par mois et dit si l'écart est significatif,
  en tenant compte de l'autocorrélation.
- **Correction de Holm.** Quand on teste beaucoup de variantes, quelques-unes passent par hasard ; Holm resserre les
  seuils de significativité.
- **Bootstrap par blocs.** Rééchantillonne des blocs de mois consécutifs pour obtenir un intervalle de confiance du
  ratio de Sharpe (rendement moyen / volatilité) sans casser la dépendance temporelle.
- **Protocole figé (SHA-256).** Les variantes et critères sont écrits avant le calcul, avec une empreinte ; le code
  refuse de tourner si le protocole a changé. C'est la défense contre le surapprentissage par essais répétés.
- **GARCH, HMM.** GARCH prévoit la volatilité de demain à partir des chocs et de la volatilité d'hier ; un modèle de
  Markov caché (HMM) suppose des régimes cachés (calme, agité) qui se succèdent avec des probabilités de transition.

### Données externes
- **GDELT et FinBERT.** GDELT recense les articles de presse du monde entier ; FinBERT, un modèle de langue entraîné sur
  des textes financiers, note leur tonalité (positive, négative, neutre).
- **Bloomberg.** Référence pour la seconde version : il sert à contrôler les séries (Tankan, IPC, VIX) et leurs dates
  de publication. Les exports bruts restent hors de Git (licence).
""")


def section(titre, texte, fichiers):
    md(f"## {titre}\n\n{texte.strip()}")
    for f in fichiers:
        code(f'montrer("{f}")')


section("1 · Configuration", r"""
Un seul endroit pour les dates du découpage, les listes de variables et la graine aléatoire : `config.yaml` (première
version, 2010-2026) et `config_bloomberg.yaml` (seconde version, 1999-2026). `src/config.py` choisit l'un ou l'autre
selon la variable d'environnement `NIKKEI_CONFIG` et note le commit courant dans chaque résultat, pour la traçabilité.
""", ["src/config.py"])

code(r"""
import yaml
for nom in ["config.yaml", "config_bloomberg.yaml"]:
    c = yaml.safe_load((RACINE / nom).read_text())
    print(nom, "→", c["split"])
    print("   variables :", [v for k in ["news", "price", "macro", "fx"] for v in c["features"][k]])
""")

section("1 · Données : de la table mensuelle à la table de modélisation", r"""
**Ce que fait le fichier.** Il lit la table mensuelle construite par les notebooks de collecte, ajoute les cibles du
mois suivant, construit les variables de news, attribue à chaque mois son bloc (entraînement, validation, test) et
lance l'**audit des fuites**, qui arrête tout si un contrôle échoue : la cible est bien le rendement du mois suivant,
aucune cible n'est parmi les variables, le Tankan ne change qu'aux mois de publication (janvier, avril, juillet,
octobre), les variables de news calculées sur des données coupées en 2020 sont identiques (elles ne regardent pas le
futur), et aucune variable n'est presque parfaitement corrélée (Spearman) à une cible.

**Concepts.** Fuite d'information, décalage de publication, cible décalée d'un mois (`shift(-1)`), découpage
chronologique (S1).
""", ["src/data.py"])

section("2 · La pipeline et les espaces de recherche", r"""
**Ce que fait le fichier.** `construire_pipeline` assemble : imputation et standardisation, ajout des distances aux
régimes k-means (calme, agité), puis le modèle. `proposer` décrit pour Optuna l'espace de chaque modèle : force de la
régularisation de la logistique, nombre et profondeur des arbres, taux d'apprentissage du boosting.

**Concepts.** Pipeline sans fuite (le prétraitement s'ajuste dans chaque pli), standardisation, k-means (L3C),
logistique régularisée (S2, S3), forêt et boosting (S4, S5).
""", ["src/pipeline.py"])

section("2 · Réglage Optuna", r"""
**Ce que fait le fichier.** Pour chaque modèle, Optuna propose des hyperparamètres ; chaque proposition est jugée par
la log-loss moyenne sur les plis d'un `TimeSeriesSplit` de l'entraînement. Tous les essais sont écrits dans un journal ;
le meilleur de chaque modèle est réajusté et sauvegardé.

**Concepts.** Validation croisée temporelle, recherche bayésienne TPE, log-loss comme critère (S5, S6).
""", ["src/tune.py"])

section("2 · La logistique à la main (annexe de Maths)", r"""
**Ce que fait le fichier.** Il réécrit la régression logistique pénalisée sans scikit-learn : la sigmoïde, le coût
J_λ, son gradient, la constante de Lipschitz qui borne le pas, et la descente de gradient. Le notebook 05 vérifie
qu'on retrouve les coefficients de scikit-learn.

**Concepts.** Vraisemblance et log-loss (L5), gradient et descente (L1), pénalité L2 et prior gaussien (L7),
convexité : un seul minimum (L7, L8).
""", ["src/logreg_scratch.py"])

section("2 · Calibration, règle de décision, décision figée", r"""
**Ce que fait le fichier.** Il calibre les scores par Platt sur la validation, calcule les rendements des actions
(acheter, neutre, vendre ; couvert ou non), choisit les seuils qui maximisent l'espérance de gain, et **fige** le tout
dans `runs/decision_finale.json`. `--verifier` recalcule et compare au fichier sans rien écrire : la décision ne peut
pas être modifiée en douce après le test.

**Concepts.** Calibration de Platt, espérance de gain et coût de transaction, seuils, engagement avant le test (S8).
""", ["src/decision.py"])

code(r"""
d = lire_json("runs/decision_finale.json")
print({k: d[k] for k in list(d)[:8]})
""")

section("2 · Le test, ouvert une seule fois", r"""
**Ce que fait le fichier.** Il applique la décision figée aux mois 2024-2026 et mesure log-loss, Brier, PR-AUC et
rendement en euros, contre des références (probabilité constante, toujours acheter). Le résultat est dans
`runs/evaluation_test.json` ; le fichier ne sert plus qu'à vérifier qu'on retrouve les mêmes chiffres.

**Concepts.** Test unique, références naïves, métriques probabilistes et financières (S1, S7, S8).
""", ["src/evaluate.py"])

section("3 · Signal, historique et explication SHAP", r"""
**Ce que fait le fichier.** Il recharge le modèle figé, calcule la probabilité du dernier mois connu, l'action de la
règle et la **contribution SHAP** de chaque variable (pour la logistique : coefficient × écart à la moyenne de
l'entraînement, sur l'échelle des log-cotes). C'est ce que lisent l'API, le tableau de bord et le site.

**Concepts.** SHAP linéaire, additivité f(x) = φ₀ + Σφⱼ, lecture en cascade (*waterfall*) (S9). L'importance par
permutation et les tranches sont dans le notebook 04.
""", ["src/predict.py"])

section("4 · Seconde version : 1999-2026, Bloomberg en référence", r"""
**Ce que fait le fichier.** Après l'ouverture du test, il rejoue tout le protocole sur une histoire plus longue :
1. **Contrôle Bloomberg** : compare le Tankan, l'IPC et le VIX de la table aux exports Bloomberg. Le Tankan coïncide
   une fois décalé d'un mois (sa publication) ; pris à sa date Bloomberg il aurait fui. L'export du VIX, converti en
   euros par erreur, est écarté.
2. Réglage Optuna sur 1999-2021, calibration, seuils, puis évaluation et SHAP sur le test.

Tout s'écrit dans `runs/v2_bloomberg/` : la décision et l'évaluation de la première version ne sont pas touchées. C'est
cette table (`data/3_modele/dataset_model2.csv`) et ces contrôles que le site affiche dans la salle « Le dataset » et
le chapitre « Après coup ».

**Concepts.** Contrôle de qualité des données, dates de publication, réentraînement sur une histoire plus longue.
""", ["src/v2_bloomberg.py"])

code(r"""
cb = lire_json("runs/v2_bloomberg/controle_bloomberg.json")
for serie, contenu in cb.items():
    print(serie, "→", {k: v for k, v in (contenu.items() if isinstance(contenu, dict) else [])
                       if not isinstance(v, (list, dict))})
""")

section("4 · Améliorations sans surapprentissage (V3)", r"""
**Ce que fait le fichier.** Il fige d'abord un protocole (variantes, réglages, périodes, critères) avec son empreinte
SHA-256, puis réentraîne chaque variante mois après mois sur 2010-2023. Une variante n'est retenue que si elle bat la
référence au test de Diebold-Mariano corrigé par Holm **et** sur les deux sous-périodes. Résultat : 0 levier retenu
sur 17.

**Concepts.** Walk-forward, Diebold-Mariano, Holm, bootstrap par blocs du Sharpe, protocole figé.
""", ["src/ameliorations.py"])

section("5 · Bancs d'essai (explorations après coup)", r"""
Ces scripts répondent à des questions posées **après** le test. Ils ne remplacent pas le résultat figé.
- `banc_essai.py` : beaucoup de modèles réentraînés mois après mois (constante, AR(1), lissage, tendance, logistique).
- `banc_essai_jour.py` : la même question sur 4 118 séances journalières, avec les décalages horaires Tokyo/New York.
- `banc_essai_long.py` : apprendre depuis 2000 ou depuis 1970 aide-t-il ? (prix seulement).
- `banc_essai_normalisation.py` : standardiser sur une fenêtre glissante (24, 36, 60 mois) après le changement de régime.
- `banc_essai_ouverture.py` : une décision à l'ouverture de Tokyo sur l'ETF 1321, un produit réellement achetable.

**Concepts.** Walk-forward, références naïves, calibration (ECE), extrapolation et standardisation glissante.
""", ["src/banc_essai.py", "src/banc_essai_jour.py", "src/banc_essai_long.py", "src/banc_essai_normalisation.py",
      "src/banc_essai_ouverture.py"])

section("5 · Prévoir l'agitation plutôt que le sens", r"""
**Ce que font les fichiers.** Le sens du marché ne se prévoit pas, mais sa volatilité oui : elle vient par périodes.
`volatilite.py` prévoit la volatilité du mois suivant (GARCH, régression sur la volatilité passée) et la probabilité
d'un mois agité. `signal_risque.py` en déduit chaque jour la part à investir (100 %, 50 %, 0 %) ;
`signal_risque_variantes.py` teste trois améliorations écrites avant de voir leurs résultats.

**Concepts.** Volatilité conditionnelle, GARCH, R² hors échantillon, ciblage de volatilité, ratio de Sharpe.
""", ["src/volatilite.py", "src/signal_risque.py", "src/signal_risque_variantes.py"])

section("6 · Annexe news × prix", r"""
Étude préalable (dossier `notebooks/06_annexe_news_prix/`) : le signal des news et celui des prix, le temps qu'ils
mettent à se réaliser, des backtests de stratégies et un modèle de Markov caché pour les régimes.

**Concepts.** Corrélations décalées, backtest, HMM (états cachés, matrice de transition, algorithme de Viterbi).
""", ["notebooks/06_annexe_news_prix/nikkei_lab.py", "notebooks/06_annexe_news_prix/nikkei_hmm.py",
      "notebooks/06_annexe_news_prix/nikkei_plots.py"])

section("7 · La plateforme : API, tableau de bord, site", r"""
- `app/api.py` : une API FastAPI qui sert le signal, l'historique et le prédicteur (on règle les variables, l'API
  renvoie la probabilité et les contributions).
- `app/dashboard.py` : un tableau de bord Streamlit.
- `app/export_site.py` : fabrique le site statique publié sur GitHub Pages : il relit `runs/`, les notebooks et les
  figures, écrit `site/data/donnees.js`, convertit les notebooks en HTML et prépare les archives téléchargeables.
- `app/export_statique.py`, `app/build_site.py` : anciennes versions de l'export.
""", ["app/api.py", "app/dashboard.py", "app/export_site.py", "app/export_statique.py", "app/build_site.py"])

md(r"""
## Ce qu'il faut retenir

- Le projet tient en une idée : **ne jamais laisser le futur entrer dans le passé** (décalages de publication, audit
  des fuites, découpage chronologique, pipeline, décision figée, test ouvert une fois, protocole figé pour la V3).
- Le meilleur modèle est une logistique régularisée et calibrée : simple, explicable par SHAP, et pas battue par les
  arbres sur si peu de mois.
- Le sens du Nikkei d'un mois sur l'autre se prévoit à peine ; sa volatilité se prévoit nettement mieux.
""")

nb = nbf.v4.new_notebook()
nb.cells = CELLULES
nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3", "language": "python"}
sortie = Path(__file__).with_name("09_code_et_concepts.ipynb")
nbf.write(nb, sortie)
print("écrit :", sortie)
