# FoodOps — F&B Control Suite

Application professionnelle de gestion **Food & Beverage** pour restaurants, hôtels,
traiteurs et cuisines centrales : inventaire permanent, achats, réceptions, transferts
multi-sites, consommations, pertes, inventaires physiques, ventes et **food cost**,
rapports, sauvegardes et audit complet — entièrement en **français** et **hors-ligne**.

---

## Règle fondamentale du système

> **Le stock n'est JAMAIS global par produit.**
> L'identité du stock est toujours `société + site + produit`.

Le riz peut afficher 110 kg au Restaurant principal, 60 kg au Restaurant d'hôtel et
300 kg à l'Entrepôt : chaque écran, chaque rapport et chaque export respecte cette
règle, parce que le stock est **dérivé des mouvements** et non stocké globalement.

---

## Technologies

| Couche          | Technologie                                            |
| --------------- | ------------------------------------------------------ |
| Interface       | React 18 + TypeScript + Vite 6                          |
| Style           | Tailwind CSS 4 (thème métier « ledger » sur mesure)     |
| Moteur de stock | `src/lib/engine.ts` — transactionnel, signé, traçable   |
| Base locale     | Persistance localStorage (miroir 1:1 du schéma SQLite)  |
| Desktop         | Electron (main + preload sécurisés) + electron-builder  |
| Tests           | Suite automatisée in-app (12 scénarios moteur)          |

---

## Démarrage rapide

```bash
npm install
npm run dev        # développement (http://localhost:3000)
npm run build      # build de production → dist/
```

### Comptes de démonstration

| Rôle            | Utilisateur  | Mot de passe | Sites                  |
| --------------- | ------------ | ------------ | ---------------------- |
| Propriétaire    | `proprietaire` | `Owner@123` | Tous les sites + Espace propriétaire (vue groupe) |
| Administratrice | `admin`      | `Admin@123`  | Tous les sites         |
| Gestionnaire    | `manager`    | `manager123` | Tous les sites         |
| Économe         | `econome`    | `econome123` | Resto principal + Cuisine centrale uniquement |
| Contrôleur      | `controleur` | `ctrl123`    | Tous les sites (lecture seule) |

Le jeu de démonstration (« FoodOps Demo SARL », 4 sites, ~25 produits, ~30 jours
d'opérations réalistes) est **généré par le moteur lui-même** : chaque quantité à
l'écran est rejouable depuis les mouvements. Réinitialisable via
*Sauvegarde → Réinitialiser la démonstration*.

---

## Architecture du moteur de stock

Chaque opération touchant le stock produit un **mouvement signé**
(`src/lib/engine.ts`) :

```
INITIAL_STOCK · RECEPTION · TRANSFER_IN · TRANSFER_OUT · CONSUMPTION · WASTE
INVENTORY_ADJUSTMENT_IN/OUT · RETURN_IN/OUT · MANUAL_ADJUSTMENT
```

```
Stock courant(site, produit) = Σ mouvements validés
Coût moyen pondéré(site, produit) = Σ(qté × coût) / Σ qté   (entrées uniquement)
Valeur = quantité × coût moyen
```

Garanties appliquées dans le moteur (pas seulement dans l'UI) :

- Un **brouillon** ne touche jamais au stock ; un document **annulé** est contre-passé.
- **Validation unique** : impossible de comptabiliser deux fois une réception,
  un transfert ou un inventaire.
- **Stock négatif refusé** par défaut (réglage société) avec message métier clair.
- **Accès par site appliqué côté moteur** : un utilisateur sans droit sur un site ne
  peut ni voir ni modifier son stock, quel que soit l'écran.
- Historique **jamais supprimé** : annulation = mouvement inverse traçable.
- Audit horodaté (qui / quoi / quand / où) sur toutes les opérations sensibles.

---

## Modules

Tableau de bord (KPI réels, food cost vs objectif) · Bons de commande (aucun impact
stock) · Réceptions (seul point d'entrée en stock) · Factures fournisseurs (séparées
du stock) · Règlements & journal de crédit · Stock actuel + historique par produit ·
Mouvements · Stocks initiaux · Transferts inter-sites (approuver → expédier →
réceptionner) · Consommations par service · Pertes par motif · Inventaires
(théorique gelé vs compté → ajustements) · Ventes & couverts · Food cost par service
et par famille · 18 rapports (CSV + impression PDF avec en-tête société) ·
Utilisateurs, rôles & permissions · Sites · Paramètres · Journal d'audit ·
Sauvegarde / restauration / diagnostics.

---

## Tests automatisés

Ouvrez **Sauvegarde & restauration → Diagnostics** et lancez la suite :
12 tests exécutés sur un clone de travail (vos données ne bougent pas) :

1. **Scénario critique multi-sites** : A=100, B=50, réception A +30, consommation
   B −10, transfert A→B 20 ⇒ **A = 110, B = 60** (jamais 170).
2. Coût moyen pondéré : 100×10 + 50×12 ⇒ 10,67.
3. Brouillons et bons de commande sans impact stock.
4. Anti double comptabilisation d'une réception.
5. Blocage du stock négatif.
6. Gardes-fous transferts (même site, quantité excessive, double réception).
7. Écart d'inventaire → ajustement IN/OUT exact.
8. Perte validée → sortie WASTE traçable.
9. Permission site refusée **dans le moteur**.
10. Unicité du stock initial par site + produit.
11. Aller-retour sauvegarde / restauration.
12. Flux bon de commande → réception pré-remplie → stock → bon « reçu ».

---

## Sauvegardes

- Export manuel : *Sauvegarde → Exporter* (fichier `.json` complet de la base).
- Restauration : validation du fichier, **sauvegarde de sécurité automatique**
  téléchargée avant remplacement, puis rechargement de l'application.
- Historique des exports conservé localement.

## Empaquetage Windows (Electron)

Les fichiers `electron/main.cjs`, `electron/preload.cjs` et `electron-builder.yml`
fournissent l'architecture desktop sécurisée (`contextIsolation: true`,
`nodeIntegration: false`, IPC minimal via `contextBridge`).

Sur une machine de développement standard :

```bash
npm install
npm run build
npm install -D electron electron-builder
npx electron-builder --win      # → release/FoodOps-Setup-<version>.exe
```

> **Note d'environnement :** le présent workspace est un environnement web
> (build Vite servi depuis `dist/`). Il ne permet pas d'exécuter Electron ni de
> produire un installeur `.exe` ou une archive ZIP binaire : la configuration
> ci-dessus est réelle et testable sur une machine locale, mais aucun EXE n'est
> généré ici — conformément au principe de ne jamais déclarer livré un artefact
> qui n'existe pas.

---

## Dépannage

| Symptôme                          | Remède                                                       |
| --------------------------------- | ------------------------------------------------------------ |
| Écran de connexion en boucle      | Vider le stockage local du navigateur (base régénérée)        |
| Données d'une ancienne version    | La base est régénérée automatiquement au changement de version |
| Stock incohérent suspecté         | Lancer les Diagnostics puis consulter le journal des mouvements |
| Bouton d'action absent            | Vérifier le rôle / les droits site de l'utilisateur connecté  |

---

## Structure du projet

```
src/
  lib/engine.ts      Moteur de stock transactionnel (cœur du système)
  lib/seed.ts        Jeu de démonstration généré par le moteur
  lib/tests.ts       Suite de tests automatisés du moteur
  lib/util.ts        Formatage FR, dates, CSV, hachage
  state/AppContext.tsx  Session, permissions, persistance, navigation
  components/        UI (tables, modales, badges, graphiques…)
  pages/             Modules métier (stock, achats, F&B, admin, rapports)
electron/            Processus principal + preload sécurisés
electron-builder.yml Configuration installeur Windows
.github/workflows/   Intégration continue (typage + build)
```

---

## Dépôt et versionnage

Le projet est structuré comme un dépôt Git prêt à publier (`.gitignore`,
`.gitattributes`, `LICENSE`, `CHANGELOG.md`, CI). Sur votre machine :

```bash
git init
git add .
git commit -m "FoodOps v3.0.0 — ERP F&B offline-first, stock spécifique par site"
git branch -M main
git remote add origin https://github.com/<votre-organisation>/foodops-desktop.git
git push -u origin main
```

Optionnel avant publication : renommer le paquet dans `package.json`
(`"name": "foodops-desktop"`, `"version": "3.0.0"`).

À chaque push sur `main`, le workflow `.github/workflows/ci.yml` exécute
automatiquement le typage TypeScript (`npm run typecheck`) et le build de
production, puis archive le dossier `dist/` comme artefact.

Le projet est distribué sous licence MIT (voir `LICENSE`) ; l'historique des
versions suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
(voir `CHANGELOG.md`).
#   f o o d o p s 0 1 - m u l t i - s i t e - f o o d - m a n a g e m e n t - b d 2 b a  
 