/* ============================================================
   FoodOps — Moteur de stock transactionnel
   Principe : le stock courant n'est JAMAIS stocké directement ;
   il est dérivé des mouvements validés. Toute opération crée un
   mouvement traçable (qui ? quoi ? quand ? où ? combien ? à quel
   coût ? quel document ?). Les brouillons et documents annulés
   n'impactent pas le stock.
   ============================================================ */

import type {
  Consumption,
  DB,
  ID,
  InventoryDoc,
  MovementType,
  POStatus,
  Product,
  PurchaseOrder,
  Reception,
  StockEntry,
  StockMovement,
  SupplierReturn,
  Transfer,
  Waste,
} from "../types";
import { nowISO, todayISO, uid, toBaseUnit, getBaseCost } from "./util";

const COMPANY_ID = "foodops-demo";

/* ================= lecture : calcul du stock ================= */

export const stockKey = (siteId: ID, productId: ID): string => siteId + "|" + productId;

export function entryOf(
  map: Map<string, StockEntry>,
  siteId: ID,
  productId: ID
): StockEntry {
  return map.get(stockKey(siteId, productId)) ?? { qty: 0, avgCost: 0, value: 0 };
}

export function computeStocks(
  db: DB,
  opts?: { siteId?: ID | null; productId?: ID | null; uptoDate?: string }
): Map<string, StockEntry> {
  const map = new Map<string, StockEntry>();
  for (const m of db.movements) {
    if (opts?.siteId && m.siteId !== opts.siteId) continue;
    if (opts?.productId && m.productId !== opts.productId) continue;
    if (opts?.uptoDate && m.date > opts.uptoDate) continue;
    const key = stockKey(m.siteId, m.productId);
    let e = map.get(key);
    if (!e) {
      e = { qty: 0, avgCost: 0, value: 0 };
      map.set(key, e);
    }
    if (m.qty > 0) {
      const base = Math.max(e.qty, 0) * e.avgCost + m.qty * m.unitCost;
      e.qty += m.qty;
      e.avgCost = e.qty > 0 ? base / e.qty : e.avgCost;
    } else {
      e.qty += m.qty;
    }
    e.value = e.qty * e.avgCost;
  }
  return map;
}

export function currentQty(db: DB, siteId: ID, productId: ID): number {
  return entryOf(computeStocks(db, { siteId, productId }), siteId, productId).qty;
}

export type HistoryRow = { mov: StockMovement; balance: number };

export function productHistory(db: DB, siteId: ID, productId: ID): HistoryRow[] {
  const rows: HistoryRow[] = [];
  let balance = 0;
  for (const m of db.movements) {
    if (m.siteId !== siteId || m.productId !== productId) continue;
    balance += m.qty;
    rows.push({ mov: m, balance });
  }
  return rows.reverse();
}

export type StockStatusKind = "rupture" | "critique" | "bas" | "ok";

export function stockStatus(qty: number, p: Product): StockStatusKind {
  if (qty <= 0) return "rupture";
  if (qty <= p.minStock) return "critique";
  if (qty <= p.reorderPoint) return "bas";
  return "ok";
}

/* ================= infrastructure ================= */

export function pushAudit(
  db: DB,
  e: { userId: ID; action: string; module: string; detail: string; siteId?: ID | null }
): void {
  const u = db.users.find((x) => x.id === e.userId);
  db.audit.push({
    id: uid(),
    userId: e.userId,
    userName: u?.name ?? "Système",
    action: e.action,
    module: e.module,
    detail: e.detail,
    siteId: e.siteId ?? null,
    date: nowISO(),
  });
}

export function nextNumber(db: DB, prefix: string, siteCode?: string): string {
  const key = db.company.sitePrefixNumbering && siteCode ? `${siteCode}-${prefix}` : prefix;
  const n = (db.sequences[key] ?? 0) + 1;
  db.sequences[key] = n;
  const year = new Date().getFullYear();
  return `${key}-${year}-${String(n).padStart(6, "0")}`;
}

function addMovement(
  db: DB,
  m: {
    siteId: ID;
    productId: ID;
    type: MovementType;
    qty: number;
    unitCost: number;
    refType: string;
    refId: ID;
    refNumber: string;
    date: string;
    userId: ID;
    notes?: string;
  }
): StockMovement {
  const mov: StockMovement = {
    id: uid(),
    seq: ++db.seqCounter,
    companyId: COMPANY_ID,
    siteId: m.siteId,
    productId: m.productId,
    type: m.type,
    qty: Math.round(m.qty * 1000) / 1000,
    unitCost: Math.round(m.unitCost * 100) / 100,
    totalCost: Math.round(Math.abs(m.qty) * m.unitCost * 100) / 100,
    refType: m.refType,
    refId: m.refId,
    refNumber: m.refNumber,
    date: m.date,
    userId: m.userId,
    notes: m.notes ?? "",
    createdAt: nowISO(),
  };
  db.movements.push(mov);
  return mov;
}

export function checkSiteAccess(db: DB, userId: ID, siteId: ID): void {
  const u = db.users.find((x) => x.id === userId);
  if (!u) throw new Error("Session invalide. Veuillez vous reconnecter.");
  if (!u.active) throw new Error("Votre compte est désactivé. Contactez un administrateur.");
  if (u.siteIds !== "all" && !u.siteIds.includes(siteId)) {
    const s = db.sites.find((x) => x.id === siteId);
    throw new Error(`Vous n'avez pas accès au site « ${s?.name ?? siteId} ». Contactez un administrateur.`);
  }
}

export function assertCanOut(db: DB, siteId: ID, productId: ID, qty: number): void {
  if (db.company.allowNegativeStock) return;
  const avail = currentQty(db, siteId, productId);
  if (avail - qty < -0.0001) {
    const p = db.products.find((x) => x.id === productId);
    const s = db.sites.find((x) => x.id === siteId);
    throw new Error(`Stock insuffisant pour « ${p?.name ?? productId} » sur le site ${s?.name ?? siteId}. Disponible : ${Math.round(avail * 100) / 100}, Demandé : ${Math.round(qty * 100) / 100}.`);
  }
}

const findProduct = (db: DB, id: ID): Product => {
  const p = db.products.find((x) => x.id === id);
  if (!p) throw new Error("Produit introuvable. La ligne est peut-être corrompue.");
  return p;
};

const assertPositive = (n: number, what: string): void => {
  if (!isFinite(n) || n <= 0) throw new Error(`${what} doit être strictement positive.`);
};

/* ================= Permissions Engine ================= */

const ROLE_PERMISSIONS: Record<string, string[]> = {
  proprietaire: ['*'],
  admin: ['*'],
  manager: [
    'dashboard.view', 'products.view', 'products.create', 'products.edit',
    'suppliers.view', 'suppliers.create', 'suppliers.edit',
    'purchases.view', 'purchases.create', 'purchases.approve',
    'receptions.view', 'receptions.create', 'receptions.validate', 'receptions.cancel',
    'stock.view', 'stock.adjust', 'stock.transfer',
    'consumption.view', 'consumption.create', 'consumption.validate', 'consumption.cancel',
    'waste.view', 'waste.create', 'waste.validate', 'waste.cancel',
    'inventory.view', 'inventory.create', 'inventory.validate',
    'sales.view', 'sales.create',
    'reports.view', 'reports.export',
    'settings.view',
  ],
  econome: [
    'dashboard.view', 'products.view',
    'suppliers.view',
    'purchases.view', 'purchases.create',
    'receptions.view', 'receptions.create', 'receptions.validate',
    'stock.view', 'stock.adjust', 'stock.transfer',
    'consumption.view', 'consumption.create', 'consumption.validate',
    'waste.view', 'waste.create', 'waste.validate',
    'inventory.view', 'inventory.create',
    'sales.view', 'sales.create',
    'reports.view',
  ],
  controleur: [
    'dashboard.view', 'products.view', 'suppliers.view',
    'purchases.view', 'receptions.view', 'stock.view',
    'consumption.view', 'waste.view', 'inventory.view',
    'sales.view', 'reports.view', 'reports.export',
    'settings.view', 'audit.view', 'users.view',
  ],
};

export function hasPermission(db: DB, userId: ID, permission: string): boolean {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return false;
  if (u.role === 'proprietaire' || u.role === 'admin') return true;
  const perms = ROLE_PERMISSIONS[u.role] ?? [];
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

export function requirePermission(db: DB, userId: ID, permission: string): void {
  if (!hasPermission(db, userId, permission)) {
    throw new Error("Vous n'avez pas l'autorisation d'effectuer cette action.");
  }
}

/* ================= stock initial ================= */

export function createInitialStock(
  db: DB,
  args: { siteId: ID; date: string; userId: ID; lines: { productId: ID; qty: number; unitCost: number }[] }
): void {
  checkSiteAccess(db, args.userId, args.siteId);
  requirePermission(db, args.userId, 'stock.adjust');
  if (!args.lines.length) throw new Error("Ajoutez au moins une ligne de stock initial.");
  const site = db.sites.find((s) => s.id === args.siteId);
  for (const l of args.lines) {
    const p = findProduct(db, l.productId);
    assertPositive(l.qty, `La quantité de « ${p.name} »`);
    if (l.unitCost < 0) throw new Error(`Le coût unitaire de « ${p.name} » est invalide.`);
    const exists = db.movements.some(
      (m) => m.siteId === args.siteId && m.productId === l.productId && m.type === "INITIAL_STOCK"
    );
    if (exists) throw new Error(`Un stock initial existe déjà pour « ${p.name} » sur ce site. Utilisez une réception ou un ajustement.`);
  }
  for (const l of args.lines) {
    addMovement(db, {
      siteId: args.siteId,
      productId: l.productId,
      type: "INITIAL_STOCK",
      qty: l.qty,
      unitCost: l.unitCost,
      refType: "INITIAL",
      refId: "initial-" + args.siteId,
      refNumber: `INIT-${site?.code ?? "SITE"}`,
      date: args.date,
      userId: args.userId,
      notes: "Mise en place du stock initial",
    });
  }
  pushAudit(db, {
    userId: args.userId,
    action: "STOCK_ADJUSTMENT",
    module: "Stock initial",
    detail: `Stock initial : ${args.lines.length} produit(s) sur ${site?.name}`,
    siteId: args.siteId,
  });
}

/* ================= réceptions ================= */

export function saveReception(db: DB, rec: Reception): void {
  checkSiteAccess(db, rec.userId, rec.siteId);
  if (rec.status !== "brouillon") throw new Error("Seul un brouillon peut être modifié.");
  if (!rec.supplierId) throw new Error("Sélectionnez un fournisseur.");
  if (!rec.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of rec.lines) {
    const p = findProduct(db, l.productId);
    if (l.receivedQty < 0) throw new Error(`Quantité reçue invalide pour « ${p.name} ».`);
    if (l.unitCost < 0) throw new Error(`Coût unitaire invalide pour « ${p.name} ».`);
  }
  if (!rec.number) {
    const site = db.sites.find((s) => s.id === rec.siteId);
    rec.number = nextNumber(db, "REC", site?.code);
  }
  const i = db.receptions.findIndex((x) => x.id === rec.id);
  if (i >= 0) db.receptions[i] = rec;
  else db.receptions.push(rec);
  pushAudit(db, {
    userId: rec.userId,
    action: "CREATE",
    module: "Réceptions",
    detail: `Réception ${rec.number} enregistrée en brouillon`,
    siteId: rec.siteId,
  });
}

export function validateReception(db: DB, id: ID, userId: ID): Reception {
  const rec = db.receptions.find((x) => x.id === id);
  if (!rec) throw new Error("Réception introuvable.");
  checkSiteAccess(db, userId, rec.siteId);
  requirePermission(db, userId, 'receptions.validate');
  if (rec.status !== "brouillon")
    throw new Error(rec.status === "valide" ? "Cette réception est déjà validée." : "Cette réception est annulée.");
  
  const lines = rec.lines.filter((l) => l.receivedQty > 0);
  if (!lines.length) throw new Error("Aucune quantité reçue : saisissez au moins une quantité avant de valider.");
  
  for (const l of lines) {
    const p = findProduct(db, l.productId);
    addMovement(db, {
      siteId: rec.siteId,
      productId: l.productId,
      type: "RECEPTION",
      qty: toBaseUnit(l.receivedQty, p.conversion),
      unitCost: getBaseCost(l.unitCost, p.conversion),
      refType: "RECEPTION",
      refId: rec.id,
      refNumber: rec.number,
      date: rec.date,
      userId,
      notes: l.lot ? `Lot ${l.lot}` + (l.expiry ? ` · DLC ${l.expiry}` : "") : "",
    });
  }
  rec.status = "valide";
  if (rec.poId) {
    const po = db.purchaseOrders.find((x) => x.id === rec.poId);
    if (po) {
      for (const rl of lines) {
        const pl = po.lines.find((x) => x.productId === rl.productId);
        if (pl) pl.receivedQty = Math.round((pl.receivedQty + rl.receivedQty) * 1000) / 1000;
      }
      po.status = po.lines.every((x) => x.receivedQty >= x.qty - 0.0001) ? "recu" : "partiel";
    }
  }
  pushAudit(db, {
    userId,
    action: "VALIDATE",
    module: "Réceptions",
    detail: `Réception ${rec.number} validée (+stock)`,
    siteId: rec.siteId,
  });
  return rec;
}

export function cancelReception(db: DB, id: ID, userId: ID): void {
  const rec = db.receptions.find((x) => x.id === id);
  if (!rec) throw new Error("Réception introuvable.");
  checkSiteAccess(db, userId, rec.siteId);
  requirePermission(db, userId, 'receptions.cancel');
  if (rec.status !== "valide") throw new Error("Seule une réception validée peut être annulée.");
  
  for (const l of rec.lines.filter((x) => x.receivedQty > 0)) {
    const p = findProduct(db, l.productId);
    assertCanOut(db, rec.siteId, l.productId, toBaseUnit(l.receivedQty, p.conversion));
  }
  
  for (const l of rec.lines.filter((x) => x.receivedQty > 0)) {
    const p = findProduct(db, l.productId);
    addMovement(db, {
      siteId: rec.siteId,
      productId: l.productId,
      type: "RECEPTION",
      qty: -toBaseUnit(l.receivedQty, p.conversion),
      unitCost: getBaseCost(l.unitCost, p.conversion),
      refType: "RECEPTION",
      refId: rec.id,
      refNumber: rec.number,
      date: todayISO(),
      userId,
      notes: `Annulation de la réception ${rec.number}`,
    });
  }
  rec.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Réceptions",
    detail: `Réception ${rec.number} annulée (contre-passation)`,
    siteId: rec.siteId,
  });
}

/* ================= bons de commande ================= */

export function savePO(db: DB, po: PurchaseOrder): void {
  checkSiteAccess(db, po.userId, po.siteId);
  if (po.status !== "brouillon" && po.status !== "soumis") throw new Error("Ce bon de commande ne peut plus être modifié.");
  if (!po.supplierId) throw new Error("Sélectionnez un fournisseur.");
  if (!po.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of po.lines) {
    const p = findProduct(db, l.productId);
    assertPositive(l.qty, `La quantité de « ${p.name} »`);
    if (l.unitCost < 0) throw new Error(`Prix unitaire invalide pour « ${p.name} ».`);
  }
  if (!po.number) {
    const site = db.sites.find((s) => s.id === po.siteId);
    po.number = nextNumber(db, "PO", site?.code);
  }
  const i = db.purchaseOrders.findIndex((x) => x.id === po.id);
  if (i >= 0) db.purchaseOrders[i] = po;
  else db.purchaseOrders.push(po);
  pushAudit(db, {
    userId: po.userId,
    action: "CREATE",
    module: "Achats",
    detail: `Bon de commande ${po.number} enregistré`,
    siteId: po.siteId,
  });
}

export function setPOStatus(db: DB, id: ID, status: POStatus, userId: ID): void {
  const po = db.purchaseOrders.find((x) => x.id === id);
  if (!po) throw new Error("Bon de commande introuvable.");
  checkSiteAccess(db, userId, po.siteId);
  if (status === "annule" && (po.status === "partiel" || po.status === "recu"))
    throw new Error("Impossible d'annuler un bon déjà partiellement ou totalement reçu.");
  if (status === "approuve" && po.status !== "soumis")
    throw new Error("Le bon doit d'abord être soumis avant approbation.");
  po.status = status;
  pushAudit(db, {
    userId,
    action: status === "annule" ? "CANCEL" : "UPDATE",
    module: "Achats",
    detail: `Bon de commande ${po.number} → statut « ${status} »`,
    siteId: po.siteId,
  });
}

export function receptionFromPO(db: DB, poId: ID, userId: ID): Reception {
  const po = db.purchaseOrders.find((x) => x.id === poId);
  if (!po) throw new Error("Bon de commande introuvable.");
  checkSiteAccess(db, userId, po.siteId);
  if (po.status !== "approuve" && po.status !== "partiel")
    throw new Error("Seul un bon approuvé (ou partiellement reçu) peut générer une réception.");
  const remaining = po.lines
    .map((l) => ({ ...l, rest: Math.round((l.qty - l.receivedQty) * 1000) / 1000 }))
    .filter((l) => l.rest > 0);
  if (!remaining.length) throw new Error("Tout le bon a déjà été reçu : aucune quantité restante.");
  const rec: Reception = {
    id: uid(),
    number: "",
    supplierId: po.supplierId,
    siteId: po.siteId,
    date: todayISO(),
    poId: po.id,
    invoiceRef: "",
    status: "brouillon",
    notes: `Réception sur ${po.number}`,
    lines: remaining.map((l) => ({
      productId: l.productId,
      orderedQty: l.qty,
      receivedQty: l.rest,
      unitCost: l.unitCost,
      vatRate: l.vatRate,
      lot: "",
      expiry: "",
    })),
    userId,
    createdAt: nowISO(),
  };
  saveReception(db, rec);
  return rec;
}

/* ================= transferts inter-sites ================= */

export function saveTransfer(db: DB, t: Transfer): void {
  checkSiteAccess(db, t.userId, t.fromSiteId);
  checkSiteAccess(db, t.userId, t.toSiteId);
  if (t.fromSiteId === t.toSiteId) throw new Error("Le site source et le site destination doivent être différents.");
  if (t.status !== "brouillon") throw new Error("Ce transfert ne peut plus être modifié.");
  if (!t.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of t.lines) {
    const p = findProduct(db, l.productId);
    assertPositive(l.qty, `La quantité de « ${p.name} »`);
  }
  if (!t.number) t.number = nextNumber(db, "TRF");
  const i = db.transfers.findIndex((x) => x.id === t.id);
  if (i >= 0) db.transfers[i] = t;
  else db.transfers.push(t);
  pushAudit(db, {
    userId: t.userId,
    action: "CREATE",
    module: "Transferts",
    detail: `Transfert ${t.number} enregistré en brouillon`,
    siteId: t.fromSiteId,
  });
}

export function dispatchTransfer(db: DB, id: ID, userId: ID): void {
  const t = db.transfers.find((x) => x.id === id);
  if (!t) throw new Error("Transfert introuvable.");
  checkSiteAccess(db, userId, t.fromSiteId);
  requirePermission(db, userId, 'stock.transfer');
  if (t.status !== "approuve") throw new Error("Le transfert doit être approuvé avant expédition.");
  
  for (const l of t.lines) {
    const p = findProduct(db, l.productId);
    assertCanOut(db, t.fromSiteId, l.productId, toBaseUnit(l.qty, p.conversion));
  }
  
  for (const l of t.lines) {
    const p = findProduct(db, l.productId);
    const baseQty = toBaseUnit(l.qty, p.conversion);
    l.unitCost = entryOf(computeStocks(db, { siteId: t.fromSiteId, productId: l.productId }), t.fromSiteId, l.productId).avgCost || l.unitCost;
    l.qty = baseQty; 
    
    addMovement(db, {
      siteId: t.fromSiteId,
      productId: l.productId,
      type: "TRANSFER_OUT",
      qty: -baseQty,
      unitCost: l.unitCost,
      refType: "TRANSFER",
      refId: t.id,
      refNumber: t.number,
      date: todayISO(),
      userId,
      notes: "Expédition vers " + (db.sites.find((s) => s.id === t.toSiteId)?.name ?? ""),
    });
  }
  t.status = "expedie";
  pushAudit(db, {
    userId,
    action: "TRANSFER",
    module: "Transferts",
    detail: `Transfert ${t.number} expédié (−stock source)`,
    siteId: t.fromSiteId,
  });
}

export function receiveTransfer(db: DB, id: ID, userId: ID): void {
  const t = db.transfers.find((x) => x.id === id);
  if (!t) throw new Error("Transfert introuvable.");
  checkSiteAccess(db, userId, t.toSiteId);
  requirePermission(db, userId, 'stock.transfer');
  if (t.status !== "expedie") throw new Error(t.status === "recu" ? "Ce transfert est déjà réceptionné." : "Le transfert doit être expédié avant réception.");
  
  for (const l of t.lines) {
    addMovement(db, {
      siteId: t.toSiteId,
      productId: l.productId,
      type: "TRANSFER_IN",
      qty: l.qty,
      unitCost: l.unitCost,
      refType: "TRANSFER",
      refId: t.id,
      refNumber: t.number,
      date: todayISO(),
      userId,
      notes: "Réception depuis " + (db.sites.find((s) => s.id === t.fromSiteId)?.name ?? ""),
    });
  }
  t.status = "recu";
  pushAudit(db, {
    userId,
    action: "TRANSFER",
    module: "Transferts",
    detail: `Transfert ${t.number} réceptionné (+stock destination)`,
    siteId: t.toSiteId,
  });
}

export function approveTransfer(db: DB, id: ID, userId: ID): void {
  const t = db.transfers.find((x) => x.id === id);
  if (!t) throw new Error("Transfert introuvable.");
  if (t.status !== "brouillon") throw new Error("Seul un brouillon peut être approuvé.");
  t.status = "approuve";
  pushAudit(db, {
    userId,
    action: "UPDATE",
    module: "Transferts",
    detail: `Transfert ${t.number} approuvé`,
    siteId: t.fromSiteId,
  });
}

export function cancelTransfer(db: DB, id: ID, userId: ID): void {
  const t = db.transfers.find((x) => x.id === id);
  if (!t) throw new Error("Transfert introuvable.");
  checkSiteAccess(db, userId, t.fromSiteId);
  requirePermission(db, userId, 'stock.transfer');
  if (t.status === "recu") throw new Error("Un transfert réceptionné ne peut pas être annulé.");
  if (t.status === "expedie") {
    for (const l of t.lines) {
      addMovement(db, {
        siteId: t.fromSiteId,
        productId: l.productId,
        type: "TRANSFER_OUT",
        qty: l.qty,
        unitCost: l.unitCost,
        refType: "TRANSFER",
        refId: t.id,
        refNumber: t.number,
        date: todayISO(),
        userId,
        notes: `Annulation du transfert ${t.number}`,
      });
    }
  }
  t.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Transferts",
    detail: `Transfert ${t.number} annulé`,
    siteId: t.fromSiteId,
  });
}

/* ================= consommation ================= */

export function saveConsumption(db: DB, c: Consumption): void {
  checkSiteAccess(db, c.userId, c.siteId);
  if (c.status !== "brouillon") throw new Error("Cette consommation ne peut plus être modifiée.");
  if (!c.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of c.lines) {
    const p = findProduct(db, l.productId);
    assertPositive(l.qty, `La quantité de « ${p.name} »`);
  }
  if (!c.number) {
    const site = db.sites.find((s) => s.id === c.siteId);
    c.number = nextNumber(db, "CON", site?.code);
  }
  const i = db.consumptions.findIndex((x) => x.id === c.id);
  if (i >= 0) db.consumptions[i] = c;
  else db.consumptions.push(c);
  pushAudit(db, {
    userId: c.userId,
    action: "CREATE",
    module: "Consommation",
    detail: `Consommation ${c.number} enregistrée en brouillon`,
    siteId: c.siteId,
  });
}

export function validateConsumption(db: DB, id: ID, userId: ID): void {
  const c = db.consumptions.find((x) => x.id === id);
  if (!c) throw new Error("Consommation introuvable.");
  checkSiteAccess(db, userId, c.siteId);
  requirePermission(db, userId, 'consumption.validate');
  if (c.status !== "brouillon") throw new Error(c.status === "valide" ? "Déjà validée." : "Annulée.");
  const stocks = computeStocks(db, { siteId: c.siteId });
  for (const l of c.lines) {
    assertCanOut(db, c.siteId, l.productId, l.qty);
    const e = entryOf(stocks, c.siteId, l.productId);
    addMovement(db, {
      siteId: c.siteId,
      productId: l.productId,
      type: "CONSUMPTION",
      qty: -l.qty,
      unitCost: e.avgCost,
      refType: "CONSUMPTION",
      refId: c.id,
      refNumber: c.number,
      date: c.date,
      userId,
    });
  }
  c.status = "valide";
  pushAudit(db, {
    userId,
    action: "VALIDATE",
    module: "Consommation",
    detail: `Consommation ${c.number} validée (−stock)`,
    siteId: c.siteId,
  });
}

export function cancelConsumption(db: DB, id: ID, userId: ID): void {
  const c = db.consumptions.find((x) => x.id === id);
  if (!c) throw new Error("Consommation introuvable.");
  checkSiteAccess(db, userId, c.siteId);
  requirePermission(db, userId, 'consumption.cancel');
  if (c.status !== "valide") throw new Error("Seule une consommation validée peut être annulée.");
  const stocks = computeStocks(db, { siteId: c.siteId });
  for (const l of c.lines) {
    const e = entryOf(stocks, c.siteId, l.productId);
    addMovement(db, {
      siteId: c.siteId,
      productId: l.productId,
      type: "CONSUMPTION",
      qty: l.qty,
      unitCost: e.avgCost,
      refType: "CONSUMPTION",
      refId: c.id,
      refNumber: c.number,
      date: todayISO(),
      userId,
      notes: `Annulation de la consommation ${c.number}`,
    });
  }
  c.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Consommation",
    detail: `Consommation ${c.number} annulée (contre-passation)`,
    siteId: c.siteId,
  });
}

/* ================= pertes ================= */

export function saveWaste(db: DB, w: Waste): void {
  checkSiteAccess(db, w.userId, w.siteId);
  if (w.status !== "brouillon") throw new Error("Cette perte ne peut plus être modifiée.");
  if (!w.reason) throw new Error("Précisez le motif de la perte.");
  if (!w.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of w.lines) {
    const p = findProduct(db, l.productId);
    assertPositive(l.qty, `La quantité de « ${p.name} »`);
  }
  if (!w.number) {
    const site = db.sites.find((s) => s.id === w.siteId);
    w.number = nextNumber(db, "WST", site?.code);
  }
  const i = db.wastes.findIndex((x) => x.id === w.id);
  if (i >= 0) db.wastes[i] = w;
  else db.wastes.push(w);
  pushAudit(db, {
    userId: w.userId,
    action: "CREATE",
    module: "Pertes",
    detail: `Perte ${w.number} enregistrée en brouillon`,
    siteId: w.siteId,
  });
}

export function validateWaste(db: DB, id: ID, userId: ID): void {
  const w = db.wastes.find((x) => x.id === id);
  if (!w) throw new Error("Perte introuvable.");
  checkSiteAccess(db, userId, w.siteId);
  requirePermission(db, userId, 'waste.validate');
  if (w.status !== "brouillon") throw new Error(w.status === "valide" ? "Déjà validée." : "Annulée.");
  const stocks = computeStocks(db, { siteId: w.siteId });
  for (const l of w.lines) {
    const p = findProduct(db, l.productId);
    const baseQty = toBaseUnit(l.qty, p.conversion);
    assertCanOut(db, w.siteId, l.productId, baseQty);
    const e = entryOf(stocks, w.siteId, l.productId);
    addMovement(db, {
      siteId: w.siteId,
      productId: l.productId,
      type: "WASTE",
      qty: -baseQty,
      unitCost: e.avgCost,
      refType: "WASTE",
      refId: w.id,
      refNumber: w.number,
      date: w.date,
      userId,
      notes: w.reason,
    });
  }
  w.status = "valide";
  pushAudit(db, {
    userId,
    action: "VALIDATE",
    module: "Pertes",
    detail: `Perte ${w.number} validée (−stock, motif : ${w.reason})`,
    siteId: w.siteId,
  });
}

export function cancelWaste(db: DB, id: ID, userId: ID): void {
  const w = db.wastes.find((x) => x.id === id);
  if (!w) throw new Error("Perte introuvable.");
  checkSiteAccess(db, userId, w.siteId);
  requirePermission(db, userId, 'waste.cancel');
  if (w.status !== "valide") throw new Error("Seule une perte validée peut être annulée.");
  
  const stocks = computeStocks(db, { siteId: w.siteId });
  for (const l of w.lines) {
    const p = findProduct(db, l.productId);
    const e = entryOf(stocks, w.siteId, l.productId);
    
    // ✅ الكمية موجبة تماماً لاستعادة المخزون
    const qtyToAdd = toBaseUnit(l.qty, p.conversion);

    addMovement(db, {
      siteId: w.siteId,
      productId: l.productId,
      type: "WASTE",
      qty: qtyToAdd, 
      unitCost: e.avgCost,
      refType: "WASTE",
      refId: w.id,
      refNumber: w.number,
      date: todayISO(),
      userId,
      notes: `Annulation de la perte ${w.number}`,
    });
  }
  
  w.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Pertes",
    detail: `Perte ${w.number} annulée (contre-passation)`,
    siteId: w.siteId,
  });
}

/* ================= inventaires ================= */

export function createInventory(
  db: DB,
  args: { siteId: ID; date: string; userId: ID; categoryId?: ID | null; notes?: string }
): InventoryDoc {
  checkSiteAccess(db, args.userId, args.siteId);
  if (db.inventories.some((i) => i.siteId === args.siteId && i.status === "en_cours"))
    throw new Error("Un inventaire est déjà en cours sur ce site. Validez-le ou annulez-le d'abord.");
  const stocks = computeStocks(db, { siteId: args.siteId });
  const products = db.products.filter(
    (p) =>
      p.status === "actif" &&
      (!args.categoryId ||
        p.categoryId === args.categoryId ||
        db.categories.some((c) => c.id === p.categoryId && c.parentId === args.categoryId))
  );
  const lines = products
    .map((p) => {
      const e = entryOf(stocks, args.siteId, p.id);
      return {
        productId: p.id,
        theoreticalQty: Math.round(e.qty * 1000) / 1000,
        actualQty: null as number | null,
        unitCost: Math.round(e.avgCost * 100) / 100,
      };
    })
    .filter((l) => l.theoreticalQty !== 0 || true);
  if (!lines.length) throw new Error("Aucun produit à compter pour cette sélection.");
  const site = db.sites.find((s) => s.id === args.siteId);
  const inv: InventoryDoc = {
    id: uid(),
    number: nextNumber(db, "INV", site?.code),
    siteId: args.siteId,
    date: args.date,
    status: "en_cours",
    notes: args.notes ?? "",
    lines,
    userId: args.userId,
    createdAt: nowISO(),
  };
  db.inventories.push(inv);
  pushAudit(db, {
    userId: args.userId,
    action: "INVENTORY",
    module: "Inventaires",
    detail: `Inventaire ${inv.number} créé (${lines.length} produits, quantités théoriques gelées)`,
    siteId: args.siteId,
  });
  return inv;
}

export function setInventoryActual(db: DB, invId: ID, productId: ID, actualQty: number | null, userId: ID): void {
  const inv = db.inventories.find((x) => x.id === invId);
  if (!inv) throw new Error("Inventaire introuvable.");
  checkSiteAccess(db, userId, inv.siteId);
  if (inv.status !== "en_cours") throw new Error("Cet inventaire est clos : modification impossible.");
  const l = inv.lines.find((x) => x.productId === productId);
  if (!l) throw new Error("Ligne d'inventaire introuvable.");
  
  if (actualQty !== null) {
    if (!isFinite(actualQty)) throw new Error("La quantité comptée doit être un nombre valide (pas NaN ou Infinity).");
    if (actualQty < 0) throw new Error("La quantité comptée ne peut pas être négative.");
  }
  l.actualQty = actualQty;
}

export function validateInventory(db: DB, id: ID, userId: ID): void {
  const inv = db.inventories.find((x) => x.id === id);
  if (!inv) throw new Error("Inventaire introuvable.");
  checkSiteAccess(db, userId, inv.siteId);
  requirePermission(db, userId, 'inventory.validate');
  if (inv.status !== "en_cours") throw new Error(inv.status === "valide" ? "Déjà validé." : "Annulé.");

  const counted = inv.lines.filter((l) => l.actualQty !== null);
  if (!counted.length) throw new Error("Saisissez au moins une quantité comptée avant de valider.");

  // Phase 1 : Validation stricte de TOUS les produits avant toute modification (Atomicité)
  for (const l of counted) {
    const p = db.products.find((x) => x.id === l.productId);
    if (!p) throw new Error(`Produit ${l.productId} introuvable dans la base.`);

    const actual = l.actualQty ?? 0;
    if (!isFinite(actual)) throw new Error(`Quantité invalide pour ${p.name}.`);
    if (actual < 0) throw new Error(`Quantité négative interdite pour ${p.name}.`);

    const variance = Math.round((actual - l.theoreticalQty) * 1000) / 1000;
    
    // Vérification de la politique de stock négatif avant d'appliquer
    if (variance < 0) {
      assertCanOut(db, inv.siteId, l.productId, -variance);
    }
  }

  // Phase 2 : Application des mouvements (seulement si la Phase 1 a réussi à 100%)
  for (const l of counted) {
    const actual = l.actualQty ?? 0;
    const variance = Math.round((actual - l.theoreticalQty) * 1000) / 1000;

    // Ne pas créer de mouvement inutile si l'écart est nul
    if (Math.abs(variance) < 0.0001) continue;

    addMovement(db, {
      siteId: inv.siteId,
      productId: l.productId,
      type: variance > 0 ? "INVENTORY_ADJUSTMENT_IN" : "INVENTORY_ADJUSTMENT_OUT",
      qty: variance,
      unitCost: l.unitCost,
      refType: "INVENTORY",
      refId: inv.id,
      refNumber: inv.number,
      date: inv.date,
      userId,
      notes: `Écart d'inventaire : théorique ${l.theoreticalQty} → compté ${actual}`,
    });
  }

  inv.status = "valide";
  pushAudit(db, {
    userId,
    action: "INVENTORY",
    module: "Inventaires",
    detail: `Inventaire ${inv.number} validé (${counted.length} produit(s) ajusté(s))`,
    siteId: inv.siteId,
  });
}

export function cancelInventory(db: DB, id: ID, userId: ID): void {
  const inv = db.inventories.find((x) => x.id === id);
  if (!inv) throw new Error("Inventaire introuvable.");
  checkSiteAccess(db, userId, inv.siteId);
  requirePermission(db, userId, 'inventory.create');
  if (inv.status !== "en_cours") throw new Error("Seul un inventaire en cours peut être annulé.");
  inv.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Inventaires",
    detail: `Inventaire ${inv.number} annulé (aucun ajustement)`,
    siteId: inv.siteId,
  });
}

/* ================= Retours fournisseur ================= */

export function saveSupplierReturn(db: DB, ret: SupplierReturn): void {
  if (!db.supplierReturns) db.supplierReturns = [];
  checkSiteAccess(db, ret.userId, ret.siteId);
  if (ret.status !== "brouillon") throw new Error("Seul un brouillon peut être modifié.");
  if (!ret.supplierId) throw new Error("Sélectionnez un fournisseur.");
  if (!ret.lines.length) throw new Error("Ajoutez au moins une ligne.");
  for (const l of ret.lines) {
    const p = findProduct(db, l.productId);
    if (l.qty <= 0) throw new Error(`Quantité invalide pour « ${p.name} ».`);
  }
  if (!ret.number) {
    const site = db.sites.find((s) => s.id === ret.siteId);
    ret.number = nextNumber(db, "RET", site?.code);
  }
  const i = db.supplierReturns.findIndex((x) => x.id === ret.id);
  if (i >= 0) db.supplierReturns[i] = ret;
  else db.supplierReturns.push(ret);
  pushAudit(db, {
    userId: ret.userId,
    action: "CREATE",
    module: "Retours fournisseur",
    detail: `Retour ${ret.number} enregistré en brouillon`,
    siteId: ret.siteId,
  });
}

export function validateSupplierReturn(db: DB, id: ID, userId: ID): SupplierReturn {
  if (!db.supplierReturns) db.supplierReturns = [];
  const ret = db.supplierReturns.find((x) => x.id === id);
  if (!ret) throw new Error("Retour introuvable.");
  checkSiteAccess(db, userId, ret.siteId);
  requirePermission(db, userId, 'receptions.cancel'); 
  if (ret.status !== "brouillon")
    throw new Error(ret.status === "valide" ? "Ce retour est déjà validé." : "Ce retour est annulé.");

  const lines = ret.lines.filter((l) => l.qty > 0);
  if (!lines.length) throw new Error("Aucune quantité à retourner.");

  // Phase 1: Vérification atomique (Negative Stock Protection + Conversion)
  for (const l of lines) {
    const p = findProduct(db, l.productId);
    const baseQty = toBaseUnit(l.qty, p.conversion);
    assertCanOut(db, ret.siteId, l.productId, baseQty);
  }

  // Phase 2: Application des mouvements
  for (const l of lines) {
    const p = findProduct(db, l.productId);
    const baseQty = toBaseUnit(l.qty, p.conversion);
    const stocks = computeStocks(db, { siteId: ret.siteId, productId: l.productId });
    const avgCost = entryOf(stocks, ret.siteId, l.productId).avgCost;

    addMovement(db, {
      siteId: ret.siteId,
      productId: l.productId,
      type: "RETURN_OUT",
      qty: -baseQty,
      unitCost: avgCost,
      refType: "SUPPLIER_RETURN",
      refId: ret.id,
      refNumber: ret.number,
      date: ret.date,
      userId,
      notes: `Retour fournisseur: ${p.name}`,
    });
  }

  ret.status = "valide";
  pushAudit(db, {
    userId,
    action: "VALIDATE",
    module: "Retours fournisseur",
    detail: `Retour ${ret.number} validé (-stock)`,
    siteId: ret.siteId,
  });
  return ret;
}

export function cancelSupplierReturn(db: DB, id: ID, userId: ID): void {
  if (!db.supplierReturns) db.supplierReturns = [];
  const ret = db.supplierReturns.find((x) => x.id === id);
  if (!ret) throw new Error("Retour introuvable.");
  checkSiteAccess(db, userId, ret.siteId);
  requirePermission(db, userId, 'receptions.cancel');
  if (ret.status !== "valide") throw new Error("Seul un retour validé peut être annulé.");

  // Contre-passation exacte basée sur les mouvements originaux
  const originalMovements = db.movements.filter(m => m.refId === ret.id && m.type === "RETURN_OUT" && m.qty < 0);
  for (const m of originalMovements) {
    addMovement(db, {
      siteId: m.siteId,
      productId: m.productId,
      type: "RETURN_OUT",
      qty: -m.qty, // Quantité positive pour annuler
      unitCost: m.unitCost,
      refType: "SUPPLIER_RETURN",
      refId: ret.id,
      refNumber: ret.number,
      date: todayISO(),
      userId,
      notes: `Annulation du retour ${ret.number}`,
    });
  }

  ret.status = "annule";
  pushAudit(db, {
    userId,
    action: "CANCEL",
    module: "Retours fournisseur",
    detail: `Retour ${ret.number} annulé (contre-passation)`,
    siteId: ret.siteId,
  });
}

/* ================= factures & règlements fournisseurs ================= */

export function invoiceTotals(inv: { lines: { amount: number; vatRate: number }[] }): { ht: number; vat: number; ttc: number } {
  let ht = 0;
  let vat = 0;
  for (const l of inv.lines) {
    ht += l.amount;
    vat += (l.amount * l.vatRate) / 100;
  }
  return {
    ht: Math.round(ht * 100) / 100,
    vat: Math.round(vat * 100) / 100,
    ttc: Math.round((ht + vat) * 100) / 100,
  };
}

export function saveInvoice(db: DB, inv: DB["invoices"][number]): void {
  checkSiteAccess(db, inv.userId, inv.siteId);
  if (!inv.supplierId) throw new Error("Sélectionnez un fournisseur.");
  if (!inv.lines.length) throw new Error("Ajoutez au moins une ligne de facturation.");
  for (const l of inv.lines) {
    if (!l.description.trim()) throw new Error("Chaque ligne de facture nécessite un libellé.");
    if (!isFinite(l.amount) || l.amount <= 0) throw new Error("Les montants de facture doivent être positifs.");
  }
  if (!inv.number) inv.number = nextNumber(db, "FAC");
  const i = db.invoices.findIndex((x) => x.id === inv.id);
  if (i >= 0) db.invoices[i] = inv;
  else db.invoices.push(inv);
  pushAudit(db, {
    userId: inv.userId,
    action: "CREATE",
    module: "Factures",
    detail: `Facture fournisseur ${inv.number} enregistrée`,
    siteId: inv.siteId,
  });
}

export function invoicePaid(db: DB, invoiceId: ID): number {
  return db.payments.filter((p) => p.invoiceId === invoiceId).reduce((s, p) => s + p.amount, 0);
}

export type InvoiceStatusKind = "payee" | "partielle" | "echue" | "impayee";

export function invoiceStatus(db: DB, inv: DB["invoices"][number]): InvoiceStatusKind {
  const ttc = invoiceTotals(inv).ttc;
  const paid = invoicePaid(db, inv.id);
  if (paid >= ttc - 0.01) return "payee";
  if (paid > 0) return "partielle";
  if (inv.dueDate < todayISO()) return "echue";
  return "impayee";
}

export function savePayment(db: DB, pay: DB["payments"][number]): void {
  if (!pay.supplierId) throw new Error("Sélectionnez un fournisseur.");
  assertPositive(pay.amount, "Le montant du règlement");
  if (pay.invoiceId) {
    const inv = db.invoices.find((x) => x.id === pay.invoiceId);
    if (!inv) throw new Error("Facture introuvable.");
    const ttc = invoiceTotals(inv).ttc;
    const already = invoicePaid(db, inv.id);
    if (already + pay.amount > ttc + 0.01)
      throw new Error(`Le règlement dépasse le reste dû de la facture ${inv.number} (reste : ${Math.round((ttc - already) * 100) / 100}).`);
  }
  if (!pay.number) pay.number = nextNumber(db, "PAY");
  db.payments.push(pay);
  pushAudit(db, {
    userId: pay.userId,
    action: "CREATE",
    module: "Règlements",
    detail: `Règlement ${pay.number} enregistré (${pay.amount})`,
    siteId: null,
  });
}

export function supplierBalance(db: DB, supplierId: ID): { invoiced: number; paid: number; balance: number } {
  const sup = db.suppliers.find((s) => s.id === supplierId);
  const invoiced = db.invoices.filter((i) => i.supplierId === supplierId).reduce((s, i) => s + invoiceTotals(i).ttc, 0);
  const paid = db.payments.filter((p) => p.supplierId === supplierId).reduce((s, p) => s + p.amount, 0);
  const opening = sup?.openingBalance ?? 0;
  return {
    invoiced: Math.round((invoiced + opening) * 100) / 100,
    paid: Math.round(paid * 100) / 100,
    balance: Math.round((opening + invoiced - paid) * 100) / 100,
  };
}

/* ================= ventes ================= */

export function saveSale(db: DB, sale: DB["sales"][number]): void {
  checkSiteAccess(db, sale.userId, sale.siteId);
  if (!isFinite(sale.revenue) || sale.revenue < 0) throw new Error("Le chiffre d'affaires saisi est invalide.");
  if (sale.covers < 0) throw new Error("Le nombre de couverts est invalide.");
  const existing = db.sales.find((s) => s.siteId === sale.siteId && s.date === sale.date && s.service === sale.service);
  if (existing) {
    existing.revenue = sale.revenue;
    existing.covers = sale.covers;
    existing.userId = sale.userId;
  } else {
    db.sales.push(sale);
  }
  pushAudit(db, {
    userId: sale.userId,
    action: "CREATE",
    module: "Ventes",
    detail: `CA ${sale.date} / ${sale.service} enregistré`,
    siteId: sale.siteId,
  });
}

/* ---------- DLC / péremption (réceptions validées) ---------- */
export interface ExpiryAlert { productId: ID; expiry: string; qty: number; }

export function soonestExpiry(db: DB, siteId: ID, productId: ID): { expiry: string; qty: number } | null {
  let best: { expiry: string; qty: number } | null = null;
  for (const r of db.receptions) {
    if (r.siteId !== siteId || r.status !== "valide") continue;
    for (const l of r.lines) {
      if (l.productId !== productId || !l.expiry || l.receivedQty <= 0) continue;
      if (!best || l.expiry < best.expiry) best = { expiry: l.expiry, qty: l.receivedQty };
    }
  }
  return best;
}

export function siteExpiries(db: DB, siteId: ID, horizonDays = 14): ExpiryAlert[] {
  const now = Date.now();
  const out: ExpiryAlert[] = [];
  const seen = new Set<string>();
  for (const r of db.receptions) {
    if (r.siteId !== siteId || r.status !== "valide") continue;
    for (const l of r.lines) {
      if (!l.expiry || l.receivedQty <= 0) continue;
      const key = l.productId + "|" + l.expiry;
      if (seen.has(key)) continue;
      seen.add(key);
      const ms = Date.parse(l.expiry);
      if (Number.isNaN(ms)) continue;
      const days = Math.ceil((ms - now) / 86400000);
      if (days >= 0 && days <= horizonDays) out.push({ productId: l.productId, expiry: l.expiry, qty: l.receivedQty });
    }
  }
  out.sort((a, b) => (a.expiry < b.expiry ? -1 : 1));
  return out.slice(0, 10);
}