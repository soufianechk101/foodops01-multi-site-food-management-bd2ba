/* ============================================================
   FoodOps — Modèle de données
   Règle fondamentale : le stock est toujours identifié par
   COMPANY + SITE + PRODUIT. Jamais global par produit.
   ============================================================ */

export type ID = string;

export type Role = "proprietaire" | "admin" | "manager" | "econome" | "controleur";

export type Service =
  | "petit_dejeuner"
  | "dejeuner"
  | "diner"
  | "snack"
  | "cafeteria"
  | "bar";

export type MovementType =
  | "INITIAL_STOCK"
  | "RECEPTION"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "CONSUMPTION"
  | "WASTE"
  | "INVENTORY_ADJUSTMENT_IN"
  | "INVENTORY_ADJUSTMENT_OUT"
  | "RETURN_IN"
  | "RETURN_OUT"
  | "MANUAL_ADJUSTMENT";

export interface Company {
  name: string;
  legalName: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  ice: string;
  iff: string;
  rc: string;
  currency: string;
  defaultVat: number;
  targetFoodCost: number;
  allowNegativeStock: boolean;
  sitePrefixNumbering: boolean;
}

export interface Site {
  id: ID;
  code: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  manager: string;
  status: "actif" | "inactif";
  createdAt: string;
}

export interface User {
  id: ID;
  name: string;
  username: string;
  passwordHash: string;
  role: Role;
  /** "all" = accès à tous les sites, sinon liste d'IDs autorisés */
  siteIds: ID[] | "all";
  active: boolean;
  createdAt: string;
}

export interface Category {
  id: ID;
  name: string;
  parentId: ID | null;
}

export interface Unit {
  id: ID;
  code: string;
  name: string;
}

export interface Product {
  id: ID;
  code: string;
  name: string;
  categoryId: ID;
  unitId: ID;
  purchaseUnitId: ID;
  /** facteur de conversion unité d'achat -> unité de base */
  conversion: number;
  vatRate: number;
  minStock: number;
  reorderPoint: number;
  supplierId: ID | null;
  purchasePrice: number;
  status: "actif" | "inactif";
  createdAt: string;
}

export interface Supplier {
  id: ID;
  code: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  ice: string;
  paymentTerms: string;
  creditLimit: number;
  openingBalance: number;
  status: "actif" | "inactif";
  notes: string;
  createdAt: string;
}

/* ---------------- Documents ---------------- */

export interface POLine {
  productId: ID;
  qty: number;
  unitCost: number;
  vatRate: number;
  receivedQty: number;
}

export type POStatus =
  | "brouillon"
  | "soumis"
  | "approuve"
  | "partiel"
  | "recu"
  | "annule";

export interface PurchaseOrder {
  id: ID;
  number: string;
  supplierId: ID;
  siteId: ID;
  date: string;
  expectedDate: string;
  status: POStatus;
  notes: string;
  lines: POLine[];
  userId: ID;
  createdAt: string;
}

export interface ReceptionLine {
  productId: ID;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  vatRate: number;
  lot: string;
  expiry: string;
}

export type ReceptionStatus = "brouillon" | "valide" | "annule";

export interface Reception {
  id: ID;
  number: string;
  supplierId: ID;
  siteId: ID;
  date: string;
  poId: ID | null;
  invoiceRef: string;
  status: ReceptionStatus;
  notes: string;
  lines: ReceptionLine[];
  userId: ID;
  createdAt: string;
}

export interface InvoiceLine {
  description: string;
  amount: number;
  vatRate: number;
}

export interface Invoice {
  id: ID;
  number: string;
  supplierId: ID;
  siteId: ID;
  date: string;
  dueDate: string;
  lines: InvoiceLine[];
  createdAt: string;
  userId: ID;
}

export type PayMethod = "especes" | "virement" | "cheque" | "carte" | "autre";

export interface Payment {
  id: ID;
  number: string;
  supplierId: ID;
  invoiceId: ID | null;
  date: string;
  amount: number;
  method: PayMethod;
  notes: string;
  userId: ID;
  createdAt: string;
}

export interface TransferLine {
  productId: ID;
  qty: number;
  unitCost: number;
}

export type TransferStatus =
  | "brouillon"
  | "approuve"
  | "expedie"
  | "recu"
  | "annule";

export interface Transfer {
  id: ID;
  number: string;
  fromSiteId: ID;
  toSiteId: ID;
  date: string;
  status: TransferStatus;
  notes: string;
  lines: TransferLine[];
  userId: ID;
  createdAt: string;
}

export interface ConsumptionLine {
  productId: ID;
  qty: number;
}

export type ConsumptionStatus = "brouillon" | "valide" | "annule";

export interface Consumption {
  id: ID;
  number: string;
  siteId: ID;
  date: string;
  service: Service;
  status: ConsumptionStatus;
  notes: string;
  lines: ConsumptionLine[];
  userId: ID;
  createdAt: string;
}

export interface WasteLine {
  productId: ID;
  qty: number;
}

export type WasteStatus = "brouillon" | "valide" | "annule";

export interface Waste {
  id: ID;
  number: string;
  siteId: ID;
  date: string;
  reason: string;
  status: WasteStatus;
  notes: string;
  lines: WasteLine[];
  userId: ID;
  createdAt: string;
}

export interface InventoryLine {
  productId: ID;
  theoreticalQty: number;
  actualQty: number | null;
  unitCost: number;
}

export type InventoryStatus = "en_cours" | "valide" | "annule";

export interface InventoryDoc {
  id: ID;
  number: string;
  siteId: ID;
  date: string;
  status: InventoryStatus;
  notes: string;
  lines: InventoryLine[];
  userId: ID;
  createdAt: string;
}

export interface Sale {
  id: ID;
  siteId: ID;
  date: string;
  service: Service;
  revenue: number;
  covers: number;
  userId: ID;
  createdAt: string;
}

/* ---------------- Moteur de stock ---------------- */

export interface StockMovement {
  id: ID;
  seq: number;
  companyId: string;
  siteId: ID;
  productId: ID;
  type: MovementType;
  /** signée : positive = entrée, négative = sortie */
  qty: number;
  unitCost: number;
  totalCost: number;
  refType: string;
  refId: ID;
  refNumber: string;
  date: string;
  userId: ID;
  notes: string;
  createdAt: string;
}

export interface StockEntry {
  qty: number;
  avgCost: number;
  value: number;
}

export interface AuditEntry {
  id: ID;
  userId: ID;
  userName: string;
  action: string;
  module: string;
  detail: string;
  siteId: ID | null;
  date: string;
}

export interface DB {
  version: number;
  seededAt: string;
  company: Company;
  sites: Site[];
  users: User[];
  categories: Category[];
  units: Unit[];
  products: Product[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  receptions: Reception[];
  invoices: Invoice[];
  payments: Payment[];
  transfers: Transfer[];
  consumptions: Consumption[];
  wastes: Waste[];
  inventories: InventoryDoc[];
  sales: Sale[];
  movements: StockMovement[];
  audit: AuditEntry[];
  sequences: Record<string, number>;
  seqCounter: number;
}
