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

const SERIE = D.v2?.serie ?? D.serie;   // table 1999-2026 (seconde version) si elle est là
const lisser = (v, k) => v.map((_, i) => { let s = 0, n = 0; for (let j = i - k; j <= i + k; j++) if (v[j] != null) { s += v[j]; n++; } return s / n; });

// ---------- I. Le vase des 201 mois ----------
function vase() {
  const g = new THREE.Group();
  const H0 = 0.78;
  g.add(socleRond(0.82, H0));
  const c = lisser(SERIE.map((m) => m.cloture), 3);
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
    const k = SERIE.findIndex((m) => m.bloc === bloc);
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
  const c = SERIE.map((m) => m.cloture);
  const n = c.length, pas = 2.1 / n, ep = pas * 0.86;
  const disques = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.6, 0.6, ep, 72), MATIERES.blanche, n);
  const m4 = new THREE.Matrix4(), clair = new THREE.Color(0xf1ece4), sombre = new THREE.Color(0x8e8378);
  for (let k = 0; k < n; k++) {
    const r = k === 0 ? 0 : c[k] / c[k - 1] - 1;
    const a = k * 0.06, ecart = Math.min(Math.abs(r) * 2.2, 0.26);   // décalage selon l'ampleur du mois, plafonné
    m4.makeTranslation(Math.cos(a) * ecart, H0 + ep / 2 + k * pas, Math.sin(a) * ecart);
    disques.setMatrixAt(k, m4);
    disques.setColorAt(k, r < 0 ? sombre : clair);
  }
  disques.instanceColor.needsUpdate = true;
  g.add(disques);
  return ombres(g);
}

// ---------- la surface de coût, partagée par le paysage et les quatre pas ----------
const SURF = (() => {
  const cout = D.surface.cout, N = D.surface.axe.length - 1, lim = D.surface.axe[N];
  const plat = cout.flat(), cmin = Math.min(...plat), cmax = Math.max(...plat);
  const norm = (c) => Math.pow((c - cmin) / (cmax - cmin), 0.55);
  const coutEn = (w1, w2) => {   // interpolation bilinéaire dans la grille (lignes : w2, colonnes : w1)
    const fx = THREE.MathUtils.clamp(((w1 + lim) / (2 * lim)) * N, 0, N - 1e-6), fy = THREE.MathUtils.clamp(((w2 + lim) / (2 * lim)) * N, 0, N - 1e-6);
    const x = Math.floor(fx), y = Math.floor(fy), u = fx - x, v = fy - y;
    return cout[y][x] * (1 - u) * (1 - v) + cout[y][x + 1] * u * (1 - v) + cout[y + 1][x] * (1 - u) * v + cout[y + 1][x + 1] * u * v;
  };
  return { cout, N, lim, norm, coutEn };
})();

// courbes de niveau gravées dans la céramique (une seule texture pour toutes les tables)
let texCourbes = null;
function courbesDeNiveau() {
  if (texCourbes) return texCourbes;
  const T = 512, toile = document.createElement("canvas");
  toile.width = toile.height = T;
  const ctx = toile.getContext("2d"), img = ctx.createImageData(T, T);
  for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
    const w1 = (i / (T - 1) * 2 - 1) * SURF.lim, w2 = ((1 - j / (T - 1)) * 2 - 1) * SURF.lim;
    const h0 = SURF.norm(SURF.coutEn(w1, w2)) * 16, f = h0 - Math.floor(h0);
    const trait = f < 0.07 || f > 0.97;
    const k = (j * T + i) * 4, v = trait ? 168 : 236 + Math.round((1 - h0 / 16) * 10);
    img.data[k] = v; img.data[k + 1] = v - 4; img.data[k + 2] = v - 10; img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  texCourbes = new THREE.CanvasTexture(toile);
  texCourbes.colorSpace = THREE.SRGBColorSpace;
  texCourbes.anisotropy = 8;
  return texCourbes;
}

// une table de céramique dont le dessus est la surface de coût ; poser(w1, w2) place un point dessus
function tableDeCout(L, HMAX) {
  const g = new THREE.Group(), { N, cout, norm } = SURF;
  const haut = (c) => norm(c) * HMAX + 0.04;
  const geo = new THREE.PlaneGeometry(L, L, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let iy = 0; iy <= N; iy++) for (let ix = 0; ix <= N; ix++) pos.setY(iy * (N + 1) + ix, haut(cout[N - iy][ix]));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: courbesDeNiveau(), roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 })));
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
  g.add(new THREE.Mesh(gf, new THREE.MeshPhysicalMaterial({ color: 0xe2dbd0, roughness: 0.6, side: THREE.DoubleSide, clearcoat: 0.2 })));
  const poser = (w1, w2, dy = 0.012) => new THREE.Vector3((w1 / SURF.lim) * (L / 2), haut(SURF.coutEn(w1, w2)) + dy, -(w2 / SURF.lim) * (L / 2));
  return { g, poser };
}

// les pas d'une descente, reliés en ligne droite dans le plan (w1, w2) puis posés sur la surface
function cheminDescente(cle, poser) {
  const pas = [];
  for (const q of D.surface.trajectoires[cle].points) {
    if (Math.abs(q[0]) > SURF.lim || Math.abs(q[1]) > SURF.lim) break;
    const der = pas[pas.length - 1];
    if (!der || Math.hypot(q[0] - der[0], q[1] - der[1]) > 0.01) pas.push(q);
  }
  const points = [];
  for (let i = 0; i < pas.length - 1; i++) for (let k = 0; k < 24; k++) {
    const u = k / 24;
    points.push(poser(pas[i][0] + (pas[i + 1][0] - pas[i][0]) * u, pas[i][1] + (pas[i + 1][1] - pas[i][1]) * u));
  }
  const fin = pas[pas.length - 1];
  points.push(poser(fin[0], fin[1]));
  return new THREE.CatmullRomCurve3(points);
}

// ---------- Le paysage du coût (Maths V) ----------
function paysage(etat) {
  const g = new THREE.Group();
  const H0 = 0.72, L = 2.5;
  etat.vue = { oeil: 3.1, cible: 1.15, titre: 2.9 };   // regarder la surface d'en haut
  g.add(socleCarre(L + 0.12, H0, L + 0.12));
  const t = tableDeCout(L, 0.85);
  t.g.position.y = H0;
  g.add(t.g);
  const chemin = cheminDescente("classique (1/L)", t.poser);
  t.g.add(new THREE.Mesh(new THREE.TubeGeometry(chemin, 120, 0.011, 8, false), MATIERES.encre));
  const bille = new THREE.Mesh(new THREE.SphereGeometry(0.075, 40, 24), MATIERES.encre);
  t.g.add(bille);
  etat.animer = (temps) => {
    const u = (temps % 7) / 7, k = u < 0.75 ? 1 - Math.pow(1 - u / 0.75, 3) : 1;
    bille.position.copy(chemin.getPointAt(k)).add(new THREE.Vector3(0, 0.06, 0));
  };
  etat.animer(0);
  return ombres(g);
}

// ---------- Les quatre pas (Maths VI) ----------
function quatrePas(etat) {
  const g = new THREE.Group();
  const H0 = 0.6, L = 1.3;
  etat.vue = { oeil: 3.5, cible: 0.9, titre: 3.0 };
  g.add(socleCarre(3.05, H0, 3.05));
  const cles = ["trop petit", "classique (1/L)", "près de la limite", "au-delà de la limite"];
  const places = [[-0.74, -0.74], [0.74, -0.74], [-0.74, 0.74], [0.74, 0.74]];
  const billes = cles.map((cle, i) => {
    const t = tableDeCout(L, 0.5);
    t.g.position.set(places[i][0], H0, places[i][1]);
    g.add(t.g);
    const chemin = cheminDescente(cle, t.poser);
    t.g.add(new THREE.Mesh(new THREE.TubeGeometry(chemin, 160, 0.007, 6, false), MATIERES.encre));
    const bille = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 20), i === 3 ? MATIERES.argile : MATIERES.encre);
    t.g.add(bille);
    return { bille, chemin };
  });
  etat.animer = (temps) => {
    const u = (temps % 8) / 8, k = u < 0.8 ? u / 0.8 : 1;
    for (const { bille, chemin } of billes) bille.position.copy(chemin.getPointAt(k)).add(new THREE.Vector3(0, 0.035, 0));
  };
  etat.animer(0);
  return ombres(g);
}

// ---------- Le champ des essais (Applied ML III) ----------
function essais(etat) {
  const g = new THREE.Group();
  const H0 = 0.5;
  etat.vue = { oeil: 3.3, cible: 0.85, titre: 2.75 };   // vu d'un peu plus haut, pour distinguer les trois rangées
  g.add(socleCarre(2.9, H0, 2.0));
  const modeles = ["logit", "rf", "lgbm"];
  const tige = new THREE.CylinderGeometry(0.011, 0.011, 1, 10);
  tige.translate(0, 0.5, 0);
  const n = D.essais.filter((e) => e.cible === "nikkei").length;
  const champ = new THREE.InstancedMesh(tige, MATIERES.ceramique, n);
  const m4 = new THREE.Matrix4();
  let k = 0;
  modeles.forEach((mod, r) => {
    const z = (r - 1) * 0.62;
    D.essais.filter((e) => e.cible === "nikkei" && e.modele === mod).forEach((e, j, tous) => {
      const x = -1.25 + (j / (tous.length - 1)) * 2.5;
      const h = 0.12 + Math.max(0, 0.95 - e.logloss) * 4.2;
      if (e.retenu) {
        const retenu = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, h, 20).translate(0, h / 2, 0), MATIERES.argile);
        retenu.position.set(x, H0, z);
        g.add(retenu);
        const tete = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), MATIERES.argile);
        tete.position.set(x, H0 + h, z);
        g.add(tete);
        m4.makeScale(0, 0, 0);
      } else {
        m4.makeScale(1, h, 1).setPosition(x, H0, z);
      }
      champ.setMatrixAt(k++, m4);
    });
  });
  champ.count = k;
  g.add(champ);
  // trois réglettes au pied de chaque rangée
  modeles.forEach((_, r) => {
    const reglette = new THREE.Mesh(boiteArrondie(2.62, 0.02, 0.07, 0.008, 1), MATIERES.basalte);
    reglette.position.set(0, H0 + 0.01, (r - 1) * 0.62 + 0.08);
    g.add(reglette);
  });
  return ombres(g);
}

// ---------- La sigmoïde (Maths I) ----------
const sigma = (u) => 1 / (1 + Math.exp(-u));
function sigmoide() {
  const g = new THREE.Group();
  const H0 = 0.62, LX = 1.45, U = 5, HAUT = 1.55;
  g.add(socleCarre(3.2, H0, 0.8));
  const s = new THREE.Shape();
  s.moveTo(-LX, 0);
  for (let i = 0; i <= 120; i++) { const x = -LX + (2 * LX * i) / 120; s.lineTo(x, 0.12 + sigma((x / LX) * U) * HAUT); }
  s.lineTo(LX, 0); s.lineTo(-LX, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -0.17);
  const bloc = new THREE.Mesh(geo, MATIERES.ceramique);
  bloc.position.y = H0;
  g.add(bloc);
  // une perle par mois de validation et de test, à son score u = logit(p de baisse)
  const places = new Map();
  for (const m of D.historique_validation.concat(D.historique_test)) {
    const p = 1 - m.p_hausse, u = Math.log(p / (1 - p)), x = (u / U) * LX;
    const cle = Math.round(x / 0.07);
    const rang = places.get(cle) ?? 0; places.set(cle, rang + 1);
    const perle = new THREE.Mesh(new THREE.SphereGeometry(0.034, 20, 14), m.hausse_realisee ? MATIERES.ceramique : MATIERES.basalte);
    // les perles d'un même score se rangent dans l'épaisseur du bloc, puis s'empilent
    perle.position.set(x, H0 + 0.12 + sigma(u) * HAUT + 0.05 + Math.floor(rang / 4) * 0.066, -0.12 + (rang % 4) * 0.08);
    g.add(perle);
  }
  return ombres(g);
}

// ---------- Les deux branches de la log-loss (Maths II) ----------
function branches() {
  const g = new THREE.Group();
  const H0 = 0.55, LX = 1.35, K = 0.5;
  g.add(socleCarre(3.0, H0, 0.9));
  const x = (p) => (p - 0.5) * 2 * LX;
  const courbe = (perte) => new THREE.CatmullRomCurve3([...Array(61).keys()].map((i) => {
    const p = 0.03 + (0.94 * i) / 60;
    return new THREE.Vector3(x(p), H0 + 0.08 + perte(p) * K, 0);
  }));
  const siBaisse = courbe((p) => -Math.log(p)), siHausse = courbe((p) => -Math.log(1 - p));
  const a = new THREE.Mesh(new THREE.TubeGeometry(siBaisse, 200, 0.035, 14, false), MATIERES.basalte);
  const b = new THREE.Mesh(new THREE.TubeGeometry(siHausse, 200, 0.035, 14, false), MATIERES.ceramique);
  a.position.z = -0.12; b.position.z = 0.12;
  g.add(a, b);
  for (const [c, z] of [[siBaisse, -0.12], [siHausse, 0.12]]) for (const t of [0, 1]) {
    const bout = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), z < 0 ? MATIERES.basalte : MATIERES.ceramique);
    bout.position.copy(c.getPointAt(t)); bout.position.z = z; g.add(bout);
  }
  // les 33 mois de test, à la perte payée : sur la branche « baisse » si le mois a baissé
  for (const m of D.historique_test) {
    const p = 1 - m.p_hausse, y = m.hausse_realisee ? 0 : 1, perte = y ? -Math.log(p) : -Math.log(1 - p);
    const perle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), MATIERES.argile);
    perle.position.set(x(p), H0 + 0.08 + perte * K + 0.06, y ? -0.12 : 0.12);
    g.add(perle);
  }
  return ombres(g);
}

// ---------- La carte des pentes (Maths III) ----------
function pentes(etat) {
  const g = new THREE.Group();
  const H0 = 0.78, L = 2.4;
  etat.vue = { oeil: 3.2, cible: 1.0, titre: 2.9 };
  g.add(socleCarre(L * 0.7, H0 - 0.06, L * 0.7));
  const plaque = new THREE.Mesh(boiteArrondie(L, L, 0.08, 0.02, 2), [MATIERES.socle]);
  plaque.geometry.rotateX(-Math.PI / 2);
  // la face du dessus porte les courbes de niveau
  const dessus = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.04, L - 0.04), new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: courbesDeNiveau(), roughness: 0.5, clearcoat: 0.25 }));
  dessus.rotation.x = -Math.PI / 2;
  dessus.position.y = H0 + 0.041;
  plaque.material = MATIERES.socle;
  plaque.position.y = H0;
  g.add(plaque, dessus);
  const { lim, coutEn } = SURF, h = 0.02, n = 9, fleches = [];
  let gmax = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const w1 = (-1 + (2 * (i + 0.5)) / n) * lim * 0.95, w2 = (-1 + (2 * (j + 0.5)) / n) * lim * 0.95;
    const g1 = (coutEn(w1 + h, w2) - coutEn(w1 - h, w2)) / (2 * h), g2 = (coutEn(w1, w2 + h) - coutEn(w1, w2 - h)) / (2 * h);
    const norme = Math.hypot(g1, g2);
    gmax = Math.max(gmax, norme);
    fleches.push({ w1, w2, g1, g2, norme });
  }
  for (const f of fleches) {
    if (f.norme < 1e-6) continue;
    const longueur = 0.06 + 0.16 * Math.sqrt(f.norme / gmax);
    const dir = new THREE.Vector3(-f.g1, 0, f.g2).normalize();   // −∇J, avec l'axe w2 vers le fond
    const fleche = new THREE.Group();
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, longueur, 8), MATIERES.encre);
    tige.position.y = longueur / 2;
    const pointe = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 12), MATIERES.encre);
    pointe.position.y = longueur + 0.022;
    fleche.add(tige, pointe);
    fleche.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    fleche.position.set((f.w1 / lim) * (L / 2) - dir.x * longueur / 2, H0 + 0.065, -(f.w2 / lim) * (L / 2) - dir.z * longueur / 2);
    g.add(fleche);
  }
  return ombres(g);
}

// ---------- La cloche du prior (Maths IV) ----------
function cloche() {
  const g = new THREE.Group();
  const H0 = 0.6, LX = 1.4, WMAX = 0.6, HAUT = 1.5;
  const tau = Math.sqrt(D.modele.C);
  g.add(socleCarre(3.1, H0, 1.0));
  const x = (w) => (w / WMAX) * LX, densite = (w) => Math.exp(-(w * w) / (2 * tau * tau));
  const s = new THREE.Shape();
  s.moveTo(-LX, 0);
  for (let i = 0; i <= 140; i++) { const w = -WMAX + (2 * WMAX * i) / 140; s.lineTo(x(w), 0.06 + densite(w) * HAUT); }
  s.lineTo(LX, 0); s.lineTo(-LX, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -0.35);
  const bloc = new THREE.Mesh(geo, MATIERES.ceramique);
  bloc.position.y = H0;
  g.add(bloc);
  // les douze poids appris, en tiges devant la cloche
  D.modele.coefficients.forEach((w, k) => {
    const hauteur = 0.06 + densite(w) * HAUT * 0.92;
    const tige = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, hauteur, 10), MATIERES.encre);
    const z = 0.14 + (k % 3) * 0.1;
    tige.position.set(x(w), H0 + hauteur / 2, z);
    const tete = new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 12), w >= 0 ? MATIERES.encre : MATIERES.argile);
    tete.position.set(x(w), H0 + hauteur, z);
    g.add(tige, tete);
  });
  return ombres(g);
}

// ---------- Les deux colonnes : les mois qu'on a, les mois qu'il faudrait (Maths VII) ----------
function colonnes(etat) {
  const g = new THREE.Group();
  const H0 = 0.35, HMAX = 3.1;
  etat.vue = { oeil: 2.0, cible: 1.9, titre: 4.3 };
  g.add(socleCarre(2.2, H0, 1.2));
  const n = D.historique_test.length;
  const pi = (2 * (() => { const h = D.historique_test, pc = 1 - D.evaluation.metriques["constante (fréquence de l'entraînement)"]["proba moyenne"];
    const ll = (p, y) => -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    const d = h.map((m) => ll(m.p_hausse, m.hausse_realisee) - ll(pc, m.hausse_realisee)), moy = d.reduce((a, b) => a + b, 0) / d.length;
    return Math.sqrt(d.reduce((a, b) => a + (b - moy) ** 2, 0) / (d.length - 1)); })()) / 0.02;
  const besoin = Math.ceil(pi * pi), pas = HMAX / besoin;
  // à gauche : les 33 mois de test, empilés
  const pile = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.3, pas * 0.8, 48), MATIERES.ceramique, n);
  const m4 = new THREE.Matrix4();
  for (let k = 0; k < n; k++) { m4.makeTranslation(-0.5, H0 + pas * (k + 0.5), 0); pile.setMatrixAt(k, m4); }
  g.add(pile);
  // à droite : la colonne qu'il faudrait, en verre dépoli, graduée tous les 100 mois
  const verre = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, HMAX, 64), new THREE.MeshPhysicalMaterial({ color: 0xf4efe8, roughness: 0.25, transparent: true, opacity: 0.32, depthWrite: false, clearcoat: 1 }));
  verre.position.set(0.5, H0 + HMAX / 2, 0);
  g.add(verre);
  for (let mois = 100; mois < besoin; mois += 100) {
    const anneau = new THREE.Mesh(new THREE.TorusGeometry(0.302, 0.004, 6, 64), MATIERES.sillon);
    anneau.rotation.x = Math.PI / 2;
    anneau.position.set(0.5, H0 + mois * pas, 0);
    g.add(anneau);
  }
  const niveau = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.008, 8, 64), MATIERES.argile);
  niveau.rotation.x = Math.PI / 2;
  niveau.position.set(0.5, H0 + n * pas, 0);
  g.add(niveau);
  const couvercle = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.02, 64), MATIERES.basalte);
  couvercle.position.set(0.5, H0 + HMAX + 0.01, 0);
  g.add(couvercle);
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


// ---------- La balance des contributions (Applied ML VI) ----------
function balance(etat) {
  const g = new THREE.Group();
  const H0 = 0.45, HAUT = 2.35, DEMI = 1.55;
  g.add(socleRond(0.62, H0));
  const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, HAUT - H0, 24), MATIERES.basalte);
  mat.position.y = (H0 + HAUT) / 2;
  g.add(mat);
  const items = [...(D.explication ?? [])];
  const somme = items.reduce((a, b) => a + b.contribution, 0);
  const fleau = new THREE.Group();
  fleau.position.y = HAUT;
  fleau.rotation.z = -THREE.MathUtils.clamp(somme * 0.12, -0.14, 0.14);   // penche du côté de la baisse si la somme est positive
  g.add(fleau);
  fleau.add(new THREE.Mesh(boiteArrondie(2 * DEMI, 0.05, 0.07, 0.012, 2), MATIERES.encre));
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), MATIERES.encre);
  fleau.add(pivot);
  for (const cote of [1, -1]) {
    const liste = items.filter((it) => (cote > 0 ? it.contribution > 0 : it.contribution <= 0))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    liste.forEach((it, k) => {
      const x = cote * (0.22 + (k * (DEMI - 0.3)) / Math.max(liste.length - 1, 1));
      const r = 0.045 + Math.sqrt(Math.abs(it.contribution)) * 0.2;
      const fil = 0.55 + (k % 3) * 0.2;
      const brin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, fil, 6), MATIERES.encre);
      brin.position.set(x, -fil / 2, 0);
      const poids = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), cote > 0 ? MATIERES.basalte : MATIERES.ceramique);
      poids.position.set(x, -fil - r, 0);
      fleau.add(brin, poids);
    });
  }
  etat.animer = (t) => { fleau.rotation.y = Math.sin(t * 0.35) * 0.18; };
  return ombres(g);
}

export const OEUVRES = {
  dataset: pile, exploration: vase, apprentissage: essais, regle: cadran, epreuve: cercle, explication: balance, apres: souffle,
  "m-modele": sigmoide, "m-cout": branches, "m-gradient": pentes, "m-prior": cloche, "m-convexite": paysage, "m-descente": quatrePas, "m-preuve": colonnes,
};

// ---------- les tableaux du mur du fond : un dégradé et une seule courbe tirée des données ----------
export function seriePourTableau(id) {
  const norm = (v) => { const a = Math.min(...v), b = Math.max(...v); return v.map((x) => (x - a) / (b - a || 1)); };
  if (id === "exploration") return { ligne: norm(SERIE.map((m) => m.cloture)) };
  if (id === "dataset") { const c = SERIE.map((m) => m.cloture); return { barres: c.slice(1).map((v, i) => v / c[i] - 1) }; }
  if (id === "explication") return { barres: [...(D.explication ?? [])].sort((a, b) => b.contribution - a.contribution).map((e) => e.contribution) };
  if (id === "apprentissage") return { points: D.essais.filter((e) => e.cible === "nikkei").map((e) => Math.min(e.logloss, 0.9)) };
  if (id === "regle") return { ligne: D.historique_validation.concat(D.historique_test).map((m) => m.p_hausse), seuils: [D.decision.seuils.theta_v, D.decision.seuils.theta_a] };
  if (id === "epreuve") {
    let a = 1, b = 1; const ca = [], cb = [];
    for (const m of D.historique_test) { a *= 1 + m.rendement_achat_couvert; b *= 1 + m.rendement_regle; ca.push(a); cb.push(b); }
    const tout = norm(ca.concat(cb));
    return { ligne: tout.slice(0, ca.length), ligne2: tout.slice(ca.length) };
  }
  if (id === "apres") return { ligne: norm(D.volatilite.serie.map((m) => m.reelle ?? m.prevue)) };
  const grille = (n, f) => [...Array(n).keys()].map((i) => f(i / (n - 1)));
  if (id === "m-modele") return { ligne: grille(120, (t) => 1 / (1 + Math.exp(-(t * 10 - 5)))) };
  if (id === "m-cout") return { ligne: norm(grille(120, (t) => -Math.log(0.03 + 0.94 * t))), ligne2: norm(grille(120, (t) => -Math.log(1 - 0.03 - 0.94 * t))) };
  if (id === "m-prior") return { ligne: grille(120, (t) => Math.exp(-Math.pow((t - 0.5) * 6, 2) / 2)) };
  if (id === "m-convexite" || id === "m-gradient") return { ligne: norm(D.surface.trajectoires["classique (1/L)"].points.slice(0, 20).map((q) => q[2])) };
  if (id === "m-descente") return { ligne: norm(D.surface.trajectoires["près de la limite"].points.slice(0, 30).map((q) => q[2])), ligne2: norm(D.surface.trajectoires["trop petit"].points.slice(0, 30).map((q) => q[2])) };
  if (id === "m-preuve") {
    const pc = 1 - D.evaluation.metriques["constante (fréquence de l'entraînement)"]["proba moyenne"];
    const ll = (p, y) => -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    let somme = 0;
    return { ligne: norm(D.historique_test.map((m, i) => (somme += ll(m.p_hausse, m.hausse_realisee) - ll(pc, m.hausse_realisee)) / (i + 1))) };
  }
  return {};
}
