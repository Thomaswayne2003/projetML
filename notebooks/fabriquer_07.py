"""Écrit notebooks/07_seconde_version_bloomberg.ipynb (cellules de texte et de code), sans l'exécuter.

Usage : python notebooks/fabriquer_07.py   puis   jupyter nbconvert --execute --inplace notebooks/07_seconde_version_bloomberg.ipynb
"""
from pathlib import Path

import nbformat as nbf

CELLULES = []
md = lambda t: CELLULES.append(nbf.v4.new_markdown_cell(t.strip()))
code = lambda t: CELLULES.append(nbf.v4.new_code_cell(t.strip()))

md(r"""
# Notebook 07 · Seconde version : 1999-2026, Bloomberg en référence, résultats et explicabilité

Ce notebook présente la seconde version du projet : **le même modèle, réentraîné sur une histoire plus longue**
(1999-2021 au lieu de 2010-2021), avec les séries Bloomberg comme référence pour contrôler les données.

| Section | Contenu | Cours |
|---|---|---|
| 1 | La table 1999-2026 et le découpage | S1 |
| 2 | Bloomberg en référence : Tankan, IPC, VIX, calendrier | S1, S2 |
| 3 | Le réglage Optuna, comparé à la première version | S3, S4 |
| 4 | Calibration et choix du modèle sur la validation | S7, S8 |
| 5 | Le test 2024-2026 : métriques, euros, erreur type | S7, S9 |
| 6 | Explicabilité : permutation, SHAP, coefficients, stabilité des signaux | S9 |
| 7 | Ce qu'on retient | |

**Avertissement.** Le test 2024-2026 a déjà été ouvert par la première version (notebook 03b). Cette seconde version
suit exactement le même protocole (réglage sur l'entraînement, choix et calibration sur la validation, une évaluation),
mais ses résultats sur le test sont une **exploration après coup** : ils n'ont pas la valeur d'un test à l'aveugle.
La décision et l'évaluation figées de la première version (`runs/decision_finale.json`, `runs/evaluation_test.json`)
ne sont pas modifiées.

Les modèles et la décision sont produits par `NIKKEI_CONFIG=config_bloomberg.yaml python -m src.v2_bloomberg`, qui écrit
dans `runs/v2_bloomberg/`. Ce notebook les relit, les diagnostique et les explique ; il ne réentraîne rien.
""")

code(r"""
from pathlib import Path
import json
import sys
import warnings

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import shap
import yaml
from sklearn.metrics import average_precision_score, log_loss

warnings.filterwarnings("ignore")
ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
sys.path.insert(0, str(ROOT))
from src.decision import actions, rendements   # mêmes règles que les notebooks 03 et 03b

CFG = yaml.safe_load(open(ROOT / "config_bloomberg.yaml"))
CFG1 = yaml.safe_load(open(ROOT / "config.yaml"))
FIG, RUNS2, RUNS1 = ROOT / "figures", ROOT / "runs" / "v2_bloomberg", ROOT / "runs"
SEED = CFG["seed"]
plt.rcParams.update({"figure.dpi": 110, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.alpha": 0.3})

FEATURES = [c for g in ["news", "price", "macro", "fx"] for c in CFG["features"][g]]
REGIME = CFG["features"]["regime"]
COLONNES = FEATURES + [c for c in REGIME if c not in FEATURES]
MODELES = ["logit", "rf", "lgbm"]
NOMS = {"logit": "logistique", "rf": "Random Forest", "lgbm": "LightGBM", "moyenne": "moyenne des trois"}
LIBELLES = {"news_attention_6m": "volume anormal d'articles", "news_sent_w": "tonalité des news", "news_dispo": "news disponibles",
            "n225_mom_12m": "momentum 12 mois", "n225_mom_3m": "momentum 3 mois", "n225_vol_ewma": "volatilité lissée",
            "d_jgb10y_bp": "variation du taux à 10 ans", "tankan_large_manuf": "Tankan", "carry_1m": "portage à un mois",
            "eurjpy_rvol_1m": "volatilité de l'euro-yen", "n225_ret_1m": "rendement du mois", "vix": "VIX"}

table = pd.read_csv(ROOT / CFG["data"]["model_table"], parse_dates=["date"]).set_index("date")
table1 = pd.read_csv(ROOT / CFG1["data"]["model_table"], parse_dates=["date"]).set_index("date")
DEC2, EV2 = (json.loads((RUNS2 / f).read_text()) for f in ["decision_finale.json", "evaluation_test.json"])
CTRL = json.loads((RUNS2 / "controle_bloomberg.json").read_text())
DEC1, EV1 = (json.loads((RUNS1 / f).read_text()) for f in ["decision_finale.json", "evaluation_test.json"])
PIPES = {m: joblib.load(ROOT / DEC2["fichiers_modeles"][m]) for m in MODELES}
PIPE1 = joblib.load(ROOT / DEC1["fichiers_modeles"]["logit"])

def logit_(p):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))

def p_baisse(m, X):
    # probabilité de baisse calibrée par Platt (paramètres appris sur les prédictions hors fold, notebook 03)
    if m == "moyenne":
        return np.mean([p_baisse(k, X) for k in MODELES], axis=0)
    a, c = DEC2["platt"][m]["a"], DEC2["platt"][m]["c"]
    return 1 / (1 + np.exp(-(a * logit_(PIPES[m].predict_proba(X[COLONNES])[:, 1]) + c)))

train, valid, test = (table[table["bloc"] == b] for b in ["entraînement", "validation", "test"])
a_predire = table[table["bloc"] == "à prédire"]
CHOIX = DEC2["modele_nikkei"]
P_CONST = train["y_baisse"].mean()
print(f"modèle retenu par la règle : {NOMS[CHOIX]} ; entraînement {len(train)} mois, validation {len(valid)}, test {len(test)}")
""")

md(r"""
## 1. La table 1999-2026 et le découpage (S1)

La table mensuelle de la seconde version commence en janvier 1999. Le découpage final ne change pas : validation
2022-2023, test 2024-2026. Seule la période d'entraînement s'allonge, de 143 à 276 mois. La table est reconstruite par
`src.data`, avec le même audit des fuites que la première version.
""")

code(r"""
resume = table.groupby("bloc", sort=False).apply(lambda d: pd.Series({
    "début": d.index.min().strftime("%Y-%m"), "fin": d.index.max().strftime("%Y-%m"), "mois": len(d),
    "part des baisses": d["y_baisse"].mean()}))
display(resume)
par_periode = train.groupby(pd.cut(train.index.year, [1998, 2004, 2009, 2016, 2021],
                                   labels=["1999-2004", "2005-2009", "2010-2016", "2017-2021"]))["y_baisse"].agg(["size", "mean"])
display(par_periode.rename(columns={"size": "mois", "mean": "part des baisses"}).round(3))

fig, ax = plt.subplots(figsize=(10, 3.4))
ax.plot(table.index, table["n225_close"], color="#1f1d1a", lw=1.3)
for bloc, couleur in [("validation", "#e3ddd2"), ("test", "#cfc6b8")]:
    d = table[table["bloc"] == bloc]
    ax.axvspan(d.index.min(), d.index.max(), color=couleur, alpha=0.8, lw=0)
    ax.text(d.index.min(), ax.get_ylim()[1] * 0.92, f" {bloc}", fontsize=8)
ax.set_yscale("log")
ax.set_title("Nikkei 225, clôture mensuelle 1999-2026 (échelle logarithmique)", fontsize=10)
fig.tight_layout()
fig.savefig(FIG / "07_nikkei_1999_2026.png")
plt.show()
""")

md(r"""
## 2. Bloomberg en référence (S1, S2)

Les exports Bloomberg servent à **contrôler** la table, pas à la remplacer aveuglément : chaque série doit d'abord être
remise à sa date de publication, sinon elle introduit une fuite. Le contrôle est fait par `src.v2_bloomberg`
(fichier `runs/v2_bloomberg/controle_bloomberg.json`).
""")

code(r"""
lignes = [
    ("Tankan des grandes industries", f"{CTRL['tankan']['valeurs_identiques']} trimestres identiques sur {CTRL['tankan']['trimestres_compares']}",
     CTRL["tankan"]["regle"], CTRL["tankan"]["erreur_si_date_bloomberg_prise_telle_quelle"]),
    ("IPC sur un an", f"corrélation {CTRL['ipc']['correlations']['decalage_1']:.2f} (décalage d'un mois)", CTRL["ipc"]["lecture"], ""),
    ("VIX", f"ratio Bloomberg / VIX : médiane {CTRL['vix']['ratio_median_bloomberg_sur_vix']:.2f}, de {CTRL['vix']['ratio_min']:.2f} à {CTRL['vix']['ratio_max']:.2f}",
     CTRL["vix"]["decision"], ""),
    ("Calendrier des publications", f"{CTRL['calendrier']['lignes']} lignes, {CTRL['calendrier']['couvre']}", CTRL["calendrier"]["limite"], ""),
]
display(pd.DataFrame(lignes, columns=["série", "contrôle", "décision", "risque évité"]))

bbg = ROOT / CFG["data"]["bloomberg"]
if (bbg / "Monthly_VIX_HP.xlsx").exists():
    def lire(f):
        x = pd.read_excel(bbg / f, header=3); x.columns = ["date", "v"]
        return x.assign(date=pd.to_datetime(x["date"]).dt.to_period("M")).set_index("date")["v"].astype(float)
    tankan, vix = lire("Trimestre_JNTSMFG_INDEX_HP.xlsx"), lire("Monthly_VIX_HP.xlsx")
    mensuel = pd.read_csv(ROOT / CFG["data"]["monthly"], parse_dates=["date"]).set_index("date")
    mensuel.index = mensuel.index.to_period("M")
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.2))
    ax = axes[0]
    ax.step(mensuel.index.to_timestamp(), mensuel["tankan_large_manuf"], where="post", color="#1f1d1a", lw=1.2, label="table (au mois de publication)")
    ax.scatter((tankan.index + 1).to_timestamp(), tankan, s=10, color="#b3592f", zorder=3, label="Bloomberg, décalé d'un mois")
    ax.set_title("Tankan : la table et Bloomberg coïncident une fois décalés", fontsize=10); ax.legend(frameon=False, fontsize=8)
    ax = axes[1]
    ratio = (vix / mensuel["vix"].reindex(vix.index)).dropna()
    ax.plot(ratio.index.to_timestamp(), ratio, color="#356fa8", lw=1.2)
    ax.axhline(1, color="#8a8379", lw=1, ls="--")
    ax.set_title("VIX : export Bloomberg « en euros » divisé par le VIX", fontsize=10)
    fig.tight_layout(); fig.savefig(FIG / "07_bloomberg_controles.png"); plt.show()
else:
    print("exports Bloomberg absents (data/1_brutes/bloomberg n'est pas suivi par Git) : figure non refaite")
""")

md(r"""
## 3. Le réglage Optuna, comparé à la première version (S3, S4)

Même pipeline, mêmes espaces de recherche, 50 essais par modèle, TimeSeriesSplit à 4 plis de 12 mois. Avec 276 mois,
chaque pli s'entraîne sur plus d'histoire ; les plis de validation restent les quatre dernières années (2018-2021).
""")

code(r"""
def journal(dossier):
    j = pd.read_csv(dossier / "trials_log.csv")
    return j[j["cible"] == "nikkei"]
j1, j2 = journal(RUNS1), journal(RUNS2)
meilleurs = pd.DataFrame({"première version (2010-2021)": j1.groupby("modele")["cv_logloss"].min(),
                          "seconde version (1999-2021)": j2.groupby("modele")["cv_logloss"].min()}).rename(index=NOMS)
display(meilleurs.round(4))

fig, ax = plt.subplots(figsize=(9, 3))
for k, (nom, j) in enumerate([("2010-2021", j1), ("1999-2021", j2)]):
    for r, m in enumerate(MODELES):
        v = j[j["modele"] == m]["cv_logloss"].clip(upper=0.9)
        ax.scatter(v, np.full(len(v), r + (k - 0.5) * 0.25), s=12, alpha=0.5, color=["#8a8379", "#b3592f"][k], label=nom if r == 0 else None)
ax.set_yticks(range(3), [NOMS[m] for m in MODELES]); ax.set_xlabel("log-loss en validation croisée (plus bas, c'est mieux)")
ax.legend(frameon=False, fontsize=8); ax.set_title("Les 150 essais de chaque version", fontsize=10)
fig.tight_layout(); fig.savefig(FIG / "07_optuna_v1_v2.png"); plt.show()
""")

md(r"""
## 4. Calibration et choix du modèle sur la validation (S7, S8)

Règle annoncée au notebook 03, appliquée telle quelle : **on garde la logistique, sauf si un modèle plus complexe la bat
à la fois en PR-AUC et en log-loss calibrée sur la validation**. Platt est appris sur les prédictions hors pli.
""")

code(r"""
val = pd.DataFrame({"PR-AUC": DEC2["validation"]["pr_auc"], "log-loss calibrée": DEC2["validation"]["log_loss_calibree"]}).rename(index=NOMS)
val["bat la logistique sur les deux"] = [np.nan if m == "logistique" else bool(r["PR-AUC"] > val.loc["logistique", "PR-AUC"]
                                         and r["log-loss calibrée"] < val.loc["logistique", "log-loss calibrée"]) for m, r in val.iterrows()]
display(val.round(4))
print(f"modèle retenu : {NOMS[CHOIX]} ; constante sur la validation : {DEC2['validation']['log_loss_constante']:.4f} -> "
      + ("plancher battu" if DEC2["validation"]["plancher_battu"] else "plancher NON battu"))
print(f"seuils de la règle : achat {DEC2['seuils']['theta_a']:.3f}, vente {DEC2['seuils']['theta_v']:.3f} (marge {DEC2['marge_m']:.3%})")
""")

md(r"""
## 5. Le test 2024-2026 (S7, S9), après coup

Une évaluation, avec la décision ci-dessus. Les métriques de la première version sont rappelées à côté.
""")

code(r"""
CONST = "constante (fréquence de l'entraînement)"
comp = pd.DataFrame({
    "première version (logistique)": {"log-loss": EV1["metriques"]["logistique"]["log-loss"], "log-loss constante": EV1["metriques"][CONST]["log-loss"],
                                      "PR-AUC": EV1["metriques"]["logistique"]["PR-AUC"], "règle en euros": EV1["performance_euros"]["règle du modèle"]["cumul"]},
    f"seconde version ({EV2['modele']})": {"log-loss": EV2["metriques"][EV2["modele"]]["log-loss"], "log-loss constante": EV2["metriques"][CONST]["log-loss"],
                                           "PR-AUC": EV2["metriques"][EV2["modele"]]["PR-AUC"], "règle en euros": EV2["performance_euros"]["règle du modèle"]["cumul"]},
})
display(comp.round(4))
display(pd.DataFrame(EV2["metriques"]).T.round(4))
e = EV2["ecart_log_loss"]
print(f"écart de log-loss mois par mois (modèle - constante) : {e['moyenne']:+.4f}, erreur type {e['erreur_type']:.4f}, "
      f"soit {e['moyenne'] / e['erreur_type']:.2f} erreur type")
display(pd.DataFrame(EV2["performance_euros"]).T.round(4))
""")

code(r"""
h2 = pd.DataFrame(EV2["historique_test"])
h2["date"] = pd.PeriodIndex(h2["date"], freq="M").to_timestamp("M")
h2 = h2.set_index("date")
# première version, recalculée avec sa décision figée
p1 = 1 / (1 + np.exp(-(DEC1["platt"]["logit"]["a"] * logit_(PIPE1.predict_proba(table1.loc[table1["bloc"] == "test", COLONNES])[:, 1]) + DEC1["platt"]["logit"]["c"])))
t1 = table1[table1["bloc"] == "test"]
act1 = actions(pd.Series(1 - p1, index=t1.index), DEC1["couts_entrainement_exces_du_cash"], DEC1["marge_m"])
r1 = rendements(act1, t1)
fig, ax = plt.subplots(figsize=(10, 3.4))
ax.plot(t1.index, np.cumprod(1 + t1["target_reur_hedged_next"]), color="#14805c", lw=1.6, label="acheter et garder, couvert")
ax.plot(t1.index, np.cumprod(1 + r1), color="#8a8379", lw=1.4, label="règle, première version")
ax.plot(h2.index, np.cumprod(1 + h2["rendement_regle"]), color="#b3592f", lw=1.8, label=f"règle, seconde version ({EV2['modele']})")
ax.axhline(1, color="#8a8379", lw=0.8)
ax.set_title("Test 2024-2026 : 1 € investi selon chaque règle", fontsize=10); ax.legend(frameon=False, fontsize=8)
fig.tight_layout(); fig.savefig(FIG / "07_test_euros.png"); plt.show()

croise = pd.crosstab(h2["action"], h2["hausse_realisee"].map({1: "hausse réalisée", 0: "baisse réalisée"})).reindex(["acheter", "neutre", "vendre"], fill_value=0)
display(croise)
""")

md(r"""
## 6. Explicabilité (S9)

Quatre angles, du plus global au plus local :
1. **l'importance par permutation** : ce que le modèle perd, en log-loss, quand on mélange une variable ;
2. **SHAP** pour le modèle retenu : la contribution de chaque variable à chaque prédiction ;
3. **les coefficients de la logistique**, première et seconde version : ce que l'histoire plus longue change ;
4. **la stabilité des signaux dans le temps** : une variable n'est utile que si son lien avec le rendement tient.

### 6a. Importance par permutation, sur la validation et sur le test
""")

code(r"""
def importance_permutation(m, d, repetitions=50):
    rng = np.random.default_rng(SEED)
    y = d["y_baisse"].astype(int).to_numpy()
    base = log_loss(y, p_baisse(m, d), labels=[0, 1])
    res = {}
    for col in COLONNES:
        pertes = []
        for _ in range(repetitions):
            x = d.copy()
            x[col] = rng.permutation(x[col].to_numpy())
            pertes.append(log_loss(y, p_baisse(m, x), labels=[0, 1]))
        res[LIBELLES[col]] = {"hausse de la log-loss": np.mean(pertes) - base, "écart-type": np.std(pertes)}
    return pd.DataFrame(res).T

IMP = {nom: importance_permutation(CHOIX, d) for nom, d in [("validation 2022-2023", valid), ("test 2024-2026", test)]}
ordre = IMP["validation 2022-2023"]["hausse de la log-loss"].sort_values().index
fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True)
for ax, (nom, imp) in zip(axes, IMP.items()):
    imp = imp.loc[ordre]
    couleurs = ["#b3592f" if v > 0 else "#8a8379" for v in imp["hausse de la log-loss"]]
    ax.barh(imp.index, imp["hausse de la log-loss"], xerr=imp["écart-type"], color=couleurs, error_kw={"lw": 0.8})
    ax.axvline(0, color="#1f1d1a", lw=0.8); ax.set_title(f"{NOMS[CHOIX]}, {nom}", fontsize=10)
    ax.set_xlabel("hausse de la log-loss quand on mélange la variable")
fig.tight_layout(); fig.savefig(FIG / "07_permutation_v2.png"); plt.show()
display(pd.concat(IMP, axis=1).round(4))
""")

md(r"""
### 6b. SHAP pour le modèle retenu

Pour un modèle d'arbres, `TreeExplainer` donne des contributions exactes au **log-odds brut** de la baisse (avant Platt).
On vérifie l'additivité : la valeur de base plus la somme des contributions redonne le score du modèle.
""")

code(r"""
pipe = PIPES[CHOIX]
prep, modele = pipe[:-1], pipe.named_steps["model"]
regime_pipe = pipe.named_steps["prep"].named_transformers_["regime"]
centres = pd.DataFrame(regime_pipe.named_steps["scale"].inverse_transform(regime_pipe.named_steps["kmeans"].cluster_centers_), columns=REGIME)
agite = int(centres["vix"].idxmax())
NOMS_SORTIE = [LIBELLES[c] for c in FEATURES] + (["distance au régime calme", "distance au régime agité"] if agite == 1
                                                  else ["distance au régime agité", "distance au régime calme"])
if CHOIX == "logit":
    explainer = shap.LinearExplainer(modele, prep.transform(train[COLONNES]))
else:
    explainer = shap.TreeExplainer(modele)

def expliquer(d):
    e = explainer(prep.transform(d[COLONNES]))
    if e.values.ndim == 3:
        e = e[:, :, 1]
    e.feature_names = NOMS_SORTIE
    e.data = pipe.named_steps["prep"].transform(d[COLONNES])    # valeurs d'origine pour l'affichage
    return e

E_test = expliquer(test)
score = modele.predict(prep.transform(test[COLONNES]), raw_score=True) if CHOIX == "lgbm" else pipe.decision_function(test[COLONNES])
print(f"additivité : écart max {np.abs(E_test.base_values + E_test.values.sum(axis=1) - score).max():.1e}")

plt.figure()
shap.plots.beeswarm(E_test, max_display=12, show=False)
plt.title(f"SHAP sur le test, {NOMS[CHOIX]} (contribution au log-odds de la baisse)", fontsize=10)
plt.tight_layout(); plt.savefig(FIG / "07_shap_v2_test.png", bbox_inches="tight"); plt.show()

E_der = expliquer(a_predire)
plt.figure()
shap.plots.waterfall(E_der[0], max_display=12, show=False)
plt.title(f"La dernière prédiction ({a_predire.index[0]:%Y-%m}), {NOMS[CHOIX]}", fontsize=10)
plt.tight_layout(); plt.savefig(FIG / "07_shap_v2_derniere.png", bbox_inches="tight"); plt.show()
""")

code(r"""
# contributions mois par mois, pour le site (explorateur des décisions)
tous = pd.concat([test, a_predire])
E_tous = expliquer(tous)
p_tous = p_baisse(CHOIX, tous)
act_tous = actions(pd.Series(1 - p_tous, index=tous.index), DEC2["couts_entrainement_exces_du_cash"], DEC2["marge_m"])
export = {}
for i, d in enumerate(tous.index):
    export[d.strftime("%Y-%m")] = {
        "p_hausse": round(float(1 - p_tous[i]), 4), "action": act_tous.iloc[i], "base": round(float(E_tous.base_values[i]), 4),
        "contributions": sorted([{"variable": n, "valeur": round(float(v), 4), "contribution": round(float(c), 4)}
                                 for n, v, c in zip(NOMS_SORTIE, E_tous.data[i], E_tous.values[i])], key=lambda x: -abs(x["contribution"]))}
(RUNS2 / "shap_test.json").write_text(json.dumps({"modele": NOMS[CHOIX], "unite": "log-odds brut de la baisse", "mois": export}, ensure_ascii=False, indent=1))
print(f"runs/v2_bloomberg/shap_test.json : {len(export)} mois")
""")

md(r"""
### 6c. Les coefficients de la logistique, première et seconde version

Même pour un modèle non retenu, la logistique est lisible : chaque coefficient dit dans quel sens, et de combien, une
variable standardisée déplace le log-odds de la baisse.
""")

code(r"""
def coefficients(p):
    # les deux distances aux régimes k-means sont nommées « calme » ou « agité » d'après le VIX de leur centre
    rp = p.named_steps["prep"].named_transformers_["regime"]
    cen = pd.DataFrame(rp.named_steps["scale"].inverse_transform(rp.named_steps["kmeans"].cluster_centers_), columns=REGIME)
    ag = int(cen["vix"].idxmax())
    noms = [n.split("__")[-1] for n in p[:-1].get_feature_names_out()]
    noms = [f"distance au régime {'agité' if n == f'kmeans{ag}' else 'calme'}" if n.startswith("kmeans") else LIBELLES.get(n, n) for n in noms]
    return pd.Series(p.named_steps["model"].coef_[0], index=noms)
coefs = pd.DataFrame({"2010-2021": coefficients(PIPE1), "1999-2021": coefficients(PIPES["logit"])})
coefs = coefs.loc[coefs.abs().max(axis=1).sort_values().index]
fig, ax = plt.subplots(figsize=(8, 4.2))
y = np.arange(len(coefs))
ax.barh(y - 0.2, coefs["2010-2021"], height=0.38, color="#8a8379", label="première version (2010-2021)")
ax.barh(y + 0.2, coefs["1999-2021"], height=0.38, color="#b3592f", label="seconde version (1999-2021)")
ax.set_yticks(y, coefs.index); ax.axvline(0, color="#1f1d1a", lw=0.8)
ax.set_xlabel("coefficient (log-odds de la baisse, par écart-type)"); ax.legend(frameon=False, fontsize=8)
ax.set_title("La logistique, réentraînée sur une histoire plus longue", fontsize=10)
fig.tight_layout(); fig.savefig(FIG / "07_coefficients_v1_v2.png"); plt.show()
display(coefs.round(3))
""")

md(r"""
### 6d. La stabilité des signaux dans le temps

Corrélation de rang (Spearman) entre chaque variable et le rendement du mois suivant, période par période. Un signal
exploitable garde le même signe d'une période à l'autre ; s'il change de signe, aucun modèle appris sur le passé ne
peut s'en servir sur le futur.
""")

code(r"""
periodes = {"1999-2009": ("1999", "2009"), "2010-2016": ("2010", "2016"), "2017-2021": ("2017", "2021"),
            "2022-2023 (validation)": ("2022", "2023"), "2024-2026 (test)": ("2024", "2026")}
stab = pd.DataFrame({nom: {LIBELLES[c]: table.loc[a:b, [c, "target_rn_next"]].dropna().corr(method="spearman").iloc[0, 1]
                           for c in COLONNES} for nom, (a, b) in periodes.items()})
fig, ax = plt.subplots(figsize=(8.5, 4.4))
im = ax.imshow(stab.to_numpy(), cmap="RdBu_r", vmin=-0.4, vmax=0.4, aspect="auto")
ax.set_xticks(range(stab.shape[1]), stab.columns, rotation=20, ha="right", fontsize=8); ax.set_yticks(range(stab.shape[0]), stab.index, fontsize=8)
for i in range(stab.shape[0]):
    for k in range(stab.shape[1]):
        v = stab.iat[i, k]
        if pd.notna(v):
            ax.text(k, i, f"{v:+.2f}", ha="center", va="center", fontsize=7)
ax.grid(False); fig.colorbar(im, ax=ax, shrink=0.8, label="corrélation de rang avec le rendement suivant")
ax.set_title("Le lien de chaque variable avec le rendement du mois suivant, période par période", fontsize=10)
fig.tight_layout(); fig.savefig(FIG / "07_stabilite_signaux.png"); plt.show()
changements = (np.sign(stab.dropna(axis=0, how="any")).nunique(axis=1) > 1).sum()
print(f"{changements} variables sur {stab.dropna().shape[0]} (renseignées sur toutes les périodes) changent de signe au moins une fois")
""")

md(r"""
## 7. Ce qu'on retient

**Les données (sections 1 et 2).**
- La table 1999-2026 double presque l'entraînement : 276 mois au lieu de 143.
- La part des mois en baisse recule au fil du temps : 47 % en 1999-2004, 37 % en 2017-2021, 36 % sur le test. La
  prévision constante apprise sur l'entraînement (43 %) surestime donc les baisses du test ; c'est elle que le modèle doit
  battre.
- Bloomberg confirme la table. Le Tankan est identique sur 112 trimestres sur 112 une fois décalé au mois de sa
  publication ; pris à sa date Bloomberg, il aurait été utilisé avant d'être publié pour 99 trimestres. L'IPC de la table
  est la série de Bloomberg décalée d'un mois (corrélation 0,998). L'export du VIX, converti en euros, est inutilisable,
  et le calendrier des publications, tronqué à 5 000 lignes, ne couvre que 1999-2006.

**Le modèle (sections 3 à 5).**
- En validation croisée, la logistique progresse un peu (0,639 contre 0,647). Le LightGBM perd son avantage flatteur
  de la première version (0,652 contre 0,584) : sur une histoire plus longue, le meilleur de cinquante essais est moins
  chanceux.
- La règle du notebook 03 retient **LightGBM**, qui bat la logistique en PR-AUC et en log-loss calibrée sur la
  validation. Il y fait jeu égal avec la constante (0,680 contre 0,680).
- Sur le test, sa log-loss vaut **0,681 contre 0,665** pour la constante : l'écart (+0,016) ne fait que 0,32 erreur
  type. Rien ne distingue le modèle de la constante. Sa règle rapporte +21,4 %, contre +3,5 % pour la première version
  et +82,3 % pour l'achat couvert ; elle achète 11 mois (8 suivis d'une hausse) et vend 10 mois (4 suivis d'une baisse).
- La logistique de la seconde version aurait battu la constante sur le test (0,634). La règle l'avait écartée sur la
  validation, où elle était la moins bonne (0,731) : la choisir maintenant, ce serait choisir sur le test.

**L'explicabilité (section 6).**
- Le LightGBM ne coupe jamais sur la tonalité ni sur la disponibilité des news. Il coupe sur le Tankan à l'entraînement,
  mais sur 2022-2026 le Tankan reste du même côté de tous les seuils appris sur 1999-2021 : le mélanger ne change rien
  (permutation nulle), alors que SHAP lui attribue un léger décalage constant par rapport à la moyenne de l'entraînement.
  Les deux mesures ne répondent pas à la même question : ce que le modèle perd sans la variable, et ce qu'elle déplace
  par rapport à la moyenne.
- Sur la validation, le portage à un mois est la variable la plus utile, et le volume anormal d'articles nuit : le
  mélanger améliore la log-loss. Sur le test, plus aucune variable n'aide nettement, toutes les barres d'erreur
  traversent zéro.
- Avec une pénalité L1, la logistique de la seconde version ne garde que cinq variables, dont le volume d'articles et
  le portage.
- Surtout, **aucun signal n'est stable** : les neuf variables renseignées sur toute la période changent de signe au
  moins une fois. Le portage passe de −0,30 (1999-2009) à +0,22 (validation) puis −0,20 (test) ; le volume d'articles
  de −0,38 à +0,29 puis −0,13. Un modèle appris sur le passé ne peut pas exploiter un lien qui s'inverse.

**En une phrase.** Une histoire plus longue rend le modèle moins faux, pas juste : il se rapproche de la constante sans
la battre, parce que les liens entre les variables et le rendement du mois suivant ne tiennent pas d'une période à
l'autre. Ce test ayant déjà été vu, ces résultats restent une exploration.
""")

nb = nbf.v4.new_notebook(cells=CELLULES, metadata={"kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
                                                   "language_info": {"name": "python"}})
cible = Path(__file__).resolve().parent / "07_seconde_version_bloomberg.ipynb"
nbf.write(nb, cible)
print(f"écrit : {cible.name} ({len(CELLULES)} cellules)")
