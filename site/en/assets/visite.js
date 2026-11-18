// English version of site/assets/visite.js (the 3D tour). Only the visible strings differ; oeuvres.js is shared with
// the French site (it has no text), and the room texts come from en/assets/contenu.js.
// La visite : une rotonde percée de sept portes rondes ; derrière chaque porte, une salle et une œuvre faite de données.
import * as THREE from "../../vendor/three.module.min.js";
import { SALLES, ENTREE, COURS, COURS_INFO, avecCours } from "./contenu.js";
import { OEUVRES, seriePourTableau, boiteArrondie } from "../../assets/oeuvres.js";
import { installerMenu, installerEntete, installerLiseuse, liensPieces, arrivee, FLECHE, FLECHE_G, stocker, lire } from "./commun.js";

const TEINTE = COURS_INFO[COURS].rotonde;   // la rotonde change de teinte avec le cours

const $ = (s) => document.querySelector(s);
const MOUVEMENT_REDUIT = matchMedia("(prefers-reduced-motion: reduce)").matches;
const VITESSE = MOUVEMENT_REDUIT ? 0.35 : 1;

// ---------- dimensions (mètres) ----------
const N = SALLES.length;
const R = 9;            // rayon de la rotonde
const HAUT = 8.2;       // hauteur du mur de la rotonde
const RP = 2.05;        // rayon d'une porte
const YP = 2.32;        // hauteur du centre d'une porte
const EP = 0.6;         // épaisseur du mur
const LS = 10, HS = 6.6, PS = 10.4;     // salle : largeur, hauteur, profondeur
const Z0 = -(R + EP);                   // plan d'entrée de la salle (repère de la porte)
const ZO = Z0 - 6.4;                    // position de l'œuvre
const OEIL = 1.62;
const S_SALLE = -(Z0 - 0.7);            // distance du centre à la place du visiteur dans la salle
const CIBLE = new THREE.Vector3(0, 1.58, ZO);

// ---------- écran d'attente ----------
const attente = { pct: 0, cible: 0 };
$(".attente-devise").textContent = ENTREE.devise;
$("#pied-ecole").textContent = ENTREE.ecole;
function avancer(p) { attente.cible = Math.max(attente.cible, p); }
(function boucleAttente() {
  attente.pct += (attente.cible - attente.pct) * 0.12;
  const v = Math.round(attente.pct);
  $("#pct").textContent = `${v} %`;
  $("#ligne").style.width = `${attente.pct}%`;
  if (v < 100) requestAnimationFrame(boucleAttente);
})();

// ---------- moteur ----------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("#scene"), antialias: true, powerPreference: "high-performance" });
} catch (e) {
  document.body.insertAdjacentHTML("beforeend", '<p class="sans-3d">This browser cannot display 3D.<a href="lecture.html">Open the reading</a></p>');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(TEINTE.fond);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 80);

// éclairage d'ambiance : une pièce lumineuse simple, filtrée en carte d'environnement
(function environnement() {
  const env = new THREE.Scene();
  const boite = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), new THREE.MeshBasicMaterial({ color: 0x8a847c, side: THREE.BackSide }));
  env.add(boite);
  const panneau = (l, h, x, y, z, rx, ry, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.97, 0.93).multiplyScalar(i) }));
    m.position.set(x, y, z); m.rotation.set(rx, ry, 0); env.add(m);
  };
  panneau(6, 6, 0, 3.9, 0, Math.PI / 2, 0, 3.2);
  panneau(4, 2.4, -5.9, 1.2, 0, 0, Math.PI / 2, 1.1);
  panneau(4, 2.4, 5.9, 1.6, -1, 0, -Math.PI / 2, 0.8);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
})();

const hemi = new THREE.HemisphereLight(0xfff4ea, 0x8a7d72, 0.75);
scene.add(hemi);

// ---------- textures dessinées ----------
function texture(l, h, dessiner, repeter = null) {
  const c = document.createElement("canvas");
  c.width = l; c.height = h;
  dessiner(c.getContext("2d"), l, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeter) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeter); }
  return t;
}
function bruit(ctx, l, h, n, alpha, taille = 2) {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${v},${v},${v},${Math.random() * alpha})`;
    ctx.fillRect(Math.random() * l, Math.random() * h, taille, taille);
  }
}
// sol de la rotonde : un enduit chaud, légèrement nuancé
const texSolRotonde = texture(1024, 1024, (ctx, l, h) => {
  ctx.fillStyle = "#b9a596"; ctx.fillRect(0, 0, l, h);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * l, y = Math.random() * h, r = 60 + Math.random() * 220;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = Math.random() < 0.5 ? "205,190,178" : "160,140,128";
    g.addColorStop(0, `rgba(${c},.22)`); g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, l, h);
  }
  bruit(ctx, l, h, 26000, 0.07);
}, [3, 3]);
// parquet clair des salles (teinté par la couleur du sol)
const texParquet = texture(1024, 1024, (ctx, l, h) => {
  ctx.fillStyle = "#e9e3da"; ctx.fillRect(0, 0, l, h);
  const lame = h / 8;
  for (let i = 0; i < 8; i++) {
    let x = -Math.random() * l;
    while (x < l) {
      const long = l * (0.35 + Math.random() * 0.4);
      ctx.fillStyle = `rgba(${200 + Math.random() * 40},${190 + Math.random() * 40},${180 + Math.random() * 40},.55)`;
      ctx.fillRect(x, i * lame, long, lame);
      ctx.fillStyle = "rgba(90,70,55,.18)"; ctx.fillRect(x, i * lame, 2, lame);
      x += long;
    }
    ctx.fillStyle = "rgba(90,70,55,.16)"; ctx.fillRect(0, i * lame, l, 2);
  }
  bruit(ctx, l, h, 18000, 0.05);
}, [2.2, 2.2]);
// panneaux muraux discrets
const texPanneaux = texture(512, 512, (ctx, l, h) => {
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, l, h);
  ctx.fillStyle = "rgba(0,0,0,.07)"; ctx.fillRect(0, 0, 3, h); ctx.fillRect(0, h * 0.62, l, 2);
  bruit(ctx, l, h, 6000, 0.035);
}, [4, 1]);
const texOmbre = texture(256, 256, (ctx, l, h) => {
  const g = ctx.createRadialGradient(l / 2, h / 2, 0, l / 2, h / 2, l / 2);
  g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(0.55, "rgba(0,0,0,.18)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, l, h);
});

// matière percée de portes rondes : on jette les fragments situés dans un cercle
function percer(materiau, fonctionTrou) {
  materiau.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPosLocale;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPosLocale = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vPosLocale;\n${fonctionTrou}`)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (dansTrou(vPosLocale)) discard;");
  };
  return materiau;
}

// ---------- la rotonde ----------
const angleDe = (i) => (i * 2 * Math.PI) / N;
const rotonde = new THREE.Group();
scene.add(rotonde);
{
  const texRotonde = texPanneaux.clone();
  texRotonde.repeat.set(14, 1);
  texRotonde.needsUpdate = true;
  const murMat = percer(new THREE.MeshStandardMaterial({ color: TEINTE.mur, roughness: 0.96, side: THREE.BackSide, map: texRotonde }), `
    bool dansTrou(vec3 p) {
      float phi = atan(p.x, -p.z);
      for (int i = 0; i < ${N}; i++) {
        float d = phi - float(i) * ${((2 * Math.PI) / N).toFixed(6)};
        d = mod(d + 3.14159265, 6.2831853) - 3.14159265;
        vec2 q = vec2(d * ${R.toFixed(1)}, p.y - ${YP.toFixed(2)});
        if (dot(q, q) < ${(RP * RP).toFixed(4)}) return true;
      }
      return false;
    }`);
  // la géométrie est remontée (et non le maillage) pour que vPosLocale.y aille de 0 à HAUT
  const mur = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HAUT, 360, 1, true).translate(0, HAUT / 2, 0), murMat);
  mur.receiveShadow = true;
  rotonde.add(mur);

  const sol = new THREE.Mesh(new THREE.CircleGeometry(R + 0.05, 128), new THREE.MeshStandardMaterial({ color: TEINTE.sol, map: texSolRotonde, roughness: 0.6, envMapIntensity: 0.5 }));
  sol.rotation.x = -Math.PI / 2;
  sol.receiveShadow = true;
  rotonde.add(sol);
  // un anneau gravé au centre
  const anneau = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.42, 128), new THREE.MeshBasicMaterial({ color: 0x8c7a6d, transparent: true, opacity: 0.35 }));
  anneau.rotation.x = -Math.PI / 2; anneau.position.y = 0.003;
  rotonde.add(anneau);

  // plafond avec un oculus, et le ciel au-dessus
  const plafond = new THREE.Mesh(new THREE.RingGeometry(2.6, R + 0.1, 128), new THREE.MeshStandardMaterial({ color: 0xcfc6b9, roughness: 1, side: THREE.DoubleSide }));
  plafond.rotation.x = Math.PI / 2; plafond.position.y = HAUT;
  rotonde.add(plafond);
  const puits = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.9, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0xe8e1d7, roughness: 1, side: THREE.BackSide }));
  puits.position.y = HAUT + 0.45;
  rotonde.add(puits);
  const ciel = new THREE.Mesh(new THREE.CircleGeometry(2.7, 64), new THREE.MeshBasicMaterial({ color: 0xfffcf6, toneMapped: false }));
  ciel.rotation.x = Math.PI / 2; ciel.position.y = HAUT + 0.9;
  rotonde.add(ciel);
  const jour = new THREE.DirectionalLight(0xfff3e6, 0.85);
  jour.position.set(0.6, HAUT + 3, 0.4);
  rotonde.add(jour);
}

// ---------- deux estampes sur le mur de la rotonde, entre les portes ----------
function estampe(cle, largeur, hauteur, angle, rouleau) {
  const src = window.NIKKEI_IMAGES?.[cle];
  if (!src) return;
  const g = new THREE.Group();
  g.rotation.y = -angle;
  scene.add(g);
  const z = -(R - 0.24), y = 3.05;   // assez en avant du mur courbe pour que les bords ne passent pas derrière
  const tex = new THREE.TextureLoader().load(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (rouleau) {
    // kakemono : la peinture montée sur soie, deux baguettes de bois
    const soie = new THREE.Mesh(new THREE.PlaneGeometry(largeur + 0.34, hauteur + 0.9), new THREE.MeshStandardMaterial({ color: 0xcfc2a6, roughness: 0.9 }));
    soie.position.set(0, y - 0.05, z - 0.01);
    const bande = new THREE.Mesh(new THREE.PlaneGeometry(largeur + 0.34, 0.22), new THREE.MeshStandardMaterial({ color: 0x5b4a3a, roughness: 0.85 }));
    bande.position.set(0, y + hauteur / 2 + 0.24, z - 0.005);
    g.add(soie, bande);
    for (const dy of [hauteur / 2 + 0.42, -hauteur / 2 - 0.52]) {
      const baguette = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, largeur + 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.5 }));
      baguette.rotation.z = Math.PI / 2;
      baguette.position.set(0, y + dy, z + 0.02);
      g.add(baguette);
    }
  } else {
    const cadre = new THREE.Mesh(boiteArrondie(largeur + 0.22, hauteur + 0.22, 0.06, 0.01, 1), new THREE.MeshStandardMaterial({ color: 0x2a211b, roughness: 0.55 }));
    cadre.position.set(0, y, z - 0.04);
    const marie = new THREE.Mesh(new THREE.PlaneGeometry(largeur + 0.12, hauteur + 0.12), new THREE.MeshStandardMaterial({ color: 0xf1ebe0, roughness: 0.9 }));
    marie.position.set(0, y, z - 0.005);
    g.add(cadre, marie);
  }
  const image = new THREE.Mesh(new THREE.PlaneGeometry(largeur, hauteur), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
  image.position.set(0, y, z);
  g.add(image);
}

// ---------- les portes et les salles ----------
const portes = [];   // disques invisibles pour le clic
const salles = [];   // { groupe, titre, lumiere, etat }
const projecteur = new THREE.SpotLight(0xfff3e6, 0, 0, 0.62, 0.65, 2);
projecteur.castShadow = true;
projecteur.shadow.mapSize.set(2048, 2048);
projecteur.shadow.bias = -0.0004;
projecteur.shadow.normalBias = 0.025;
projecteur.shadow.camera.near = 1;
projecteur.shadow.camera.far = 14;
scene.add(projecteur, projecteur.target);

const POLICE_JP = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
function toileNoren(signe, ideogramme) {
  return texture(512, 960, (ctx, l, h) => {
    ctx.fillStyle = "#22324c"; ctx.fillRect(0, 0, l, h);                       // aizome : indigo de cuve
    for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(255,255,255,${0.012 + Math.random() * 0.02})`; ctx.fillRect(0, y, l, 1); }
    bruit(ctx, l, h, 9000, 0.06);
    ctx.fillStyle = "rgba(255,255,255,.07)"; ctx.fillRect(0, h - 70, l, 3);     // un filet près de l'ourlet
    ctx.fillStyle = "#f3efe6"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (ideogramme) { ctx.font = `700 300px ${POLICE_JP}`; ctx.fillText(signe, l / 2, h * 0.42); }
    else { ctx.font = `400 210px "Instrument Serif", Georgia, serif`; ctx.fillText(signe, l / 2, h * 0.42); }
  });
}

function texteTitre(texte, couleur, l0 = 2048, h0 = 400) {
  return texture(l0, h0, (ctx, l, h) => {
    ctx.clearRect(0, 0, l, h);
    ctx.fillStyle = couleur;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let taille = Math.round(h * 0.75);
    ctx.font = `400 ${taille}px "Instrument Serif", Georgia, serif`;
    while (ctx.measureText(texte).width > l * 0.94) { taille -= 8; ctx.font = `400 ${taille}px "Instrument Serif", Georgia, serif`; }
    ctx.fillText(texte, l / 2, h / 2 + taille * 0.04);
  });
}

function tableau(salle) {
  const { ton } = salle;
  const s = seriePourTableau(salle.id);
  return texture(1400, 900, (ctx, l, h) => {
    const g = ctx.createLinearGradient(0, 0, l * 0.3, h);
    g.addColorStop(0, ton.ciel); g.addColorStop(1, ton.accent);
    ctx.fillStyle = g; ctx.fillRect(0, 0, l, h);
    for (let i = 0; i < 26; i++) {   // nuées douces
      const x = Math.random() * l, y = Math.random() * h, r = 80 + Math.random() * 260;
      const n = ctx.createRadialGradient(x, y, 0, x, y, r);
      n.addColorStop(0, "rgba(255,255,255,.28)"); n.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = n; ctx.fillRect(0, 0, l, h);
    }
    bruit(ctx, l, h, 30000, 0.05);
    const mx = 110, my = 150, L = l - 2 * mx, H = h - 2 * my;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    const trace = (v, couleur, ep) => {
      ctx.strokeStyle = couleur; ctx.lineWidth = ep; ctx.beginPath();
      v.forEach((y, i) => { const X = mx + (i / (v.length - 1)) * L, Y = my + (1 - y) * H; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
      ctx.stroke();
    };
    if (s.seuils) {
      ctx.strokeStyle = "rgba(30,28,26,.35)"; ctx.lineWidth = 2; ctx.setLineDash([10, 12]);
      for (const p of s.seuils) { const Y = my + (1 - (p - 0.3) / 0.45) * H; ctx.beginPath(); ctx.moveTo(mx, Y); ctx.lineTo(mx + L, Y); ctx.stroke(); }
      ctx.setLineDash([]);
      s.ligne = s.ligne.map((p) => (p - 0.3) / 0.45);
    }
    if (s.ligne2) trace(s.ligne2, "rgba(30,28,26,.38)", 4);
    if (s.ligne) trace(s.ligne, "rgba(30,28,26,.82)", 5);
    if (s.barres) {
      const m = Math.max(...s.barres.map(Math.abs)), w = L / s.barres.length;
      s.barres.forEach((v, i) => { ctx.fillStyle = v < 0 ? "rgba(30,28,26,.75)" : "rgba(30,28,26,.3)"; const hh = (Math.abs(v) / m) * H * 0.48; ctx.fillRect(mx + i * w, my + H / 2 - (v > 0 ? hh : 0), Math.max(w - 2, 1.5), hh); });
    }
    if (s.points) {
      const v = s.points, a = Math.min(...v), b = Math.max(...v);
      v.forEach((y, i) => { ctx.fillStyle = "rgba(30,28,26,.7)"; ctx.beginPath(); ctx.arc(mx + (i / (v.length - 1)) * L, my + ((y - a) / (b - a)) * H, 7, 0, 7); ctx.fill(); });
    }
  });
}

function construireSalle(salle, i) {
  const { ton } = salle;
  const groupe = new THREE.Group();
  groupe.rotation.y = -angleDe(i);
  scene.add(groupe);

  // encadrement de la porte (le tunnel dans l'épaisseur du mur)
  const encadrement = new THREE.Mesh(new THREE.CylinderGeometry(RP, RP, EP + 0.32, 128, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.65, side: THREE.DoubleSide }));
  encadrement.rotation.x = Math.PI / 2;
  encadrement.position.set(0, YP, -(R + EP / 2 - 0.16));
  groupe.add(encadrement);
  const levre = new THREE.Mesh(new THREE.TorusGeometry(RP, 0.022, 12, 128), encadrement.material);
  levre.position.set(0, YP, -(R - 0.3));
  groupe.add(levre);
  const disque = new THREE.Mesh(new THREE.CircleGeometry(RP, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
  disque.position.set(0, YP, -(R - 0.3));
  disque.userData.salle = i;
  groupe.add(disque);
  portes.push(disque);

  // le noren : deux pans de toile indigo suspendus dans la porte, l'idéogramme de la salle sur l'un, son numéro sur l'autre
  const noren = new THREE.Group();
  noren.position.set(0, YP + RP * 0.97, -(R + 0.12));
  const pans = [];
  for (const cote of [-1, 1]) {
    const pan = new THREE.Mesh(new THREE.PlaneGeometry(RP * 0.92, 1.72, 1, 8).translate(0, -0.86, 0),
      new THREE.MeshStandardMaterial({ map: toileNoren(cote < 0 ? salle.kanji : salle.num, cote < 0), roughness: 0.95, side: THREE.DoubleSide }));
    pan.position.x = cote * (RP * 0.46 + 0.025);
    pan.castShadow = false;
    noren.add(pan);
    pans.push(pan);
  }
  groupe.add(noren);

  // numéro gravé au-dessus de la porte
  const num = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: texteTitre(salle.num, "#4f4740", 512, 256), transparent: true, opacity: 0.7, depthWrite: false }));
  num.position.set(0, YP + RP + 0.6, -(R - 0.02));
  groupe.add(num);

  // la salle : sol, plafond, trois murs et un mur d'entrée percé
  const mur = new THREE.MeshStandardMaterial({ color: ton.mur, roughness: 0.95, map: texPanneaux, envMapIntensity: 0.5 });
  const zc = Z0 - PS / 2;
  const plan = (l, h, mat, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(l, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; groupe.add(m); return m; };
  const solMat = new THREE.MeshStandardMaterial({ color: ton.sol, map: texParquet, roughness: 0.62, envMapIntensity: 0.6 });
  plan(LS, PS, solMat, 0, 0, zc, -Math.PI / 2, 0);
  plan(LS, PS, new THREE.MeshStandardMaterial({ color: new THREE.Color(ton.mur).multiplyScalar(0.92), roughness: 1 }), 0, HS, zc, Math.PI / 2, 0);
  plan(LS, HS, mur, 0, HS / 2, Z0 - PS, 0, 0);
  plan(PS, HS, mur, -LS / 2, HS / 2, zc, 0, Math.PI / 2);
  plan(PS, HS, mur, LS / 2, HS / 2, zc, 0, -Math.PI / 2);
  const entreeMat = percer(new THREE.MeshStandardMaterial({ color: ton.mur, roughness: 0.95, side: THREE.DoubleSide, map: texPanneaux }), `
    bool dansTrou(vec3 p) { vec2 q = vec2(p.x, p.y - ${(YP - HS / 2).toFixed(3)}); return dot(q, q) < ${(RP * RP).toFixed(4)}; }`);
  plan(LS, HS, entreeMat, 0, HS / 2, Z0, 0, Math.PI);
  // verrière au plafond
  const verriere = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(ton.ciel).lerp(new THREE.Color(0xffffff), 0.6), toneMapped: false }));
  verriere.position.set(0, HS - 0.01, ZO + 0.4); verriere.rotation.x = Math.PI / 2;
  groupe.add(verriere);
  const lumiere = new THREE.PointLight(0xfff4e8, 26, 16, 1.6);
  lumiere.position.set(0, HS - 0.6, ZO + 1.2);
  groupe.add(lumiere);

  // le tableau du fond, avec un cadre fin
  const cadre = new THREE.Mesh(boiteArrondie(3.92, 2.58, 0.08, 0.01, 1), new THREE.MeshStandardMaterial({ color: 0xe9e3da, roughness: 0.6 }));
  cadre.position.set(0, 3.05, Z0 - PS + 0.05);
  groupe.add(cadre);
  plan(3.7, 2.36, new THREE.MeshStandardMaterial({ map: tableau(salle), roughness: 0.9 }), 0, 3.05, Z0 - PS + 0.1, 0, 0);
  // une console contre le mur de gauche
  const console = new THREE.Group();
  const plateau = new THREE.Mesh(boiteArrondie(1.3, 0.04, 0.42, 0.01, 1), new THREE.MeshStandardMaterial({ color: 0x23211e, roughness: 0.5 }));
  plateau.position.y = 0.86; console.add(plateau);
  for (const x of [-0.6, 0.6]) for (const z of [-0.17, 0.17]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.86, 0.025), plateau.material); p.position.set(x, 0.43, z); console.add(p); }
  const objet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), new THREE.MeshPhysicalMaterial({ color: ton.accent, roughness: 0.4, clearcoat: 0.4 }));
  objet.position.set(0.25, 1.01, 0); console.add(objet);
  console.position.set(-LS / 2 + 0.3, 0, ZO - 0.5); console.rotation.y = Math.PI / 2;
  console.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  groupe.add(console);

  // l'œuvre
  const etat = {};
  const oeuvre = OEUVRES[salle.id](etat);
  oeuvre.position.set(0, 0, ZO);
  groupe.add(oeuvre);
  const ombre = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: texOmbre, transparent: true, depthWrite: false, opacity: 0.55 }));
  ombre.rotation.x = -Math.PI / 2; ombre.position.set(0, 0.004, ZO);
  groupe.add(ombre);

  // le titre, entre l'œuvre et le tableau ; il apparaît quand on entre
  const murClair = encre(ton.mur);
  const titre = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.25), new THREE.MeshBasicMaterial({ map: texteTitre(salle.nom, murClair ? "#2a2622" : ton.texte), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  titre.userData.opacite = murClair ? 0.55 : 0.78;
  titre.position.set(0, etat.vue?.titre ?? 3.55, ZO - 2.3);
  groupe.add(titre);

  salles.push({ groupe, titre, lumiere, etat, oeuvre, pans });
}

// ---------- état de la caméra ----------
const cam = {
  theta: 0,       // angle de la porte regardée (continu)
  s: -4.5,        // distance parcourue depuis le centre, le long de l'axe de la porte
  regardX: 0, regardY: 0, cibleX: 0, cibleY: 0,   // décalage du regard (glisser)
  index: 0,
  dansSalle: false,
  occupe: true,
};
const tweens = [];
const facile = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function tween(obj, cle, vers, duree) {
  return new Promise((ok) => {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].obj === obj && tweens[i].cle === cle) tweens.splice(i, 1);
    tweens.push({ obj, cle, de: obj[cle], vers, duree: Math.max(duree * VITESSE, 0.01), t: 0, ok });
  });
}
function majTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i];
    w.t = Math.min(w.t + dt / w.duree, 1);
    w.obj[w.cle] = w.de + (w.vers - w.de) * facile(w.t);
    if (w.t >= 1) { tweens.splice(i, 1); w.ok(); }
  }
}

const vLocal = new THREE.Vector3(), vCible = new THREE.Vector3(), loin = new THREE.Vector3(), cibleSalle = new THREE.Vector3();
function placerCamera() {
  const k = THREE.MathUtils.smoothstep(cam.s, R * 0.75, S_SALLE);       // 0 dans la rotonde, 1 dans la salle
  const ang = cam.theta + cam.regardX * 0.55 * (1 - k);
  // chaque œuvre peut demander un regard plus haut (vue = { oeil, cible })
  const vue = salles[cam.index]?.etat.vue;
  cibleSalle.set(0, vue?.cible ?? CIBLE.y, CIBLE.z);
  // position dans le repère de la porte, puis orbite autour de l'œuvre une fois dans la salle
  vLocal.set(0, OEIL + ((vue?.oeil ?? OEIL) - OEIL) * k, -cam.s);
  const phi = -cam.regardX * 0.7 * k;
  if (phi) {
    const dx = vLocal.x - cibleSalle.x, dz = vLocal.z - cibleSalle.z;
    vLocal.x = cibleSalle.x + dx * Math.cos(phi) - dz * Math.sin(phi);
    vLocal.z = cibleSalle.z + dx * Math.sin(phi) + dz * Math.cos(phi);
  }
  loin.set(0, OEIL + 0.32 + cam.regardY * 1.6, -cam.s - 12);
  vCible.copy(loin).lerp(cibleSalle, k);
  vCible.y += cam.regardY * 0.8 * k;
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const monde = (v) => new THREE.Vector3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
  camera.position.copy(monde(vLocal));
  camera.lookAt(monde(vCible));
  // dans une salle, l'œuvre se décale pour laisser la place au cartel (à droite, ou en bas sur un écran étroit)
  const l = innerWidth, h = innerHeight;
  const etroit = l <= 860;
  const ox = etroit ? 0 : ((Math.min(340, l * 0.3) + 40) / 2) * k;
  const oy = etroit ? Math.min(h * 0.38, 320) * 0.62 * k : 0;
  if (ox || oy) camera.setViewOffset(l, h, ox, oy, l, h); else camera.clearViewOffset();
}

function redimensionner() {
  const a = innerWidth / innerHeight;
  camera.aspect = a;
  camera.fov = a < 1 ? Math.min(76, 50 / Math.sqrt(a)) : 50;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", redimensionner);
redimensionner();

// ---------- interface ----------
const nav = $("#rotonde-nav"), ui = $("#salle-ui"), cartel = $("#cartel");
// texte foncé ou clair selon ce qui contraste le mieux avec le mur
const encre = (hex) => {
  const c = new THREE.Color(hex), L = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return (L + 0.05) / 0.0636 > 1.05 / (L + 0.05);   // contraste avec l'encre #211e1b contre contraste avec le blanc
};
function couleurUI(clair) {
  document.body.style.setProperty("--ui", clair ? "#211e1b" : "#fbf8f3");
  document.body.style.setProperty("--ui-inverse", clair ? "#f3efe8" : "#211e1b");
}

function majRotonde() {
  const i = cam.index, p = (i + N - 1) % N, n = (i + 1) % N;
  $("#precedente").innerHTML = `${FLECHE_G}<span class="nom">${SALLES[p].nom}</span>`;
  $("#precedente").setAttribute("aria-label", `Previous room: ${SALLES[p].nom}`);
  $("#suivante").innerHTML = `<span class="nom">${SALLES[n].nom}</span>${FLECHE}`;
  $("#suivante").setAttribute("aria-label", `Next room: ${SALLES[n].nom}`);
  const seances = (SALLES[i].seances ?? []).map(([code]) => code).filter((c) => /^[SL]\d/.test(c)).join(" · ");
  $("#courante-num").innerHTML = `<span class="sceau" aria-hidden="true">${SALLES[i].kanji}</span>ROOM ${SALLES[i].num} — ${i + 1} / ${N}${seances ? ` · ${seances}` : ""}`;
  $("#courante-nom").textContent = SALLES[i].nom;
  $("#courante-nom").setAttribute("aria-label", `Enter room ${SALLES[i].num}: ${SALLES[i].nom}`);
  nav.classList.remove("change"); void nav.offsetWidth; nav.classList.add("change");
}
function majCartel() {
  const s = SALLES[cam.index];
  cartel.innerHTML = `
    <button class="cartel-replier" type="button">Collapse</button>
    <p class="sur-titre"><span class="sceau" aria-hidden="true">${s.kanji}</span>Room ${s.num} · ${s.nom}</p>
    <h2>${s.titre}</h2>
    ${arrivee(s)}
    <p class="oeuvre">${s.oeuvre}</p>
    <p class="clair">${s.clair}</p>
    <dl>${s.chiffres.map(([v, l]) => `<div><dt>${v}</dt><dd>${l}</dd></div>`).join("")}</dl>
    <p class="legende">${s.legende}</p>
    ${liensPieces(s) ? `<div class="cartel-pieces"><p class="sur-titre">In the cabinet</p>${liensPieces(s)}</div>` : ""}`;
  cartel.querySelector(".cartel-replier").addEventListener("click", (e) => {
    cartel.classList.toggle("replie");
    e.currentTarget.textContent = cartel.classList.contains("replie") ? "Expand" : "Collapse";
  });
  const lien = $("#lire");
  lien.href = avecCours(`lecture.html#${s.id}`);
  lien.innerHTML = `Read chapter ${s.num} ${FLECHE}`;
  $("#vers-lecture").href = avecCours(`lecture.html#${s.id}`);
}
function majAdresse() {
  const id = SALLES[cam.index].id;
  try { history.replaceState(null, "", cam.dansSalle ? `#${id}` : location.pathname + location.search); } catch (e) { /* ouvert depuis le disque */ }
  $("#vers-lecture").href = avecCours(cam.dansSalle ? `lecture.html#${id}` : "lecture.html");
}

function eclairer(i) {
  const g = salles[i].groupe;
  projecteur.position.copy(g.localToWorld(new THREE.Vector3(1.6, HS - 0.25, ZO + 2.6)));
  projecteur.target.position.copy(g.localToWorld(new THREE.Vector3(0, 1.2, ZO)));
  projecteur.target.updateMatrixWorld();
}

// ---------- déplacements ----------
const delta = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
async function tourner(i) {
  if (i === cam.index && Math.abs(delta(cam.theta, angleDe(i))) < 1e-3) return;
  const d = delta(cam.theta, angleDe(i));
  cam.index = i;
  majRotonde();
  eclairer(i);
  await tween(cam, "theta", cam.theta + d, 0.75 + Math.abs(d) * 0.35);
}
async function entrer() {
  if (cam.dansSalle) return;
  cam.occupe = true;
  const i = cam.index;
  eclairer(i);
  nav.classList.add("cache");
  majCartel();
  tween(projecteur, "intensity", 70, 1.2);
  tween(salles[i].titre.material, "opacity", 0.0, 0.01);
  await tween(cam, "s", S_SALLE, 2.1);
  cam.dansSalle = true;
  couleurUI(encre(SALLES[i].ton.mur));
  ui.classList.add("visible");
  document.body.classList.add("dans-salle");
  tween(salles[i].titre.material, "opacity", salles[i].titre.userData.opacite, 1.4);
  majAdresse();
  cam.occupe = false;
}
async function sortir() {
  if (!cam.dansSalle) return;
  cam.occupe = true;
  const i = cam.index;
  ui.classList.remove("visible");
  document.body.classList.remove("dans-salle");
  tween(salles[i].titre.material, "opacity", 0, 0.6);
  cam.dansSalle = false;
  couleurUI(true);
  await tween(cam, "s", 0, 1.7);
  nav.classList.remove("cache");
  majRotonde();
  majAdresse();
  cam.occupe = false;
}
async function aller(i, { entrerApres = true } = {}) {
  if (cam.occupe) return;
  cam.occupe = true;
  if (cam.dansSalle) { cam.occupe = false; await sortir(); cam.occupe = true; }
  await tourner(i);
  cam.occupe = false;
  if (entrerApres) await entrer();
}
async function voisine(sens) {
  if (cam.occupe) return;
  const i = (cam.index + sens + N) % N;
  if (cam.dansSalle) return aller(i);
  cam.occupe = true;
  await tourner(i);
  cam.occupe = false;
}

// ---------- gestes ----------
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster(), souris = new THREE.Vector2();
let geste = null;
function porteSous(x, y) {
  souris.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(souris, camera);
  const h = raycaster.intersectObjects(portes, false)[0];
  return h ? h.object.userData.salle : null;
}
canvas.addEventListener("pointerdown", (e) => {
  geste = { x: e.clientX, y: e.clientY, x0: cam.cibleX, y0: cam.cibleY, t: performance.now(), bouge: false };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!geste) {
    if (!cam.dansSalle && !cam.occupe && e.pointerType === "mouse") document.body.classList.toggle("survol-porte", porteSous(e.clientX, e.clientY) !== null);
    return;
  }
  const dx = e.clientX - geste.x, dy = e.clientY - geste.y;
  if (Math.hypot(dx, dy) > 5) { geste.bouge = true; document.body.classList.add("glisse"); }
  cam.cibleX = THREE.MathUtils.clamp(geste.x0 - dx / innerWidth * 1.6, -0.9, 0.9);
  cam.cibleY = THREE.MathUtils.clamp(geste.y0 + dy / innerHeight * 0.9, -0.35, 0.35);
});
function finGeste(e) {
  if (!geste) return;
  const g = geste; geste = null;
  document.body.classList.remove("glisse");
  cam.cibleX = 0; cam.cibleY = 0;
  const dx = e.clientX - g.x, dt = performance.now() - g.t;
  if (g.bouge && e.pointerType !== "mouse" && Math.abs(dx) > 60 && dt < 600) { voisine(dx < 0 ? 1 : -1); return; }
  if (g.bouge) return;
  if (!cam.dansSalle && !cam.occupe) {
    const i = porteSous(e.clientX, e.clientY);
    if (i !== null) aller(i);
  }
}
canvas.addEventListener("pointerup", finGeste);
canvas.addEventListener("pointercancel", finGeste);

let molette = 0, moletteBloquee = 0;
addEventListener("wheel", (e) => {
  if (menu.estOuvert() || liseuse.estOuverte() || e.target.closest(".cartel")) return;
  e.preventDefault();
  const maintenant = performance.now();
  if (maintenant < moletteBloquee) return;
  molette += e.deltaY + e.deltaX;
  if (Math.abs(molette) > 55) {
    voisine(molette > 0 ? 1 : -1);
    molette = 0;
    moletteBloquee = maintenant + 1100;
  }
}, { passive: false });

addEventListener("keydown", (e) => {
  if (menu.estOuvert() || liseuse.estOuverte() || e.target.closest("input, textarea")) return;
  if (!$("#aide").hidden) fermerAide();
  if (e.key === "ArrowRight") { e.preventDefault(); voisine(1); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); voisine(-1); }
  else if ((e.key === "Enter" || e.key === " " || e.key === "ArrowUp") && !cam.dansSalle && !e.target.closest("a, button")) { e.preventDefault(); entrer(); }
  else if ((e.key === "Escape" || e.key === "ArrowDown" || e.key === "Backspace") && cam.dansSalle) { e.preventDefault(); sortir(); }
});

$("#precedente").addEventListener("click", () => voisine(-1));
$("#suivante").addEventListener("click", () => voisine(1));
$("#courante-nom").addEventListener("click", () => entrer());
$("#retour").addEventListener("click", () => sortir());
$("#retour").innerHTML = `${FLECHE_G} Back to the rotunda`;

function fermerAide() { $("#aide").hidden = true; stocker("nikkei-aide-vue", "1"); }
$("#aide").addEventListener("click", fermerAide);

installerEntete("visite");
const liseuse = installerLiseuse();
const menu = installerMenu({ page: "visite", allerSalle: (id) => aller(SALLES.findIndex((s) => s.id === id)), salleActive: () => (cam.dansSalle ? SALLES[cam.index].id : null) });

// ---------- boucle ----------
const horloge = new THREE.Clock();
let enPause = false;
document.addEventListener("visibilitychange", () => { enPause = document.hidden; if (!enPause) horloge.getDelta(); });
function boucle() {
  requestAnimationFrame(boucle);
  if (enPause) return;
  const dt = Math.min(horloge.getDelta(), 0.1), t = horloge.elapsedTime;
  majTweens(dt);
  const amorti = geste ? 0.25 : 0.045;
  cam.regardX += (cam.cibleX - cam.regardX) * amorti;
  cam.regardY += (cam.cibleY - cam.regardY) * amorti;
  for (let i = 0; i < salles.length; i++) {
    const s = salles[i];
    const proche = i === cam.index;
    if (s.etat.animer && proche) s.etat.animer(t);
    if (!MOUVEMENT_REDUIT) s.pans.forEach((pan, k) => (pan.rotation.x = Math.sin(t * 0.9 + i + k * 1.7) * 0.025));   // le noren respire
    if (!MOUVEMENT_REDUIT && proche && cam.dansSalle && !geste) s.oeuvre.rotation.y += dt * 0.05;
  }
  placerCamera();
  renderer.render(scene, camera);
}

// ---------- démarrage ----------
async function demarrer() {
  avancer(12);
  const ideogrammes = SALLES.map((s) => s.kanji).join("");
  try {
    await Promise.race([Promise.all([document.fonts.load('400 120px "Instrument Serif"'), document.fonts.load('700 120px "Noto Serif JP"', ideogrammes)]),
      new Promise((ok) => setTimeout(ok, 2500))]);
  } catch (e) { /* polices de secours */ }
  avancer(30);
  for (let i = 0; i < N; i++) construireSalle(SALLES[i], i);
  estampe("vague", 2.7, 2.7 * 453 / 676, angleDe(N - 1) + Math.PI / N, false);    // entre la dernière porte et la première
  estampe("samourai", 1.3, 1.3 * 547 / 365, angleDe(3) + Math.PI / N, true);       // entre les portes IV et V
  avancer(80);
  const depart = Math.max(0, SALLES.findIndex((s) => `#${s.id}` === location.hash));
  cam.index = depart; cam.theta = angleDe(depart);
  eclairer(depart);
  majRotonde();
  placerCamera();
  renderer.compile(scene, camera);
  avancer(100);
  boucle();
  await new Promise((ok) => setTimeout(ok, 700));
  $("#attente").classList.add("fini");
  await tween(cam, "s", 0, 2.6);
  cam.occupe = false;
  if (location.hash && SALLES[depart] && `#${SALLES[depart].id}` === location.hash) entrer();
  else if (!lire("nikkei-aide-vue")) $("#aide").hidden = false;
}
couleurUI(true);
// pour inspecter la scène depuis la console ; __visite.instant(i) pose la caméra dans la salle i sans animation
function instant(i) {
  tweens.length = 0;
  cam.index = i; cam.theta = angleDe(i); cam.s = S_SALLE; cam.dansSalle = true; cam.occupe = false;
  eclairer(i); majCartel(); majRotonde();
  projecteur.intensity = 70;
  salles.forEach((s, j) => (s.titre.material.opacity = j === i ? s.titre.userData.opacite : 0));
  nav.classList.add("cache"); ui.classList.add("visible"); document.body.classList.add("dans-salle");
  couleurUI(encre(SALLES[i].ton.mur));
  placerCamera(); renderer.render(scene, camera);
}
window.__visite = { renderer, scene, camera, cam, aller, entrer, sortir, voisine, instant };
demarrer();
