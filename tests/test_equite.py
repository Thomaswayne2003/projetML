import numpy as np
import pandas as pd

from src.equite import poids_kamiran


def test_poids_rendent_groupe_et_cible_independants():
    g = pd.Series(["calme"] * 70 + ["agité"] * 30)
    y = pd.Series([0] * 50 + [1] * 20 + [0] * 10 + [1] * 20)
    w = poids_kamiran(g, y)
    for groupe in ["calme", "agité"]:
        m = (g == groupe).to_numpy()
        taux = np.average(y[m], weights=w[m])
        assert abs(taux - y.mean()) < 1e-12   # même taux de baisse pondéré dans chaque groupe
    assert abs(w.sum() - len(w)) < 1e-9
