# Nikkei 225 : signal news × signal prix (long terme)

Notebook de recherche pour un algorithme de trading long terme sur le Nikkei 225. Il combine un signal tiré
des articles (sentiment FinBERT, volume d'articles, ton GDELT) et un signal prix (momentum, moyennes
mobiles, drawdown, régimes de marché par HMM), et mesure en combien de temps chaque signal se réalise.

## Fichiers

| Fichier | Rôle |
|---|---|
| `06_annexe_news_prix.ipynb` | Le notebook : analyses, backtests, optimisation, tableau de bord à curseurs |
| `nikkei_lab.py` | Moteur : signaux, backtest, analyse des horizons, grille, walk-forward, ML |
| `nikkei_hmm.py` | Modèle de Markov caché gaussien (EM), estimé en glissant et filtré sans regarder le futur |
| `nikkei_plots.py` | Graphiques (palette validée, clair et sombre) et tableau de bord ipywidgets |
| `../../data/` | Les données sont lues dans `data/2_construites` (les deux CSV) et `data/1_brutes/nikkei225_long.csv` (clôtures depuis 1970, Yahoo Finance, §3.2) |
| `figures/` | Les graphiques principaux, exportés en PNG |
| `requirements.txt` | Versions exactes des paquets Python |

## Ouvrir et lancer

Pour **lire** les résultats, il suffit d'ouvrir `06_annexe_news_prix.ipynb` (Jupyter, VS Code…) : tous les tableaux et
graphiques sont déjà calculés dans le fichier.

Pour le **ré-exécuter** ou changer les réglages, il faut Python 3.12 et les paquets de `requirements.txt`. Une
seule fois, dans le dossier du projet :

```bash
python3.12 -m venv .venv
source .venv/bin/activate          # Windows : .venv\Scripts\activate
pip install -r requirements.txt
```

Avec [uv](https://docs.astral.sh/uv/), qui installe aussi Python 3.12 si besoin :

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
```

Ensuite, à chaque fois :

```bash
source .venv/bin/activate
jupyter lab 06_annexe_news_prix.ipynb
```

Puis *Run All* (2 à 3 minutes). Le dossier `.venv` dépend de chaque machine : il ne se partage pas.

## Régler

- `PARAMS` (§0) : la stratégie courante. Tous les paramètres sont listés dans `nl.DEFAULT_PARAMS`, et une
  faute de frappe dans un nom lève une erreur.
- `news_gap_min_run`, `news_burst_mult`, `news_burst_confirm`, `news_burst_confirm_z` : nettoyage de la collecte
  d'articles (§1.1). Les trous sont traités comme des données manquantes ; les pics sont écrêtés, ou ignorés si
  l'attention GDELT ne les confirme pas. Mettre `news_gap_min_run=0, news_burst_mult=0` pour le signal brut.
- `price_hmm_*` : le HMM des régimes de marché (§3.1), utilisé comme signal prix avec `price_kind="hmm"` ou
  comme filtre de risque avec `risk_overlay="hmm"` (exposition × (1 − `overlay_k` × P(régime agité))).
  `risk_overlay="vol"` applique la même réduction avec une simple règle de volatilité, pour comparaison.
- `GRID` et `OBJECTIVE` (§7) : l'espace de recherche et le critère d'optimisation.
- §6 : curseurs interactifs. Les réglages modifiés s'affichent pour être recopiés dans `PARAMS`.

## Mises à jour des données

Remplacer les deux CSV dans `../../data/2_construites/` par des versions plus récentes (mêmes colonnes) et relancer le notebook.
L'historique long du §3.2 se met à jour depuis Python avec `nl.fetch_yahoo_history()` (connexion internet requise).
La section 9 donne l'exposition cible à partir des dernières données disponibles. Elle indique aussi combien des
20 dernières séances sont des trous ou des pics douteux, et comment l'exposition cible varie selon le nettoyage.
Si beaucoup de séances récentes sont des trous, re-télécharger les articles de ces séances avant d'agir.
