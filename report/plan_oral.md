# Plan des oraux

## Applied ML : 7 minutes de présentation + 3 minutes de questions

| Temps | Diapositive | Message à faire passer | Figure |
|---|---|---|---|
| 0:00-0:45 | 1. La décision | Chaque mois : acheter (couvert ou non), neutre ou vendre le Nikkei. Le modèle estime, la règle décide (S1). | — |
| 0:45-1:45 | 2. Données et fuites | 200 mois, news à partir de 2017. Décalages de publication ; audit des fuites **codé**, pas affirmé. | `01_nikkei_split.png` |
| 1:45-2:45 | 3. Modèles | Pipeline unique, Optuna + TimeSeriesSplit, 200 essais journalisés. Tous battent la constante en CV, aucun en validation. | `02_optuna_historique.png` |
| 2:45-3:45 | 4. Calibration et décision | Platt hors fold, seuils par espérance de gain en euros, marge fixée à l'avance. Décision **commitée avant le test**. | `03_fiabilite_brute.png` |
| 3:45-5:00 | 5. Le test, une seule fois | Log-loss 0,708 contre 0,657 : le plancher n'est pas battu. Engagement tenu : « toujours acheter, couvert » (+82,3 %). | `03b_test_regle.png` |
| 5:00-6:15 | 6. Pourquoi | SHAP : portage à 6 écarts-types (extrapolation), momentum contrarien, JGB. Signal des news instable. | `04_shap_beeswarm_test.png`, `04_inversion_signal_news.png` |
| 6:15-7:00 | 7. Ce qu'on en retient | Un résultat négatif rigoureux ; limites (test pas totalement invisible, petit échantillon) ; démo du tableau de bord. | tableau de bord |

**Questions probables et réponses courtes**
- *Pourquoi pas LightGBM, meilleur en CV ?* Règle de baseline de S1 : un modèle complexe doit battre clairement le simple ; en validation, ses probabilités étaient pires.
- *Le test était-il vraiment caché ?* Les choix de modèle et de seuils, oui : commit `75712cf` avant `6efd12c`. Mais le notebook 01 affichait des statistiques du test, donc la couverture et la règle de repli n'ont pas été choisies à l'aveugle. Nous le déclarons.
- *Pourquoi pas de `class_weight` ?* Optuna l'a testé et rejeté : il tire les probabilités vers 50 %, alors que la décision a besoin de probabilités calibrées. Le remède retenu est le seuil (S7).
- *Et l'équité ?* Pas de personnes, donc pas d'attribut sensible. Analyse transposée à des groupes de mois : aucun écart au-delà du bruit, pas de mitigation.
- *Pourquoi l'importance par permutation ne voit pas l'extrapolation ?* Elle mélange des valeurs toutes élevées ; SHAP compare à la moyenne de l'entraînement.

## Maths : 15 minutes

| Temps | Partie | Contenu |
|---|---|---|
| 0:00-2:00 | Le problème | Classification de la baisse, 143 mois, 12 variables standardisées. |
| 2:00-5:00 | Coût | Bernoulli → vraisemblance → log-loss ; hypothèse d'indépendance à discuter. |
| 5:00-7:30 | Gradient | Règle de la chaîne, σ' = σ(1 − σ), forme (p − y)x ; vérification par différences finies. |
| 7:30-9:30 | Prior | L2 = prior gaussien, λ = 1/(2mτ²), τ = 0,17 ; b non pénalisé (saga) ; convexité stricte. |
| 9:30-13:00 | Optimisation | Descente de gradient, borne 2/L = 2,08, limite locale 2,23 ; sensibilité au pas, aux itérations, à λ, au départ. |
| 13:00-15:00 | Conclusion | Retrouve scikit-learn à 5 × 10⁻⁶ ; plus de régularisation rapproche de la constante : signal faible et instable. |

**À savoir refaire au tableau** : la dérivée de σ, le gradient de la log-loss, le passage du prior gaussien à λ‖w‖², la preuve de convexité stricte.
