"""Écrit notebooks/08_ameliorations_sans_surapprentissage.ipynb (cellules de texte et de code), sans l'exécuter.

Usage : python notebooks/fabriquer_08.py   puis   jupyter nbconvert --execute --inplace notebooks/08_ameliorations_sans_surapprentissage.ipynb
"""
from pathlib import Path

import nbformat as nbf

CELLULES = []
md = lambda t: CELLULES.append(nbf.v4.new_markdown_cell(t.strip()))
code = lambda t: CELLULES.append(nbf.v4.new_code_cell(t.strip()))

md(r"""
# Notebook 08 · Améliorer le modèle sans surapprendre

Après les résultats de la seconde version (notebook 07), la question est : **qu'est-ce qui peut encore améliorer le
projet, sans tricher avec les données ?** Ce notebook applique tous les leviers réalisables avec les données disponibles,
selon un protocole écrit et figé **avant** le moindre calcul.

| Section | Contenu | Cours |
|---|---|---|
| 1 | Le protocole figé : variantes, réglages, critères | S7, S8 |
| 2 | Les variables économiques ajoutées | S1, S2 |
| 3 | Les probabilités, réentraînées mois après mois sur 2010-2023 | S3, S7, S9 |
| 4 | Pourquoi la règle reste au cash | S8 |
| 5 | Les leviers en euros : couverture, dosage, règles | S8, S9 |
| 6 | Explicabilité : coefficients dans le temps, prévision du mois prochain | S9 |
| 7 | Ce qu'on retient | |

**Les garde-fous.**
- Chaque variante est réentraînée chaque mois, uniquement sur les mois déjà connus depuis 1999.
- Les réglages sont fixés à l'avance : pas d'Optuna, pas de recherche de seuil.
- Le jugement porte sur 2010-2023 (168 mois). Une variante n'est retenue que si elle bat la référence après correction
  de Holm **et** sur les deux sous-périodes 2010-2016 et 2017-2023.
- 2024-2026 a déjà été vu par la V1 et la V2 : il est affiché à titre indicatif, jamais utilisé pour choisir.

Les calculs viennent de `python -m src.ameliorations`, qui écrit dans `runs/v3_ameliorations/`. Ce notebook les relit,
les vérifie et les explique ; seule la section 6 réajuste un modèle, pour décomposer la prévision du mois prochain.
""")

code(r"""
from pathlib import Path
import json
import sys
import warnings

import matplotlib.dates as mdates
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
sys.path.insert(0, str(ROOT))
from src.ameliorations import (C_PROJET, DEJA_VU, ECONOMIQUES, JUGEMENT, PROTOCOLE, REFERENCE_EUROS, SOUS_PERIODES,
                               _simple, charger, empreinte)
from src.decision import MARGE, couts_entrainement, seuils
from sklearn.linear_model import LogisticRegression

FIG, DOSSIER = ROOT / "figures", ROOT / "runs" / "v3_ameliorations"
plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.3})
ENCRE, PIN, OCRE, ARDOISE, ARGILE, GRIS = "#1f1d1a", "#14805c", "#a88a1c", "#356fa8", "#b3592f", "#8a8478"
LIBELLES = {"n225_mom_12m": "momentum 12 mois", "jgb_slope_10y2y": "pente des taux japonais",
            "us_slope_10y3m": "pente des taux américains", "d_cli_jpn": "indicateur avancé OCDE (variation)",
            "vix": "VIX", "n225_vol_ewma": "volatilité récente du Nikkei"}

R = json.loads((DOSSIER / "resultats.json").read_text())
P = pd.read_csv(DOSSIER / "probabilites.csv", parse_dates=["date"]).set_index("date")
E = pd.read_csv(DOSSIER / "rendements.csv", parse_dates=["date"]).set_index("date")
K = pd.read_csv(DOSSIER / "coefficients.csv", parse_dates=["date"]).set_index("date")
table = charger()
VARIANTES = list(PROTOCOLE["probabilites"])
print(f"première prévision {R['premiere_prevision']} ; mois par période : {R['mois_par_periode']}")
""")

md(r"""
## 1. Le protocole figé (S7, S8)

Le fichier `protocole.json` a été écrit par `python -m src.ameliorations --figer` avant tout calcul de résultat. Il
contient la liste des variantes, leurs réglages, les périodes et les critères, avec une empreinte SHA-256. L'évaluation
recalcule cette empreinte à partir du code et refuse de tourner si elle a changé : on ne peut pas modifier une variante
après avoir vu son score sans que cela se voie.
""")

code(r"""
fige = json.loads((DOSSIER / "protocole.json").read_text())
print(f"protocole figé le {fige['fige_le']} (commit {fige['commit_du_code']}) ; résultats calculés le {R['date']}")
print(f"empreinte figée  {fige['sha256'][:24]}…")
print(f"empreinte du code {empreinte(PROTOCOLE)[:24]}… ; identiques : {fige['sha256'] == empreinte(PROTOCOLE)}")
display(pd.Series(fige["protocole"]["probabilites"], name="ce que fait la variante").rename_axis("probabilité de baisse").to_frame())
display(pd.Series({k: v for k, v in fige["protocole"]["leviers_euros"].items() if not k.startswith("règle")},
                  name="ce que fait le levier").rename_axis("levier en euros").to_frame())
for cle in ["critere_probabilites", "critere_euros", "assemblage_final", "ce_que_l_auteur_savait"]:
    print(f"\n{cle.replace('_', ' ')} : {fige['protocole'][cle]}")
""")

md(r"""
## 2. Les variables économiques ajoutées (S1, S2)

La table 1999-2026 contient d'autres séries que les 13 variables du projet. Les leviers qui demandaient des données
absentes (dividendes, valorisation, flux étrangers) ou trop courtes (volatilité implicite du Nikkei depuis 2023, news
depuis 2017 seulement) ont été écartés. Six variables restent, toutes renseignées depuis 1999 et choisies pour une raison
économique connue d'avance : momentum, pentes des taux, cycle, risque mondial, volatilité. Elles sont toutes connues à
la fin du mois où l'on décide (décalages de publication de la table de collecte).
""")

code(r"""
desc = pd.DataFrame({LIBELLES[c]: {"colonne": c, "depuis": table[c].first_valid_index().strftime("%Y-%m"),
                                   "renseignée": f"{table[c].notna().mean():.0%}", "moyenne": table[c].mean(), "écart-type": table[c].std()}
                     for c in ECONOMIQUES}).T
display(desc)
periodes = {"1999-2009": ("1999", "2009"), "2010-2016": ("2010", "2016"), "2017-2023": ("2017", "2023"), "2024-2026": ("2024", "2026")}
lien = pd.DataFrame({nom: {LIBELLES[c]: table.loc[a:b, [c, "target_rn_next"]].dropna().corr(method="spearman").iloc[0, 1]
                           for c in ECONOMIQUES} for nom, (a, b) in periodes.items()})
display(lien.round(2).style.background_gradient(cmap="RdBu_r", vmin=-0.3, vmax=0.3)
        .set_caption("Corrélation de rang avec le rendement du mois suivant, période par période"))
""")

md(r"""
Comme pour les variables du projet (notebook 07, section 6), les liens sont faibles : jamais au-delà de 0,26 en valeur
absolue. Cinq variables sur six changent de signe d'une période à l'autre. Seule la variation de l'indicateur avancé
de l'OCDE garde le même signe sur les quatre périodes (un cycle qui s'améliore précède un meilleur mois), mais son lien
tombe à 0,01 sur 2017-2023. On s'attend donc à peu de gain ; le protocole dira si ce peu est réel.
""")

md(r"""
## 3. Les probabilités, mois après mois (S3, S7, S9)

Chaque mois de 2010 à 2026, chaque variante apprend sur tous les mois antérieurs puis annonce la probabilité que le
Nikkei baisse le mois suivant. On compare sa log-loss à celle de la constante (la fréquence passée des baisses), mois
par mois. La moyenne de ces écarts et son erreur type donnent le test de Diebold-Mariano ; la correction de Holm tient
compte des six variantes testées.
""")

code(r"""
lignes = []
for v in VARIANTES:
    b, t = R["probabilites"][JUGEMENT][v], R["tests_probabilites"].get(v, {})
    lignes.append({"variante": v, "log-loss": b["log_loss"], "écart à la constante": b["ecart_vs_constante"],
                   "erreur type": b["erreur_type"], "p (Diebold-Mariano)": t.get("p_unilaterale", np.nan),
                   "p corrigée (Holm)": t.get("p_holm", np.nan),
                   "mieux 2010-2016": t.get("mieux_sur", {}).get("2010-2016", ""), "mieux 2017-2023": t.get("mieux_sur", {}).get("2017-2023", ""),
                   "AUC": b["auc"], "Brier": b["brier"], "retenue": t.get("retenue", "référence")})
display(pd.DataFrame(lignes).set_index("variante").round(4))
print("retenues :", R["retenus"]["probabilites"] or "aucune")
""")

code(r"""
candidats = [v for v in VARIANTES if v != "constante"]
pers = SOUS_PERIODES + [DEJA_VU]
couleurs = {SOUS_PERIODES[0]: ARDOISE, SOUS_PERIODES[1]: PIN, DEJA_VU: GRIS}
fig, ax = plt.subplots(figsize=(9.5, 4.8))
hauteur = 0.26
for k, per in enumerate(pers):
    m = np.array([R["probabilites"][per][v]["ecart_vs_constante"] for v in candidats])
    e = np.array([R["probabilites"][per][v]["erreur_type"] for v in candidats])
    y = np.arange(len(candidats)) + (k - 1) * hauteur
    ax.barh(y, m, height=hauteur, color=couleurs[per], alpha=0.55 if per == DEJA_VU else 0.9,
            hatch="//" if per == DEJA_VU else None, edgecolor="white", label=per)
    ax.errorbar(m, y, xerr=1.96 * e, fmt="none", ecolor=ENCRE, elinewidth=0.8, capsize=2)
ax.axvline(0, color=ENCRE, lw=1)
ax.set_yticks(range(len(candidats)), candidats, fontsize=8); ax.invert_yaxis()
ax.set_xlabel("écart de log-loss avec la constante (à gauche de 0 : mieux que la constante)")
ax.set_title("Aucune variante ne bat la constante de façon nette\n(toutes les barres d'erreur à 95 % traversent zéro)", fontsize=10)
ax.legend(fontsize=8, loc="lower left")
fig.tight_layout(); fig.savefig(FIG / "08_ecarts_log_loss.png"); plt.show()
""")

code(r"""
connus = P["y_baisse"].notna()
y = P.loc[connus, "y_baisse"]
perte = lambda p: -(y * np.log(P.loc[connus, p]) + (1 - y) * np.log(1 - P.loc[connus, p]))
fig, ax = plt.subplots(figsize=(10, 3.8))
for v, c in [("logistique du projet", ARGILE), ("logistique économique", ARDOISE), ("logistique très pénalisée", OCRE),
             ("logistique du projet, mélangée à la constante", PIN)]:
    ax.plot((perte(v) - perte("constante")).cumsum(), color=c, lw=1.4, label=v)
ax.axhline(0, color=ENCRE, lw=1)
ax.axvspan(pd.Timestamp("2024-01-01"), P.index.max(), color=GRIS, alpha=0.15, lw=0)
ax.text(pd.Timestamp("2024-02-01"), ax.get_ylim()[1] * 0.85, "déjà vu", fontsize=8, color=GRIS)
ax.set_ylabel("log-loss cumulée\nmoins la constante")
ax.set_title("Écart cumulé avec la constante, mois après mois : au-dessus de zéro, la variante a perdu", fontsize=10)
ax.legend(fontsize=7.5, ncol=2, loc="upper left")
fig.tight_layout(); fig.savefig(FIG / "08_log_loss_cumulee.png"); plt.show()
""")

code(r"""
jug = P.loc["2010":"2023"]
fig, ax = plt.subplots(figsize=(5.4, 5))
ax.plot([0.25, 0.65], [0.25, 0.65], color=GRIS, lw=1, ls="--")
for v, c, mk in [("constante", ENCRE, "s"), ("logistique du projet", ARGILE, "o"), ("logistique du projet, mélangée à la constante", PIN, "D"),
                 ("logistique économique", ARDOISE, "^")]:
    g = pd.qcut(jug[v].rank(method="first"), 5, labels=False)
    f = jug.groupby(g).agg(p=(v, "mean"), y=("y_baisse", "mean"))
    ax.plot(f["p"], f["y"], marker=mk, color=c, lw=1.2, ms=5, label=v)
ax.set_xlabel("probabilité de baisse annoncée (moyenne par quintile)"); ax.set_ylabel("fréquence observée des baisses")
ax.set_title("Fiabilité sur 2010-2023", fontsize=10); ax.legend(fontsize=7)
fig.tight_layout(); fig.savefig(FIG / "08_fiabilite.png"); plt.show()
""")

md(r"""
**Lecture.**
- La constante elle-même est trop pessimiste sur 2010-2023 : apprise surtout sur 1999-2009 (47 % de baisses), elle
  annonce environ 45 % de baisses, contre 40 % observées.
- Les variantes ne classent pas mieux les mois que le hasard (AUC entre 0,49 et 0,52). Ce qu'elles gagnent sur la
  constante vient surtout d'un niveau moyen un peu différent, pas d'une capacité à distinguer les mois de baisse.
- Toutes les variantes perdent contre la constante sur 2010-2016 ; la plupart gagnent un peu sur 2017-2023. Le gain
  n'est donc pas stable, et aucune p corrigée n'approche 5 %.
- Les deux formes de retrait vers la constante (pénalité dix fois plus forte, mélange à 50 %) sont les moins mauvaises :
  c'est le signe qu'il y a surtout du bruit à retirer.
""")

md(r"""
## 4. Pourquoi la règle reste au cash (S8)

La règle du projet n'achète que si le gain espéré au-dessus du cash dépasse la marge de 0,5 % par mois. Avec les coûts
appris sur le passé, cela revient à deux seuils sur la probabilité de baisse : acheter en dessous du premier, vendre
au-dessus du second, rester neutre entre les deux.
""")

code(r"""
lignes = {}
for d in P.index:
    c = couts_entrainement(table.iloc[:table.index.get_loc(d)])
    s = seuils(c, MARGE)
    pc = P.loc[d, "constante"]
    lignes[d] = {"acheter si p(baisse) <": 1 - s["theta_a"], "vendre si p(baisse) >": 1 - s["theta_v"],
                 "gain espéré de l'achat avec la constante": (1 - pc) * c["B_u"] + pc * c["B_d"]}
S = pd.DataFrame(lignes).T
display(S.loc["2010":"2023"].describe().loc[["mean", "min", "max"]].round(4))
cash = table.loc["2010":"2023", "eur_overnight"] / 1200
espere = S.loc["2010":"2023", "gain espéré de l'achat avec la constante"].mean()
realise = (table.loc["2010":"2023", "target_reur_hedged_next"] - cash).mean()
print(f"gain espéré moyen de l'achat avec la constante, 2010-2023 : {espere:.2%} par mois (marge {MARGE:.1%}) ; "
      f"gain réalisé de l'achat couvert : {realise:.2%} par mois")
actions = {v: P.loc["2010":"2023", f"action · {v}"].value_counts().reindex(["acheter", "neutre", "vendre"]).fillna(0).astype(int) for v in VARIANTES}
display(pd.DataFrame(actions).T.rename_axis("2010-2023"))

fig, ax = plt.subplots(figsize=(10, 3.8))
ax.fill_between(S.index, S["acheter si p(baisse) <"], S["vendre si p(baisse) >"], color=GRIS, alpha=0.18, lw=0, label="zone neutre (cash)")
ax.plot(P.index, P["constante"], color=ENCRE, lw=1.6, label="constante")
ax.plot(P.index, P["logistique du projet"], color=ARGILE, lw=0.9, alpha=0.8, label="logistique du projet")
ax.plot(P.index, P["logistique du projet, mélangée à la constante"], color=PIN, lw=1.0, label="mélangée à la constante")
ax.set_ylabel("probabilité de baisse")
ax.set_title("La constante reste dans la zone neutre : sans signal fort, la règle ne fait que du cash", fontsize=10)
ax.legend(fontsize=7.5, ncol=4, loc="upper left")
fig.tight_layout(); fig.savefig(FIG / "08_regle_au_cash.png"); plt.show()
""")

md(r"""
**Lecture.** Sur 2010-2023, la règle aurait voulu une probabilité de baisse sous 0,41 pour acheter et au-dessus de 0,54
pour vendre. La constante, autour de 0,45, tombe entre les deux : la règle reste au cash les 168 mois. Le gain espéré de
l'achat, appris sur un passé où le Nikkei avait peu rapporté (1999-2009), était de 0,13 % par mois, sous la marge de
0,5 % ; l'achat couvert a finalement rapporté 0,8 % par mois au-dessus du cash.

Conséquence : **plus un modèle se rapproche de la constante (donc mieux il est calibré), plus sa règle reste au cash.**
Les règles qui investissent beaucoup sont celles des modèles les plus dispersés, pas les plus justes. Changer la marge
maintenant serait un choix fait après avoir vu le résultat : ce n'est pas dans le protocole, et ce n'est pas fait ici.
""")

md(r"""
## 5. Les leviers en euros (S8, S9)

Les leviers de cette section ne demandent pas de prévoir le sens du Nikkei : ils changent la couverture du yen ou la
taille de la position. Le critère est le ratio de Sharpe (rendement au-dessus du cash par unité de volatilité), qui ne
dépend pas de la taille de la position : investir moitié moins à chaque mois donne le même Sharpe. Les intervalles
viennent d'un bootstrap par blocs de 12 mois, qui garde l'ordre des mois à l'intérieur de chaque bloc.
""")

code(r"""
for per in [JUGEMENT] + SOUS_PERIODES + [DEJA_VU]:
    d = pd.DataFrame(R["euros"][per]).T[["sharpe", "cumul", "annualise", "volatilite", "perte_maximale", "pire_mois"]]
    display(d.style.format({"sharpe": "{:+.2f}", "cumul": "{:+.1%}", "annualise": "{:+.1%}", "volatilite": "{:.1%}",
                            "perte_maximale": "{:+.1%}", "pire_mois": "{:+.1%}"}).set_caption(per))
""")

code(r"""
T = pd.DataFrame(R["tests_euros"]).T
T = T.drop(index=[i for i in T.index if i.startswith("règle : constante")])
fig, ax = plt.subplots(figsize=(9.5, 4.6))
y = np.arange(len(T))
couleur = [PIN if not i.startswith("règle") else ARGILE for i in T.index]
ax.hlines(y, [ic[0] for ic in T["ic_90"]], [ic[1] for ic in T["ic_90"]], color=couleur, lw=2.2, alpha=0.6)
ax.scatter(T["ecart"].astype(float), y, color=couleur, zorder=3, s=28)
ax.axvline(0, color=ENCRE, lw=1)
ax.set_yticks(y, T.index, fontsize=8); ax.invert_yaxis()
ax.set_xlabel(f"écart de Sharpe avec « {REFERENCE_EUROS} », 2010-2023 (intervalle à 90 %)")
ax.set_title("Aucun levier ne bat l'achat couvert de façon nette ; les règles font moins bien", fontsize=10)
fig.tight_layout(); fig.savefig(FIG / "08_leviers_sharpe.png"); plt.show()
display(T[["ecart", "p_unilaterale", "p_holm", "mieux_sur", "retenu"]])
""")

code(r"""
fig, axes = plt.subplots(1, 2, figsize=(11, 4), gridspec_kw={"width_ratios": [3, 1.3]})
courbes = [(REFERENCE_EUROS, ENCRE, 1.8), ("achat non couvert", ARDOISE, 1.2), ("couverture à moitié", PIN, 1.2),
           ("couvert seulement si le carry est positif", OCRE, 1.0), ("achat couvert, dosé par la volatilité", ARGILE, 1.2),
           ("règle : logistique économique", GRIS, 1.0)]
for ax, (a, b) in zip(axes, [("2010", "2023"), ("2024", "2026")]):
    for s, c, lw in courbes:
        r = E.loc[a:b, s].dropna()
        ax.plot(r.index, (1 + r).cumprod() * 100, color=c, lw=lw, label=s)
    ax.set_title("2010-2023 (jugement)" if a == "2010" else "2024-2026 (déjà vu)", fontsize=10)
    ax.xaxis.set_major_locator(mdates.YearLocator()); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
axes[0].set_ylabel("valeur de 100 € investis"); axes[0].legend(fontsize=7, loc="upper left")
fig.tight_layout(); fig.savefig(FIG / "08_richesse.png"); plt.show()

couv = pd.DataFrame({nom: {"corrélation Nikkei / yen": table.loc[a:b, "target_rn_next"].corr(table.loc[a:b, "target_fx_next"]),
                           "volatilité couvert": table.loc[a:b, "target_reur_hedged_next"].std() * np.sqrt(12),
                           "volatilité non couvert": table.loc[a:b, "target_reur_unhedged_next"].std() * np.sqrt(12),
                           "portage moyen (% par an)": table.loc[a:b, "carry_1m"].mean() * 1200}
                     for nom, (a, b) in periodes.items()}).T
display(couv.round(3))
""")

md(r"""
**Lecture.**
- **La couverture.** Le yen monte souvent quand le Nikkei baisse (corrélation de −0,6 sur 2010-2016, −0,4 sur 2017-2023).
  Ne pas couvrir amortit donc les pertes : la perte maximale passe de −25,5 % à −19,4 %, et −19,1 % avec une couverture
  à moitié. Mais le Sharpe ne progresse pas de façon nette : couvrir était bien meilleur sur 2017-2023, moins bon sur
  2010-2016. Couvrir seulement quand le portage est positif revient à ne pas couvrir de fin 2012 à mi-2022, quand le
  portage était légèrement négatif : Sharpe 0,54, à peine différent de la référence.
- **Le dosage par la volatilité.** Investir moins quand le Nikkei est agité réduit la perte maximale (−21,6 %), mais le
  Sharpe baisse (0,51 contre 0,56) sur les deux sous-périodes : sur ce marché, les mois agités n'ont pas été les
  mauvais mois.
- **Les règles.** Aucune règle ne bat l'achat couvert : la meilleure (logistique économique, Sharpe 0,50) reste en
  dessous, et celle de la constante ne fait que du cash.

Aucun levier ne passe le critère figé : l'assemblage final reste la référence, c'est-à-dire la probabilité constante
et l'achat couvert.
""")

md(r"""
## 6. Explicabilité : ce que les modèles ont appris, et quand (S9)

Les coefficients de la logistique économique sont standardisés : chacun mesure l'effet d'un écart-type de la variable
sur le log-odds de baisse. Comme le modèle est réentraîné chaque mois, on peut suivre ses coefficients dans le temps.
""")

code(r"""
coefs = K[K["modele"] == "logistique économique"][ECONOMIQUES]
fig, ax = plt.subplots(figsize=(10, 3.8))
for c, couleur in zip(ECONOMIQUES, [ARDOISE, PIN, OCRE, ARGILE, ENCRE, GRIS]):
    ax.plot(coefs.index, coefs[c], color=couleur, lw=1.3, label=LIBELLES[c])
ax.axhline(0, color=ENCRE, lw=0.8)
ax.axvspan(pd.Timestamp("2024-01-01"), coefs.index.max(), color=GRIS, alpha=0.12, lw=0)
ax.set_ylabel("coefficient standardisé\n(> 0 : plus de baisses)")
ax.set_title("Coefficients de la logistique économique, réappris chaque mois", fontsize=10)
ax.legend(fontsize=7, ncol=3, loc="upper left")
fig.tight_layout(); fig.savefig(FIG / "08_coefficients_dans_le_temps.png"); plt.show()
signe = np.sign(coefs.loc["2010":"2023"])
display(pd.DataFrame({"changements de signe 2010-2023": (signe.diff().abs() > 0).sum(),
                      "premier (2010-01)": coefs.iloc[0], "dernier": coefs.iloc[-1]}).rename(index=LIBELLES).round(3))
""")

code(r"""
connu, derniere = table[table["y_baisse"].notna()], table.index[-1]
pipe = _simple(LogisticRegression(C=C_PROJET, max_iter=5000)).fit(connu[ECONOMIQUES], connu["y_baisse"].astype(int))
z = pipe[:-1].transform(table.loc[[derniere], ECONOMIQUES])[0]
contrib = pd.Series(pipe[-1].coef_[0] * z, index=[LIBELLES[c] for c in ECONOMIQUES]).sort_values()
p = pipe.predict_proba(table.loc[[derniere], ECONOMIQUES])[0, 1]
print(f"mois prévu {R['mois_prochain']['mois_prevu']} : P(baisse) = {p:.3f} (logistique économique) ; "
      f"constante {R['mois_prochain']['probabilites_de_baisse']['constante']:.3f}")
fig, ax = plt.subplots(figsize=(7.5, 3.4))
ax.barh(contrib.index, contrib.values, color=[ARGILE if v > 0 else PIN for v in contrib.values])
ax.axvline(0, color=ENCRE, lw=0.8)
ax.set_xlabel("contribution au log-odds de baisse (coefficient × écart standardisé)")
ax.set_title(f"Ce qui fait bouger la prévision de {R['mois_prochain']['mois_prevu']}", fontsize=10)
fig.tight_layout(); fig.savefig(FIG / "08_contributions_mois_prochain.png"); plt.show()
display(pd.DataFrame(R["mois_prochain"]["probabilites_de_baisse"], index=["P(baisse)"]).T.round(3))
print("assemblage :", R["mois_prochain"]["assemblage"])
""")

md(r"""
**Lecture.**
- **Stabilité.** La fenêtre croissante stabilise les coefficients. Leurs changements de signe ont presque tous lieu
  avant 2014, quand ils sont encore proches de zéro (sept pour la volatilité récente). Depuis 2014, seuls le VIX, resté
  autour de zéro, et brièvement la pente japonaise changent encore de signe.
- **Taille.** Les coefficients restent petits : aucun ne dépasse 0,18 en valeur absolue sur 2010-2026. Pour déplacer la
  probabilité de 10 points, il faudrait environ 0,4.
- **Signes appris contraires à l'intuition.** Le momentum et la pente japonaise avaient été choisis parce qu'ils
  annoncent, dans la littérature, de meilleurs rendements. Ici, un momentum élevé et une pente raide annoncent plus de
  baisses, pas moins.
- **Le seul signe attendu.** L'indicateur avancé de l'OCDE a le signe prévu : un cycle qui s'améliore annonce moins de
  baisses. C'est aussi le coefficient le plus fort, mais il ne suffit pas à battre la constante.
- **Novembre 2026.** Le momentum (+21 % sur douze mois) et la pente japonaise poussent la prévision vers la baisse. La
  pente américaine la retient. La probabilité finale, 0,448, reste proche de la constante (0,423). Avec des
  coefficients aussi faibles, cette décomposition explique le modèle, pas le marché.
""")

md(r"""
## 7. Ce qu'on retient

**Ce qui a été appliqué.** Sept façons de prévoir la baisse (constante, logistique du projet, très pénalisée, mélangée
à la constante, variables économiques, mélangée, ridge sur le rendement) et quatre leviers en euros (ne pas couvrir,
couvrir à moitié, couvrir selon le portage, doser selon la volatilité), tous réentraînés chaque mois sur le passé connu,
jugés sur 168 mois avec correction de Holm et contrôle des deux sous-périodes.

**Ce qui en sort.**
- **Aucune variante ne bat la constante** de façon démontrable : le meilleur écart (mélange à la constante, −0,007 de
  log-loss) ne fait que 0,8 erreur type, et toutes les variantes perdent sur 2010-2016. Les AUC autour de 0,5 confirment
  qu'aucun modèle ne distingue les mois de baisse.
- **La règle de décision est le vrai goulot.** Avec une probabilité proche de la constante, elle reste au cash : sa
  marge de 0,5 % par mois dépasse le gain espéré appris sur le passé. Un modèle bien calibré ne peut donc rien en tirer.
- **Les leviers de risque réduisent les pertes sans améliorer le rendement par unité de risque.** Ne pas couvrir le yen,
  ou à moitié, ramène la perte maximale de −25,5 % à environ −19 % grâce au rôle de refuge du yen, mais l'avantage
  s'inverse d'une sous-période à l'autre. Le dosage par la volatilité réduit les pertes et le Sharpe.
- **L'assemblage final reste la référence** : probabilité constante, achat couvert. Sur 2024-2026 (déjà vu), il fait
  +82,3 %, comme l'achat couvert.

**En une phrase.** Appliquer proprement tous les leviers disponibles ne fait pas apparaître de signal : le mois suivant
du Nikkei ne se prévoit pas avec ces données, et la meilleure décision reste d'investir couvert. Ce qui pourrait changer
la conclusion demande d'autres données (valorisation, dividendes, flux étrangers) ou une autre question (le risque plutôt
que le sens, notebook de la volatilité).
""")

nb = nbf.v4.new_notebook(cells=CELLULES, metadata={"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                                   "language_info": {"name": "python"}})
cible = Path(__file__).resolve().parent / "08_ameliorations_sans_surapprentissage.ipynb"
nbf.write(nb, cible)
print(f"écrit : {cible.name} ({len(CELLULES)} cellules)")
