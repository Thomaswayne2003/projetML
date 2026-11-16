/* Projet Nikkei — la transition 3D du mode présentation.
   Entre deux diapositives, 60 000 gouttes d'encre arrivent en spirale de tout l'écran, se rassemblent pour former le
   signe du chapitre, tiennent un instant, puis éclatent vers la caméra et découvrent la diapositive suivante.
   Le contenu des diapositives n'est jamais animé de cette façon : la scène ne vit que pendant le passage. */
import * as THREE from "./three.module.min.js";

const N = 60000, DUREE = 1700;
const boite = Object.assign(document.createElement("div"), { id: "passage3d", innerHTML: '<i></i><canvas></canvas><span></span>' });
document.body.append(boite);
const fond = boite.querySelector("i"), toile = boite.querySelector("canvas"), etiquette = boite.querySelector("span");
const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: false, alpha: true });
rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 2, 0.1, 100);
camera.position.set(0, 0, 9);
const hasard = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

const geometrie = new THREE.BufferGeometry();
const depart = new Float32Array(N * 3), cible = new Float32Array(N * 3), alea = new Float32Array(N);
for (let i = 0; i < N; i++) {                         // départ : un grand anneau qui déborde de l'écran
  const a = hasard(i, 1) * 6.2832, r = 4.5 + hasard(i, 2) * 8;
  depart.set([Math.cos(a) * r * 1.5, Math.sin(a) * r, (hasard(i, 3) - 0.5) * 9], i * 3);
  alea[i] = hasard(i, 4);
}
geometrie.setAttribute("position", new THREE.BufferAttribute(depart, 3));
geometrie.setAttribute("cible", new THREE.BufferAttribute(cible, 3));
geometrie.setAttribute("alea", new THREE.BufferAttribute(alea, 1));
geometrie.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40);
const materiau = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, depthTest: false,
  uniforms: { uT: { value: 0 }, uTaille: { value: 30 } },
  vertexShader: `
    attribute vec3 cible; attribute float alea; uniform float uT, uTaille; varying float vAlpha, vRouge;
    void main() {
      float a = clamp((uT - alea * 0.10) / 0.36, 0.0, 1.0); a = 1.0 - pow(1.0 - a, 3.0);          // les gouttes convergent
      float b = clamp((uT - 0.58 - alea * 0.08) / 0.34, 0.0, 1.0); b = b * b;                    // puis elles éclatent
      float tour = (1.0 - a) * (3.5 + alea * 3.0), c = cos(tour), s = sin(tour);
      vec3 d = position; d.xy = mat2(c, -s, s, c) * d.xy;                                        // arrivée en spirale
      vec3 p = mix(d, cible, a);
      p.xy += 0.025 * vec2(sin(uT * 38.0 + alea * 50.0), cos(uT * 33.0 + alea * 70.0)) * a * (1.0 - b);
      vec3 dir = normalize(vec3(cible.xy * 1.3 + (vec2(fract(alea * 17.3), fract(alea * 91.7)) - 0.5) * 2.2, 0.9 + alea * 1.4));
      p += dir * b * (5.0 + alea * 11.0);                                                        // vers l'extérieur et vers la caméra
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_PointSize = uTaille * (0.45 + alea * 0.9) / max(0.4, -mv.z) * (1.0 + b * 2.5);
      gl_Position = projectionMatrix * mv;
      vAlpha = (0.2 + 0.8 * a) * (1.0 - b * b);
      vRouge = step(0.88, fract(alea * 7.77));
    }`,
  fragmentShader: `
    varying float vAlpha, vRouge;
    void main() {
      float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      vec3 teinte = mix(vec3(0.945, 0.918, 0.859), vec3(0.87, 0.2, 0.12), vRouge);
      gl_FragColor = vec4(teinte, (1.0 - smoothstep(0.25, 0.5, d)) * vAlpha);
    }`,
});
scene.add(new THREE.Points(geometrie, materiau));

// Le signe est tracé sur une toile 2D, puis ses pixels pleins deviennent les places d'arrivée des gouttes
const calque = document.createElement("canvas"), crayon = calque.getContext("2d", { willReadFrequently: true });
function viser(texte) {
  const cote = 360, large = cote * Math.max(1, texte.length);
  calque.width = large; calque.height = cote;
  crayon.clearRect(0, 0, large, cote);
  crayon.fillStyle = "#000"; crayon.textAlign = "center"; crayon.textBaseline = "middle";
  crayon.font = `500 ${cote * 0.86}px "Hiragino Mincho ProN", "Yu Mincho", "Songti SC", serif`;
  crayon.fillText(texte, large / 2, cote * 0.52);
  const pixels = crayon.getImageData(0, 0, large, cote).data, pleins = [];
  for (let y = 0; y < cote; y += 2) for (let x = 0; x < large; x += 2) if (pixels[(y * large + x) * 4 + 3] > 120) pleins.push(x, y);
  const hauteur = texte.length > 1 ? 3.6 : 5.0, n = pleins.length / 2;
  for (let i = 0; i < N; i++) {
    const k = n ? Math.floor(hasard(i, 5) * n) * 2 : 0;
    const x = n ? pleins[k] + hasard(i, 6) * 2 : large / 2, y = n ? pleins[k + 1] + hasard(i, 7) * 2 : cote / 2;
    cible.set([(x - large / 2) / cote * hauteur, (cote / 2 - y) / cote * hauteur, (hasard(i, 8) - 0.5) * 0.25], i * 3);
  }
  geometrie.attributes.cible.needsUpdate = true;
}

let enCours = false;
const lisse = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Joue la transition. `auMilieu` est appelé quand l'écran est entièrement couvert : c'est le moment de changer de diapositive.
    `couvert` : l'écran est déjà noir au départ (ouverture du site). */
export function passer(texte, libelle, auMilieu, couvert = false) {
  if (enCours) return false;
  enCours = true;
  viser(texte);
  etiquette.textContent = libelle;
  boite.classList.add("actif");
  rendu.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  materiau.uniforms.uTaille.value = 0.03 * innerHeight * rendu.getPixelRatio();
  camera.position.z = innerWidth / innerHeight < 1.1 ? 15 : 9;
  fond.style.opacity = couvert ? 1 : 0;
  const debut = performance.now();
  const image = (maintenant) => {
    if (!enCours) return;
    const t = Math.min(1, (maintenant - debut) / DUREE);
    materiau.uniforms.uT.value = t;
    fond.style.opacity = ((couvert ? 1 : lisse(0, 0.2, t)) * (1 - lisse(0.62, 0.92, t))).toFixed(3);
    etiquette.style.opacity = (lisse(0.24, 0.4, t) * (1 - lisse(0.56, 0.68, t))).toFixed(3);
    camera.position.x = Math.sin(t * 3.1416) * 0.5;                    // léger travelling pendant le passage
    camera.lookAt(0, 0, 0);
    rendu.render(scene, camera);
    requestAnimationFrame(image);
  };
  requestAnimationFrame(image);
  // Le changement de diapositive et la fin ne dépendent pas des images : ils arrivent même si l'onglet est en arrière-plan
  setTimeout(auMilieu, DUREE * 0.5);
  setTimeout(() => { enCours = false; boite.classList.remove("actif"); fond.style.opacity = 0; etiquette.style.opacity = 0; }, DUREE + 40);
  return true;
}
