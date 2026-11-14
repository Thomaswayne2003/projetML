/* Effets communs : curseur d'encre qui suit la souris, et rideau circulaire vermillon entre les pages. */
(() => {
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches, tactile = matchMedia("(hover: none)").matches;

  // ----- Rideau : la page s'ouvre depuis le centre ; un clic sur un lien interne la referme depuis le point cliqué
  const rideau = Object.assign(document.createElement("div"), { className: "rideau" });
  document.body.appendChild(rideau);
  if (!calme && !document.body.hasAttribute("data-sans-rideau")) {
    rideau.classList.add("ferme", "sans-transition");
    void rideau.offsetWidth;                                             // le rideau est d'abord posé fermé
    setTimeout(() => rideau.classList.remove("ferme", "sans-transition"), 60);   // puis il s'ouvre, même si l'onglet se charge en arrière-plan
  }
  addEventListener("pageshow", (e) => { if (e.persisted) rideau.classList.remove("ferme"); });
  document.addEventListener("click", (e) => {
    const lien = e.target.closest("a[href]");
    if (!lien || calme || e.metaKey || e.ctrlKey || e.shiftKey || lien.target === "_blank" || lien.hasAttribute("download")) return;
    const cible = new URL(lien.href, location.href);
    if (cible.origin !== location.origin || (cible.pathname === location.pathname && cible.hash)) return;   // ancres : défilement normal
    e.preventDefault();
    rideau.style.setProperty("--x", `${e.clientX}px`);
    rideau.style.setProperty("--y", `${e.clientY}px`);
    rideau.classList.add("ferme");
    setTimeout(() => { location.href = cible.href; }, 720);
  });

  // ----- Curseur : un point précis et un anneau qui suit avec inertie, grossit sur les éléments cliquables
  if (tactile || calme) return;
  document.documentElement.classList.add("curseur-perso");
  const point = Object.assign(document.createElement("div"), { className: "curseur-point" });
  const anneau = Object.assign(document.createElement("div"), { className: "curseur-anneau" });
  document.body.append(point, anneau);
  let x = innerWidth / 2, y = innerHeight / 2, ax = x, ay = y;
  addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY;
    point.style.transform = `translate(${x}px, ${y}px)`;
    anneau.classList.toggle("survol", !!e.target.closest("a, button, .volet, input, select, .scene"));
  });
  addEventListener("pointerdown", () => anneau.classList.add("appui"));
  addEventListener("pointerup", () => anneau.classList.remove("appui"));
  (function suivre() {
    ax += (x - ax) * 0.16; ay += (y - ay) * 0.16;
    anneau.style.transform = `translate(${ax}px, ${ay}px)`;
    requestAnimationFrame(suivre);
  })();
})();
