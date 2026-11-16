/* Projet Nikkei — l'accueil : un monde en 3D que la caméra traverse au fil du défilement.
   Neuf scènes posées sur une table laquée, éclairées par une lumière rasante qui projette des ombres :
     0. un cercle d'encre et le soleil qui se lève            5. deux tours : acheter et garder, ou suivre le modèle
     1. les 201 mois, une barre par mois                       6. la courbe du Nikkei, qui pivote en 2022
     2. les mêmes barres s'envolent et se rangent en 3 blocs   7. l'agitation du marché, mois par mois, et celle annoncée
     3. la surface de coût, une bille descend vers le fond     8. un torii, la porte d'entrée du récit
     4. la jauge du signal et son aiguille
   Les scènes sont construites à partir des données réelles (API /serie, /surface et /volatilite, chiffres de la page).
   Le rendu se fait en plusieurs passes : le monde renversé pour les reflets du sol, le monde lui-même, sa profondeur pour
   la mise au point, le halo des reflets vifs, puis une finition (flou de profondeur, filé de vitesse, vignette, grain).
   Entre deux scènes, un nuage de gouttes d'encre quitte la surface des objets et va dessiner les suivants. */
import * as THREE from "./three.module.min.js";

const P = window.PROJET, K = P.noms.length, PAS = 44;      // PAS : distance entre deux scènes, assez grande pour que la brume cache les voisines
const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const api = (route) => fetch("/api.php?" + new URLSearchParams({ route })).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const C = { papier: 0xf1eadb, encre: 0x15110e, vermillon: 0xde3220, indigo: 0x26407c, gris: 0xb3a898 };
const borne = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const doux = (x) => { const t = borne(x); return t * t * (3 - 2 * t); };
const rebond = (x) => { const t = borne(x), c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const fr = (v, d = 0) => Number(v).toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace("-", "−").replace(/ /g, " ");
const hasard = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };

/* ---------- Rendu, lumière, sol ---------- */
const toile = document.getElementById("toile"), cadre = toile.parentElement;
const rendu = new THREE.WebGLRenderer({ canvas: toile, antialias: true });
rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
rendu.shadowMap.enabled = true; rendu.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const fondPapier = new THREE.Color(C.papier);
scene.background = fondPapier;
scene.fog = new THREE.Fog(C.papier, 24, 54);
const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 400);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8ccb4, 1.4));
const lumiere = new THREE.DirectionalLight(0xfff1dc, 2.2);
lumiere.castShadow = true; lumiere.shadow.mapSize.set(2048, 2048); lumiere.shadow.bias = -0.0005;
Object.assign(lumiere.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 90 });
scene.add(lumiere, lumiere.target);
// Un décor invisible sert d'environnement : les objets laqués y reflètent un ciel de papier, deux panneaux de lumière
// et une paroi vermillon. C'est ce qui donne aux volumes leurs reflets au lieu d'un aplat de couleur.
const decor = new THREE.Scene();
decor.add(new THREE.Mesh(new THREE.BoxGeometry(80, 80, 80), new THREE.MeshBasicMaterial({ color: 0x241f1a, side: THREE.BackSide })));      // une pièce sombre : seuls les panneaux se reflètent
const panneau = (couleur, force, l, h, x, y, z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(force), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); decor.add(m); };
panneau(0xffffff, 7, 26, 9, 4, 34, 10); panneau(0xfff0d8, 4, 9, 26, 34, 10, 16); panneau(C.vermillon, 1.4, 16, 16, -36, 8, -12);
scene.environment = new THREE.PMREMGenerator(rendu).fromScene(decor, 0.035).texture;
const matiere = (couleur, plus = {}) => new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.62, metalness: 0.04, envMapIntensity: 0.45, ...plus });
const laque = (couleur, plus = {}) => new THREE.MeshPhysicalMaterial({ color: couleur, roughness: 0.24, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.09, envMapIntensity: 1.0, ...plus });
const pose = (objet, x, y, z, ombre = true) => { objet.position.set(x, y, z); objet.castShadow = ombre; objet.receiveShadow = true; return objet; };
// Le sol est une table laquée : il reçoit les ombres et renvoie l'image du monde renversé, rendue à part (voir la boucle)
const HORS_REFLET = 1, MOTS = 2;                             // calques : ce qui ne se reflète pas (fils, gouttes), et les mots, dessinés nets par-dessus l'image finie
camera.layers.enable(HORS_REFLET);
const miroir = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const uSol = { tMiroir: { value: miroir.texture }, uEcran: { value: new THREE.Vector2(1, 1) }, uReflet: { value: 0.34 } };
const matiereSol = matiere(0xe7dfcf, { roughness: 1, envMapIntensity: 0.18 });
matiereSol.onBeforeCompile = (programme) => {
  Object.assign(programme.uniforms, uSol);
  programme.fragmentShader = "uniform sampler2D tMiroir; uniform vec2 uEcran; uniform float uReflet;\n" + programme.fragmentShader.replace("#include <opaque_fragment>", `
    vec2 ecran = gl_FragCoord.xy / uEcran; vec3 reflet = vec3(0.0);
    for (int i = 0; i < 9; i++) { float a = float(i) * 2.39996; reflet += texture2D(tMiroir, ecran + vec2(cos(a), sin(a)) * sqrt(float(i) / 9.0) * 0.005).rgb; }
    float rasant = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);      // le reflet se renforce quand le regard rase la table
    outgoingLight = mix(outgoingLight, reflet / 9.0, uReflet * (0.4 + 0.6 * rasant));
    #include <opaque_fragment>`);
};
const sol = new THREE.Mesh(new THREE.PlaneGeometry(900, 320), matiereSol);
sol.rotation.x = -Math.PI / 2; sol.position.set((K - 1) * PAS / 2, 0, 0); sol.receiveShadow = true; scene.add(sol);

function etiquette(texte, taille = 0.5, couleur = "#15110e") {           // un mot écrit dans l'espace, toujours face à la caméra
  const c = document.createElement("canvas"), g = c.getContext("2d"), police = '500 60px "SF Mono", ui-monospace, Menlo, monospace';
  g.font = police; c.width = Math.ceil(g.measureText(texte).width) + 40; c.height = 96;
  g.font = police; g.fillStyle = couleur; g.textBaseline = "middle"; g.fillText(texte, 20, 50);
  const image = new THREE.CanvasTexture(c); image.colorSpace = THREE.SRGBColorSpace;
  const mot = new THREE.Sprite(new THREE.SpriteMaterial({ map: image, transparent: true, depthWrite: false }));
  mot.scale.set(taille * c.width / 96, taille, 1); mot.layers.set(MOTS);
  return mot;
}
const tampon = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
// Profondeur : le monde est rendu une seconde fois, en petit, avec une matière qui n'écrit que la distance à la caméra
const profondeur = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), LOIN = 120;
const matiereProfondeur = new THREE.ShaderMaterial({ side: THREE.DoubleSide,
  vertexShader: `varying float vZ;
    void main() {
      #include <begin_vertex>
      #include <project_vertex>
      vZ = -mvPosition.z;
    }`,
  fragmentShader: `varying float vZ; void main() { gl_FragColor = vec4(vZ / ${LOIN}.0, 0.0, 0.0, 1.0); }` });
// Halo : seuls les reflets plus clairs que le papier (au-dessus de 1 en lumière linéaire) débordent autour d'eux
const eclatA = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), eclatB = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
const PLEIN_ECRAN = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const matiereEclat = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: PLEIN_ECRAN, uniforms: { tSource: { value: null }, uPas: { value: new THREE.Vector2() }, uSeuil: { value: 0 } },
  fragmentShader: `uniform sampler2D tSource; uniform vec2 uPas; uniform float uSeuil; varying vec2 vUv;
    void main() {
      vec3 c = vec3(0.0); float poids[5]; poids[0] = 0.227; poids[1] = 0.194; poids[2] = 0.122; poids[3] = 0.054; poids[4] = 0.016;
      for (int i = -4; i <= 4; i++) { vec3 t = texture2D(tSource, vUv + float(i) * uPas).rgb; c += max(t - uSeuil, 0.0) * poids[i < 0 ? -i : i]; }
      gl_FragColor = vec4(c, 1.0);
    }` });
const finition = new THREE.ShaderMaterial({
  depthTest: false, depthWrite: false, vertexShader: PLEIN_ECRAN,
  uniforms: { tScene: { value: tampon.texture }, tProfondeur: { value: profondeur.texture }, tEclat: { value: eclatA.texture }, uPixel: { value: new THREE.Vector2(1, 1) },
    uFlou: { value: 9 }, uNet: { value: 20 }, uVitesse: { value: 0 }, uTemps: { value: 0 }, uEclat: { value: 0.85 } },
  fragmentShader: `
    uniform sampler2D tScene, tProfondeur, tEclat; uniform vec2 uPixel; uniform float uFlou, uNet, uVitesse, uTemps, uEclat; varying vec2 vUv;
    float alea(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    // rayon du flou, en pixels, pour un point à la distance z : nul autour de la distance de mise au point, croissant devant et derrière
    float cercle(float z) { return smoothstep(0.16, 0.95, abs(z - uNet) / uNet) * uFlou; }
    void main() {
      vec2 d = vUv - 0.5;
      float rayon = cercle(texture2D(tProfondeur, vUv).r * ${LOIN}.0) + uVitesse * 3.0;
      vec3 c = texture2D(tScene, vUv).rgb; float total = 1.0;
      if (rayon > 0.6) for (int i = 0; i < 18; i++) {
        float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 18.0) * rayon; vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uPixel;
        // un voisin net ne bave pas sur un fond flou : il ne compte que si son propre flou atteint ce pixel
        float poids = clamp(cercle(texture2D(tProfondeur, uv).r * ${LOIN}.0) + uVitesse * 3.0 - r + 1.5, 0.0, 1.0);
        c += texture2D(tScene, uv).rgb * poids; total += poids;
      }
      c /= total;
      // filé horizontal quand la caméra vole d'une scène à l'autre
      if (uVitesse > 0.02) { vec3 f = vec3(0.0); for (int i = -4; i <= 4; i++) f += texture2D(tScene, vUv + vec2(float(i) * uVitesse * 7.0 * uPixel.x, 0.0)).rgb; c = mix(c, f / 9.0, min(0.75, uVitesse * 1.6)); }
      // les couleurs se séparent légèrement sur les bords, davantage en mouvement
      float ecart = (0.5 + uVitesse * 6.0) * dot(d, d) * 0.012;
      c.r = mix(c.r, texture2D(tScene, vUv + d * ecart).r, 0.75); c.b = mix(c.b, texture2D(tScene, vUv - d * ecart).b, 0.75);
      c += texture2D(tEclat, vUv).rgb * uEclat;                                                  // halo des reflets vifs
      c *= 1.0 - 0.34 * smoothstep(0.38, 1.0, length(d) * 1.3);                                  // vignette
      c += (alea(vUv * 870.0 + fract(uTemps)) - 0.5) * 0.03;                                     // grain du papier
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
});
const ecranFinal = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), finition); ecranFinal.frustumCulled = false;
const sceneFinale = new THREE.Scene(); sceneFinale.add(ecranFinal);
const stations = Array.from({ length: K }, (_, k) => { const g = new THREE.Group(); g.position.x = k * PAS; scene.add(g); return g; });

/* ---------- 0. Ouverture : le soleil et le cercle d'encre ---------- */
const soleil = new THREE.Mesh(new THREE.SphereGeometry(5.2, 48, 32), new THREE.MeshBasicMaterial({ color: C.vermillon, fog: false }));
soleil.position.set(3.5, 6.2, -15); stations[0].add(soleil);
const enso = pose(new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.3, 28, 220, 5.5), laque(C.encre)), 0, 4.1, 0);
enso.rotation.z = 0.95; stations[0].add(enso);
const NB_GOUTTES = 44, gouttes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 20, 14), laque(C.encre), NB_GOUTTES);
gouttes.castShadow = true; stations[0].add(gouttes);

/* ---------- 3D commune aux scènes de données : attend l'API ---------- */
const [serie, cout, volatilite] = await Promise.all([api("serie"), api("surface"), api("volatilite")]);
// Pour chaque scène, une fonction qui tire au hasard un point à la surface de ses objets : [x, y, z, couleur], dans le repère de la scène.
// Elles servent au nuage de gouttes qui voyage d'une scène à la suivante.
const surLes = [];
const tirage = (i, s) => hasard(i * 1.618 + 0.37, s);
const dansBoite = (i, cx, cy, cz, lx, ly, lz, couleur) => [cx + (tirage(i, 21) - 0.5) * lx, cy + (tirage(i, 22) - 0.5) * ly, cz + (tirage(i, 23) - 0.5) * lz, couleur];
surLes[0] = (i) => {
  if (tirage(i, 11) < 0.3) { const a = tirage(i, 12) * 6.283, h = tirage(i, 13) * 2 - 1, r = Math.sqrt(1 - h * h) * 5.2; return [3.5 + Math.cos(a) * r, 6.2 + h * 5.2, -15 + Math.sin(a) * r, C.vermillon]; }
  const u = tirage(i, 12) * 5.5 + 0.95, v = tirage(i, 13) * 6.283, r = 3.1 + 0.3 * Math.cos(v);
  return [Math.cos(u) * r, 4.1 + Math.sin(u) * r, 0.3 * Math.sin(v), C.encre];
};
const repere = new THREE.Object3D();
let barres = null, placesA = [], placesB = [];
if (serie) {
  const n = serie.length, logs = serie.map((m) => Math.log(m.cloture)), min = Math.min(...logs), max = Math.max(...logs), norme = (j) => (logs[j] - min) / (max - min);

  /* ---------- 1 et 2. Une barre par mois, puis les trois blocs ---------- */
  const boite = new THREE.BoxGeometry(1, 1, 1); boite.translate(0, 0.5, 0);
  barres = new THREE.InstancedMesh(boite, new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 0.8 }), n);
  barres.castShadow = true; barres.receiveShadow = true; barres.frustumCulled = false; scene.add(barres);
  const teinte = new THREE.Color();
  const blocs = ["entraînement", "validation", "test", "à prédire"], rangs = [11, 6, 6, 1], q = 0.62, compte = [0, 0, 0, 0];
  const tailles = blocs.map((b) => serie.filter((m) => m.bloc === b).length), colonnes = tailles.map((t, b) => Math.ceil(t / rangs[b]));
  const ecarts = [1.7, 1.7, 1.3, 0], large = colonnes.reduce((a, c, b) => a + c * q + ecarts[b], 0), departs = [];
  colonnes.reduce((x, c, b) => { departs[b] = x; return x + c * q + ecarts[b]; }, 2 * PAS - large / 2);
  serie.forEach((m, j) => {
    barres.setColorAt(j, teinte.setHex(m.baisse === null ? C.encre : m.baisse ? C.vermillon : C.indigo));
    placesA.push([PAS + (j / (n - 1) - 0.5) * 22, 0, 0, 0.088, 0.5 + norme(j) * 6.2, 1.5]);
    const b = blocs.indexOf(m.bloc), k = compte[b]++;
    placesB.push([departs[b] + (Math.floor(k / rangs[b]) + 0.5) * q, 0, (k % rangs[b] - (rangs[b] - 1) / 2) * q, 0.46, 0.35 + norme(j) * 3.4, 0.46]);
  });
  barres.instanceColor.needsUpdate = true;
  const surBarres = (places, decalage) => (i) => { const j = Math.floor(tirage(i, 11) * n), a = places[j];
    return [a[0] - decalage + (tirage(i, 12) - 0.5) * a[3], tirage(i, 13) * a[4], a[2] + (tirage(i, 14) - 0.5) * a[5], serie[j].baisse === null ? C.encre : serie[j].baisse ? C.vermillon : C.indigo]; };
  surLes[1] = surBarres(placesA, PAS); surLes[2] = surBarres(placesB, 2 * PAS);
  const mot1 = etiquette(`févr. 2010 · ${fr(serie[0].cloture)}`, 0.7), mot2 = etiquette(`oct. 2026 · ${fr(serie[n - 1].cloture)}`, 0.7);
  mot1.position.set(-9.6, 2.6, 1.2); mot2.position.set(8.2, 8, 0); stations[1].add(mot1, mot2);
  ["entraînement · 143 mois", "validation · 24", "test · 33"].forEach((texte, b) => {
    const mot = etiquette(texte, 0.62); mot.position.set(departs[b] - 2 * PAS + colonnes[b] * q / 2, 5.6, -2.5 + b * 0.2); stations[2].add(mot);
  });

  /* ---------- 6. Régime : la courbe du Nikkei, articulée en janvier 2022 ---------- */
  const coupe = serie.findIndex((m) => m.mois === "2022-01"), pt = (j) => new THREE.Vector3((j / (n - 1) - 0.5) * 20, 0.7 + norme(j) * 5.6, 0), charniere = pt(coupe);
  const tube = (points, couleur) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), points.length * 3, 0.16, 14), laque(couleur)); t.castShadow = true; return t; };
  stations[6].add(tube(serie.slice(0, coupe + 1).map((_, j) => pt(j)), C.encre));
  repere.position.copy(charniere);
  repere.add(tube(serie.slice(coupe).map((_, j) => pt(coupe + j).sub(charniere)), C.vermillon));
  stations[6].add(repere);
  stations[6].add(pose(new THREE.Mesh(new THREE.BoxGeometry(0.07, 7.4, 4.6), matiere(C.encre, { transparent: true, opacity: 0.14 })), charniere.x, 3.7, 0, false));
  const mot6 = etiquette("janvier 2022", 0.6); mot6.position.set(charniere.x, 7.9, 0); stations[6].add(mot6);
  surLes[6] = (i) => { const j = Math.floor(tirage(i, 11) * n), q = pt(j), a = tirage(i, 12) * 6.283;
    q.y += Math.cos(a) * 0.16; q.z += Math.sin(a) * 0.16;
    if (j > coupe) q.sub(charniere).applyAxisAngle(new THREE.Vector3(0, 1, 0), -1.25).add(charniere);
    return [q.x, q.y, q.z, j > coupe ? C.vermillon : C.encre]; };
}

/* ---------- 3. Apprentissage : la surface de coût et la bille ---------- */
let bille = null, trace = null, chemin = [], longueurs = [];
if (cout) {
  const n = cout.axe.length, lim = cout.axe[n - 1], s = 4.6 / lim, Jmin = cout.optimum[2], Jmax = Math.max(...cout.cout.flat()), H = (J) => 0.7 + ((J - Jmin) / (Jmax - Jmin)) * 4.4;
  const nappe = new THREE.PlaneGeometry(9.2, 9.2, n - 1, n - 1); nappe.rotateX(-Math.PI / 2);
  const places = nappe.attributes.position, couleurs = new Float32Array(places.count * 3), a = new THREE.Color(C.indigo), b = new THREE.Color(0xd9c7b0), c = new THREE.Color(C.vermillon), t = new THREE.Color();
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
    const i = r * n + col, J = cout.cout[r][col], u = (J - Jmin) / (Jmax - Jmin);
    places.setY(i, H(J));
    (u < 0.45 ? t.copy(a).lerp(b, u / 0.45) : t.copy(b).lerp(c, (u - 0.45) / 0.55)).toArray(couleurs, i * 3);
  }
  nappe.setAttribute("color", new THREE.BufferAttribute(couleurs, 3)); nappe.computeVertexNormals();
  const surface = new THREE.Mesh(nappe, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }));
  surface.castShadow = true; surface.receiveShadow = true;
  const fils = new THREE.LineSegments(new THREE.WireframeGeometry(nappe), new THREE.LineBasicMaterial({ color: C.encre, transparent: true, opacity: 0.13 }));
  chemin = cout.trajectoires["classique (1/L)"].points.map((p) => new THREE.Vector3(p[0] * s, H(p[2]) + 0.24, p[1] * s));
  longueurs = chemin.reduce((acc, p, i) => [...acc, i ? acc[i - 1] + p.distanceTo(chemin[i - 1]) : 0], []);
  trace = new THREE.Line(new THREE.BufferGeometry().setFromPoints(chemin), new THREE.LineBasicMaterial({ color: C.encre }));
  bille = pose(new THREE.Mesh(new THREE.SphereGeometry(0.27, 36, 24), laque(C.encre, { roughness: 0.12 })), chemin[0].x, chemin[0].y, chemin[0].z);
  const fond = pose(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), new THREE.MeshBasicMaterial({ color: C.vermillon })), cout.optimum[0] * s, H(Jmin) + 0.08, cout.optimum[1] * s, false);
  const motA = etiquette("départ", 0.42), motB = etiquette("minimum", 0.42);
  motA.position.copy(chemin[0]).add(new THREE.Vector3(0, 0.9, 0)); motB.position.set(fond.position.x + 1.6, fond.position.y - 0.5, fond.position.z + 1.2);
  fils.layers.set(HORS_REFLET); trace.layers.set(HORS_REFLET);
  surLes[3] = (i) => { const r = Math.floor(tirage(i, 11) * n), col = Math.floor(tirage(i, 12) * n), J = cout.cout[r][col], u = (J - Jmin) / (Jmax - Jmin);
    const x = (col / (n - 1) - 0.5) * 9.2, z = (r / (n - 1) - 0.5) * 9.2, angle = 0.5;                  // la surface est tournée de 0,5 rad quand la scène est au repos
    return [x * Math.cos(angle) + z * Math.sin(angle), H(J), -x * Math.sin(angle) + z * Math.cos(angle), u < 0.3 ? C.indigo : u > 0.62 ? C.vermillon : C.gris]; };
  stations[3].add(surface, fils, trace, bille, fond, motA, motB);
}

/* ---------- 4. Signal : la jauge ---------- */
const tv = P.seuils.theta_v, ta = P.seuils.theta_a, jauge = new THREE.Group(); jauge.position.y = 0.5; stations[4].add(jauge);
[[0, tv, C.vermillon], [tv, ta, C.gris], [ta, 1, C.indigo]].forEach(([v1, v2, couleur]) => {
  const arc = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.4, 18, 72, Math.PI * (v2 - v1) - 0.02), laque(couleur, { roughness: 0.32 }));
  arc.rotation.z = Math.PI * (1 - v2) + 0.01; arc.castShadow = true; jauge.add(arc);
});
const tige = new THREE.BoxGeometry(3.7, 0.17, 0.17); tige.translate(1.85, 0, 0);
const aiguille = new THREE.Mesh(tige, laque(C.encre)); aiguille.castShadow = true; jauge.add(aiguille);
jauge.add(pose(new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 22), laque(C.encre)), 0, 0, 0));
[["vendre", -4.25, 3.75], ["neutre", 0, 5.45], ["acheter", 4.35, 3.75], [`${fr(100 * P.p, 1)} %`, -2.2, 1.5]].forEach(([texte, x, y], i) => {
  const mot = etiquette(texte, i === 3 ? 0.95 : 0.5); mot.position.set(x, y, i === 3 ? 0.8 : 0); jauge.add(mot);
});

surLes[4] = (i) => { const v = tirage(i, 11), a = tirage(i, 12) * 6.283, r = 4.3 + 0.4 * Math.cos(a);
  return [-Math.cos(Math.PI * v) * r, 0.5 + Math.sin(Math.PI * v) * r, 0.4 * Math.sin(a), v < tv ? C.vermillon : v < ta ? C.gris : C.indigo]; };

/* ---------- 5. Verdict : deux tours ---------- */
const socle = new THREE.BoxGeometry(2.5, 1, 2.5); socle.translate(0, 0.5, 0);
const tourAchat = pose(new THREE.Mesh(socle, laque(C.indigo, { roughness: 0.3 })), 2.3, 0, 0), tourRegle = pose(new THREE.Mesh(socle, laque(C.encre)), -2.3, 0, 0);
const motAchat = etiquette(`+${fr(100 * P.achat, 1)} % · acheter et garder`, 0.62, "#26407c"), motRegle = etiquette(`+${fr(100 * P.regle, 1)} % · règle du modèle`, 0.62);
stations[5].add(tourAchat, tourRegle, motAchat, motRegle);
surLes[5] = (i) => (tirage(i, 11) < 0.86 ? dansBoite(i, 2.3, 4.5 * P.achat, 0, 2.5, 9 * P.achat, 2.5, C.indigo) : dansBoite(i, -2.3, 4.5 * P.regle, 0, 2.5, 9 * P.regle, 2.5, C.encre));

/* ---------- 7. Risque : l'agitation de chaque mois, et celle que nous annoncions un mois plus tôt ---------- */
let lames = null, enveloppes = [], annonce = null, hautsLames = [];
if (volatilite) {
  const S = volatilite.serie, connus = S.filter((m) => m.reelle !== null), n = S.length, CENTRE = 4.4, ECHELLE = 6.1;
  const X = (j) => (j / (n - 1) - 0.5) * 17.5, lame = new THREE.BoxGeometry(1, 1, 1);
  lames = new THREE.InstancedMesh(lame, new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.9 }), connus.length);
  lames.castShadow = true; lames.receiveShadow = true; lames.frustumCulled = false;
  const teinteLame = new THREE.Color();
  connus.forEach((m, j) => { hautsLames.push([X(j), 2 * m.reelle * ECHELLE]); lames.setColorAt(j, teinteLame.setHex(m.agite ? C.vermillon : C.encre)); });
  lames.instanceColor.needsUpdate = true;
  [1, -1].forEach((sens) => {                             // deux fils indigo : la volatilité annoncée, au-dessus et au-dessous de l'axe
    const fil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(S.map((m, j) => new THREE.Vector3(X(j), CENTRE + sens * m.prevue * ECHELLE, 0.55))), n * 4, 0.075, 10), laque(C.indigo, { roughness: 0.2 }));
    fil.castShadow = true; enveloppes.push(fil);
  });
  annonce = pose(new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 22), laque(C.indigo, { roughness: 0.15 })), X(n - 1), CENTRE + S[n - 1].prevue * ECHELLE, 0.55);
  const axe = pose(new THREE.Mesh(new THREE.BoxGeometry(18.1, 0.035, 0.035), matiere(C.encre)), 0, CENTRE, 0, false);
  const pic = connus.reduce((a, m, j) => (m.reelle > connus[a].reelle ? j : a), 0), moisPic = new Date(connus[pic].mois + "-15"); moisPic.setMonth(moisPic.getMonth() + 1);
  const motPic = etiquette(`${moisPic.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} · ${fr(100 * connus[pic].reelle)} %`, 0.55, "#de3220");
  motPic.position.set(X(pic) - 3.1, CENTRE + connus[pic].reelle * ECHELLE + 0.25, 0.6);
  const motAnnonce = etiquette(`annoncé pour nov. 2026 · ${fr(100 * S[n - 1].prevue)} %`, 0.55, "#26407c"); motAnnonce.position.set(X(n - 1) - 2.2, CENTRE - 3.6, 0.6);
  const motDebut = etiquette("2016", 0.5), motFin = etiquette("2026", 0.5); motDebut.position.set(X(0), 0.55, 1.4); motFin.position.set(X(n - 1), 0.55, 1.4);
  stations[7].add(lames, ...enveloppes, annonce, axe, motPic, motAnnonce, motDebut, motFin);
  surLes[7] = (i) => { const j = Math.floor(tirage(i, 11) * connus.length), m = connus[j];
    return tirage(i, 12) < 0.72 ? dansBoite(i, X(j), CENTRE, 0, 0.1, 2 * m.reelle * ECHELLE, 0.5, m.agite ? C.vermillon : C.encre) : [X(j), CENTRE + (tirage(i, 13) < 0.5 ? 1 : -1) * S[j].prevue * ECHELLE, 0.55, C.indigo]; };
}

/* ---------- 8. Entrer : le torii ---------- */
const PORTE = K - 1, torii = new THREE.Group(); stations[PORTE].add(torii);
[-3.3, 3.3].forEach((x) => torii.add(pose(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.4, 6.6, 40), laque(C.vermillon)), x, 3.3, 0)));
torii.add(pose(new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.5, 0.95), laque(C.encre)), 0, 6.9, 0), pose(new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.32, 0.8), laque(C.vermillon)), 0, 6.48, 0),
  pose(new THREE.Mesh(new THREE.BoxGeometry(7.7, 0.36, 0.5), laque(C.vermillon)), 0, 5.2, 0), pose(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.42), laque(C.vermillon)), 0, 5.84, 0));
const couchant = new THREE.Mesh(new THREE.SphereGeometry(6.5, 48, 32), new THREE.MeshBasicMaterial({ color: C.vermillon, fog: false }));
couchant.position.set(0, 7.4, -34); stations[PORTE].add(couchant);
surLes[PORTE] = (i) => { const u = tirage(i, 11), a = tirage(i, 12) * 6.283;
  if (u < 0.5) return [(u < 0.25 ? -3.3 : 3.3) + Math.cos(a) * 0.37, tirage(i, 13) * 6.6, Math.sin(a) * 0.37, C.vermillon];
  return u < 0.72 ? dansBoite(i, 0, 6.9, 0, 9.6, 0.5, 0.95, C.encre) : u < 0.88 ? dansBoite(i, 0, 6.48, 0, 8.6, 0.32, 0.8, C.vermillon) : dansBoite(i, 0, 5.2, 0, 7.7, 0.36, 0.5, C.vermillon); };

/* ---------- Le nuage de gouttes : entre deux scènes, il quitte les objets de l'une et va dessiner ceux de la suivante ---------- */
const NB_GOUTTES_VOL = 26000, nuages = [], couleurGoutte = new THREE.Color();
for (let k = 0; k < K; k++) {
  const places = new Float32Array(NB_GOUTTES_VOL * 3), couleurs = new Float32Array(NB_GOUTTES_VOL * 3);
  for (let i = 0; i < NB_GOUTTES_VOL; i++) {
    const q = surLes[k] ? surLes[k](i + k * 0.113) : [(tirage(i, 31) - 0.5) * 8, 1 + tirage(i, 32) * 6, (tirage(i, 33) - 0.5) * 4, C.encre];
    places.set([q[0] + k * PAS, q[1], q[2]], i * 3); couleurGoutte.setHex(q[3]).toArray(couleurs, i * 3);
  }
  nuages.push({ places, couleurs });
}
const formeNuage = new THREE.BufferGeometry(), attribut = (nom, taille) => { const a = new THREE.BufferAttribute(new Float32Array(NB_GOUTTES_VOL * taille), taille); a.setUsage(THREE.DynamicDrawUsage); formeNuage.setAttribute(nom, a); return a; };
const aDe = attribut("position", 3), aVers = attribut("aVers", 3), cDe = attribut("cDe", 3), cVers = attribut("cVers", 3), aAlea = attribut("aAlea", 1);
for (let i = 0; i < NB_GOUTTES_VOL; i++) aAlea.array[i] = hasard(i, 41);
const matiereNuage = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
  uniforms: { uE: { value: 0 }, uTemps: { value: 0 }, uTaille: { value: 100 }, uPresence: { value: 1 } },
  vertexShader: `attribute vec3 aVers, cDe, cVers; attribute float aAlea; uniform float uE, uTemps, uTaille, uPresence; varying vec3 vCouleur; varying float vOpacite;
    void main() {
      float t = clamp((uE - aAlea * 0.42) / 0.58, 0.0, 1.0); t = t * t * (3.0 - 2.0 * t);                 // chaque goutte part à son heure
      vec3 p = mix(position, aVers, t); float arc = sin(3.14159 * t), force = fract(aAlea * 7.13);
      p += vec3(sin(aAlea * 91.0 + p.x * 0.33 + uTemps * 0.7), cos(aAlea * 57.0 + p.x * 0.27 + uTemps * 0.6), sin(aAlea * 33.0 + p.x * 0.41 + uTemps * 0.5)) * arc * (1.0 + 2.8 * force);
      p.y += arc * (1.5 + 3.5 * fract(aAlea * 3.7));
      vec4 vue = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * vue;
      gl_PointSize = uTaille * (0.35 + 1.5 * pow(fract(aAlea * 13.7), 3.0)) / -vue.z;       // beaucoup de petites gouttes, quelques grosses
      vCouleur = mix(cDe, cVers, t);
      vOpacite = uPresence * smoothstep(0.0, 0.1, uE) * (1.0 - smoothstep(0.9, 1.0, uE)) * (0.62 + 0.38 * arc) * smoothstep(64.0, 30.0, -vue.z);
    }`,
  fragmentShader: `varying vec3 vCouleur; varying float vOpacite;
    void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vCouleur, vOpacite * smoothstep(0.5, 0.3, d));
      #include <colorspace_fragment>
    }` });
const nuage = new THREE.Points(formeNuage, matiereNuage); nuage.frustumCulled = false; nuage.layers.set(MOTS); scene.add(nuage);      // dessiné après la mise au point : des gouttes nettes
let trajet = -1;
function chargerTrajet(k) {                            // les gouttes repartent de la scène k vers la scène k + 1
  if (k === trajet) return;
  trajet = k;
  aDe.array.set(nuages[k].places); aVers.array.set(nuages[k + 1].places); cDe.array.set(nuages[k].couleurs); cVers.array.set(nuages[k + 1].couleurs);
  aDe.needsUpdate = aVers.needsUpdate = cDe.needsUpdate = cVers.needsUpdate = true;
}

/* ---------- Poussière d'encre : des milliers de points flottent dans tout le monde ---------- */
const NB = 3200, grains = new Float32Array(NB * 3);
for (let i = 0; i < NB; i++) grains.set([-18 + hasard(i, 1) * ((K - 1) * PAS + 36), 0.4 + hasard(i, 2) * 12, -14 + hasard(i, 3) * 24], i * 3);
const poussiere = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(grains, 3)),
  new THREE.PointsMaterial({ color: C.encre, size: 0.07, transparent: true, opacity: 0.42, depthWrite: false }));
poussiere.layers.set(HORS_REFLET); scene.add(poussiere);

/* ---------- Les points de vue de la caméra, scène par scène : [position], [point visé], relatifs à la scène ---------- */
const VUES = [[[0, 3.4, 16], [0, 4.1, 0]], [[-7, 9, 27], [0, 3.2, 0]], [[4, 15, 23], [0.5, 1.2, 0]], [[-9, 9.5, 13], [0, 2.3, 0]],
  [[0, 4.6, 17], [0, 3.2, 0]], [[7, 7, 23], [0, 4.2, 0]], [[-3, 7.5, 27], [1, 3.6, 0]], [[-4, 6.6, 29], [0.6, 4.3, 0]], [[0, 2.7, 17], [0, 4.2, 0]]];
const vue = (k, i) => new THREE.Vector3(VUES[k][i][0] + k * PAS, VUES[k][i][1], VUES[k][i][2]);
// La caméra ne saute pas d'une vue à l'autre : elle suit deux courbes lisses, l'une pour sa position, l'autre pour ce qu'elle regarde
const routeCamera = new THREE.CatmullRomCurve3(VUES.map((_, k) => vue(k, 0)), false, "centripetal"), routeVisee = new THREE.CatmullRomCurve3(VUES.map((_, k) => vue(k, 1)), false, "centripetal");

/* ---------- Interface : chapitres, fil, grand signe ---------- */
const chapitres = [...document.querySelectorAll(".chapitre")], boutons = [...document.querySelectorAll("#fil button")];
const compteur = document.getElementById("compteur"), nom = document.getElementById("nom-chapitre"), curseur = document.getElementById("curseur"), signe = document.getElementById("signe");
const SIGNES = "一二三四五六七八九十日経平均株価", GRANDS_SIGNES = ["序", "数", "分", "学", "兆", "断", "転", "波", "入"];
let actif = 0;
function activer(i) {
  if (i === actif) return;
  actif = i;
  chapitres.forEach((c, k) => c.classList.toggle("actif", k === i));
  boutons.forEach((b, k) => b.classList.toggle("actif", k === i));
  compteur.textContent = String(i + 1).padStart(2, "0"); nom.textContent = P.noms[i];
  signe.classList.remove("visible");
  setTimeout(() => { signe.textContent = GRANDS_SIGNES[i]; signe.classList.add("visible"); }, 260);
  const titre = chapitres[i].querySelector("h2"), texte = titre.dataset.texte, debut = performance.now();
  if (IMMOBILE) return;
  const pas = (t) => {                               // le titre se révèle à travers des signes japonais
    const u = Math.min(1, (t - debut) / 650), fixes = Math.floor(u * texte.length);
    titre.textContent = texte.slice(0, fixes) + [...texte.slice(fixes, fixes + 6)].map((c) => (c === " " ? " " : SIGNES[Math.floor(Math.random() * SIGNES.length)])).join("");
    if (u < 1 && actif === i) requestAnimationFrame(pas); else titre.textContent = texte;
  };
  requestAnimationFrame(pas);
}
const aller = (i) => scrollTo({ top: borne(i, 0, K - 1) * innerHeight, behavior: IMMOBILE ? "auto" : "smooth" });
boutons.forEach((b) => b.addEventListener("click", () => aller(+b.dataset.aller)));
addEventListener("keydown", (e) => {
  if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); aller(actif + 1); }
  if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); aller(actif - 1); }
});
const souris = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { souris.x = e.clientX / innerWidth - 0.5; souris.y = e.clientY / innerHeight - 0.5; });

/* ---------- Boucle : tout dépend d'un seul nombre, la position de lecture (0 = ouverture, 8 = torii) ---------- */
// Un lien peut ouvrir directement une scène : /?scene=4 arrive sur la quatrième, sans rejouer l'ouverture
const directe = borne(Math.round(+new URLSearchParams(location.search).get("scene") || 0), 0, K);
let lisse = Math.max(0, directe - 1), avant = performance.now(), sx = 0, sy = 0, largeur = 0, hauteur = 0, vitesse = 0, qualite = Math.min(devicePixelRatio, 2), lenteur = 0, luxe = true, net = 20, debutIntro = IMMOBILE || directe ? -1e9 : 0;
if (directe) { history.scrollRestoration = "manual"; document.documentElement.style.scrollBehavior = "auto"; scrollTo(0, (directe - 1) * innerHeight); }
const position = new THREE.Vector3(), visee = new THREE.Vector3(), matrice = new THREE.Object3D();
function image(maintenant) {
  const ecoule = Math.min(0.1, (maintenant - avant) / 1000), temps = maintenant / 1000; avant = maintenant;
  const l = cadre.clientWidth, ht = cadre.clientHeight;
  if (l !== largeur || ht !== hauteur) {
    largeur = l; hauteur = ht;
    rendu.setPixelRatio(qualite); rendu.setSize(l, ht, false); camera.aspect = l / ht;
    const lp = Math.round(l * qualite), hp = Math.round(ht * qualite);
    tampon.setSize(lp, hp); miroir.setSize(lp >> 1, hp >> 1); profondeur.setSize(lp >> 1, hp >> 1); eclatA.setSize(lp >> 2, hp >> 2); eclatB.setSize(lp >> 2, hp >> 2);
    uSol.uEcran.value.set(lp, hp); finition.uniforms.uPixel.value.set(1 / lp, 1 / hp); finition.uniforms.uFlou.value = 8 * qualite; matiereNuage.uniforms.uTaille.value = 0.115 * hp;
    if (l / ht > 1.1) camera.setViewOffset(l, ht, -l * 0.17, 0, l, ht); else camera.setViewOffset(l, ht, 0, ht * 0.17, l, ht);   // le sujet se décale pour laisser la place au texte
    camera.updateProjectionMatrix();
  }
  const cible = borne(scrollY / innerHeight, 0, K - 1);
  lisse += (cible - lisse) * (IMMOBILE ? 1 : 1 - Math.exp(-ecoule * 4.5));
  const k = Math.min(K - 2, Math.floor(lisse)), m = lisse - k, e = doux(m);
  activer(Math.round(lisse));
  const intro = debutIntro ? borne((maintenant - debutIntro) / 2800) : 0, lever = 1 - Math.pow(1 - intro, 3);

  // Caméra : elle vole d'une vue à la suivante en prenant de la hauteur à mi-parcours
  sx += (souris.x - sx) * 0.05; sy += (souris.y - sy) * 0.05;
  const t = (k + e) / (K - 1); routeCamera.getPoint(t, position); position.y += Math.sin(Math.PI * e) * 2.6; position.z += Math.sin(Math.PI * e) * 3.5 + (1 - lever) * 13;
  position.x += sx * 1.6; position.y += -sy * 1.1 + (1 - lever) * 3;
  routeVisee.getPoint(t, visee);
  if (lisse > K - 1.5) position.z -= doux((lisse - (K - 1.5)) * 2) * (2.2 + Math.sin(temps * 0.4) * 0.8);          // devant le torii, elle avance doucement
  camera.position.copy(position); camera.lookAt(visee);
  const elan = cible - lisse;                                           // > 0 : on avance, < 0 : on recule
  vitesse += (Math.min(1, Math.abs(elan) * 1.4) - vitesse) * (1 - Math.exp(-ecoule * 6));
  camera.rotateZ(-borne(elan, -1, 1) * 0.07);                           // elle s'incline dans le sens du déplacement
  camera.fov = 38 + vitesse * 9; camera.updateProjectionMatrix();       // et son champ s'élargit quand elle file
  lumiere.target.position.copy(visee); lumiere.position.copy(visee).add(new THREE.Vector3(-10, 21, 12));

  // 0. le soleil se lève, le cercle tourne, les gouttes gravitent
  soleil.position.y = -7 + 13.2 * lever; soleil.visible = lisse < 0.85;
  couchant.position.y = -8 + 15.4 * doux((lisse - (PORTE - 0.75)) / 0.6); couchant.visible = lisse > PORTE - 0.8;      // un second soleil se lève derrière le torii
  enso.rotation.y = Math.sin(temps * 0.35) * 0.5 + lisse * 1.4; enso.scale.setScalar(0.2 + 0.8 * lever);
  for (let i = 0; i < NB_GOUTTES; i++) {
    const a = temps * (0.25 + hasard(i, 1) * 0.5) + hasard(i, 2) * 6.28, r = 3.7 + hasard(i, 3) * 1.7;
    matrice.position.set(Math.cos(a) * r, 4.1 + Math.sin(a * 1.3 + i) * 1.6 * hasard(i, 4) + Math.sin(a) * r * 0.25, Math.sin(a) * r * 0.55);
    matrice.scale.setScalar((0.4 + hasard(i, 5) * 0.9) * lever); matrice.rotation.set(0, 0, 0); matrice.updateMatrix(); gouttes.setMatrixAt(i, matrice.matrix);
  }
  gouttes.instanceMatrix.needsUpdate = true;

  // 1 et 2. les barres poussent en vague, puis s'envolent en arc vers leurs trois blocs
  if (barres) {
    const n = placesA.length, pousse = borne((lisse - 0.35) / 0.6) * 1.5, vol = borne(lisse - 1) * 1.6;
    for (let j = 0; j < n; j++) {
      const a = placesA[j], b = placesB[j], g = rebond(pousse - (j / n) * 0.5), t = doux(vol - (j / n) * 0.6), arc = Math.sin(Math.PI * t);
      matrice.position.set(a[0] + (b[0] - a[0]) * t, arc * (3 + hasard(j, 6) * 5), a[2] + (b[2] - a[2]) * t + arc * (hasard(j, 7) - 0.5) * 6);
      matrice.scale.set(a[3] + (b[3] - a[3]) * t, Math.max(0.001, (a[4] + (b[4] - a[4]) * t) * g), a[5] + (b[5] - a[5]) * t);
      matrice.rotation.set(arc * (hasard(j, 8) - 0.5) * 2.4, arc * 3.1 * (hasard(j, 9) - 0.5), 0); matrice.updateMatrix(); barres.setMatrixAt(j, matrice.matrix);
    }
    barres.instanceMatrix.needsUpdate = true;
  }

  // 3. la bille descend la surface à vitesse régulière, la surface tourne lentement
  if (bille) {
    const u = doux((lisse - 2.5) / 0.75) * longueurs[longueurs.length - 1];
    let i = 1; while (i < chemin.length - 1 && longueurs[i] < u) i++;
    const f = borne((u - longueurs[i - 1]) / Math.max(1e-6, longueurs[i] - longueurs[i - 1]));
    bille.position.copy(chemin[i - 1]).lerp(chemin[i], f); trace.geometry.setDrawRange(0, i + 1);
    stations[3].rotation.y = 0.5 + (lisse - 3) * 0.9 + Math.sin(temps * 0.3) * 0.08;
  }

  // 4. l'aiguille part de zéro et va se placer, avec un léger dépassement
  aiguille.rotation.z = Math.PI * (1 - P.p * rebond((lisse - 3.45) / 0.55));
  jauge.rotation.y = (lisse - 4) * 0.9 + sx * 0.3;

  // 5. les deux tours montent : leur hauteur est le gain en euros sur le test
  const montee = doux((lisse - 4.45) / 0.55), hAchat = Math.max(0.04, 9 * P.achat * montee), hRegle = Math.max(0.04, 9 * P.regle * montee);
  tourAchat.scale.y = hAchat; tourRegle.scale.y = hRegle;
  motAchat.position.set(2.3, hAchat + 0.8, 0); motRegle.position.set(-2.6, hRegle + 0.8, 0);
  stations[5].rotation.y = (lisse - 5) * 0.8;

  // 6. la partie de la courbe postérieure à 2022 pivote : ce que le modèle avait appris a changé de sens
  repere.rotation.y = -1.25 * doux((lisse - 5.5) / 0.6) + Math.sin(temps * 0.5) * 0.03;

  // 7. les lames poussent de part et d'autre de l'axe, puis les deux fils de la volatilité annoncée se tendent par-dessus
  if (lames) {
    const pousse = borne((lisse - 6.3) / 0.6) * 1.5, n = hautsLames.length;
    for (let j = 0; j < n; j++) {
      matrice.position.set(hautsLames[j][0], 4.4, 0); matrice.rotation.set(0, 0, 0);
      matrice.scale.set(0.085, Math.max(0.001, hautsLames[j][1] * rebond(pousse - (j / n) * 0.5)), 0.5); matrice.updateMatrix(); lames.setMatrixAt(j, matrice.matrix);
    }
    lames.instanceMatrix.needsUpdate = true;
    const tendu = doux((lisse - 6.62) / 0.36);
    enveloppes.forEach((fil) => fil.geometry.setDrawRange(0, Math.floor(fil.geometry.index.count * tendu / 6) * 6));
    annonce.scale.setScalar(Math.max(0.001, rebond((lisse - 6.9) / 0.1)) * (1 + Math.sin(temps * 2.2) * 0.06));
    stations[7].rotation.y = (lisse - 7) * 0.5;
  }

  // le nuage de gouttes : absent quand une scène est posée, il se forme dès que la caméra repart
  chargerTrajet(k);
  matiereNuage.uniforms.uE.value = m; matiereNuage.uniforms.uTemps.value = temps;
  matiereNuage.uniforms.uPresence.value = IMMOBILE || k === 1 ? 0 : 1;                  // entre les scènes 1 et 2, ce sont les barres elles-mêmes qui volent
  nuage.visible = m > 0.002 && m < 0.998;

  poussiere.position.y = Math.sin(temps * 0.25) * 0.35;
  curseur.style.top = `${(lisse / (K - 1)) * (90 - 18)}px`;
  signe.style.transform = `translate(${sx * 60}px, ${sy * 40}px)`;
  finition.uniforms.uVitesse.value = IMMOBILE ? 0 : vitesse; finition.uniforms.uTemps.value = temps;
  net += (camera.position.distanceTo(visee) - net) * 0.12; finition.uniforms.uNet.value = net;       // la mise au point suit le sujet
  // 1. le monde renversé, sans mots ni gouttes : c'est l'image que le sol reflète
  uSol.uReflet.value = luxe ? 0.34 : 0;
  if (luxe) {
    camera.layers.disable(HORS_REFLET); sol.visible = false; scene.scale.y = -1;
    rendu.setRenderTarget(miroir); rendu.render(scene, camera);
    scene.scale.y = 1; sol.visible = true; camera.layers.enable(HORS_REFLET);
  }
  // 2. le monde
  rendu.setRenderTarget(tampon); rendu.render(scene, camera);
  // 3. sa profondeur, pour la mise au point
  camera.layers.disable(HORS_REFLET); scene.overrideMaterial = matiereProfondeur; scene.background = null; rendu.shadowMap.autoUpdate = false; rendu.setClearColor(0xffffff, 1);
  rendu.setRenderTarget(profondeur); rendu.render(scene, camera);
  scene.overrideMaterial = null; scene.background = fondPapier; rendu.shadowMap.autoUpdate = true; camera.layers.enable(HORS_REFLET);
  // 4. le halo des reflets vifs : on garde ce qui dépasse le blanc du papier, puis on l'étale en deux passes
  finition.uniforms.uEclat.value = luxe ? 0.85 : 0;
  if (luxe) {
    ecranFinal.material = matiereEclat;
    matiereEclat.uniforms.tSource.value = tampon.texture; matiereEclat.uniforms.uSeuil.value = 1.0; matiereEclat.uniforms.uPas.value.set(1.4 / eclatA.width, 0);
    rendu.setRenderTarget(eclatB); rendu.render(sceneFinale, camera);
    matiereEclat.uniforms.tSource.value = eclatB.texture; matiereEclat.uniforms.uSeuil.value = 0; matiereEclat.uniforms.uPas.value.set(0, 1.4 / eclatA.height);
    rendu.setRenderTarget(eclatA); rendu.render(sceneFinale, camera);
    ecranFinal.material = finition;
  }
  // 5. la finition, à l'écran, puis les mots par-dessus : ils restent nets quelle que soit la mise au point
  rendu.setRenderTarget(null); rendu.render(sceneFinale, camera);
  camera.layers.set(MOTS); scene.background = null; rendu.autoClear = false; rendu.shadowMap.autoUpdate = false;
  rendu.render(scene, camera);
  camera.layers.set(0); camera.layers.enable(HORS_REFLET); scene.background = fondPapier; rendu.autoClear = true; rendu.shadowMap.autoUpdate = true;
  // Qualité adaptative : si la machine peine pendant une seconde et demie, on rend moins de pixels, puis on renonce aux reflets et au halo
  lenteur = ecoule > 0.026 ? lenteur + 1 : Math.max(0, lenteur - 2);
  if (lenteur > 90) { if (qualite > 1) { qualite = Math.max(1, qualite - 0.25); largeur = 0; } else luxe = false; lenteur = 0; }
  requestAnimationFrame(image);
}
if (!serie) document.getElementById("etat").textContent = "API Python arrêtée : scènes de données absentes";
requestAnimationFrame(image);

/* ---------- Ouverture : compteur, puis l'écran d'encre s'ouvre et la caméra descend vers le soleil levant ---------- */
const ecran = document.getElementById("intro");
if (IMMOBILE || directe) { ecran.style.display = "none"; document.body.classList.add("pret"); signe.classList.add("visible"); }
else {
  const t0 = performance.now(), nombre = document.getElementById("intro-nombre"), trait = document.getElementById("intro-trait");
  const ouvrir = () => { if (debutIntro) return; debutIntro = performance.now(); ecran.classList.add("ouvre"); document.body.classList.add("pret"); signe.classList.add("visible"); };
  const compter = (t) => {
    const u = Math.min(1, (t - t0) / 1500), v = 1 - Math.pow(1 - u, 3);
    nombre.textContent = String(Math.round(v * 100)).padStart(3, "0"); trait.style.width = `${v * 100}%`;
    if (u < 1) requestAnimationFrame(compter); else ouvrir();
  };
  requestAnimationFrame(compter);
  setTimeout(ouvrir, 2600);                          // l'écran s'ouvre même si l'onglet se charge en arrière-plan
}
