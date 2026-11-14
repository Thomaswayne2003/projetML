/* Projet Nikkei — les formes 3D du nuage de particules, partagées par l'expérience (/) et le récit (/recit).
   Chaque forme renvoie [x, y, z, r, v, b] pour la particule i. */
export const N = 16000;
export const h = (i, s) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };   // hasard reproductible
export const ENCRE = [0.085, 0.07, 0.06], VERMILLON = [0.87, 0.2, 0.12], INDIGO = [0.15, 0.25, 0.49], GRIS = [0.5, 0.47, 0.43];
export const melange = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

/* ---------- Les huit formes : chaque fonction renvoie [x, y, z, r, v, b] pour la particule i ---------- */
export function enso(i) {                                   // le cercle tracé au pinceau, ouvert en haut à droite
  if (h(i, 9) < 0.04) { const a = h(i, 1) * 6.283, d = 0.3 + h(i, 2) * 0.9; return [2.0 + Math.cos(a) * d, 1.5 + Math.sin(a) * d * 0.7, (h(i, 3) - 0.5) * 0.3, ...ENCRE]; }
  const u = h(i, 1), angle = 0.75 - u * 5.75, epaisseur = 0.07 + 0.36 * Math.pow(Math.sin(u * 3.1416), 0.8) * (1 - 0.45 * u);
  const r = 2.35 + (h(i, 2) + h(i, 3) - 1) * epaisseur;
  return [Math.cos(angle) * r, Math.sin(angle) * r, (h(i, 4) - 0.5) * 0.25, ...melange(ENCRE, GRIS, h(i, 5) * 0.35)];
}
export function relief(serie) {                             // le Nikkei 2010 → 2026, en échelle log
  const n = serie.length, logs = serie.map((d) => Math.log(d.cloture)), min = Math.min(...logs), max = Math.max(...logs);
  const teinte = { "entraînement": ENCRE, validation: INDIGO, test: VERMILLON, "à prédire": VERMILLON };
  return (i) => {
    const j = Math.min(n - 1, Math.floor(h(i, 1) * n)), haut = ((logs[j] - min) / (max - min)) * 3.0 + 0.25, u = h(i, 2);
    const y = haut * (u < 0.3 ? 1 - h(i, 6) * 0.03 : Math.sqrt(h(i, 3)));          // 30 % des gouttes dessinent la crête
    return [(j / (n - 1) - 0.5) * 6.6, y - 1.7, (h(i, 4) - 0.5) * (u < 0.3 ? 0.9 : 0.9), ...melange(teinte[serie[j].bloc], GRIS, u < 0.3 ? 0 : 0.35)];
  };
}
export function blocs(i) {                                  // entraînement 143, validation 24, test 33 : trois blocs dans l'ordre
  const u = h(i, 1), k = u < 0.715 ? 0 : u < 0.835 ? 1 : 2, largeur = [4.0, 0.68, 0.93][k], gauche = [-3.05, 1.2, 2.13][k];
  const face = h(i, 5) < 0.45;                       // une partie des gouttes sur les arêtes, pour dessiner les volumes
  const x = gauche + h(i, 2) * largeur, y = (face ? Math.round(h(i, 3)) : h(i, 3)) * 2.3 - 1.25, z = (face ? Math.round(h(i, 4)) : h(i, 4)) * 1.3 - 0.65;
  return [x, y, z, ...[ENCRE, INDIGO, VERMILLON][k]];
}
export function surface(d) {                                // la surface de coût et la descente de gradient
  const axe = d.axe, n = axe.length, Jmin = d.optimum[2], Jmax = Math.max(...d.cout.flat()), H = (J) => ((J - Jmin) / (Jmax - Jmin)) * 2.9 - 1.5;
  const trajet = d.trajectoires["trop petit"].points;
  return (i) => {
    if (h(i, 9) < 0.06) {                            // les gouttes vermillon suivent la descente
      const t = h(i, 1) * (trajet.length - 1), a = trajet[Math.floor(t)], b = trajet[Math.min(trajet.length - 1, Math.floor(t) + 1)], f = t - Math.floor(t);
      return [(a[0] + (b[0] - a[0]) * f) * 1.6, H(a[2] + (b[2] - a[2]) * f) + 0.06 + h(i, 2) * 0.05, (a[1] + (b[1] - a[1]) * f) * 1.6, ...VERMILLON];
    }
    const a = Math.floor(h(i, 1) * n), b = Math.floor(h(i, 2) * n), J = d.cout[b][a];
    return [axe[a] * 1.6, H(J), axe[b] * 1.6, ...melange(ENCRE, GRIS, Math.min(1, (J - Jmin) / (Jmax - Jmin) * 1.4))];
  };
}
export function jauge(p, seuils) {                          // l'arc du signal : vendre, neutre, acheter, et l'aiguille à p
  const angle = (v) => (210 - v * 240) * Math.PI / 180;
  return (i) => {
    const u = h(i, 9);
    if (u < 0.16) { const r = h(i, 1) * 2.05, a = angle(p); return [Math.cos(a) * r + (h(i, 2) - 0.5) * 0.07, Math.sin(a) * r - 0.5 + (h(i, 3) - 0.5) * 0.07, (h(i, 4) - 0.5) * 0.1, ...ENCRE]; }
    if (u < 0.22) { const a = h(i, 1) * 6.283, r = Math.sqrt(h(i, 2)) * 0.2; return [Math.cos(a) * r, Math.sin(a) * r - 0.5, 0, ...ENCRE]; }
    const v = h(i, 1), a = angle(v), r = 2.45 + (h(i, 2) - 0.5) * 0.42;
    return [Math.cos(a) * r, Math.sin(a) * r - 0.5, (h(i, 3) - 0.5) * 0.22, ...(v < seuils.theta_v ? VERMILLON : v < seuils.theta_a ? GRIS : INDIGO)];
  };
}
export function verdict(regle, achat) {                     // deux colonnes : la règle du modèle, et « toujours acheter, couvert »
  const petite = Math.max(0.14, (regle / achat) * 3.6);
  return (i) => {
    const grande = h(i, 9) > 0.2, haut = grande ? 3.6 : petite, x = (grande ? 1.05 : -1.05) + (h(i, 1) - 0.5) * 1.1;
    return [x, h(i, 2) * haut - 1.8, (h(i, 3) - 0.5) * 1.1, ...(grande ? VERMILLON : ENCRE)];
  };
}
export function helice(i) {                                 // deux brins qui échangent leurs couleurs à mi-hauteur : la relation se retourne
  const t = h(i, 1), brin = i % 2, echelon = h(i, 9) < 0.14, a = t * 12.566 + brin * Math.PI, r = echelon ? (h(i, 2) * 2 - 1) * 1.15 : 1.15 + (h(i, 2) - 0.5) * 0.16;
  const haut = t > 0.5 ? 1 - brin : brin;
  return [Math.cos(a) * r, (t - 0.5) * 4.6, Math.sin(a) * r, ...(echelon ? GRIS : haut ? VERMILLON : INDIGO)];
}
export function sphere(i) {                                 // la sphère finale : tout le projet, rassemblé
  const coeur = h(i, 9) < 0.14, r = coeur ? 0.55 * Math.cbrt(h(i, 4)) : 2.25, y = 1 - 2 * ((i + 0.5) / N), rayon = Math.sqrt(1 - y * y), a = i * 2.39996;
  return [Math.cos(a) * rayon * r, y * r, Math.sin(a) * rayon * r, ...(coeur ? VERMILLON : melange(ENCRE, GRIS, h(i, 5) * 0.5))];
}
