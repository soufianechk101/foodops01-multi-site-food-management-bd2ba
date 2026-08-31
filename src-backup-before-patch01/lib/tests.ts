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
  validateInventory, cancelInventory,
  validateReception,
  validateWaste,
  receiveTransfer as receiveT,
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
const ECONOME = "u-econome"; // accès : rst + kit uniquement

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

/* ---------- 1. Scénario critique multi-sites (spécification §33) ---------- */
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
    return ok("Multi-site", "Isolation des stocks par site", `Site A = ${a} (attendu 110), Site B = ${b} (attendu 60). Le stock n'est jamais global.`);
  return ko("Multi-site", "Isolation des stocks par site", `Site A = ${a} (attendu 110), Site B = ${b} (attendu 60).`);
}

/* ---------- 2. Coût moyen pondéré par produit + site ---------- */
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
  // (100×10 + 50×12) / 150 = 10.6667
  if (approx(e.avgCost, 10.6667, 0.01) && approx(e.value, 1600, 0.5) && approx(e.qty, 150))
    return ok("Valorisation", "Coût moyen pondéré", `150 kg @ ${e.avgCost.toFixed(2)} MAD, valeur ${e.value.toFixed(2)} — conforme à (100×10 + 50×12) / 150.`);
  return ko("Valorisation", "Coût moyen pondéré", `Coût ${e.avgCost.toFixed(2)} (attendu 10.67), valeur ${e.value.toFixed(2)} (attendu 1600).`);
}

/* ---------- 3. Un brouillon ne touche jamais au stock ---------- */
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
    return ok("Intégrité", "Brouillons et bons sans impact stock", `Réception brouillon (+999) et bon approuvé (+500) : stock inchangé à ${q}.`);
  return ko("Intégrité", "Brouillons et bons sans impact stock", `Stock = ${q}, attendu 40.`);
}

/* ---------- 4. Validation unique (anti double comptabilisation) ---------- */
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
    return ok("Intégrité", "Validation unique d'une réception", `Seconde validation refusée (« ${err} ») ; stock compté une seule fois : ${q}.`);
  return ko("Intégrité", "Validation unique d'une réception", err ? `Stock incohérent : ${q}` : "La double validation n'a pas été bloquée !");
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
    return ok("Intégrité", "Blocage du stock négatif", `Consommation de 50 sur 5 refusée (« ${err} ») ; stock intact : ${q}.`);
  return ko("Intégrité", "Blocage du stock négatif", err ? `Stock modifié à tort : ${q}` : "La sortie excessive n'a pas été bloquée !");
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
  const qOut = currentQty(db, SITE_A, P);
  receiveT(db, t.id, ADMIN);
  const errDouble = expectThrow(() => receiveT(db, t.id, ADMIN));
  const qA = currentQty(db, SITE_A, P);
  const qB = currentQty(db, SITE_B, P);

  if (errSame && errQty && errDouble && approx(qOut, 10) && approx(qA, 10) && approx(qB, 20))
    return ok("Transferts", "Gardes-fous transfert", `Même site refusé, quantité excessive refusée, double réception refusée ; A : 30 → 10, B : 0 → 20.`);
  return ko("Transferts", "Gardes-fous transfert", `same=${!!errSame} qty=${!!errQty} double=${!!errDouble} A=${qA} B=${qB}`);
}

/* ---------- 7. Écart d'inventaire → ajustements ---------- */
function testInventoryVariance(): TestResult {
  const db = fresh();
  const P = "p-test-inv";
  newProduct(db, P, "Test inventaire");
  createInitialStock(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, lines: [{ productId: P, qty: 100, unitCost: 9 }] });
  const before = db.movements.length;
  // Le seed peut laisser un inventaire en cours sur ce site : on le clôt avant
  const openInv = db.inventories.find((i) => i.siteId === SITE_A && i.status === "en_cours");
  if (openInv) cancelInventory(db, openInv.id, ADMIN);
  const inv = createInventory(db, { siteId: SITE_A, date: todayISO(), userId: ADMIN, categoryId: null });
  setInventoryActual(db, inv.id, P, 96, ADMIN);
  validateInventory(db, inv.id, ADMIN);
  const q = currentQty(db, SITE_A, P);
  const adj = db.movements.slice(before).find((m) => m.productId === P && m.type === "INVENTORY_ADJUSTMENT_OUT");
  const errAgain = expectThrow(() => validateInventory(db, inv.id, ADMIN));
  if (approx(q, 96) && adj && approx(adj.qty, -4) && errAgain)
    return ok("Inventaire", "Écart transformé en ajustement", `Théorique 100, compté 96 → ajustement sortant de 4 ; stock final ${q}. Double validation refusée.`);
  return ko("Inventaire", "Écart transformé en ajustement", `Stock ${q} (attendu 96), mouvement trouvé : ${!!adj}, double validation bloquée : ${!!errAgain}.`);
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
  const mv = db.movements.find((m) => m.refId === w.id && m.type === "WASTE");
  if (approx(q, 17) && mv && approx(mv.qty, -3))
    return ok("Pertes", "Perte validée réduit le stock", `20 − 3 = ${q}, mouvement WASTE de −3 traceable (${mv.refNumber}).`);
  return ko("Pertes", "Perte validée réduit le stock", `Stock ${q} (attendu 17), mouvement : ${!!mv}.`);
}

/* ---------- 9. Permissions appliquées dans le moteur ---------- */
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
  // L'économe n'a accès qu'aux sites rst + kit : toute opération sur le site htl doit être refusée.
  const err = expectThrow(() => validateReception(db, rec.id, ECONOME));
  const q = currentQty(db, SITE_B, P);
  if (err && approx(q, 10))
    return ok("Permissions", "Accès site refusé côté moteur", `Validation par un utilisateur sans accès au site refusée (« ${err} ») ; stock intact.`);
  return ko("Permissions", "Accès site refusé côté moteur", err ? `Stock modifié à tort : ${q}` : "L'opération interdite a été exécutée !");
}

/* ---------- 10. Stock initial unique par site + produit ---------- */
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
    return ok("Stock initial", "Unicité par site + produit", `Second stock initial refusé (« ${err} ») ; quantité inchangée : ${q}.`);
  return ko("Stock initial", "Unicité par site + produit", `q=${q}, bloqué=${!!err}.`);
}

/* ---------- 11. Sauvegarde / restauration ---------- */
function testBackupRestore(): TestResult {
  const db = fresh();
  const before = entryOf(computeStocks(db), "site-wh", "p-riz");
  const payload = JSON.stringify(db);
  const restored = JSON.parse(payload) as DB;
  const after = entryOf(computeStocks(restored), "site-wh", "p-riz");
  if (approx(before.qty, after.qty) && approx(before.avgCost, after.avgCost) && restored.movements.length === db.movements.length)
    return ok("Sauvegarde", "Aller-retour sauvegarde / restauration", `${db.movements.length} mouvements restaurés, stocks identiques (${after.qty} kg riz @ ${after.avgCost.toFixed(2)}).`);
  return ko("Sauvegarde", "Aller-retour sauvegarde / restauration", "Divergence après restauration.");
}

/* ---------- 12. Réception depuis bon de commande ---------- */
function testPOFlow(): TestResult {
  const db = fresh();
  const P = "p-riz";
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
  const qDraft = currentQty(db, SITE_A, P);
  validateReception(db, rec.id, MANAGER);
  const qFinal = currentQty(db, SITE_A, P);
  const poAfter = db.purchaseOrders.find((p) => p.id === po.id);
  if (approx(qDraft, base) && approx(qFinal, base + 40) && poAfter?.status === "recu")
    return ok("Achats", "Flux bon → réception → stock", `Bon génère la réception pré-remplie ; stock ${base} → ${qFinal} (+40), bon passé « reçu ».`);
  return ko("Achats", "Flux bon → réception → stock", `base=${base} brouillon=${qDraft} final=${qFinal} statut=${poAfter?.status}.`);
}

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
  ];
  const results = tests.map((t) => {
    try {
      return t();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { module: "Erreur", name: t.name, pass: false, detail: `Exception non gérée : ${msg}` } as TestResult;
    }
  });

  // Affichage des résultats quand le fichier est exécuté en CLI (tsx/node)
  let failed = 0;
  for (const r of results) {
    const ok = r.pass ? "PASS" : "FAIL";
    console.log(`[${ok}] [${r.module}] ${r.name}${r.pass ? "" : ` — ${r.detail}`}`);
    if (!r.pass) failed += 1;
  }
  const total = results.length;
  console.log(`\n${total - failed}/${total} tests réussis`);
  if (failed > 0) {
    // Définit le code de sortie sans dépendre des types Node (globalThis)
    const g = globalThis as { process?: { exitCode?: number } };
    if (g.process) g.process.exitCode = 1;
  }
  return results;
}
