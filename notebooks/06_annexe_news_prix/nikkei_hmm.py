"""
nikkei_hmm — régimes du Nikkei par modèle de Markov caché (HMM) gaussien, sans biais d'anticipation.

Un HMM suppose que le marché passe d'un régime caché à l'autre (calme, agité…) selon une chaîne de Markov,
et que, dans chaque régime, les observations (rendement quotidien, volatilité réalisée…) suivent une loi
gaussienne qui lui est propre.

* `GaussianHMM`      : estimation par EM (Baum-Welch). Les récurrences avant / arrière sont calculées par
                       produits matriciels préfixes (log2(T) étapes vectorisées au lieu d'une boucle sur T).
* `hmm_walk_forward` : ré-estime le modèle toutes les `refit` séances sur les seules données passées et ne
                       garde que les probabilités FILTRÉES P(régime_t | données jusqu'à t). Les probabilités
                       lissées (forward-backward) et le chemin de Viterbi utilisent le futur : c'est le piège
                       classique des backtests HMM.
* `implied_timing`   : durée moyenne de chaque régime et vitesse à laquelle le modèle « oublie » le régime
                       courant (T50 / T90 implicites), à comparer aux temps de réalisation mesurés.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

LOG2PI = float(np.log(2 * np.pi))


# =============================================================================
# Récurrences avant / arrière vectorisées
# =============================================================================
def _prefix_products(M: np.ndarray):
    """P_t = M_0 @ M_1 @ … @ M_t pour tout t (balayage de Hillis-Steele, log2(T) produits vectorisés).
    Chaque P_t est divisé par son maximum ; la vraie valeur vaut P_t * exp(log_scale_t)."""
    P = np.array(M, dtype=float)
    m = np.maximum(P.max(axis=(1, 2)), 1e-300)
    P /= m[:, None, None]
    ls = np.log(m)
    d, n = 1, len(P)
    while d < n:
        Q = P[:-d] @ P[d:]
        m = np.maximum(Q.reshape(n - d, -1).max(axis=1), 1e-300)
        Q /= m[:, None, None]
        P[d:] = Q
        ls[d:] = ls[:-d] + ls[d:] + np.log(m)
        d *= 2
    return P, ls


def _emission_logpdf(X: np.ndarray, means: np.ndarray, variances: np.ndarray) -> np.ndarray:
    """log N(x_t | mu_k, diag(var_k)) -> (T, K). Une ligne avec une valeur manquante n'apporte aucune information."""
    bad = np.isnan(X).any(axis=1)
    Xf = np.where(np.isnan(X), 0.0, X)
    ll = -0.5 * (LOG2PI * X.shape[1] + np.log(variances).sum(1)[None, :]
                 + (((Xf[:, None, :] - means[None]) ** 2) / variances[None]).sum(2))
    ll[bad] = 0.0
    return ll


def _forward(logb: np.ndarray, startprob: np.ndarray, transmat: np.ndarray):
    """Probabilités filtrées P(s_t | x_0..t) et log-vraisemblance. Retourne aussi b et M pour l'arrière."""
    c = logb.max(axis=1)
    b = np.exp(logb - c[:, None])
    a0 = startprob * b[0]
    s0 = a0.sum()
    a0 = a0 / s0
    if len(b) == 1:
        return a0[None], float(np.log(s0) + c.sum()), b, None
    M = transmat[None, :, :] * b[1:, None, :]          # M_t = A diag(b_t), t = 1..T-1
    P, ls = _prefix_products(M)
    au = np.einsum("k,tkj->tj", a0, P)                  # ∝ alpha_t
    s = au.sum(1)
    alpha = np.vstack([a0, au / s[:, None]])
    loglik = float(np.log(s0) + np.log(s[-1]) + ls[-1] + c.sum())
    return alpha, loglik, b, M


def _posteriors(logb: np.ndarray, startprob: np.ndarray, transmat: np.ndarray):
    """E-step : probabilités lissées gamma_t, transitions attendues sum_t xi_t, log-vraisemblance."""
    alpha, loglik, b, M = _forward(logb, startprob, transmat)
    K = len(startprob)
    if M is None:
        return alpha, np.zeros((K, K)), loglik
    Q, _ = _prefix_products(np.transpose(M[::-1], (0, 2, 1)))   # Q_k = (M_{T-1-k} … M_{T-1})^T
    beta = Q.sum(axis=1)[::-1]                                   # beta_0 … beta_{T-2}
    beta = np.vstack([beta / beta.sum(1, keepdims=True), np.ones((1, K)) / K])
    g = alpha * beta
    g /= g.sum(1, keepdims=True)
    xi = alpha[:-1, :, None] * transmat[None] * (b[1:] * beta[1:])[:, None, :]
    xi /= xi.sum(axis=(1, 2), keepdims=True)
    return g, xi.sum(0), loglik


def stationary(transmat: np.ndarray) -> np.ndarray:
    """Distribution stationnaire pi = pi A."""
    w, v = np.linalg.eig(transmat.T)
    pi = np.real(v[:, np.argmin(np.abs(w - 1))])
    return np.abs(pi) / np.abs(pi).sum()


# =============================================================================
# Modèle
# =============================================================================
class GaussianHMM:
    """HMM gaussien (covariance diagonale) estimé par EM.

    sticky    : pseudo-transitions ajoutées sur la diagonale de la matrice de transition (a priori de Dirichlet).
                Plus il est grand, plus les régimes estimés sont persistants (moins de faux changements).
    var_floor : plancher de variance, en fraction de la variance totale de chaque variable (évite qu'un régime
                se réduise à quelques points).
    n_init    : nombre d'initialisations ; on garde la meilleure vraisemblance. La première regroupe les séances
                par quantile de volatilité locale, les suivantes par blocs aléatoires (graine fixe : reproductible).
    Les régimes sont triés du plus calme (0) au plus agité : par log-volatilité moyenne quand elle fait partie des
    variables observées (`vol_col`), sinon par variance de la 1re variable (le rendement).
    """

    def __init__(self, n_states: int = 2, sticky: float = 0.0, var_floor: float = 1e-3, n_iter: int = 300,
                 tol: float = 1e-6, n_init: int = 3, seed: int = 0):
        self.n_states, self.sticky, self.var_floor = int(n_states), float(sticky), float(var_floor)
        self.n_iter, self.tol, self.n_init, self.seed = int(n_iter), float(tol), int(n_init), int(seed)

    # --- initialisations ---------------------------------------------------
    def _from_labels(self, X, lab, floor):
        K = self.n_states
        mu = np.array([np.nanmean(X[lab == k], 0) if (lab == k).sum() > 2 else np.nanmean(X, 0) for k in range(K)])
        var = np.array([np.nanvar(X[lab == k], 0) if (lab == k).sum() > 2 else np.nanvar(X, 0) for k in range(K)])
        A = np.full((K, K), 0.02 / (K - 1))
        np.fill_diagonal(A, 0.98)
        return np.full(K, 1.0 / K), A, mu, np.maximum(var, floor)

    def _inits(self, X, floor):
        K, T = self.n_states, len(X)
        v = pd.Series(X[:, 0]).rolling(20, min_periods=5).std().bfill().to_numpy()
        lab = np.searchsorted(np.quantile(v, np.linspace(0, 1, K + 1)[1:-1]), v)
        out = [self._from_labels(X, lab, floor)]
        rng = np.random.default_rng(self.seed)
        for _ in range(self.n_init - 1):
            cuts = np.sort(rng.choice(np.arange(1, T), size=max(T // 60, K), replace=False))
            blocks = np.split(np.arange(T), cuts)
            lab = np.empty(T, dtype=int)
            for blk in blocks:
                lab[blk] = rng.integers(0, K)
            out.append(self._from_labels(X, lab, floor))
        return out

    # --- EM -------------------------------------------------------------------
    def _em(self, X, theta, floor):
        pi, A, mu, var = (np.array(a, dtype=float) for a in theta)
        K = self.n_states
        ok = ~np.isnan(X).any(1)
        Xo = X[ok]
        prev = -np.inf
        self.n_iter_ = 0
        for _ in range(self.n_iter):
            self.n_iter_ += 1
            g, xi, ll = _posteriors(_emission_logpdf(X, mu, var), pi, A)
            pi = g[0] + 1e-6
            pi /= pi.sum()
            counts = xi + self.sticky * np.eye(K) + 1e-6
            A = counts / counts.sum(1, keepdims=True)
            go = g[ok]
            w = go.sum(0) + 1e-12
            mu = (go.T @ Xo) / w[:, None]
            var = np.maximum((go.T @ Xo ** 2) / w[:, None] - mu ** 2, floor)
            if ll - prev < self.tol * abs(ll):
                break
            prev = ll
        ll = _forward(_emission_logpdf(X, mu, var), pi, A)[1]
        return (pi, A, mu, var), ll

    def fit(self, X, init=None, vol_col: int | None = None, init_only: bool = False):
        """init      : paramètres de départ (ex. ceux de l'estimation précédente). Ils remplacent les
                       initialisations aléatoires ; l'initialisation par quantiles de volatilité est aussi essayée,
                       sauf si init_only=True (ré-estimation rapide).
        vol_col   : colonne « log volatilité » servant à trier les régimes (None = variance de la colonne 0)."""
        X = np.asarray(X, dtype=float)
        floor = self.var_floor * np.nanvar(X, axis=0)
        if init is not None and init_only:
            cands = [init]
        else:
            cands = self._inits(X, floor)
            if init is not None:
                cands = cands[:1] + [init]
        best = max((self._em(X, th, floor) for th in cands), key=lambda r: r[1])
        (pi, A, mu, var), self.loglik_ = best
        order = np.argsort(var[:, 0] if vol_col is None else mu[:, vol_col])   # 0 = régime le plus calme
        self.startprob_, self.means_, self.vars_ = pi[order], mu[order], var[order]
        self.transmat_ = A[np.ix_(order, order)]
        self.n_obs_ = int((~np.isnan(X).any(1)).sum())
        return self

    @property
    def params(self):
        return self.startprob_, self.transmat_, self.means_, self.vars_

    def n_free_params(self) -> int:
        K, D = self.means_.shape
        return K * (K - 1) + (K - 1) + 2 * K * D

    def bic(self) -> float:
        return -2 * self.loglik_ + self.n_free_params() * np.log(self.n_obs_)

    def filter(self, X) -> np.ndarray:
        """Probabilités filtrées P(s_t | x_0..t), en partant de la distribution stationnaire."""
        logb = _emission_logpdf(np.asarray(X, dtype=float), self.means_, self.vars_)
        return _forward(logb, stationary(self.transmat_), self.transmat_)[0]

    def smooth(self, X) -> np.ndarray:
        """Probabilités LISSÉES P(s_t | toutes les données) : utilisent le futur. Pour la description seulement."""
        logb = _emission_logpdf(np.asarray(X, dtype=float), self.means_, self.vars_)
        return _posteriors(logb, stationary(self.transmat_), self.transmat_)[0]


# =============================================================================
# Lecture « temps de réalisation » d'un modèle estimé
# =============================================================================
def implied_timing(model: GaussianHMM, horizon_max: int = 2000) -> dict:
    """Durée moyenne de chaque régime (1 / (1 - a_kk)) et vitesse d'oubli du régime courant.
    T50 / T90 : séances nécessaires pour que 50 % / 90 % de l'écart de rendement attendu entre « être dans
    le régime calme » et « être dans le régime agité » soit réalisé, selon le modèle."""
    A, mu = model.transmat_, model.means_[:, 0]
    K = len(A)
    dur = 1.0 / np.maximum(1.0 - np.diag(A), 1e-12)
    lam = np.sort(np.abs(np.linalg.eigvals(A)))[::-1]
    lam2 = float(lam[1]) if K > 1 else 0.0
    d = np.zeros(K)
    d[0], d[-1] = 1.0, -1.0                                 # calme - agité
    cum, v = [], d.copy()
    for _ in range(horizon_max):
        v = v @ A
        cum.append(v @ mu)
    cum = np.cumsum(cum)
    tot = cum[-1]
    frac = cum / tot if abs(tot) > 1e-15 else np.full(len(cum), np.nan)

    def first(q):
        hit = np.flatnonzero(frac >= q)
        return int(hit[0] + 1) if len(hit) else None

    return {"durées": dur, "lambda2": lam2,
            "demi-vie": float(np.log(0.5) / np.log(lam2)) if 0 < lam2 < 1 else np.inf,
            "T50": first(0.5), "T90": first(0.9), "écart_total_%": float(tot * 100)}


# =============================================================================
# Variables observées et estimation glissante
# =============================================================================
def hmm_features(close: pd.Series, kind: str = "ret", vol_halflife: float = 10) -> pd.DataFrame:
    """'ret'     : rendement log quotidien (le HMM « textbook ») ;
       'ret_vol' : rendement + log de la volatilité réalisée (EWMA, demi-vie `vol_halflife`), régimes plus stables ;
       'trend_vol' : rendement moyen récent (EWMA) + log volatilité : sépare tendance et turbulence."""
    r = np.log(close.astype(float)).diff()
    if kind == "ret":
        return r.to_frame("ret")
    vol = r.ewm(halflife=vol_halflife, min_periods=20).std()
    if kind == "ret_vol":
        return pd.DataFrame({"ret": r, "logvol": np.log(vol)})
    if kind == "trend_vol":
        return pd.DataFrame({"trend": r.ewm(halflife=vol_halflife, min_periods=20).mean(), "logvol": np.log(vol)})
    raise ValueError(f"variables HMM inconnues : {kind}")


def hmm_walk_forward(X: pd.DataFrame, n_states: int = 2, min_train: int = 500, refit: int = 63,
                     window: int = 0, sticky: float = 0.0, seed: int = 0, full_every: int = 4) -> dict:
    """Estimation glissante, 100 % causale.

    À la clôture de la séance f, on estime le HMM sur les séances [f - window + 1, f] (ou depuis le début si
    window = 0), puis ce modèle filtre les séances f … f + refit - 1. La probabilité datée t n'utilise que les
    observations jusqu'à t et des paramètres estimés avant t.
    Chaque ré-estimation part du modèle précédent ; toutes les `full_every` ré-estimations, on essaie aussi les
    initialisations de départ et on garde la meilleure vraisemblance (évite de rester coincé dans un optimum local).
    Retourne {'probs': DataFrame (T, K), 'fits': liste de dicts (date, modèle, durées…)}."""
    Xv = X.to_numpy(dtype=float)
    vol_col = list(X.columns).index("logvol") if "logvol" in X.columns else None
    valid = np.flatnonzero(~np.isnan(Xv).any(axis=1))
    T = len(X)
    probs = np.full((T, n_states), np.nan)
    fits, prev = [], None
    if len(valid) <= min_train:
        return {"probs": pd.DataFrame(probs, index=X.index), "fits": fits}
    first = valid[0]
    f = valid[min_train - 1]
    i = 0
    while f < T:
        lo = first if not window else max(first, f + 1 - int(window))
        quick = prev is not None and full_every > 0 and i % full_every != 0
        model = GaussianHMM(n_states, sticky=sticky, seed=seed).fit(
            Xv[lo:f + 1], init=prev.params if prev is not None else None, vol_col=vol_col, init_only=quick)
        i += 1
        end = min(f + int(refit), T)
        probs[f:end] = model.filter(Xv[first:end])[f - first:]
        fits.append({"date": X.index[f], "jusqu'à": X.index[end - 1], "modèle": model, **implied_timing(model)})
        prev, f = model, end
    cols = [f"régime {k}" for k in range(n_states)]
    return {"probs": pd.DataFrame(probs, index=X.index, columns=cols), "fits": fits}


def expected_return_parts(wf: dict, horizon: int) -> pd.DataFrame:
    """Prévision du modèle : rendement cumulé attendu sur les `horizon` prochaines séances, divisé par la
    volatilité stationnaire du modèle sur ce même horizon (une sorte de ratio de Sharpe attendu).
    Décomposée en deux parts :
    * 'niveau moyen' : ce qu'attend le modèle sans rien savoir du régime actuel (distribution stationnaire).
      Il ne bouge qu'aux ré-estimations et suit en pratique le rendement moyen passé depuis le début ;
    * 'partie régime' : l'écart dû au régime actuel, la seule information propre au HMM."""
    probs = wf["probs"]
    out = pd.DataFrame(np.nan, index=probs.index, columns=["total", "niveau moyen", "partie régime"])
    for fit in wf["fits"]:
        m = fit["modèle"]
        A, mu = m.transmat_, m.means_[:, 0]
        S, Ak = np.zeros_like(A), np.eye(len(A))
        for _ in range(int(horizon)):
            Ak = Ak @ A
            S += Ak
        pi = stationary(A)
        sd = np.sqrt(pi @ (m.vars_[:, 0] + mu ** 2) - (pi @ mu) ** 2) * np.sqrt(horizon)
        seg = probs.loc[fit["date"]:fit["jusqu'à"]]
        P = seg.to_numpy()
        out.loc[seg.index, "niveau moyen"] = float(pi @ S @ mu / sd)
        out.loc[seg.index, "partie régime"] = (P - pi) @ S @ mu / sd
    out["total"] = out["niveau moyen"] + out["partie régime"]
    return out


def expected_return_fixed(wf: dict, horizon: int, fit: int = -1) -> pd.Series:
    """DIAGNOSTIC : la même prévision, mais avec les paramètres d'une seule estimation (la dernière par défaut)
    appliqués à toutes les dates. Seules les probabilités de régime varient encore. Si ce signal ne prédit rien,
    le pouvoir apparent du rendement attendu vient des ré-estimations successives, pas du régime.
    Avec fit=-1, il utilise des paramètres estimés après coup : ne jamais le backtester."""
    m = wf["fits"][fit]["modèle"]
    A, mu = m.transmat_, m.means_[:, 0]
    S, Ak = np.zeros_like(A), np.eye(len(A))
    for _ in range(int(horizon)):
        Ak = Ak @ A
        S += Ak
    return pd.Series(wf["probs"].to_numpy() @ S @ mu, index=wf["probs"].index)


def hmm_expected_return(wf: dict, horizon: int) -> pd.Series:
    """Rendement attendu par le modèle (voir expected_return_parts)."""
    return expected_return_parts(wf, horizon)["total"]
