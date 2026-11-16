"""API du projet Nikkei : le point d'accès qui sert la prédiction (« served prediction endpoint » de l'énoncé).

Lancer depuis la racine du dépôt : uvicorn app.api:app --port 8000
Documentation interactive : http://127.0.0.1:8000/docs
Le site de présentation (dossier web/, en PHP) interroge cette API.
"""
import json
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query

from src.config import COLONNES, FEATURES, RUNS
from src.data import charger_table
from src.decision import charger_decision
from src.logreg_scratch import constante_lipschitz, cout, descente, gradient  # annexe de Maths
from src.predict import contributions, historique, signal

app = FastAPI(title="Projet Nikkei", version="1.1",
              description="Signal mensuel acheter / neutre / vendre sur le Nikkei 225 pour un investisseur en euros.")
TABLE = charger_table()


@app.get("/sante")
def sante() -> dict:
    """État du service et de la décision figée."""
    dec = charger_decision()
    return {"statut": "ok", "modele": dec["modele_nikkei"], "decision_calculee_le": dec["date"],
            "dernier_mois_disponible": TABLE.index.max().strftime("%Y-%m")}


@app.get("/mois")
def mois_disponibles() -> list[dict]:
    """Mois pour lesquels un signal peut être demandé (validation, test, mois à prédire), du plus récent au plus ancien."""
    d = TABLE[TABLE["bloc"].isin(["validation", "test", "à prédire"])]
    return [{"mois": date.strftime("%Y-%m"), "bloc": bloc} for date, bloc in zip(d.index[::-1], d["bloc"][::-1])]


@app.get("/signal")
def signal_du_mois(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="mois des données, AAAA-MM")) -> dict:
    """Probabilité de hausse du mois suivant, score, action du modèle et recommandation finale."""
    try:
        return signal(mois, TABLE)
    except KeyError as erreur:
        raise HTTPException(status_code=404, detail=str(erreur))


@app.get("/explication")
def explication(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$")) -> list[dict]:
    """Contributions SHAP de chaque variable au log-odds de la baisse, de la plus forte à la plus faible."""
    try:
        return contributions(mois, TABLE).round(4).to_dict(orient="records")
    except KeyError as erreur:
        raise HTTPException(status_code=404, detail=str(erreur))


@app.get("/historique")
def historique_des_decisions(bloc: str = Query("test", pattern="^(validation|test)$")) -> list[dict]:
    """Décisions mois par mois et rendements réalisés, sur la validation ou le test."""
    h = historique(TABLE, blocs=(bloc,)).round(6).reset_index()   # 6 décimales : les rendements sont composés côté site
    h["date"] = h["date"].dt.strftime("%Y-%m")
    return h.to_dict(orient="records")


@app.get("/evaluation")
def evaluation() -> dict:
    """Résultats de l'évaluation unique sur le test 2024-2026."""
    return json.loads((RUNS / "evaluation_test.json").read_text())


# Variables d'information que le prédicteur du site laisse régler (les autres gardent leur valeur du mois de base)
REGLABLES = {
    "news_attention_6m": ("Volume anormal d'articles", "ratio"),
    "news_sent_w": ("Sentiment des news (FinBERT)", "score"),
    "n225_mom_12m": ("Momentum du Nikkei sur 12 mois", "pourcent"),
    "n225_mom_3m": ("Momentum du Nikkei sur 3 mois", "pourcent"),
    "d_jgb10y_bp": ("Variation du taux japonais à 10 ans", "pb"),
    "carry_1m": ("Portage de la couverture", "annuel"),
}


def _ligne_de_base(mois: str | None):
    lignes = TABLE[TABLE["bloc"] == "à prédire"] if mois is None else TABLE[TABLE.index.strftime("%Y-%m") == mois]
    if lignes.empty:
        raise HTTPException(status_code=404, detail=f"aucune donnée pour le mois {mois}")
    return lignes.index[0]


@app.get("/variables")
def variables_reglables(mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$")) -> list[dict]:
    """Variables d'information réglables : libellé, bornes observées sur l'entraînement et valeur du mois de base."""
    date = _ligne_de_base(mois)
    train = TABLE[TABLE["bloc"] == "entraînement"]
    return [{"nom": nom, "libelle": libelle, "affichage": affichage,
             "min": round(float(train[nom].quantile(0.01)), 5), "max": round(float(train[nom].quantile(0.99)), 5),
             "valeur": round(float(TABLE.loc[date, nom]), 5)} for nom, (libelle, affichage) in REGLABLES.items()]


@app.get("/prediction")
def prediction_selon_l_information(
        mois: str | None = Query(None, pattern=r"^\d{4}-\d{2}$", description="mois de base, AAAA-MM"),
        news_attention_6m: float | None = None, news_sent_w: float | None = None, n225_mom_12m: float | None = None,
        n225_mom_3m: float | None = None, d_jgb10y_bp: float | None = None, carry_1m: float | None = None) -> dict:
    """Prédiction du modèle pour une information choisie : on part d'un mois réel et on remplace certaines variables.

    C'est une simulation « et si » : elle montre comment le modèle réagit, pas ce que le marché fera.
    """
    date = _ligne_de_base(mois)
    table = TABLE.copy()
    reglages = {"news_attention_6m": news_attention_6m, "news_sent_w": news_sent_w, "n225_mom_12m": n225_mom_12m,
                "n225_mom_3m": n225_mom_3m, "d_jgb10y_bp": d_jgb10y_bp, "carry_1m": carry_1m}
    modifiees = {nom: valeur for nom, valeur in reglages.items() if valeur is not None}
    for nom, valeur in modifiees.items():
        table.loc[date, nom] = valeur
    cle = date.strftime("%Y-%m")
    resultat = signal(cle, table)
    resultat["variables_modifiees"] = modifiees
    resultat["contributions"] = contributions(cle, table).round(4).to_dict(orient="records")
    resultat.pop("rendement_realise_mois_suivant", None)
    return resultat


@app.get("/decision")
def decision_figee() -> dict:
    """Paramètres de la décision figée avant le test : coûts mesurés sur l'entraînement, marge et seuils."""
    dec = charger_decision()
    return {"couts": dec["couts_entrainement_exces_du_cash"], "marge": dec["marge_m"], "seuils": dec["seuils"],
            "platt": dec["platt"][dec["modele_nikkei"]], "couverture": dec["couverture"]}


@app.get("/serie")
def serie_du_nikkei() -> list[dict]:
    """Clôture mensuelle du Nikkei 225, bloc du split, classe du mois suivant et présence de news (scènes 3D)."""
    d = TABLE[["n225_close", "bloc", "y_baisse", "news_dispo"]]
    return [{"mois": date.strftime("%Y-%m"), "cloture": round(float(c), 1), "bloc": b,
             "baisse": None if pd.isna(y) else int(y), "news": int(n)}
            for date, c, b, y, n in zip(d.index, d["n225_close"], d["bloc"], d["y_baisse"], d["news_dispo"])]


@app.get("/essais")
def essais_optuna() -> list[dict]:
    """Journal des 200 essais Optuna : cible, modèle, numéro de l'essai, log-loss de validation croisée."""
    journal = pd.read_csv(RUNS / "trials_log.csv")
    return [{"cible": c, "modele": m, "essai": int(e), "logloss": round(float(v), 5), "retenu": bool(r)}
            for c, m, e, v, r in zip(journal["cible"], journal["modele"], journal["essai"], journal["cv_logloss"], journal["retenu"])]


@app.get("/volatilite")
def volatilite() -> dict:
    """Second volet (ajouté après le test) : volatilité prévue et réalisée mois par mois, et chiffres de synthèse."""
    bilan = json.loads((RUNS / "exploration_volatilite.json").read_text())
    serie = pd.read_csv(RUNS / "exploration_volatilite_predictions.csv", parse_dates=["date"])
    nul = lambda x: None if pd.isna(x) else round(float(x), 4)
    points = [{"mois": d.strftime("%Y-%m"), "bloc": b, "reelle": nul(r), "prevue": nul(p), "moyenne": nul(m),
               "p_agite": nul(pa), "agite": None if pd.isna(a) else int(a), "rendement": nul(g)}
              for d, b, r, p, m, pa, a, g in zip(serie["date"], serie["bloc"], serie["vol_reelle"], serie["vol_prevue"],
                                                 serie["vol_moyenne_passee"], serie["p_agite"], serie["agite"], serie["rendement_suivant"])]
    return {"avertissement": bilan["avertissement"], "methode": bilan["methode"], "serie": points,
            "prevision": bilan["prevision_de_la_volatilite"], "agitation": bilan["mois_agite_ou_non"],
            "usage": bilan["usage"], "mois_prochain": bilan["mois_prochain"]}


@app.get("/signal_risque")
def signal_risque() -> dict:
    """Signal d'achat fondé sur le risque prévu (après coup, règle figée sur 2000-2015) : synthèse et série hebdomadaire."""
    bilan = json.loads((RUNS / "signal_risque.json").read_text())
    d = pd.read_csv(RUNS / "signal_risque_journalier.csv", index_col=0, parse_dates=True)
    garder, regle, mois = "valeur_acheter et garder", "valeur_signal risque, chaque jour (règle figée)", "valeur_signal risque, seulement en fin de mois"
    semaines = d.resample("W-FRI").last().dropna(subset=[garder])
    nul = lambda x: None if pd.isna(x) else round(float(x), 4)
    serie = [{"date": t.strftime("%Y-%m-%d"), "vol": nul(v), "signal": nul(s), "garder": nul(g), "regle": nul(r), "mois": nul(m)}
             for t, v, s, g, r, m in zip(semaines.index, semaines["volatilite_prevue"], semaines["signal"], semaines[garder], semaines[regle], semaines[mois])]
    episodes = {}
    for nom, (a, b) in {"crise de 2008": ("2008-09-01", "2009-03-31"), "Covid, 2020": ("2020-02-17", "2020-06-30"),
                        "août 2024": ("2024-07-29", "2024-09-30")}.items():
        x = d.loc[a:b]
        episodes[nom] = {"garder": nul(x[garder].iloc[-1] / x[garder].iloc[0] - 1), "regle": nul(x[regle].iloc[-1] / x[regle].iloc[0] - 1)}
    return {"avertissement": bilan["avertissement"], "regle": bilan["regle"], "prevision": bilan["prevision_r2_log_volatilite"],
            "strategies": bilan["strategies"]["couvert"], "comparaisons": bilan["comparaisons"]["couvert"],
            "aujourd_hui": bilan["aujourd_hui"], "episodes": episodes, "serie": serie}


@app.get("/verifications")
def verifications_apres_coup() -> dict:
    """Résumé des trois vérifications faites après le test : vingt modèles, base journalière, historique long."""
    modeles = json.loads((RUNS / "exploration_apres_coup.json").read_text())
    jours = json.loads((RUNS / "exploration_journaliere.json").read_text())
    long = json.loads((RUNS / "exploration_historique_long.json").read_text())
    classement = sorted(({"modele": r["modele"], "fenetre": r["fenetre"], "log_loss": round(r["test_2024_2026"]["log_loss"], 4),
                          "ecart": round(r["test_2024_2026"]["ecart_vs_constante"], 4),
                          "erreur_type": round(r["test_2024_2026"]["erreur_type_de_l_ecart"], 4),
                          "cumul_regle": round(r["test_2024_2026"]["cumul_regle"], 4)} for r in modeles["resultats"]),
                        key=lambda r: r["log_loss"])
    par_jour = {nom: {"observations": e["test_2024_2026"]["observations"],
                      **min(({"modele": m, "ecart": round(v["ecart_vs_constante"], 4), "erreur_type": round(v["erreur_type"], 4),
                              "auc": round(v["auc"], 3)} for m, v in e["test_2024_2026"]["modeles"].items() if m != "constante"),
                            key=lambda v: v["ecart"])} for nom, e in jours["sens_du_marche"].items()}
    departs = {depart: {m: round(v["log_loss"], 4) for m, v in e["test_2024_2026"]["modeles"].items()}
               for depart, e in long["resultats_par_depart"].items()}
    return {"avertissement": modeles["avertissement"], "vingt_modeles": {"configurations": modeles["configurations"],
            "battent_la_constante": modeles["battent_la_constante"], "choix_sur_2016_2023": modeles["choix_sur_2016_2023"]["modele"],
            "classement_sur_le_test": classement}, "base_journaliere": par_jour, "historique_long": departs}


@lru_cache(maxsize=1)
def _surface() -> dict:
    """Surface de coût d'un modèle réduit à deux variables, et trajectoires de descente de gradient.

    Modèle réduit : volume anormal d'articles et momentum 12 mois, standardisés par la pipeline du modèle final ;
    même λ que le modèle final ; l'intercept est fixé à son optimum pour que la surface soit en deux dimensions.
    """
    dec = charger_decision()
    pipe = joblib.load(RUNS / "models" / "nikkei_logit.joblib")
    train = TABLE[TABLE["bloc"] == "entraînement"]
    Z = pipe[:-1].transform(train[COLONNES])
    X = Z[:, [FEATURES.index("news_attention_6m"), FEATURES.index("n225_mom_12m")]]
    y = train["y_baisse"].to_numpy()
    lam = 1 / (2 * len(y) * pipe.named_steps["model"].C)
    w_opt, b_opt, _ = descente(X, y, 1 / constante_lipschitz(X, lam), lam, 20000)
    # b est fixé : la borne et la limite locale se calculent sur w seulement
    L = 0.25 * np.linalg.eigvalsh(X.T @ X / len(y)).max() + 2 * lam
    p_opt = 1 / (1 + np.exp(-(X @ w_opt + b_opt)))
    hessienne = X.T @ (X * (p_opt * (1 - p_opt))[:, None]) / len(y) + 2 * lam * np.eye(2)
    limite = 2 / np.linalg.eigvalsh(hessienne).max()

    def cout_w(w):
        return cout(np.asarray(w, dtype=float), b_opt, X, y, lam)

    axe = np.linspace(-1.6, 1.6, 41)
    grille = [[round(float(cout_w([w1, w2])), 5) for w1 in axe] for w2 in axe]
    depart = np.array([-1.35, 1.25])
    pas = {"trop petit": 0.05, "classique (1/L)": 1 / L, "près de la limite": 0.93 * limite, "au-delà de la limite": 1.12 * limite}
    trajectoires = {}
    for nom, alpha in pas.items():
        w, points = depart.copy(), []
        for _ in range(60):
            points.append([round(float(w[0]), 4), round(float(w[1]), 4), round(float(cout_w(w)), 5)])
            w = w - alpha * gradient(w, b_opt, X, y, lam)[0]
            if np.abs(w).max() > 1.6:      # sortie de la grille : la descente diverge
                break
        trajectoires[nom] = {"alpha": round(float(alpha), 4), "points": points,
                             "converge": bool(np.abs(w - w_opt).max() < 1e-2)}
    return {"axe": [round(float(a), 3) for a in axe], "cout": grille, "lambda": round(float(lam), 4),
            "L": round(float(L), 4), "limite_locale": round(float(limite), 3), "optimum": [round(float(w_opt[0]), 4), round(float(w_opt[1]), 4), round(float(cout_w(w_opt)), 5)],
            "variables": ["volume anormal d'articles", "momentum 12 mois"], "trajectoires": trajectoires,
            "modele": dec["modele_nikkei"]}


@app.get("/surface")
def surface_de_cout() -> dict:
    """Surface J(w1, w2) d'une logistique réduite à deux variables et descentes de gradient pour quatre pas."""
    return _surface()
