/* Projet Nikkei — la scène 3D de l'annexe de maths (Three.js, copie locale : le site fonctionne sans internet).
   La surface de coût J(w1, w2) et la descente de gradient pour quatre pas. */
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

/* ------------------------------------------------------------------ Surface de coût */
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

sceneSurface().catch((erreur) => {
  const etat = document.getElementById("etat-pas");
  if (etat) etat.textContent = "Scène 3D indisponible : l'API Python ne répond pas.";
  console.warn(erreur);
});
