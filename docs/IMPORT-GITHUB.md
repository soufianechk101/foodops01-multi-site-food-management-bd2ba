# Importer FoodOps sur GitHub — Guide complet

Le projet est **prêt à publier** : `.gitignore`, `.gitattributes`, `LICENSE`,
`CHANGELOG.md`, `README.md` et la CI (`.github/workflows/ci.yml`) sont déjà en place.
Choisissez la méthode qui vous convient.

---

## Étape 0 — Créer le dépôt vide sur GitHub

1. Allez sur **[github.com/new](https://github.com/new)**
2. Nom du dépôt : `foodops-desktop`
3. Visibilité : **Private** (recommandé pour un ERP) ou Public
4. ⚠️ **Ne cochez rien** (ni README, ni .gitignore, ni licence) — ces fichiers
   existent déjà dans le projet et créeraient un conflit de fusion.

---

## Méthode A — Script automatique (recommandée)

### Linux / macOS

```bash
bash scripts/setup-repo.sh https://github.com/VOTRE-UTILISATEUR/foodops-desktop.git
```

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-repo.ps1 -Url https://github.com/VOTRE-UTILISATEUR/foodops-desktop.git
```

Le script initialise Git, crée le commit `v3.0.0`, branche le remote et publie.
Si vous ne donnez pas d'URL, il vous la demande (ou vous indique les commandes
manuelles à exécuter plus tard).

---

## Méthode B — Lignes de commande manuelles

```bash
# Depuis le dossier du projet
git init -b main
git add .
git commit -m "FoodOps v3.0.0 — ERP F&B offline-first, stock spécifique par site"

git remote add origin https://github.com/VOTRE-UTILISATEUR/foodops-desktop.git
git push -u origin main
```

Premier push réussi ⇒ la CI se déclenche automatiquement (onglet **Actions**) :
typage TypeScript → build Vite → archive `dist/`.

---

## Méthode C — GitHub CLI (`gh`)

Si l'outil [`gh`](https://cli.github.com) est installé :

```bash
gh auth login                       # une seule fois
gh repo create foodops-desktop --private --source=. --remote=origin --push
```

Le dépôt est créé **et** publié en une seule commande.

---

## Méthode D — Sans Git installé (import par navigateur)

1. Sur GitHub, créez le dépôt puis cliquez **« uploading an existing file »**.
2. Constituez un dossier temporaire contenant le projet **sans** :
   `node_modules/`, `dist/`, `release/`, `*.log`, sauvegardes `*.json`.
3. Glissez-déposez son contenu (les dossiers sont acceptés) dans la zone d'upload.

⚠️ Limites : 25 Mo par fichier, 100 fichiers par glisser-déposer sur certains
navigateurs — pour un gros historique, préférez les méthodes A/B/C.

---

## Authentification : ce qui fonctionne en 2026

GitHub **n'accepte plus les mots de passe** pour `git push` en HTTPS.

| Méthode | Configuration |
|---|---|
| **Token (PAT)** | GitHub → Settings → Developer settings → *Personal access tokens* → générer un token `repo` → le coller à la place du mot de passe |
| **SSH** | Générer une clé (`ssh-keygen -t ed25519`), ajouter `id_ed25519.pub` dans Settings → SSH keys, puis utiliser l'URL `git@github.com:UTILISATEUR/foodops-desktop.git` |
| **GitHub CLI** | `gh auth login` gère tout automatiquement (navigateur + code) |

---

## Vérifications après publication

- [ ] La page du dépôt affiche l'arborescence (`src/`, `electron/`, `scripts/`…)
- [ ] L'onglet **Actions** montre un workflow `CI` vert
- [ ] La licence MIT apparaît dans la barre latérale du dépôt
- [ ] `node_modules/` et `dist/` n'apparaissent **pas** dans le dépôt

## Dépannage

| Problème | Solution |
|---|---|
| `Authentication failed` | Utilisez un token PAT ou SSH (tableau ci-dessus) |
| `Updates were rejected` | Le dépôt GitHub n'est pas vide : recréez-le sans cocher les cases d'init |
| Fichier refusé (> 100 Mo) | Il est probablement hors `.gitignore` : vérifiez les sauvegardes `.json` et les installeurs `.exe` |
| Erreur de fins de ligne sous Windows | Déjà géré par `.gitattributes` (LF forcé) — rien à faire |
| CI en échec sur `npm ci` | Le `package-lock.json` doit être commité — c'est le cas par défaut |
