/* Projet Nikkei — expérience immersive.
   Un nuage de 16 000 gouttes d'encre se recompose en 3D à chaque chapitre, au rythme du défilement.
   Formes : ensō, relief du Nikkei, blocs du split, surface de coût, jauge du signal, verdict, hélice, sphère. */
import * as THREE from "./three.module.min.js";
import { N, h, enso, relief, blocs, surface, jauge, verdict, helice, sphere } from "./formes.js";

const K = window.PROJET.noms.length;
const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const api = (route) => fetch("/api.php?" + new URLSearchParams({ route })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
/* ---------- Scène ---------- */
const toile = document.getElementById("toile"), cadre = toile.parentElement;
const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true, alpha: true });
rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);

const materiau = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { uMix: { value: 0 }, uTemps: { value: 0 }, uTaille: { value: 40 }, uPapier: { value: new THREE.Color(0xf1eadb) },
              uIntro: { value: IMMOBILE ? 1 : 0 }, uSouris: { value: new THREE.Vector3(99, 99, 0) }, uAgite: { value: 0 } },
  vertexShader: `
    attribute vec3 posB; attribute vec3 colA; attribute vec3 colB; attribute float alea;
    uniform float uMix, uTemps, uTaille, uIntro, uAgite; uniform vec3 uSouris; varying vec3 vCol; varying float vProf;
    void main() {
      float m = smoothstep(0.0, 1.0, clamp((uMix - alea * 0.4) / 0.6, 0.0, 1.0));      // chaque goutte part à son tour
      vec3 p = mix(position, posB, m);
      p += sin(3.14159 * m) * 1.1 * vec3(sin(alea * 91.7 + uTemps * 0.6), cos(alea * 47.3 + uTemps * 0.5), sin(alea * 23.1 - uTemps * 0.4));
      p += 0.022 * vec3(sin(uTemps * 0.8 + alea * 40.0), cos(uTemps * 0.7 + alea * 60.0), sin(uTemps * 0.9 + alea * 80.0));
      // ouverture : chaque goutte arrive de loin, en spirale, et rejoint sa place
      vec3 loin = normalize(vec3(sin(alea * 311.7), cos(alea * 127.1), sin(alea * 74.7)) + 0.001) * (6.0 + alea * 12.0);
      float e = 1.0 - pow(1.0 - clamp((uIntro - alea * 0.4) / 0.6, 0.0, 1.0), 4.0);
      float tour = (1.0 - e) * 3.2;
      p = mix(vec3(loin.x * cos(tour) - loin.y * sin(tour), loin.x * sin(tour) + loin.y * cos(tour), loin.z), p, e);
      // la souris repousse l'encre ; le défilement rapide l'agite
      vec2 ecart = p.xy - uSouris.xy;
      p.xy += normalize(ecart + 0.0001) * exp(-dot(ecart, ecart) * 2.4) * 0.6;
      p += uAgite * 0.3 * vec3(sin(alea * 50.0 + uTemps * 3.0), cos(alea * 70.0 + uTemps * 2.6), sin(alea * 30.0 + uTemps * 2.2));
      vCol = mix(colA, colB, m);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vProf = -mv.z;
      gl_PointSize = uTaille * (0.45 + alea * 1.1) / -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uPapier; varying vec3 vCol; varying float vProf;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float dilution = clamp((vProf - 9.0) / 7.0, 0.0, 0.7);                           // au loin, l'encre se dilue dans le papier
      gl_FragColor = vec4(mix(vCol, uPapier, dilution), (1.0 - smoothstep(0.32, 0.5, d)) * 0.92);
    }`,
});
const geometrie = new THREE.BufferGeometry();
const tampons = { position: new Float32Array(N * 3), posB: new Float32Array(N * 3), colA: new Float32Array(N * 3), colB: new Float32Array(N * 3) };
Object.entries(tampons).forEach(([nom, t]) => geometrie.setAttribute(nom, new THREE.BufferAttribute(t, 3)));
geometrie.setAttribute("alea", new THREE.BufferAttribute(Float32Array.from({ length: N }, (_, i) => h(i, 7)), 1));
geometrie.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 12);
const nuage = new THREE.Points(geometrie, materiau);
scene.add(nuage);

function calculer(forme) {                           // positions et couleurs d'une forme pour les N gouttes
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { const v = forme(i); pos.set(v.slice(0, 3), i * 3); col.set(v.slice(3), i * 3); }
  return { pos, col };
}
let formes = [], paire = -1;
function poserPaire(k) {
  if (k === paire) return;
  paire = k;
  tampons.position.set(formes[k].pos); tampons.colA.set(formes[k].col);
  tampons.posB.set(formes[k + 1].pos); tampons.colB.set(formes[k + 1].col);
  Object.keys(tampons).forEach((nom) => { geometrie.attributes[nom].needsUpdate = true; });
}

/* ---------- Interface : chapitres, fil, soleil ---------- */
const chapitres = [...document.querySelectorAll(".chapitre")], boutons = [...document.querySelectorAll("#fil button")];
const soleil = document.getElementById("soleil"), compteur = document.getElementById("compteur"), nom = document.getElementById("nom-chapitre"), curseur = document.getElementById("curseur");
// position du soleil par chapitre : [centre x, centre y, diamètre], en fraction de la largeur, de la hauteur et de la hauteur
const SOLEILS = [[0.66, 0.5, 0.62], [0.84, 0.25, 0.24], [0.5, 1.12, 0.9], [0.66, 0.66, 0.34], [0.66, 0.56, 0.3], [0.735, 0.2, 0.16], [0.66, 0.5, 0.46], [0.66, 0.5, 0.78]];
const VITESSES = [0.05, 0.0, 0.1, 0.16, 0.0, 0.08, 0.5, 0.22];           // rotation propre de chaque forme
const INCLINAISONS = [0, 0.1, 0.3, 0.5, 0, 0.15, 0.1, 0.2];
const SIGNES = "一二三四五六七八九十日経平均株価";
const GRANDS_SIGNES = ["序", "数", "分", "学", "兆", "断", "転", "入"];        // prologue, nombres, partage, apprendre, signe, verdict, retournement, entrer
const signe = document.getElementById("signe");
let actif = 0;
function activer(i) {
  if (i === actif) return;
  actif = i;
  chapitres.forEach((c, k) => c.classList.toggle("actif", k === i));
  boutons.forEach((b, k) => b.classList.toggle("actif", k === i));
  compteur.textContent = String(i + 1).padStart(2, "0");
  nom.textContent = window.PROJET.noms[i];
  signe.classList.remove("visible");
  setTimeout(() => { signe.textContent = GRANDS_SIGNES[i]; signe.classList.add("visible"); }, 260);
  const titre = chapitres[i].querySelector("h2"), texte = titre.dataset.texte, debut = performance.now();
  if (IMMOBILE) return;
  const pas = (t) => {                               // le titre se « révèle » à travers des signes japonais
    const u = Math.min(1, (t - debut) / 650), fixes = Math.floor(u * texte.length);
    titre.textContent = texte.slice(0, fixes) + [...texte.slice(fixes, fixes + 6)].map((c) => (c === " " ? " " : SIGNES[Math.floor(Math.random() * SIGNES.length)])).join("");
    if (u < 1 && actif === i) requestAnimationFrame(pas); else titre.textContent = texte;
  };
  requestAnimationFrame(pas);
}
const aller = (i) => scrollTo({ top: Math.max(0, Math.min(K - 1, i)) * innerHeight, behavior: IMMOBILE ? "auto" : "smooth" });
boutons.forEach((b) => b.addEventListener("click", () => aller(+b.dataset.aller)));
addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); aller(actif + 1); }
  if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); aller(actif - 1); }
});
const souris = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { souris.x = e.clientX / innerWidth - 0.5; souris.y = e.clientY / innerHeight - 0.5; });

/* ---------- Boucle ---------- */
let lisse = 0, angle = 0, avant = performance.now(), sx = 0, sy = 0, largeur = 0, hauteur = 0, debutIntro = IMMOBILE ? -1e9 : 0, agite = 0;
const rayon = new THREE.Vector3(), impact = new THREE.Vector3();
function image(maintenant) {
  const dt = Math.min(0.05, (maintenant - avant) / 1000); avant = maintenant;
  const l = cadre.clientWidth, ht = cadre.clientHeight;
  if (l !== largeur || ht !== hauteur) {
    largeur = l; hauteur = ht;
    rendu.setSize(l, ht, false); camera.aspect = l / ht; camera.updateProjectionMatrix();
    materiau.uniforms.uTaille.value = 0.062 * ht * rendu.getPixelRatio();
  }
  const cible = Math.max(0, Math.min(K - 1, scrollY / innerHeight));
  lisse += (cible - lisse) * (IMMOBILE ? 1 : 0.085);
  const k = Math.min(K - 2, Math.floor(lisse)), m = lisse - k;
  poserPaire(k);
  materiau.uniforms.uMix.value = m;
  materiau.uniforms.uTemps.value = maintenant / 1000;
  activer(Math.round(lisse));

  const large = l / ht > 1.1, pond = (t) => t[k] + (t[k + 1] - t[k]) * m;
  angle += dt * pond(VITESSES) * (IMMOBILE ? 0 : 1);
  sx += (souris.x - sx) * 0.05; sy += (souris.y - sy) * 0.05;
  nuage.position.set(large ? 1.75 : 0, large ? 0 : 1.1, 0);
  nuage.rotation.set(pond(INCLINAISONS) + sy * 0.25, angle + sx * 0.5, 0);
  nuage.scale.setScalar(large ? 1 : 0.62);
  camera.position.set(0, 0, 9.4); camera.lookAt(0, 0, 0);

  // ouverture, agitation, et position de la souris dans le repère du nuage (plan z = 0)
  const intro = debutIntro ? Math.min(1, (maintenant - debutIntro) / 3000) : 0;
  materiau.uniforms.uIntro.value = intro;
  agite += (Math.min(1, Math.abs(cible - lisse) * 1.6) - agite) * 0.12;
  materiau.uniforms.uAgite.value = agite;
  camera.updateMatrixWorld(); nuage.updateMatrixWorld();
  rayon.set(souris.x * 2, -souris.y * 2, 0.5).unproject(camera).sub(camera.position).normalize();
  impact.copy(camera.position).addScaledVector(rayon, -camera.position.z / rayon.z);
  materiau.uniforms.uSouris.value.copy(nuage.worldToLocal(impact));

  const [cx, cy, d] = [0, 1, 2].map((j) => SOLEILS[k][j] + (SOLEILS[k + 1][j] - SOLEILS[k][j]) * (m * m * (3 - 2 * m)));
  const x = (large ? cx : 0.5) * l + sx * -30, y = (large ? cy : cy * 0.6) * ht + sy * -30;
  const lever = intro < 1 ? Math.max(0, 1 + 2.7 * Math.pow(intro - 1, 3) + 1.7 * Math.pow(intro - 1, 2)) : 1;      // le soleil se lève avec un léger rebond
  const ds = Math.max(0.0001, d * lever);
  soleil.style.transform = `translate(${x}px, ${y}px) rotate(${maintenant * 0.004}deg) scale(${ds}) translate(-50%, -50%)`;
  signe.style.transform = `translate(${sx * 60}px, ${sy * 40}px)`;
  curseur.style.top = `${(lisse / (K - 1)) * (90 - 18)}px`;

  rendu.render(scene, camera);
  requestAnimationFrame(image);
}

/* ---------- Démarrage : les formes qui dépendent des données attendent l'API ---------- */
const [serie, cout] = await Promise.all([api("serie"), api("surface")]);
const P = window.PROJET;
formes = [enso, serie ? relief(serie) : sphere, blocs, cout ? surface(cout) : sphere, jauge(P.p, P.seuils), verdict(P.regle, P.achat), helice, sphere].map(calculer);
if (!serie) document.getElementById("etat").textContent = document.documentElement.lang === "en" ? "Python API stopped: fallback shapes" : "API Python arrêtée : formes de secours";
requestAnimationFrame(image);

/* ---------- Ouverture : compteur, puis l'écran d'encre s'ouvre depuis le soleil et les gouttes se rassemblent ---------- */
const ecran = document.getElementById("intro");
if (IMMOBILE) { document.body.classList.add("pret"); signe.classList.add("visible"); }
else {
  const t0 = performance.now(), nombre = document.getElementById("intro-nombre"), trait = document.getElementById("intro-trait");
  const compter = (t) => {
    const u = Math.min(1, (t - t0) / 1500), v = 1 - Math.pow(1 - u, 3);
    nombre.textContent = String(Math.round(v * 100)).padStart(3, "0");
    trait.style.width = `${v * 100}%`;
    if (u < 1) return requestAnimationFrame(compter);
    debutIntro = performance.now();
    ecran.classList.add("ouvre");
    document.body.classList.add("pret");
    signe.classList.add("visible");
  };
  requestAnimationFrame(compter);
}
