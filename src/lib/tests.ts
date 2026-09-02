/* ============================================================
   FoodOps — Suite de tests automatisés du moteur de stock
   S'exécute sur un clone de travail de la base : jamais sur
   les données réelles de l'utilisateur.
   ============================================================ */
import { buildSeed } from "./seed";
import {
  computeStocks,
  createInitialStock,
  createInventory,
  currentQty,
  dispatchTransfer,
  approveTransfer,
  receiveTransfer,
  entryOf,
  receptionFromPO,
  saveConsumption,
  savePO,
  saveReception,
  saveTransfer,
  saveWaste,
  setInventoryActual,
  setPOStatus,
  validateConsumption,
  validateInventory,
  cancelInventory,
  validateReception,
  validateWaste,
  receiveTransfer as receiveT,
  cancelTransfer,
  saveSupplierReturn,
  validateSupplierReturn,
  cancelSupplierReturn,
  cancelReception,
  cancelConsumption,
  cancelWaste,
  hasPermission,
} from "./engine";
import type { DB } from "../types";
import { nowISO, todayISO, uid } from "./util";

export interface TestResult {
  name: string;
  module: string;
  pass: boolean;
  detail: string;
}

const fresh = (): DB => JSON.parse(JSON.stringify(buildSeed())) as DB;

const SITE_A = "site-rst";
const SITE_B = "site-htl";
const ADMIN = "u-admin";
const MANAGER = "u-manager";
const ECONOME = "u-econome";

const ok = (module: string, name: string, detail: string): TestResult => ({ module, name, pass: true, detail });
const ko = (module: string, name: string, detail: string): TestResult => ({ module, name, pass: false, detail });

const approx = (a: number, b: number, eps = 0.011) => Math.abs(a - b) < eps;

const newProduct = (db: DB, id: string, name: string) => {
  db.products.push({
    id, code: "TEST-" + id.toUpperCase(), name, categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-kg", conversion: 1, vatRate: 10, minStock: 10, reorderPoint: 20,
    supplierId: "s-atlas", purchasePrice: 10, status: "actif", createdAt: nowISO(),
  });
};

function expectThrow(fn: () => void, contains?: string): string | null {
  try {
    fn();
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (contains && !msg.toLowerCase().includes(contains.toLowerCase()))
      return `erreur inattendue : « ${msg} »`;
    return msg;
  }
}

/* ---------- 1. Scénario critique multi-sites ---------- */
function testMultiSite(): TestResult {
  const db = fresh();
  const P = "p-test-riz";
  newProduct(db, P, "Riz test multi-sites");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });

  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "test", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 30, receivedQty: 30, unitCost: 12, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);

  const conso = {
    id: uid(), number: "", siteId: SITE_B, date: todayISO(), service: "dejeuner" as const,
    status: "brouillon" as const, notes: "test", userId: MANAGER, createdAt: nowISO(),
    lines: [{ productId: P, qty: 10 }],
  };
  saveConsumption(db, conso);
  validateConsumption(db, conso.id, MANAGER);

  const tr = {
    id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(),
    status: "brouillon" as const, notes: "test", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 20, unitCost: 10.4 }],
  };
  saveTransfer(db, tr);
  approveTransfer(db, tr.id, ADMIN);
  dispatchTransfer(db, tr.id, ADMIN);
  receiveTransfer(db, tr.id, ADMIN);

  const a = currentQty(db, SITE_A, P);
  const b = currentQty(db, SITE_B, P);
  if (approx(a, 110) && approx(b, 60))
    return ok("Multi-site", "Isolation des stocks par site", `Site A = ${a} (attendu 110), Site B = ${b} (attendu 60).`);
  return ko("Multi-site", "Isolation des stocks par site", `Site A = ${a}, Site B = ${b}.`);
}

/* ---------- 2. Coût moyen pondéré ---------- */
function testWeightedAverage(): TestResult {
  const db = fresh();
  const P = "p-test-cmp";
  newProduct(db, P, "Test coût moyen");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 50, receivedQty: 50, unitCost: 12, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);
  const e = entryOf(computeStocks(db), SITE_A, P);
  if (approx(e.avgCost, 10.6667, 0.01) && approx(e.value, 1600, 0.5) && approx(e.qty, 150))
    return ok("Valorisation", "Coût moyen pondéré", `150 kg @ ${e.avgCost.toFixed(2)} MAD.`);
  return ko("Valorisation", "Coût moyen pondéré", `Coût ${e.avgCost.toFixed(2)}, valeur ${e.value.toFixed(2)}.`);
}

/* ---------- 3. Brouillon neutre ---------- */
function testDraftNeutrality(): TestResult {
  const db = fresh();
  const P = "p-test-brouillon";
  newProduct(db, P, "Test brouillon");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 40, unitCost: 8 }] });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 999, receivedQty: 999, unitCost: 8, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  const po = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), expectedDate: todayISO(),
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 500, unitCost: 8, vatRate: 10, receivedQty: 0 }],
  };
  savePO(db, po);
  setPOStatus(db, po.id, "soumis", ADMIN);
  setPOStatus(db, po.id, "approuve", ADMIN);
  const q = currentQty(db, SITE_A, P);
  if (approx(q, 40))
    return ok("Intégrité", "Brouillons sans impact stock", `Stock inchangé à ${q}.`);
  return ko("Intégrité", "Brouillons sans impact stock", `Stock = ${q}, attendu 40.`);
}

/* ---------- 4. Validation unique ---------- */
function testSinglePosting(): TestResult {
  const db = fresh();
  const P = "p-test-duplicate";
  newProduct(db, P, "Test doublon");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 10, unitCost: 5 }] });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 25, receivedQty: 25, unitCost: 5, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);
  const err = expectThrow(() => validateReception(db, rec.id, ADMIN));
  const q = currentQty(db, SITE_A, P);
  if (err && approx(q, 35))
    return ok("Intégrité", "Validation unique", `Double validation refusée ; stock : ${q}.`);
  return ko("Intégrité", "Validation unique", err ? `Stock : ${q}` : "Double validation non bloquée !");
}

/* ---------- 5. Stock négatif interdit ---------- */
function testNegativeStock(): TestResult {
  const db = fresh();
  db.company.allowNegativeStock = false;
  const P = "p-test-neg";
  newProduct(db, P, "Test stock négatif");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 5, unitCost: 6 }] });
  const conso = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const,
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 50 }],
  };
  saveConsumption(db, conso);
  const err = expectThrow(() => validateConsumption(db, conso.id, ADMIN), "insuffisant");
  const q = currentQty(db, SITE_A, P);
  if (err && approx(q, 5))
    return ok("Intégrité", "Blocage stock négatif", `Consommation refusée ; stock : ${q}.`);
  return ko("Intégrité", "Blocage stock négatif", err ? `Stock : ${q}` : "Sortie non bloquée !");
}

/* ---------- 6. Gardes-fous des transferts ---------- */
function testTransferGuards(): TestResult {
  const db = fresh();
  const P = "p-test-trf";
  newProduct(db, P, "Test transfert");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 30, unitCost: 7 }] });

  const mk = (to: string, qty: number) => ({
    id: uid(), number: "", fromSiteId: SITE_A, toSiteId: to, date: todayISO(),
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty, unitCost: 7 }],
  });

  const errSame = expectThrow(() => saveTransfer(db, mk(SITE_A, 10)), "différent");
  const errQty = expectThrow(() => {
    const t = mk(SITE_B, 999);
    saveTransfer(db, t);
    approveTransfer(db, t.id, ADMIN);
    dispatchTransfer(db, t.id, ADMIN);
  }, "insuffisant");

  const t = mk(SITE_B, 20);
  saveTransfer(db, t);
  approveTransfer(db, t.id, ADMIN);
  dispatchTransfer(db, t.id, ADMIN);
  receiveT(db, t.id, ADMIN);
  const errDouble = expectThrow(() => receiveT(db, t.id, ADMIN));
  const qA = currentQty(db, SITE_A, P);
  const qB = currentQty(db, SITE_B, P);

  if (errSame && errQty && errDouble && approx(qA, 10) && approx(qB, 20))
    return ok("Transferts", "Gardes-fous", `A : 10, B : 20.`);
  return ko("Transferts", "Gardes-fous", `A=${qA} B=${qB}`);
}

/* ---------- 7. Écart d'inventaire ---------- */
function testInventoryVariance(): TestResult {
  const db = fresh();
  const P = "p-test-inv";
  newProduct(db, P, "Test inventaire");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 9 }] });
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);
  const inv = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  setInventoryActual(db, inv.id, P, 96, ADMIN);
  validateInventory(db, inv.id, ADMIN);
  const q = currentQty(db, SITE_A, P);
  if (approx(q, 96))
    return ok("Inventaire", "Écart ajusté", `Stock final ${q}.`);
  return ko("Inventaire", "Écart ajusté", `Stock ${q} (attendu 96).`);
}

/* ---------- 8. Pertes validées ---------- */
function testWaste(): TestResult {
  const db = fresh();
  const P = "p-test-wst";
  newProduct(db, P, "Test perte");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 20, unitCost: 4 }] });
  const w = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Expiré",
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 3 }],
  };
  saveWaste(db, w);
  validateWaste(db, w.id, ADMIN);
  const q = currentQty(db, SITE_A, P);
  if (approx(q, 17))
    return ok("Pertes", "Perte validée", `Stock ${q}.`);
  return ko("Pertes", "Perte validée", `Stock ${q} (attendu 17).`);
}

/* ---------- 9. Permissions ---------- */
function testPermissions(): TestResult {
  const db = fresh();
  const P = "p-test-perm";
  newProduct(db, P, "Test permissions");
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 10, unitCost: 5 }] });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_B, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: MANAGER, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 5, receivedQty: 5, unitCost: 5, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  const err = expectThrow(() => validateReception(db, rec.id, ECONOME));
  const q = currentQty(db, SITE_B, P);
  if (err && approx(q, 10))
    return ok("Permissions", "Accès site refusé", `Stock intact : ${q}.`);
  return ko("Permissions", "Accès site refusé", err ? `Stock : ${q}` : "Opération exécutée !");
}

/* ---------- 10. Stock initial unique ---------- */
function testInitialStockOnce(): TestResult {
  const db = fresh();
  const P = "p-test-init";
  newProduct(db, P, "Test stock initial");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 10, unitCost: 5 }] });
  const err = expectThrow(() =>
    createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 99, unitCost: 5 }] })
  );
  const q = currentQty(db, SITE_A, P);
  if (err && approx(q, 10))
    return ok("Stock initial", "Unicité", `Stock : ${q}.`);
  return ko("Stock initial", "Unicité", `q=${q}.`);
}

/* ---------- 11. Sauvegarde / restauration ---------- */
function testBackupRestore(): TestResult {
  const db = fresh();
  const before = entryOf(computeStocks(db), "site-wh", "p-riz");
  const payload = JSON.stringify(db);
  const restored = JSON.parse(payload) as DB;
  const after = entryOf(computeStocks(restored), "site-wh", "p-riz");
  if (approx(before.qty, after.qty) && approx(before.avgCost, after.avgCost))
    return ok("Sauvegarde", "Restauration", `Stocks identiques.`);
  return ko("Sauvegarde", "Restauration", "Divergence.");
}

/* ---------- 12. Réception depuis bon de commande ---------- */
function testPOFlow(): TestResult {
  const db = fresh();
  const P = "p-test-po";
  newProduct(db, P, "Test PO Flow");
  
  const base = currentQty(db, SITE_A, P);
  const po = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), expectedDate: todayISO(),
    status: "brouillon" as const, notes: "", userId: MANAGER, createdAt: nowISO(),
    lines: [{ productId: P, qty: 40, unitCost: 10.5, vatRate: 10, receivedQty: 0 }],
  };
  savePO(db, po);
  setPOStatus(db, po.id, "soumis", ADMIN);
  setPOStatus(db, po.id, "approuve", ADMIN);
  const rec = receptionFromPO(db, po.id, MANAGER);
  validateReception(db, rec.id, MANAGER);
  const qFinal = currentQty(db, SITE_A, P);
  const poAfter = db.purchaseOrders.find((p) => p.id === po.id);
  
  if (approx(qFinal, base + 40) && poAfter?.status === "recu")
    return ok("Achats", "Flux bon → réception", `Stock ${qFinal}.`);
  return ko("Achats", "Flux bon → réception", `final=${qFinal}.`);
}

/* ---------- 13-24. Tests de Conversion, Atomicité, Audit & Hardening ---------- */
function testReceptionConversion(): TestResult {
  const db = fresh();
  const P = "p-riz-sac";
  db.products.push({
    id: P, code: "RIZ01", name: "Riz (Sac)", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 10, reorderPoint: 20,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 10, receivedQty: 10, unitCost: 250, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);
  const e = entryOf(computeStocks(db), SITE_A, P);
  if (approx(e.qty, 250) && approx(e.avgCost, 10) && approx(e.value, 2500))
    return ok("Conversion", "Réception (Sac -> Kg)", `Stock: ${e.qty}kg, Coût: ${e.avgCost}MAD/kg.`);
  return ko("Conversion", "Réception (Sac -> Kg)", `Attendu: 250kg à 10MAD/kg.`);
}

function testDecimalConversion(): TestResult {
  const db = fresh();
  const P = "p-riz-sac-dec";
  db.products.push({
    id: P, code: "RIZ02", name: "Riz Decimal", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 0.5, receivedQty: 0.5, unitCost: 250, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);
  const e = entryOf(computeStocks(db), SITE_A, P);
  if (approx(e.qty, 12.5))
    return ok("Conversion", "Quantité décimale", `0.5 sac = ${e.qty} kg.`);
  return ko("Conversion", "Quantité décimale", `Attendu 12.5 kg.`);
}

function testInvalidConversionRejection(): TestResult {
  const db = fresh();
  const P = "p-bad-conv";
  db.products.push({
    id: P, code: "BAD01", name: "Bad Conversion", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 0, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 100, status: "actif", createdAt: nowISO(),
  });
  const rec = {
    id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null,
    invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, orderedQty: 1, receivedQty: 1, unitCost: 100, vatRate: 10, lot: "", expiry: "" }],
  };
  saveReception(db, rec);
  const err = expectThrow(() => validateReception(db, rec.id, ADMIN));
  if (err && err.includes("strictement supérieur à zéro"))
    return ok("Conversion", "Rejet conversion invalide", `Erreur levée.`);
  return ko("Conversion", "Rejet conversion invalide", "Aucune erreur.");
}

function testTransferConversion(): TestResult {
  const db = fresh();
  const P = "p-trf-conv";
  db.products.push({
    id: P, code: "TRF01", name: "Transfert Test", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  
  const tr = {
    id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(),
    status: "brouillon" as const, notes: "test", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 2, unitCost: 10 }],
  };
  saveTransfer(db, tr);
  approveTransfer(db, tr.id, ADMIN);
  dispatchTransfer(db, tr.id, ADMIN);
  receiveT(db, tr.id, ADMIN);

  const a = currentQty(db, SITE_A, P);
  const b = currentQty(db, SITE_B, P);
  if (approx(a, 50) && approx(b, 50))
    return ok("Conversion", "Transfert inter-sites", `Site A: ${a}kg, Site B: ${b}kg.`);
  return ko("Conversion", "Transfert inter-sites", `Site A: ${a}kg, Site B: ${b}kg.`);
}

function testWasteConversion(): TestResult {
  const db = fresh();
  const P = "p-wst-conv";
  db.products.push({
    id: P, code: "WST01", name: "Perte Test", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  
  const w = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Casse",
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 0.5 }],
  };
  saveWaste(db, w);
  validateWaste(db, w.id, ADMIN);
  
  const q = currentQty(db, SITE_A, P);
  if (approx(q, 87.5))
    return ok("Conversion", "Perte (Waste)", `Stock: ${q}kg.`);
  return ko("Conversion", "Perte (Waste)", `Attendu 87.5kg.`);
}

function testInventoryVarianceBaseUnit(): TestResult {
  const db = fresh();
  const P = "p-inv-conv";
  db.products.push({
    id: P, code: "INV01", name: "Inventaire Test", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);
  
  const inv = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  setInventoryActual(db, inv.id, P, 92.5, ADMIN);
  validateInventory(db, inv.id, ADMIN);
  
  const q = currentQty(db, SITE_A, P);
  const adj = db.movements.slice().reverse().find((m) => m.productId === P && m.type === "INVENTORY_ADJUSTMENT_OUT");
  
  if (approx(q, 92.5) && adj && approx(adj.qty, -7.5))
    return ok("Conversion", "Écart d'inventaire", `Stock final: ${q}kg.`);
  return ko("Conversion", "Écart d'inventaire", `Stock final ${q}kg.`);
}

function testAtomicRollback(): TestResult {
  const db = fresh();
  const P = "p-test-atomic";
  newProduct(db, P, "Test Atomic");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 10, unitCost: 5 }] });
  
  const beforeMovements = db.movements.length;
  const beforeQty = currentQty(db, SITE_A, P);
  
  const conso = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const,
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 50 }],
  };
  saveConsumption(db, conso);
  
  try {
    validateConsumption(db, conso.id, ADMIN);
  } catch (e) { /* Attendu */ }
  
  const afterMovements = db.movements.length;
  const afterQty = currentQty(db, SITE_A, P);
  
  if (beforeMovements === afterMovements && approx(beforeQty, afterQty)) {
    return ok("Intégrité", "Rollback complet", `Aucune modification partielle.`);
  }
  return ko("Intégrité", "Rollback complet", `Échec du rollback.`);
}

function testAuditGeneration(): TestResult {
  const db = fresh();
  const P = "p-test-audit";
  newProduct(db, P, "Test Audit");
  const beforeAudits = db.audit.length;
  
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 10, unitCost: 5 }] });
  
  const afterAudits = db.audit.length;
  const auditEntry = db.audit.find((a) => a.module === "Stock initial" && a.userId === ADMIN);
  
  if (afterAudits > beforeAudits && auditEntry && auditEntry.detail.includes("produit(s)")) {
    return ok("Audit", "Génération de trace", `Audits: ${beforeAudits} -> ${afterAudits}.`);
  }
  return ko("Audit", "Génération de trace", `Aucune entrée.`);
}

function testNegativeStockHardening(): TestResult {
  const db = fresh();
  db.company.allowNegativeStock = false;
  
  const P_KG = "p-hard-kg";
  const P_SAC = "p-hard-sac";
  
  newProduct(db, P_KG, "Test Hardening KG");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P_KG, qty: 10, unitCost: 5 }] });
  
  db.products.push({
    id: P_SAC, code: "HARD-SAC", name: "Test Hardening Sac", categoryId: "c-riz", unitId: "u-kg",
    purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0,
    supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO(),
  });
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P_SAC, qty: 50, unitCost: 10 }] });

  const consoFail = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_KG, qty: 12 }] };
  saveConsumption(db, consoFail);
  if (!expectThrow(() => validateConsumption(db, consoFail.id, ADMIN), "insuffisant")) return ko("Negative Stock", "Consumption > Stock", "Failed.");

  const consoExact = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_KG, qty: 10 }] };
  saveConsumption(db, consoExact);
  validateConsumption(db, consoExact.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P_KG), 0)) return ko("Negative Stock", "Consumption == Stock", "Failed.");

  const wasteFail = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Test", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_SAC, qty: 3 }] };
  saveWaste(db, wasteFail);
  if (!expectThrow(() => validateWaste(db, wasteFail.id, ADMIN), "insuffisant")) return ko("Negative Stock", "Waste > Stock", "Failed.");

  const trFail = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_SAC, qty: 3, unitCost: 10 }] };
  saveTransfer(db, trFail);
  approveTransfer(db, trFail.id, ADMIN);
  if (!expectThrow(() => dispatchTransfer(db, trFail.id, ADMIN), "insuffisant")) return ko("Negative Stock", "Transfer > Source", "Failed.");

  const P_INV = "p-hard-inv";
  newProduct(db, P_INV, "Test Inv Hardening");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P_INV, qty: 5, unitCost: 5 }] });
  
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);
  
  const c = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_INV, qty: 4 }] };
  saveConsumption(db, c); 
  validateConsumption(db, c.id, ADMIN);
  
  const inv2 = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  if (!expectThrow(() => setInventoryActual(db, inv2.id, P_INV, -1, ADMIN), "négative")) return ko("Negative Stock", "Inventory Adjustment", "Failed.");

  return ok("Negative Stock", "Politique renforcée", "Tous les scénarios fonctionnent.");
}

function testTransferHardening(): TestResult {
  const db = fresh();
  const P = "p-trf-hard";
  newProduct(db, P, "Test Transfer Hardening");
  
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  createInitialStock(db, { siteId: "site-c", date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 30, unitCost: 10 }] });

  const beforeAudits = db.audit.length;

  const trSame = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_A, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10, unitCost: 10 }] };
  if (!expectThrow(() => saveTransfer(db, trSame), "différents")) return ko("Transfert", "Same-site rejected", "Failed.");

  const trDraft = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 20, unitCost: 10 }] };
  saveTransfer(db, trDraft);
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Transfert", "Draft neutrality", "Failed.");

  const trExceed = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 150, unitCost: 10 }] };
  saveTransfer(db, trExceed);
  approveTransfer(db, trExceed.id, ADMIN);
  if (!expectThrow(() => dispatchTransfer(db, trExceed.id, ADMIN), "insuffisant")) return ko("Transfert", "Exceeding stock rejected", "Failed.");

  const P_SAC = "p-trf-sac";
  db.products.push({ id: P_SAC, code: "TRF-SAC", name: "Test Transfer Sac", categoryId: "c-riz", unitId: "u-kg", purchaseUnitId: "u-sac", conversion: 25, vatRate: 10, minStock: 0, reorderPoint: 0, supplierId: "s-atlas", purchasePrice: 250, status: "actif", createdAt: nowISO() });
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P_SAC, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P_SAC, qty: 50, unitCost: 10 }] });
  
  const trNormal = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P_SAC, qty: 2.5, unitCost: 10 }] };
  saveTransfer(db, trNormal);
  approveTransfer(db, trNormal.id, ADMIN);
  dispatchTransfer(db, trNormal.id, ADMIN);
  
  if (!approx(currentQty(db, SITE_A, P_SAC), 37.5)) return ko("Transfert", "Dispatch OUT", "Failed.");
  if (!approx(currentQty(db, SITE_B, P_SAC), 50)) return ko("Transfert", "Dispatch IN pending", "Failed.");

  if (!expectThrow(() => dispatchTransfer(db, trNormal.id, ADMIN))) return ko("Transfert", "Duplicate dispatch rejected", "Failed.");

  receiveTransfer(db, trNormal.id, ADMIN);
  if (!approx(currentQty(db, SITE_B, P_SAC), 112.5)) return ko("Transfert", "Receive IN", "Failed.");

  if (!expectThrow(() => receiveTransfer(db, trNormal.id, ADMIN))) return ko("Transfert", "Duplicate receive rejected", "Failed.");

  if (!approx(currentQty(db, "site-c", P), 30)) return ko("Transfert", "Third site isolation", "Failed.");

  const trCancel = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10, unitCost: 10 }] };
  saveTransfer(db, trCancel);
  approveTransfer(db, trCancel.id, ADMIN);
  dispatchTransfer(db, trCancel.id, ADMIN);
  
  const movBeforeCancel = db.movements.length;
  cancelTransfer(db, trCancel.id, ADMIN);
  
  if (db.movements.length !== movBeforeCancel + 1) return ko("Transfert", "Cancellation history", "Failed.");
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Transfert", "Cancellation reversal", "Failed.");

  return ok("Transfert", "Workflow durci", "Tous les scénarios fonctionnent.");
}

function testSupplierReturnHardening(): TestResult {
  const db = fresh();
  db.company.allowNegativeStock = false;
  const P = "p-ret-hard";
  newProduct(db, P, "Test Return Hardening");
  
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  
  const beforeAudits = db.audit.length;
  const beforeMovements = db.movements.length;

  const ret = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 20 }] };
  saveSupplierReturn(db, ret);
  validateSupplierReturn(db, ret.id, ADMIN);
  
  if (!approx(currentQty(db, SITE_A, P), 80)) return ko("Retour", "Stock decrease", "Failed.");
  if (!approx(currentQty(db, SITE_B, P), 50)) return ko("Retour", "Site isolation", "Failed.");

  if (!expectThrow(() => validateSupplierReturn(db, ret.id, ADMIN))) return ko("Retour", "Duplicate validation", "Failed.");

  const retExceed = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 90 }] };
  saveSupplierReturn(db, retExceed);
  const movBeforeFail = db.movements.length;
  if (!expectThrow(() => validateSupplierReturn(db, retExceed.id, ADMIN), "insuffisant")) return ko("Retour", "Negative stock", "Failed.");
  if (db.movements.length !== movBeforeFail) return ko("Retour", "Atomicity", "Failed.");

  cancelSupplierReturn(db, ret.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Retour", "Cancellation", "Failed.");
  
  const retMovements = db.movements.filter(m => m.refId === ret.id && m.type === "RETURN_OUT");
  if (retMovements.length !== 2) return ko("Retour", "Cancellation history", "Failed.");

  return ok("Retour", "Workflow durci", "Tous les scénarios fonctionnent.");
}

function testCancellationAndReversalHardening(): TestResult {
  const db = fresh();
  const P = "p-cancel-hard";
  newProduct(db, P, "Test Cancel Hardening");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);

  const rec = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 20, receivedQty: 20, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  saveReception(db, rec);
  validateReception(db, rec.id, ADMIN);
  cancelReception(db, rec.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Annulation", "Reception reversal", "Failed.");

  const conso = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10 }] };
  saveConsumption(db, conso);
  validateConsumption(db, conso.id, ADMIN);
  cancelConsumption(db, conso.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Annulation", "Consumption reversal", "Failed.");

  const tr = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10, unitCost: 10 }] };
  saveTransfer(db, tr);
  approveTransfer(db, tr.id, ADMIN);
  dispatchTransfer(db, tr.id, ADMIN);
  cancelTransfer(db, tr.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 100)) return ko("Annulation", "Transfer reversal A", "Failed.");
  
  const tr2 = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10, unitCost: 10 }] };
  saveTransfer(db, tr2); approveTransfer(db, tr2.id, ADMIN); dispatchTransfer(db, tr2.id, ADMIN); receiveTransfer(db, tr2.id, ADMIN);
  if (!expectThrow(() => cancelTransfer(db, tr2.id, ADMIN))) return ko("Annulation", "Received transfer cancellation", "Failed.");

  const waste = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Test", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 5 }] };
  saveWaste(db, waste); 
  validateWaste(db, waste.id, ADMIN);
  cancelWaste(db, waste.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 90)) return ko("Annulation", "Waste reversal", `Stock should return to 90, got ${currentQty(db, SITE_A, P)}.`);

  const inv = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  cancelInventory(db, inv.id, ADMIN);
  if (inv.status !== "annule") return ko("Annulation", "Inventory cancellation", "Failed.");
  
  const inv2 = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  setInventoryActual(db, inv2.id, P, 90, ADMIN); validateInventory(db, inv2.id, ADMIN);
  if (!expectThrow(() => cancelInventory(db, inv2.id, ADMIN))) return ko("Annulation", "Validated inventory cancellation", "Failed.");

  if (!db.supplierReturns) db.supplierReturns = [];
  const ret = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 10 }] };
  saveSupplierReturn(db, ret); validateSupplierReturn(db, ret.id, ADMIN);
  cancelSupplierReturn(db, ret.id, ADMIN);
  if (!approx(currentQty(db, SITE_A, P), 90)) return ko("Annulation", "Return reversal", "Failed.");

  const rec2 = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 150, receivedQty: 150, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  saveReception(db, rec2); validateReception(db, rec2.id, ADMIN);
  const conso2 = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, qty: 200 }] };
  saveConsumption(db, conso2); validateConsumption(db, conso2.id, ADMIN);
  
  const movBeforeFail = db.movements.length;
  if (!expectThrow(() => cancelReception(db, rec2.id, ADMIN), "insuffisant")) return ko("Annulation", "Atomic failure", "Failed.");
  if (db.movements.length !== movBeforeFail) return ko("Annulation", "Atomic failure movements", "Failed.");
  if (!approx(currentQty(db, SITE_A, P), 40)) return ko("Annulation", "Atomic failure stock", "Failed.");

  return ok("Annulation", "Mécanismes durcis", "Toutes les annulations sont atomiques.");
}

function testPermissionsHardening(): TestResult {
  const db = fresh();
  const P = "p-perm-hard";
  newProduct(db, P, "Test Permissions");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 10 }] });
  createInitialStock(db, { siteId: SITE_B, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);

  const controleurId = "u-ctrl-test";
  const economeId = "u-eco-test";
  const managerId = "u-mgr-test";
  
  db.users.push(
    { id: controleurId, name: "Test Controleur", username: "ctrl", passwordHash: "h", role: "controleur", siteIds: "all", active: true, createdAt: nowISO() },
    { id: economeId, name: "Test Econome", username: "eco", passwordHash: "h", role: "econome", siteIds: [SITE_A], active: true, createdAt: nowISO() },
    { id: managerId, name: "Test Manager", username: "mgr", passwordHash: "h", role: "manager", siteIds: "all", active: true, createdAt: nowISO() }
  );

  const recCtrl = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: controleurId, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 10, receivedQty: 10, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  saveReception(db, recCtrl);
  const errCtrlRec = expectThrow(() => validateReception(db, recCtrl.id, controleurId));
  if (!errCtrlRec || !errCtrlRec.includes("autorisation")) return ko("Permissions", "Controleur reception", "Failed.");
  
  const recEco = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_B, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: economeId, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 10, receivedQty: 10, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  const errEcoSite = expectThrow(() => saveReception(db, recEco));
  if (!errEcoSite || !errEcoSite.includes("accès")) return ko("Permissions", "Econome site isolation", "Failed.");

  const recEcoA = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: economeId, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 5, receivedQty: 5, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  saveReception(db, recEcoA);
  try {
    validateReception(db, recEcoA.id, economeId);
  } catch (e) {
    return ko("Permissions", "Econome valid reception", `Failed: ${e instanceof Error ? e.message : e}`);
  }

  if (!expectThrow(() => { if (!hasPermission(db, managerId, 'users.create')) throw new Error("Pas autorisé"); })) return ko("Permissions", "Manager users", "Failed.");

  const trEco = { id: uid(), number: "", fromSiteId: SITE_A, toSiteId: SITE_B, date: todayISO(), status: "brouillon" as const, notes: "", userId: economeId, createdAt: nowISO(), lines: [{ productId: P, qty: 10, unitCost: 10 }] };
  const errTrEco = expectThrow(() => saveTransfer(db, trEco));
  if (!errTrEco || !errTrEco.includes("accès")) return ko("Permissions", "Transfer site isolation", "Failed.");

  const invEco = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: economeId, categoryId: null });
  setInventoryActual(db, invEco.id, P, 95, economeId);
  const errInvEco = expectThrow(() => validateInventory(db, invEco.id, economeId));
  if (!errInvEco || !errInvEco.includes("autorisation")) return ko("Permissions", "Econome inventory validate", "Failed.");

  const consoCtrl = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "diner" as const, status: "brouillon" as const, notes: "", userId: controleurId, createdAt: nowISO(), lines: [{ productId: P, qty: 1 }] };
  saveConsumption(db, consoCtrl);
  const errConsoCtrl = expectThrow(() => validateConsumption(db, consoCtrl.id, controleurId));
  if (!errConsoCtrl || !errConsoCtrl.includes("autorisation")) return ko("Permissions", "Controleur consumption", "Failed.");

  const wasteCtrl = { id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Test", status: "brouillon" as const, notes: "", userId: controleurId, createdAt: nowISO(), lines: [{ productId: P, qty: 1 }] };
  saveWaste(db, wasteCtrl);
  const errWasteCtrl = expectThrow(() => validateWaste(db, wasteCtrl.id, controleurId));
  if (!errWasteCtrl || !errWasteCtrl.includes("autorisation")) return ko("Permissions", "Controleur waste", "Failed.");

  const recMgr = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: managerId, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 5, receivedQty: 5, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
  saveReception(db, recMgr);
  try {
    validateReception(db, recMgr.id, managerId);
  } catch (e) {
    return ko("Permissions", "Manager reception", `Failed: ${e instanceof Error ? e.message : e}`);
  }

  try {
    const recAdm = { id: uid(), number: "", supplierId: "s-atlas", siteId: SITE_A, date: todayISO(), poId: null, invoiceRef: "", status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(), lines: [{ productId: P, orderedQty: 5, receivedQty: 5, unitCost: 10, vatRate: 10, lot: "", expiry: "" }] };
    saveReception(db, recAdm);
    validateReception(db, recAdm.id, ADMIN);
  } catch (e) {
    return ko("Permissions", "Admin full access", `Failed: ${e instanceof Error ? e.message : e}`);
  }

  return ok("Permissions", "Système renforcé", "Toutes les vérifications fonctionnent.");
}

/* ============================================================
   Exécution de la suite de tests
   ============================================================ */
export function runEngineTests(): TestResult[] {
  const tests = [
    testMultiSite,
    testWeightedAverage,
    testDraftNeutrality,
    testSinglePosting,
    testNegativeStock,
    testTransferGuards,
    testInventoryVariance,
    testWaste,
    testPermissions,
    testInitialStockOnce,
    testBackupRestore,
    testPOFlow,
    testReceptionConversion,
    testDecimalConversion,
    testInvalidConversionRejection,
    testTransferConversion,
    testWasteConversion,
    testInventoryVarianceBaseUnit,
    testAtomicRollback,
    testAuditGeneration,
    testNegativeStockHardening,
    testTransferHardening,
    testSupplierReturnHardening,
    testCancellationAndReversalHardening,
    testPermissionsHardening,
    testConsumptionIdempotency,
    testWasteIdempotency,
  ];
  
  const results = tests.map((t) => {
    try {
      return t();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { module: "Erreur", name: t.name, pass: false, detail: `Exception : ${msg}` } as TestResult;
    }
  });

  let failed = 0;
  for (const r of results) {
    const okLog = r.pass ? "PASS" : "FAIL";
    console.log(`[${okLog}] [${r.module}] ${r.name}${r.pass ? "" : ` — ${r.detail}`}`);
    if (!r.pass) failed += 1;
  }
  const total = results.length;
  console.log(`\n${total - failed}/${total} tests réussis`);
  if (failed > 0) {
    const g = globalThis as { process?: { exitCode?: number } };
    if (g.process) g.process.exitCode = 1;
  }
  return results;
}
/* ---------- 17. Idempotence : Consommation validée deux fois ---------- */
function testConsumptionIdempotency(): TestResult {
  const db = fresh();
  const P = "p-conso-idem";
  newProduct(db, P, "Test Conso Idempotency");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  
  const conso = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), service: "dejeuner" as const,
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 20 }],
  };
  saveConsumption(db, conso);
  validateConsumption(db, conso.id, ADMIN);
  
  const q1 = currentQty(db, SITE_A, P);
  if (!approx(q1, 30)) return ko("Idempotence", "Première validation", `Attendu 30, obtenu ${q1}`);

  const err = expectThrow(() => validateConsumption(db, conso.id, ADMIN));
  if (!err) return ko("Idempotence", "Double validation", "Devrait rejeter la seconde validation.");

  const q2 = currentQty(db, SITE_A, P);
  if (!approx(q2, 30)) return ko("Idempotence", "Stock après rejet", `Attendu 30, obtenu ${q2}`);

  return ok("Idempotence", "Consommation validée deux fois", "La seconde validation est rejetée, le stock reste à 30.");
}

/* ---------- 18. Idempotence : Perte validée deux fois ---------- */
function testWasteIdempotency(): TestResult {
  const db = fresh();
  const P = "p-waste-idem";
  newProduct(db, P, "Test Waste Idempotency");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 50, unitCost: 10 }] });
  
  const waste = {
    id: uid(), number: "", siteId: SITE_A, date: todayISO(), reason: "Test",
    status: "brouillon" as const, notes: "", userId: ADMIN, createdAt: nowISO(),
    lines: [{ productId: P, qty: 20 }],
  };
  saveWaste(db, waste);
  validateWaste(db, waste.id, ADMIN);
  
  const q1 = currentQty(db, SITE_A, P);
  if (!approx(q1, 30)) return ko("Idempotence", "Première validation", `Attendu 30, obtenu ${q1}`);

  const err = expectThrow(() => validateWaste(db, waste.id, ADMIN));
  if (!err) return ko("Idempotence", "Double validation", "Devrait rejeter la seconde validation.");

  const q2 = currentQty(db, SITE_A, P);
  if (!approx(q2, 30)) return ko("Idempotence", "Stock après rejet", `Attendu 30, obtenu ${q2}`);

  return ok("Idempotence", "Perte validée deux fois", "La seconde validation est rejetée, le stock reste à 30.");
}