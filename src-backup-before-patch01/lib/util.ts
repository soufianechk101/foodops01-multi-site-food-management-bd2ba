import type { MovementType, PayMethod, Role, Service } from "../types";

/* ---------- identifiants & dates ---------- */

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export const nowISO = (): string => new Date().toISOString();

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export const daysAgoISO = (n: number): string => addDaysISO(todayISO(), -n);

export const addDaysISO = (iso: string, n: number): string => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

export const monthKey = (iso: string): string => iso.slice(0, 7);

export const monthLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
};

export const fmtDate = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso.length <= 10 ? iso + "T12:00:00" : iso).toLocaleDateString("fr-FR");
};

export const fmtDateTime = (iso: string): string =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const relTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return fmtDate(iso);
};

/* ---------- formatage ---------- */

export const fmtMoney = (n: number, cur = "MAD"): string =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(n * 100) / 100) +
  " " +
  cur;

export const fmtNum = (n: number, dec = 2): string =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: dec }).format(
    Math.round(n * 100) / 100
  );

export const fmtPct = (n: number, dec = 1): string =>
  new Intl.NumberFormat("fr-FR", { maximumFractionDigits: dec }).format(n) + " %";

/* ---------- sécurité (démo) ---------- */

export const hashPw = (pw: string): string => {
  let h = 5381;
  const salted = "foodops::" + pw;
  for (let i = 0; i < salted.length; i++) h = ((h << 5) + h) ^ salted.charCodeAt(i);
  return "h" + (h >>> 0).toString(36) + salted.length.toString(36);
};

/* ---------- constantes métier ---------- */

export const SERVICES: { value: Service; label: string }[] = [
  { value: "petit_dejeuner", label: "Petit-déjeuner" },
  { value: "dejeuner", label: "Déjeuner" },
  { value: "diner", label: "Dîner" },
  { value: "snack", label: "Snack" },
  { value: "cafeteria", label: "Cafétéria" },
  { value: "bar", label: "Bar / Boissons" },
];

export const serviceLabel = (s: Service): string =>
  SERVICES.find((x) => x.value === s)?.label ?? s;

export const WASTE_REASONS = [
  "Expiré",
  "Endommagé",
  "Avarié",
  "Surproduction",
  "Perte de préparation",
  "Erreur cuisine",
  "Casse",
  "Autre",
];

export const PAY_METHODS: { value: PayMethod; label: string }[] = [
  { value: "especes", label: "Espèces" },
  { value: "virement", label: "Virement bancaire" },
  { value: "cheque", label: "Chèque" },
  { value: "carte", label: "Carte" },
  { value: "autre", label: "Autre" },
];

export const payMethodLabel = (m: PayMethod): string =>
  PAY_METHODS.find((x) => x.value === m)?.label ?? m;

export const MV_LABELS: Record<MovementType, string> = {
  INITIAL_STOCK: "Stock initial",
  RECEPTION: "Réception",
  TRANSFER_IN: "Transfert entrant",
  TRANSFER_OUT: "Transfert sortant",
  CONSUMPTION: "Consommation",
  WASTE: "Perte",
  INVENTORY_ADJUSTMENT_IN: "Ajustement inventaire (+)",
  INVENTORY_ADJUSTMENT_OUT: "Ajustement inventaire (−)",
  RETURN_IN: "Retour fournisseur (+)",
  RETURN_OUT: "Retour fournisseur (−)",
  MANUAL_ADJUSTMENT: "Correction manuelle",
};

export const ROLE_LABELS: Record<Role, string> = {
  proprietaire: "Propriétaire",
  admin: "Administrateur",
  manager: "Gestionnaire",
  econome: "Économe / Magasinier",
  controleur: "Contrôleur",
};

/* ---------- export CSV / fichiers ---------- */

export const toCSV = (
  cols: { key: string; label: string }[],
  rows: Record<string, unknown>[]
): string => {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const head = cols.map((c) => esc(c.label)).join(";");
  const body = rows.map((r) => cols.map((c) => esc(r[c.key])).join(";")).join("\n");
  return "\uFEFF" + head + "\n" + body;
};

export const downloadFile = (name: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const clamp = (n: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, n));
