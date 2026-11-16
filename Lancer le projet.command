#!/bin/zsh
# Double-cliquez sur ce fichier dans le Finder pour lancer le projet Nikkei.
# Une fenêtre Terminal s'ouvre avec un petit menu. Fermez-la (ou Ctrl+C) pour tout arrêter.

cd "$(dirname "$0")" || exit 1
PY=/opt/anaconda3/bin/python3
PHP=/opt/homebrew/bin/php
PORT_API=8001          # le port 8000 est pris par une autre application
PORT_SITE=8080
PORT_NOUVEAU=8095

occupe() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

lancer_site() {
  PIDS=()
  if occupe $PORT_API; then
    echo "L'API tourne déjà sur le port $PORT_API."
  else
    echo "Démarrage de l'API (port $PORT_API)…"
    $PY -m uvicorn app.api:app --port $PORT_API --log-level warning &
    PIDS+=($!)
  fi
  if occupe $PORT_SITE; then
    echo "Le site tourne déjà sur le port $PORT_SITE."
  else
    echo "Démarrage du site (port $PORT_SITE)…"
    NIKKEI_API=http://127.0.0.1:$PORT_API PHP_CLI_SERVER_WORKERS=4 \
      $PHP -S localhost:$PORT_SITE -t web web/router.php >/dev/null 2>&1 &
    PIDS+=($!)
  fi
  trap 'echo; echo "Arrêt des serveurs…"; kill ${PIDS[@]} 2>/dev/null; exit 0' INT TERM HUP EXIT
  for i in {1..30}; do occupe $PORT_API && occupe $PORT_SITE && break; sleep 0.5; done
  open "http://localhost:$PORT_SITE/"
  echo
  echo "Le site est ouvert dans votre navigateur :"
  echo "   accueil 3D   http://localhost:$PORT_SITE/"
  echo "   récit        http://localhost:$PORT_SITE/recit"
  echo "   notebooks    http://localhost:$PORT_SITE/notebooks"
  echo
  echo "Laissez cette fenêtre ouverte. Ctrl+C ou fermer la fenêtre arrête tout."
  wait
}

lancer_nouveau_site() {
  if [ ! -f site/data/donnees.js ]; then
    echo "Préparation des données du site…"
    $PY -m app.export_site || exit 1
  fi
  if occupe $PORT_NOUVEAU; then
    echo "Le site tourne déjà sur le port $PORT_NOUVEAU."
  else
    $PY -m http.server $PORT_NOUVEAU --bind 127.0.0.1 --directory site >/dev/null 2>&1 &
    PID=$!
    trap 'echo; echo "Arrêt du serveur…"; kill $PID 2>/dev/null; exit 0' INT TERM HUP EXIT
    for i in {1..20}; do occupe $PORT_NOUVEAU && break; sleep 0.25; done
  fi
  open "http://localhost:$PORT_NOUVEAU/"
  echo
  echo "Le site est ouvert dans votre navigateur :"
  echo "   visite 3D    http://localhost:$PORT_NOUVEAU/"
  echo "   lecture      http://localhost:$PORT_NOUVEAU/lecture.html"
  echo "   notebooks    http://localhost:$PORT_NOUVEAU/cabinet.html"
  echo
  echo "Laissez cette fenêtre ouverte. Ctrl+C ou fermer la fenêtre arrête tout."
  wait
}

echo "Projet Nikkei : que voulez-vous lancer ?"
echo "  1) Le site : visite 3D et lecture   [Entrée]"
echo "  2) Les tests"
echo "  3) Vérifier que la décision et le test figés n'ont pas bougé"
echo "  4) Jupyter, pour ouvrir les notebooks"
echo "  5) Remettre à jour les données du site (après un changement de résultats ou de notebook)"
echo "  6) L'ancien site PHP (accueil 3D, récit), avec l'API"
read "choix?Votre choix : "

case "${choix:-1}" in
  1) lancer_nouveau_site ;;
  2) $PY -W ignore -m pytest -q ;;
  3) $PY -m src.evaluate --verifier && $PY -m src.decision --verifier ;;
  4) $PY -m jupyter lab notebooks ;;
  5) $PY -m app.export_site ;;
  6) lancer_site ;;
  *) echo "Choix inconnu." ;;
esac
echo
read "?Appuyez sur Entrée pour fermer."
