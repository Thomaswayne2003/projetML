"""
nikkei_plots — graphiques et tableau de bord interactif du notebook.

Palette : instance de référence validée (clair ET sombre) — rôles fixes dans tout le notebook :
  stratégie = bleu · news = orange · prix = aqua · ML = jaune · buy & hold = gris.
Jamais de double axe : les séries d'échelles différentes vont dans des panneaux séparés.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import matplotlib as mpl
import matplotlib.dates  # noqa: F401  (mpl.dates utilisé pour placer les étiquettes de fin)
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, Normalize, TwoSlopeNorm, to_rgb
from matplotlib.ticker import FuncFormatter, PercentFormatter, FixedLocator

import nikkei_lab as nl

LIGHT = dict(surface="#fcfcfb", ink="#0b0b0b", ink2="#52514e", muted="#898781", grid="#e1e0d9", axis="#c3c2b7",
             strategy="#2a78d6", news="#eb6834", price="#1baf7a", ml="#eda100", bench="#898781", bench2="#c3c2b7",
             div=["#a32b2b", "#e34948", "#f4b4b3", "#f0efec", "#b7d3f6", "#3987e5", "#184f95"],
             seq=["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"])
DARK = dict(surface="#1a1a19", ink="#f0efec", ink2="#c3c2b7", muted="#898781", grid="#2c2c2a", axis="#383835",
            strategy="#3987e5", news="#d95926", price="#199e70", ml="#c98500", bench="#898781", bench2="#5a5955",
            div=["#f2a7a6", "#e66767", "#7a2f2f", "#383835", "#1c4a80", "#3987e5", "#b7d3f6"],
            seq=["#13325a", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"])
T: dict = dict(LIGHT)


def set_theme(dark: bool = False):
    """Applique le thème (clair par défaut ; dark=True pour un notebook en thème sombre)."""
    T.clear()
    T.update(DARK if dark else LIGHT)
    mpl.rcParams.update({
        "figure.facecolor": T["surface"], "axes.facecolor": T["surface"], "savefig.facecolor": T["surface"],
        "axes.edgecolor": T["axis"], "axes.labelcolor": T["ink2"], "axes.titlecolor": T["ink"],
        "axes.grid": True, "grid.color": T["grid"], "grid.linewidth": 0.7, "grid.linestyle": "-",
        "axes.axisbelow": True, "axes.spines.top": False, "axes.spines.right": False,
        "axes.linewidth": 0.8, "xtick.color": T["axis"], "ytick.color": T["axis"],
        "xtick.labelcolor": T["ink2"], "ytick.labelcolor": T["ink2"], "text.color": T["ink"],
        "legend.frameon": False, "legend.labelcolor": T["ink2"], "legend.fontsize": 9,
        "lines.linewidth": 1.5, "lines.solid_capstyle": "round", "lines.solid_joinstyle": "round",
        "font.family": "sans-serif", "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
        "font.size": 9.5, "axes.titlesize": 10.5, "axes.titleweight": "bold", "axes.titlelocation": "left",
        "axes.titlepad": 8, "figure.dpi": 110, "figure.constrained_layout.use": True,
        "axes.prop_cycle": mpl.cycler(color=[T["strategy"], T["news"], T["price"], T["ml"]]),
    })


set_theme(False)


# ----------------------------------------------------------------------------- utilitaires
def div_cmap():
    return LinearSegmentedColormap.from_list("div", T["div"])


def seq_cmap():
    return LinearSegmentedColormap.from_list("seq", T["seq"])


def _zero(ax, y=0.0):
    ax.axhline(y, color=T["axis"], lw=0.9, zorder=1)


def _end_label(ax, x, y, text, color):
    ax.scatter([x], [y], s=34, color=color, edgecolor=T["surface"], linewidth=1.5, zorder=6, clip_on=False)
    ax.annotate(text, (x, y), xytext=(7, 0), textcoords="offset points", va="center", fontsize=8.5,
                color=T["ink2"], annotation_clip=False)


def _end_labels(ax, items, min_px=12):
    """items : [(x, y, texte, couleur)] par priorité décroissante. Un point de fin pour chacun ;
    le texte n'est posé que s'il ne chevauche pas une étiquette déjà placée (sinon : la légende suffit)."""
    ax.figure.canvas.draw()  # nécessaire pour convertir en pixels avec l'échelle finale
    placed = []
    for x, y, text, colr in items:
        ax.scatter([x], [y], s=34, color=colr, edgecolor=T["surface"], linewidth=1.5, zorder=6, clip_on=False)
        py = ax.transData.transform((mpl.dates.date2num(x) if isinstance(x, pd.Timestamp) else x, y))[1]
        if all(abs(py - q) >= min_px for q in placed):
            placed.append(py)
            ax.annotate(text, (x, y), xytext=(7, 0), textcoords="offset points", va="center", fontsize=8.5,
                        color=T["ink2"], annotation_clip=False)


def _log_multiple_axis(ax):
    ax.set_yscale("log")
    lo, hi = ax.get_ylim()
    cands = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 15, 20]
    ticks = [t for t in cands if lo <= t <= hi]
    if len(ticks) > 7:
        ticks = ticks[::2] if 1 in ticks[::2] else ticks[1::2]
    ax.yaxis.set_major_locator(FixedLocator(ticks))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda x, _: f"×{x:g}"))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda *_: ""))
    ax.yaxis.set_minor_locator(FixedLocator([]))


def _k(x, _=None):
    return f"{x / 1000:.0f}K" if abs(x) >= 1000 else f"{x:.0f}"


def _log_price_axis(ax, lo, hi):
    """Axe log avec des graduations « rondes », de quelques milliers à 100 000 points."""
    ax.set_yscale("log")
    ticks = []
    for mults in ([1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8], [1, 2, 3, 5, 7], [1, 2, 5], [1]):
        ticks = [m * 10 ** e for e in range(2, 6) for m in mults if lo * 0.95 <= m * 10 ** e <= hi * 1.05]
        if len(ticks) <= 8:
            break
    ax.yaxis.set_major_locator(FixedLocator(ticks))
    ax.yaxis.set_major_formatter(FuncFormatter(_k))
    ax.yaxis.set_minor_formatter(FuncFormatter(lambda *_: ""))


def _horizon_axis(ax, horizons):
    ax.set_xscale("log")
    ticks = [h for h in (1, 2, 5, 10, 20, 40, 60, 125, 250, 500) if min(horizons) <= h <= max(horizons)]
    ax.xaxis.set_major_locator(FixedLocator(ticks))
    ax.xaxis.set_major_formatter(FuncFormatter(lambda x, _: f"{x:.0f}"))
    ax.xaxis.set_minor_formatter(FuncFormatter(lambda *_: ""))
    ax.set_xlabel("horizon h (séances de bourse)")


def _ink_on(rgb) -> str:
    r, g, b = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb[:3]]
    return "#ffffff" if 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.30 else "#0b0b0b"


# ----------------------------------------------------------------------------- données
def plot_overview(D: nl.Data, start=None):
    a = D.articles
    fig, axes = plt.subplots(3, 1, figsize=(11, 7.5), sharex=True, height_ratios=[1.4, 1, 1])
    c = D.close.loc[start:]
    ax = axes[0]
    ax.plot(c.index, c, color=T["ink2"], lw=1.3)
    _log_price_axis(ax, c.min(), c.max())
    ax.set_title("Nikkei 225 — clôture (échelle log)")
    m = a.groupby([pd.Grouper(key="session", freq="ME"), "theme"]).size().unstack(fill_value=0)
    s = a.groupby([pd.Grouper(key="session", freq="ME"), "theme"])["score"].mean().unstack()
    for col, lab, colr in (("boj", "BoJ", T["strategy"]), ("japan", "Japon", T["news"])):
        axes[1].plot(m.index, m[col], color=colr, lw=1.3, label=lab)
        axes[2].plot(s.index, s[col], color=colr, lw=1.3, label=lab)
    axes[1].set_title("Articles par mois et par thème")
    axes[1].legend(loc="upper left", ncols=2)
    axes[2].set_title("Sentiment moyen mensuel (FinBERT : p_pos − p_neg)")
    axes[2].legend(loc="lower left", ncols=2)
    _zero(axes[2])
    return fig


CRITICAL = "#d03b3b"  # couleur de statut « critique » (identique en clair et en sombre), toujours avec un libellé


def plot_collection(q: pd.DataFrame, start=None, end=None, confirm_z: float = 0.0,
                    title="Collecte des articles : trous et pics"):
    """Contrôle qualité : articles par séance, trous (zones grises), pics confirmés / non confirmés par GDELT."""
    d = q.loc[start:end]
    day = pd.Timedelta(days=1)
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(11, 6.2), sharex=True, height_ratios=[1.7, 1])
    normal = ~(d["burst"] | d["gap"])
    a1.bar(d.index[normal], d["n"][normal], width=1.0, color=T["bench2"], label="articles par séance")
    a1.bar(d.index[d["confirmed"]], d["n"][d["confirmed"]], width=1.0, color=T["strategy"],
           label="pic confirmé par GDELT : gardé, écrêté au seuil")
    a1.bar(d.index[d["suspect"]], d["n"][d["suspect"]], width=1.0, color=CRITICAL,
           label="pic non confirmé : ignoré")
    g = d["gap"].astype(int)
    runs = g.groupby((g != g.shift()).cumsum())
    first = True
    for _, r in runs:
        if r.iloc[0] == 1:
            a1.axvspan(r.index[0] - day * 0.6, r.index[-1] + day * 0.6, color=T["grid"], lw=0, zorder=0,
                       label="trou de collecte : ignoré" if first else None)
            first = False
    a1.plot(d.index, d["median_60"], color=T["ink2"], lw=1.1, label="médiane des 60 séances précédentes")
    if np.isfinite(d["cap"]).any():
        a1.plot(d.index, d["cap"], color=T["muted"], lw=0.9, label="seuil de pic")
    a1.set_ylabel("articles")
    a1.set_ylim(0, float(d["n"].max()) * 1.45 + 1)  # place pour la légende au-dessus des barres
    a1.legend(loc="upper left", fontsize=8, ncols=3)
    a1.set_title(title)
    a2.plot(d.index, d["gdelt_attention"], color=T["ink2"], lw=1.1)
    a2.axhline(confirm_z, color=T["muted"], lw=0.9)
    a2.annotate("seuil de confirmation", (1.0, confirm_z), xycoords=("axes fraction", "data"), xytext=(4, 0),
                textcoords="offset points", va="center", fontsize=8, color=T["ink2"], annotation_clip=False)
    for mask, colr, lab in ((d["confirmed"], T["strategy"], "pic confirmé"), (d["suspect"], CRITICAL, "pic non confirmé")):
        a2.scatter(d.index[mask], d["gdelt_attention"][mask].fillna(a2.get_ylim()[0]), s=30, color=colr,
                   edgecolor=T["surface"], linewidth=1.2, zorder=5, label=lab)
    _zero(a2)
    a2.set_ylabel("z")
    a2.legend(loc="upper left", fontsize=8.5, ncols=2)
    a2.set_title("Attention GDELT ce jour-là (max Japon / BoJ, mesurée sur tout le corpus GDELT)")
    return fig


# ----------------------------------------------------------------------------- signaux
def plot_signals(res: nl.StrategyResult, D: nl.Data, start=None, end=None, title=None):
    p = res.params
    fig, axes = plt.subplots(5, 1, figsize=(11, 10), sharex=True, height_ratios=[1.3, 1, 1, 1, 0.8])
    c = D.close.loc[start:end]
    axes[0].plot(c.index, c, color=T["ink2"], lw=1.3)
    _log_price_axis(axes[0], c.min(), c.max())
    axes[0].set_title(title or "Nikkei 225")
    n = res.news.loc[start:end]
    axes[1].plot(n.index, n, color=T["news"], lw=1.1)
    sens = "suivi" if p["news_direction"] > 0 else "contrarien"
    axes[1].set_title(f"Signal news — {p['news_source']} / {p['news_mode']}, demi-vie {p['news_halflife']} j, {sens} (z)")
    pr = res.price.loc[start:end]
    axes[2].plot(pr.index, pr, color=T["price"], lw=1.1)
    if p["price_kind"] == "hmm":
        sens = "suit le régime" if p["price_direction"] > 0 else "contrarien"
        axes[2].set_title(f"Signal prix — HMM {p['price_hmm_features']}, {p['price_hmm_states']} régimes, "
                          f"{p['price_hmm_signal']}, {sens} (z)")
    else:
        sens = "tendance" if p["price_direction"] > 0 else "retour à la moyenne"
        axes[2].set_title(f"Signal prix — {p['price_kind']} {p['price_lookback']} j, {sens} (z)")
    s = res.score.loc[start:end]
    axes[3].plot(s.index, s, color=T["strategy"], lw=1.1)
    axes[3].set_title(f"Score combiné — {p['combo']}, poids news {p['w_news']:.2f}")
    if p["mapping"] == "threshold":
        for lvl, lab in ((p["entry"], "entrée"), (p["exit"], "sortie")):
            axes[3].axhline(lvl, color=T["muted"], lw=0.8)
            axes[3].annotate(lab, (1.0, lvl), xycoords=("axes fraction", "data"), xytext=(4, 0),
                             textcoords="offset points", va="center", fontsize=8, color=T["ink2"], annotation_clip=False)
    for ax in axes[1:4]:
        _zero(ax)
    e = res.bt["expo"].loc[start:end]
    axes[4].fill_between(e.index, 0, e, color=T["strategy"], alpha=0.12, lw=0, step="post")
    axes[4].plot(e.index, e, color=T["strategy"], lw=1.1, drawstyle="steps-post")
    axes[4].yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    axes[4].set_title("Exposition (part du capital investie dans l'indice)")
    return fig


def plot_panels(D: nl.Data, panels: dict, start=None, end=None, title="Nikkei 225"):
    """Prix en haut puis un panneau par signal (petits multiples, axe x partagé, jamais de double axe).
    panels : {titre: (série, couleur)}"""
    n = len(panels)
    fig, axes = plt.subplots(n + 1, 1, figsize=(11, 2.0 * n + 2.6), sharex=True, height_ratios=[1.3] + [1] * n)
    c = D.close.loc[start:end]
    axes[0].plot(c.index, c, color=T["ink2"], lw=1.2)
    _log_price_axis(axes[0], c.min(), c.max())
    axes[0].set_title(title)
    for ax, (name, (s, colr)) in zip(axes[1:], panels.items()):
        s = s.loc[start:end]
        ax.plot(s.index, s, color=colr, lw=1.1)
        _zero(ax)
        ax.set_title(name)
    return fig


def plot_signal_vs_price(signal: pd.Series, D: nl.Data, color, title, start=None, end=None):
    fig, axes = plt.subplots(2, 1, figsize=(11, 5), sharex=True, height_ratios=[1.2, 1])
    c = D.close.loc[start:end]
    axes[0].plot(c.index, c, color=T["ink2"], lw=1.2)
    _log_price_axis(axes[0], c.min(), c.max())
    axes[0].set_title("Nikkei 225")
    s = signal.loc[start:end]
    axes[1].plot(s.index, s, color=color, lw=1.1)
    _zero(axes[1])
    axes[1].set_title(title)
    return fig


def plot_regimes(close: pd.Series, wf: dict, smoothed: pd.DataFrame | None = None, start=None, end=None,
                 title="Régimes HMM estimés sans regarder le futur"):
    """Haut : Nikkei (log) ; zones grises = séances où le régime le plus agité est le plus probable (filtré).
    Bas : probabilité filtrée du régime le plus agité (connue le jour même) et, en pointillé, la probabilité
    lissée d'un modèle estimé sur tout l'historique : elle connaît le futur et ne doit jamais servir à un backtest."""
    pr = wf["probs"].loc[start:end].dropna()
    K = pr.shape[1]
    c = close.loc[pr.index[0]:pr.index[-1]]
    fig, (a1, a2) = plt.subplots(2, 1, figsize=(11, 6.4), sharex=True, height_ratios=[1.5, 1])
    a1.plot(c.index, c, color=T["ink2"], lw=1.2)
    _log_price_axis(a1, c.min(), c.max())
    top = pd.Series((pr.to_numpy().argmax(1) == K - 1).astype(int), index=pr.index)
    day, first = pd.Timedelta(days=1), True
    for _, g in top.groupby((top != top.shift()).cumsum()):
        if g.iloc[0] == 1:
            a1.axvspan(g.index[0] - day * 0.5, g.index[-1] + day * 0.5, color=T["grid"], lw=0, zorder=0,
                       label="régime agité le plus probable (filtré)" if first else None)
            first = False
    a1.legend(loc="upper left")
    a1.set_title(title)
    p_top = pr.iloc[:, -1]
    a2.fill_between(p_top.index, 0, p_top, color=T["price"], alpha=0.15, lw=0)
    a2.plot(p_top.index, p_top, color=T["price"], lw=1.1, label="filtrée : connue le jour même (utilisée par la stratégie)")
    if smoothed is not None:
        sm = smoothed.iloc[:, -1].loc[p_top.index[0]:p_top.index[-1]]
        a2.plot(sm.index, sm, color=T["ink2"], lw=0.9, ls=(0, (3, 2)),
                label="lissée sur tout l'historique : connaît le futur")
    a2.set_ylim(0, 1.32)
    a2.set_yticks([0, 0.25, 0.5, 0.75, 1.0])
    a2.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    a2.set_title(f"Probabilité du régime le plus agité ({K} régimes)")
    a2.legend(loc="upper left", ncols=2)
    return fig


# ----------------------------------------------------------------------------- heatmaps
def plot_heatmap(df: pd.DataFrame, title="", center=0.0, vmax=None, fmt="{:.2f}", kind="div", cbar_label="",
                 xlabel=None, ylabel=None, annotate=True, figsize=None, ax=None):
    data = df.to_numpy(dtype=float)
    nr, nc = data.shape
    if ax is None:
        figsize = figsize or (max(6.0, 0.62 * nc + 3.2), max(2.4, 0.34 * nr + 1.3))
        fig, ax = plt.subplots(figsize=figsize)
    else:
        fig = ax.figure
    if kind == "div":
        vmax = vmax or float(np.nanmax(np.abs(data - center))) or 1.0
        norm, cmap = TwoSlopeNorm(vcenter=center, vmin=center - vmax, vmax=center + vmax), div_cmap()
    else:
        norm, cmap = Normalize(np.nanmin(data), np.nanmax(data)), seq_cmap()
    mesh = ax.pcolormesh(np.ma.masked_invalid(data), cmap=cmap, norm=norm, edgecolors=T["surface"], linewidth=1.5)
    ax.set_xlim(0, nc)
    ax.set_ylim(nr, 0)
    ax.grid(False)
    for sp in ax.spines.values():
        sp.set_visible(False)
    ax.set_xticks(np.arange(nc) + 0.5, [str(c) for c in df.columns], fontsize=8.5)
    ax.set_yticks(np.arange(nr) + 0.5, [str(i) for i in df.index], fontsize=8.5)
    ax.tick_params(length=0)
    if annotate and nr * nc <= 400:
        for i in range(nr):
            for j in range(nc):
                v = data[i, j]
                if np.isfinite(v):
                    ax.text(j + 0.5, i + 0.5, fmt.format(v), ha="center", va="center", fontsize=7.5,
                            color=_ink_on(cmap(norm(v))))
    cb = fig.colorbar(mesh, ax=ax, fraction=0.035, pad=0.015)
    cb.outline.set_visible(False)
    cb.ax.tick_params(length=0, labelsize=8)
    if cbar_label:
        cb.set_label(cbar_label, color=T["ink2"], fontsize=8.5)
    ax.set_title(title)
    ax.set_xlabel(xlabel if xlabel is not None else (df.columns.name or ""))
    ax.set_ylabel(ylabel if ylabel is not None else (df.index.name or ""))
    return fig


# ----------------------------------------------------------------------------- horizons
def plot_horizon(prof: pd.DataFrame, placebo: pd.DataFrame | None = None, summary: dict | None = None,
                 color=None, title=""):
    color = color or T["strategy"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2))
    h = prof.index.to_numpy()
    a1.fill_between(h, prof["lo95"], prof["hi95"], color=color, alpha=0.12, lw=0)
    a1.plot(h, prof["beta_%"], color=color, marker="o", ms=5.5, mec=T["surface"], mew=1.2)
    _zero(a1)
    _horizon_axis(a1, h)
    a1.set_ylabel("rendement cumulé moyen (%)")
    a1.set_title("Effet cumulé pour un signal à +1σ (bande : IC 95 % Newey-West)")
    if summary:
        txt = f"meilleur rapport signal/bruit à {summary['h_meilleur_t']} j (t = {summary['t_max']:.1f})"
        if summary.get("T50"):
            txt += (f"\neffet significatif jusqu'à {summary['h_signif_max']} j"
                    f"\n50 % de l'effet réalisé à {summary['T50']} j · 90 % à {summary['T90']} j")
        else:
            txt += "\naucun horizon significatif à 5 %"
        a1.text(0.02, 0.97, txt, transform=a1.transAxes, fontsize=8.5, color=T["ink2"], va="top",
                bbox=dict(facecolor=T["surface"], edgecolor="none", alpha=0.85, pad=2))
    if placebo is not None and len(placebo):
        a2.fill_between(placebo.index, placebo.iloc[:, 0], placebo.iloc[:, -1], color=T["grid"], lw=0,
                        label="bande du hasard 95 % (placebo)")
    a2.plot(h, prof["IC"], color=color, marker="o", ms=5.5, mec=T["surface"], mew=1.2, label="IC réel")
    _zero(a2)
    _horizon_axis(a2, h)
    a2.set_ylabel("corrélation de rang (IC)")
    a2.set_title("IC vs hasard (signal décalé aléatoirement)")
    a2.legend(loc="best")
    fig.suptitle(title, x=0.01, ha="left", fontsize=11.5, fontweight="bold", color=T["ink"])
    return fig


def plot_horizon_compare(profiles: dict, metric="t_hac", title="Rapport signal/bruit par horizon"):
    """profiles : {nom: (profil, couleur)}"""
    fig, ax = plt.subplots(figsize=(11, 4))
    for name, (prof, colr) in profiles.items():
        ax.plot(prof.index, prof[metric], color=colr, marker="o", ms=5, mec=T["surface"], mew=1.2, label=name)
    if metric == "t_hac":
        for y in (-1.96, 1.96):
            ax.axhline(y, color=T["muted"], lw=0.8)
        ax.annotate("seuil 5 %", (1.0, 1.96), xycoords=("axes fraction", "data"), xytext=(4, 0),
                    textcoords="offset points", va="center", fontsize=8, color=T["ink2"], annotation_clip=False)
        ax.set_ylabel("t-stat Newey-West")
    _zero(ax)
    _horizon_axis(ax, list(next(iter(profiles.values()))[0].index))
    ax.legend(loc="best")
    ax.set_title(title)
    return fig


def plot_event_study(es: dict, color=None, title=""):
    color = color or T["strategy"]
    fig, (a1, a2) = plt.subplots(1, 2, figsize=(12, 4.2), width_ratios=[2, 1])
    k = es["k"]
    for row in es["paths_abn_%"]:
        a1.plot(k, row, color=T["muted"], lw=0.5, alpha=0.25)
    a1.fill_between(k, es["lo"], es["hi"], color=color, alpha=0.15, lw=0)
    a1.plot(k, es["mean_abn_%"], color=color, lw=2)
    _zero(a1)
    a1.set_xlabel("séances après l'exécution")
    a1.set_ylabel("rendement anormal cumulé (%)")
    a1.set_title("Trajectoire moyenne (bande : IC 95 % bootstrap ; gris : chaque événement)")
    a2.plot(k, es["hit_rate"], color=color, lw=1.5)
    a2.axhline(0.5, color=T["axis"], lw=0.9)
    a2.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    a2.set_ylim(0, 1)
    a2.set_xlabel("séances après l'exécution")
    a2.set_title("% d'événements au-dessus de la dérive")
    fig.suptitle(title, x=0.01, ha="left", fontsize=11.5, fontweight="bold", color=T["ink"])
    return fig


def plot_holding(curves: dict, metric="Sharpe", title="Performance selon la durée de détention"):
    """curves : {nom: (df holding_curve, couleur)}"""
    fig, ax = plt.subplots(figsize=(11, 3.8))
    for name, (df, colr) in curves.items():
        ax.plot(df.index, df[metric], color=colr, marker="o", ms=5, mec=T["surface"], mew=1.2, label=name)
    _zero(ax)
    _horizon_axis(ax, list(next(iter(curves.values()))[0].index))
    ax.set_xlabel("durée de détention H (séances)")
    ax.set_ylabel(metric)
    ax.legend(loc="best")
    ax.set_title(title)
    return fig


# ----------------------------------------------------------------------------- backtest
def plot_backtest(res: nl.StrategyResult, start=None, end=None, title="Stratégie vs Buy & Hold", label="Stratégie",
                  color=None):
    color = color or T["strategy"]
    b = res.bt.loc[start:end]
    e = float(b["expo"].mean())
    rets = {"Buy & Hold": (b["bench"], T["bench"]),
            f"B&H expo constante {e:.0%}": (b["rf"] + e * (b["bench"] - b["rf"]), T["bench2"]),
            label: (b["net"], color)}
    fig, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True, height_ratios=[2, 1, 0.8])
    ax = axes[0]
    ends = []
    for name, (r, colr) in rets.items():
        eq = (1 + r).cumprod()
        ax.plot(eq.index, eq, color=colr, lw=1.9 if name == label else 1.3, label=f"{name} (×{eq.iloc[-1]:.2f})")
        ends.append((eq.index[-1], eq.iloc[-1], f"×{eq.iloc[-1]:.2f}", colr))
    _log_multiple_axis(ax)
    _end_labels(ax, ends[::-1])
    ax.legend(loc="upper left")
    ax.set_title(title + " — capital (échelle log)")
    for name, (r, colr) in list(rets.items())[::2]:
        dd = nl.drawdown_series(r)
        if name == label:
            axes[1].fill_between(dd.index, dd, 0, color=colr, alpha=0.12, lw=0)
        axes[1].plot(dd.index, dd, color=colr, lw=1.1, label=name)
    axes[1].yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    axes[1].legend(loc="lower left", ncols=2)
    axes[1].set_title("Drawdown")
    ex = b["expo"]
    axes[2].fill_between(ex.index, 0, ex, color=color, alpha=0.12, lw=0, step="post")
    axes[2].plot(ex.index, ex, color=color, lw=1.1, drawstyle="steps-post")
    axes[2].yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    axes[2].set_title(f"Exposition (moyenne {e:.0%})")
    return fig


def plot_equity_curves(curves: dict, title="Comparaison", log=True):
    """curves : {nom: (série de rendements, couleur)} — chaque courbe part de 1."""
    fig, axes = plt.subplots(2, 1, figsize=(11, 6), sharex=True, height_ratios=[2, 1])
    ends = []
    for name, (r, colr) in curves.items():
        eq = (1 + r.fillna(0)).cumprod()
        axes[0].plot(eq.index, eq, color=colr, lw=1.5, label=f"{name} (×{eq.iloc[-1]:.2f})")
        ends.append((eq.index[-1], eq.iloc[-1], f"×{eq.iloc[-1]:.2f}", colr))
        axes[1].plot(eq.index, nl.drawdown_series(r), color=colr, lw=1.1, label=name)
    if log:
        _log_multiple_axis(axes[0])
    _end_labels(axes[0], ends[::-1])
    axes[0].legend(loc="upper left")
    axes[0].set_title(title + " — capital")
    axes[1].yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    axes[1].set_title("Drawdown")
    return fig


def plot_yearly(yearly: pd.DataFrame, label="Stratégie", color=None):
    color = color or T["strategy"]
    fig, ax = plt.subplots(figsize=(11, 3.6))
    x = np.arange(len(yearly))
    w, gap = 0.3, 0.03
    ax.bar(x - (w + gap) / 2, yearly[label] if label in yearly else yearly.iloc[:, 0], width=w, color=color, label=label)
    ax.bar(x + (w + gap) / 2, yearly["Buy & Hold"], width=w, color=T["bench"], label="Buy & Hold")
    _zero(ax)
    ax.set_xticks(x, [str(i) for i in yearly.index])
    ax.yaxis.set_major_formatter(PercentFormatter(1.0, decimals=0))
    ax.legend(loc="upper left", ncols=2)
    ax.set_title("Rendement par année civile")
    ax.grid(axis="x", visible=False)
    return fig


# ----------------------------------------------------------------------------- optimisation
def plot_is_oos(df: pd.DataFrame, bh_is=None, bh_oos=None, top=20, title="Sur-apprentissage : score in-sample vs out-of-sample"):
    fig, ax = plt.subplots(figsize=(7.5, 6))
    ax.scatter(df["IS"], df["OOS"], s=10, color=T["muted"], alpha=0.35, lw=0, label="toutes les configs")
    best = df.nlargest(top, "IS")
    ax.scatter(best["IS"], best["OOS"], s=40, color=T["strategy"], edgecolor=T["surface"], linewidth=1.5, zorder=5,
               label=f"{top} meilleures in-sample")
    if bh_is is not None:
        ax.axvline(bh_is, color=T["axis"], lw=0.9)
        ax.axhline(bh_oos, color=T["axis"], lw=0.9)
        ax.annotate("Buy & Hold", (bh_is, bh_oos), xytext=(5, 5), textcoords="offset points", fontsize=8.5, color=T["ink2"])
    rho = df[["IS", "OOS"]].corr(method="spearman").iloc[0, 1]
    ax.set_xlabel("score in-sample")
    ax.set_ylabel("score out-of-sample")
    ax.legend(loc="best")
    ax.set_title(f"{title}\ncorrélation de rang IS/OOS = {rho:.2f}")
    return fig


def param_pivot(configs: pd.DataFrame, scores: pd.Series, row: str, col: str, agg="mean") -> pd.DataFrame:
    d = configs.assign(_s=scores.to_numpy())
    return d.pivot_table(index=row, columns=col, values="_s", aggfunc=agg)


def plot_param_pair(configs: pd.DataFrame, scores: pd.Series, row: str, col: str, center: float, objective="score"):
    """Deux cartes côte à côte : score MOYEN sur les autres paramètres (robustesse) et MEILLEUR score (potentiel).
    Même échelle de couleurs, centrée sur le buy & hold."""
    mean = param_pivot(configs, scores, row, col, "mean")
    best = param_pivot(configs, scores, row, col, "max")
    allv = np.r_[mean.to_numpy().ravel(), best.to_numpy().ravel()]
    vmax = float(np.nanmax(np.abs(allv - center))) or 1.0
    nr, nc = mean.shape
    fig, axes = plt.subplots(1, 2, figsize=(max(9.5, 2 * (0.6 * nc + 2.4)), max(2.3, 0.42 * nr + 1.5)))
    plot_heatmap(mean, title="moyenne sur les autres paramètres", center=center, vmax=vmax, ax=axes[0])
    plot_heatmap(best, title="meilleure config de la case", center=center, vmax=vmax, ax=axes[1], cbar_label=objective)
    fig.suptitle(f"{objective} : {row} × {col} (gris = buy & hold, bleu = mieux)", x=0.01, ha="left",
                 fontsize=11.5, fontweight="bold", color=T["ink"])
    return fig


def plot_wfo(oos: pd.Series, bench: pd.Series, chosen: pd.DataFrame, title="Walk-forward : performance 100 % hors-échantillon"):
    curves = {"Buy & Hold": (bench.loc[oos.index], T["bench"]), "Walk-forward": (oos, T["strategy"])}
    fig = plot_equity_curves(curves, title=title)
    for d in pd.to_datetime(chosen["début test"]):
        for ax in fig.axes:
            ax.axvline(d, color=T["grid"], lw=0.9, zorder=0)
    return fig


def plot_coefs(coefs: pd.DataFrame, title="Coefficients du modèle au fil des ré-entraînements"):
    c = coefs.copy()
    c.index = [d.strftime("%Y-%m") for d in c.index]
    step = max(1, len(c) // 14)
    c = c.iloc[::step]
    return plot_heatmap(c.T, title=title, fmt="{:.2f}", annotate=False, figsize=(11, 4.2), xlabel="ré-entraînement",
                        ylabel="", cbar_label="coefficient (variables standardisées)")


# ----------------------------------------------------------------------------- tableau de bord
def style_stats(df: pd.DataFrame):
    pct = ["CAGR", "Volatilité", "Max drawdown", "% jours positifs", "Exposition moy.", "% temps investi", "Alpha annuel",
           "CAGR B&H même expo", "Gain de timing (CAGR)"]
    fmt = {}
    for r in df.index:
        fmt[r] = "{:.1%}" if r in pct else ("{:.0f}" if r in ("Nb transactions",) else "{:.2f}")

    def f(v, r):
        try:
            return fmt[r].format(v) if pd.notna(v) else "—"
        except (ValueError, TypeError):
            return str(v)
    return df.apply(lambda col: pd.Series([f(v, r) for r, v in col.items()], index=col.index))


def make_dashboard(D: nl.Data, base_params: dict, start=None, end=None):
    """Tableau de bord ipywidgets : chaque réglage relance le backtest (≈ 0,1 s) et redessine."""
    import ipywidgets as W
    from IPython.display import display

    p0 = nl.make_params(base_params)
    lay = W.Layout(width="330px")
    sty = {"description_width": "125px"}

    def dd(k, opts, desc):
        return W.Dropdown(options=opts, value=p0[k], description=desc, layout=lay, style=sty)

    def isl(k, a, b, s, desc):
        return W.IntSlider(value=int(p0[k]), min=a, max=b, step=s, description=desc, continuous_update=False, layout=lay, style=sty)

    def fsl(k, a, b, s, desc):
        return W.FloatSlider(value=float(p0[k]), min=a, max=b, step=s, description=desc, continuous_update=False,
                             readout_format=".2f", layout=lay, style=sty)

    w = {
        "news_source": dd("news_source", ["articles", "gdelt", "blend"], "Source news"),
        "news_mode": dd("news_mode", ["level", "momentum", "attention"], "Mesure news"),
        "news_score": dd("news_score", ["prob", "vote", "neg", "pos"], "Score article"),
        "news_halflife": isl("news_halflife", 2, 250, 1, "Demi-vie news (j)"),
        "news_z_window": isl("news_z_window", 60, 1000, 10, "Fenêtre norm. news"),
        "news_direction": dd("news_direction", [("suivre", 1), ("contrarien", -1)], "Sens news"),
        "price_kind": dd("price_kind", ["tsmom", "composite", "ma", "sma_dist", "breakout", "drawdown", "hmm"], "Signal prix"),
        "price_lookback": isl("price_lookback", 10, 500, 5, "Fenêtre prix (j)"),
        "price_fast": isl("price_fast", 5, 100, 1, "EMA rapide (ma)"),
        "price_slow": isl("price_slow", 20, 400, 5, "EMA lente (ma)"),
        "price_direction": dd("price_direction", [("tendance", 1), ("retour moyenne", -1)], "Sens prix"),
        "price_hmm_features": dd("price_hmm_features", ["ret", "ret_vol", "trend_vol"], "HMM : variables"),
        "price_hmm_states": dd("price_hmm_states", [2, 3], "HMM : régimes"),
        "price_hmm_signal": dd("price_hmm_signal", ["regime", "exp_ret"], "HMM : signal"),
        "price_hmm_sticky": fsl("price_hmm_sticky", 0, 500, 25, "HMM : persistance"),
        "combo": dd("combo", ["linear", "agree", "filter"], "Combinaison"),
        "w_news": fsl("w_news", 0, 1, 0.05, "Poids news"),
        "filter_threshold": fsl("filter_threshold", -3, 1, 0.1, "Seuil filtre news"),
        "mapping": dd("mapping", ["threshold", "linear", "sigmoid"], "Score → position"),
        "entry": fsl("entry", -2, 2, 0.05, "Seuil entrée"),
        "exit": fsl("exit", -3, 2, 0.05, "Seuil sortie"),
        "base": fsl("base", 0, 1, 0.05, "Expo de base"),
        "scale": fsl("scale", 0, 3, 0.05, "Pente"),
        "long_only": W.Checkbox(value=bool(p0["long_only"]), description="Long only", layout=lay, style=sty),
        "max_leverage": fsl("max_leverage", 0.5, 2, 0.05, "Levier max"),
        "rebalance": isl("rebalance", 1, 63, 1, "Rebalancement (j)"),
        "min_trade": fsl("min_trade", 0, 0.5, 0.05, "Bande no-trade"),
        "vol_target": fsl("vol_target", 0, 0.4, 0.01, "Vol cible (0=off)"),
        "risk_overlay": dd("risk_overlay", ["none", "hmm", "vol"], "Filtre de risque"),
        "overlay_k": fsl("overlay_k", 0, 1, 0.05, "Force du filtre"),
        "exec_lag": isl("exec_lag", 0, 5, 1, "Délai exécution (j)"),
        "cost_bps": fsl("cost_bps", 0, 30, 0.5, "Coût (bps)"),
    }
    groups = [("News", ["news_source", "news_mode", "news_score", "news_halflife", "news_z_window", "news_direction"]),
              ("Prix", ["price_kind", "price_lookback", "price_fast", "price_slow", "price_direction",
                        "price_hmm_features", "price_hmm_states", "price_hmm_signal", "price_hmm_sticky"]),
              ("Combinaison & position", ["combo", "w_news", "filter_threshold", "mapping", "entry", "exit", "base", "scale"]),
              ("Risque & exécution", ["long_only", "max_leverage", "rebalance", "min_trade", "vol_target",
                                      "risk_overlay", "overlay_k", "exec_lag", "cost_bps"])]
    cols = [W.VBox([W.HTML(f"<b>{g}</b>")] + [w[k] for k in ks]) for g, ks in groups]
    ui = W.VBox([W.HBox(cols[:2]), W.HBox(cols[2:])])

    def render(**kw):
        p = {**p0, **kw}
        res = nl.run_strategy(D, p)
        display(style_stats(res.compare(start, end)))
        fig = plot_backtest(res, start, end)
        display(fig)
        plt.close(fig)
        changed = {k: v for k, v in p.items() if nl.DEFAULT_PARAMS.get(k) != v}
        print("Paramètres (différences vs défauts) — à copier dans PARAMS :\n", changed)

    out = W.interactive_output(render, w)
    display(ui, out)
    return w
