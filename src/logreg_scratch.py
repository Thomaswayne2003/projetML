"""Régression logistique L2 codée à la main, par descente de gradient (annexe de Maths, notebook 05).

J_λ(w, b) = -(1/m) Σ [y log p + (1 - y) log(1 - p)] + λ ||w||²,   p = σ(w·x + b)
∇_w J_λ = (1/m) Xᵀ(p - y) + 2λ w,   ∂J_λ/∂b = (1/m) Σ (p - y)   (b n'est pas pénalisé)
"""
import numpy as np


def sigmoide(u):
    return 1 / (1 + np.exp(-u))


def cout(w, b, X, y, lam=0.0):
    p = np.clip(sigmoide(X @ w + b), 1e-12, 1 - 1e-12)
    return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)) + lam * (w @ w)


def gradient(w, b, X, y, lam=0.0):
    r = sigmoide(X @ w + b) - y
    return X.T @ r / len(y) + 2 * lam * w, r.mean()


def constante_lipschitz(X, lam):
    """Borne L ≤ ¼ λmax(X̃ᵀX̃/m) + 2λ, avec X̃ = [X, 1] ; la descente converge pour α < 2/L."""
    Xt = np.c_[X, np.ones(len(X))]
    return 0.25 * np.linalg.eigvalsh(Xt.T @ Xt / len(X)).max() + 2 * lam


def descente(X, y, alpha, lam, T, w=None, b=0.0):
    """Descente de gradient ; renvoie les poids, l'intercept et l'historique du coût."""
    w = np.zeros(X.shape[1]) if w is None else np.asarray(w, dtype=float).copy()
    historique = np.empty(T)
    for t in range(T):
        gw, gb = gradient(w, b, X, y, lam)
        w, b = w - alpha * gw, b - alpha * gb
        historique[t] = cout(w, b, X, y, lam)
    return w, b, historique


def ajuster(X, y, lam, T=20000):
    """Ajuste avec le pas classique α = 1/L."""
    return descente(X, y, 1 / constante_lipschitz(X, lam), lam, T)
