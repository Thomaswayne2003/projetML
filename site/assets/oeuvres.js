// Les sept œuvres de la visite. Chacune est construite à partir des données du projet (window.NIKKEI).
import * as THREE from "../vendor/three.module.min.js";
import { D } from "./contenu.js";

// ---------- matières ----------
export const MATIERES = {
  ceramique: new THREE.MeshPhysicalMaterial({ color: 0xebe5dc, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.9 }),
  blanche: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.9 }),
  ceramiqueTeintee: new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.46, clearcoat: 0.35, clearcoatRoughness: 0.45, envMapIntensity: 0.9 }),
  basalte: new THREE.MeshPhysicalMaterial({ color: 0x3a3632, roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5, envMapIntensity: 0.7 }),
  socle: new THREE.MeshStandardMaterial({ color: 0xded7cd, roughness: 0.88, envMapIntensity: 0.6 }),
  encre: new THREE.MeshPhysicalMaterial({ color: 0x24221f, roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 1 }),
  pin: new THREE.MeshStandardMaterial({ color: 0x4f8a72, roughness: 0.6 }),
  argile: new THREE.MeshStandardMaterial({ color: 0xb4694a, roughness: 0.6 }),
  pierre: new THREE.MeshStandardMaterial({ color: 0xcfc7bc, roughness: 0.75 }),
  sillon: new THREE.MeshStandardMaterial({ color: 0x8c8178, roughness: 0.7 }),
};

// ---------- petites formes utiles ----------
export function boiteArrondie(l, h, p, r = 0.03, segments = 3) {
  const s = new THREE.Shape();
  const x = -l / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + l - r, y); s.quadraticCurveTo(x + l, y, x + l, y + r);
  s.lineTo(x + l, y + h - r); s.quadraticCurveTo(x + l, y + h, x + l - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(p - 2 * r, 0.001), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: segments, curveSegments: 6 });
  g.translate(0, 0, -(p - 2 * r) / 2);
  g.computeVertexNormals();
  return g;
}

function ombres(objet) { objet.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return objet; }

function socleRond(r, h) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 96), MATIERES.socle);
  m.position.y = h / 2;
  return m;
}
function socleCarre(l, h, p) {
  const m = new THREE.Mesh(boiteArrondie(l, h, p, 0.025), MATIERES.socle);
  m.position.y = h / 2;
  return m;
}

const lisser = (v, k) => v.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (v[j] != null) { s += v[j]; n++; } return s / n; });

// ---------- I. Le vase des 201 mois ----------
function vase() {
  const g = new THREE.Group();
  const H0 = 0.78;
  g.add(socleRond(0.82, H0));
  const c = lisser(D.serie.map((m) => m.cloture), 3);
  const min = Math.min(...c), max = Math.max(...c);
  const hauteur = 2.25, n = c.length;
  const rayon = (v) => 0.26 + 0.5 * Math.sqrt((v - min) / (max - min));
  const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(rayon(c[0]) * 0.9, 0), new THREE.Vector2(rayon(c[0]), 0.03)];
  c.forEach((v, k) => pts.push(new THREE.Vector2(rayon(v), 0.04 + (k / (n - 1)) * hauteur)));
  const rh = rayon(c[n - 1]);
  pts.push(new THREE.Vector2(rh + 0.035, hauteur + 0.07), new THREE.Vector2(rh + 0.01, hauteur + 0.1), new THREE.Vector2(rh - 0.04, hauteur + 0.08), new THREE.Vector2(rh - 0.07, hauteur - 0.25));
  const corps = new THREE.Mesh(new THREE.LatheGeometry(pts, 180), MATIERES.ceramique);
  corps.position.y = H0;
  g.add(corps);
  // deux sillons : début de la validation et début du test
  for (const bloc of ["validation", "test"]) {
    const k = D.serie.findIndex((m) => m.bloc === bloc);
    const y = 0.04 + (k / (n - 1)) * hauteur;
    const sillon = new THREE.Mesh(new THREE.TorusGeometry(rayon(c[k]) - 0.002, 0.007, 8, 180), MATIERES.sillon);
    sillon.rotation.x = Math.PI / 2;
    sillon.position.y = H0 + y;
    g.add(sillon);
  }
  return ombres(g);
}

// ---------- II. La pile des mois ----------
function pile() {
  const g = new THREE.Group();
  const H0 = 0.7;
  g.add(socleCarre(1.75, H0, 1.75));
  const c = D.serie.map((m) => m.cloture);
  const n = c.length, ep = 0.0102, pas = 0.0116;
  const disques = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, ep, 72), MATIERES.blanche, n);
  const m4 = new THREE.Matrix4(), clair = new THREE.Color(0xf1ece4), sombre = new THREE.Color(0x8e8378);
  for (let k = 0; k < n; k++) {
    const r = k === 0 ? 0 : c[k] / c[k - 1] - 1;
    const a = k * 0.085, ecart = Math.min(Math.abs(r) * 3.4, 0.42);
    m4.makeTranslation(Math.cos(a) * ecart, H0 + ep / 2 + k * pas, Math.sin(a) * ecart);
    disques.setMatrixAt(k, m4);
    disques.setColorAt(k, r < 0 ? sombre : clair);
  }
  disques.instanceColor.needsUpdate = true;
  g.add(disques);
  return ombres(g);
}

// ---------- III. Le paysage du coût ----------
function paysage(etat) {
  const g = new THREE.Group();
  const H0 = 0.72, L = 2.5, HMAX = 0.85, N = D.surface.axe.length - 1;
  etat.vue = { oeil: 3.1, cible: 1.15, titre: 2.9 };   // regarder la surface d'en haut
  g.add(socleCarre(L + 0.12, H0, L + 0.12));
  const cout = D.surface.cout;
  const plat = cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const haut = (v) => Math.pow((v - cmin) / (cmax - cmin), 0.55) * HMAX + 0.04;
  const geo = new THREE.PlaneGeometry(L, L, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++) pos.setY(iy * (N + 1) + ix, haut(cout[N - iy][ix]));
  geo.computeVertexNormals();
  // courbes de niveau gravées dans la céramique
  const T = 512, toile = document.createElement("canvas");
  toile.width = toile.height = T;
  const ctx = toile.getContext("2d"), img = ctx.createImageData(T, T);
  const hauteurUV = (u, v) => {   // u de gauche à droite (w1), v de bas en haut (w2)
    const fx = u * N, fy = v * N, x = Math.min(Math.floor(fx), N - 1), y = Math.min(Math.floor(fy), N - 1), a = fx - x, b = fy - y;
    const c = cout[y][x] * (1 - a) * (1 - b) + cout[y][x + 1] * a * (1 - b) + cout[y + 1][x] * (1 - a) * b + cout[y + 1][x + 1] * a * b;
    return Math.pow((c - cmin) / (cmax - cmin), 0.55);
  };
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const h0 = hauteurUV(i / (T - 1), 1 - j / (T - 1)) * 16, f = h0 - Math.floor(h0);
    const trait = f < 0.07 || f > 0.97;
    const k = (j * T + i) * 4, v = trait ? 168 : 236 + Math.round((1 - h0 / 16) * 10);
    img.data[k] = v; img.data[k + 1] = v - 4; img.data[k + 2] = v - 10; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(toile);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const dessus = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: tex, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 }));
  dessus.position.y = H0;
  g.add(dessus);
  // flancs : du bord de la surface jusqu'au socle
  const flancs = [], idx = [];
  const bord = (ix, iy) => { const i = iy * (N + 1) + ix; return [pos.getX(i), pos.getY(i), pos.getZ(i)]; };
  const cotes = [
    [...Array(N + 1).keys()].map((i) => bord(i, 0)), [...Array(N + 1).keys()].map((i) => bord(N, i)),
    [...Array(N + 1).keys()].map((i) => bord(N - i, N)), [...Array(N + 1).keys()].map((i) => bord(0, N - i)),
  ];
  for (const cote of cotes) {
    const base = flancs.length / 3;
    cote.forEach(([x, y, z]) => flancs.push(x, y, z, x, 0, z));
    for (let i = 0; i < cote.length - 1; i++) { const a = base + 2 * i; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const gf = new THREE.BufferGeometry();
  gf.setAttribute("position", new THREE.Float32BufferAttribute(flancs, 3));
  gf.setIndex(idx);
  gf.computeVertexNormals();
  const cotesMesh = new THREE.Mesh(gf, new THREE.MeshPhysicalMaterial({ color: 0xe2dbd0, roughness: 0.6, side: THREE.DoubleSide, clearcoat: 0.2 }));
  cotesMesh.position.y = H0;
  g.add(cotesMesh);
  // la descente de gradient
  // les pas de la descente, reliés en ligne droite dans le plan (w1, w2) puis posés sur la surface
  const lim = D.surface.axe[N];
  const coutEn = (w1, w2) => {   // interpolation bilinéaire dans la grille (lignes : w2, colonnes : w1)
    const fx = THREE.MathUtils.clamp(((w1 + lim) / (2 * lim)) * N, 0, N - 1e-6), fy = THREE.MathUtils.clamp(((w2 + lim) / (2 * lim)) * N, 0, N - 1e-6);
    const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
    return cout[y][x] * (1 - u) * (1 - v) + cout[y][x + 1] * u * (1 - v) + cout[y + 1][x] * (1 - u) * v + cout[y + 1][x + 1] * u * v;
  };
  const pas = [];
  for (const p of D.surface.trajectoires["classique (1/L)"].points) {
    const der = pas[pas.length - 1];
    if (!der || Math.hypot(p[0] - der[0], p[1] - der[1]) > 0.01) pas.push(p);
  }
  const points = [];
  for (let i = 0; i < pas.length - 1; i++) for (let k = 0; k < 24; k++) {
    const u = k / 24, w1 = pas[i][0] + (pas[i + 1][0] - pas[i][0]) * u, w2 = pas[i][1] + (pas[i + 1][1] - pas[i][1]) * u;
    points.push(new THREE.Vector3((w1 / lim) * (L / 2), H0 + haut(coutEn(w1, w2)) + 0.012, -(w2 / lim) * (L / 2)));
  }
  const fin = pas[pas.length - 1];
  points.push(new THREE.Vector3((fin[0] / lim) * (L / 2), H0 + haut(coutEn(fin[0], fin[1])) + 0.012, -(fin[1] / lim) * (L / 2)));
  const chemin = new THREE.CatmullRomCurve3(points);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(chemin, 120, 0.011, 8, false), MATIERES.encre));
  const bille = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 24), MATIERES.encre);
  g.add(bille);
  etat.animer = (t) => {
    const u = (t % 7) / 7;
    const k = u < 0.75 ? 1 - Math.pow(1 - u / 0.75, 3) : 1;
    bille.position.copy(chemin.getPointAt(k)).add(new THREE.Vector3(0, 0.06, 0));
  };
  etat.animer(0);
  return ombres(g);
}

// ---------- IV. Le cadran ----------
function cadran() {
  const g = new THREE.Group();
  const H0 = 0.62, TIGE = 0.42;
  g.add(socleRond(0.78, H0));
  const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, TIGE, 48), MATIERES.socle);
  tige.position.y = H0 + TIGE / 2;
  g.add(tige);
  const plateau = new THREE.Group();
  plateau.position.y = H0 + TIGE + 0.08;
  plateau.rotation.x = 0.24;   // incliné vers le visiteur
  g.add(plateau);
  plateau.add(new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.36, 0.12, 128), MATIERES.ceramique));
  const { theta_a, theta_v } = D.decision.seuils;
  const angle = (p) => Math.PI * (1 - p);   // p = 0 à gauche, p = 1 à droite, par le fond
  const secteur = (p0, p1, mat) => {
    const s = new THREE.Shape();
    const r0 = 0.82, r1 = 1.24;
    s.absarc(0, 0, r1, angle(p1), angle(p0), false);
    s.absarc(0, 0, r0, angle(p0), angle(p1), true);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false, curveSegments: 64 });
    geo.rotateX(-Math.PI / 2);    // le plan (x, y) devient (x, −z) : le fond du cadran
    const m = new THREE.Mesh(geo, mat);
    m.position.y = 0.06;
    return m;
  };
  plateau.add(secteur(0, theta_v, MATIERES.argile), secteur(theta_v, theta_a, MATIERES.pierre), secteur(theta_a, 1, MATIERES.pin));
  // deux ailettes aux seuils
  for (const p of [theta_v, theta_a]) {
    const a = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.014), MATIERES.basalte);
    a.position.set(Math.cos(angle(p)) * 1.03, 0.1, -Math.sin(angle(p)) * 1.03);
    a.rotation.y = angle(p);
    plateau.add(a);
  }
  // une perle par mois de test, à sa probabilité ; claire si le mois a monté
  const parAngle = new Map();
  for (const m of D.historique_test) {
    const cle = Math.round(m.p_hausse * 120);
    const rang = parAngle.get(cle) ?? 0; parAngle.set(cle, rang + 1);
    const perle = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), m.hausse_realisee ? MATIERES.ceramique : MATIERES.basalte);
    const r = 0.7 - rang * 0.075;
    perle.position.set(Math.cos(angle(m.p_hausse)) * r, 0.1, -Math.sin(angle(m.p_hausse)) * r);
    plateau.add(perle);
  }
  // le style pointe la dernière prévision
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(1.08, 0); s.lineTo(0, 0.72); s.lineTo(0, 0);
  const style = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 }), MATIERES.encre);
  style.geometry.translate(0, 0, -0.0175);
  style.position.y = 0.06;
  style.rotation.y = angle(D.signal.p_hausse);
  plateau.add(style);
  const axe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 32), MATIERES.encre);
  axe.position.y = 0.08;
  plateau.add(axe);
  return ombres(g);
}

// ---------- V. Le cercle des mois de test ----------
function cercle() {
  const g = new THREE.Group();
  const H0 = 0.34;
  g.add(socleRond(1.62, H0));
  const mois = D.historique_test, n = mois.length;
  const ecart = Math.PI / 5, R = 1.25;
  mois.forEach((m, k) => {
    const phi = -Math.PI / 2 - ecart / 2 - (k * (2 * Math.PI - ecart)) / (n - 1);
    const h = 0.22 + Math.abs(m.rendement_achat_couvert) * 8.5;
    const pierre = new THREE.Mesh(boiteArrondie(0.15, h, 0.26, 0.035), m.hausse_realisee ? MATIERES.ceramique : MATIERES.basalte);
    pierre.position.set(Math.cos(phi) * R, H0 + h / 2, -Math.sin(phi) * R);
    pierre.lookAt(0, H0 + h / 2, 0);
    g.add(pierre);
    if (m.action !== "neutre") {
      const pastille = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.018, 28), m.action === "acheter" ? MATIERES.pin : MATIERES.argile);
      pastille.position.set(Math.cos(phi) * (R - 0.27), H0 + 0.01, -Math.sin(phi) * (R - 0.27));
      g.add(pastille);
    }
  });
  return ombres(g);
}

// ---------- VI. Le souffle ----------
class Helice extends THREE.Curve {
  getPoint(t, cible = new THREE.Vector3()) {
    const a = t * 2.7 * Math.PI * 2 + Math.PI / 2;
    return cible.set(Math.cos(a) * 0.6, 0.14 + t * 2.15, Math.sin(a) * 0.6);
  }
}
function souffle() {
  const g = new THREE.Group();
  const H0 = 0.8;
  g.add(socleRond(0.98, H0));
  const serie = lisser(D.volatilite.serie.map((m) => m.reelle ?? m.prevue), 1);
  const n = serie.length;
  const courbe = new Helice();
  const S = 520, RS = 22;
  const cadres = courbe.computeFrenetFrames(S, false);
  const vol = (t) => { const x = t * (n - 1), i = Math.floor(x), f = x - i; return serie[i] * (1 - f) + serie[Math.min(i + 1, n - 1)] * f; };
  const pos = [], col = [], idx = [];
  const clair = new THREE.Color(0xf1ece4), agite = new THREE.Color(0xb98a72), cc = new THREE.Color();
  for (let i = 0; i <= S; i++) {
    const t = i / S, P = courbe.getPointAt(t), N = cadres.normals[i], B = cadres.binormals[i];
    const v = vol(t), r = 0.028 + Math.max(v - 0.06, 0) * 0.3;
    cc.copy(clair).lerp(agite, THREE.MathUtils.smoothstep(v, 0.17, 0.26));
    for (let j = 0; j <= RS; j++) {
      const a = (j / RS) * Math.PI * 2;
      pos.push(P.x + r * (Math.cos(a) * N.x + Math.sin(a) * B.x), P.y + r * (Math.cos(a) * N.y + Math.sin(a) * B.y), P.z + r * (Math.cos(a) * N.z + Math.sin(a) * B.z));
      col.push(cc.r, cc.g, cc.b);
    }
  }
  for (let i = 0; i < S; i++) for (let j = 0; j < RS; j++) {
    const a = i * (RS + 1) + j, b = (i + 1) * (RS + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tube = new THREE.Mesh(geo, MATIERES.ceramiqueTeintee);
  tube.position.y = H0;
  g.add(tube);
  for (const t of [0, 1]) {
    const bout = new THREE.Mesh(new THREE.SphereGeometry(0.028 + Math.max(vol(t) - 0.06, 0) * 0.3, 24, 16), MATIERES.ceramique);
    bout.position.copy(courbe.getPointAt(t)).add(new THREE.Vector3(0, H0, 0));
    g.add(bout);
  }
  return ombres(g);
}

// ---------- VII. Les volumes ----------
function volumes() {
  const g = new THREE.Group();
  const H0 = 0.82;
  g.add(socleCarre(1.95, H0, 1.45));
  const k = 1.32;
  const livres = [
    [1.28, 0.17, 0.92, 0x5e4a3e], [1.2, 0.12, 0.86, 0x34413f],                         // rapport, annexe de maths
    [1.1, 0.075, 0.8, 0xe8e1d6], [1.08, 0.07, 0.79, 0xd9cfc1], [1.1, 0.08, 0.8, 0xece6dd],
    [1.06, 0.07, 0.78, 0xcfc4b5], [1.09, 0.075, 0.8, 0xe3dbcf], [1.07, 0.07, 0.78, 0xd6ccbe], // six notebooks
  ].map(([l, h, p, c]) => [l * k, h * k, p * k, c]);
  let y = H0;
  livres.forEach(([l, h, p, c], i) => {
    const b = new THREE.Mesh(boiteArrondie(l, h, p, 0.012, 2), new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.7, clearcoat: 0.1 }));
    b.position.set(Math.sin(i * 1.7) * 0.03, y + h / 2, Math.cos(i * 2.3) * 0.025);
    b.rotation.y = Math.sin(i * 2.1) * 0.12;
    y += h;
    g.add(b);
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 48, 32), MATIERES.encre);
  sphere.position.set(0.18, y + 0.2, 0.06);
  g.add(sphere);
  return ombres(g);
}

export const OEUVRES = { question: vase, donnees: pile, apprentissage: paysage, regle: cadran, epreuve: cercle, agitation: souffle, cabinet: volumes };

// ---------- les tableaux du mur du fond : un dégradé et une seule courbe tirée des données ----------
export function seriePourTableau(id) {
  const norm = (v) => { const a = Math.min(...v), b = Math.max(...v); return v.map((x) => (x - a) / (b - a || 1)); };
  if (id === "question") return { ligne: norm(D.serie.map((m) => m.cloture)) };
  if (id === "donnees") { const c = D.serie.map((m) => m.cloture); return { barres: c.slice(1).map((v, i) => v / c[i] - 1) }; }
  if (id === "apprentissage") return { points: D.essais.filter((e) => e.cible === "nikkei").map((e) => Math.min(e.logloss, 0.9)) };
  if (id === "regle") return { ligne: D.historique_validation.concat(D.historique_test).map((m) => m.p_hausse), seuils: [D.decision.seuils.theta_v, D.decision.seuils.theta_a] };
  if (id === "epreuve") {
    let a = 1, b = 1; const ca = [], cb = [];
    for (const m of D.historique_test) { a *= 1 + m.rendement_achat_couvert; b *= 1 + m.rendement_regle; ca.push(a); cb.push(b); }
    const tout = norm(ca.concat(cb));
    return { ligne: tout.slice(0, ca.length), ligne2: tout.slice(ca.length) };
  }
  if (id === "agitation") return { ligne: norm(D.volatilite.serie.map((m) => m.reelle ?? m.prevue)) };
  return {};
}
