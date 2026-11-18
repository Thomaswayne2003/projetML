# Captures Bloomberg du Nikkei 225 (18 novembre 2026)

Huit captures d'écran Bloomberg prises le 18 novembre 2026, avec le NKY à 59 662 (−1 480 sur la séance). Elles ne
sont **pas utilisées par le modèle** et restent hors de la chaîne de reproduction (`src/`). Elles servent à deux
choses :

1. **vérifier à l'œil** des données et des conclusions du projet à partir d'une source indépendante ;
2. **proposer des variables** que le dataset ne contient pas : il n'a aucune variable de valorisation ni de bénéfices.

On peut aussi les consulter sur le site, à la page `/bloomberg`.

## Les captures

| Fichier | Écran | Contenu | Valeur relevée |
|---|---|---|---|
| [01_jncpiyoy_cpi_japon.png](01_jncpiyoy_cpi_japon.png) | JNCPIYOY (ECST) | CPI Japon national, glissement annuel, depuis 1971 | 2,1 % en sept. 2026 ; prochaine publication le 20/11 |
| [02_nky_fondamentaux_gf.png](02_nky_fondamentaux_gf.png) | GF | Revenus, BPA, earnings yield, PER LTM et attendu, rendement du dividende (2004-2028) | PER LTM 21,9 ; PER attendu 17,9 ; earnings yield 4,75 % |
| [03_nky_decomposition_rendement_g1032.png](03_nky_decomposition_rendement_g1032.png) | G1032 | Hausse du cours décomposée en BPA attendu à 12 mois et PER | cours +342 % ; BPA +422 % ; PER +3,6 % |
| [04_nky_revisions_estimations_g1036.png](04_nky_revisions_estimations_g1036.png) | G1036 | Révisions du BPA et du chiffre d'affaires FY1, FY2, FY3 (déc. 2023-nov. 2026) | BPA FY1 2 930 (contre ≈3 090 un mois plus tôt) ; FY2 3 401 ; FY3 3 762 |
| [05_nky_earnings_yield_vs_ust10y_10ans_g1037.png](05_nky_earnings_yield_vs_ust10y_10ans_g1037.png) | G1037 | Earnings yield LTM contre UST 10 ans, sur 10 ans | écart −0,38 ; moyenne 1,81 ; +2σ 3,54 |
| [06_nky_earnings_yield_vs_ust10y_1999_g1037.png](06_nky_earnings_yield_vs_ust10y_1999_g1037.png) | G1037 | Même écart depuis 1999 | écart −0,50 ; moyenne 1,65 ; +2σ 3,65 |
| [07_nky_worm_chart_bpa_2005_g1235.png](07_nky_worm_chart_bpa_2005_g1235.png) | G1235 | Worm chart : BPA attendu et estimations annuelles 2022-2028, depuis 2005 | BPA attendu 3 340 |
| [08_nky_worm_chart_bpa_5ans_g1235.png](08_nky_worm_chart_bpa_5ans_g1235.png) | G1235 | Même worm chart sur 5 ans | BPA 2026 en baisse à 2 912 |

## Vérifications visuelles

### 1. Le changement de régime après 2022 se voit aussi en dehors du modèle

Le rapport (section *Limites*) note que les variables de taux sortent de leur domaine d'entraînement après 2022.
L'écart *earnings yield − UST 10 ans* (captures 05 et 06) confirme cette rupture. Il reste positif de 2010 à 2021,
autour de 2 à 5 points. Il passe sous zéro en 2022, ce qui ne s'était pas vu depuis 2008-2009. Aujourd'hui, il vaut
−0,38 sur 10 ans et −0,50 depuis 1999, pour une moyenne historique de 1,65 à 1,81. En d'autres termes, le Nikkei
rapporte moins, en bénéfices, qu'une obligation américaine à 10 ans. Le modèle a été entraîné jusqu'en 2021 et n'a
jamais vu ce régime.

### 2. La hausse vient des bénéfices, pas des multiples

Depuis 2005, le cours a pris +342 %, le BPA attendu à 12 mois +422 % et le PER seulement +3,6 % (capture 03). La
hausse du Nikkei est donc presque entièrement portée par les bénéfices. Cela nuance la lecture « momentum » de
`n225_mom_12m` : une partie de ce momentum est en fait une croissance des bénéfices, que le modèle ne voit pas
directement.

### 3. La projection de novembre 2026

Pour novembre, le modèle penchait vers la baisse, et nous ne l'avons pas suivi : il n'avait pas battu le modèle
constant sur le test, donc la recommandation reste « acheter, couvert » (`web/index.php`, section *Projection*).
Le Nikkei est passé de 63 290 fin octobre (`dataset_monthly.csv`) à 59 662 le 18 novembre, soit environ −5,7 %.
Le mois n'est pas terminé, ce n'est donc **pas** une validation. Un signal fondamental va pourtant dans le même
sens : le BPA FY1 a été révisé de ≈3 090 à 2 930 entre octobre et novembre (captures 04 et 08). C'est la plus
forte révision en baisse visible sur l'écran depuis fin 2023.

### 4. CPI : un écart de valeur et un décalage de publication à vérifier

Pour septembre 2026, Bloomberg donne un CPI de **2,1 %** en glissement annuel. Ce chiffre a été publié en octobre ;
celui d'octobre paraîtra le 20 novembre. Le dataset donne `cpi_all_yoy` = 1,96 sur la ligne 2026-09-30 et 2,23 sur
la ligne 2026-10-30. Deux points sont à vérifier :

- **la valeur** : aucune des deux lignes ne donne 2,1. L'écart d'environ 0,1 point peut venir du calcul à partir
  des niveaux d'indice e-Stat (base, arrondi), ou d'un décalage d'un mois ;
- **le décalage de publication** : `dictionnaire_variables.csv` indique « aucun (connu avant la clôture) » pour
  `cpi_*_yoy`. Or le CPI du mois *m* est publié vers le 20 du mois *m+1*. Si la ligne *m* contient le CPI de *m*,
  il y a anticipation.

Le CPI ne fait pas partie des 11 variables du modèle (`config.yaml`), donc les résultats ne changent pas. Il faut
en revanche corriger le dictionnaire, ou ajouter un contrôle comme celui du Tankan dans `src/data.py`.

### 5. Taux américain à 10 ans : cohérent

L'UST 10 ans vaut 5,13 % le 18 novembre (capture 05). Dans le dataset, `us10y` vaut 5,26 fin septembre et 4,98 fin
octobre : les deux sources sont cohérentes.

## Variables proposées (piste non testée)

| Variable | Définition | Écran |
|---|---|---|
| `ey_ltm` | Earnings yield sur 12 mois glissants (1 / PER LTM) | GF, G1037 |
| `ey_minus_us10y` | `ey_ltm − us10y` (ou `− jgb10y` pour un investisseur japonais) | G1037 |
| `pe_fwd_12m` | PER sur le BPA attendu à 12 mois (BEst) | GF, G1032 |
| `eps_fy1_rev_3m` | Révision du BPA FY1 sur 3 mois, en % | G1036 |
| `eps_fwd_growth` | Croissance attendue du BPA, FY2 / FY1 − 1 | G1036, G1235 |

Précautions :

- **point-in-time** : utiliser les estimations BEst telles qu'elles étaient connues à chaque date. Une série
  réécrite après coup ferait fuir de l'information ;
- **date** : prendre la valeur à la clôture du dernier jour de bourse du mois, comme les autres variables ;
- **audit** : ajouter les colonnes à `dictionnaire_variables.csv`, avec leur décalage, et un test de fuite dans
  `src/data.py` ;
- **jugement** : comme les autres pistes du rapport, on ne pourra les évaluer que sur des mois postérieurs à
  septembre 2026, puisque le test a déjà été utilisé ;
- **licence** : ne pas republier les séries Bloomberg brutes, seulement les variables dérivées. L'écran JNCPIYOY
  porte la mention « use as a financial benchmark may be restricted ».
