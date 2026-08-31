# ============================================================
# FoodOps — Initialisation & publication du dépôt Git (Windows)
# Usage :  powershell -ExecutionPolicy Bypass -File scripts\setup-repo.ps1 [-Url <URL>]
# Exemple : .\scripts\setup-repo.ps1 -Url https://github.com/mon-org/foodops-desktop.git
# ============================================================
param([string]$Url = "")

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Ok($m)   { Write-Host "✔ " -ForegroundColor Green  -NoNewline; Write-Host $m }
function Info($m) { Write-Host "→ " -ForegroundColor Yellow -NoNewline; Write-Host $m }
function Err($m)  { Write-Host "✘ " -ForegroundColor Red    -NoNewline; Write-Host $m }

# ---- Vérifications -------------------------------------------------------------
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Err "git n'est pas installé. Téléchargez-le depuis https://git-scm.com puis relancez."
    exit 1
}
if (-not (Test-Path package.json)) {
    Err "package.json introuvable : lancez ce script depuis le projet FoodOps."
    exit 1
}

$pkg     = Get-Content package.json -Raw | ConvertFrom-Json
$Version = if ($pkg.version) { $pkg.version } else { "3.0.0" }
$Message = "FoodOps v$Version — ERP F&B offline-first, stock spécifique par site"

# ---- git init ------------------------------------------------------------------
if (Test-Path .git) {
    Info "Dépôt Git déjà initialisé."
} else {
    git init -b main 2>$null
    if ($LASTEXITCODE -ne 0) { git init; git checkout -b main }
    Ok "Dépôt Git initialisé (branche main)."
}

# ---- Identité -------------------------------------------------------------------
if (-not (git config user.email)) {
    $email = Read-Host "   Votre e-mail (pour les commits)"
    git config user.email $email
}
if (-not (git config user.name)) {
    $nom = Read-Host "   Votre nom"
    git config user.name $nom
}

# ---- Commit ---------------------------------------------------------------------
git add .
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
    git commit -m $Message | Out-Null
    Ok "Commit créé : $Message"
} else {
    Info "Aucun changement à commit."
}

# ---- Remote & push ---------------------------------------------------------------
if (-not $Url) {
    Write-Host ""
    Write-Host "   Créez d'abord un dépôt VIDE sur https://github.com/new"
    Write-Host "   (ne cochez ni README, ni .gitignore, ni licence — ils existent déjà)."
    Write-Host ""
    $Url = Read-Host "   URL du dépôt GitHub (laissez vide pour terminer sans publier)"
}

if ($Url) {
    git remote get-url origin 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { git remote set-url origin $Url } else { git remote add origin $Url }
    Ok "Remote origin → $Url"
    Info "Publication en cours (git push -u origin main)…"
    git push -u origin main
    if ($LASTEXITCODE -eq 0) {
        Ok "Dépôt publié sur GitHub !"
        Info "Vérifiez l'onglet Actions : la CI (typage + build) doit se lancer automatiquement."
    } else {
        Err "Échec du push. GitHub exige un token (PAT) ou une clé SSH :"
        Write-Host "     • HTTPS : remplacez le mot de passe par un token (Settings → Developer settings → Tokens)"
        Write-Host "     • SSH   : utilisez git@github.com:utilisateur/foodops-desktop.git"
        exit 1
    }
} else {
    Info "Remote non défini. Quand le dépôt GitHub existera :"
    Write-Host "     git remote add origin https://github.com/UTILISATEUR/foodops-desktop.git"
    Write-Host "     git push -u origin main"
}
