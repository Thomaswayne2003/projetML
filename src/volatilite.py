"""Second volet, ajouté après coup : prévoir l'agitation du Nikkei plutôt que son sens.

Le sens du mois suivant ne se prévoit pas (runs/evaluation_test.json, résultat figé du projet).
Ce script pose une autre question sur les mêmes mois et le même découpage : quelle sera la volatilité
du mois prochain, et ce mois sera-t-il agité ? Il a été écrit après l'ouverture du test.

Trois parties :
  1. prévision de la volatilité du mois suivant, sept méthodes réentraînées chaque mois ;
  2. classification « mois agité » (volatilité réalisée au-dessus de 20 %), avec la démarche du projet ;
  3. usage : le risque annoncé est-il fiable, et que donne une position dosée selon ce risque ?

Usage : python -m src.volatilite     écrit runs/exploration_volatilite.json et ..._predictions.csv
"""
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier, LGBMRegressor
from scipy.optimize import minimize
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from .banc_essai import DEPART, ece, perte
from .banc_essai_jour import charger as charger_jours
from .config import ROOT, RUNS, SEED, commit_courant
from .data import charger_table

SORTIE = RUNS / "exploration_volatilite.json"
PREDICTIONS = RUNS / "exploration_volatilite_predictions.csv"
SEUIL_AGITE = 0.20        # un mois est « agité » si sa volatilité réalisée dépasse 20 % par an (la moyenne du Nikkei)
VOL_CIBLE = 0.15          # volatilité visée par la position dosée
RETENU = "régression : 1, 3, 6 mois + VIX + rendement"       # méthode utilisée dans la partie « usage »
HAR = ["lv_1m", "lv_3m", "lv_6m"]
TOUTES = HAR + ["lv_ewma", "lv_vix", "n225_ret_1m", "boj_meeting_next_month"]


def construire() -> tuple[pd.DataFrame, pd.Series]:
    """Table mensuelle du projet, enrichie des volatilités réalisées calculées sur les séances."""
    jours = charger_jours()
    r = jours["n225_close"].pct_change().dropna()
    mois = r.index.to_period("M")
    annuel = np.sqrt(252)
    fin = pd.DataFrame({"lv_1m": np.log(r.groupby(mois).std() * annuel),
                        "lv_3m": np.log((r.rolling(63).std() * annuel).groupby(mois).last()),
                        "lv_6m": np.log((r.rolling(126).std() * annuel).groupby(mois).last())})
    complet = r.groupby(mois).count() >= 15                       # un mois entamé n'a pas de volatilité réalisée
    fin["lv_suivant"] = fin["lv_1m"].where(complet).shift(-1)
    t = charger_table()
    t = pd.concat([t, fin.reindex(t.index.to_period("M")).set_index(t.index)], axis=1)
    t["lv_ewma"], t["lv_vix"] = np.log(t["n225_vol_ewma"]), np.log(t["vix"] / 100)
    t["agite"] = (np.exp(t["lv_suivant"]) > SEUIL_AGITE).astype(float).where(t["lv_suivant"].notna())
    return t, r


class Garch:
    """GARCH(1,1) gaussien, variance de long terme fixée à la variance observée, ajusté par maximum de vraisemblance."""

    def __init__(self):
        self.alpha, self.beta = 0.08, 0.90

    @staticmethod
    def _variances(r, alpha, beta):
        longue = r.var()
        s2 = np.empty(len(r) + 1)
        s2[0] = longue
        for i, x in enumerate(r):
            s2[i + 1] = longue * (1 - alpha - beta) + alpha * x * x + beta * s2[i]
        return s2, longue

    def ajuster(self, r: np.ndarray) -> "Garch":
        def moins_vraisemblance(theta):
            s2, _ = self._variances(r, *theta)
            return 0.5 * np.sum(np.log(s2[:-1]) + r * r / s2[:-1])
        res = minimize(moins_vraisemblance, [self.alpha, self.beta], method="L-BFGS-B",
                       bounds=[(0.01, 0.3), (0.5, 0.98)], options={"maxiter": 60})
        if res.x.sum() < 0.999:
            self.alpha, self.beta = res.x
        return self

    def prevoir(self, r: np.ndarray, seances: int = 21) -> float:
        """Volatilité annualisée moyenne attendue sur les `seances` prochaines séances."""
        s2, longue = self._variances(r, self.alpha, self.beta)
        persistance = self.alpha + self.beta
        chemin = longue + persistance ** np.arange(seances) * (s2[-1] - longue)
        return float(np.sqrt(chemin.mean() * 252))


def prevoir_volatilite(t: pd.DataFrame, r: pd.Series) -> pd.DataFrame:
    """Prévisions walk-forward du log de la volatilité du mois suivant."""
    connu = t["lv_suivant"].notna()
    garch, lignes = Garch(), []
    for i in range(DEPART, len(t)):
        passe, ligne = t.iloc[:i][connu.iloc[:i]].dropna(subset=TOUTES), t.iloc[[i]]
        jusqu_ici = r.loc[:t.index[i]].to_numpy()
        if (i - DEPART) % 6 == 0:                                   # GARCH réajusté tous les six mois
            garch.ajuster(jusqu_ici)
        y = passe["lv_suivant"]
        lgbm = LGBMRegressor(n_estimators=150, learning_rate=0.03, num_leaves=4, min_child_samples=15, subsample=0.8,
                             subsample_freq=1, reg_lambda=5.0, random_state=SEED, n_jobs=1, verbose=-1)
        lignes.append({
            "date": t.index[i], "reelle": t["lv_suivant"].iloc[i],
            "moyenne passée": y.mean(),
            "comme le mois passé": ligne["lv_1m"].iloc[0],
            "lissage exponentiel": ligne["lv_ewma"].iloc[0],
            "régression : 1, 3 et 6 mois": LinearRegression().fit(passe[HAR], y).predict(ligne[HAR])[0],
            RETENU: LinearRegression().fit(passe[TOUTES], y).predict(ligne[TOUTES])[0],
            "GARCH(1,1)": np.log(garch.prevoir(jusqu_ici)),
            "LightGBM bridé": lgbm.fit(passe[TOUTES], y).predict(ligne[TOUTES])[0],
            "ecart_type_des_residus": float(np.std(y - LinearRegression().fit(passe[TOUTES], y).predict(passe[TOUTES]), ddof=len(TOUTES) + 1)),
        })
    return pd.DataFrame(lignes).set_index("date")


def prevoir_agitation(t: pd.DataFrame) -> pd.DataFrame:
    """Probabilité walk-forward que le mois suivant soit agité."""
    connu, lignes = t["agite"].notna(), []
    for i in range(DEPART, len(t)):
        passe, ligne = t.iloc[:i][connu.iloc[:i]].dropna(subset=TOUTES), t.iloc[[i]]
        y = passe["agite"].astype(int)
        logit = Pipeline([("scale", StandardScaler()), ("model", LogisticRegression(C=0.3, max_iter=2000))])
        lgbm = LGBMClassifier(n_estimators=150, learning_rate=0.03, num_leaves=4, min_child_samples=15, subsample=0.8,
                              subsample_freq=1, reg_lambda=5.0, random_state=SEED, n_jobs=1, verbose=-1)
        lignes.append({"date": t.index[i], "y": t["agite"].iloc[i], "constante": y.mean(),
                       "logistique": logit.fit(passe[TOUTES], y).predict_proba(ligne[TOUTES])[0, 1],
                       "LightGBM bridé": lgbm.fit(passe[TOUTES], y).predict_proba(ligne[TOUTES])[0, 1]})
    a = pd.DataFrame(lignes).set_index("date")
    probas = ["constante", "logistique", "LightGBM bridé"]
    a[probas] = a[probas].clip(1e-4, 1 - 1e-4)
    return a


def periodes(t: pd.DataFrame, index: pd.Index) -> dict:
    bloc = t["bloc"].reindex(index)
    return {"avant_test_2016_2023": (bloc.isin(["entraînement", "validation"])).to_numpy(), "test_2024_2026": (bloc == "test").to_numpy()}


def bilan_prevision(v: pd.DataFrame, masque) -> dict:
    w, sortie = v[masque], {}
    reference = ((w["reelle"] - w["moyenne passée"]) ** 2).sum()
    for nom in [c for c in v.columns if c not in ("reelle", "ecart_type_des_residus")]:
        rapport = np.exp(2 * (w["reelle"] - w[nom]))               # variance réalisée / variance prévue
        sortie[nom] = {"r2_hors_echantillon": float(1 - ((w["reelle"] - w[nom]) ** 2).sum() / reference),
                       "erreur_moyenne_points_de_vol": float((np.exp(w["reelle"]) - np.exp(w[nom])).abs().mean() * 100),
                       "qlike": float((rapport - np.log(rapport) - 1).mean()),
                       "correlation": float(w["reelle"].corr(w[nom])) if nom != "moyenne passée" else 0.0}
    return {"mois": int(masque.sum()), "methodes": sortie}


def bilan_agitation(a: pd.DataFrame, masque) -> dict:
    w, sortie = a[masque], {}
    y = w["y"].astype(int).to_numpy()
    for nom in ["constante", "logistique", "LightGBM bridé"]:
        p = w[nom].to_numpy()
        ecart = perte(y, p) - perte(y, w["constante"].to_numpy())
        sortie[nom] = {"log_loss": float(perte(y, p).mean()), "ecart_vs_constante": float(ecart.mean()),
                       "erreur_type": float(ecart.std(ddof=1) / np.sqrt(len(ecart))),
                       "auc": float(roc_auc_score(y, p)) if nom != "constante" else 0.5,
                       "pr_auc": float(average_precision_score(y, p)), "brier": float(brier_score_loss(y, p)), "ece": ece(y, p)}
    return {"mois": int(len(y)), "mois_agites": int(y.sum()), "modeles": sortie}


def bilan_usage(t: pd.DataFrame, v: pd.DataFrame, masque) -> dict:
    """Fiabilité du risque annoncé, et position dosée, en euros couverts comme dans le projet."""
    w = v[masque]
    rendement, cash = t.loc[w.index, "target_reur_hedged_next"], t.loc[w.index, "eur_overnight"] / 100 / 12
    sortie = {"mois": int(len(w))}
    for nom, colonne in [("volatilité prévue", RETENU), ("volatilité constante", "moyenne passée")]:
        sigma = np.exp(w[colonne]) / np.sqrt(12)                    # écart-type mensuel annoncé
        sortie[nom] = {"pertes_au_dela_du_seuil_5_%": int((rendement < -1.645 * sigma).sum()), "attendues_5_%": round(0.05 * len(w), 1),
                       "pertes_au_dela_du_seuil_10_%": int((rendement < -1.282 * sigma).sum()), "attendues_10_%": round(0.10 * len(w), 1),
                       "mois_dans_la_bande_a_1_ecart_type_%": float((rendement.abs() <= sigma).mean() * 100), "attendu_bande_%": 68.3}
    part = (VOL_CIBLE / np.exp(w[RETENU])).clip(upper=1.0)

    def bilan(gains: pd.Series) -> dict:
        valeur = (1 + gains).cumprod()
        exces = gains - cash
        return {"cumul": float(valeur.iloc[-1] - 1), "volatilite_annuelle": float(gains.std() * np.sqrt(12)),
                "perte_maximale": float((valeur / valeur.cummax() - 1).min()), "pire_mois": float(gains.min()),
                "rendement_par_unite_de_risque": float(exces.mean() / gains.std() * np.sqrt(12))}

    sortie["position"] = {"part_investie_moyenne_%": float(part.mean() * 100), "part_investie_minimale_%": float(part.min() * 100),
                          "acheter_et_garder": bilan(rendement), "position_dosee": bilan(part * rendement + (1 - part) * cash)}
    return sortie


def main() -> None:
    warnings.filterwarnings("ignore")
    t, r = construire()
    v, a = prevoir_volatilite(t, r), prevoir_agitation(t)
    a_predire = v.index[v["reelle"].isna()]
    evalue_v, evalue_a = v.drop(index=a_predire), a.drop(index=a_predire)
    per = periodes(t, evalue_v.index)

    derniere = v.loc[a_predire[-1]] if len(a_predire) else v.iloc[-1]
    vol_prevue = float(np.exp(derniere[RETENU]))
    prochain = {"donnees_arretees_au": str((a_predire[-1] if len(a_predire) else v.index[-1]).date()),
                "volatilite_prevue_%": vol_prevue * 100, "volatilite_moyenne_passee_%": float(np.exp(derniere["moyenne passée"]) * 100),
                "probabilite_mois_agite_%": float(a.loc[a_predire[-1], "logistique"] * 100) if len(a_predire) else None,
                "perte_mensuelle_depassee_1_fois_sur_20_%": float(-1.645 * vol_prevue / np.sqrt(12) * 100),
                "part_investie_conseillee_%": float(min(1.0, VOL_CIBLE / vol_prevue) * 100)}

    sortie = {"avertissement": "Second volet ajouté après l'ouverture du test 2024-2026. Il ne remplace pas runs/evaluation_test.json : "
                               "la réponse à la question du projet (acheter, neutre ou vendre) reste « acheter et garder ».",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
              "methode": {"cible": "volatilité réalisée du mois suivant (écart-type des rendements journaliers, annualisé)",
                          "mois_agite": f"volatilité réalisée au-dessus de {SEUIL_AGITE:.0%}", "variables": TOUTES,
                          "reentrainement": "chaque mois, sur tout le passé connu", "premiere_prediction": str(v.index[0].date()),
                          "methode_retenue_pour_l_usage": RETENU, "volatilite_cible_de_la_position_dosee": VOL_CIBLE},
              "prevision_de_la_volatilite": {cle: bilan_prevision(evalue_v, m) for cle, m in per.items()},
              "mois_agite_ou_non": {cle: bilan_agitation(evalue_a, m) for cle, m in per.items()},
              "usage": {cle: bilan_usage(t, evalue_v, m) for cle, m in per.items()},
              "mois_prochain": prochain}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))

    export = pd.DataFrame({"bloc": t["bloc"].reindex(v.index), "vol_reelle": np.exp(v["reelle"]), "vol_prevue": np.exp(v[RETENU]),
                           "vol_moyenne_passee": np.exp(v["moyenne passée"]), "vol_mois_passe": np.exp(v["comme le mois passé"]),
                           "p_agite": a["logistique"], "agite": a["y"], "rendement_suivant": t["target_reur_hedged_next"].reindex(v.index)})
    export.round(5).rename_axis("date").to_csv(PREDICTIONS)
    test = sortie["prevision_de_la_volatilite"]["test_2024_2026"]["methodes"]
    for nom, m in test.items():
        print(f"{nom:45s} R² {m['r2_hors_echantillon']:+.3f}  erreur {m['erreur_moyenne_points_de_vol']:.1f} pts  QLIKE {m['qlike']:.3f}")
    print(f"écrit : {SORTIE.relative_to(ROOT)} et {PREDICTIONS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
