"""Tableau de bord du projet Nikkei (démo de l'oral).

Lancer depuis la racine du dépôt : streamlit run app/dashboard.py
"""
import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from src.config import FIG, RUNS  # noqa: E402
from src.data import charger_table  # noqa: E402
from src.decision import charger_decision  # noqa: E402
from src.predict import contributions, historique, signal  # noqa: E402

st.set_page_config(page_title="Projet Nikkei", layout="wide")
COULEURS = {"acheter": "#548235", "neutre": "#9e9e9e", "vendre": "#c00000"}


@st.cache_data
def donnees():
    table = charger_table()
    return table, historique(table), json.loads((RUNS / "evaluation_test.json").read_text())


TABLE, HIST, EVAL = donnees()
DEC = charger_decision()
MOIS = [d.strftime("%Y-%m") for d in TABLE.index[TABLE["bloc"].isin(["validation", "test", "à prédire"])]]

st.title("Nikkei 225 : acheter, rester neutre ou vendre ?")
st.caption("Signal mensuel pour un investisseur en euros · régression logistique calibrée · décision figée avant le test")

onglets = st.tabs(["Signal du mois", "Pourquoi ce signal", "Historique", "Le modèle a-t-il marché ?", "Méthode"])

with onglets[0]:
    mois = st.selectbox("Données de fin de mois", MOIS[::-1], index=0)
    s = signal(mois, TABLE)
    st.error(f"**Recommandation finale : {s['recommandation_finale']}.** "
             "Sur le test 2024-2026, le modèle ne bat pas le modèle constant : sa règle est montrée à titre d'analyse.")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Probabilité de hausse le mois suivant", f"{s['p_hausse']:.0%}")
    c2.metric("Score S = 2p − 1", f"{s['score']:+.2f}")
    c3.metric("Action de la règle du modèle", s["action_du_modele"])
    c4.metric("Couverture si achat", "couvert")

    fig, ax = plt.subplots(figsize=(9, 1.3))
    tv, ta = s["seuils"]["theta_v"], s["seuils"]["theta_a"]
    ax.axvspan(0, tv, color=COULEURS["vendre"], alpha=0.25)
    ax.axvspan(tv, ta, color=COULEURS["neutre"], alpha=0.25)
    ax.axvspan(ta, 1, color=COULEURS["acheter"], alpha=0.25)
    ax.axvline(s["p_hausse"], color="black", lw=3)
    for x, texte in [(tv / 2, "vendre"), ((tv + ta) / 2, "neutre"), ((ta + 1) / 2, "acheter")]:
        ax.text(x, 0.5, texte, ha="center", va="center", fontsize=10)
    ax.set_xlim(0, 1); ax.set_yticks([]); ax.set_xlabel("probabilité calibrée de hausse")
    st.pyplot(fig)
    st.caption(f"Seuils tirés de l'espérance de gain en euros : θ_v = {tv:.3f}, θ_a = {ta:.3f} (marge de 0,5 %/mois).")
    if s["rendement_realise_mois_suivant"] is None:
        st.info("Le mois suivant n'est pas encore connu. Attention : la collecte des news de fin 2026 est incomplète.")
    else:
        st.write(f"Ce qui s'est passé ensuite : Nikkei **{100 * s['rendement_realise_mois_suivant']:+.1f} %** le mois suivant.")

with onglets[1]:
    mois_x = st.selectbox("Mois à expliquer", MOIS[::-1], index=0, key="explication")
    c = contributions(mois_x, TABLE).head(8).iloc[::-1]
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.barh(c["variable"], c["contribution"], color=np.where(c["contribution"] > 0, "#c55a11", "#1f4e79"))
    ax.axvline(0, color="black", lw=0.8)
    ax.set_xlabel("contribution au log-odds de la baisse (> 0 : pousse vers « baisse »)")
    st.pyplot(fig)
    st.caption("SHAP d'un modèle linéaire : poids × écart de la variable standardisée à sa moyenne d'entraînement. "
               "SHAP décrit le modèle, pas l'économie : il n'établit aucune causalité (S9).")
    st.dataframe(contributions(mois_x, TABLE).round(3), use_container_width=True)

with onglets[2]:
    bloc = st.radio("Période", ["test", "validation"], horizontal=True)
    h = HIST[HIST["bloc"] == bloc]
    cumul = (1 + h[["rendement_regle", "rendement_achat_couvert", "rendement_cash"]]).cumprod()
    fig, ax = plt.subplots(figsize=(10, 3.6))
    ax.plot(cumul.index, cumul["rendement_achat_couvert"], color="#c55a11", label="toujours acheter, couvert")
    ax.plot(cumul.index, cumul["rendement_regle"], color="#1f4e79", lw=2, label="règle du modèle")
    ax.plot(cumul.index, cumul["rendement_cash"], color="grey", ls="--", label="cash")
    ax.scatter(cumul.index, cumul["rendement_regle"], c=[COULEURS[a] for a in h["action"]], s=22, zorder=3)
    ax.set_ylabel("valeur de 1 €"); ax.legend(frameon=False)
    st.pyplot(fig)
    croise = pd.crosstab(h["action"], h["hausse_realisee"].map({1: "hausse réalisée", 0: "baisse réalisée"}))
    st.write("Actions et réalité du mois suivant :")
    st.dataframe(croise, use_container_width=True)

with onglets[3]:
    m = pd.DataFrame(EVAL["metriques"]).T[["log-loss", "Brier", "ECE", "PR-AUC"]]
    p = pd.DataFrame(EVAL["performance_euros"]).T
    c1, c2 = st.columns(2)
    c1.write("**Probabilités sur le test 2024-2026** (plus bas = mieux, sauf PR-AUC)")
    c1.dataframe(m.round(3), use_container_width=True)
    c2.write("**Rendement en euros sur le test**")
    c2.dataframe(p.round(3), use_container_width=True)
    st.write(f"Plancher sans compétence battu : **{'oui' if EVAL['plancher_battu'] else 'non'}** · "
             f"recommandation : **{EVAL['recommandation']}**.")
    for f in ["03b_test_probabilites.png", "04_inversion_signal_news.png"]:
        if (FIG / f).exists():
            st.image(str(FIG / f))

with onglets[4]:
    st.markdown(f"""
- **Données** : 200 mois (février 2010 → septembre 2026), news GDELT notées par FinBERT à partir de 2017.
- **Split temporel** : entraînement 2010-2021, validation 2022-2023, test 2024-2026 évalué une seule fois.
- **Modèle** : régression logistique L2 (choisie par la règle de baseline de S1 face au Random Forest et à LightGBM),
  calibrée par Platt sur les prédictions hors fold.
- **Décision** : espérance de gain en euros avec des coûts mesurés sur l'entraînement et une marge fixée à l'avance
  ({100 * DEC['marge_m']:.1f} %/mois) ; couverture : {DEC['couverture']}.
- **Traçabilité** : décision commitée (`0d8df2f`) avant l'évaluation du test (`775a352`).
""")
