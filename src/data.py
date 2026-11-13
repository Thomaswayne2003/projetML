"""Étape A : de la table mensuelle à la table de modélisation (notebook 01).

Entrée : data/dataset_monthly.csv, construit par les notebooks de collecte V1 et V2
(téléchargement, nettoyage, calendrier de Tokyo, décalages de publication, agrégation mensuelle).
Sortie : data/processed/dataset_model.csv, avec les cibles, les variables construites et le bloc du split.
"""
import numpy as np
import pandas as pd

from .config import CFG, COLONNES, FEATURES, REGIME, ROOT

GARDER_EN_PLUS = ["y_baisse", "y_non_couvert", "target_up_next", "target_rn_next", "target_fx_next",
                  "target_reur_unhedged_next", "target_reur_hedged_next", "target_short_eur_next",
                  "eur_overnight", "boj_meeting_next_month", "n225_close", "bloc"]


def charger_mensuel() -> pd.DataFrame:
    return pd.read_csv(ROOT / CFG["data"]["monthly"], parse_dates=["date"]).set_index("date")


def ajouter_cibles(df: pd.DataFrame) -> pd.DataFrame:
    """y_baisse = 1 si le Nikkei baisse le mois suivant ; y_non_couvert = 1 si ne pas couvrir était mieux."""
    df = df.copy()
    inconnu = df["target_rn_next"].isna()
    df["y_baisse"] = (df["target_rn_next"] <= 0).astype(float)
    df["y_non_couvert"] = (df["carry_1m"] - df["target_fx_next"] <= 0).astype(float)
    df.loc[inconnu, ["y_baisse", "y_non_couvert"]] = np.nan
    return df


def variables_news(df: pd.DataFrame) -> pd.DataFrame:
    """Volume anormal d'articles, sentiment pondéré et indicateur de présence des news.

    Chaque ligne n'utilise que son propre passé : le calcul peut se faire avant le split.
    """
    n_tot = (df["news_japan_n_1m"] + df["news_boj_n_1m"]).where(lambda n: n > 0)
    log_n = np.log(n_tot)
    out = pd.DataFrame(index=df.index)
    out["news_attention_6m"] = log_n - log_n.shift(1).rolling(6, min_periods=3).mean()
    out["news_sent_w"] = (df["news_japan_n_1m"] * df["news_japan_sent_1m"]
                          + df["news_boj_n_1m"] * df["news_boj_sent_1m"]) / n_tot
    out["news_dispo"] = out["news_attention_6m"].notna().astype(int)
    return out


def ajouter_blocs(df: pd.DataFrame) -> pd.DataFrame:
    s = {k: pd.Timestamp(v) for k, v in CFG["split"].items()}
    df = df.copy()
    df["bloc"] = np.select(
        [df.index < s["start"], df.index <= s["train_end"], df.index <= s["validation_end"], df.index <= s["test_end"]],
        ["hors période", "entraînement", "validation", "test"], default="à prédire")
    return df


def audit_fuites(df: pd.DataFrame) -> None:
    """Contrôles du notebook 01 : lèvent une erreur si une fuite est détectée."""
    ecart_cible = (df["target_rn_next"] - df["n225_ret_1m"].shift(-1)).abs().max()
    assert ecart_cible < 1e-9, "la cible n'est pas le rendement du mois suivant"
    ecart_couv = ((df["target_reur_hedged_next"] - df["target_reur_unhedged_next"])
                  - (df["carry_1m"] - df["target_fx_next"])).abs().max()
    assert ecart_couv < 1e-5, "l'identité de la couverture ne tient pas"
    cibles = {c for c in df.columns if c.startswith("target_")} | {"y_baisse", "y_non_couvert"}
    assert not cibles & set(FEATURES + REGIME), "une cible est parmi les variables"
    mois_tankan = set(df.index[df["tankan_large_manuf"].diff().fillna(0) != 0].month)
    assert mois_tankan <= {1, 4, 7, 10}, "le Tankan change avant sa publication"
    coupe = variables_news(df.loc[:"2020-06-30"])
    assert np.allclose(variables_news(df).loc[:"2020-06-30"].to_numpy(), coupe.to_numpy(), equal_nan=True), \
        "les variables de news regardent le futur"
    ecart_prix = (df["target_rn_next"] - (df["n225_close"].shift(-1) / df["n225_close"] - 1)).abs().max()
    assert ecart_prix < 1e-5, "la cible ne correspond pas aux prix de t et t+1"
    # Contrôle sur les valeurs, pas seulement sur les noms : aucune variable ne doit recopier une cible
    connus = df["target_rn_next"].notna()
    for col in FEATURES + REGIME:
        for cible in ["target_rn_next", "target_fx_next", "y_baisse"]:
            paire = df.loc[connus, [col, cible]].dropna()
            if paire[col].nunique() > 2:
                rho = abs(paire[col].corr(paire[cible], method="spearman"))
                assert rho < 0.9, f"{col} est presque identique à {cible} (corrélation de rang {rho:.2f}) : fuite probable"
    if "bloc" in df:
        assert (df["bloc"] == "à prédire").sum() == 1, "il doit y avoir exactement une ligne à prédire"


def construire_table() -> pd.DataFrame:
    df = ajouter_cibles(charger_mensuel())
    df[["news_attention_6m", "news_sent_w", "news_dispo"]] = variables_news(df)
    df = ajouter_blocs(df)
    audit_fuites(df)
    garder = COLONNES + [c for c in GARDER_EN_PLUS if c not in COLONNES]
    return df.loc[df["bloc"] != "hors période", garder]


def charger_table() -> pd.DataFrame:
    return pd.read_csv(ROOT / CFG["data"]["model_table"], parse_dates=["date"]).set_index("date")


def main() -> None:
    table = construire_table()
    sortie = ROOT / CFG["data"]["model_table"]
    sortie.parent.mkdir(parents=True, exist_ok=True)
    table.to_csv(sortie)
    print(f"{sortie.relative_to(ROOT)} : {table.shape[0]} mois x {table.shape[1]} colonnes ; "
          f"blocs {table['bloc'].value_counts().to_dict()} ; audit des fuites réussi")


if __name__ == "__main__":
    main()
