import { useMemo, useState } from "react";
import { BarChart3, Download, Printer } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHead, cn } from "../components/ui";
import {
  computeStocks,
  entryOf,
  invoicePaid,
  invoiceStatus,
  invoiceTotals,
  stockStatus,
  supplierBalance,
} from "../lib/engine";
import {
  addDaysISO,
  downloadFile,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtNum,
  fmtPct,
  monthKey,
  monthLabel,
  MV_LABELS,
  serviceLabel,
  toCSV,
  todayISO,
} from "../lib/util";
import { LogoMark } from "../components/Layout";
import type { DB } from "../types";

interface Ctx {
  siteId: string | null;
  siteIds: string[];
  from: string;
  to: string;
}

interface ReportDef {
  id: string;
  group: string;
  title: string;
  desc: string;
  build: (db: DB, ctx: Ctx) => { cols: { key: string; label: string }[]; rows: Record<string, string | number>[] };
}

const REPORTS: ReportDef[] = [
  /* ---------- STOCK ---------- */
  {
    id: "stock-actuel",
    group: "Stock",
    title: "État du stock actuel",
    desc: "Quantités, coûts moyens pondérés et valeurs par site et par produit — calculés depuis les mouvements validés.",
    build: (db, { siteIds }) => {
      const stocks = computeStocks(db);
      const rows: Record<string, string | number>[] = [];
      for (const sid of siteIds) {
        const site = db.sites.find((s) => s.id === sid);
        for (const p of db.products) {
          if (!db.movements.some((m) => m.siteId === sid && m.productId === p.id)) continue;
          const e = entryOf(stocks, sid, p.id);
          rows.push({
            site: site?.name ?? sid, produit: p.name, code: p.code,
            qte: e.qty, unite: db.units.find((u) => u.id === p.unitId)?.code ?? "",
            cout: e.avgCost.toFixed(2), valeur: e.value.toFixed(2), min: p.minStock,
            statut: stockStatus(e.qty, p),
          });
        }
      }
      return {
        cols: [
          { key: "site", label: "Site" }, { key: "produit", label: "Produit" }, { key: "code", label: "Code" },
          { key: "qte", label: "Quantité" }, { key: "unite", label: "Unité" }, { key: "cout", label: "Coût moyen" },
          { key: "valeur", label: "Valeur" }, { key: "min", label: "Min" }, { key: "statut", label: "Statut" },
        ],
        rows,
      };
    },
  },
  {
    id: "valorisation",
    group: "Stock",
    title: "Valorisation du stock par famille",
    desc: "Valeur du stock regroupée par famille de catégories.",
    build: (db, { siteIds }) => {
      const stocks = computeStocks(db);
      const rootOf = (catId: string): string => {
        let c = db.categories.find((x) => x.id === catId);
        while (c?.parentId) c = db.categories.find((x) => x.id === c!.parentId);
        return c?.name ?? "Autres";
      };
      const map = new Map<string, { valeur: number; refs: Set<string> }>();
      for (const sid of siteIds)
        for (const p of db.products) {
          const e = entryOf(stocks, sid, p.id);
          if (e.value <= 0) continue;
          const k = rootOf(p.categoryId);
          const cur = map.get(k) ?? { valeur: 0, refs: new Set<string>() };
          cur.valeur += e.value;
          cur.refs.add(p.id);
          map.set(k, cur);
        }
      return {
        cols: [{ key: "famille", label: "Famille" }, { key: "refs", label: "Références" }, { key: "valeur", label: "Valeur" }, { key: "part", label: "Part" }],
        rows: [...map.entries()]
          .sort((a, b) => b[1].valeur - a[1].valeur)
          .map(([famille, v]) => {
            const total = [...map.values()].reduce((s, x) => s + x.valeur, 0);
            return { famille, refs: v.refs.size, valeur: v.valeur.toFixed(2), part: fmtPct((v.valeur / (total || 1)) * 100) };
          }),
      };
    },
  },
  {
    id: "stock-faible",
    group: "Stock",
    title: "Stocks faibles & ruptures",
    desc: "Produits sous leur seuil de réapprovisionnement ou en rupture, par site.",
    build: (db, { siteIds }) => {
      const stocks = computeStocks(db);
      const rows: Record<string, string | number>[] = [];
      for (const sid of siteIds) {
        const site = db.sites.find((s) => s.id === sid);
        for (const p of db.products.filter((x) => x.status === "actif")) {
          if (!db.movements.some((m) => m.siteId === sid && m.productId === p.id)) continue;
          const e = entryOf(stocks, sid, p.id);
          const st = stockStatus(e.qty, p);
          if (st !== "ok")
            rows.push({ site: site?.name ?? "", produit: p.name, qte: e.qty, min: p.minStock, reappro: p.reorderPoint, statut: st });
        }
      }
      return { cols: [{ key: "site", label: "Site" }, { key: "produit", label: "Produit" }, { key: "qte", label: "Quantité" }, { key: "min", label: "Min" }, { key: "reappro", label: "Seuil réappro" }, { key: "statut", label: "Statut" }], rows };
    },
  },
  {
    id: "mouvements",
    group: "Stock",
    title: "Journal des mouvements",
    desc: "Toutes les entrées/sorties de la période, valorisées au coût de chaque mouvement.",
    build: (db, { siteIds, from, to }) => ({
      cols: [
        { key: "date", label: "Date" }, { key: "doc", label: "Document" }, { key: "type", label: "Type" },
        { key: "produit", label: "Produit" }, { key: "site", label: "Site" }, { key: "entree", label: "Entrée" },
        { key: "sortie", label: "Sortie" }, { key: "valeur", label: "Valeur" }, { key: "user", label: "Utilisateur" },
      ],
      rows: db.movements
        .filter((m) => siteIds.includes(m.siteId) && m.date >= from && m.date <= to)
        .map((m) => ({
          date: m.date, doc: m.refNumber, type: MV_LABELS[m.type],
          produit: db.products.find((p) => p.id === m.productId)?.name ?? "",
          site: db.sites.find((s) => s.id === m.siteId)?.code ?? "",
          entree: m.qty > 0 ? m.qty : "", sortie: m.qty < 0 ? m.qty : "",
          valeur: m.totalCost.toFixed(2),
          user: db.users.find((u) => u.id === m.userId)?.name ?? "Système",
        })),
    }),
  },
  {
    id: "stock-par-site",
    group: "Stock",
    title: "Stock par site",
    desc: "Synthèse consolidée : valeur et références par site — preuve que le stock n'est jamais global.",
    build: (db, { siteIds }) => {
      const stocks = computeStocks(db);
      const rows = siteIds.map((sid) => {
        const site = db.sites.find((s) => s.id === sid);
        let valeur = 0;
        let refs = 0;
        let rupture = 0;
        for (const p of db.products) {
          if (!db.movements.some((m) => m.siteId === sid && m.productId === p.id)) continue;
          const e = entryOf(stocks, sid, p.id);
          valeur += Math.max(e.value, 0);
          if (e.qty > 0) refs++;
          if (e.qty <= 0) rupture++;
        }
        return { site: site?.name ?? sid, code: site?.code ?? "", refs, rupture, valeur: valeur.toFixed(2) };
      });
      return { cols: [{ key: "site", label: "Site" }, { key: "code", label: "Code" }, { key: "refs", label: "Références en stock" }, { key: "rupture", label: "Ruptures" }, { key: "valeur", label: "Valeur" }], rows };
    },
  },
  /* ---------- ACHATS ---------- */
  {
    id: "receptions",
    group: "Achats",
    title: "Réceptions de marchandises",
    desc: "Réceptions de la période avec totaux et statuts.",
    build: (db, { siteIds, from, to }) => ({
      cols: [{ key: "num", label: "N°" }, { key: "date", label: "Date" }, { key: "fournisseur", label: "Fournisseur" }, { key: "site", label: "Site" }, { key: "total", label: "Total HT" }, { key: "statut", label: "Statut" }],
      rows: db.receptions
        .filter((r) => siteIds.includes(r.siteId) && r.date >= from && r.date <= to)
        .map((r) => ({
          num: r.number, date: r.date,
          fournisseur: db.suppliers.find((s) => s.id === r.supplierId)?.name ?? "",
          site: db.sites.find((s) => s.id === r.siteId)?.name ?? "",
          total: r.lines.reduce((s, l) => s + l.receivedQty * l.unitCost, 0).toFixed(2),
          statut: r.status,
        })),
    }),
  },
  {
    id: "achats-fournisseur",
    group: "Achats",
    title: "Achats par fournisseur",
    desc: "Volumes d'achat (réceptions validées) regroupés par fournisseur.",
    build: (db, { siteIds, from, to }) => {
      const map = new Map<string, { nb: number; total: number }>();
      for (const r of db.receptions.filter((r) => r.status === "valide" && siteIds.includes(r.siteId) && r.date >= from && r.date <= to)) {
        const cur = map.get(r.supplierId) ?? { nb: 0, total: 0 };
        cur.nb++;
        cur.total += r.lines.reduce((s, l) => s + l.receivedQty * l.unitCost, 0);
        map.set(r.supplierId, cur);
      }
      return {
        cols: [{ key: "fournisseur", label: "Fournisseur" }, { key: "nb", label: "Réceptions" }, { key: "total", label: "Total HT" }, { key: "part", label: "Part" }],
        rows: [...map.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([sid, v]) => {
            const total = [...map.values()].reduce((s, x) => s + x.total, 0);
            return { fournisseur: db.suppliers.find((s) => s.id === sid)?.name ?? "", nb: v.nb, total: v.total.toFixed(2), part: fmtPct((v.total / (total || 1)) * 100) };
          }),
      };
    },
  },
  {
    id: "achats-produit",
    group: "Achats",
    title: "Achats par produit",
    desc: "Quantités et montants reçus par produit sur la période.",
    build: (db, { siteIds, from, to }) => {
      const map = new Map<string, { qte: number; total: number }>();
      for (const r of db.receptions.filter((r) => r.status === "valide" && siteIds.includes(r.siteId) && r.date >= from && r.date <= to))
        for (const l of r.lines) {
          const cur = map.get(l.productId) ?? { qte: 0, total: 0 };
          cur.qte += l.receivedQty;
          cur.total += l.receivedQty * l.unitCost;
          map.set(l.productId, cur);
        }
      return {
        cols: [{ key: "produit", label: "Produit" }, { key: "qte", label: "Qté reçue" }, { key: "total", label: "Total HT" }],
        rows: [...map.entries()].sort((a, b) => b[1].total - a[1].total).map(([pid, v]) => ({
          produit: db.products.find((p) => p.id === pid)?.name ?? "", qte: v.qte, total: v.total.toFixed(2),
        })),
      };
    },
  },
  /* ---------- CONSOMMATION ---------- */
  {
    id: "journal-conso",
    group: "Consommation",
    title: "Journal des consommations",
    desc: "Consommations validées de la période, valorisées au coût moyen pondéré.",
    build: (db, { siteIds, from, to }) => ({
      cols: [{ key: "num", label: "N°" }, { key: "date", label: "Date" }, { key: "site", label: "Site" }, { key: "service", label: "Service" }, { key: "cout", label: "Coût" }, { key: "statut", label: "Statut" }],
      rows: db.consumptions
        .filter((c) => siteIds.includes(c.siteId) && c.date >= from && c.date <= to)
        .map((c) => ({
          num: c.number, date: c.date,
          site: db.sites.find((s) => s.id === c.siteId)?.name ?? "",
          service: serviceLabel(c.service),
          cout: db.movements.filter((m) => m.refId === c.id && m.type === "CONSUMPTION" && m.qty < 0).reduce((s, m) => s + m.totalCost, 0).toFixed(2),
          statut: c.status,
        })),
    }),
  },
  {
    id: "conso-categorie",
    group: "Consommation",
    title: "Consommation par famille",
    desc: "Valeur consommée regroupée par famille de catégories.",
    build: (db, { siteIds, from, to }) => {
      const rootOf = (catId: string): string => {
        let c = db.categories.find((x) => x.id === catId);
        while (c?.parentId) c = db.categories.find((x) => x.id === c!.parentId);
        return c?.name ?? "Autres";
      };
      const map = new Map<string, number>();
      for (const m of db.movements.filter((m) => m.type === "CONSUMPTION" && m.qty < 0 && siteIds.includes(m.siteId) && m.date >= from && m.date <= to)) {
        const p = db.products.find((x) => x.id === m.productId);
        if (!p) continue;
        const k = rootOf(p.categoryId);
        map.set(k, (map.get(k) ?? 0) + m.totalCost);
      }
      const total = [...map.values()].reduce((s, x) => s + x, 0);
      return {
        cols: [{ key: "famille", label: "Famille" }, { key: "valeur", label: "Valeur consommée" }, { key: "part", label: "Part" }],
        rows: [...map.entries()].sort((a, b) => b[1] - a[1]).map(([famille, v]) => ({ famille, valeur: v.toFixed(2), part: fmtPct((v / (total || 1)) * 100) })),
      };
    },
  },
  {
    id: "conso-service",
    group: "Consommation",
    title: "Consommation par service",
    desc: "Coût matière par service (déjeuner, dîner, bar…).",
    build: (db, { siteIds, from, to }) => {
      const map = new Map<string, number>();
      for (const c of db.consumptions.filter((c) => c.status === "valide" && siteIds.includes(c.siteId) && c.date >= from && c.date <= to)) {
        const cost = db.movements.filter((m) => m.refId === c.id && m.type === "CONSUMPTION" && m.qty < 0).reduce((s, m) => s + m.totalCost, 0);
        map.set(c.service, (map.get(c.service) ?? 0) + cost);
      }
      return {
        cols: [{ key: "service", label: "Service" }, { key: "valeur", label: "Coût matière" }],
        rows: [...map.entries()].sort((a, b) => b[1] - a[1]).map(([service, v]) => ({ service: serviceLabel(service as never), valeur: v.toFixed(2) })),
      };
    },
  },
  /* ---------- PERTES ---------- */
  {
    id: "pertes-raison",
    group: "Pertes",
    title: "Pertes par motif",
    desc: "Valeur des pertes validées regroupée par motif.",
    build: (db, { siteIds, from, to }) => {
      const map = new Map<string, { nb: number; valeur: number }>();
      for (const w of db.wastes.filter((w) => w.status === "valide" && siteIds.includes(w.siteId) && w.date >= from && w.date <= to)) {
        const v = db.movements.filter((m) => m.refId === w.id && m.type === "WASTE" && m.qty < 0).reduce((s, m) => s + m.totalCost, 0);
        const cur = map.get(w.reason) ?? { nb: 0, valeur: 0 };
        cur.nb++;
        cur.valeur += v;
        map.set(w.reason, cur);
      }
      return {
        cols: [{ key: "motif", label: "Motif" }, { key: "nb", label: "Documents" }, { key: "valeur", label: "Valeur perdue" }],
        rows: [...map.entries()].sort((a, b) => b[1].valeur - a[1].valeur).map(([motif, v]) => ({ motif, nb: v.nb, valeur: v.valeur.toFixed(2) })),
      };
    },
  },
  /* ---------- INVENTAIRE ---------- */
  {
    id: "ecarts-inventaire",
    group: "Inventaire",
    title: "Écarts d'inventaire",
    desc: "Théorique vs compté pour les inventaires validés, avec valeur d'écart.",
    build: (db, { siteIds }) => {
      const rows: Record<string, string | number>[] = [];
      for (const inv of db.inventories.filter((i) => i.status === "valide" && siteIds.includes(i.siteId)))
        for (const l of inv.lines) {
          if (l.actualQty === null) continue;
          const variance = l.actualQty - l.theoreticalQty;
          if (Math.abs(variance) < 0.001) continue;
          rows.push({
            inv: inv.number, site: db.sites.find((s) => s.id === inv.siteId)?.name ?? "",
            produit: db.products.find((p) => p.id === l.productId)?.name ?? "",
            theorique: l.theoreticalQty, compte: l.actualQty,
            ecart: variance.toFixed(2), valeur: (variance * l.unitCost).toFixed(2),
          });
        }
      return {
        cols: [{ key: "inv", label: "Inventaire" }, { key: "site", label: "Site" }, { key: "produit", label: "Produit" }, { key: "theorique", label: "Théorique" }, { key: "compte", label: "Compté" }, { key: "ecart", label: "Écart" }, { key: "valeur", label: "Valeur écart" }],
        rows,
      };
    },
  },
  /* ---------- FOURNISSEURS ---------- */
  {
    id: "balances",
    group: "Fournisseurs",
    title: "Balances fournisseurs",
    desc: "Soldes dus par fournisseur : solde d'ouverture + factures − règlements.",
    build: (db) => ({
      cols: [{ key: "fournisseur", label: "Fournisseur" }, { key: "facture", label: "Total facturé" }, { key: "paye", label: "Total payé" }, { key: "solde", label: "Solde dû" }],
      rows: db.suppliers.map((s) => {
        const b = supplierBalance(db, s.id);
        return { fournisseur: s.name, facture: b.invoiced.toFixed(2), paye: b.paid.toFixed(2), solde: b.balance.toFixed(2) };
      }),
    }),
  },
  {
    id: "credit",
    group: "Fournisseurs",
    title: "Journal de crédit fournisseur",
    desc: "Factures, échéances, payé et reste dû — le crédit fournisseur en temps réel.",
    build: (db, { siteIds }) => ({
      cols: [{ key: "fournisseur", label: "Fournisseur" }, { key: "facture", label: "Facture" }, { key: "date", label: "Date" }, { key: "echeance", label: "Échéance" }, { key: "total", label: "Total TTC" }, { key: "paye", label: "Payé" }, { key: "reste", label: "Reste dû" }, { key: "statut", label: "Statut" }],
      rows: db.invoices
        .filter((i) => siteIds.includes(i.siteId))
        .map((i) => {
          const ttc = invoiceTotals(i).ttc;
          const paid = invoicePaid(db, i.id);
          return {
            fournisseur: db.suppliers.find((s) => s.id === i.supplierId)?.name ?? "",
            facture: i.number, date: i.date, echeance: i.dueDate,
            total: ttc.toFixed(2), paye: paid.toFixed(2), reste: Math.max(ttc - paid, 0).toFixed(2),
            statut: invoiceStatus(db, i),
          };
        }),
    }),
  },
  {
    id: "reglements",
    group: "Fournisseurs",
    title: "Règlements fournisseurs",
    desc: "Journal des paiements de la période.",
    build: (db, { from, to }) => ({
      cols: [{ key: "num", label: "N°" }, { key: "date", label: "Date" }, { key: "fournisseur", label: "Fournisseur" }, { key: "facture", label: "Facture" }, { key: "montant", label: "Montant" }],
      rows: db.payments
        .filter((p) => p.date >= from && p.date <= to)
        .map((p) => ({
          num: p.number, date: p.date,
          fournisseur: db.suppliers.find((s) => s.id === p.supplierId)?.name ?? "",
          facture: db.invoices.find((i) => i.id === p.invoiceId)?.number ?? "Acompte",
          montant: p.amount.toFixed(2),
        })),
    }),
  },
  /* ---------- FOOD COST & CA ---------- */
  {
    id: "foodcost-mensuel",
    group: "Food Cost & ventes",
    title: "Food cost mensuel",
    desc: "Chiffre d'affaires, consommation et ratio food cost des 6 derniers mois.",
    build: (db, { siteIds }) => {
      const months: string[] = [];
      const d = new Date();
      for (let i = 0; i < 6; i++) {
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        d.setMonth(d.getMonth() - 1);
      }
      const rows = months.map((mk) => {
        const rev = db.sales.filter((s) => monthKey(s.date) === mk && siteIds.includes(s.siteId)).reduce((s, x) => s + x.revenue, 0);
        const conso = db.movements.filter((m) => m.type === "CONSUMPTION" && m.qty < 0 && monthKey(m.date) === mk && siteIds.includes(m.siteId)).reduce((s, m) => s + m.totalCost, 0);
        return { mois: monthLabel(mk), ca: rev.toFixed(2), consommation: conso.toFixed(2), foodcost: rev > 0 ? fmtPct((conso / rev) * 100) : "—" };
      });
      return { cols: [{ key: "mois", label: "Mois" }, { key: "ca", label: "Chiffre d'affaires" }, { key: "consommation", label: "Consommation" }, { key: "foodcost", label: "Food cost" }], rows };
    },
  },
  {
    id: "ca-service",
    group: "Food Cost & ventes",
    title: "Chiffre d'affaires par service",
    desc: "CA, couverts et ticket moyen par service sur la période.",
    build: (db, { siteIds, from, to }) => {
      const map = new Map<string, { ca: number; covers: number }>();
      for (const s of db.sales.filter((s) => siteIds.includes(s.siteId) && s.date >= from && s.date <= to)) {
        const cur = map.get(s.service) ?? { ca: 0, covers: 0 };
        cur.ca += s.revenue;
        cur.covers += s.covers;
        map.set(s.service, cur);
      }
      return {
        cols: [{ key: "service", label: "Service" }, { key: "ca", label: "CA" }, { key: "couverts", label: "Couverts" }, { key: "ticket", label: "Ticket moyen" }],
        rows: [...map.entries()].sort((a, b) => b[1].ca - a[1].ca).map(([service, v]) => ({
          service: serviceLabel(service as never), ca: v.ca.toFixed(2), couverts: v.covers,
          ticket: v.covers > 0 ? (v.ca / v.covers).toFixed(2) : "—",
        })),
      };
    },
  },
];

export function ReportsPage() {
  const { db, siteId, allowedSites, user, siteName } = useApp();
  const cur = db.company.currency;
  const [selected, setSelected] = useState(REPORTS[0].id);
  const [from, setFrom] = useState(addDaysISO(todayISO(), -30));
  const [to, setTo] = useState(todayISO());

  const report = REPORTS.find((r) => r.id === selected)!;
  const siteIds = siteId ? [siteId] : allowedSites.map((s) => s.id);

  const result = useMemo(
    () => report.build(db, { siteId, siteIds, from, to }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, report, siteId, from, to, allowedSites]
  );

  const groups = [...new Set(REPORTS.map((r) => r.group))];

  const exportCSV = () => {
    const name = `${report.id}-${todayISO()}.csv`;
    downloadFile(name, toCSV(result.cols, result.rows), "text/csv");
  };

  const tableCols = result.cols.map((c) => ({
    key: c.key,
    label: c.label,
    align: ["qte", "cout", "valeur", "total", "montant", "ca", "consommation", "ca", "paye", "reste", "solde", "facture", "entree", "sortie", "cout", "valeur", "ticket", "part", "min", "reappro", "refs", "rupture", "nb", "couverts", "theorique", "compte", "ecart", "foodcost"].includes(c.key) ? ("right" as const) : ("left" as const),
    render: (r: Record<string, string | number>) => {
      const v = r[c.key];
      return <span className="tnum">{typeof v === "number" ? fmtNum(v) : v}</span>;
    },
  }));

  return (
    <div>
      <PageHead title="Rapports" sub="Tous les rapports sont calculés par le même moteur que le stock : aucune divergence possible entre l'écran et l'export." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <aside className="lg:col-span-1">
          <div className="rounded-lg border border-line bg-card p-2">
            {groups.map((g) => (
              <div key={g} className="mb-1.5">
                <p className="px-2.5 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-mute">{g}</p>
                {REPORTS.filter((r) => r.group === g).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] font-semibold transition-all",
                      selected === r.id ? "bg-pine-800 text-pine-50" : "text-ink2 hover:bg-pine-50 hover:text-ink"
                    )}
                  >
                    <BarChart3 size={13} className={selected === r.id ? "text-copper-300" : "text-mute"} />
                    {r.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="lg:col-span-3">
          <Card
            title={report.title}
            sub={`${report.desc} — périmètre : ${siteId ? siteName(siteId) : "tous les sites"} · du ${fmtDate(from)} au ${fmtDate(to)}`}
            pad={false}
            actions={
              <div className="no-print flex items-center gap-2">
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-38 h-8.5 text-[12px]" />
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-38 h-8.5 text-[12px]" />
                <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={exportCSV}>CSV</Button>
                <Button variant="outline" size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>PDF / Imprimer</Button>
              </div>
            }
          >
            <DataTable cols={tableCols} rows={result.rows} rowKey={(r) => result.rows.indexOf(r) + "-" + String(r[result.cols[0]?.key ?? ""] ?? "")} pageSize={12} dense
              empty={<EmptyState title="Aucune donnée" sub="Aucun enregistrement sur ce périmètre et cette période." />}
            />
          </Card>
        </div>
      </div>

      {/* zone imprimée */}
      <div className="print-root hidden print:block">
        <div className="mb-5 flex items-start justify-between border-b-2 border-pine-900 pb-4">
          <div className="flex items-center gap-3">
            <LogoMark size={40} />
            <div>
              <p className="font-display text-[19px] font-bold text-pine-900">{db.company.name}</p>
              <p className="text-[11px] text-ink2">{db.company.legalName} · {db.company.address}, {db.company.city}</p>
              <p className="text-[11px] text-ink2">ICE {db.company.ice} · IF {db.company.iff} · RC {db.company.rc}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-[17px] font-bold text-pine-900">{report.title}</p>
            <p className="text-[11px] text-ink2">Périmètre : {siteId ? siteName(siteId) : "Tous les sites"}</p>
            <p className="text-[11px] text-ink2">Période : {fmtDate(from)} → {fmtDate(to)}</p>
            <p className="text-[11px] text-ink2">Généré le {fmtDateTime(new Date().toISOString())} par {user?.name}</p>
          </div>
        </div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr>
              {result.cols.map((c) => (
                <th key={c.key} className="border-b-2 border-pine-900 px-2 py-1.5 text-left font-bold uppercase tracking-wide text-pine-900">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.slice(0, 60).map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-paper" : ""}>
                {result.cols.map((c) => (
                  <td key={c.key} className="border-b border-line px-2 py-1.5">{typeof r[c.key] === "number" ? fmtNum(r[c.key] as number) : String(r[c.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[10px] text-mute">
          {result.rows.length} ligne(s) · Montants en {cur} · FoodOps — données issues du moteur de stock transactionnel (page 1/1)
        </p>
      </div>
    </div>
  );
}

export { Badge as ReportsBadge };
