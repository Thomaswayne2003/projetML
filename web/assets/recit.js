/* Projet Nikkei — le récit (/recit). Un nuage de 16 000 gouttes d'encre accompagne la lecture. À l'ouverture de chaque
   chapitre il dessine une figure réelle du projet (tableaux.js), avec ses repères et un cartel qui dit ce qu'on regarde.
   Pendant la lecture du chapitre, il s'efface en filigrane. */
import * as THREE from "./three.module.min.js";
import { N, h } from "./formes.js";
import * as T from "./tableaux.js";

const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const api = (route, params = {}) => fetch("/api.php?" + new URLSearchParams({ route, ...params })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const NOMS = { news_attention_6m: "Volume anormal d'articles", news_sent_w: "Sentiment FinBERT", news_dispo: "News disponibles", n225_mom_12m: "Momentum 12 mois",
  n225_mom_3m: "Momentum 3 mois", n225_vol_ewma: "Volatilité du Nikkei", d_jgb10y_bp: "Variation du JGB 10 ans", tankan_large_manuf: "Tankan", carry_1m: "Portage de la couverture",
  eurjpy_rvol_1m: "Volatilité EUR/JPY", "distance au régime agité": "Distance au régime agité", "distance au régime calme": "Distance au régime calme" };

// ----- Les éléments fixes : repères posés sur le nuage, cartel, rail des chapitres
const ouvertures = [...document.querySelectorAll("[data-chapitre]")];
const calque = Object.assign(document.createElement("div"), { id: "reperes" });
const cartel = Object.assign(document.createElement("aside"), { id: "cartel", innerHTML: '<p class="cartel-entete">Ce que dessine le nuage</p><h4></h4><p class="cartel-texte"></p><ul></ul>' });
const rail = Object.assign(document.createElement("nav"), { id: "rail", ariaLabel: "Chapitres" });
rail.innerHTML = ouvertures.map((o, k) => `<a href="#${o.dataset.chapitre}"><i></i><span>${String(k).padStart(2, "0")} · ${o.dataset.court}</span></a>`).join("");
document.body.append(calque, cartel, rail);

// ----- Scène
const toile = document.getElementById("toile-recit");
const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true });
rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);
camera.position.set(0, 0, 9.4);
const materiau = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uMix: { value: 1 }, uTemps: { value: 0 }, uTaille: { value: 40 }, uOpacite: { value: 1 }, uSouris: { value: new THREE.Vector3(99, 99, 0) }, uAgite: { value: 0 } },
  vertexShader: `
    attribute vec3 posB; attribute vec3 colA; attribute vec3 colB; attribute float alea;
    uniform float uMix, uTemps, uTaille, uAgite; uniform vec3 uSouris; varying vec3 vCol;
    void main() {
      float m = smoothstep(0.0, 1.0, clamp((uMix - alea * 0.4) / 0.6, 0.0, 1.0));
      vec3 p = mix(position, posB, m);
      p += sin(3.14159 * m) * 0.9 * vec3(sin(alea * 91.7 + uTemps * 0.6), cos(alea * 47.3 + uTemps * 0.5), sin(alea * 23.1 - uTemps * 0.4));
      p += 0.012 * vec3(sin(uTemps * 0.8 + alea * 40.0), cos(uTemps * 0.7 + alea * 60.0), sin(uTemps * 0.9 + alea * 80.0));
      vec2 ecart = p.xy - uSouris.xy;
      p.xy += normalize(ecart + 0.0001) * exp(-dot(ecart, ecart) * 5.0) * 0.28;
      p += uAgite * 0.16 * vec3(sin(alea * 50.0 + uTemps * 3.0), cos(alea * 70.0 + uTemps * 2.6), sin(alea * 30.0 + uTemps * 2.2));
      vCol = mix(colA, colB, m);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uTaille * (0.5 + alea * 0.8) / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float uOpacite; varying vec3 vCol;
    void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vCol, (1.0 - smoothstep(0.3, 0.5, d)) * uOpacite); }`,
});
const geometrie = new THREE.BufferGeometry();
const tampons = { position: new Float32Array(N * 3), posB: new Float32Array(N * 3), colA: new Float32Array(N * 3), colB: new Float32Array(N * 3) };
Object.entries(tampons).forEach(([nom, t]) => geometrie.setAttribute(nom, new THREE.BufferAttribute(t, 3)));
geometrie.setAttribute("alea", new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, i) => h(i, 7)), 1));
geometrie.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 14);
const nuage = new THREE.Points(geometrie, materiau);
scene.add(nuage);

// ----- Données réelles, puis un tableau par chapitre
const [serie, test, validation, signal, evaluation, explication, cout, journal] = await Promise.all([api("serie"), api("historique", { bloc: "test" }),
  api("historique", { bloc: "validation" }), api("signal"), api("evaluation"), api("explication"), api("surface"), api("essais")]);
const preparer = (tableau) => {
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = tableau.forme(i); pos.set(v.slice(0, 3), i * 3); col.set(v.slice(3), i * 3); }
  return { ...tableau, pos, col };
};
const seuils = signal?.seuils ?? { theta_v: 0.456, theta_a: 0.58 };
const pConstante = evaluation?.metriques?.["constante (fréquence de l'entraînement)"]?.["proba moyenne"] ?? 0.3916;
const repli = serie ? preparer(T.courbe(serie)) : null;
const faire = (pret, tableau) => (pret ? preparer(tableau()) : repli);
const TABLEAUX = {
  haut: repli, ressources: repli,
  resultat: faire(test, () => T.performance(test)), simulateur: faire(test, () => T.performance(test)),
  explorateur: faire(signal, () => T.jauge(signal.p_hausse, seuils, "Le signal du mois, en direct")),
  dataset: faire(serie, () => T.calendrier(serie)), methode: faire(serie, () => T.decoupage(serie)), exploration: faire(serie, () => T.classes(serie)),
  modeles: faire(journal, () => T.essais(journal)), decision: faire(validation, () => T.points(validation, seuils, "validation 2022-2023")),
  test: faire(test, () => T.confusion(test)), projection: faire(explication, () => T.contributions(explication, NOMS, "novembre 2026")),
  regime: faire(serie, () => T.courbe(serie, "regime")), pourquoi: faire(test, () => T.ecarts(test, pConstante)), maths: faire(cout, () => T.surface(cout)),
};
if (!repli) { cartel.remove(); calque.remove(); throw new Error("API arrêtée : pas de nuage"); }

// ----- Métamorphose d'un tableau à l'autre
const DUREE = 1500;
let courant = TABLEAUX.haut, cle = "haut", debut = -1e9, duree = DUREE, attente = null;
function poser(a, b) {
  tampons.position.set(a.pos); tampons.colA.set(a.col); tampons.posB.set(b.pos); tampons.colB.set(b.col);
  Object.keys(tampons).forEach((nom) => { geometrie.attributes[nom].needsUpdate = true; });
}
function ecrire(tableau) {                               // le cartel et les repères du tableau
  cartel.querySelector("h4").textContent = tableau.titre;
  cartel.querySelector(".cartel-texte").textContent = tableau.texte;
  cartel.querySelector("ul").innerHTML = tableau.legende.map(([c, t]) => `<li><i style="background:${T.TEINTES[c]}"></i>${t}</li>`).join("");
  calque.innerHTML = tableau.reperes.map((r) => `<span class="repere a-${r.a}${r.fort ? " fort" : ""}">${r.t}</span>`).join("");
}
function aller(tableau, ms = DUREE) {
  if (tableau === courant) return;
  if (performance.now() - debut < duree) { attente = [tableau, ms]; return; }
  poser(courant, tableau); courant = tableau; debut = performance.now(); duree = ms; attente = null;
  calque.classList.remove("net"); cartel.classList.add("change");
  setTimeout(() => { ecrire(tableau); cartel.classList.remove("change"); }, 260);
}
poser(courant, courant); ecrire(courant);

// Le prédicteur parle au nuage : quand on déplace un curseur, l'aiguille de la jauge suit
document.addEventListener("nikkei:prediction", (e) => {
  const s = e.detail; if (!s || typeof s.p_hausse !== "number") return;
  TABLEAUX.explorateur = preparer(T.jauge(s.p_hausse, s.seuils ?? seuils, "Le signal du mois, en direct"));
  if (cle === "explorateur") aller(TABLEAUX.explorateur, 700);
});

const liens = [...rail.querySelectorAll("a")], lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const souris = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { souris.x = e.clientX / innerWidth - 0.5; souris.y = e.clientY / innerHeight - 0.5; });

let avant = performance.now(), sx = 0, sy = 0, largeur = 0, hauteur = 0, dernierDefilement = scrollY, agite = 0, presence = 1, echelle = 1, tour = 0;
const rayon = new THREE.Vector3(), impact = new THREE.Vector3(), point = new THREE.Vector3();
function image(maintenant) {
  const ecoule = Math.min(1, (maintenant - avant) / 1000), dt = Math.min(0.05, ecoule), vers = (v) => 1 - Math.exp(-ecoule * v); avant = maintenant;
  if (innerWidth !== largeur || innerHeight !== hauteur) {
    largeur = innerWidth; hauteur = innerHeight;
    rendu.setSize(largeur, hauteur, false); camera.aspect = largeur / hauteur; camera.updateProjectionMatrix();
  }
  // Le chapitre en cours : la dernière ouverture entrée dans l'écran. Sa présence : 1 quand elle occupe l'écran.
  const large = largeur > 900 && largeur / hauteur > 1.05;
  let k = 0, cible = 0;
  ouvertures.forEach((o, n) => { if (o.getBoundingClientRect().top < hauteur * 0.62) k = n; });
  const cadre = ouvertures[k].getBoundingClientRect();
  cible = large ? Math.min(k === 0 ? 1 : lisse(hauteur * 0.75, hauteur * 0.3, cadre.top), lisse(hauteur * 0.62, hauteur * 0.98, cadre.bottom))
    : Math.min(k === 0 ? 1 : lisse(hauteur * 0.4, hauteur * 0.05, cadre.top), lisse(hauteur * 0.3, hauteur * 0.52, cadre.top + hauteur * 0.58));   // écran étroit : la figure s'efface quand le texte arrive
  const nouvelle = ouvertures[k].dataset.chapitre;
  if (nouvelle !== cle) { cle = nouvelle; liens.forEach((l, n) => l.classList.toggle("actif", n === k)); aller(TABLEAUX[cle] ?? repli); }
  if (attente && maintenant - debut >= duree) aller(...attente);
  const avance = Math.min(1, (maintenant - debut) / duree);
  materiau.uniforms.uMix.value = avance;
  materiau.uniforms.uTemps.value = maintenant / 1000;
  presence += (cible - presence) * vers(7);
  materiau.uniforms.uOpacite.value = large ? 0.1 + 0.9 * presence : presence;
  agite += (Math.min(1, Math.abs(scrollY - dernierDefilement) / 60) - agite) * vers(6); dernierDefilement = scrollY;
  materiau.uniforms.uAgite.value = agite;

  // Le nuage occupe la moitié droite de l'écran (ou le haut, sur un écran étroit)
  const demiHaut = Math.tan((20 * Math.PI) / 180) * camera.position.z, demiLarge = demiHaut * camera.aspect;
  echelle = large ? Math.min(1.08, (demiLarge * 0.8) / 5.4) : Math.min(0.8, (demiLarge * 1.7) / 6.3);
  materiau.uniforms.uTaille.value = 0.043 * hauteur * rendu.getPixelRatio() * Math.max(0.75, echelle);
  sx += (souris.x - sx) * vers(3); sy += (souris.y - sy) * vers(3);
  tour += dt * (IMMOBILE ? 0 : 1);
  nuage.position.set(large ? demiLarge * 0.5 : 0, large ? 0.28 : demiHaut * 0.42, 0);
  nuage.scale.setScalar(echelle * (courant.echelle ?? 1));
  if (courant.tourne) nuage.rotation.set(0.42 + sy * 0.2, 0.6 + Math.sin(tour * 0.22) * 0.6 + sx * 0.5, 0);
  else nuage.rotation.set(sy * 0.16, sx * 0.3 + Math.sin(tour * 0.35) * 0.035, 0);
  camera.updateMatrixWorld(); nuage.updateMatrixWorld();
  rayon.set(souris.x * 2, -souris.y * 2, 0.5).unproject(camera).sub(camera.position).normalize();
  impact.copy(camera.position).addScaledVector(rayon, -camera.position.z / rayon.z);
  materiau.uniforms.uSouris.value.copy(nuage.worldToLocal(impact));
  rendu.render(scene, camera);

  // Repères : chaque étiquette suit son point du nuage. Cartel : visible quand la figure est nette.
  const net = avance >= 1 && presence > 0.6;
  calque.classList.toggle("net", net); cartel.classList.toggle("visible", presence > 0.6);
  if (net) courant.reperes.forEach((r, n) => {
    point.set(...r.p).applyMatrix4(nuage.matrixWorld).project(camera);
    calque.children[n].style.transform = `translate(${((point.x + 1) / 2 * largeur).toFixed(1)}px, ${((1 - point.y) / 2 * hauteur).toFixed(1)}px)`;
  });
  if (!IMMOBILE) requestAnimationFrame(image);
}
requestAnimationFrame(image);
if (IMMOBILE) { addEventListener("scroll", () => requestAnimationFrame(image), { passive: true }); setInterval(() => requestAnimationFrame(image), 400); }
