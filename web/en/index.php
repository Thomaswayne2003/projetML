<?php
/**
 * English content of the full project write-up. It is not routed on its own: /en/recit includes it and restages it,
 * exactly as web/recit.php does with web/index.php. Keep the section structure (section id, .surtitre, h2, .chapo)
 * identical, because en/recit.php relies on it.
 * Frozen figures come from runs/evaluation_test.json; the monthly signal comes from the Python API.
 */
declare(strict_types=1);
require __DIR__ . '/inc/config.php';

$theme = $theme ?? 'industriel';       // 'encre' for the /en/recit version
$signal = api_get('signal');                 // null if the Python API is stopped
$mois = api_get('mois') ?? [];
$eval = lire_runs('evaluation_test.json');
$metriques = $eval['metriques'] ?? [];
$perf = $eval['performance_euros'] ?? [];
$modele = $metriques['logistique'] ?? ['log-loss' => 0.0, 'Brier' => 0.0, 'ECE' => 0.0, 'PR-AUC' => 0.0];
$constante = $metriques["constante (fréquence de l'entraînement)"] ?? $modele;
$regle = $perf['règle du modèle']['cumul'] ?? 0.0;
$achat_couvert = $perf['toujours acheter, couvert']['cumul'] ?? 0.0;
// The frozen file rounds cumulative returns to 4 decimals (0.8235 would show +82.4%): recompute them month by month when the API responds.
if ($mois_test = api_get('historique', ['bloc' => 'test'])) {
    $achat_couvert = array_product(array_map(fn ($m) => 1 + $m['rendement_achat_couvert'], $mois_test)) - 1;
    $regle = array_product(array_map(fn ($m) => 1 + $m['rendement_regle'], $mois_test)) - 1;
}

$titre = 'Nikkei Project · buy, stay neutral or sell?';
$page = 'accueil';
$fr = $fr ?? '/dossier';
require __DIR__ . '/inc/entete.php';
?>
<!-- ============ Header, with the 3D scene ============ -->
<?php if ($theme === 'encre'): ?>
<header class="hero3d affiche" id="haut" data-chapitre="haut" data-court="Opening">
  <div class="page affiche-in">
    <div class="affiche-texte">
      <p class="surtitre"><span class="sceau">序</span>Albert School · MSc 1 · Applied ML &amp; Maths for ML</p>
      <h1>Buy, stay neutral or sell the <em>Nikkei&nbsp;225</em>?</h1>
      <p class="chapo">Every month, at the close, our model estimates the probability that the Japanese index will rise the
        following month, using news and market data. A rule then turns this probability into an action for a euro-based
        investor, and says whether to hedge against the yen.</p>
      <dl class="reponse">
        <div class="large"><dt>Our answer</dt><dd>Always buy, hedged against the yen.</dd>
          <p>On the test, the model did no better than the constant model. So we apply the commitment we wrote down
            before looking at that data.</p></div>
        <div><dt>The model, on the test</dt><dd><?= decimal($modele['log-loss']) ?> <small>vs <?= decimal($constante['log-loss']) ?></small></dd>
          <p>Model log-loss, compared with the constant model's. Lower is better.</p></div>
        <div><dt>In euros, 2024-2026</dt><dd><?= signe(100 * $achat_couvert, 1, '%') ?> <small>vs <?= signe(100 * $regle, 1, '%') ?></small></dd>
          <p>Return of “always buy, hedged”, against the model's rule.</p></div>
      </dl>
      <div class="boutons">
        <a class="btn plein" href="#resultat">Read the story ↓</a>
        <a class="btn contour" href="#explorateur">Try the predictor</a>
      </div>
    </div>
    <figure class="planche" data-planche="haut"><div class="dessin"></div><figcaption></figcaption></figure>
  </div>
</header>
<?php else: ?>
<header class="hero3d" id="haut">
  <canvas id="scene-hero" aria-hidden="true"></canvas>
  <div class="hud" aria-hidden="true">
    <span class="hud-hg">NIKKEI 225 // 2010 → 2026</span>
    <span class="hud-hd" id="hud-mois">—</span>
    <span class="hud-bg">201 MONTHS · 12 FEATURES · 1 MODEL</span>
    <span class="hud-bd">SCROLL ↓</span>
  </div>
  <div class="page hero">
    <div>
      <p class="surtitre">Albert School · MSc 1 · Applied ML &amp; Maths for ML</p>
      <h1>Buy, stay neutral or sell the <em>Nikkei&nbsp;225</em>?</h1>
      <p class="chapo">Every month, at the close, our model estimates the probability that the Japanese index will rise the
        following month, using news and market data. A rule then turns this probability into an action for a euro-based
        investor, and says whether to hedge against the yen.</p>
      <div class="puces">
        <span class="puce"><b>200 months</b> · 2010 → 2026</span>
        <span class="puce"><b>13,700 articles</b> scored by FinBERT</span>
        <span class="puce"><b>3 models</b> · 200 Optuna trials</span>
        <span class="puce"><b>A single</b> evaluation on the test</span>
      </div>
      <div class="boutons">
        <a class="btn plein" href="#explorateur">Explore the signal</a>
        <a class="btn contour" href="/en/notebooks">Open the notebooks</a>
        <a class="btn contour" href="/rapport.pdf" target="_blank">Report PDF (FR)</a>
      </div>
    </div>

    <div class="carte signal verre relief">
      <div class="entete">
        <span class="etiquette">Model signal</span>
        <span class="mois"><?= $signal ? 'data to end of ' . e(mois_lisible($signal['mois_des_donnees'])) : 'API stopped' ?></span>
      </div>
<?php if ($signal): ?>
      <div class="proba"><?= pct($signal['p_hausse']) ?><small>probability of a rise</small></div>
      <div class="jauge" data-jauge data-p="<?= e($signal['p_hausse']) ?>" data-tv="<?= e($signal['seuils']['theta_v']) ?>" data-ta="<?= e($signal['seuils']['theta_a']) ?>"></div>
      <div class="duo">
        <div class="mini"><span>Score S = 2p − 1</span><b><?= signe($signal['score']) ?></b></div>
        <div class="mini"><span>Rule's action</span><b><span class="badge <?= e($signal['action_du_modele']) ?>"><?= e(action_en($signal['action_du_modele'])) ?></span></b></div>
      </div>
<?php else: ?>
      <p class="alerte" style="margin-top:14px">The Python API is not responding. Start it from the project root:<br>
        <code>uvicorn app.api:app --port 8000</code></p>
<?php endif; ?>
      <div class="verdict"><b>Final recommendation: always buy, hedged.</b><br>
        On the test, the model did not beat the constant model. We show its rule for analysis only.</div>
    </div>
  </div>
  <p class="page legende-3d">Relief: Nikkei 225, 2010 → 2026, log scale ·
    <i style="background:#5b8cff"></i>training <i style="background:#ffb347"></i>validation <i style="background:#b4ff1a"></i>test</p>
</header>
<?php endif; ?>

<div class="progression" id="progression"></div>
<main class="page">
<!-- ============ Result ============ -->
<section id="resultat">
  <p class="surtitre">The result, plainly</p>
  <h2>A negative result, obtained cleanly</h2>
  <p class="chapo">Our model spots risky months slightly better than chance, but it forecasts falls far more often than
    they happen. Before looking at the test, we committed to recommending the reference strategy in that case, and that
    is what we do.</p>
  <div class="grille g4">
    <div class="carte kpi rouge relief"><b data-compte="<?= e($modele['log-loss']) ?>" data-decimales="3"><?= decimal($modele['log-loss']) ?></b><span>model log-loss on the test</span><div class="contre">vs <?= decimal($constante['log-loss']) ?> for the constant model</div></div>
    <div class="carte kpi relief"><b data-compte="<?= e($modele['PR-AUC']) ?>" data-decimales="3"><?= decimal($modele['PR-AUC']) ?></b><span>PR-AUC of the “fall” class</span><div class="contre">vs <?= decimal($constante['PR-AUC']) ?> for chance</div></div>
    <div class="carte kpi relief"><b>11 / 12</b><span>falls avoided by the rule</span><div class="contre">but 18 rises missed</div></div>
    <div class="carte kpi vert relief"><b data-compte="<?= e(100 * $achat_couvert) ?>" data-decimales="1" data-prefixe="+" data-suffixe="%"><?= signe(100 * $achat_couvert, 1, '%') ?></b><span>“always buy, hedged” in euros</span><div class="contre">vs <?= signe(100 * $regle, 1, '%') ?> for the model's rule</div></div>
  </div>
</section>
<!-- ============ Predictor ============ -->
<section id="explorateur">
  <p class="surtitre">Predictor · live from the model</p>
  <h2>Change the information, the model responds</h2>
  <p class="chapo">Pick a real month, then move the sliders to change news volume, sentiment, momentum or rates. The
    site then queries the API, which recomputes the probability of a rise, the rule's action and the weight of each
    feature.</p>
  <div class="grille labo">
    <div class="carte">
      <div class="reglage">
        <label for="choix-mois">Starting month</label>
        <select id="choix-mois" style="width:100%">
<?php foreach ($mois as $m): ?>
          <option value="<?= e($m['mois']) ?>"><?= e(mois_lisible($m['mois'])) ?> · <?= e(bloc_en($m['bloc'])) ?></option>
<?php endforeach; ?>
        </select>
      </div>
      <div id="curseurs"></div>
      <button class="btn contour" id="pred-reinit" type="button">Back to the month's real values</button>
    </div>
    <div class="carte signal">
      <div class="entete"><span class="etiquette">Model prediction</span><span class="mois" id="exp-bloc"></span></div>
      <div class="grand-resultat">
        <span class="proba" id="exp-proba">–</span>
        <div><div class="note">probability of a rise next month · score <b id="exp-score">–</b></div>
          <div id="exp-action" style="margin-top:8px"></div></div>
      </div>
      <div class="jauge" id="exp-jauge"></div>
      <p class="note" id="exp-suite"></p>
      <h3 style="margin-top:18px">What drives this prediction</h3>
      <p class="note">In log-odds of a fall. <?= $theme === 'encre' ? 'Red' : 'Orange' ?>: pushes towards “fall”. <?= $theme === 'encre' ? 'Blue' : 'Green' ?>: pushes towards “rise”.</p>
      <div class="graphe" id="graphe-shap"></div>
    </div>
  </div>
  <p class="note" style="margin-top:12px">This predictor shows how the model reacts when the information changes. It says
    nothing about what the market will actually do, especially since this model did not beat the constant model on the test.</p>
</section>
<!-- ============ Building the dataset ============ -->
<?php
// Dataset sources: name, content, lag applied so that no value is ever used before its publication.
$sources = [
    ['Yahoo Finance', 'Nikkei 225 (open, high, low, close), S&P 500, TAIEX, Shanghai, Nifty, MSCI EM, Japanese ETFs', 'none for Tokyo; 1 session for markets that close later'],
    ['FRED', 'US 10-year yield, USD/JPY, VIX', '1 session'],
    ['Japan Ministry of Finance', 'Japanese government bond (JGB) yields at 2, 5, 10 and 30 years', '1 session'],
    ['Bundesbank and ECB', '10-year Bund, €STR / EONIA, 3-month Euribor', '1 to 2 sessions'],
    ['Bank of Japan', 'TONA (overnight rate), Tankan survey, meeting calendar', 'Tankan: 5 days after quarter end'],
    ['e-Stat', 'Japanese inflation (headline, core and core-core CPI)', 'the 25th of the following month'],
    ['Kenneth French', 'Fama-French factors for Japan (size, value)', '2 months'],
    ['GDELT', '13,694 press headlines on Japan and the Bank of Japan, since 2017', 'attached to the first session that closes after their detection'],
    ['FinBERT', 'Headline sentiment score, equal to P(positive) − P(negative)', 'computed on the headline, so none'],
];
$etapes_dataset = [
    ['Collect', 'We download every source and keep it as is in data/raw, so the project can be replayed offline.'],
    ['Clean', 'A fake session copied by Yahoo on a public holiday is removed. An unadjusted split and a price divided by 10 are fixed on the TOPIX ETF. Days without news are kept and flagged by an indicator.'],
    ['Align', 'Everything is mapped onto the Tokyo calendar. When a value is missing we carry the last known one forward, never fetching a future value.'],
    ['Lag', 'Every series is delayed to its real publication date, so the model never has information before the market does.'],
    ['Aggregate', "We keep one row per month, dated at the last session, with end-of-month levels, the month's returns and changes, and news averages."],
    ['Build', "We add three news features (abnormal volume, weighted sentiment, presence indicator) and the following month's targets."],
    ['Check', 'A coded audit checks the target, that no target is copied, the publication dates and that there is a single row to predict.'],
];
?>
<section id="dataset">
  <p class="surtitre">Building the dataset</p>
  <h2>From twelve sources to a 201-month table</h2>
  <p class="chapo">This dataset did not exist; we built it source by source. Every series is delayed to its publication
    date, so the model never sees information early.</p>
  <div class="carte">
    <table class="tableau">
      <thead><tr><th>Source</th><th>What we take from it</th><th>Lag applied</th></tr></thead>
      <tbody>
<?php foreach ($sources as [$source, $contenu, $delai]): ?>
        <tr><td><b><?= e($source) ?></b></td><td><?= e($contenu) ?></td><td><?= e($delai) ?></td></tr>
<?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="grille g4 etapes" style="margin-top:18px">
<?php foreach ($etapes_dataset as [$nom, $detail]): ?>
    <div class="carte etape"><h3><?= e($nom) ?></h3><p><?= e($detail) ?></p></div>
<?php endforeach; ?>
    <div class="carte kpi vert"><b>201</b><span>months, 24 columns</span><div class="contre">200 labelled months + 1 month to predict</div></div>
  </div>
  <div class="grille g2" style="margin-top:18px">
    <div class="carte">
      <h3>The targets, defined on the following month</h3>
      <div class="formule">R<sup>N</sup><sub>t+1</sub> = P<sub>t+1</sub> / P<sub>t</sub> − 1 &nbsp;·&nbsp; y = 1 if R<sup>N</sup><sub>t+1</sub> ≤ 0</div>
      <div class="formule">E<sub>t+1</sub> = S<sub>t</sub> / S<sub>t+1</sub> − 1 &nbsp;·&nbsp; C<sub>t</sub> = (1 + i<sup>EUR</sup>/12) / (1 + i<sup>JPY</sup>/12) − 1</div>
      <div class="formule">hedged: R<sup>N</sup> + C<sub>t</sub> + R<sup>N</sup>E &nbsp;·&nbsp; unhedged: R<sup>N</sup> + E + R<sup>N</sup>E</div>
      <p class="note">R<sup>N</sup>: Nikkei return in yen. E: yen return in euros. C<sub>t</sub>: hedge carry, known in
        advance. We take the fall as the positive class, because it is the rare and costly event.</p>
    </div>
    <div class="carte">
      <h3>News, from article to feature</h3>
      <ul class="points">
        <li>13,694 headlines collected, 13,015 after removing reposts of the same headline.</li>
        <li>FinBERT classifies 32% of headlines as positive, 42% as negative, 26% as neutral. The mean score is −0.10.</li>
        <li>Articles are attached to the first Tokyo session that closes after their detection (6:30 UTC).</li>
        <li>Abnormal volume compares the month's article count with its average over the previous six months.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> The final table has 201 months, from February 2010 to October 2026. Our audit
    finds no leakage. The target matches next month's return exactly (gap 0), the hedge identity holds to within
    7 × 10⁻⁷ and the Tankan only changes in its publication months.</div>
</section>

<!-- ============ Method ============ -->
<section id="methode">
  <p class="surtitre">The method</p>
  <h2>From raw data to decision, step by step</h2>
  <p class="chapo">The steps follow the course sessions, and each comes with an executed notebook. Click a step to open
    its notebook.</p>

  <div class="flux">
    <div><b>Data</b><span>12 sources, lagged to their publication date</span></div>
    <div><b>Monthly table</b><span>200 months, 10 features, leakage audit</span></div>
    <div><b>Pipeline</b><span>imputation, k-means, standardisation</span></div>
    <div><b>Model</b><span>L2 logistic, Platt-calibrated</span></div>
    <div><b>Rule</b><span>expected gain in euros, two thresholds</span></div>
    <div><b>Action</b><span>buy hedged · neutral · sell</span></div>
  </div>

  <div class="grille g3 etapes" style="margin-top:24px">
    <a class="carte plate etape relief" href="/en/notebooks?nb=01_cadrage_eda_variables"><h3>Framing and leakage</h3>
      <p>The five questions, the leakage audit checked by code, exploration, the chronological split.</p><span class="cours">S1 · L1 · L2</span></a>
    <a class="carte plate etape relief" href="/en/notebooks?nb=02_pipeline_modeles_optuna"><h3>Pipeline and models</h3>
      <p>A single pipeline, three models tuned by Optuna on time-series cross-validation.</p><span class="cours">S2 to S5 · L3B</span></a>
    <a class="carte plate etape relief" href="/en/notebooks?nb=03_calibration_seuils"><h3>Calibration and decision</h3>
      <p>Out-of-fold Platt, thresholds derived from costs, decision frozen by a commit before the test.</p><span class="cours">S7 · S8</span></a>
    <a class="carte plate etape relief" href="/en/notebooks?nb=03b_test_final"><h3>The test, only once</h3>
      <p>The frozen decision is applied to the 33 test months. The floor is not beaten.</p><span class="cours">S1</span></a>
    <a class="carte plate etape relief" href="/en/notebooks?nb=04_explicabilite_diagnostics"><h3>Explainability</h3>
      <p>Slices, permutation importance, global and local SHAP, PDP: why the model fails.</p><span class="cours">S9</span></a>
    <a class="carte plate etape relief" href="/en/notebooks?nb=05_annexe_maths_logistique"><h3>Maths appendix</h3>
      <p>Logistic regression coded by hand: likelihood, gradient, Gaussian prior, sensitivity.</p><span class="cours">L1 · L2 · L5 · L7</span></a>
  </div>
</section>


<!-- ============ Exploration ============ -->
<section id="exploration">
  <p class="surtitre">Exploration</p>
  <h2>200 months, and no information from the future</h2>
  <div class="grille g2">
    <figure class="figure"><img src="/figures/01_nikkei_split.png" alt="Nikkei 225 and chronological split">
      <figcaption>The Nikkei 225 at month end and the three blocks: training (143 months), validation (24), test (33).</figcaption></figure>
    <div class="carte">
      <h3>A leakage audit checked by code</h3>
      <ul class="points">
        <li>The target for month <i>t</i> is exactly the return of month <i>t</i> + 1 (gap 0).</li>
        <li>Series are lagged to their publication date, e.g. CPI on the 25th of the following month, the Tankan five days after the quarter and the Fama-French factors at <i>t</i> − 2.</li>
        <li>No feature copies a target. The check is on the values, and a test deliberately injects a leak to make sure it is caught.</li>
        <li>The news features are identical when the future is cut off.</li>
      </ul>
      <p class="note" style="margin-top:14px">Three features are built: <b>abnormal article volume</b>,
        <b>weighted FinBERT sentiment</b> and an indicator of whether news is present (it is absent before 2017).</p>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/01_cibles_couverture.png" alt="Targets and hedging">
      <figcaption>Monthly returns, €1 invested hedged or unhedged, and the hedge carry, which changes sign after 2022.</figcaption></figure>
    <div class="carte">
      <h3>What the exploration tells us</h3>
      <ul class="points">
        <li>The Nikkei rises in 61% of months, which makes the “always up” forecast hard to beat.</li>
        <li>On training data, only abnormal article volume is clearly linked to the next return (rank correlation −0.38).</li>
        <li>FinBERT sentiment predicts almost nothing (+0.03).</li>
        <li>Nothing predicts the advantage of hedging.</li>
      </ul>
    </div>
  </div>
  <div class="conclusion"><b>Conclusion.</b> The market rises in 61% of months and news only covers 57 of the 143 training months. Only abnormal article volume stands out from the noise. News sentiment, on which our initial idea rested, predicts almost nothing.</div>
</section>


<!-- ============ Models ============ -->
<section id="modeles">
  <p class="surtitre">The models</p>
  <h2>Three models, one finding</h2>
  <p class="chapo">Logistic regression, Random Forest and LightGBM all beat the constant model in cross-validation. None
    of them does on the 2022-2023 validation, and the gap widens as the model gets more flexible.</p>
  <div class="grille g2">
    <div class="carte">
      <table class="tableau">
        <thead><tr><th>Model</th><th class="num">CV log-loss</th><th class="num">Validation log-loss</th><th class="num">Validation PR-AUC</th></tr></thead>
        <tbody>
          <tr class="ref"><td>Constant (reference)</td><td class="num">0.672</td><td class="num fort">0.681</td><td class="num">0.417</td></tr>
          <tr><td><b>Logistic</b> · selected</td><td class="num">0.647</td><td class="num">0.701</td><td class="num">0.489</td></tr>
          <tr><td>Random Forest</td><td class="num">0.629</td><td class="num">0.742</td><td class="num">0.440</td></tr>
          <tr><td>LightGBM</td><td class="num fort">0.584</td><td class="num">0.710</td><td class="num fort">0.524</td></tr>
        </tbody>
      </table>
      <p class="note" style="margin-top:16px">Lower log-loss is better. To choose the final model we apply the course's
        baseline rule: keep the simple model unless a more complex one clearly beats it on ranking <i>and</i> on
        probability quality.</p>
    </div>
    <figure class="figure"><img src="/figures/02_coefficients_logistiques.png" alt="Logistic regression coefficients">
      <figcaption>In the logistic regression, one more standard deviation of article volume or of 12-month momentum
        multiplies the odds of a fall by 1.22. The hedging model has no non-zero coefficient.</figcaption></figure>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/02_optuna_historique.png" alt="Optuna trial history">
    <figcaption>The 200 Optuna trials, all logged, with their log-loss, the best result so far and the constant model's level.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> A more flexible model fits more of the noise in the 48 cross-validation months. LightGBM gains 0.089 of log-loss there, then loses 0.029 on 2022-2023. So we keep logistic regression, as the baseline rule requires. As for the hedging model, it finds no signal and all its coefficients are zero.</div>
</section>


<!-- ============ Decision ============ -->
<section id="decision">
  <p class="surtitre">From probability to action</p>
  <h2>How a probability becomes an action</h2>
  <div class="grille g2">
    <div class="carte">
      <h3>The full formula</h3>
      <p class="note">Features are standardised (<i>z</i>), weights are learned by gradient descent, and the probability is Platt-calibrated and then compared with two thresholds.</p>
      <div class="formule">p<sub>t</sub> = 1 − σ( a·(b + w<sup>⊤</sup>z<sub>t</sub>) + c ), &nbsp;&nbsp; S<sub>t</sub> = 2p<sub>t</sub> − 1</div>
      <div class="formule"><span class="droit">buy if</span> p<sub>t</sub> ≥ θ<sub>a</sub> = (m − B<sub>d</sub>) / (B<sub>u</sub> − B<sub>d</sub>) = <span class="droit">0.580</span><br>
        <span class="droit">sell if</span> p<sub>t</sub> ≤ θ<sub>v</sub> = (S<sub>d</sub> − m) / (S<sub>d</sub> − S<sub>u</sub>) = <span class="droit">0.456</span></div>
      <ul class="points">
        <li>Costs are measured on training data, where a hedged purchase earns +3.89% in a rising month and loses 4.18% in a falling month.</li>
        <li>The margin <i>m</i> = 0.5% per month was set in advance, without tuning it on validation.</li>
        <li>For hedging we found no signal, so we always stay hedged.</li>
      </ul>
    </div>
    <div class="carte">
      <h3>Frozen before seeing the test</h3>
      <p>The model, the calibration, the costs, the margin and the hedging choice are written to a file, committed
        (<code>75712cf</code>) before any evaluation on the test (<code>6efd12c</code>).</p>
      <div class="alerte"><b>Commitment made in advance.</b> If the model also loses to the constant model on the test,
        the recommendation will be “always buy, hedged”.</div>
      <p class="note" style="margin-top:14px">Platt calibration is learned on out-of-fold predictions. A first attempt on
        the validation set gave negative slopes, which flipped the models, and we discarded it.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:20px"><img src="/figures/03_fiabilite_brute.png" alt="Reliability diagrams">
    <figcaption>Reliability diagrams coded by hand. Out of fold, the points follow the diagonal. On validation, the
      logistic curve slopes down, meaning falls happen less often when it predicts them with more confidence.</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> On validation, the calibrated logistic does not beat the constant model (log-loss 0.699 vs 0.681). The rule avoids 7 of 10 falls but misses the 2023 rally. We nevertheless froze everything before the test, writing down in advance what we would do depending on the result.</div>
</section>


<!-- ============ Test ============ -->
<section id="test">
  <p class="surtitre">The 2024-2026 test</p>
  <h2>A single evaluation, and a commitment kept</h2>
  <p class="chapo">The rule avoids almost every fall, but it stays out of the market during an 82% rise. On the curve,
    the colour of each point shows the action taken that month.</p>
  <div class="carte">
    <div class="barre-outils">
      <div class="onglets" id="onglets-bloc">
        <button class="onglet actif" data-bloc="test">Test 2024-2026</button>
        <button class="onglet" data-bloc="validation">Validation 2022-2023</button>
      </div>
      <span class="note" id="resume-historique"></span>
    </div>
    <div class="graphe" id="graphe-historique"></div>
    <div class="legende">
      <span><i class="ligne" style="background:#c55a11"></i>always buy, hedged</span>
      <span><i class="ligne" style="background:#052424"></i>model's rule</span>
      <span><i class="ligne" style="background:#8b90a0"></i>cash</span>
      <span><i style="background:#1faa59"></i>buy</span>
      <span><i style="background:#8b90a0"></i>neutral</span>
      <span><i style="background:#e5484d"></i>sell</span>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <div class="carte">
      <h3>Probabilities on the test</h3>
      <table class="tableau">
        <thead><tr><th>Model</th><th class="num">Log-loss</th><th class="num">Brier</th><th class="num">ECE</th><th class="num">PR-AUC</th></tr></thead>
        <tbody>
<?php foreach (['logistique' => 'Calibrated logistic · selected', 'Random Forest' => 'Random Forest', 'LightGBM' => 'LightGBM',
               "constante (fréquence de l'entraînement)" => 'Constant (reference)'] as $cle => $libelle):
        $ligne = $metriques[$cle] ?? null;
        if ($ligne === null) { continue; } ?>
          <tr<?= str_starts_with($cle, 'constante') ? ' class="ref"' : '' ?>><td><?= e($libelle) ?></td>
<?php   foreach (['log-loss', 'Brier', 'ECE', 'PR-AUC'] as $mesure):
            $valeurs = array_column($metriques, $mesure);
            $meilleur = $mesure === 'PR-AUC' ? max($valeurs) : min($valeurs); ?>
            <td class="num<?= abs($ligne[$mesure] - $meilleur) < 1e-9 ? ' fort' : '' ?>"><?= decimal($ligne[$mesure]) ?></td>
<?php   endforeach; ?>
          </tr>
<?php endforeach; ?>
        </tbody>
      </table>
      <p class="note" style="margin-top:14px">The model is <b>overconfident about falls</b>. It forecasts 52% on average
        while 36% are observed, and we would not rely on these probabilities to decide.</p>
    </div>
    <div class="carte">
      <h3>Actions and what happened the next month</h3>
      <table class="tableau" id="tableau-actions">
        <thead><tr><th>Action</th><th class="num">Rises</th><th class="num">Falls</th></tr></thead>
        <tbody></tbody>
      </table>
      <p class="note" style="margin-top:14px">Permanent hedging, on the other hand, was the right choice, with +82.3% on
        the test versus +57.9% unhedged.</p>
    </div>
  </div>
  <div class="carte" style="margin-top:18px">
    <h3>Where the model succeeds and where it fails</h3>
    <table class="tableau">
      <thead><tr><th>Test subgroup</th><th class="num">Months</th><th class="num">Falls</th><th class="num">Model log-loss</th><th class="num">Constant log-loss</th></tr></thead>
      <tbody>
        <tr><td>Year 2024</td><td class="num">12</td><td class="num">6</td><td class="num fort">0.672</td><td class="num">0.717</td></tr>
        <tr><td>Year 2025</td><td class="num">12</td><td class="num">3</td><td class="num">0.684</td><td class="num fort">0.607</td></tr>
        <tr><td>Year 2026</td><td class="num">9</td><td class="num">3</td><td class="num">0.787</td><td class="num fort">0.644</td></tr>
        <tr><td>Calm regime</td><td class="num">24</td><td class="num">9</td><td class="num">0.725</td><td class="num fort">0.662</td></tr>
        <tr><td>Turbulent regime</td><td class="num">9</td><td class="num">3</td><td class="num">0.660</td><td class="num fort">0.644</td></tr>
      </tbody>
    </table>
    <p class="note" style="margin-top:12px">With 3 to 9 falls per subgroup, these gaps remain fragile. Our data concerns no
      individuals and so contains no sensitive attribute. We transposed the fairness analysis to these groups of months.</p>
  </div>
  <div class="conclusion"><b>Conclusion.</b> The model does not beat the floor. It only does better than the constant model in 2024, a year in which it detects all six falls. So we keep our commitment and recommend “always buy, hedged”. Permanent hedging, for its part, was the right choice (+82.3% vs +57.9%).</div>
</section>


<!-- ============ Simulator ============ -->
<section id="simulateur">
  <p class="surtitre">Simulator · adjustable</p>
  <h2>What if the rule had been set differently?</h2>
  <p class="chapo">You can move the margin, change the hedging or forbid selling. The thresholds, the actions and the
    curve are recomputed immediately.</p>
  <div class="grille labo">
    <div class="carte">
      <div class="reglage">
        <label for="sim-marge">Required margin above cash <output id="sim-marge-valeur"></output></label>
        <input type="range" id="sim-marge" min="0" max="1.5" step="0.05" value="0.5">
      </div>
      <div class="reglage"><label>Yen hedging when buying</label>
        <div class="onglets" id="sim-couverture"><button class="onglet actif" data-v="1" type="button">Hedged</button><button class="onglet" data-v="0" type="button">Unhedged</button></div></div>
      <div class="reglage"><label>Period</label>
        <div class="onglets" id="sim-bloc"><button class="onglet actif" data-v="test" type="button">Test 2024-2026</button><button class="onglet" data-v="validation" type="button">Validation 2022-2023</button></div></div>
      <label class="interrupteur"><input type="checkbox" id="sim-vente" checked> Allow selling the Nikkei</label>
      <div class="jauge" id="sim-jauge"></div>
      <button class="btn contour" id="sim-reinit" type="button">Back to the project's setting</button>
    </div>
    <div class="carte">
      <div class="labo-kpis">
        <div class="mini"><span>Simulated rule</span><b id="sim-regle">–</b></div>
        <div class="mini"><span>Always buy</span><b id="sim-reference">–</b></div>
        <div class="mini"><span>Max drawdown</span><b id="sim-perte">–</b></div>
        <div class="mini"><span>Falls avoided</span><b id="sim-baisses">–</b></div>
      </div>
      <div class="note" id="sim-actions"></div>
      <div class="repartition" id="sim-repartition"><i style="background:#1faa59"></i><i style="background:#8b90a0"></i><i style="background:#e5484d"></i></div>
      <div class="graphe" id="sim-graphe"></div>
    </div>
  </div>
  <p class="alerte" style="margin-top:16px"><b>After-the-fact exploration.</b> In the project, the margin stayed fixed at
    0.5% per month before we looked at the test. Picking the best setting here would amount to tuning the rule on the test.</p>
</section>
<!-- ============ Projection ============ -->
<section id="projection">
  <p class="surtitre">Projection</p>
  <h2>What the model projects for November 2026</h2>
  <p class="chapo">Here is what the system produces with data up to the end of October 2026, the latest month available,
    and how to read the result.</p>
  <div class="grille g2">
    <div class="carte signal">
      <div class="entete"><span class="etiquette">System output</span><span class="mois"><?= $signal ? e(mois_lisible($signal['mois_des_donnees'])) : 'API stopped' ?></span></div>
<?php if ($signal): ?>
      <div class="proba"><?= pct($signal['p_hausse'], 1) ?><small>probability of a rise in November</small></div>
      <div class="jauge" data-jauge data-p="<?= e($signal['p_hausse']) ?>" data-tv="<?= e($signal['seuils']['theta_v']) ?>" data-ta="<?= e($signal['seuils']['theta_a']) ?>"></div>
      <div class="duo">
        <div class="mini"><span>Score S = 2p − 1</span><b><?= signe($signal['score']) ?></b></div>
        <div class="mini"><span>Rule's action</span><b><span class="badge <?= e($signal['action_du_modele']) ?>"><?= e(action_en($signal['action_du_modele'])) ?></span></b></div>
      </div>
<?php endif; ?>
      <div class="verdict"><b>Recommendation adopted: buy, hedged.</b><br>The model's rule is not followed, since the model
        did not beat the constant model on the test.</div>
    </div>
    <div class="carte">
      <h3>How the model reaches this figure</h3>
      <ul class="points">
        <li><b>Article volume (+0.58).</b> October had twice as many articles as usual, and this is what pushes the signal hardest towards a fall.</li>
        <li><b>Japanese 10-year yield (−0.30).</b> It fell by 21 basis points, which pushes towards a rise.</li>
        <li><b>Carry (+0.14).</b> Its value lies outside the range seen in training, so this contribution should be read with caution.</li>
        <li><b>12-month momentum (+0.10).</b> The Nikkei gained 21% in a year and the model bets against the trend.</li>
      </ul>
      <p class="note" style="margin-top:12px">Contributions in log-odds of a fall. Their sum, added to the model's mean level
        and then calibrated, gives the probability shown.</p>
    </div>
  </div>
  <figure class="figure" style="margin-top:18px"><img src="/figures/04_shap_waterfall_2026-10.png" alt="SHAP breakdown of the October 2026 prediction">
    <figcaption>Full breakdown of the prediction, feature by feature (notebook 04).</figcaption></figure>
  <div class="conclusion"><b>Conclusion.</b> This projection is fragile for two reasons. First, half of the last twenty
    sessions have no article collected, so October's spike in articles rests on few days. Second, the model proved too
    pessimistic across the whole test. So we do not follow it and we keep the recommendation “buy, hedged”.</div>
</section>

<!-- ============ Regime change ============ -->
<?php
// What changed after 2021: each row becomes a card, front (before) / back (since 2022).
$bascules = [
    ['Hedge carry', '−0.4% / yr', '+2.2% / yr', 'The BoJ exits negative rates. Hedging the yen used to cost money; now it earns some.'],
    ['Article volume vs next-month return', '−0.38', '+0.29', 'This rank correlation changes sign in 2022-2023, then stays unstable.'],
    ['BoJ articles per month', '55', '73', 'Monetary normalisation dominates the press.'],
    ['Probability of a fall forecast by the model', '40%', '52%', 'While actual falls go from 39% to 36% of months.'],
    ['Change in the Japanese 10-year yield', 'neutral', 'harmful', 'Its permutation importance goes from +0.001 to −0.027 on the test.'],
    ['12-month momentum, read contrarian', 'paying', 'losing', 'V-shaped rebounds until 2021, a lasting trend afterwards.'],
];
?>
<section id="regime" class="regime">
  <p class="surtitre">Regime change</p>
  <h2>What the model had learned flipped sign</h2>
  <p class="chapo">The model learned on 2010-2021. Since 2022 the Bank of Japan has been normalising its policy and several
    relationships have reversed. The two buttons switch between eras, and a click flips a card.</p>
  <div class="onglets" id="bascule-regime">
    <button class="onglet actif" data-v="avant" type="button">Up to 2021 · training</button>
    <button class="onglet" data-v="apres" type="button">Since 2022 · validation and test</button>
  </div>
  <div class="grille g3 volets">
<?php foreach ($bascules as [$libelle, $avant, $apres, $commentaire]): ?>
    <div class="volet" tabindex="0" role="button" aria-label="<?= e($libelle) ?>: flip the card">
      <div class="face face-avant"><span class="epoque">Up to 2021</span><h3><?= e($libelle) ?></h3><span class="valeur"><?= e($avant) ?></span><p><?= e($commentaire) ?></p></div>
      <div class="face face-apres"><span class="epoque">Since 2022</span><h3><?= e($libelle) ?></h3><span class="valeur"><?= e($apres) ?></span><p><?= e($commentaire) ?></p></div>
    </div>
<?php endforeach; ?>
  </div>
</section>

<!-- ============ Why ============ -->
<section id="pourquoi">
  <p class="surtitre">The diagnosis</p>
  <h2>Why the model fails after 2021</h2>
  <div class="grille g3">
    <div class="carte"><h3>An unstable news signal</h3>
      <p>Article volume used to announce falls until 2021. Its correlation with the next return then swings between −0.5
        and +0.3, as the Bank of Japan normalises its policy.</p></div>
    <div class="carte"><h3>An extrapolation</h3>
      <p>On the test, the carry sits 6 standard deviations from its training mean. The linear model then extends a slope
        learned on a narrow range, which adds +0.25 of log-odds towards “fall” every month.</p></div>
    <div class="carte"><h3>A contrarian bet</h3>
      <p>12-month momentum, contrarian during the V-shaped rebounds of 2018-2021, bets against a trend that lasted from
        2024 to 2026.</p></div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/04_inversion_signal_news.png" alt="News signal month by month">
      <figcaption>Top: the 24-month rolling correlation between article volume and next return. Bottom: the SHAP
        contribution of this feature.</figcaption></figure>
    <figure class="figure"><img src="/figures/04_shap_beeswarm_test.png" alt="Global SHAP on the test">
      <figcaption>Global SHAP on the test. Carry, 12-month momentum and the 10-year JGB push towards “fall” almost
        every month.</figcaption></figure>
  </div>
  <div class="carte" style="margin-top:20px">
    <h3>The limitations we declare</h3>
    <ul class="points">
      <li><b>A small sample.</b> We only have 143 training months and 12 falls in the test, which makes gaps between models and between subgroups fragile.</li>
      <li><b>A test that was not entirely unseen.</b> Our exploration already displayed statistics from the test block before the freeze, so permanent hedging was not chosen blind.</li>
      <li><b>Features chosen</b> from an analysis of 2017-2026, a period that overlaps validation and test.</li>
      <li><b>Fairness.</b> Our data concerns no individuals and contains no sensitive attribute. We transposed the analysis to groups of months, without finding gaps beyond noise.</li>
    </ul>
  </div>
</section>


<!-- ============ Maths ============ -->
<section id="maths">
  <p class="surtitre">Maths appendix · in 3D</p>
  <h2>Logistic regression, from likelihood to gradient descent</h2>
  <div class="grille g2">
    <div class="carte">
      <h3>Three derivations</h3>
      <p class="note">The cost is the negative Bernoulli log-likelihood.</p>
      <div class="formule">J(w, b) = − (1/m) Σ [ y log p + (1 − y) log(1 − p) ]</div>
      <p class="note">The chain rule gives its gradient: the error multiplied by the input.</p>
      <div class="formule">∇<sub>w</sub> J = (1/m) X<sup>⊤</sup>(p − y)</div>
      <p class="note">The L2 penalty amounts to a Gaussian prior on the weights.</p>
      <div class="formule">J<sub>λ</sub> = J + λ‖w‖², &nbsp; λ = 1 / (2mτ²)</div>
    </div>
    <div class="carte">
      <h3>Checked numerically</h3>
      <table class="tableau">
        <tbody>
          <tr><td>Analytic gradient vs finite differences</td><td class="num">1.3 × 10⁻⁹</td></tr>
          <tr><td>Hand-coded descent vs scikit-learn</td><td class="num">4.6 × 10⁻⁶</td></tr>
          <tr><td>Convergence bound 2/L</td><td class="num">2.08</td></tr>
          <tr><td>Local limit 2/λ<sub>max</sub>(H*)</td><td class="num">2.23</td></tr>
          <tr><td>Prior standard deviation τ for λ = 0.117</td><td class="num">0.17</td></tr>
        </tbody>
      </table>
      <p style="margin-top:16px"><a class="btn contour" href="/annexe_maths.pdf" target="_blank">Appendix PDF (4 pages, FR)</a></p>
    </div>
  </div>
  <div class="carte" style="margin-top:20px">
    <h3>Gradient descent on the cost surface, in 3D</h3>
    <p class="note">Model reduced to two features (abnormal article volume and 12-month momentum), with the same λ as
      the final model. Height is the cost J(w₁, w₂). Pick a step size α, then drag to rotate.</p>
    <div class="barre-outils">
      <div class="onglets" id="choix-pas"></div>
      <span class="note" id="etat-pas"></span>
    </div>
    <div class="scene" id="scene-surface"><canvas aria-label="3D cost surface and gradient descent path"></canvas></div>
    <div class="legende">
      <span><i style="background:#f2c14e"></i>starting point</span>
      <span><i style="background:#e5484d"></i>minimum</span>
      <span><i class="ligne" style="background:#15171f"></i>descent path</span>
      <span>colour: from blue (low cost) to red (high cost)</span>
    </div>
  </div>
  <div class="grille g2" style="margin-top:20px">
    <figure class="figure"><img src="/figures/05_sensibilite_pas.png" alt="Sensitivity to step size">
      <figcaption>Sensitivity to the step size α. Too small and the descent is slow; beyond the limit it no longer converges.</figcaption></figure>
    <figure class="figure"><img src="/figures/05_sensibilite_lambda.png" alt="Sensitivity to lambda">
      <figcaption>Sensitivity to λ. Without a penalty the model overfits, and the cross-validation log-loss is lowest at the λ chosen by Optuna.</figcaption></figure>
  </div>
  <div class="conclusion"><b>Conclusion.</b> Our hand-coded descent matches scikit-learn. All the sensitivity analyses point the same way: stronger regularisation or earlier stopping bring the model closer to the constant. That is the signature of a weak signal that is unstable over time.</div>
</section>


<!-- ============ Resources ============ -->
<section id="ressources">
  <p class="surtitre">Resources</p>
  <h2>The whole project, one click away</h2>
  <div class="grille g3">
    <a class="carte ressource relief" href="/en/notebooks?nb=01_cadrage_eda_variables"><span class="fleche">→</span><span class="num">Notebook 01</span><h3>Framing, leakage, EDA</h3><p>The five questions, the audit, the features, the split.</p></a>
    <a class="carte ressource relief" href="/en/notebooks?nb=02_pipeline_modeles_optuna"><span class="fleche">→</span><span class="num">Notebook 02</span><h3>Pipeline and Optuna</h3><p>Three models, 200 logged trials.</p></a>
    <a class="carte ressource relief" href="/en/notebooks?nb=03_calibration_seuils"><span class="fleche">→</span><span class="num">Notebook 03</span><h3>Calibration and thresholds</h3><p>Platt, costs, frozen decision.</p></a>
    <a class="carte ressource relief" href="/en/notebooks?nb=03b_test_final"><span class="fleche">→</span><span class="num">Notebook 03b</span><h3>Final test</h3><p>The single evaluation on 2024-2026.</p></a>
    <a class="carte ressource relief" href="/en/notebooks?nb=04_explicabilite_diagnostics"><span class="fleche">→</span><span class="num">Notebook 04</span><h3>Explainability</h3><p>Slices, permutation, SHAP, PDP.</p></a>
    <a class="carte ressource relief" href="/en/notebooks?nb=05_annexe_maths_logistique"><span class="fleche">→</span><span class="num">Notebook 05</span><h3>Maths appendix</h3><p>Logistic regression coded by hand.</p></a>
    <a class="carte ressource relief" href="/rapport.pdf" target="_blank"><span class="fleche">→</span><span class="num">PDF · 9 pages · FR</span><h3>Applied ML report</h3><p>The ten requirements, in order.</p></a>
    <a class="carte ressource relief" href="/annexe_maths.pdf" target="_blank"><span class="fleche">→</span><span class="num">PDF · 4 pages · FR</span><h3>Maths appendix</h3><p>Loss, gradient, prior, sensitivity.</p></a>
    <a class="carte ressource relief" href="<?= e(API) ?>/docs" target="_blank"><span class="fleche">→</span><span class="num">API</span><h3>API documentation</h3><p>/signal, /explication, /historique, /evaluation.</p></a>
  </div>
</section>


</main>

<script src="/en/assets/app.js"></script>
<script type="module" src="/assets/scene3d.js"></script>
<?php if ($theme === 'encre'): ?>
<script type="module" src="/en/assets/recit.js"></script>
<?php endif; ?>
<?php require __DIR__ . '/inc/pied.php'; ?>
