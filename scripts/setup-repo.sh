#!/usr/bin/env bash
# ============================================================
# FoodOps — Initialisation & publication du dépôt Git
# Usage :  bash scripts/setup-repo.sh [URL-du-dépôt-GitHub]
# Exemple : bash scripts/setup-repo.sh https://github.com/mon-org/foodops-desktop.git
# ============================================================
set -euo pipefail

VERT='\033[0;32m'; ORANGE='\033[0;33m'; ROUGE='\033[0;31m'; NC='\033[0m'
ok()   { printf "${VERT}✔${NC} %s\n" "$1"; }
info() { printf "${ORANGE}→${NC} %s\n" "$1"; }
err()  { printf "${ROUGE}✘${NC} %s\n" "$1" >&2; }

# ---- Vérifications -----------------------------------------------------------
command -v git >/dev/null 2>&1 || { err "git n'est pas installé (https://git-scm.com)."; exit 1; }

cd "$(dirname "$0")/.."
[ -f package.json ] || { err "package.json introuvable : lancez ce script depuis le projet FoodOps."; exit 1; }

NOM=$(node -p "require('./package.json').name" 2>/dev/null || echo "foodops")
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "3.0.0")
MESSAGE="FoodOps v${VERSION} — ERP F&B offline-first, stock spécifique par site"

# ---- git init ----------------------------------------------------------------
if [ -d .git ]; then
  info "Dépôt Git déjà initialisé."
else
  git init -b main 2>/dev/null || { git init && git checkout -b main; }
  ok "Dépôt Git initialisé (branche main)."
fi

# ---- Identité (locale au dépôt si absente) ------------------------------------
git config user.email >/dev/null 2>&1 || {
  read -rp "   Votre e-mail (pour les commits) : " EMAIL
  git config user.email "$EMAIL"
}
git config user.name >/dev/null 2>&1 || {
  read -rp "   Votre nom : " NOMUSER
  git config user.name "$NOMUSER"
}

# ---- Commit -------------------------------------------------------------------
git add .
if git diff --cached --quiet; then
  info "Aucun changement à commit."
else
  git commit -m "$MESSAGE" >/dev/null
  ok "Commit créé : $MESSAGE"
fi

# ---- Remote & push -------------------------------------------------------------
URL="${1:-}"
if [ -z "$URL" ]; then
  echo ""
  echo "   Créez d'abord un dépôt VIDE sur https://github.com/new"
  echo "   (ne cochez ni README, ni .gitignore, ni licence — ils existent déjà)."
  echo ""
  read -rp "   URL du dépôt GitHub (laissez vide pour terminer sans publier) : " URL
fi

if [ -n "$URL" ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$URL"
  else
    git remote add origin "$URL"
  fi
  ok "Remote origin → $URL"
  info "Publication en cours (git push -u origin main)…"
  if git push -u origin main; then
    ok "Dépôt publié sur GitHub !"
    info "Vérifiez l'onglet Actions : la CI (typage + build) doit se lancer automatiquement."
  else
    err "Échec du push. Depuis août 2021, GitHub exige un token (PAT) ou SSH :"
    echo "     • HTTPS : remplacez votre mot de passe par un token (Settings → Developer settings → Tokens)"
    echo "     • SSH   : utilisez git@github.com:utilisateur/foodops-desktop.git"
    exit 1
  fi
else
  info "Remote non défini. Quand le dépôt GitHub existera :"
  echo "     git remote add origin https://github.com/UTILISATEUR/foodops-desktop.git"
  echo "     git push -u origin main"
fi
