/* ============================================================
   FoodOps — Jeu de données de démonstration
   Construit EXCLUSIVEMENT via le moteur de stock : chaque
   quantité existante provient d'un mouvement traçable.
   ============================================================ */

import type { Category, DB, ID, Product, Site, Supplier, Unit, User } from "../types";
import {
  approveTransfer,
  createInitialStock,
  createInventory,
  dispatchTransfer,
  receptionFromPO,
  receiveTransfer,
  saveConsumption,
  saveInvoice,
  savePayment,
  savePO,
  saveReception,
  saveSale,
  saveTransfer,
  saveWaste,
  setInventoryActual,
  setPOStatus,
  validateConsumption,
  validateInventory,
  validateReception,
  validateWaste,
  computeStocks,
  entryOf,
} from "./engine";
import { addDaysISO, daysAgoISO, hashPw, nowISO, todayISO, uid } from "./util";

export const DEMO_ACCOUNTS = [
  { username: "proprietaire", password: "Owner@123", name: "Nadia Cherkaoui", role: "Propriétaire" },
  { username: "admin", password: "Admin@123", name: "Amina Benali", role: "Administratrice" },
  { username: "manager", password: "manager123", name: "Yassine Alami", role: "Gestionnaire" },
  { username: "econome", password: "econome123", name: "Khadija Idrissi", role: "Économe" },
  { username: "controleur", password: "ctrl123", name: "Omar Tazi", role: "Contrôleur" },
];

/* RNG déterministe */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const S = {
  rst: "site-rst",
  htl: "site-htl",
  kit: "site-kit",
  wh: "site-wh",
};

const U = {
  admin: "u-admin",
  manager: "u-manager",
  econome: "u-econome",
  ctrl: "u-ctrl",
  sys: "u-admin",
};

function refData() {
  const units: Unit[] = [
    { id: "u-kg", code: "kg", name: "Kilogramme" },
    { id: "u-g", code: "g", name: "Gramme" },
    { id: "u-l", code: "L", name: "Litre" },
    { id: "u-ml", code: "ml", name: "Millilitre" },
    { id: "u-un", code: "unité", name: "Unité" },
    { id: "u-sac", code: "sac", name: "Sac" },
    { id: "u-carton", code: "carton", name: "Carton" },
    { id: "u-btl", code: "btl", name: "Bouteille" },
    { id: "u-plateau", code: "plateau", name: "Plateau" },
    { id: "u-bidon", code: "bidon", name: "Bidon" },
    { id: "u-boite", code: "boîte", name: "Boîte" },
  ];

  const categories: Category[] = [
    { id: "c-epic", name: "Épicerie sèche", parentId: null },
    { id: "c-riz", name: "Riz & céréales", parentId: "c-epic" },
    { id: "c-pates", name: "Pâtes & semoules", parentId: "c-epic" },
    { id: "c-far", name: "Farines & sucres", parentId: "c-epic" },
    { id: "c-huiles", name: "Huiles & condiments", parentId: "c-epic" },
    { id: "c-viande", name: "Viandes & volailles", parentId: null },
    { id: "c-volaille", name: "Volaille", parentId: "c-viande" },
    { id: "c-ba", name: "Bœuf & agneau", parentId: "c-viande" },
    { id: "c-leg", name: "Fruits & légumes", parentId: null },
    { id: "c-crem", name: "Crèmerie & œufs", parentId: null },
    { id: "c-bois", name: "Boissons", parentId: null },
    { id: "c-eaux", name: "Eaux minérales", parentId: "c-bois" },
    { id: "c-cafe", name: "Café & thé", parentId: "c-bois" },
    { id: "c-hyg", name: "Hygiène & entretien", parentId: null },
  ];

  const suppliers: Supplier[] = [
    { id: "s-atlas", code: "FOU-001", name: "Atlas Distribution Pro", contact: "Hassan Berrada", phone: "05 22 44 18 90", email: "contact@atlasdistri.ma", address: "Zone industrielle Aïn Sebaâ", city: "Casablanca", ice: "001528746000012", paymentTerms: "30 jours", creditLimit: 250000, openingBalance: 0, status: "actif", notes: "Fournisseur principal épicerie", createdAt: daysAgoISO(400) },
    { id: "s-amal", code: "FOU-002", name: "Boucherie Al Amal", contact: "Mostafa Cherkaoui", phone: "05 35 62 40 11", email: "alamal@viandes.ma", address: "Route de l'aéroport", city: "Fès", ice: "002174893000045", paymentTerms: "15 jours", creditLimit: 120000, openingBalance: 4800, status: "actif", notes: "Viandes fraîches 3×/semaine", createdAt: daysAgoISO(380) },
    { id: "s-souss", code: "FOU-003", name: "Primeurs du Souss", contact: "Fatima Amrani", phone: "05 28 23 71 45", email: "f.amrani@primeurssouss.ma", address: "Marché de gros, bloc C", city: "Agadir", ice: "001893257000078", paymentTerms: "Comptant", creditLimit: 60000, openingBalance: 0, status: "actif", notes: "", createdAt: daysAgoISO(350) },
    { id: "s-alizes", code: "FOU-004", name: "Laiterie des Alizés", contact: "Karim Bouzidi", phone: "05 37 68 22 09", email: "commandes@alizes-lait.ma", address: "Bd Moulay Slimane", city: "Rabat", ice: "001245987000034", paymentTerms: "30 jours", creditLimit: 80000, openingBalance: 1250, status: "actif", notes: "", createdAt: daysAgoISO(320) },
    { id: "s-riad", code: "FOU-005", name: "Cafés Riad Import", contact: "Salma El Fassi", phone: "05 24 43 90 17", email: "s.elfassi@riadimport.ma", address: "27, rue de la Liberté", city: "Marrakech", ice: "002561438000091", paymentTerms: "30 jours", creditLimit: 90000, openingBalance: 0, status: "actif", notes: "Café, thé, eaux", createdAt: daysAgoISO(300) },
    { id: "s-hyg", code: "FOU-006", name: "HygiènePro Maroc", contact: "Nadia Alaoui", phone: "05 22 98 30 54", email: "pro@hygienepro.ma", address: "Lot. Al Karama", city: "Mohammedia", ice: "001672549000023", paymentTerms: "45 jours", creditLimit: 50000, openingBalance: 2400, status: "actif", notes: "", createdAt: daysAgoISO(280) },
  ];

  type PDef = [ID, string, string, ID, ID, ID, number, number, number, ID | null, number];
  const defs: PDef[] = [
    ["p-riz", "PRD-001", "Riz blanc étuvé", "c-riz", "u-kg", "u-sac", 25, 10, 40, "s-atlas", 9.8],
    ["p-pates", "PRD-002", "Pâtes penne rigate", "c-pates", "u-kg", "u-carton", 10, 10, 15, "s-atlas", 11],
    ["p-semoule", "PRD-003", "Semoule fine couscous", "c-pates", "u-kg", "u-sac", 25, 10, 25, "s-atlas", 8.4],
    ["p-farine", "PRD-004", "Farine de blé T55", "c-far", "u-kg", "u-sac", 50, 10, 60, "s-atlas", 6.2],
    ["p-sucre", "PRD-005", "Sucre semoule", "c-far", "u-kg", "u-sac", 10, 10, 20, "s-atlas", 9.5],
    ["p-holive", "PRD-006", "Huile d'olive extra", "c-huiles", "u-l", "u-bidon", 5, 10, 15, "s-atlas", 38],
    ["p-htournesol", "PRD-007", "Huile de tournesol", "c-huiles", "u-l", "u-bidon", 5, 10, 20, "s-atlas", 22],
    ["p-tomates", "PRD-008", "Tomates fraîches", "c-leg", "u-kg", "u-kg", 1, 10, 15, "s-souss", 7.5],
    ["p-pdt", "PRD-009", "Pommes de terre", "c-leg", "u-kg", "u-sac", 25, 10, 25, "s-souss", 5.8],
    ["p-oignons", "PRD-010", "Oignons jaunes", "c-leg", "u-kg", "u-sac", 10, 10, 12, "s-souss", 6.5],
    ["p-poulet", "PRD-011", "Poulet entier PAC", "c-volaille", "u-kg", "u-kg", 1, 10, 20, "s-amal", 31],
    ["p-boeuf", "PRD-012", "Filet de bœuf", "c-ba", "u-kg", "u-kg", 1, 10, 10, "s-amal", 92],
    ["p-agneau", "PRD-013", "Épaule d'agneau", "c-ba", "u-kg", "u-kg", 1, 10, 8, "s-amal", 84],
    ["p-lait", "PRD-014", "Lait entier UHT 1L", "c-crem", "u-un", "u-carton", 12, 10, 36, "s-alizes", 6.8],
    ["p-oeufs", "PRD-015", "Œufs calibre M", "c-crem", "u-un", "u-plateau", 30, 10, 60, "s-alizes", 1.4],
    ["p-fromage", "PRD-016", "Emmental bloc", "c-crem", "u-kg", "u-kg", 1, 10, 5, "s-alizes", 62],
    ["p-creme", "PRD-017", "Crème fraîche 1L", "c-crem", "u-l", "u-l", 1, 10, 6, "s-alizes", 26],
    ["p-cafe", "PRD-018", "Café en grains arabica", "c-cafe", "u-kg", "u-kg", 1, 10, 6, "s-riad", 138],
    ["p-the", "PRD-019", "Thé vert gunpowder", "c-cafe", "u-kg", "u-boite", 1, 10, 3, "s-riad", 56],
    ["p-eau", "PRD-020", "Eau minérale 1,5L", "c-eaux", "u-btl", "u-carton", 6, 10, 60, "s-riad", 4.5],
    ["p-detergent", "PRD-021", "Détergent dégraissant", "c-hyg", "u-l", "u-bidon", 5, 20, 10, "s-hyg", 13],
  ];

  const products: Product[] = defs.map((d) => ({
    id: d[0],
    code: d[1],
    name: d[2],
    categoryId: d[3],
    unitId: d[4],
    purchaseUnitId: d[5],
    conversion: d[6],
    vatRate: d[7],
    minStock: d[8],
    reorderPoint: Math.round(d[8] * 1.8),
    supplierId: d[9],
    purchasePrice: d[10],
    status: "actif",
    createdAt: daysAgoISO(400),
  }));

  const sites: Site[] = [
    { id: S.rst, code: "RST", name: "Restaurant Principal", address: "12, bd d'Anfa", city: "Casablanca", phone: "05 22 20 41 55", manager: "Yassine Alami", status: "actif", createdAt: daysAgoISO(400) },
    { id: S.htl, code: "HTL", name: "Restaurant Hôtel Atlas", address: "3, avenue des FAR", city: "Fès", phone: "05 35 74 10 02", manager: "Salwa Idrissi", status: "actif", createdAt: daysAgoISO(400) },
    { id: S.kit, code: "KIT", name: "Cuisine Centrale", address: "Lot. Riad Salam, n°8", city: "Casablanca", phone: "05 22 36 78 12", manager: "Rachid Bennis", status: "actif", createdAt: daysAgoISO(390) },
    { id: S.wh, code: "WH", name: "Entrepôt Central", address: "Zone logistique, Aïn Sebaâ", city: "Casablanca", phone: "05 22 35 09 44", manager: "Khadija Idrissi", status: "actif", createdAt: daysAgoISO(390) },
  ];

  const users: User[] = [
    { id: "u-owner", name: "Nadia Cherkaoui", username: "proprietaire", passwordHash: hashPw("Owner@123"), role: "proprietaire", siteIds: "all", active: true, createdAt: daysAgoISO(420) },
    { id: U.admin, name: "Amina Benali", username: "admin", passwordHash: hashPw("Admin@123"), role: "admin", siteIds: "all", active: true, createdAt: daysAgoISO(400) },
    { id: U.manager, name: "Yassine Alami", username: "manager", passwordHash: hashPw("manager123"), role: "manager", siteIds: "all", active: true, createdAt: daysAgoISO(390) },
    { id: U.econome, name: "Khadija Idrissi", username: "econome", passwordHash: hashPw("econome123"), role: "econome", siteIds: [S.rst, S.kit], active: true, createdAt: daysAgoISO(380) },
    { id: U.ctrl, name: "Omar Tazi", username: "controleur", passwordHash: hashPw("ctrl123"), role: "controleur", siteIds: "all", active: true, createdAt: daysAgoISO(370) },
  ];

  return { units, categories, suppliers, products, sites, users };
}

export function buildSeed(): DB {
  const rnd = mulberry32(20260214);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const ri = (a: number, b: number) => Math.round(r(a, b));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

  const ref = refData();
  const db: DB = {
    version: 5,
    seededAt: nowISO(),
    company: {
      name: "FoodOps Demo",
      legalName: "FoodOps Hospitality SARL",
      address: "Twin Center, Tour Ouest, 17e étage",
      city: "Casablanca",
      country: "Maroc",
      phone: "05 22 20 40 40",
      email: "direction@foodops.ma",
      ice: "002481935000067",
      iff: "40581936",
      rc: "512983",
      currency: "MAD",
      defaultVat: 10,
      targetFoodCost: 30,
      allowNegativeStock: false,
      sitePrefixNumbering: false,
    },
    ...ref,
    purchaseOrders: [],
    receptions: [],
    invoices: [],
    payments: [],
    transfers: [],
    consumptions: [],
    wastes: [],
    inventories: [],
    sales: [],
    movements: [],
    audit: [],
    sequences: {},
    seqCounter: 0,
  };

  const product = (id: ID) => db.products.find((p) => p.id === id)!;
  const productIds = db.products.map((p) => p.id);
  const day = (n: number) => daysAgoISO(n);
  const tryRun = (fn: () => void) => {
    try {
      fn();
    } catch {
      /* ligne de démo impossible à cette date : on ignore */
    }
  };

  /* ---------- stocks initiaux par site (jamais globaux) ---------- */
  const initLines = (siteId: ID, factor: number, ids: ID[]) =>
    ids.map((pid) => {
      const p = product(pid);
      return {
        productId: pid,
        qty: Math.round(p.minStock * factor * r(1.1, 2.2) * 100) / 100,
        unitCost: Math.round(p.purchasePrice * r(0.94, 1.06) * 100) / 100,
      };
    });

  createInitialStock(db, { siteId: S.rst, date: day(34), userId: U.admin, lines: initLines(S.rst, 1, productIds.filter((id) => id !== "p-detergent")) });
  createInitialStock(db, { siteId: S.htl, date: day(34), userId: U.admin, lines: initLines(S.htl, 0.8, productIds.filter((id) => !["p-semoule", "p-detergent"].includes(id))) });
  createInitialStock(db, { siteId: S.kit, date: day(33), userId: U.admin, lines: initLines(S.kit, 0.7, ["p-riz", "p-pates", "p-farine", "p-sucre", "p-htournesol", "p-tomates", "p-pdt", "p-oignons", "p-poulet", "p-lait", "p-oeufs", "p-eau"]) });
  createInitialStock(db, { siteId: S.wh, date: day(33), userId: U.admin, lines: initLines(S.wh, 3.2, productIds) });

  /* ---------- lignes de consommation réalistes (≈ 30 % du CA) ---------- */
  const consumptionLines = (siteId: ID, targetValue: number) => {
    const stocks = computeStocks(db, { siteId });
    const pool = db.products.filter((p) => entryOf(stocks, siteId, p.id).qty > p.minStock * 0.3 && p.id !== "p-detergent");
    if (pool.length < 4) return [];
    const n = ri(5, 8);
    const chosen = [...pool].sort(() => rnd() - 0.5).slice(0, n);
    let lines = chosen.map((p) => {
      const avail = entryOf(stocks, siteId, p.id).qty;
      const qty = Math.min(Math.round(p.minStock * r(0.25, 0.7) * 100) / 100, Math.round(avail * 0.45 * 100) / 100);
      return { productId: p.id, qty: Math.max(qty, 0.5) };
    });
    const value = lines.reduce((s, l) => s + l.qty * entryOf(stocks, siteId, l.productId).avgCost, 0);
    if (value <= 0) return [];
    const scale = targetValue / value;
    lines = lines.map((l) => {
      const avail = entryOf(stocks, siteId, l.productId).qty;
      return {
        productId: l.productId,
        qty: Math.max(0.25, Math.round(Math.min(l.qty * scale, avail * 0.5) * 100) / 100),
      };
    });
    return lines;
  };

  /* ---------- réceptions planifiées ---------- */
  type RecPlan = { d: number; site: ID; sup: ID; items: [ID, number][]; po?: boolean };
  const plans: RecPlan[] = [
    { d: 31, site: S.rst, sup: "s-atlas", items: [["p-riz", 150], ["p-farine", 100], ["p-holive", 30]], po: true },
    { d: 29, site: S.rst, sup: "s-amal", items: [["p-poulet", 60], ["p-boeuf", 25]] },
    { d: 28, site: S.htl, sup: "s-souss", items: [["p-tomates", 40], ["p-pdt", 75], ["p-oignons", 30]] },
    { d: 26, site: S.wh, sup: "s-atlas", items: [["p-riz", 500], ["p-pates", 200], ["p-sucre", 120], ["p-htournesol", 100]] },
    { d: 24, site: S.htl, sup: "s-riad", items: [["p-cafe", 12], ["p-the", 6], ["p-eau", 240]], po: true },
    { d: 22, site: S.kit, sup: "s-alizes", items: [["p-lait", 96], ["p-oeufs", 240], ["p-creme", 24]] },
    { d: 20, site: S.rst, sup: "s-souss", items: [["p-tomates", 35], ["p-pdt", 60]] },
    { d: 17, site: S.wh, sup: "s-hyg", items: [["p-detergent", 40]] },
    { d: 15, site: S.rst, sup: "s-alizes", items: [["p-fromage", 15], ["p-lait", 72], ["p-oeufs", 180]] },
    { d: 13, site: S.htl, sup: "s-amal", items: [["p-poulet", 45], ["p-agneau", 20]], po: true },
    { d: 10, site: S.kit, sup: "s-atlas", items: [["p-farine", 75], ["p-semoule", 50]] },
    { d: 8, site: S.rst, sup: "s-riad", items: [["p-cafe", 8], ["p-eau", 180]] },
    { d: 6, site: S.htl, sup: "s-atlas", items: [["p-riz", 100], ["p-holive", 20]] },
    { d: 4, site: S.wh, sup: "s-amal", items: [["p-poulet", 120], ["p-boeuf", 60]] },
    { d: 2, site: S.rst, sup: "s-souss", items: [["p-tomates", 30], ["p-oignons", 25], ["p-pdt", 50]] },
  ];

  for (const plan of [...plans].sort((a, b) => b.d - a.d)) {
    tryRun(() => {
      let poId: ID | null = null;
      if (plan.po) {
        const po = {
          id: uid(), number: "", supplierId: plan.sup, siteId: plan.site,
          date: day(plan.d + 2), expectedDate: day(plan.d), status: "brouillon" as const,
          notes: "", userId: U.manager, createdAt: nowISO(),
          lines: plan.items.map(([pid, qty]) => ({
            productId: pid, qty, unitCost: Math.round(product(pid).purchasePrice * r(0.97, 1.05) * 100) / 100,
            vatRate: product(pid).vatRate, receivedQty: 0,
          })),
        };
        savePO(db, po);
        setPOStatus(db, po.id, "soumis", U.manager);
        setPOStatus(db, po.id, "approuve", U.admin);
        poId = po.id;
      }
      const recUser = plan.site === S.rst || plan.site === S.kit ? U.econome : U.manager;
      const rec = {
        id: uid(), number: "", supplierId: plan.sup, siteId: plan.site,
        date: day(plan.d), poId, invoiceRef: "", status: "brouillon" as const,
        notes: "", userId: recUser, createdAt: nowISO(),
        lines: plan.items.map(([pid, qty]) => ({
          productId: pid, orderedQty: qty, receivedQty: Math.round(qty * r(0.92, 1) * 100) / 100,
          unitCost: Math.round(product(pid).purchasePrice * r(0.96, 1.06) * 100) / 100,
          vatRate: product(pid).vatRate, lot: rnd() > 0.6 ? "LOT" + ri(1000, 9999) : "", expiry: "",
        })),
      };
      if (poId) {
        const fromPO = receptionFromPO(db, poId, U.manager);
        fromPO.lines = fromPO.lines.map((l) => {
          const planned = rec.lines.find((x) => x.productId === l.productId);
          return planned ? { ...l, receivedQty: planned.receivedQty, unitCost: planned.unitCost } : l;
        });
        validateReception(db, fromPO.id, U.manager);
        } else {
          saveReception(db, rec);
          validateReception(db, rec.id, recUser);
        }      // facture fournisseur liée (≈ 65 % des réceptions) + règlements
      if (rnd() < 0.65) {
        const total = plan.items.reduce((s, [pid, qty]) => s + qty * product(pid).purchasePrice, 0);
        const late = rnd() < 0.3;
        const inv = {
          id: uid(), number: "", supplierId: plan.sup, siteId: plan.site,
          date: day(plan.d), dueDate: late ? day(Math.max(1, plan.d - ri(5, 15))) : day(plan.d - ri(18, 34)),
          userId: U.manager, createdAt: nowISO(),
          lines: [{ description: `Livraison ${plan.items.map(([pid]) => product(pid).name).join(", ")}`, amount: Math.round(total * r(0.95, 1.08) * 100) / 100, vatRate: 10 }],
        };
        saveInvoice(db, inv);
        if (!late && rnd() < 0.75) {
          const t = inv.lines[0].amount * 1.1;
          const partial = rnd() < 0.35;
          savePayment(db, {
            id: uid(), number: "", supplierId: plan.sup, invoiceId: inv.id,
            date: day(Math.max(plan.d - ri(4, 12), 1)), amount: Math.round((partial ? t * r(0.4, 0.7) : t) * 100) / 100,
            method: rnd() < 0.6 ? "virement" : "cheque", notes: "", userId: U.admin, createdAt: nowISO(),
          });
        }
      }
    });
  }

  /* ---------- boucle quotidienne : ventes + consommations ---------- */
  for (let d = 33; d >= 1; d--) {
    const dow = new Date(day(d) + "T12:00:00").getDay();
    // ventes RST
    const caRstL = ri(9500, 16500), caRstD = ri(7500, 14500);
    saveSale(db, { id: uid(), siteId: S.rst, date: day(d), service: "dejeuner", revenue: caRstL, covers: ri(60, 115), userId: U.manager, createdAt: nowISO() });
    saveSale(db, { id: uid(), siteId: S.rst, date: day(d), service: "diner", revenue: caRstD, covers: ri(45, 95), userId: U.manager, createdAt: nowISO() });
    // ventes HTL
    const caHtlP = ri(3600, 6200), caHtlL = ri(6500, 11000), caHtlD = ri(8000, 14000);
    saveSale(db, { id: uid(), siteId: S.htl, date: day(d), service: "petit_dejeuner", revenue: caHtlP, covers: ri(40, 75), userId: U.manager, createdAt: nowISO() });
    saveSale(db, { id: uid(), siteId: S.htl, date: day(d), service: "dejeuner", revenue: caHtlL, covers: ri(35, 70), userId: U.manager, createdAt: nowISO() });
    saveSale(db, { id: uid(), siteId: S.htl, date: day(d), service: "diner", revenue: caHtlD, covers: ri(40, 85), userId: U.manager, createdAt: nowISO() });
    // ventes KIT (cafétéria, semaine uniquement)
    let caKit = 0;
    if (dow >= 1 && dow <= 5) {
      caKit = ri(2400, 4600);
      saveSale(db, { id: uid(), siteId: S.kit, date: day(d), service: "cafeteria", revenue: caKit, covers: ri(30, 65), userId: U.manager, createdAt: nowISO() });
    }
    // consommations (target ≈ 30 % du CA du jour)
    tryRun(() => {
      const l1 = consumptionLines(S.rst, (caRstL + caRstD) * r(0.27, 0.33) * 0.55);
      if (l1.length) {
        const c = { id: uid(), number: "", siteId: S.rst, date: day(d), service: "dejeuner" as const, status: "brouillon" as const, notes: "", lines: l1, userId: U.econome, createdAt: nowISO() };
        saveConsumption(db, c);
        validateConsumption(db, c.id, U.econome);
      }
    });
    tryRun(() => {
      const l2 = consumptionLines(S.htl, (caHtlP + caHtlL + caHtlD) * r(0.26, 0.32) * 0.5);
      if (l2.length) {
        const c = { id: uid(), number: "", siteId: S.htl, date: day(d), service: "diner" as const, status: "brouillon" as const, notes: "", lines: l2, userId: U.manager, createdAt: nowISO() };
        saveConsumption(db, c);
        validateConsumption(db, c.id, U.manager);
      }
    });
    if (d % 2 === 0 && caKit > 0) {
      tryRun(() => {
        const l3 = consumptionLines(S.kit, caKit * r(0.3, 0.36));
        if (l3.length) {
          const c = { id: uid(), number: "", siteId: S.kit, date: day(d), service: "cafeteria" as const, status: "brouillon" as const, notes: "", lines: l3, userId: U.econome, createdAt: nowISO() };
          saveConsumption(db, c);
          validateConsumption(db, c.id, U.econome);
        }
      });
    }
    // pertes ponctuelles
    if ([29, 23, 18, 12, 7, 3].includes(d)) {
      tryRun(() => {
        const siteId = pick([S.rst, S.htl, S.kit]);
        const stocks = computeStocks(db, { siteId });
        const pool = db.products.filter((p) => ["p-tomates", "p-poulet", "p-lait", "p-creme", "p-fromage", "p-tomates", "p-pdt"].includes(p.id) && entryOf(stocks, siteId, p.id).qty > 5);
        const lines = [...pool].sort(() => rnd() - 0.5).slice(0, ri(1, 3)).map((p) => ({
          productId: p.id,
          qty: Math.round(Math.min(entryOf(stocks, siteId, p.id).qty * 0.1, r(1, 6)) * 100) / 100,
        }));
        if (lines.length) {
          const wUser = siteId === S.htl ? U.manager : U.econome;
          const w = { id: uid(), number: "", siteId, date: day(d), reason: pick(["Expiré", "Avarié", "Perte de préparation", "Surproduction"]), status: "brouillon" as const, notes: "", lines, userId: wUser, createdAt: nowISO() };
          saveWaste(db, w);
          validateWaste(db, w.id, wUser);
        }
      });
    }
  }

  /* ---------- transferts entrepôt → sites ---------- */
  const transferPlans: { d: number; to: ID; items: [ID, number][]; state: "recu" | "approuve" | "brouillon" }[] = [
    { d: 25, to: S.rst, items: [["p-riz", 80], ["p-holive", 15]], state: "recu" },
    { d: 21, to: S.kit, items: [["p-farine", 60], ["p-pates", 40]], state: "recu" },
    { d: 14, to: S.htl, items: [["p-eau", 120], ["p-cafe", 6]], state: "recu" },
    { d: 9, to: S.rst, items: [["p-sucre", 30], ["p-lait", 48]], state: "recu" },
    { d: 1, to: S.kit, items: [["p-eau", 90], ["p-riz", 50]], state: "approuve" },
  ];
  for (const t of transferPlans) {
    tryRun(() => {
      const stocks = computeStocks(db, { siteId: S.wh });
      const tr = {
        id: uid(), number: "", fromSiteId: S.wh, toSiteId: t.to, date: day(t.d),
        status: "brouillon" as const, notes: "Réapprovisionnement hebdomadaire", userId: U.manager, createdAt: nowISO(),
        lines: t.items.map(([pid, qty]) => ({
          productId: pid,
          qty: Math.min(qty, Math.floor(entryOf(stocks, S.wh, pid).qty * 0.4)),
          unitCost: Math.round(entryOf(stocks, S.wh, pid).avgCost * 100) / 100,
        })).filter((l) => l.qty > 0),
      };
      if (!tr.lines.length) return;
      saveTransfer(db, tr);
      approveTransfer(db, tr.id, U.manager);
      if (t.state !== "brouillon") {
        dispatchTransfer(db, tr.id, U.manager);
        if (t.state === "recu") receiveTransfer(db, tr.id, U.manager);
      }
    });
  }

  /* ---------- inventaires ---------- */
  tryRun(() => {
    const inv = createInventory(db, { siteId: S.htl, date: day(6), userId: U.manager });
    for (const l of inv.lines) {
      const counted = l.theoreticalQty === 0 ? 0 : Math.max(0, Math.round(l.theoreticalQty * r(0.965, 1.02) * 100) / 100);
      setInventoryActual(db, inv.id, l.productId, counted, U.manager);
    }
    validateInventory(db, inv.id, U.manager);
  });
  tryRun(() => {
    createInventory(db, { siteId: S.rst, date: day(0), userId: U.manager, notes: "Inventaire de fin de mois — comptage à saisir" });
  });

  /* ---------- documents ouverts pour la démo ---------- */
  tryRun(() => {
    const po = {
      id: uid(), number: "", supplierId: "s-atlas", siteId: S.rst, date: todayISO(),
      expectedDate: addDaysISO(todayISO(), 3), status: "brouillon" as const,
      notes: "Réassort hebdomadaire épicerie", userId: U.manager, createdAt: nowISO(),
      lines: [
        { productId: "p-riz", qty: 100, unitCost: 9.9, vatRate: 10, receivedQty: 0 },
        { productId: "p-holive", qty: 25, unitCost: 38.5, vatRate: 10, receivedQty: 0 },
        { productId: "p-pates", qty: 60, unitCost: 11.2, vatRate: 10, receivedQty: 0 },
      ],
    };
    savePO(db, po);
    setPOStatus(db, po.id, "soumis", U.manager);
    setPOStatus(db, po.id, "approuve", U.admin);
  });
  tryRun(() => {
    const rec = {
      id: uid(), number: "", supplierId: "s-amal", siteId: S.htl, date: todayISO(),
      poId: null, invoiceRef: "", status: "brouillon" as const, notes: "Livraison viandes du jour",
      userId: U.manager, createdAt: nowISO(),
      lines: [
        { productId: "p-poulet", orderedQty: 40, receivedQty: 40, unitCost: 31.5, vatRate: 10, lot: "LOT4821", expiry: addDaysISO(todayISO(), 6) },
        { productId: "p-boeuf", orderedQty: 18, receivedQty: 18, unitCost: 93, vatRate: 10, lot: "LOT4822", expiry: addDaysISO(todayISO(), 5) },
      ],
    };
    saveReception(db, rec);
  });
  tryRun(() => {
    const stocks = computeStocks(db, { siteId: S.rst });
    const c = {
      id: uid(), number: "", siteId: S.rst, date: todayISO(), service: "dejeuner" as const,
      status: "brouillon" as const, notes: "Service du midi — à valider", userId: U.econome, createdAt: nowISO(),
      lines: consumptionLines(S.rst, 4200).slice(0, 5),
    };
    if (c.lines.length && stocks.size) saveConsumption(db, c);
  });
  tryRun(() => {
    const tr = {
      id: uid(), number: "", fromSiteId: S.wh, toSiteId: S.htl, date: todayISO(),
      status: "brouillon" as const, notes: "Complément boissons fin de semaine", userId: U.manager, createdAt: nowISO(),
      lines: [{ productId: "p-eau", qty: 60, unitCost: 4.5 }],
    };
    saveTransfer(db, tr);
  });

  db.audit.unshift(
    { id: uid(), userId: U.admin, userName: "Amina Benali", action: "LOGIN", module: "Sécurité", detail: "Connexion à l'application", siteId: null, date: nowISO() },
    { id: uid(), userId: U.manager, userName: "Yassine Alami", action: "LOGIN", module: "Sécurité", detail: "Connexion à l'application", siteId: null, date: nowISO() }
  );

  return db;
}
