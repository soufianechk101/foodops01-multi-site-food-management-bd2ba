/* ============================================================
   FoodOps — Data Validation Layer
   Couche centralisée de validation des données
   ============================================================ */

import type { DB, ID, Product, Site, User } from "../types";

export function assertFinite(n: number, what: string): void {
  if (!isFinite(n)) throw new Error(`${what} doit être un nombre valide (pas NaN ou Infinity).`);
}

export function assertNonNegative(n: number, what: string): void {
  assertFinite(n, what);
  if (n < 0) throw new Error(`${what} ne peut pas être négatif.`);
}

export function assertPositive(n: number, what: string): void {
  assertFinite(n, what);
  if (n <= 0) throw new Error(`${what} doit être strictement supérieur à zéro.`);
}

export function assertNonEmptyString(s: string, what: string): void {
  if (typeof s !== "string" || !s.trim()) throw new Error(`${what} est requis et ne peut pas être vide.`);
}

export function assertValidId(id: ID, what: string): void {
  if (typeof id !== "string" || !id.trim()) throw new Error(`${what} doit être un identifiant valide.`);
}

export function assertValidDate(date: string, what: string): void {
  if (typeof date !== "string" || !date.trim()) throw new Error(`${what} doit être une date valide.`);
  const d = new Date(date);
  if (isNaN(d.getTime())) throw new Error(`${what} n'est pas une date valide.`);
}

export function validateSite(db: DB, siteId: ID): void {
  assertValidId(siteId, "L'identifiant du site");
  const site = db.sites.find((s) => s.id === siteId);
  if (!site) throw new Error(`Site introuvable : ${siteId}`);
  if (site.status !== "actif") throw new Error(`Le site « ${site.name} » n'est pas actif. Opération impossible.`);
}

export function assertProductExists(db: DB, productId: ID): void {
  assertValidId(productId, "L'identifiant du produit");
  const p = db.products.find((x) => x.id === productId);
  if (!p) throw new Error(`Produit introuvable : ${productId}`);
  if (p.status !== "actif") throw new Error(`Le produit « ${p.name} » n'est pas actif.`);
}

export function assertUserActive(db: DB, userId: ID): void {
  assertValidId(userId, "L'identifiant de l'utilisateur");
  const u = db.users.find((x) => x.id === userId);
  if (!u) throw new Error("Session invalide. Veuillez vous reconnecter.");
  if (!u.active) throw new Error("Votre compte est désactivé. Contactez un administrateur.");
}

export function validateBackupStructure(data: any): void {
  if (!data || typeof data !== "object") throw new Error("La sauvegarde est corrompue ou vide.");
  if (data.version !== 5) throw new Error(`Version de sauvegarde incompatible : ${data.version}. Version attendue : 5.`);
  
  const required = ["company", "sites", "users", "products", "movements"];
  for (const key of required) {
    if (!data[key] || (typeof data[key] !== "object" && !Array.isArray(data[key]))) {
      throw new Error(`Structure de sauvegarde invalide : collection « ${key} » manquante ou corrompue.`);
    }
  }
}