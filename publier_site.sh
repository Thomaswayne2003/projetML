#!/bin/sh
# Publie le site (dossier site/) sur GitHub Pages : la branche gh-pages reçoit le contenu de site/ tel qu'il est
# dans le dernier commit. À lancer après « python -m app.export_site » et un commit des changements.
#
#     sh publier_site.sh
#
# Le site est ensuite servi à l'adresse https://thomaswayne2003.github.io/projetML/ (une à deux minutes plus tard).
set -e
cd "$(dirname "$0")"

if [ -n "$(git status --porcelain -- site)" ]; then
    echo "Des changements de site/ ne sont pas commités : les commiter d'abord, le site publié est celui du dernier commit."
    exit 1
fi

arbre=$(git rev-parse HEAD:site)
git fetch -q origin gh-pages 2>/dev/null || true
if git rev-parse -q --verify origin/gh-pages >/dev/null; then
    if [ "$(git rev-parse origin/gh-pages^{tree})" = "$arbre" ]; then
        echo "Le site en ligne est déjà à jour."
        exit 0
    fi
    commit=$(git commit-tree "$arbre" -p origin/gh-pages -m "Site publié depuis $(git rev-parse --short HEAD)")
else
    commit=$(git commit-tree "$arbre" -m "Site publié depuis $(git rev-parse --short HEAD)")
fi
git push origin "$commit:refs/heads/gh-pages"
echo "Publié : https://thomaswayne2003.github.io/projetML/"
