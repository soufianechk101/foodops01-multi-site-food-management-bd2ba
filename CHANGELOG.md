# Journal des versions — FoodOps

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le versionnage sémantique.

## [Non publié]

### Ajouté
- Script `npm test` exécutant la suite moteur en CLI (`scripts/run-tests.ts`, via `tsx`),
  avec affichage des résultats et code de sortie (anciennement non exécutable hors UI).
- Config ESLint (`.eslintrc.cjs`) avec plugins TypeScript et React Hooks,
  scripts `lint` / `lint:fix`.
- Alertes de péremption (DLC) : fonctions moteur `siteExpiries` / `soonestExpiry`,
  notification dans la cloche (NotifBell) et carte « Péremptions proches » dans
  le tableau de bord.
- Découpage du code (code-splitting) : chargement paresseux des pages + blocs
  séparés pour `react`, `recharts`, `lucide-react` (charge initiale ~127 kB
  au lieu de ~922 kB).
- Packaging Windows : `electron` + `electron-builder` en devDependencies et
  script `build:win` (`npm run build && electron-builder --win`).

### Corrigé
- 3 scénarios moteur inopérants (brouillons, inventaire, flux bon → réception) :
  alignés sur les règles du moteur (`soumis` avant `approuve`, clôture d'un
  inventaire déjà en cours) — suite au vert 12/12.
- Références au port 5173 dans `README.md` et `electron/main.cjs` → 3000
  (cohérence avec `vite.config.js`).

### Modifié
- CI : exécution de `npm run lint` et `npm test` avant le build de production.
- Dépendances : suppression de 7 paquets inutilisés (`framer-motion`,
  `canvas-confetti`, `@dnd-kit/*`, `react-router-dom`, `date-fns`, `uuid`,
  `@supabase/supabase-js`) et des types associés.

## [3.0.0] — 2026

Première version publique du dépôt.

### Moteur de stock
- Stock **strictement spécifique par site** : identité `entreprise + site + produit`,
  jamais de stock global par produit.
- Architecture transactionnelle : toute variation de stock est un mouvement signé
  (`INITIAL_STOCK`, `RECEPTION`, `TRANSFER_IN/OUT`, `CONSUMPTION`, `WASTE`,
  `INVENTORY_ADJUSTMENT_IN/OUT`, `MANUAL_ADJUSTMENT`…).
- Coût moyen pondéré recalculé par site + produit à chaque entrée.
- Validation en une seule fois (anti double comptabilisation), annulation par
  contre-passation traçable, brouillons sans effet sur le stock.
- Blocage du stock négatif (réglable), garde-fous transferts (même site,
  quantité excessive, double réception).

### Modules
- Authentification, rôles (Administrateur, Gestionnaire, Économe, Contrôleur) et
  permissions appliquées dans le moteur, accès par utilisateur à des sites précis.
- Produits, catégories hiérarchiques, unités avec conversion, fournisseurs
  (ICE, plafonds, soldes d'ouverture).
- Cycle achats : bons de commande (6 statuts), réceptions avec lots/DLC,
  factures fournisseurs (statuts payée/partielle/impayée/échue), règlements
  partiels et journal de crédit.
- Transferts inter-sites (approuver → expédier → réceptionner), inventaires
  (gel théorique, comptage, écarts ajustés), consommations par service, pertes
  par motif.
- Ventes, couverts et food cost quotidien/hebdomadaire/mensuel avec comparaison
  à l'objectif.
- Tableau de bord temps réel (KPIs, tendances 14 jours, alertes stocks faibles).
- 18 rapports calculés par le moteur, export CSV et impression PDF avec
  en-tête société.
- Journal d'audit, sauvegarde/restauration JSON avec sauvegarde de sécurité
  automatique, numérotation automatique des documents (préfixes sites optionnels).

### Tests
- Suite automatisée de 12 scénarios moteur (`src/lib/tests.ts`), exécutable
  dans l'application (Sauvegarde → Diagnostics) : isolation multi-sites,
  coût moyen pondéré, brouillons, double validation, stock négatif, transferts,
  inventaires, permissions, sauvegarde/restauration, flux bon → réception.

### Poste de travail
- Couche Electron sécurisée (`contextIsolation: true`, `nodeIntegration: false`)
  et configuration electron-builder pour l'installeur Windows NSIS.
- Intégration continue GitHub Actions : typage TypeScript + build de production.
