"""Signal d'achat fondé sur le risque : chaque jour, on prévoit la volatilité du Nikkei sur le mois qui vient
et on en déduit combien investir (100 %, 50 % ou 0 %). On ne cherche plus à deviner la hausse ou la baisse.

En clair
- Le risque d'un marché (sa volatilité) varie par périodes : calme, puis agité, puis calme. Il se prévoit, le sens
  du marché non (voir src/banc_essai*.py).
- Chaque soir, après la clôture de Tokyo, on prévoit la volatilité des 20 prochaines séances.
- Risque prévu bas : acheter plein. Moyen : acheter à moitié. Très élevé : ne pas acheter (l'argent reste en euros).
- Pour ne pas acheter et vendre sans arrêt, un changement de niveau doit être confirmé trois soirs de suite.
- On exécute le lendemain à la clôture : aucun prix inconnu au moment de décider n'est utilisé.

Protocole, en deux temps (pour ne pas régler la règle sur les années qui servent à la juger)
  python -m src.signal_risque --figer     choisit le modèle et les seuils avec les seules données 2000-2015,
                                          écrit runs/signal_risque_regle.json (refuse d'écraser une règle existante)
  python -m src.signal_risque             applique la règle figée à 2003-2026 et écrit runs/signal_risque.json

Honnêteté : les années 2016-2026 n'ont pas servi aux choix, mais l'auteur les connaît, et une version mensuelle de
cette idée avait déjà été regardée sur 2024-2026 (src/volatilite.py). Ce volet s'ajoute au résultat officiel du
projet (runs/evaluation_test.json), il ne le remplace pas. Indices de prix sans dividendes (des deux côtés).

Données (data/1_brutes/depuis_2000) : Nikkei 225, S&P 500, VIX, dollar-yen (Yahoo Finance), euro-yen et Euribor
3 mois (BCE), taux 3 mois japonais (OCDE, à partir d'avril 2002 ; avant, la première valeur connue est reprise).
"""
import argparse
import json
import warnings
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from .config import ROOT, RUNS, commit_courant
from .volatilite import Garch

DOSSIER = ROOT / "data" / "1_brutes" / "depuis_2000"
REGLE = RUNS / "signal_risque_regle.json"
SORTIE = RUNS / "signal_risque.json"
SERIE = RUNS / "signal_risque_journalier.csv"

DEBUT, FIN_REGLAGE = "2000-01-01", "2015-12-31"
PERIODES = {"2003-2015 (réglage)": ("2003-01-01", "2015-12-31"), "2016-2023": ("2016-01-01", "2023-12-31"),
            "2024-2026": ("2024-01-01", "2026-12-31"), "2003-2026 (tout)": ("2003-01-01", "2026-12-31")}
HORIZON = 20            # séances : la volatilité prévue est celle du mois qui vient
DECALAGE = 1            # on décide le soir t, on exécute à la clôture de t+1 : la position gagne le rendement de t+2
PAS = 20                # réentraînement toutes les 20 séances, sur tout le passé disponible
MINIMUM = 756           # trois ans d'historique avant la première prévision
QUANTILES = (0.60, 0.90)   # 60 % des jours « calmes », 30 % « moyens », 10 % « très risqués » sur 2003-2015
CONFIRMATION = 3        # soirs de suite dans la nouvelle zone avant de changer de niveau
FRAIS = 0.0005          # 0,05 % par 100 % acheté ou vendu (ETF Nikkei coté à Tokyo, écart compris)


# ---------------------------------------------------------------- données
def charger() -> pd.DataFrame:
    n = pd.read_csv(DOSSIER / "nikkei225_ohlc.csv", index_col=0, parse_dates=True).loc[DEBUT:].dropna(subset=["Close"])
    n = n[n["Close"].pct_change().abs().fillna(0) < 0.2]
    m = pd.read_csv(DOSSIER / "yahoo_marches.csv", index_col=0, parse_dates=True)
    ecb = pd.read_csv(DOSSIER / "ecb_eurjpy.csv", usecols=["TIME_PERIOD", "OBS_VALUE"], parse_dates=["TIME_PERIOD"]).set_index("TIME_PERIOD")["OBS_VALUE"].sort_index()
    eur = pd.read_csv(DOSSIER / "ecb_euribor3m.csv", usecols=["TIME_PERIOD", "OBS_VALUE"]).assign(d=lambda x: pd.to_datetime(x.TIME_PERIOD) + pd.offsets.MonthEnd(0)).set_index("d")["OBS_VALUE"].sort_index()
    jp = pd.read_csv(DOSSIER / "oecd_taux3m_japon.csv", usecols=["TIME_PERIOD", "OBS_VALUE"]).assign(d=lambda x: pd.to_datetime(x.TIME_PERIOD) + pd.offsets.MonthEnd(0)).set_index("d")["OBS_VALUE"].sort_index()

    t = n.index
    veille = t - pd.Timedelta(days=1)                      # Wall Street et la BCE de la veille : connus avant la clôture de Tokyo
    d = pd.DataFrame(index=t)
    d["close"], d["high"], d["low"] = n["Close"], n["High"], n["Low"]
    d["r"] = np.log(d["close"]).diff()
    for col in ["sp500", "vix", "jpy_par_usd"]:
        s = m[col].dropna()
        d[col + "_veille"] = s.asof(veille).to_numpy()
    d["eurjpy"] = ecb.asof(t).to_numpy()                     # sert seulement à compter les rendements en euros
    # taux mensuels : le taux du mois m est connu à la fin du mois m, utilisé à partir du mois suivant
    d["euribor"] = eur.asof(t - pd.offsets.MonthEnd(1)).to_numpy()
    d["taux_japon"] = jp.asof(t - pd.offsets.MonthEnd(1)).to_numpy()
    d["taux_japon"] = d["taux_japon"].bfill()
    return d


def variables(d: pd.DataFrame) -> pd.DataFrame:
    """Tout ce qui est connu le soir t, à la clôture de Tokyo. Volatilités annualisées, en logarithme."""
    vol = lambda r, n: np.log(np.sqrt(252 * (r ** 2).rolling(n).mean()).clip(lower=0.02))
    x = pd.DataFrame(index=d.index)
    x["vol_1j"] = np.log((d["r"].abs() * np.sqrt(252)).clip(lower=0.02))
    x["vol_5j"], x["vol_22j"], x["vol_66j"] = vol(d["r"], 5), vol(d["r"], 22), vol(d["r"], 66)
    park = np.log(d["high"] / d["low"]) ** 2 / (4 * np.log(2))                # écart haut-bas de la séance (Parkinson)
    x["vol_haut_bas_5j"] = np.log(np.sqrt(252 * park.rolling(5).mean()).clip(lower=0.02))
    x["vix_veille"] = np.log(d["vix_veille"])
    x["vol_sp500_5j"] = vol(np.log(d["sp500_veille"]).diff(), 5)
    x["vol_dollar_yen_22j"] = vol(np.log(d["jpy_par_usd_veille"]).diff(), 22)
    x["rendement_22j"] = np.log(d["close"]).diff(22)                           # les baisses font monter le risque
    x["recul_depuis_le_plus_haut"] = d["close"] / d["close"].rolling(252, min_periods=60).max() - 1
    return x


def cible(d: pd.DataFrame) -> pd.Series:
    """Log de la volatilité réalisée sur la fenêtre où la position est tenue : séances t+2 à t+21."""
    r2 = d["r"] ** 2
    futur = r2[::-1].rolling(HORIZON).mean()[::-1].shift(-(1 + DECALAGE))
    return np.log(np.sqrt(252 * futur).clip(lower=0.02))


MODELES = {"naïf : la volatilité du dernier mois": ["vol_22j"],
           "HAR : volatilité du jour, de la semaine, du mois, du trimestre": ["vol_1j", "vol_5j", "vol_22j", "vol_66j"],
           "HAR + écart haut-bas + marchés (VIX, S&P 500, dollar-yen) + baisses": None,
           "GARCH(1,1) journalier": "garch"}


def marcher(d: pd.DataFrame, x: pd.DataFrame, y: pd.Series, fin: str | None = None) -> pd.DataFrame:
    """Prévisions hors échantillon : à chaque réentraînement, seules les lignes dont la cible est déjà connue servent."""
    idx = x.dropna().index.intersection(d.index[d["r"].notna()])
    if fin:
        idx = idx[idx <= fin]
    pos = np.arange(len(idx))
    pred = {nom: pd.Series(np.nan, index=idx) for nom in MODELES}
    tout_x = x.loc[idx]
    for debut in range(MINIMUM, len(idx), PAS):
        bloc = idx[debut:debut + PAS]
        connu = idx[:max(0, debut - HORIZON - DECALAGE)]                       # cibles entièrement observées le jour du réentraînement
        connu = connu[y.loc[connu].notna().to_numpy()]
        for nom, cols in MODELES.items():
            if cols == "garch":
                r = d["r"].loc[:idx[debut - 1]].dropna().to_numpy()
                g = Garch().ajuster(r[-2520:])                                  # dix ans de rendements
                for jour in bloc:
                    rj = d["r"].loc[:jour].dropna().to_numpy()[-2520:]
                    pred[nom].loc[jour] = np.log(g.prevoir(rj, HORIZON + DECALAGE))
                continue
            cols = cols or list(x.columns)
            mod = LinearRegression().fit(tout_x.loc[connu, cols], y.loc[connu])
            pred[nom].loc[bloc] = mod.predict(tout_x.loc[bloc, cols])
    return pd.DataFrame(pred).dropna()


def r2(pred: pd.Series, y: pd.Series) -> float:
    ok = y.reindex(pred.index).notna()
    p, v = pred[ok], y.reindex(pred.index)[ok]
    return float(1 - ((v - p) ** 2).sum() / ((v - v.mean()) ** 2).sum())


# ---------------------------------------------------------------- règle
def niveaux(vol_prevue: pd.Series, seuils, confirmation: int, fin_de_mois: bool = False) -> pd.Series:
    """100 %, 50 % ou 0 % selon la zone de risque ; on change de niveau après `confirmation` soirs dans la nouvelle zone."""
    zone = pd.Series(np.select([vol_prevue < seuils[0], vol_prevue < seuils[1]], [1.0, 0.5], 0.0), index=vol_prevue.index)
    if fin_de_mois:
        decide = zone.index.to_series().groupby(zone.index.to_period("M")).transform("max") == zone.index.to_series()
        return zone.where(decide).ffill().fillna(1.0)
    sortie, actuel, attente, candidat = [], 1.0, 0, None
    for z in zone.to_numpy():
        if z == actuel:
            attente, candidat = 0, None
        elif z == candidat:
            attente += 1
        else:
            candidat, attente = z, 1
        if candidat is not None and attente >= confirmation:
            actuel, attente, candidat = candidat, 0, None
        sortie.append(actuel)
    return pd.Series(sortie, index=zone.index)


def rendements(d: pd.DataFrame) -> pd.DataFrame:
    """Rendements quotidiens pour un investisseur en euros : du Nikkei couvert, non couvert, et de l'argent laissé en euros."""
    jours = d.index.to_series().diff().dt.days.fillna(1)
    cash = d["euribor"] / 100 * jours / 360
    r_local = d["close"].pct_change()
    couvert = r_local + (d["euribor"] - d["taux_japon"]) / 100 * jours / 360       # le contrat de change rapporte l'écart de taux
    non_couvert = (1 + r_local) * d["eurjpy"].shift(1) / d["eurjpy"] - 1
    return pd.DataFrame({"euros": cash, "couvert": couvert, "non_couvert": non_couvert})


def appliquer(position: pd.Series, r: pd.DataFrame, cote: str, frais: float) -> pd.Series:
    """Position décidée le soir t, exécutée à la clôture de t+1, donc rendement de t+2."""
    w = position.shift(1 + DECALAGE).reindex(r.index).dropna()
    rr = r.loc[w.index]
    cout = w.diff().abs().fillna(0) * frais
    return w * rr[cote] + (1 - w) * rr["euros"] - cout


def bilan(g: pd.Series, cash: pd.Series, w: pd.Series) -> dict:
    v = (1 + g).cumprod()
    ans = len(g) / 252
    exces = g - cash.reindex(g.index)
    mois = (1 + g).groupby(g.index.to_period("M")).prod() - 1
    return {"rendement_annuel_%": float((v.iloc[-1] ** (1 / ans) - 1) * 100), "cumul_%": float((v.iloc[-1] - 1) * 100),
            "volatilite_%": float(g.std() * np.sqrt(252) * 100),
            "rendement_par_unite_de_risque": float(exces.mean() / exces.std() * np.sqrt(252)),
            "perte_maximale_%": float((v / v.cummax() - 1).min() * 100), "pire_mois_%": float(mois.min() * 100),
            "part_investie_moyenne_%": float(w.reindex(g.index).mean() * 100),
            "changements_par_an": float((w.reindex(g.index).diff().abs() > 0).sum() / ans)}


def ecart_ratio(a: pd.Series, b: pd.Series, cash: pd.Series, tirages: int = 1000, bloc: int = 20) -> dict:
    """Écart de rendement par unité de risque (a - b) et son incertitude, par tirage de blocs de 20 séances."""
    ea, eb = (a - cash.reindex(a.index)).to_numpy(), (b - cash.reindex(b.index)).to_numpy()
    s = lambda e: e.mean() / e.std() * np.sqrt(252)
    rng, n = np.random.default_rng(0), len(ea)
    tir = []
    for _ in range(tirages):
        debuts = rng.integers(0, n - bloc, n // bloc + 1)
        i = (debuts[:, None] + np.arange(bloc)).ravel()[:n]
        tir.append(s(ea[i]) - s(eb[i]))
    return {"ecart": float(s(ea) - s(eb)), "erreur_type": float(np.std(tir)),
            "part_des_tirages_ou_le_signal_fait_mieux_%": float(np.mean(np.array(tir) > 0) * 100)}


# ---------------------------------------------------------------- les deux temps
def figer() -> None:
    if REGLE.exists():
        raise SystemExit(f"{REGLE.relative_to(ROOT)} existe déjà : la règle est figée. Supprimez-la seulement si vous assumez de la refaire.")
    d = charger()
    d = d.loc[:FIN_REGLAGE]
    x, y = variables(d), cible(d)
    pred = marcher(d, x, y, FIN_REGLAGE)
    scores = {nom: r2(pred[nom], y) for nom in MODELES}
    choisi = max(scores, key=scores.get)
    vol = np.exp(pred[choisi])
    seuils = [float(vol.quantile(q)) for q in QUANTILES]
    regle = {"figee_le": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(),
             "donnees_utilisees": f"{DEBUT} -> {FIN_REGLAGE} uniquement", "r2_hors_echantillon_2003_2015": scores,
             "modele": choisi, "seuils_volatilite_annuelle": seuils,
             "lecture": f"risque prévu < {seuils[0]:.1%} : acheter plein ; entre les deux : acheter à moitié ; > {seuils[1]:.1%} : ne pas acheter",
             "quantiles": QUANTILES, "confirmation_soirs": CONFIRMATION, "frais_par_100_%_echange": FRAIS,
             "horizon_seances": HORIZON, "execution": "décision le soir t, achat ou vente à la clôture de t+1"}
    REGLE.write_text(json.dumps(regle, indent=2, ensure_ascii=False))
    print(json.dumps(regle, indent=2, ensure_ascii=False))


def evaluer() -> None:
    if not REGLE.exists():
        raise SystemExit("Lancez d'abord : python -m src.signal_risque --figer")
    regle = json.loads(REGLE.read_text())
    d = charger()
    x, y = variables(d), cible(d)
    pred = marcher(d, x, y)
    vol = np.exp(pred[regle["modele"]])
    seuils, conf = regle["seuils_volatilite_annuelle"], regle["confirmation_soirs"]
    r = rendements(d)
    cible_vol = float(np.sqrt(seuils[0] * seuils[1]))                                   # pour la version dosée en continu
    positions = {"acheter et garder": pd.Series(1.0, index=vol.index),
                 "signal risque, chaque jour (règle figée)": niveaux(vol, seuils, conf),
                 "signal risque, chaque jour, sans confirmation": niveaux(vol, seuils, 1),
                 "signal risque, seulement en fin de mois": niveaux(vol, seuils, 1, fin_de_mois=True),
                 "position dosée en continu (risque visé / risque prévu)": (cible_vol / vol).clip(upper=1.0)}

    sortie = {"avertissement": "Volet construit après l'ouverture du test 2024-2026 du projet. Il s'ajoute au résultat officiel "
                               "(runs/evaluation_test.json), il ne le remplace pas. Règle choisie avec les seules données 2000-2015.",
              "date": datetime.now().strftime("%Y-%m-%d %H:%M"), "commit_du_code": commit_courant(), "regle": regle,
              "prevision_r2_log_volatilite": {}, "strategies": {}, "comparaisons": {}, "sensibilite": {}}
    for per, (a, b) in PERIODES.items():
        sortie["prevision_r2_log_volatilite"][per] = {nom: r2(pred[nom].loc[a:b], y) for nom in MODELES}

    for cote in ["couvert", "non_couvert"]:
        gains = {nom: appliquer(w, r, cote, FRAIS if nom != "acheter et garder" else 0.0) for nom, w in positions.items()}
        for per, (a, b) in PERIODES.items():
            for nom, g in gains.items():
                sortie["strategies"].setdefault(cote, {}).setdefault(per, {})[nom] = bilan(g.loc[a:b], r["euros"], positions[nom])
            sortie["comparaisons"].setdefault(cote, {})[per] = ecart_ratio(gains["signal risque, chaque jour (règle figée)"].loc[a:b],
                                                                          gains["acheter et garder"].loc[a:b], r["euros"])
    # Sensibilité (information seulement : ces variantes n'ont pas servi à choisir la règle)
    for q in [(0.5, 0.8), (0.6, 0.9), (0.7, 0.95)]:
        s = [float(vol.loc[:FIN_REGLAGE].quantile(v)) for v in q]
        for c in [1, 3, 5]:
            g = appliquer(niveaux(vol, s, c), r, "couvert", FRAIS).loc["2016":]
            sortie["sensibilite"][f"quantiles {q}, confirmation {c}"] = round(bilan(g, r["euros"], niveaux(vol, s, c))["rendement_par_unite_de_risque"], 3)

    dernier = vol.index[-1]
    w = positions["signal risque, chaque jour (règle figée)"]
    sortie["aujourd_hui"] = {"date": str(dernier.date()), "volatilite_prevue_%": float(vol.iloc[-1] * 100),
                             "zone_du_jour": {1.0: "risque bas", 0.5: "risque moyen", 0.0: "risque très élevé"}[niveaux(vol, seuils, 1).iloc[-1]],
                             "signal": {1.0: "acheter plein", 0.5: "acheter à moitié", 0.0: "ne pas acheter"}[w.iloc[-1]]}
    SORTIE.write_text(json.dumps(sortie, indent=2, ensure_ascii=False))
    pd.DataFrame({"volatilite_prevue": vol, "volatilite_realisee": np.exp(y.reindex(vol.index)),
                  "signal": w, **{f"valeur_{k}": (1 + appliquer(v, r, "couvert", FRAIS if k != "acheter et garder" else 0)).cumprod()
                                  for k, v in positions.items()}}).to_csv(SERIE, float_format="%.5g")

    print("R² hors échantillon du log de la volatilité :")
    for per, s in sortie["prevision_r2_log_volatilite"].items():
        print(f"  {per:20s}", "  ".join(f"{k.split(':')[0][:14]} {v:+.2f}" for k, v in s.items()))
    for cote, pp in sortie["strategies"].items():
        print(f"\n=== investisseur en euros, {cote.replace('_', ' ')}")
        for per, st in pp.items():
            c = sortie["comparaisons"][cote][per]
            print(f"  {per}   (écart de ratio signal - garder : {c['ecart']:+.2f} ± {c['erreur_type']:.2f})")
            for nom, b in st.items():
                print(f"    {nom[:52]:52s} {b['rendement_annuel_%']:+6.1f} %/an  vol {b['volatilite_%']:4.1f}  ratio {b['rendement_par_unite_de_risque']:+.2f}"
                      f"  perte max {b['perte_maximale_%']:6.1f}  pire mois {b['pire_mois_%']:6.1f}  investi {b['part_investie_moyenne_%']:3.0f} %  {b['changements_par_an']:4.1f} chgt/an")
    print("\nsensibilité (ratio 2016-2026, couvert) :", sortie["sensibilite"])
    print("aujourd'hui :", sortie["aujourd_hui"])
    print(f"écrit : {SORTIE.relative_to(ROOT)}, {SERIE.relative_to(ROOT)}")


if __name__ == "__main__":
    warnings.filterwarnings("ignore")
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--figer", action="store_true", help="choisir et figer la règle avec les données 2000-2015")
    figer() if p.parse_args().figer else evaluer()
