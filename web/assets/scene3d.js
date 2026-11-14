/* Projet Nikkei — scènes 3D (Three.js, copie locale : le site fonctionne sans internet).
   1. Accueil : le Nikkei 225 de 2010 à 2026 en relief, coloré par bloc du split.
   2. Maths : la surface de coût J(w1, w2) et la descente de gradient pour quatre pas. */
import * as THREE from "./three.module.min.js";

const IMMOBILE = matchMedia("(prefers-reduced-motion: reduce)").matches;
const api = (route) => fetch("/api.php?" + new URLSearchParams({ route }))
  .then((r) => { if (!r.ok) throw new Error(route); return r.json(); });
const fr = (x, d = 2) => x.toFixed(d).replace(".", ",");

function creerRendu(canvas) {
  const rendu = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  return rendu;
}

/* Ajuste le rendu à la taille de son conteneur, puis dessine en boucle tant que la scène est visible. */
function boucle(rendu, scene, camera, conteneur, image) {
  let visible = true, depart = performance.now(), largeur = 0, hauteur = 0;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(conteneur);
  const dessiner = (maintenant) => {
    const l = conteneur.clientWidth, h = conteneur.clientHeight;
    if (l && h && (l !== largeur || h !== hauteur)) {
      largeur = l; hauteur = h;
      rendu.setSize(l, h, false);
      camera.aspect = l / h;
      camera.updateProjectionMatrix();
    }
    if (visible) {
      image((maintenant - depart) / 1000);
      rendu.render(scene, camera);
    }
    if (!IMMOBILE) requestAnimationFrame(dessiner);
  };
  requestAnimationFrame(dessiner);
  if (IMMOBILE) window.addEventListener("resize", () => requestAnimationFrame(dessiner));
}

/* ------------------------------------------------------------------ 1. Accueil */
async function sceneAccueil() {
  const canvas = document.getElementById("scene-hero");
  if (!canvas) return;
  const entete = canvas.parentElement, hud = document.getElementById("hud-mois");
  const serie = await api("serie");

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 400);
  const rendu = creerRendu(canvas);
  const SOL = -2.2;

  // Ciel de coucher de soleil : un grand plan lointain, coloré selon la hauteur
  const ciel = new THREE.PlaneGeometry(320, 80, 1, 32);
  const etapes = [[0, 0xf08a3c], [5, 0xf3b673], [12, 0xe6cdb8], [24, 0xcfc8d8], [80, 0xbdb7cb]].map(([h, hex]) => [h, new THREE.Color(hex)]);
  const teinteCiel = (h) => {
    const k = Math.max(1, etapes.findIndex(([seuil]) => h <= seuil));
    const [h0, c0] = etapes[k - 1], [h1, c1] = etapes[k];
    return c0.clone().lerp(c1, Math.min(1, Math.max(0, (h - h0) / (h1 - h0))));
  };
  const couleursCiel = new Float32Array(ciel.attributes.position.count * 3);
  for (let k = 0; k < ciel.attributes.position.count; k++) {
    const c = teinteCiel(ciel.attributes.position.getY(k) + 40);
    couleursCiel.set([c.r, c.g, c.b], k * 3);
  }
  ciel.setAttribute("color", new THREE.BufferAttribute(couleursCiel, 3));
  const voute = new THREE.Mesh(ciel, new THREE.MeshBasicMaterial({ vertexColors: true }));
  voute.position.set(0, SOL + 40, -70);
  scene.add(voute);

  const soleil = new THREE.Mesh(new THREE.CircleGeometry(3.4, 64), new THREE.MeshBasicMaterial({ color: 0xfff3d6 }));
  soleil.position.set(-9, SOL + 2.2, -69);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(9, 64), new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.35 }));
  halo.position.set(-9, SOL + 2.2, -69.5);
  scene.add(halo, soleil);

  const sol = new THREE.Mesh(new THREE.PlaneGeometry(600, 300), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  sol.rotation.x = -Math.PI / 2;
  sol.position.y = SOL;
  const quadrillage = new THREE.GridHelper(120, 120, 0x242424, 0x161616);
  quadrillage.position.y = SOL + 0.01;
  scene.add(sol, quadrillage);

  // Le relief : la courbe du Nikkei (échelle log), extrudée en profondeur, en silhouette sur le ciel
  const n = serie.length, LARGEUR = 17, HAUTEUR = 3.9, EPAISSEUR = 1.5;
  const logs = serie.map((d) => Math.log(d.cloture));
  const min = Math.min(...logs), max = Math.max(...logs);
  const X = (i) => (i / (n - 1) - 0.5) * LARGEUR;
  const Y = (i) => ((logs[i] - min) / (max - min)) * HAUTEUR + 0.3;
  const forme = new THREE.Shape();
  forme.moveTo(X(0), 0);
  for (let i = 0; i < n; i++) forme.lineTo(X(i), Y(i));
  forme.lineTo(X(n - 1), 0);
  forme.closePath();
  const geometrie = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR, bevelEnabled: false });
  geometrie.translate(0, 0, -EPAISSEUR / 2);

  const teintes = { "entraînement": 0x5b8cff, validation: 0xffb347, test: 0xb4ff1a, "à prédire": 0xb4ff1a };
  const positions = geometrie.attributes.position, couleurs = new Float32Array(positions.count * 3), c = new THREE.Color();
  for (let k = 0; k < positions.count; k++) {
    const i = Math.min(n - 1, Math.max(0, Math.round((positions.getX(k) / LARGEUR + 0.5) * (n - 1))));
    c.setHex(teintes[serie[i].bloc]).multiplyScalar(0.1 + 0.42 * positions.getY(k) / (HAUTEUR + 0.3));
    couleurs.set([c.r, c.g, c.b], k * 3);
  }
  geometrie.setAttribute("color", new THREE.BufferAttribute(couleurs, 3));
  const relief = new THREE.Mesh(geometrie, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 }));

  const pointsCrete = serie.map((_, i) => new THREE.Vector3(X(i), Y(i) + 0.012, EPAISSEUR / 2 + 0.01));
  const creteGeo = new THREE.BufferGeometry().setFromPoints(pointsCrete);
  const couleursCrete = new Float32Array(n * 3);
  serie.forEach((d, i) => { c.setHex(teintes[d.bloc]); couleursCrete.set([c.r, c.g, c.b], i * 3); });
  creteGeo.setAttribute("color", new THREE.BufferAttribute(couleursCrete, 3));
  const crete = new THREE.Line(creteGeo, new THREE.LineBasicMaterial({ vertexColors: true }));

  // Curseur de lecture : il balaie les 201 mois et alimente l'étiquette en haut à droite
  const balayage = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
    new THREE.LineBasicMaterial({ color: 0xb4ff1a }));
  const repere = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), new THREE.MeshBasicMaterial({ color: 0xb4ff1a }));
  const groupe = new THREE.Group();
  groupe.add(relief, crete, balayage, repere);
  groupe.position.set(1.6, SOL, 0);
  scene.add(groupe);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const contreJour = new THREE.DirectionalLight(0xffc890, 3.2);
  contreJour.position.set(-8, 5, -10);
  const face = new THREE.DirectionalLight(0xffffff, 1.3);
  face.position.set(4, 6, 10);
  scene.add(contreJour, face);

  const souris = { x: 0, y: 0 }, lisse = { x: 0, y: 0 };
  entete.addEventListener("pointermove", (e) => {
    const r = entete.getBoundingClientRect();
    souris.x = (e.clientX - r.left) / r.width - 0.5;
    souris.y = (e.clientY - r.top) / r.height - 0.5;
  });

  let dernier = -1;
  boucle(rendu, scene, camera, entete, (t) => {
    lisse.x += (souris.x - lisse.x) * 0.05;
    lisse.y += (souris.y - lisse.y) * 0.05;
    const defile = Math.min(1, Math.max(0, window.scrollY / Math.max(1, entete.offsetHeight)));   // 0 en haut, 1 quand l'en-tête est passé
    camera.position.set(Math.sin(t * 0.16) * 0.8 + lisse.x * 2.0, 0.5 + defile * 3.4 - lisse.y * 0.8, 13.5 - defile * 6.5);
    camera.lookAt(1.2, 0.25 - defile * 1.2, 0);
    groupe.rotation.y = Math.sin(t * 0.11) * 0.06 - lisse.x * 0.1 + defile * 0.5;
    groupe.scale.y = IMMOBILE ? 1 : 1 - Math.pow(1 - Math.min(1, t / 2.4), 3);      // le relief se dresse à l'ouverture
    const i = IMMOBILE ? n - 1 : Math.floor((t * 14) % n);
    if (i !== dernier) {
      dernier = i;
      balayage.position.set(X(i), 0, EPAISSEUR / 2 + 0.02);
      balayage.scale.y = Y(i) + 0.9;
      repere.position.set(X(i), Y(i), EPAISSEUR / 2 + 0.02);
      if (hud) hud.textContent = `${serie[i].mois} // ${Math.round(serie[i].cloture).toLocaleString("fr-FR")} PTS // ${serie[i].bloc.toUpperCase()}`;
    }
  });
}

/* ------------------------------------------------------------------ 2. Surface de coût */
async function sceneSurface() {
  const boite = document.getElementById("scene-surface");
  if (!boite) return;
  const d = await api("surface");
  const canvas = boite.querySelector("canvas");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 2, 0.1, 100);
  const rendu = creerRendu(canvas);

  const N = d.axe.length, B = d.axe[N - 1], Jmin = d.optimum[2], Jmax = Math.max(...d.cout.flat());
  const H = (J) => ((J - Jmin) / (Jmax - Jmin)) * 2.5;
  const encre = document.body.classList.contains("theme-encre");          // le récit : de l'indigo au vermillon
  const palette = (encre ? [[0, 0x26407c], [0.35, 0x8fa0c8], [0.68, 0xdcc3ae], [1, 0xde3220]] : [[0, 0x2b5c9e], [0.3, 0x3fa7a0], [0.62, 0xf2c14e], [1, 0xc8324b]]).map(([t, hex]) => [t, new THREE.Color(hex)]);
  const teinte = (t) => {
    const k = Math.max(1, palette.findIndex(([seuil]) => t <= seuil));
    const [t0, c0] = palette[k - 1], [t1, c1] = palette[k];
    return c0.clone().lerp(c1, (t - t0) / (t1 - t0));
  };

  const sommets = new Float32Array(N * N * 3), couleurs = new Float32Array(N * N * 3), indices = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i, J = d.cout[j][i], c = teinte(Math.sqrt((J - Jmin) / (Jmax - Jmin)));
    sommets.set([d.axe[i], H(J), d.axe[j]], k * 3);
    couleurs.set([c.r, c.g, c.b], k * 3);
    if (i < N - 1 && j < N - 1) indices.push(k, k + N, k + 1, k + 1, k + N, k + N + 1);
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute("position", new THREE.BufferAttribute(sommets, 3));
  geometrie.setAttribute("color", new THREE.BufferAttribute(couleurs, 3));
  geometrie.setIndex(indices);
  geometrie.computeVertexNormals();

  const monde = new THREE.Group();
  monde.position.y = -1.1;
  monde.add(new THREE.Mesh(geometrie, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.05 })));
  monde.add(new THREE.LineSegments(new THREE.WireframeGeometry(geometrie), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16 })));

  const trait = (a, b) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0x8b90a0 }));
  const coin = new THREE.Vector3(-B, 0, B);
  const bouts = { w1: new THREE.Vector3(B + 0.35, 0, B), w2: new THREE.Vector3(-B, 0, -B - 0.35), J: new THREE.Vector3(-B, 2.9, B) };
  Object.values(bouts).forEach((bout) => monde.add(trait(coin, bout)));

  const bille = (rayon, couleur) => new THREE.Mesh(new THREE.SphereGeometry(rayon, 24, 24), new THREE.MeshStandardMaterial({ color: couleur, roughness: 0.35 }));
  const surSurface = (p, marge = 0.04) => new THREE.Vector3(p[0], H(p[2]) + marge, p[1]);
  const minimum = bille(0.075, 0xb3122f);
  minimum.position.copy(surSurface(d.optimum, 0.05));
  monde.add(minimum);
  scene.add(monde);

  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const lampe = new THREE.DirectionalLight(0xffffff, 1.9);
  lampe.position.set(3, 7, 5);
  scene.add(lampe);

  // Étiquettes des axes, placées en projetant les bouts d'axes sur l'écran
  const etiquettes = { w1: "w₁ · volume d'articles", w2: "w₂ · momentum 12 mois", J: "coût J" };
  const elements = Object.fromEntries(Object.entries(etiquettes).map(([cle, texte]) => {
    const el = Object.assign(document.createElement("span"), { className: "axe", textContent: texte });
    boite.appendChild(el);
    return [cle, el];
  }));

  // Trajectoires de descente
  const trajet = new THREE.Group();
  monde.add(trajet);
  const mobile = bille(0.085, 0x15171f);
  monde.add(mobile);
  let courant = null, debutAnimation = 0;

  const etat = document.getElementById("etat-pas"), choix = document.getElementById("choix-pas");
  function choisir(nom, bouton) {
    courant = d.trajectoires[nom];
    trajet.clear();
    const pts = courant.points.map((p) => surSurface(p));
    trajet.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x15171f })));
    pts.forEach((p, i) => { const b = bille(i ? 0.03 : 0.075, i ? 0x15171f : encre ? 0x15110e : 0xf2c14e); b.position.copy(p); trajet.add(b); });
    courant.pts = pts;
    debutAnimation = performance.now();
    choix.querySelectorAll(".onglet").forEach((o) => o.classList.toggle("actif", o === bouton));
    const arrivee = courant.points.findIndex((p) => Math.abs(p[2] - Jmin) < 1e-3);
    const dernier = courant.points[courant.points.length - 1];
    etat.textContent = `α = ${fr(courant.alpha, 2)} · ` + (courant.converge
      ? `atteint le minimum en ${arrivee} itérations`
      : courant.alpha < 1
        ? `trop lent : après ${courant.points.length} itérations, J = ${fr(dernier[2], 3)} (minimum ${fr(Jmin, 3)})`
        : "ne converge pas : la descente rebondit d'un versant à l'autre");
  }
  Object.keys(d.trajectoires).forEach((nom, i) => {
    const bouton = Object.assign(document.createElement("button"), { className: "onglet", textContent: nom });
    bouton.addEventListener("click", () => choisir(nom, bouton));
    choix.appendChild(bouton);
    if (i === 1) choisir(nom, bouton);          // pas classique affiché d'abord
  });

  // Rotation à la souris ou au doigt ; rotation lente quand on ne touche à rien
  let azimut = -0.75, elevation = 0.5, glisse = null, dernierGeste = -1e9;
  boite.addEventListener("pointerdown", (e) => { glisse = { x: e.clientX, y: e.clientY }; boite.setPointerCapture(e.pointerId); });
  boite.addEventListener("pointermove", (e) => {
    if (!glisse) return;
    azimut -= (e.clientX - glisse.x) * 0.008;
    elevation = Math.min(1.35, Math.max(0.08, elevation + (e.clientY - glisse.y) * 0.006));
    glisse = { x: e.clientX, y: e.clientY };
    dernierGeste = performance.now();
    if (IMMOBILE) requestAnimationFrame(() => { placer(0); rendu.render(scene, camera); });
  });
  ["pointerup", "pointercancel"].forEach((type) => boite.addEventListener(type, () => { glisse = null; }));

  const v = new THREE.Vector3();
  function placer(t) {
    if (!glisse && performance.now() - dernierGeste > 2500 && !IMMOBILE) azimut += 0.0018;
    const r = 7.4;
    camera.position.set(r * Math.cos(elevation) * Math.sin(azimut), r * Math.sin(elevation) - 0.2, r * Math.cos(elevation) * Math.cos(azimut));
    camera.lookAt(0, -0.15, 0);
    if (courant) {       // la bille noire parcourt la trajectoire, puis recommence
      const duree = Math.min(courant.pts.length, 40) * 0.16, pause = 1.4;
      const u = IMMOBILE ? 1 : Math.min(1, (((performance.now() - debutAnimation) / 1000) % (duree + pause)) / duree);
      const x = u * (courant.pts.length - 1), i = Math.min(courant.pts.length - 2, Math.floor(x));
      mobile.position.copy(courant.pts[i]).lerp(courant.pts[i + 1], x - i);
    }
    camera.updateMatrixWorld();
    for (const [cle, el] of Object.entries(elements)) {
      v.copy(bouts[cle]).applyMatrix4(monde.matrixWorld).project(camera);
      el.style.left = `${Math.min(boite.clientWidth - el.offsetWidth - 6, Math.max(6, (v.x * 0.5 + 0.5) * boite.clientWidth - el.offsetWidth / 2))}px`;
      el.style.top = `${Math.min(boite.clientHeight - 26, Math.max(6, (-v.y * 0.5 + 0.5) * boite.clientHeight - 10))}px`;
    }
  }
  boucle(rendu, scene, camera, boite, placer);
}

sceneAccueil().catch((erreur) => console.warn("Scène d'accueil indisponible :", erreur));
sceneSurface().catch((erreur) => {
  const etat = document.getElementById("etat-pas");
  if (etat) etat.textContent = "Scène 3D indisponible : l'API Python ne répond pas.";
  console.warn(erreur);
});
