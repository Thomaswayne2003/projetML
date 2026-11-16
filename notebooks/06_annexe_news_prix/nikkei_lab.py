"""
nikkei_lab — moteur du notebook « Nikkei : signal news × signal prix ».

Contenu
-------
1. Chargement des données (marché + articles)                     -> load_data
2. Signal NEWS  (sentiment FinBERT des articles / ton GDELT)        -> news_signal
3. Signal PRIX  (tendance, momentum, moyennes mobiles, drawdown,   -> price_signal
                 régimes de marché par HMM)                        -> hmm_regimes (moteur : nikkei_hmm.py)
4. Combinaison + passage signal -> position + backtest réaliste     -> run_strategy
5. Analyse des horizons : en combien de temps un signal se réalise  -> horizon_profile, placebo_ic,
                                                                       decay_matrix, event_study, holding_curve
6. Optimisation : grille, IS/OOS, walk-forward, plateau, Deflated Sharpe
7. Méta-modèle ML walk-forward purgé (bonus)

Convention temporelle (importante pour éviter le biais d'anticipation)
--------------------------------------------------------------------
* Toute série indexée en t n'utilise que l'information disponible à la clôture de la séance t.
  Les articles sont déjà rattachés à leur séance (`session`) : ceux vus avant ~15h JST le jour t.
* La position décidée en t est exécutée à la clôture de t + exec_lag (exec_lag=1 par défaut),
  puis encaisse les rendements des jours suivants.
"""
from __future__ import annotations

import itertools
import math
import time
from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy import stats
from scipy.ndimage import uniform_filter
from scipy.signal import lfilter

import nikkei_hmm as nh

TD = 252  # jours de bourse par an

# =============================================================================
# 0. Paramètres par défaut (tous modifiables depuis le notebook)
# =============================================================================
DEFAULT_PARAMS: dict = dict(
    # ---------------- NEWS ----------------
    news_source="articles",   # 'articles' (FinBERT) | 'gdelt' (ton GDELT) | 'blend'
    news_score="prob",        # score article : 'prob' (p_pos-p_neg) | 'vote' (+1/0/-1) | 'neg' | 'pos'
    news_mode="level",        # 'level' (niveau du sentiment) | 'momentum' (rapide - lent) | 'attention' (volume anormal)
    news_halflife=20,         # demi-vie (en séances) de la mémoire des news
    news_slow_mult=4,         # momentum/attention : demi-vie lente = halflife * slow_mult
    news_prior=5.0,           # shrinkage : nb d'articles « fictifs » à la moyenne long terme
    news_w_boj=1.0,           # poids des articles thème BoJ
    news_w_japan=1.0,         # poids des articles thème Japon
    news_min_conf=0.0,        # filtre : garde les articles avec 1 - p_neu >= min_conf
    news_conf_power=0.0,      # pondère chaque article par (1 - p_neu) ** power
    news_dedup_days=3,        # supprime un titre déjà vu dans les N jours (0 = off)
    # --- qualité de la collecte (voir collection_quality) ---
    news_gap_min_run=2,       # N séances d'affilée sans article (ou panne GDELT signalée) = trou de collecte
                              # -> donnée manquante (0 = off : une séance vide compte comme « calme »)
    news_burst_mult=3.0,      # pic = nb d'articles > mult × médiane des 60 séances précédentes, écrêté à ce niveau (0 = off)
    news_burst_confirm=True,  # un pic que l'attention GDELT (mesurée sur tout le corpus) ne confirme pas = donnée manquante
    news_burst_confirm_z=0.0, # seuil de confirmation : max(attention GDELT Japon, BoJ) en z > seuil
    news_norm="rolling",      # normalisation : 'rolling' | 'expanding' | 'none'
    news_z_window=250,        # fenêtre de normalisation (séances)
    news_gdelt_weight=0.5,    # poids du GDELT si news_source='blend'
    news_direction=1,         # +1 = suivre le sentiment, -1 = contrarien
    # ---------------- PRIX ----------------
    price_kind="tsmom",       # 'tsmom' | 'composite' | 'ma' | 'sma_dist' | 'breakout' | 'drawdown' | 'hmm'
    price_lookback=120,       # fenêtre principale (séances)
    price_lookbacks=(20, 60, 120, 250),  # pour 'composite' : moyenne de tsmom sur ces fenêtres
    price_skip=0,             # tsmom : ignore les N dernières séances (12-1 momentum…)
    price_fast=20,            # 'ma' : EMA rapide
    price_slow=100,           # 'ma' : EMA lente
    price_vol_halflife=40,    # volatilité utilisée pour normaliser
    price_norm="auto",        # 'auto' | 'rms' (sans dé-moyenner) | 'rolling' | 'expanding' | 'none'
                              # (auto : 'rolling' pour drawdown/breakout, 'none' pour le régime HMM, sinon 'rms')
    price_z_window=500,
    price_direction=1,        # +1 = suivi de tendance, -1 = retour à la moyenne
    # ---------------- PRIX : régimes HMM (price_kind='hmm', voir nikkei_hmm.py) ----------------
    price_hmm_features="ret_vol",  # variables observées : 'ret' (rendement seul) | 'ret_vol' (+ log volatilité réalisée)
                                   # | 'trend_vol' (rendement moyen récent + log volatilité)
    price_hmm_states=2,            # nombre de régimes (2 = calme / agité ; 3 = calme / intermédiaire / agité)
    price_hmm_signal="regime",     # 'regime' : P(calme) - P(agité) | 'exp_ret' : rendement attendu par le modèle
    price_hmm_horizon=60,          # 'exp_ret' : horizon de la prévision (séances)
    price_hmm_sticky=0.0,          # pseudo-transitions ajoutées sur la diagonale : régimes plus persistants
    price_hmm_vol_halflife=10,     # demi-vie (séances) de la volatilité réalisée et de la tendance observées
    price_hmm_min_train=250,       # séances d'historique avant la première estimation
    price_hmm_refit=63,            # ré-estimation toutes les N séances, sur le passé seulement
    price_hmm_window=0,            # 0 = fenêtre croissante ; sinon N dernières séances
    # ---------------- COMBINAISON ----------------
    combo="linear",           # 'linear' | 'agree' | 'filter'
    w_news=0.5,               # poids du signal news (0 = prix seul, 1 = news seul)
    filter_threshold=-1.0,    # combo='filter' : si news < seuil, l'exposition est multipliée par filter_scale
    filter_scale=0.0,
    clip_z=3.0,               # écrêtage des signaux (en écarts-types)
    # ---------------- POSITION ----------------
    mapping="threshold",      # 'threshold' (hystérésis) | 'linear' | 'sigmoid'
    long_only=True,
    entry=0.0,                # threshold : entre long si score > entry
    exit=-0.25,               # threshold : sort si score < exit (hystérésis)
    scale=1.0,                # linear/sigmoid : pente
    base=0.0,                 # exposition « neutre » (threshold : exposition quand pas de signal)
    max_leverage=1.0,
    rebalance=5,              # on ne regarde le signal que toutes les N séances
    min_trade=0.0,            # bande de non-transaction (variation minimale d'exposition)
    vol_target=0.0,           # 0 = off ; sinon volatilité annuelle cible (ex. 0.15)
    vol_target_halflife=20,
    # ---------------- FILTRE DE RISQUE (surcouche multiplicative sur l'exposition) ----------------
    risk_overlay="none",      # 'none' | 'hmm' : exposition × (1 - overlay_k × P(régime agité du HMM price_hmm_*))
                              # | 'vol' : idem avec 1[volatilité réalisée > sa médiane passée] (référence simple)
    overlay_k=0.5,            # force de la réduction : 0,5 = exposition divisée par 2 en régime agité certain
    overlay_vol_halflife=10,  # 'vol' : demi-vie (séances) de la volatilité réalisée
    # ---------------- EXÉCUTION ----------------
    exec_lag=1,               # séances entre la décision et l'exécution (à la clôture)
    cost_bps=5.0,             # coût par unité d'exposition échangée (bps)
    use_cash_rate=True,       # le cash rapporte le TONA (taux au jour le jour JPY)
    div_yield=0.0,            # dividendes annuels de l'indice quand investi (~0.017 pour approx. total return)
)

NEWS_KEYS = [k for k in DEFAULT_PARAMS if k.startswith("news_")] + ["clip_z"]
PRICE_KEYS = [k for k in DEFAULT_PARAMS if k.startswith("price_")] + ["clip_z"]


def make_params(params: dict | None = None, **overrides) -> dict:
    """Fusionne les paramètres avec les valeurs par défaut et refuse les clés inconnues (fautes de frappe)."""
    p = dict(DEFAULT_PARAMS)
    for src in (params or {}), overrides:
        unknown = set(src) - set(DEFAULT_PARAMS)
        if unknown:
            raise KeyError(f"Paramètre(s) inconnu(s) : {sorted(unknown)}")
        p.update(src)
    return p


# =============================================================================
# 1. Données
# =============================================================================
class Data:
    """Données de marché + articles, avec un cache des signaux (accélère grilles et widgets)."""

    def __init__(self, market: pd.DataFrame, articles: pd.DataFrame):
        self.market = market
        self.articles = articles
        self.close = market["n225_close"].astype(float)
        self.ret = self.close.pct_change().fillna(0.0)
        rf = market["tona"] / 100 / TD if "tona" in market else pd.Series(0.0, index=market.index)
        self.rf = rf.ffill().fillna(0.0)
        sessions = pd.DatetimeIndex(articles["session"].unique())
        # calendrier des news : séances du marché + séances d'articles (avant le début / après la fin du marché)
        self.calendar = market.index.union(sessions).sort_values()
        self._cache: dict = {}

    def clear_cache(self):
        self._cache.clear()

    def __repr__(self):
        s = f"Data(marché {self.market.index[0].date()} -> {self.market.index[-1].date()}, {len(self.market)} séances"
        if len(self.articles):
            s += (f" ; {len(self.articles)} articles "
                  f"{self.articles['session'].min().date()} -> {self.articles['session'].max().date()}")
        return s + ")"


def load_price_history(path) -> Data:
    """Historique de cours seul (CSV date, close), par ex. le Nikkei 225 depuis 1970 : pour les analyses côté prix
    (HMM, momentum, filtre de risque). Sans articles ni taux : le cash ne rapporte rien (rf = 0)."""
    c = pd.read_csv(path, parse_dates=["date"]).set_index("date").sort_index()["close"].astype(float)
    market = c[~c.index.duplicated(keep="last")].dropna().to_frame("n225_close")
    return Data(market, pd.DataFrame({"session": pd.to_datetime(pd.Series([], dtype="object"))}))


def fetch_yahoo_history(symbol: str = "^N225", path="../../data/1_brutes/nikkei225_long.csv", start: str = "1970-01-01") -> pd.DataFrame:
    """Met à jour l'historique long depuis l'API publique de graphiques de Yahoo Finance (clôtures quotidiennes).
    Écrit un CSV (date, close) et le renvoie."""
    import json
    import urllib.parse
    import urllib.request
    p1 = int(pd.Timestamp(start).timestamp())
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}"
           f"?period1={max(p1, 0)}&period2=4102444800&interval=1d")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        r = json.load(resp)["chart"]["result"][0]
    tz = r["meta"].get("exchangeTimezoneName", "Asia/Tokyo")
    dates = pd.to_datetime(r["timestamp"], unit="s", utc=True).tz_convert(tz).date
    df = pd.DataFrame({"close": r["indicators"]["quote"][0]["close"]}, index=pd.DatetimeIndex(dates, name="date"))
    df = df[~df.index.duplicated(keep="last")].dropna()
    df.to_csv(path, float_format="%.2f")
    return df


def load_data(market_path, articles_path) -> Data:
    m = pd.read_csv(market_path, parse_dates=["date"]).set_index("date").sort_index()
    m = m[~m.index.duplicated(keep="last")]
    a = pd.read_csv(articles_path, parse_dates=["session", "seendate"])
    a["title"] = a["title"].fillna("").astype(str)
    a = a.sort_values("seendate", kind="stable").reset_index(drop=True)
    return Data(m, a)


# =============================================================================
# 2. Outils numériques
# =============================================================================
def _lam(halflife: float) -> float:
    return 0.5 ** (1.0 / max(float(halflife), 1e-9))


def ewsum(x: np.ndarray, halflife: float) -> np.ndarray:
    """Somme à décroissance exponentielle : y_t = lam * y_{t-1} + x_t."""
    return lfilter([1.0], [1.0, -_lam(halflife)], np.asarray(x, dtype=float))


def ewmean(x: pd.Series, halflife: float) -> pd.Series:
    """Moyenne exponentielle corrigée du biais d'initialisation, robuste aux NaN (ignorés)."""
    v = x.to_numpy(dtype=float)
    ok = ~np.isnan(v)
    num = ewsum(np.where(ok, v, 0.0), halflife)
    den = ewsum(ok.astype(float), halflife)
    return pd.Series(np.where(den > 1e-12, num / np.where(den > 1e-12, den, 1.0), np.nan), index=x.index)


def normalize(x: pd.Series, how: str = "rolling", window: int = 250, min_periods: int = 60) -> pd.Series:
    """Normalisation causale. 'rms' met à l'échelle sans retirer la moyenne (garde le signe d'une tendance)."""
    if how == "none":
        return x
    mp = min(min_periods, window) if window else min_periods
    if how == "rms":
        sd = np.sqrt((x ** 2).rolling(window, min_periods=mp).mean()) if window else np.sqrt((x ** 2).expanding(mp).mean())
        return x / sd
    if how == "expanding" or not window:
        mu, sd = x.expanding(mp).mean(), x.expanding(mp).std()
    elif how == "rolling":
        r = x.rolling(window, min_periods=mp)
        mu, sd = r.mean(), r.std()
    else:
        raise ValueError(f"normalisation inconnue : {how}")
    return (x - mu) / sd.replace(0, np.nan)


# =============================================================================
# 3. Signal NEWS
# =============================================================================
def prepare_articles(data: Data, dedup_days: float = 3, min_conf: float = 0.0) -> pd.DataFrame:
    """Filtre de confiance + dédoublonnage (même URL, ou même titre déjà vu dans les `dedup_days` jours)."""
    key = ("articles", dedup_days, min_conf)
    if key in data._cache:
        return data._cache[key]
    a = data.articles
    if min_conf > 0:
        a = a[(1 - a["p_neu"]) >= min_conf]
    if dedup_days and dedup_days > 0:
        a = a.drop_duplicates("url", keep="first")
        norm = a["title"].str.lower().str.replace(r"[^0-9a-z]+", " ", regex=True).str.strip()
        prev = a["seendate"].groupby(norm).shift(1)
        dup = ((a["seendate"] - prev) <= pd.Timedelta(days=dedup_days)) & (norm != "")
        a = a[~dup.to_numpy()]
    data._cache[key] = a
    return a


def article_scores(a: pd.DataFrame, kind: str = "prob") -> pd.Series:
    if kind == "prob":
        return a["p_pos"] - a["p_neg"]
    cls = a[["p_pos", "p_neg", "p_neu"]].to_numpy().argmax(1)  # 0=pos 1=neg 2=neu
    if kind == "vote":
        v = np.select([cls == 0, cls == 1], [1.0, -1.0], 0.0)
    elif kind == "neg":
        v = -(cls == 1).astype(float)
    elif kind == "pos":
        v = (cls == 0).astype(float)
    else:
        raise ValueError(f"news_score inconnu : {kind}")
    return pd.Series(v, index=a.index)


def news_daily(data: Data, p: dict) -> pd.DataFrame:
    """Agrégation par séance : S = somme pondérée des scores, N = somme des poids, C = nb d'articles."""
    key = ("daily", p["news_dedup_days"], p["news_min_conf"], p["news_score"], p["news_w_boj"],
           p["news_w_japan"], p["news_conf_power"])
    if key in data._cache:
        return data._cache[key]
    a = prepare_articles(data, p["news_dedup_days"], p["news_min_conf"])
    s = article_scores(a, p["news_score"]).to_numpy()
    w = np.where(a["theme"].to_numpy() == "boj", p["news_w_boj"], p["news_w_japan"]).astype(float)
    if p["news_conf_power"]:
        w = w * (1 - a["p_neu"].to_numpy()) ** p["news_conf_power"]
    df = pd.DataFrame({"S": w * s, "N": w, "C": (w > 0).astype(float)}).groupby(a["session"].to_numpy()).sum()
    df = df.reindex(data.calendar).fillna(0.0)
    data._cache[key] = df
    return df


def _sentiment_level(S: np.ndarray, N: np.ndarray, halflife: float, prior: float) -> np.ndarray:
    """Sentiment = moyenne exponentielle des scores pondérée par le nb d'articles,
    rétrécie vers la moyenne long terme quand il y a peu d'articles (shrinkage bayésien)."""
    num, den = ewsum(S, halflife), ewsum(N, halflife)
    cumS, cumN = np.cumsum(S), np.cumsum(N)
    m = np.divide(cumS, cumN, out=np.zeros_like(cumS), where=cumN > 0)  # moyenne long terme causale
    tot = den + prior
    return np.where(tot > 1e-12, (num + prior * m) / np.where(tot > 1e-12, tot, 1.0), np.nan)


def collection_quality(data: Data, p: dict) -> pd.DataFrame:
    """Contrôle qualité de la collecte d'articles, séance par séance (calendrier des news).

    * **trou** : au moins `news_gap_min_run` séances d'affilée sans aucun article, ou séance vide que le dataset
      signale aussi comme panne GDELT (`gdelt_gap`). C'est une donnée manquante, pas un « calme » médiatique.
    * **pic** : nombre d'articles > `news_burst_mult` × médiane des 60 séances observées précédentes.
      - **confirmé** si l'attention GDELT du jour (max Japon/BoJ, mesurée par GDELT sur tout son corpus, donc
        indépendante de la collecte) dépasse `news_burst_confirm_z` : gardé, mais écrêté au seuil (influence bornée) ;
      - **non confirmé** : traité comme donnée manquante (si `news_burst_confirm`).

    Colonnes utiles : `missing` (séance ignorée), `count_eff` (compte utilisé pour l'attention, NaN si manquant),
    `weight` (facteur appliqué aux articles du jour pour le sentiment)."""
    key = ("quality", p["news_dedup_days"], p["news_min_conf"], p["news_gap_min_run"], p["news_burst_mult"],
           p["news_burst_confirm"], p["news_burst_confirm_z"])
    if key in data._cache:
        return data._cache[key]
    a = prepare_articles(data, p["news_dedup_days"], p["news_min_conf"])
    cal = data.calendar
    m = data.market
    n = a.groupby("session").size().reindex(cal, fill_value=0).astype(float)
    gflag = m["gdelt_gap"].astype(bool) if "gdelt_gap" in m else pd.Series(False, index=m.index)
    zero = n == 0
    run = zero.groupby((zero != zero.shift()).cumsum()).transform("sum")
    if p["news_gap_min_run"]:  # 0 = aucune détection de trou (comportement brut)
        gap = zero & ((run >= p["news_gap_min_run"]) | gflag.reindex(cal).fillna(False).astype(bool))
    else:
        gap = pd.Series(False, index=cal)
    med = n.where(~gap).shift(1).rolling(60, min_periods=20).median().clip(lower=1.0)
    ratio = n / med
    att_cols = [c for c in ("gdelt_japan_attention", "gdelt_boj_attention") if c in m]
    if att_cols:  # valeurs recopiées pendant une panne GDELT = inutilisables pour confirmer
        gatt = m[att_cols].max(axis=1).where(~gflag).reindex(cal)
    else:
        gatt = pd.Series(np.nan, index=cal)
    mult = float(p["news_burst_mult"] or 0.0)
    burst = (ratio > mult) if mult > 0 else pd.Series(False, index=cal)
    confirmed = burst & (gatt > p["news_burst_confirm_z"])
    suspect = (burst & ~confirmed) if p["news_burst_confirm"] else pd.Series(False, index=cal)
    missing = gap | suspect
    cap = mult * med if mult > 0 else pd.Series(np.inf, index=cal)
    count_eff = np.minimum(n, cap.fillna(np.inf)).where(~missing)
    weight = (count_eff / n.where(n > 0)).where(n > 0, 1.0).fillna(0.0)
    q = pd.DataFrame({"n": n, "median_60": med, "ratio": ratio, "gdelt_attention": gatt, "gap": gap,
                      "burst": burst, "confirmed": confirmed, "suspect": suspect, "missing": missing,
                      "cap": cap, "count_eff": count_eff, "weight": weight})
    data._cache[key] = q
    return q


def _articles_raw(data: Data, p: dict) -> pd.Series:
    d = news_daily(data, p)
    q = collection_quality(data, p)
    hl, slow = p["news_halflife"], p["news_halflife"] * p["news_slow_mult"]
    w = q["weight"].to_numpy()
    S, N = d["S"].to_numpy() * w, d["N"].to_numpy() * w  # séances douteuses retirées, pics écrêtés
    mode = p["news_mode"]
    if mode == "level":
        x = _sentiment_level(S, N, hl, p["news_prior"])
    elif mode == "momentum":
        x = _sentiment_level(S, N, hl, p["news_prior"]) - _sentiment_level(S, N, slow, p["news_prior"])
    elif mode == "attention":  # volume de news anormal ; les séances manquantes sont sautées (la moyenne est tenue)
        C = (d["C"] * q["weight"]).where(~q["missing"])
        x = (np.log1p(ewmean(C, hl)) - np.log1p(ewmean(C, slow))).to_numpy()
    else:
        raise ValueError(f"news_mode inconnu : {mode}")
    return pd.Series(x, index=d.index)


def _gdelt_raw(data: Data, p: dict) -> pd.Series:
    m = data.market
    wj, wb = float(p["news_w_japan"]), float(p["news_w_boj"])
    col = "attention" if p["news_mode"] == "attention" else "tone"
    x = (wj * m[f"gdelt_japan_{col}"] + wb * m[f"gdelt_boj_{col}"]) / max(wj + wb, 1e-12)
    hl = p["news_halflife"]
    fast = ewmean(x, hl)
    if p["news_mode"] in ("momentum", "attention"):
        return fast - ewmean(x, hl * p["news_slow_mult"])
    return fast


def news_signal(data: Data, p: dict, on: str = "market") -> pd.Series:
    """Signal news normalisé (≈ z-score), écrêté et orienté. on='market' (séances de bourse) ou 'calendar'
    (inclut les séances d'articles postérieures à la dernière cotation : utile pour le signal du jour)."""
    key = ("news",) + tuple(p[k] for k in NEWS_KEYS)
    if key not in data._cache:
        src, how, win = p["news_source"], p["news_norm"], p["news_z_window"]
        parts = []
        if src in ("articles", "blend"):
            za = normalize(_articles_raw(data, p), how, win)
            parts.append((1 - p["news_gdelt_weight"] if src == "blend" else 1.0, za))
        if src in ("gdelt", "blend"):
            zg = normalize(_gdelt_raw(data, p), how, win).reindex(data.calendar).ffill()
            parts.append((p["news_gdelt_weight"] if src == "blend" else 1.0, zg))
        if not parts:
            raise ValueError(f"news_source inconnu : {src}")
        z = sum(w * x for w, x in parts)
        z = z.clip(-p["clip_z"], p["clip_z"]) * p["news_direction"]
        data._cache[key] = z.rename("news")
    z = data._cache[key]
    return z.reindex(data.market.index) if on == "market" else z


# =============================================================================
# 4. Signal PRIX
# =============================================================================
def price_raw(close: pd.Series, p: dict) -> pd.Series:
    lc = np.log(close)
    vol = lc.diff().ewm(halflife=p["price_vol_halflife"], min_periods=20).std()
    kind, L, S = p["price_kind"], int(p["price_lookback"]), int(p["price_skip"])
    if kind == "tsmom":      # rendement sur L séances / (vol * sqrt(L)) : « t-stat » de la tendance
        return (lc.shift(S) - lc.shift(L)) / (vol * np.sqrt(max(L - S, 1)))
    if kind == "composite":  # moyenne de tsmom multi-horizons (plus robuste)
        return pd.concat([(lc - lc.shift(int(l))) / (vol * np.sqrt(l)) for l in p["price_lookbacks"]], axis=1).mean(1, skipna=False)
    if kind == "ma":         # croisement de moyennes mobiles exponentielles (en log-prix)
        f, s = int(p["price_fast"]), int(p["price_slow"])
        return (lc.ewm(span=f, adjust=False).mean() - lc.ewm(span=s, adjust=False).mean()) / (vol * np.sqrt(s))
    if kind == "sma_dist":   # distance à la moyenne mobile simple L
        return (lc - lc.rolling(L).mean()) / (vol * np.sqrt(L))
    if kind == "breakout":   # position dans le canal de Donchian L, dans [-1, 1]
        hi, lo = close.rolling(L).max(), close.rolling(L).min()
        return 2 * (close - lo) / (hi - lo) - 1
    if kind == "drawdown":   # distance au plus haut sur L séances (≤ 0)
        return (lc - lc.rolling(L, min_periods=20).max()) / (vol * np.sqrt(L))
    raise ValueError(f"price_kind inconnu : {kind}")


HMM_FIT_KEYS = ["price_hmm_features", "price_hmm_states", "price_hmm_sticky", "price_hmm_vol_halflife",
                "price_hmm_min_train", "price_hmm_refit", "price_hmm_window"]


def hmm_regimes(data: Data, p: dict) -> dict:
    """Estimation glissante du HMM (mise en cache) : {'probs': probabilités filtrées par régime, 'fits': [...]}.
    Régime 0 = le plus calme, dernier régime = le plus agité. Voir nikkei_hmm.hmm_walk_forward."""
    p = make_params(p)
    key = ("hmm",) + tuple(p[k] for k in HMM_FIT_KEYS)
    if key not in data._cache:
        X = nh.hmm_features(data.close, p["price_hmm_features"], p["price_hmm_vol_halflife"])
        data._cache[key] = nh.hmm_walk_forward(X, n_states=p["price_hmm_states"], min_train=p["price_hmm_min_train"],
                                               refit=p["price_hmm_refit"], window=p["price_hmm_window"],
                                               sticky=p["price_hmm_sticky"])
    return data._cache[key]


def hmm_raw(data: Data, p: dict) -> pd.Series:
    """Signal HMM brut. 'regime' : P(calme) - P(agité), entre -1 et +1 ; 'exp_ret' : rendement cumulé attendu
    sur price_hmm_horizon séances selon le modèle, divisé par sa volatilité sur ce même horizon."""
    wf = hmm_regimes(data, p)
    if p["price_hmm_signal"] == "regime":
        pr = wf["probs"]
        return pr.iloc[:, 0] - pr.iloc[:, -1]
    if p["price_hmm_signal"] == "exp_ret":
        return nh.hmm_expected_return(wf, int(p["price_hmm_horizon"]))
    raise ValueError(f"price_hmm_signal inconnu : {p['price_hmm_signal']}")


REGIME_NAMES = {2: ["calme", "agité"], 3: ["calme", "intermédiaire", "agité"]}


def hmm_hindsight(data: Data, p: dict) -> pd.DataFrame:
    """Probabilités LISSÉES d'un HMM estimé sur tout l'historique : elles utilisent le futur (paramètres estimés
    avec toutes les données, et observations postérieures à t). Uniquement pour montrer l'écart avec les
    probabilités filtrées : un backtest qui les utilise est faux."""
    p = make_params(p)
    X = nh.hmm_features(data.close, p["price_hmm_features"], p["price_hmm_vol_halflife"]).dropna()
    vol_col = list(X.columns).index("logvol") if "logvol" in X.columns else None
    m = nh.GaussianHMM(p["price_hmm_states"], sticky=p["price_hmm_sticky"]).fit(X.to_numpy(), vol_col=vol_col)
    return pd.DataFrame(m.smooth(X.to_numpy()), index=X.index, columns=[f"régime {k}" for k in range(m.n_states)])


def hmm_regime_table(data: Data, p: dict, start=None, end=None) -> pd.DataFrame:
    """Description des régimes, d'après les probabilités filtrées (hors-échantillon) : part du temps, volatilité et
    rendement réalisés les jours où le régime est le plus probable, durée moyenne observée, et durée moyenne
    selon le modèle (dernière estimation). Le rendement est contemporain : il décrit, il ne prédit pas."""
    p = make_params(p)
    wf = hmm_regimes(data, p)
    pr = wf["probs"].loc[start:end].dropna()
    K = pr.shape[1]
    lab = pd.Series(pr.to_numpy().argmax(1), index=pr.index)
    r = np.log(data.close).diff().reindex(pr.index)
    runs = lab.groupby((lab != lab.shift()).cumsum()).agg(["first", "size"])
    last = wf["fits"][-1]
    rows = {}
    for k, name in enumerate(REGIME_NAMES.get(K, [f"régime {i}" for i in range(K)])):
        rk = r[lab == k]
        rows[name] = {"part du temps": float((lab == k).mean()),
                      "volatilité annualisée": float(rk.std() * np.sqrt(TD)),
                      "rendement annualisé": float(rk.mean() * TD),
                      "durée moyenne observée (séances)": float(runs.loc[runs["first"] == k, "size"].mean()),
                      "durée moyenne selon le modèle (séances)": float(last["durées"][k])}
    return pd.DataFrame(rows).T


def hmm_fit_history(data: Data, p: dict) -> pd.DataFrame:
    """Paramètres de chaque ré-estimation : volatilité des régimes extrêmes (si le rendement est observé),
    durées moyennes et temps de réalisation implicites. Des valeurs stables = des régimes bien identifiés."""
    p = make_params(p)
    rows = []
    for f in hmm_regimes(data, p)["fits"]:
        m = f["modèle"]
        row = {"estimé le": f["date"].date()}
        if p["price_hmm_features"] in ("ret", "ret_vol"):
            row["vol. calme"] = float(np.sqrt(m.vars_[0, 0] * TD))
            row["vol. agité"] = float(np.sqrt(m.vars_[-1, 0] * TD))
        row.update({"durée calme": float(f["durées"][0]), "durée agité": float(f["durées"][-1]),
                    "T50 implicite": f["T50"], "T90 implicite": f["T90"]})
        rows.append(row)
    return pd.DataFrame(rows).set_index("estimé le")


def _period_label(a, b) -> str:
    return f"{str(a)[:4]}-{str(b)[:4] if b else 'fin'}"


def hmm_forward_by_period(data: Data, wf: dict, periods, horizon: int = 60, lag: int = 1) -> pd.DataFrame:
    """Par période : part du temps où le régime agité est le plus probable (filtré), et rendement moyen des
    `horizon` séances suivantes selon le régime le plus probable."""
    pr = wf["probs"].dropna()
    K = pr.shape[1]
    lab = pd.Series(pr.to_numpy().argmax(1), index=pr.index)
    y = fwd_log_return(data.close, horizon, lag).reindex(pr.index) * 100
    rows = {}
    for a, b in periods:
        lk, yk = lab.loc[a:b], y.loc[a:b]
        rows[_period_label(a, b)] = {"part du temps en régime agité": float((lk == K - 1).mean()),
                                     f"rdt {horizon} j après « calme » (%)": float(yk[lk == 0].mean()),
                                     f"rdt {horizon} j après « agité » (%)": float(yk[lk == K - 1].mean())}
    return pd.DataFrame(rows).T


def stats_by_period(results: dict, periods, metrics=("CAGR", "Sharpe", "Max drawdown")) -> pd.DataFrame:
    """Mesures de plusieurs StrategyResult (plus le buy & hold) sur plusieurs périodes.
    Une ligne par stratégie, une colonne par (période, mesure)."""
    first = next(iter(results.values()))
    rows = {"Buy & Hold": {}}
    rows.update({name: {} for name in results})
    for a, b in periods:
        lab = _period_label(a, b)
        bt = first.bt.loc[a:b]
        bh = perf_stats(bt["bench"], rf=bt["rf"], expo=pd.Series(1.0, index=bt.index))
        rows["Buy & Hold"].update({(lab, m): bh[m] for m in metrics})
        for name, r in results.items():
            st = r.stats(a, b)
            rows[name].update({(lab, m): st[m] for m in metrics})
    return pd.DataFrame(rows).T


def hmm_report(data: Data, p: dict, horizons=(20, 60, 125, 250), lag: int = 1, start=None, end=None) -> dict:
    """Une ligne pour comparer des variantes de HMM : ce que dit le modèle (durées des régimes, temps de
    réalisation implicite) et ce qui s'est passé ensuite (IC de P(agité) avec le rendement futur ; rendement
    moyen à 60 séances selon le régime filtré le plus probable)."""
    p = make_params(p)
    wf = hmm_regimes(data, p)
    last, K = wf["fits"][-1], p["price_hmm_states"]
    pr = wf["probs"]
    out = {"durée calme (modèle)": float(last["durées"][0]), "durée agité (modèle)": float(last["durées"][-1]),
           "T50 implicite": last["T50"], "T90 implicite": last["T90"]}
    ic = ic_table({"x": pr.iloc[:, -1]}, data.close, horizons, lag, start, end).iloc[0]
    out.update({f"IC P(agité) h={h}": float(ic[h]) for h in horizons})
    lab = pr.dropna().idxmax(axis=1)
    y = fwd_log_return(data.close, 60, lag) * 100
    g = pd.concat([lab.rename("r"), y.rename("y")], axis=1).loc[start:end].dropna().groupby("r")["y"].mean()
    out["rdt 60 j après « calme » (%)"] = float(g.get("régime 0", np.nan))
    out["rdt 60 j après « agité » (%)"] = float(g.get(f"régime {K - 1}", np.nan))
    return out


def price_signal(data: Data, p: dict) -> pd.Series:
    key = ("price",) + tuple(p[k] for k in PRICE_KEYS)
    if key not in data._cache:
        how = p["price_norm"]
        if how == "auto":
            if p["price_kind"] == "hmm" and p["price_hmm_signal"] == "regime":
                how = "none"   # P(calme) - P(agité) est déjà borné entre -1 et +1
            else:
                how = "rolling" if p["price_kind"] in ("drawdown", "breakout") else "rms"
        raw = hmm_raw(data, p) if p["price_kind"] == "hmm" else price_raw(data.close, p)
        z = normalize(raw, how, p["price_z_window"])
        z = z.clip(-p["clip_z"], p["clip_z"]) * p["price_direction"]
        data._cache[key] = z.rename("price")
    return data._cache[key]


def risk_overlay(data: Data, p: dict) -> pd.Series:
    """Multiplicateur d'exposition entre 1 - overlay_k (risque maximal) et 1 (aucun risque détecté).
    'hmm' : probabilité filtrée du régime le plus agité ; 'vol' : volatilité réalisée au-dessus de sa médiane
    passée (règle simple, pour vérifier ce que le HMM apporte de plus)."""
    idx = data.market.index
    kind = p["risk_overlay"]
    if kind == "none" or not p["overlay_k"]:
        return pd.Series(1.0, index=idx, name="overlay")
    if kind == "hmm":
        risk = hmm_regimes(data, p)["probs"].iloc[:, -1]
    elif kind == "vol":
        r = np.log(data.close).diff()
        vol = r.ewm(halflife=p["overlay_vol_halflife"], min_periods=20).std()
        risk = (vol > vol.expanding(250).median()).astype(float).where(vol.notna())
    else:
        raise ValueError(f"risk_overlay inconnu : {kind}")
    return (1.0 - p["overlay_k"] * risk.reindex(idx).fillna(0.0)).rename("overlay")


# =============================================================================
# 5. Combinaison, positions, backtest
# =============================================================================
def combine(news: pd.Series, price: pd.Series, p: dict):
    """Retourne (score combiné, multiplicateur d'exposition)."""
    n, pr = news.fillna(0.0), price.fillna(0.0)
    w, c = p["w_news"], p["combo"]
    mult = pd.Series(1.0, index=n.index)
    if c == "linear":
        s = w * n + (1 - w) * pr
    elif c == "agree":  # on ne prend position que si les deux signaux sont du même côté
        s = (w * n + (1 - w) * pr).where(np.sign(n) == np.sign(pr), 0.0)
    elif c == "filter":  # le prix décide, les news coupent le risque quand elles sont très mauvaises
        s = pr
        mult = pd.Series(np.where(n < p["filter_threshold"], p["filter_scale"], 1.0), index=n.index)
    else:
        raise ValueError(f"combo inconnu : {c}")
    return s.rename("score"), mult


def _position_loop(score, mult, vscale, mapping, long_only, entry, exit_, scale, base,
                   max_lev, rebalance, min_trade):
    n = len(score)
    lo, hi = (0.0 if long_only else -max_lev), max_lev
    pos = np.zeros(n)
    cur, state = 0.0, 0
    reb = max(int(rebalance), 1)
    for i in range(n):
        if i % reb == 0:
            s = score[i]
            if np.isnan(s):
                target = cur
            else:
                if mapping == "threshold":
                    if s > entry:
                        state = 1
                    elif not long_only and s < -entry:
                        state = -1
                    elif state == 1 and s < exit_:
                        state = 0
                    elif state == -1 and s > -exit_:
                        state = 0
                    target = hi if state == 1 else (-max_lev if state == -1 else base)
                elif mapping == "linear":
                    target = base + scale * s
                elif mapping == "sigmoid":
                    target = lo + (hi - lo) / (1.0 + math.exp(-scale * (s - entry)))
                else:
                    raise ValueError(f"mapping inconnu : {mapping}")
                target = min(max(target * mult[i] * vscale[i], lo), hi)
            if abs(target - cur) >= min_trade or target == 0.0:
                cur = target
        pos[i] = cur
    return pos


def build_position(score: pd.Series, mult: pd.Series, data: Data, p: dict) -> pd.Series:
    if p["vol_target"] and p["vol_target"] > 0:
        rv = data.ret.ewm(halflife=p["vol_target_halflife"], min_periods=10).std() * np.sqrt(TD)
        vscale = (p["vol_target"] / rv).fillna(1.0).to_numpy()
    else:
        vscale = np.ones(len(score))
    pos = _position_loop(score.to_numpy(dtype=float), mult.to_numpy(dtype=float), vscale, p["mapping"],
                         bool(p["long_only"]), float(p["entry"]), float(p["exit"]), float(p["scale"]),
                         float(p["base"]), float(p["max_leverage"]), p["rebalance"], float(p["min_trade"]))
    return pd.Series(pos, index=score.index, name="pos")


def backtest(data: Data, pos: pd.Series, p: dict) -> pd.DataFrame:
    """Rendement = cash + exposition × (rendement indice + dividendes - cash) - coûts (formulation « futures »)."""
    r = data.ret
    rf = data.rf if p["use_cash_rate"] else pd.Series(0.0, index=r.index)
    d = p["div_yield"] / TD
    held = pos.shift(p["exec_lag"]).fillna(0.0)   # position en portefeuille après la clôture de t
    expo = held.shift(1).fillna(0.0)               # exposition qui encaisse le rendement du jour t
    turnover = held.diff().abs().fillna(held.abs())
    cost = turnover * p["cost_bps"] / 1e4
    gross = rf + expo * (r + d - rf)
    return pd.DataFrame({"pos": pos, "held": held, "expo": expo, "ret": r, "rf": rf, "turnover": turnover,
                         "cost": cost, "gross": gross, "net": gross - cost, "bench": r + d})


@dataclass
class StrategyResult:
    params: dict
    news: pd.Series
    price: pd.Series
    score: pd.Series
    pos: pd.Series
    bt: pd.DataFrame

    def stats(self, start=None, end=None) -> dict:
        b = self.bt.loc[start:end]
        return perf_stats(b["net"], rf=b["rf"], expo=b["expo"], turnover=b["turnover"], bench=b["bench"])

    def compare(self, start=None, end=None) -> pd.DataFrame:
        """Tableau stratégie vs buy & hold vs « B&H à exposition constante égale » (même exposition moyenne
        que la stratégie, sans timing) : c'est ce dernier qui mesure vraiment la valeur du timing."""
        b = self.bt.loc[start:end]
        s = self.stats(start, end)
        bh = perf_stats(b["bench"], rf=b["rf"], expo=pd.Series(1.0, index=b.index))
        e = float(b["expo"].mean())
        eq_ret = b["rf"] + e * (b["bench"] - b["rf"])
        be = perf_stats(eq_ret, rf=b["rf"], expo=pd.Series(e, index=b.index))
        return pd.DataFrame({"Stratégie": s, "Buy & Hold": bh, f"B&H expo constante {e:.0%}": be})

    def yearly(self, start=None, end=None) -> pd.DataFrame:
        b = self.bt.loc[start:end]
        g = b.groupby(b.index.year)
        out = pd.DataFrame({"Stratégie": g["net"].apply(lambda x: (1 + x).prod() - 1),
                            "Buy & Hold": g["bench"].apply(lambda x: (1 + x).prod() - 1),
                            "Exposition moy.": g["expo"].mean()})
        out["Écart"] = out["Stratégie"] - out["Buy & Hold"]
        return out


def run_strategy(data: Data, params: dict | None = None, **overrides) -> StrategyResult:
    p = make_params(params, **overrides)
    news = news_signal(data, p)
    price = price_signal(data, p)
    score, mult = combine(news, price, p)
    pos = build_position(score, mult * risk_overlay(data, p), data, p)
    return StrategyResult(p, news, price, score, pos, backtest(data, pos, p))


def run_from_score(data: Data, score: pd.Series, params: dict | None = None, **overrides) -> StrategyResult:
    """Backtest d'un score quelconque (ex. sortie du méta-modèle ML) avec les mêmes règles de position/exécution."""
    p = make_params(params, **overrides)
    sc = score.reindex(data.market.index).rename("score")
    pos = build_position(sc, risk_overlay(data, p), data, p)
    nan = pd.Series(np.nan, index=sc.index)
    return StrategyResult(p, nan, nan, sc, pos, backtest(data, pos, p))


def run_price_only(data: Data, params: dict | None = None, **overrides) -> StrategyResult:
    """Stratégie sur le seul signal prix (sans news), y compris sur un historique de cours seul
    (load_price_history). Le filtre de risque `risk_overlay` s'applique comme dans run_strategy."""
    p = make_params(params, **overrides)
    price = price_signal(data, p).reindex(data.market.index)
    score = price.fillna(0.0).rename("score")
    pos = build_position(score, risk_overlay(data, p), data, p)
    nan = pd.Series(np.nan, index=data.market.index)
    return StrategyResult(p, nan, price, score, pos, backtest(data, pos, p))


# =============================================================================
# 6. Mesures de performance
# =============================================================================
def max_drawdown(ret: pd.Series) -> float:
    eq = (1 + ret).cumprod()
    return float((eq / eq.cummax() - 1).min())


def perf_stats(ret: pd.Series, rf=None, expo=None, turnover=None, bench=None) -> dict:
    ret = ret.dropna()
    n = len(ret)
    if n < 2:
        return {}
    yrs = n / TD
    rf = (rf.reindex(ret.index).fillna(0.0) if isinstance(rf, pd.Series) else pd.Series(0.0, index=ret.index))
    ex = ret - rf
    eq = (1 + ret).cumprod()
    cagr = eq.iloc[-1] ** (1 / yrs) - 1
    vol = ret.std() * np.sqrt(TD)
    sharpe = ex.mean() / ex.std() * np.sqrt(TD) if ex.std() > 0 else np.nan
    dn = np.sqrt((np.minimum(ex, 0) ** 2).mean())
    mdd = max_drawdown(ret)
    out = {"CAGR": cagr, "Volatilité": vol, "Sharpe": sharpe,
           "Sortino": ex.mean() / dn * np.sqrt(TD) if dn > 0 else np.nan,
           "Max drawdown": mdd, "Calmar": cagr / abs(mdd) if mdd < 0 else np.nan,
           "% jours positifs": float((ret > 0).mean()), "Années": yrs}
    if expo is not None:
        e = expo.reindex(ret.index)
        out["Exposition moy."] = float(e.abs().mean())
        out["% temps investi"] = float((e.abs() > 1e-9).mean())
    if turnover is not None:
        t = turnover.reindex(ret.index).fillna(0.0)
        n_tr = int((t > 1e-9).sum())
        out["Rotation / an"] = float(t.sum() / yrs)
        out["Nb transactions"] = n_tr
        out["Durée moy. position (j)"] = n / max(n_tr, 1)
    if bench is not None:
        b = bench.reindex(ret.index).fillna(0.0)
        beta = np.cov(ret, b)[0, 1] / b.var()
        out["Bêta"] = beta
        out["Alpha annuel"] = (ret.mean() - beta * b.mean()) * TD
        te = (ret - b).std() * np.sqrt(TD)
        out["Info ratio vs B&H"] = (ret - b).mean() * TD / te if te > 0 else np.nan
        if expo is not None:  # valeur du timing : comparaison à une exposition constante égale
            e = float(expo.reindex(ret.index).mean())
            cagr_eq = (1 + rf + e * (b - rf)).prod() ** (1 / yrs) - 1
            out["CAGR B&H même expo"] = cagr_eq
            out["Gain de timing (CAGR)"] = cagr - cagr_eq
    return out


def drawdown_series(ret: pd.Series) -> pd.Series:
    eq = (1 + ret.fillna(0)).cumprod()
    return eq / eq.cummax() - 1


# =============================================================================
# 7. Analyse des horizons : « en combien de temps le signal se réalise-t-il ? »
# =============================================================================
def fwd_log_return(close: pd.Series, h: int, lag: int = 1) -> pd.Series:
    """log(C[t+lag+h] / C[t+lag]) : rendement réalisé entre l'exécution et la sortie h séances plus tard."""
    lc = np.log(close)
    return lc.shift(-(lag + h)) - lc.shift(-lag)


def _ols_hac(y: np.ndarray, x: np.ndarray, lags: int):
    """Régression y = a + b x, erreurs standard de Newey-West (gère le chevauchement des rendements)."""
    X = np.column_stack([np.ones_like(x), x])
    XtX_inv = np.linalg.inv(X.T @ X)
    beta = XtX_inv @ (X.T @ y)
    u = y - X @ beta
    Xu = X * u[:, None]
    S = Xu.T @ Xu
    for L in range(1, min(lags, len(y) - 1) + 1):
        G = Xu[L:].T @ Xu[:-L]
        S += (1 - L / (lags + 1)) * (G + G.T)
    V = XtX_inv @ S @ XtX_inv
    return beta[1], math.sqrt(max(V[1, 1], 0.0))


def horizon_profile(signal: pd.Series, close: pd.Series, horizons, lag: int = 1, start=None, end=None) -> pd.DataFrame:
    """Pour chaque horizon h : corrélation de rang (IC) et « projection locale » :
    beta(h) = rendement cumulé moyen (en %) sur h séances pour un signal à +1 écart-type,
    avec IC 95 % Newey-West (lags = h + lag) pour tenir compte des rendements qui se chevauchent."""
    rows = []
    for h in horizons:
        y = fwd_log_return(close, h, lag) * 100
        df = pd.concat([signal.rename("x"), y.rename("y")], axis=1).loc[start:end].dropna()
        if len(df) < 30:
            continue
        x = df["x"].to_numpy()
        xs = (x - x.mean()) / x.std()
        b, se = _ols_hac(df["y"].to_numpy(), xs, lags=h + lag)
        ic = stats.spearmanr(x, df["y"]).statistic
        rows.append({"h": h, "n": len(df), "n_indep": len(df) / h, "IC": ic, "beta_%": b, "se": se,
                     "t_hac": b / se if se > 0 else np.nan, "lo95": b - 1.96 * se, "hi95": b + 1.96 * se,
                     "beta_%_par_an": b * TD / h})
    return pd.DataFrame(rows).set_index("h")


def placebo_ic(signal: pd.Series, close: pd.Series, horizons, lag: int = 1, start=None, end=None,
               min_shift: int = 250, quantiles=(0.025, 0.5, 0.975)) -> pd.DataFrame:
    """Bande « hasard » : IC obtenus en décalant circulairement le signal (garde son autocorrélation).
    Si l'IC réel sort de la bande, il est peu probable qu'il soit dû au hasard."""
    out = {}
    for h in horizons:
        y = fwd_log_return(close, h, lag)
        df = pd.concat([signal.rename("x"), y.rename("y")], axis=1).loc[start:end].dropna()
        n = len(df)
        if n < 2 * min_shift + 10:
            continue
        rx = df["x"].rank().to_numpy(); ry = df["y"].rank().to_numpy()
        rx = (rx - rx.mean()) / rx.std(); ry = (ry - ry.mean()) / ry.std()
        cc = np.real(np.fft.ifft(np.fft.fft(rx) * np.conj(np.fft.fft(ry)))) / n
        null = cc[min_shift:n - min_shift]
        out[h] = np.quantile(null, quantiles)
    return pd.DataFrame(out, index=[f"q{q:g}" for q in quantiles]).T.rename_axis("h")


def realization_summary(prof: pd.DataFrame, t_min: float = 1.96) -> dict:
    """Résume la courbe beta(h) :
    * h_meilleur_t : horizon où l'évidence statistique est maximale (meilleur rapport signal/bruit) ;
    * h_signif_max : horizon le plus long où l'effet reste significatif (|t| >= t_min) ;
    * T50 / T90   : horizon où 50 % / 90 % de l'effet (mesuré jusqu'à h_signif_max) est réalisé.
    Au-delà de h_signif_max, les estimations sont trop bruitées pour conclure."""
    if prof.empty:
        return {}
    sgn = float(np.sign(prof.loc[prof["t_hac"].abs().idxmax(), "beta_%"])) or 1.0  # sens dominant du signal
    b, t = prof["beta_%"] * sgn, prof["t_hac"] * sgn
    # bloc contigu d'horizons significatifs autour de l'horizon du meilleur t
    hs = list(t.index)
    i = hs.index(t.idxmax())
    j = i
    while j + 1 < len(hs) and t.iloc[j + 1] >= t_min:
        j += 1
    h_sig = hs[j] if t.iloc[i] >= t_min else None
    out = {"sens": "+ (prédit dans le sens configuré)" if sgn > 0 else "− (prédit à l'envers : inverser le sens)",
           "h_meilleur_t": int(t.idxmax()), "t_max": float(t.max()),
           "effet_%_à_h_meilleur_t": float(b[t.idxmax()]),
           "h_signif_max": int(h_sig) if h_sig is not None else None, "T50": None, "T90": None}
    if h_sig is not None:
        bb = b.loc[:h_sig]
        bmax = bb.max()
        if bmax > 0:
            out["effet_max_%_signif"] = float(bmax)
            out["T50"] = int(bb.index[(bb >= 0.5 * bmax).to_numpy().argmax()])
            out["T90"] = int(bb.index[(bb >= 0.9 * bmax).to_numpy().argmax()])
    return out


def ic_table(signals: dict, close: pd.Series, horizons, lag: int = 1, start=None, end=None) -> pd.DataFrame:
    """IC de rang (Spearman) de plusieurs variantes de signal (lignes) pour plusieurs horizons (colonnes)."""
    fwd = {h: fwd_log_return(close, h, lag) for h in horizons}
    out = {}
    for name, s in signals.items():
        row = {}
        for h in horizons:
            df = pd.concat([s.rename("x"), fwd[h].rename("y")], axis=1).loc[start:end].dropna()
            row[h] = stats.spearmanr(df["x"], df["y"]).statistic if len(df) > 30 else np.nan
        out[name] = row
    return pd.DataFrame(out).T.rename_axis(columns="horizon h")


def subperiod_ic(signal: pd.Series, close: pd.Series, horizons, periods, lag: int = 1) -> pd.DataFrame:
    """Stabilité : IC par sous-période. Un signal fiable garde le même signe dans toutes les périodes."""
    out = {}
    for a, b in periods:
        out[f"{str(a)[:7]} à {str(b)[:7] if b else 'fin'}"] = ic_table({"x": signal}, close, horizons, lag, a, b).iloc[0]
    return pd.DataFrame(out).T


def horizon_table(signals: dict, close: pd.Series, horizons, lag: int = 1, start=None, end=None) -> pd.DataFrame:
    """Résumé « temps de réalisation » pour plusieurs signaux."""
    rows = {}
    for name, s in signals.items():
        rows[name] = realization_summary(horizon_profile(s, close, horizons, lag, start, end))
    return pd.DataFrame(rows).T


def decay_matrix(signal: pd.Series, close: pd.Series, delays, horizons, start=None, end=None) -> pd.DataFrame:
    """IC (rang) entre le signal en t et le rendement de [t+D, t+D+h] : montre si l'information
    met du temps à être intégrée (IC qui apparaît seulement pour D > 0) ou si elle s'use vite."""
    m = pd.DataFrame(index=pd.Index(delays, name="délai D"), columns=pd.Index(horizons, name="horizon h"), dtype=float)
    for D in delays:
        for h in horizons:
            y = fwd_log_return(close, h, D)
            df = pd.concat([signal.rename("x"), y.rename("y")], axis=1).loc[start:end].dropna()
            if len(df) > 30:
                m.loc[D, h] = stats.spearmanr(df["x"], df["y"]).statistic
    return m


def event_study(signal: pd.Series, close: pd.Series, threshold: float = 1.0, side: str = "above",
                horizon: int = 250, lag: int = 1, min_gap: int = 20, start=None, end=None,
                n_boot: int = 1000, seed: int = 0) -> dict:
    """Étude d'événements : chaque fois que le signal FRANCHIT le seuil (avec un délai minimal entre deux
    événements), on suit le rendement cumulé « anormal » (moins la dérive moyenne du marché) sur `horizon` séances."""
    s = signal.loc[start:end]
    cond = (s > threshold) if side == "above" else (s < threshold)
    onset = cond & ~cond.shift(1, fill_value=False)
    lc = np.log(close).to_numpy()
    idx = close.index
    pos_all = idx.get_indexer(onset[onset].index)
    events, last = [], -10 ** 9
    for i in pos_all:
        if i - last >= min_gap:
            events.append(i)
            last = i
    K = np.arange(horizon + 1)
    paths = np.full((len(events), horizon + 1), np.nan)
    for j, i in enumerate(events):
        a = i + lag
        if a >= len(lc):
            continue
        seg = lc[a:a + horizon + 1] - lc[a]
        paths[j, :len(seg)] = seg
    rr = np.diff(np.log(close.loc[start:end].to_numpy()))
    drift = np.nanmean(rr)
    abn = (paths - K * drift) * 100
    rng = np.random.default_rng(seed)
    if len(events) >= 3:
        boot = np.array([np.nanmean(abn[rng.integers(0, len(events), len(events))], axis=0) for _ in range(n_boot)])
        lo, hi = np.nanpercentile(boot, [2.5, 97.5], axis=0)
    else:
        lo = hi = np.full(horizon + 1, np.nan)
    with np.errstate(invalid="ignore"):
        above = np.where(np.isnan(abn), np.nan, (abn > 0).astype(float))
        hit = np.nanmean(above, axis=0) if len(events) else np.full(horizon + 1, np.nan)
    hit[0] = np.nan  # à k=0 tous les rendements valent 0 par construction
    return {"k": K, "mean_abn_%": np.nanmean(abn, axis=0) if len(events) else np.full(horizon + 1, np.nan),
            "lo": lo, "hi": hi, "hit_rate": hit, "n_events": len(events),
            "dates": idx[events], "paths_abn_%": abn, "drift_daily": drift,
            "raw_mean_%": np.nanmean(paths, axis=0) * 100 if len(events) else None}


def holding_curve(signal: pd.Series, data: Data, holds, lag: int = 1, long_only: bool = False,
                  cost_bps: float = 0.0, start=None, end=None) -> pd.DataFrame:
    """Version « portefeuille » : chaque jour on investit 1/H du capital selon le signal du jour et on le garde
    H séances (tranches qui se chevauchent, à la Jegadeesh-Titman). Le Sharpe en fonction de H indique
    l'horizon de détention où le signal paie le mieux."""
    f = signal.clip(-1, 1).fillna(0.0)
    if long_only:
        f = (f > 0).astype(float)
    p = make_params(exec_lag=lag, cost_bps=cost_bps)
    rows = []
    for H in holds:
        pos = f.rolling(int(H), min_periods=1).mean()
        bt = backtest(data, pos, p).loc[start:end]
        st = perf_stats(bt["net"], rf=bt["rf"], expo=bt["expo"], turnover=bt["turnover"], bench=bt["bench"])
        timing = (bt["expo"] - bt["expo"].mean()) * (bt["ret"] - bt["rf"])  # composante « market timing » pure
        rows.append({"H": H, "Sharpe": st["Sharpe"], "CAGR": st["CAGR"], "Max drawdown": st["Max drawdown"],
                     "Alpha annuel": st["Alpha annuel"],
                     "Sharpe timing pur": timing.mean() / timing.std() * np.sqrt(TD) if timing.std() > 0 else np.nan})
    return pd.DataFrame(rows).set_index("H")


# =============================================================================
# 8. Optimisation
# =============================================================================
def expand_grid(grid: dict) -> pd.DataFrame:
    keys = list(grid)
    return pd.DataFrame(list(itertools.product(*[grid[k] for k in keys])), columns=keys)


def run_grid(data: Data, base: dict, grid: dict, start=None, end=None, verbose: bool = True):
    """Évalue toutes les combinaisons de la grille. Retourne (configs, matrice des rendements nets quotidiens).
    Les signaux sont mis en cache : seules les parties qui changent sont recalculées."""
    configs = expand_grid(grid)
    base = make_params(base)
    t0, R = time.time(), {}
    for i, row in enumerate(configs.itertuples(index=False)):
        res = run_strategy(data, base, **row._asdict())
        R[i] = res.bt["net"].loc[start:end]
        if verbose and (i + 1) % max(1, len(configs) // 10) == 0:
            print(f"  {i + 1}/{len(configs)} configs  ({time.time() - t0:.1f}s)")
    rets = pd.DataFrame(R)
    rf = data.rf.reindex(rets.index).fillna(0.0)
    return configs, rets, rf


def score_returns(rets: pd.DataFrame, rf: pd.Series | None = None, objective: str = "sharpe") -> pd.Series:
    """Score vectorisé d'une matrice de rendements (colonnes = configs)."""
    rf = pd.Series(0.0, index=rets.index) if rf is None else rf.reindex(rets.index).fillna(0.0)
    ex = rets.sub(rf, axis=0)
    yrs = len(rets) / TD
    if objective == "sharpe":
        return ex.mean() / ex.std() * np.sqrt(TD)
    if objective == "sortino":
        return ex.mean() / np.sqrt((np.minimum(ex, 0) ** 2).mean()) * np.sqrt(TD)
    eq = (1 + rets).cumprod()
    cagr = eq.iloc[-1] ** (1 / yrs) - 1
    if objective == "cagr":
        return cagr
    mdd = (eq / eq.cummax() - 1).min()
    if objective == "calmar":
        return cagr / mdd.abs()
    if objective == "mar_sharpe":  # compromis : Sharpe pénalisé par le drawdown
        return (ex.mean() / ex.std() * np.sqrt(TD)) * (1 + mdd)
    raise ValueError(f"objectif inconnu : {objective}")


def plateau_scores(scores: pd.Series, grid: dict, size: int = 3) -> pd.Series:
    """Moyenne du score sur le voisinage de chaque config dans la grille (dimensions numériques ordonnées).
    Choisir le meilleur « plateau » plutôt que le meilleur pic réduit fortement le sur-apprentissage."""
    shape = tuple(len(v) for v in grid.values())
    arr = scores.sort_index().to_numpy().reshape(shape)
    sizes = [size if all(isinstance(x, (int, float, np.number)) and not isinstance(x, bool) for x in v) and len(v) > 2 else 1
             for v in grid.values()]
    filled = np.where(np.isnan(arr), np.nanmean(arr), arr)
    sm = uniform_filter(filled, size=sizes, mode="nearest")
    return pd.Series(sm.ravel(), index=scores.sort_index().index)


def is_oos_split(configs: pd.DataFrame, rets: pd.DataFrame, rf: pd.Series, split, objective="sharpe") -> pd.DataFrame:
    split = pd.Timestamp(split)
    a = score_returns(rets.loc[:split - pd.Timedelta(days=1)], rf, objective)
    b = score_returns(rets.loc[split:], rf, objective)
    out = configs.copy()
    out["IS"], out["OOS"] = a, b
    return out


def walk_forward(configs: pd.DataFrame, rets: pd.DataFrame, rf: pd.Series, grid: dict | None = None,
                 first_test="2020-01-01", objective="sharpe", train_years: float | None = None,
                 selection="best", freq="YS") -> dict:
    """Ré-optimisation périodique : à chaque début de période, on choisit la config qui a le mieux marché
    sur le passé (fenêtre croissante ou glissante de `train_years` ans) et on la trade sur la période suivante.
    La courbe obtenue est 100 % hors-échantillon."""
    starts = pd.date_range(first_test, rets.index[-1], freq=freq)
    pieces, chosen = [], []
    for k, ts in enumerate(starts):
        te = starts[k + 1] if k + 1 < len(starts) else rets.index[-1] + pd.Timedelta(days=1)
        tr0 = rets.index[0] if train_years is None else ts - pd.DateOffset(days=int(365.25 * train_years))
        train = rets.loc[tr0:ts - pd.Timedelta(days=1)]
        test = rets.loc[ts:te - pd.Timedelta(days=1)]
        if len(train) < TD or len(test) == 0:
            continue
        sc = score_returns(train, rf, objective)
        if selection == "plateau" and grid is not None:
            sc = plateau_scores(sc, grid)
        best = int(sc.idxmax())
        pieces.append(test[best])
        row = configs.loc[best].to_dict()
        row.update({"début test": ts.date(), "score IS": sc[best],
                    "score OOS": float(score_returns(test[[best]], rf, objective).iloc[0]) if len(test) > 20 else np.nan,
                    "config": best})
        chosen.append(row)
    oos = pd.concat(pieces) if pieces else pd.Series(dtype=float)
    return {"oos_returns": oos, "chosen": pd.DataFrame(chosen)}


def effective_trials(rets: pd.DataFrame, market: pd.Series | None = None, corr_threshold: float = 0.8,
                     max_cols: int = 1500, seed: int = 0) -> int:
    """Nombre « effectif » d'essais indépendants : on retire d'abord le facteur commun (le marché, que toutes les
    configs détiennent en partie), puis on regroupe les configs dont les rendements actifs sont corrélés à plus de
    `corr_threshold` (classification hiérarchique). Nombre de groupes = nombre d'idées réellement différentes testées."""
    from scipy.cluster.hierarchy import fcluster, linkage

    X = rets.T.drop_duplicates().T  # configs identiques (ex. w_news=0 avec des params news différents)
    if X.shape[1] > max_cols:
        X = X[np.random.default_rng(seed).choice(X.columns, max_cols, replace=False)]
    if market is not None:
        m = market.reindex(X.index).fillna(0.0).to_numpy()
        beta = (X.to_numpy() - X.to_numpy().mean(0)).T @ (m - m.mean()) / ((m - m.mean()) ** 2).sum()
        X = X - np.outer(m, beta)
    X = X.loc[:, X.std() > 1e-12]
    if X.shape[1] < 2:
        return X.shape[1]
    Z = linkage(X.T.to_numpy(), method="average", metric="correlation")
    return int(len(set(fcluster(Z, 1 - corr_threshold, criterion="distance"))))


def deflated_sharpe(best_ret: pd.Series, trials_sharpe_ann: pd.Series, n_trials: float, rf=None) -> dict:
    """Deflated Sharpe Ratio (Bailey & López de Prado, 2014) : probabilité que le meilleur Sharpe trouvé soit
    réellement > 0 une fois corrigé du nombre d'essais, de la longueur de l'historique et de la non-normalité."""
    r = best_ret.dropna()
    if rf is not None:
        r = r - rf.reindex(r.index).fillna(0.0)
    T = len(r)
    sr = r.mean() / r.std()  # Sharpe quotidien
    g3, g4 = stats.skew(r), stats.kurtosis(r, fisher=False)
    var_sr = np.nanvar(trials_sharpe_ann / np.sqrt(TD))
    emc = 0.5772156649
    N = max(n_trials, 2)
    sr0 = math.sqrt(var_sr) * ((1 - emc) * stats.norm.ppf(1 - 1 / N) + emc * stats.norm.ppf(1 - 1 / (N * math.e)))
    z = (sr - sr0) * math.sqrt(T - 1) / math.sqrt(max(1 - g3 * sr + (g4 - 1) / 4 * sr ** 2, 1e-12))
    return {"Sharpe annuel": sr * np.sqrt(TD), "Sharpe « chance pure » attendu": sr0 * np.sqrt(TD),
            "Nb essais (effectif)": N, "DSR (proba que le vrai Sharpe > 0)": float(stats.norm.cdf(z))}


# =============================================================================
# 9. Signal du jour
# =============================================================================
def _target_from_score(s: float, p: dict, prev_pos: float) -> float:
    lo, hi = (0.0 if p["long_only"] else -p["max_leverage"]), p["max_leverage"]
    if p["mapping"] == "linear":
        t = p["base"] + p["scale"] * s
    elif p["mapping"] == "sigmoid":
        t = lo + (hi - lo) / (1.0 + math.exp(-p["scale"] * (s - p["entry"])))
    else:  # threshold : on repart de l'état courant (hystérésis)
        state = 1 if prev_pos > p["base"] + 1e-9 else (-1 if prev_pos < -1e-9 else 0)
        if s > p["entry"]:
            state = 1
        elif not p["long_only"] and s < -p["entry"]:
            state = -1
        elif state == 1 and s < p["exit"]:
            state = 0
        elif state == -1 and s > -p["exit"]:
            state = 0
        t = hi if state == 1 else (-p["max_leverage"] if state == -1 else p["base"])
    return float(min(max(t, lo), hi))


def live_snapshot(data: Data, params: dict | None = None) -> pd.Series:
    """Dernières valeurs des signaux et exposition cible. Les news peuvent être plus récentes que le dernier
    cours disponible (articles rattachés à des séances postérieures) : on les utilise."""
    res = run_strategy(data, params)
    p = res.params
    news_cal = news_signal(data, p, on="calendar").dropna()
    price = res.price.dropna()
    n_last, n_date = float(news_cal.iloc[-1]), news_cal.index[-1]
    p_last, p_date = float(price.iloc[-1]), price.index[-1]
    s, mult = combine(pd.Series([n_last]), pd.Series([p_last]), p)
    prev = float(res.pos.iloc[-1])
    overlay = float(risk_overlay(data, p).iloc[-1])
    target = _target_from_score(float(s.iloc[0]), p, prev) * float(mult.iloc[0]) * overlay
    if p["vol_target"] and p["vol_target"] > 0:
        rv = data.ret.ewm(halflife=p["vol_target_halflife"]).std().iloc[-1] * np.sqrt(TD)
        target = min(target * p["vol_target"] / rv, p["max_leverage"])
    q = collection_quality(data, p).iloc[-20:]
    return pd.Series({"Dernière séance de cotation": p_date.date(), "Dernière séance avec news": n_date.date(),
                      "Nikkei (dernière clôture)": float(data.close.iloc[-1]),
                      "Signal news (z)": n_last, "Signal prix (z)": p_last, "Score combiné": float(s.iloc[0]),
                      "Filtre de risque (multiplicateur)": overlay,
                      "Exposition actuelle (backtest)": prev, "Exposition cible": target,
                      "20 dernières séances : trous de collecte": int(q["gap"].sum()),
                      "20 dernières séances : pics confirmés (écrêtés)": int(q["confirmed"].sum()),
                      "20 dernières séances : pics non confirmés (ignorés)": int(q["suspect"].sum())})


# =============================================================================
# 10. Méta-modèle ML walk-forward purgé (bonus)
# =============================================================================
def make_features(data: Data, base: dict | None = None, news_halflives=(5, 20, 60),
                  price_lookbacks=(20, 60, 120, 250)) -> pd.DataFrame:
    """Variables explicatives causales : plusieurs mémoires de news, ton GDELT, momentum multi-horizons, etc."""
    p = make_params(base)
    feats = {}
    for hl in news_halflives:
        feats[f"news_sent_{hl}"] = news_signal(data, {**p, "news_halflife": hl, "news_mode": "level", "news_direction": 1})
    feats["news_mom"] = news_signal(data, {**p, "news_halflife": 10, "news_mode": "momentum", "news_direction": 1})
    feats["news_attention"] = news_signal(data, {**p, "news_halflife": 5, "news_mode": "attention", "news_direction": 1})
    feats["gdelt_tone_20"] = news_signal(data, {**p, "news_source": "gdelt", "news_halflife": 20, "news_mode": "level", "news_direction": 1})
    for L in price_lookbacks:
        feats[f"tsmom_{L}"] = price_signal(data, {**p, "price_kind": "tsmom", "price_lookback": L, "price_skip": 0, "price_direction": 1})
    feats["drawdown_250"] = price_signal(data, {**p, "price_kind": "drawdown", "price_lookback": 250, "price_direction": 1})
    r = data.ret
    feats["vol_ratio"] = np.log(r.rolling(20).std() / r.rolling(250, min_periods=60).std())
    return pd.DataFrame(feats)


def ml_walk_forward(X: pd.DataFrame, close: pd.Series, horizon: int = 60, lag: int = 1, retrain_every: int = 21,
                    min_train: int = 500, model: str = "logit", C: float = 0.1, start=None):
    """Entraîne périodiquement un modèle sur le passé uniquement, avec purge : un exemple daté τ n'est utilisé
    que si son label (rendement τ+lag -> τ+lag+horizon) est entièrement connu au moment de prédire."""
    from sklearn.linear_model import LogisticRegression, Ridge
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    y_ret = fwd_log_return(close, horizon, lag)
    Xc = X.dropna()
    idx = Xc.index
    first = idx[0] if start is None else max(idx[0], pd.Timestamp(start))
    pred = pd.Series(np.nan, index=X.index, name="ml_score")
    coefs = []
    pos_first = idx.get_indexer([idx[idx >= first][0]])[0]
    for k in range(pos_first, len(idx), retrain_every):
        t = idx[k]
        cutoff = k - horizon - lag  # dernier exemple dont le label est connu en t
        if cutoff < min_train:
            continue
        tr = idx[:cutoff + 1]
        ytr = y_ret.loc[tr]
        ok = ytr.notna()
        Xtr, ytr = Xc.loc[tr][ok], ytr[ok]
        if model == "logit":
            mdl = make_pipeline(StandardScaler(), LogisticRegression(C=C, max_iter=2000))
            mdl.fit(Xtr, (ytr > 0).astype(int))
        else:
            mdl = make_pipeline(StandardScaler(), Ridge(alpha=1.0 / C))
            mdl.fit(Xtr, ytr)
        block = idx[k:k + retrain_every]
        if model == "logit":
            pr = np.clip(mdl.predict_proba(Xc.loc[block])[:, 1], 1e-6, 1 - 1e-6)
            s = np.log(pr / (1 - pr))  # log-odds : > 0 si le modèle juge la hausse plus probable que la baisse
        else:
            pr = mdl.predict(Xc.loc[block])
            s = pr / ytr.std()  # rendement prédit en écarts-types : > 0 si hausse attendue
        pred.loc[block] = s
        coefs.append(pd.Series(mdl[-1].coef_.ravel(), index=X.columns, name=t))
    return pred, pd.DataFrame(coefs)
