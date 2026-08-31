import { useMemo, useState } from "react";
import { Boxes, Building2, Download, FileSearch, Flag, History } from "lucide-react";
import { useApp, useUserId } from "../state/AppContext";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  EmptyState,
  Field,
  Input,
  LineEditor,
  Modal,
  PageHead,
  SearchInput,
  Select,
  StatusBadge,
  StockBadge,
  type Col,
  type EditLine,
  cn,
} from "../components/ui";
import {
  computeStocks,
  createInitialStock,
  entryOf,
  productHistory,
  stockStatus,
} from "../lib/engine";
import type { Product, StockMovement } from "../types";
import {
  downloadFile,
  fmtDate,
  fmtMoney,
  fmtNum,
  MV_LABELS,
  toCSV,
  todayISO,
} from "../lib/util";

/* ---------- invite de sélection de site ---------- */
export function SitePrompt({ text }: { text: string }) {
  const { allowedSites, setSite } = useApp();
  return (
    <EmptyState
      icon={<Building2 size={24} />}
      title="Sélectionnez un site"
      sub={text}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          {allowedSites.map((s) => (
            <Button key={s.id} variant="outline" onClick={() => setSite(s.id)}>
              <span className="tnum font-mono text-[11px] font-bold">{s.code}</span> {s.name}
            </Button>
          ))}
        </div>
      }
    />
  );
}

/* ============================================================
   STOCK ACTUEL
   ============================================================ */
export function StockPage() {
  const { db, siteId, siteName } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [status, setStatus] = useState("");
  const [detail, setDetail] = useState<Product | null>(null);

  const stocks = useMemo(() => (siteId ? computeStocks(db, { siteId }) : null), [db, siteId]);

  const rows = useMemo(() => {
    if (!stocks || !siteId) return [];
    const q = search.toLowerCase();
    return db.products
      .filter((p) => {
        if (p.status !== "actif") return false;
        if (!db.movements.some((m) => m.siteId === siteId && m.productId === p.id)) return false;
        if (cat && p.categoryId !== cat && !db.categories.some((c) => c.id === p.categoryId && c.parentId === cat)) return false;
        if (q && !(p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))) return false;
        const e = entryOf(stocks, siteId, p.id);
        const st = stockStatus(e.qty, p);
        if (status && st !== status) return false;
        return true;
      })
      .map((p) => {
        const e = entryOf(stocks, siteId, p.id);
        return { p, e, st: stockStatus(e.qty, p) };
      });
  }, [db, stocks, siteId, search, cat, status]);

  const totalValue = rows.reduce((s, r) => s + Math.max(r.e.value, 0), 0);

  if (!siteId || !stocks)
    return (
      <div>
        <PageHead title="Stock actuel" sub="Le stock est toujours affiché pour un site précis — jamais global." />
        <Card pad={false}>
          <SitePrompt text="Le stock n'est jamais global chez FoodOps : choisissez le site dont vous voulez voir les quantités, valeurs et seuils." />
        </Card>
      </div>
    );

  const exportCSV = () => {
    downloadFile(
      `stock-${siteName(siteId).toLowerCase().replace(/\s+/g, "-")}-${todayISO()}.csv`,
      toCSV(
        [
          { key: "code", label: "Code" },
          { key: "produit", label: "Produit" },
          { key: "categorie", label: "Catégorie" },
          { key: "site", label: "Site" },
          { key: "qte", label: "Quantité" },
          { key: "unite", label: "Unité" },
          { key: "cout", label: "Coût moyen" },
          { key: "valeur", label: "Valeur" },
          { key: "min", label: "Seuil min" },
          { key: "statut", label: "Statut" },
        ],
        rows.map((r) => ({
          code: r.p.code,
          produit: r.p.name,
          categorie: db.categories.find((c) => c.id === r.p.categoryId)?.name ?? "",
          site: siteName(siteId),
          qte: r.e.qty,
          unite: db.units.find((u) => u.id === r.p.unitId)?.code ?? "",
          cout: r.e.avgCost.toFixed(2),
          valeur: r.e.value.toFixed(2),
          min: r.p.minStock,
          statut: r.st,
        }))
      ),
      "text/csv"
    );
  };

  const cols: Col<(typeof rows)[number]>[] = [
    {
      key: "name",
      label: "Produit",
      sortVal: (r) => r.p.name,
      render: (r) => (
        <div>
          <p className="font-bold text-ink">{r.p.name}</p>
          <p className="font-mono text-[10.5px] text-mute">{r.p.code}</p>
        </div>
      ),
    },
    {
      key: "cat",
      label: "Catégorie",
      sortVal: (r) => db.categories.find((c) => c.id === r.p.categoryId)?.name ?? "",
      render: (r) => <span className="text-ink2">{db.categories.find((c) => c.id === r.p.categoryId)?.name}</span>,
    },
    {
      key: "qty",
      label: "Quantité",
      align: "right",
      sortVal: (r) => r.e.qty,
      render: (r) => (
        <span className="tnum font-bold">
          {fmtNum(r.e.qty)} <span className="text-[11px] font-semibold text-mute">{db.units.find((u) => u.id === r.p.unitId)?.code}</span>
        </span>
      ),
    },
    {
      key: "avg",
      label: "Coût moyen",
      align: "right",
      sortVal: (r) => r.e.avgCost,
      render: (r) => <span className="tnum text-ink2">{fmtMoney(r.e.avgCost, cur)}</span>,
    },
    {
      key: "value",
      label: "Valeur",
      align: "right",
      sortVal: (r) => r.e.value,
      render: (r) => <span className="tnum font-bold text-ink">{fmtMoney(Math.max(r.e.value, 0), cur)}</span>,
    },
    {
      key: "level",
      label: "Niveau",
      width: "150px",
      render: (r) => {
        const pct = Math.min(100, (r.e.qty / (r.p.reorderPoint * 1.6 || 1)) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-line">
              <div
                className={cn("h-full rounded-full", r.st === "ok" ? "bg-pine-500" : r.st === "bas" ? "bg-warn" : "bg-bad")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="tnum shrink-0 text-[10.5px] text-mute">min {fmtNum(r.p.minStock)}</span>
          </div>
        );
      },
    },
    { key: "st", label: "Statut", render: (r) => <StockBadge kind={r.st} />, sortVal: (r) => r.st },
  ];

  return (
    <div>
      <PageHead
        title="Stock actuel"
        sub={
          <>
            Site <strong className="text-ink">{siteName(siteId)}</strong> — quantités et valeurs dérivées des mouvements validés (coût moyen pondéré).
          </>
        }
      >
        <Button variant="outline" icon={<Download size={15} />} onClick={exportCSV}>
          Export CSV
        </Button>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Produit ou code…" className="w-64" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-52">
          <option value="">Toutes les catégories</option>
          {db.categories.filter((c) => !c.parentId).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="ok">En stock</option>
          <option value="bas">Stock bas</option>
          <option value="critique">Critique</option>
          <option value="rupture">Rupture</option>
        </Select>
        <div className="ml-auto rounded-md border border-line bg-card px-3.5 py-2 text-[12.5px] font-semibold text-ink2">
          Valeur totale : <span className="tnum font-display text-[14px] font-bold text-pine-700">{fmtMoney(totalValue, cur)}</span>
          <span className="ml-2 text-mute">· {rows.length} produits</span>
        </div>
      </div>

      <DataTable
        cols={cols}
        rows={rows}
        rowKey={(r) => r.p.id}
        onRowClick={(r) => setDetail(r.p)}
        pageSize={14}
        empty={
          <EmptyState
            icon={<Boxes size={24} />}
            title="Aucun produit avec du stock"
            sub="Enregistrez un stock initial ou validez une réception pour alimenter ce site."
          />
        }
      />

      <StockDetailModal product={detail} onClose={() => setDetail(null)} siteId={siteId} />
    </div>
  );
}

function StockDetailModal({ product, onClose, siteId }: { product: Product | null; onClose: () => void; siteId: string }) {
  const { db, siteName } = useApp();
  const cur = db.company.currency;
  const history = useMemo(
    () => (product ? productHistory(db, siteId, product.id) : []),
    [db, siteId, product]
  );
  if (!product) return null;
  const stocks = computeStocks(db, { siteId, productId: product.id });
  const e = entryOf(stocks, siteId, product.id);

  return (
    <Modal
      open={!!product}
      onClose={onClose}
      title={product.name}
      sub={`${product.code} · ${siteName(siteId)} — historique complet du solde`}
      width="max-w-3xl"
    >
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { l: "Stock actuel", v: `${fmtNum(e.qty)} ${db.units.find((u) => u.id === product.unitId)?.code}` },
          { l: "Coût moyen pondéré", v: fmtMoney(e.avgCost, cur) },
          { l: "Valeur du stock", v: fmtMoney(Math.max(e.value, 0), cur) },
          { l: "Seuil min / réappro", v: `${fmtNum(product.minStock)} / ${fmtNum(product.reorderPoint)}` },
        ].map((x) => (
          <div key={x.l} className="rounded-md border border-line bg-paper/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">{x.l}</p>
            <p className="tnum mt-1 font-display text-[14px] font-bold text-ink">{x.v}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-mute">
              <th className="px-3 py-2">Date</th>
              <th className="px-2 py-2">Document</th>
              <th className="px-2 py-2">Mouvement</th>
              <th className="px-2 py-2 text-right">Entrée</th>
              <th className="px-2 py-2 text-right">Sortie</th>
              <th className="px-2 py-2 text-right">Coût</th>
              <th className="px-3 py-2 text-right">Solde</th>
            </tr>
          </thead>
          <tbody>
            {history.map(({ mov, balance }) => (
              <tr key={mov.id} className="border-b border-line/70 last:border-0 hover:bg-pine-50/50">
                <td className="px-3 py-2 text-mute">{fmtDate(mov.date)}</td>
                <td className="px-2 py-2 font-mono text-[10.5px] font-semibold text-ink2">{mov.refNumber}</td>
                <td className="px-2 py-2">{MV_LABELS[mov.type]}</td>
                <td className="tnum px-2 py-2 text-right font-bold text-ok">{mov.qty > 0 ? "+" + fmtNum(mov.qty) : ""}</td>
                <td className="tnum px-2 py-2 text-right font-bold text-bad">{mov.qty < 0 ? fmtNum(mov.qty) : ""}</td>
                <td className="tnum px-2 py-2 text-right text-ink2">{fmtMoney(mov.totalCost, cur)}</td>
                <td className="tnum px-3 py-2 text-right font-bold">{fmtNum(balance)}</td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-mute">Aucun mouvement pour ce produit sur ce site.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-mute">
        <History size={13} />
        Les annulations apparaissent comme des contre-passations : l'historique n'est jamais supprimé.
      </p>
    </Modal>
  );
}

/* ============================================================
   MOUVEMENTS DE STOCK
   ============================================================ */
export function MovementsPage() {
  const { db, siteId, allowedSites, siteName } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const siteIds = siteId ? [siteId] : allowedSites.map((s) => s.id);
    return [...db.movements]
      .filter((m) => {
        if (!siteIds.includes(m.siteId)) return false;
        if (type && m.type !== type) return false;
        if (from && m.date < from) return false;
        if (to && m.date > to) return false;
        if (q) {
          const p = db.products.find((x) => x.id === m.productId);
          if (!(p?.name.toLowerCase().includes(q) || p?.code.toLowerCase().includes(q) || m.refNumber.toLowerCase().includes(q)))
            return false;
        }
        return true;
      })
      .sort((a, b) => b.seq - a.seq);
  }, [db, siteId, allowedSites, search, type, from, to]);

  const cols: Col<StockMovement>[] = [
    { key: "date", label: "Date", sortVal: (m) => m.seq, render: (m) => <span className="text-mute">{fmtDate(m.date)}</span>, width: "90px" },
    { key: "ref", label: "Document", sortVal: (m) => m.refNumber, render: (m) => <span className="font-mono text-[11px] font-bold text-ink2">{m.refNumber}</span> },
    {
      key: "type",
      label: "Mouvement",
      sortVal: (m) => m.type,
      render: (m) => <Badge tone={m.qty > 0 ? "ok" : "warn"}>{MV_LABELS[m.type]}</Badge>,
    },
    {
      key: "prod",
      label: "Produit",
      sortVal: (m) => db.products.find((p) => p.id === m.productId)?.name ?? "",
      render: (m) => <span className="font-semibold">{db.products.find((p) => p.id === m.productId)?.name}</span>,
    },
    {
      key: "site",
      label: "Site",
      sortVal: (m) => m.siteId,
      render: (m) => (
        <span className="tnum rounded bg-pine-900/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-pine-100">
          {db.sites.find((s) => s.id === m.siteId)?.code}
        </span>
      ),
    },
    { key: "in", label: "Entrée", align: "right", sortVal: (m) => (m.qty > 0 ? m.qty : 0), render: (m) => <span className="tnum font-bold text-ok">{m.qty > 0 ? "+" + fmtNum(m.qty) : ""}</span> },
    { key: "out", label: "Sortie", align: "right", sortVal: (m) => (m.qty < 0 ? m.qty : 0), render: (m) => <span className="tnum font-bold text-bad">{m.qty < 0 ? fmtNum(m.qty) : ""}</span> },
    { key: "pu", label: "PU", align: "right", render: (m) => <span className="tnum text-ink2">{fmtMoney(m.unitCost, cur)}</span> },
    { key: "val", label: "Valeur", align: "right", sortVal: (m) => m.totalCost, render: (m) => <span className="tnum font-bold">{fmtMoney(m.totalCost, cur)}</span> },
    {
      key: "user",
      label: "Utilisateur",
      render: (m) => <span className="text-[11.5px] text-mute">{db.users.find((u) => u.id === m.userId)?.name ?? "Système"}</span>,
    },
  ];

  return (
    <div>
      <PageHead
        title="Mouvements de stock"
        sub={
          siteId
            ? `Journal traçable du site ${siteName(siteId)} — chaque ligne répond à : qui, quoi, quand, où, combien.`
            : "Journal consolidé de tous les sites autorisés."
        }
      >
        <Button
          variant="outline"
          icon={<Download size={15} />}
          onClick={() =>
            downloadFile(
              `mouvements-${todayISO()}.csv`,
              toCSV(
                [
                  { key: "date", label: "Date" },
                  { key: "doc", label: "Document" },
                  { key: "type", label: "Type" },
                  { key: "produit", label: "Produit" },
                  { key: "site", label: "Site" },
                  { key: "qte", label: "Quantité" },
                  { key: "pu", label: "PU" },
                  { key: "valeur", label: "Valeur" },
                ],
                rows.map((m) => ({
                  date: m.date,
                  doc: m.refNumber,
                  type: MV_LABELS[m.type],
                  produit: db.products.find((p) => p.id === m.productId)?.name ?? "",
                  site: db.sites.find((s) => s.id === m.siteId)?.code ?? "",
                  qte: m.qty,
                  pu: m.unitCost.toFixed(2),
                  valeur: m.totalCost.toFixed(2),
                }))
              ),
              "text/csv"
            )
          }
        >
          Export CSV
        </Button>
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Produit, code ou document…" className="w-64" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-56">
          <option value="">Tous les mouvements</option>
          {Object.entries(MV_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" title="Du" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" title="Au" />
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(m) => m.id} pageSize={15}
        empty={<EmptyState icon={<FileSearch size={24} />} title="Aucun mouvement" sub="Modifiez vos filtres ou validez un premier document d'entrée/sortie." />}
      />
    </div>
  );
}

/* ============================================================
   STOCK INITIAL
   ============================================================ */
export function InitialStockPage() {
  const { db, siteId, siteName, act, can } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [lines, setLines] = useState<EditLine[]>([]);
  const [date, setDate] = useState(todayISO());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const existing = useMemo(
    () =>
      siteId
        ? db.movements
            .filter((m) => m.siteId === siteId && m.type === "INITIAL_STOCK" && m.qty > 0)
            .sort((a, b) => b.seq - a.seq)
        : [],
    [db, siteId]
  );

  if (!siteId)
    return (
      <div>
        <PageHead title="Stock initial" sub="Mise en place du stock d'ouverture, site par site." />
        <Card pad={false}>
          <SitePrompt text="Le stock initial est propre à chaque site : sélectionnez le site à initialiser." />
        </Card>
      </div>
    );

  const activeProducts = db.products.filter((p) => p.status === "actif");

  const submit = () => {
    const ok = act(
      (d) =>
        createInitialStock(d, {
          siteId,
          date,
          userId,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
        }),
      `Stock initial enregistré sur ${siteName(siteId)} — ${lines.length} mouvement(s) INITIAL_STOCK créé(s).`
    );
    if (ok) setLines([]);
  };

  const cols: Col<StockMovement>[] = [
    { key: "date", label: "Date", render: (m) => <span className="text-mute">{fmtDate(m.date)}</span>, sortVal: (m) => m.seq },
    {
      key: "prod",
      label: "Produit",
      sortVal: (m) => db.products.find((p) => p.id === m.productId)?.name ?? "",
      render: (m) => (
        <div>
          <p className="font-bold">{db.products.find((p) => p.id === m.productId)?.name}</p>
          <p className="font-mono text-[10.5px] text-mute">{m.refNumber}</p>
        </div>
      ),
    },
    { key: "qty", label: "Quantité", align: "right", sortVal: (m) => m.qty, render: (m) => <span className="tnum font-bold text-ok">+{fmtNum(m.qty)} {db.units.find((u) => u.id === (db.products.find((p) => p.id === m.productId)?.unitId ?? ""))?.code}</span> },
    { key: "pu", label: "Coût unitaire", align: "right", render: (m) => <span className="tnum text-ink2">{fmtMoney(m.unitCost, cur)}</span> },
    { key: "val", label: "Valeur", align: "right", sortVal: (m) => m.totalCost, render: (m) => <span className="tnum font-bold">{fmtMoney(m.totalCost, cur)}</span> },
    {
      key: "user",
      label: "Par",
      render: (m) => <span className="text-[11.5px] text-mute">{db.users.find((u) => u.id === m.userId)?.name}</span>,
    },
  ];

  return (
    <div>
      <PageHead title="Stock initial" sub={`Mise en place du stock d'ouverture pour ${siteName(siteId)}. Un produit ne peut être initialisé qu'une seule fois par site.`} />

      {can("stock.adjust") && (
        <Card title="Nouveau stock initial" sub="Chaque ligne générera un mouvement INITIAL_STOCK traçable." className="mb-5">
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Field label="Date d'ouverture" className="w-44">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="ml-auto">
              <Button
                icon={<Flag size={15} />}
                disabled={!lines.length || lines.some((l) => !l.productId || l.qty <= 0)}
                onClick={() => setConfirmOpen(true)}
              >
                Enregistrer le stock initial
              </Button>
            </div>
          </div>
          <LineEditor rows={lines} onChange={setLines} products={activeProducts} units={db.units} qtyLabel="Qté initiale" />
        </Card>
      )}

      <Card title={`Historique du stock initial — ${siteName(siteId)}`} sub="Mouvements INITIAL_STOCK, jamais supprimables" pad={false}>
        <DataTable cols={cols} rows={existing} rowKey={(m) => m.id} pageSize={10}
          empty={<EmptyState icon={<Flag size={22} />} title="Aucun stock initial" sub="Ce site n'a pas encore de stock d'ouverture enregistré." />}
        />
      </Card>

      <Confirm
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={submit}
        title="Enregistrer le stock initial ?"
        confirmLabel="Enregistrer"
        tone="primary"
        message={
          <>
            <strong>{lines.length} produit(s)</strong> seront comptabilisés comme stock d'ouverture sur{" "}
            <strong>{siteName(siteId)}</strong> à la date du <strong>{fmtDate(date)}</strong>. Cette opération crée des
            mouvements définitifs et ne peut pas être répétée pour un même produit sur ce site.
          </>
        }
      />
    </div>
  );
}

export { StatusBadge };
