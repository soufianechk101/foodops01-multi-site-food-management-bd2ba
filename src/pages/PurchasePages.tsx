import { useMemo, useState } from "react";
import { Logo } from "../components/Logo";
import { Eye, FileText, Pencil, Plus, Truck, Wallet, X, Printer, Clock } from "lucide-react";
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
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  type Col,
  type EditLine,
} from "../components/ui";
import {
  cancelReception,
  invoicePaid,
  invoiceStatus,
  invoiceTotals,
  receptionFromPO,
  saveInvoice,
  savePayment,
  savePO,
  saveReception,
  setPOStatus,
  supplierBalance,
  validateReception,
} from "../lib/engine";
import type { Invoice, Payment, PayMethod, PurchaseOrder, Reception } from "../types";
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtNum,
  nowISO,
  payMethodLabel,
  todayISO,
  uid,
} from "../lib/util";

/* ============================================================
   BONS DE COMMANDE
   ============================================================ */
export function PurchaseOrdersPage() {
  const { db, siteId, allowedSites, act, can, nav, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [poSite, setPoSite] = useState(siteId ?? "");
  const [date, setDate] = useState(todayISO());
  const [expected, setExpected] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);
  const [editId, setEditId] = useState<string | null>(null);

  const poTotal = (po: PurchaseOrder) => po.lines.reduce((s, l) => s + l.qty * l.unitCost, 0);

  const rows = useMemo(
    () =>
      [...db.purchaseOrders]
        .filter((p) => (siteId ? p.siteId === siteId : allowedSites.some((s) => s.id === p.siteId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.purchaseOrders, siteId, allowedSites]
  );

  const openNew = () => {
    setEditId(null);
    setSupplierId(db.suppliers.find((s) => s.status === "actif")?.id ?? "");
    setPoSite(siteId ?? allowedSites[0]?.id ?? "");
    setDate(todayISO());
    setExpected(todayISO());
    setNotes("");
    setLines([]);
    setShowNew(true);
  };

  const openEdit = (po: PurchaseOrder) => {
    setEditId(po.id);
    setSupplierId(po.supplierId);
    setPoSite(po.siteId);
    setDate(po.date);
    setExpected(po.expectedDate);
    setNotes(po.notes);
    setLines(po.lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })));
    setEditing(po);
    setShowNew(true);
  };

  const save = () => {
    const ok = act(
      (d) =>
        savePO(d, {
          id: editId ?? uid(),
          number: editId ? db.purchaseOrders.find((p) => p.id === editId)?.number ?? "" : "",
          supplierId,
          siteId: poSite,
          date,
          expectedDate: expected,
          status: "brouillon",
          notes,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost, vatRate: d.products.find((p) => p.id === l.productId)?.vatRate ?? 10, receivedQty: editId ? db.purchaseOrders.find((p) => p.id === editId)?.lines.find((x) => x.productId === l.productId)?.receivedQty ?? 0 : 0 })),
          userId,
          createdAt: editId ? db.purchaseOrders.find((p) => p.id === editId)?.createdAt ?? nowISO() : nowISO(),
        }),
      editId ? "Bon de commande mis à jour." : "Bon de commande créé — sans impact sur le stock."
    );
    if (ok) {
      setShowNew(false);
      setEditing(null);
    }
  };

  const makeReception = (po: PurchaseOrder) => {
    const ok = act((d) => {
      receptionFromPO(d, po.id, userId);
    }, `Brouillon de réception créé depuis ${po.number} — vérifiez les quantités puis validez-la.`);
    if (ok) nav("receptions");
  };

  const cols: Col<PurchaseOrder>[] = [
    { key: "num", label: "N°", sortVal: (p) => p.number, render: (p) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{p.number}</span> },
    { key: "date", label: "Date", sortVal: (p) => p.date, render: (p) => <div><p className="text-mute">{fmtDate(p.date)}</p><p className="text-[10.5px] text-mute">livr. {fmtDate(p.expectedDate)}</p></div> },
    { key: "sup", label: "Fournisseur", sortVal: (p) => db.suppliers.find((s) => s.id === p.supplierId)?.name ?? "", render: (p) => <span className="font-semibold">{db.suppliers.find((s) => s.id === p.supplierId)?.name}</span> },
    { key: "site", label: "Site", render: (p) => <span className="font-semibold">{siteName(p.siteId)}</span>, sortVal: (p) => p.siteId },
    { key: "lines", label: "Lignes", align: "center", render: (p) => <span className="tnum">{p.lines.length}</span> },
    {
      key: "recv",
      label: "Réceptionné",
      render: (p) => {
        const ordered = p.lines.reduce((s, l) => s + l.qty, 0);
        const recv = p.lines.reduce((s, l) => s + l.receivedQty, 0);
        const pct = ordered > 0 ? (recv / ordered) * 100 : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-pine-500" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="tnum text-[11px] font-semibold text-ink2">{fmtNum(pct, 0)} %</span>
          </div>
        );
      },
    },
    { key: "total", label: "Total HT", align: "right", sortVal: poTotal, render: (p) => <span className="tnum font-bold">{fmtMoney(poTotal(p), cur)}</span> },
    { key: "st", label: "Statut", render: (p) => <StatusBadge status={p.status} />, sortVal: (p) => p.status },
    {
      key: "act",
      label: "Actions",
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(p)} icon={<Eye size={13} />}>Détail</Button>
          {(p.status === "brouillon" || p.status === "soumis") && can("purchases.create") && (
            <Button size="sm" variant="ghost" onClick={() => openEdit(p)} icon={<Pencil size={13} />}>Modifier</Button>
          )}
          {p.status === "brouillon" && can("purchases.create") && (
            <Button size="sm" variant="outline" onClick={() => act((d) => setPOStatus(d, p.id, "soumis", userId), `Bon ${p.number} soumis pour approbation.`)}>Soumettre</Button>
          )}
          {p.status === "soumis" && can("purchases.approve") && (
            <Button size="sm" onClick={() => act((d) => setPOStatus(d, p.id, "approuve", userId), `Bon ${p.number} approuvé.`)}>Approuver</Button>
          )}
          {(p.status === "approuve" || p.status === "partiel") && can("receptions.create") && (
            <Button size="sm" variant="copper" icon={<Truck size={13} />} onClick={() => makeReception(p)}>Réceptionner</Button>
          )}
          {(p.status === "brouillon" || p.status === "soumis" || p.status === "approuve") && can("purchases.create") && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler le bon ?", msg: `Le bon de commande ${p.number} sera annulé. Aucun mouvement de stock n'est généré par un bon.`, fn: () => act((d) => setPOStatus(d, p.id, "annule", userId), `Bon ${p.number} annulé.`) })} icon={<X size={13} />}>Annuler</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Bons de commande" sub="Un bon de commande ne modifie jamais le stock — seule la réception validée le fait.">
        {can("purchases.create") && <Button icon={<Plus size={15} />} onClick={openNew}>Nouveau bon</Button>}
      </PageHead>

      <DataTable cols={cols} rows={rows} rowKey={(p) => p.id} pageSize={10}
        empty={<EmptyState title="Aucun bon de commande" sub="Créez votre premier bon de commande fournisseur pour initier le circuit d'achat." action={can("purchases.create") ? <Button icon={<Plus size={15} />} onClick={openNew}>Créer un bon</Button> : undefined} />}
      />

      {/* Modal Nouveau/Modifier Bon */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title={editId ? `Modifier ${editing?.number}` : "Nouveau bon de commande"} sub="Enregistré en brouillon, sans impact sur le stock." width="max-w-4xl">
        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fournisseur" className="sm:col-span-2">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {db.suppliers.filter((s) => s.status === "actif").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Site livré">
              <Select value={poSite} onChange={(e) => setPoSite(e.target.value)}>
                {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>
            </Field>
            <Field label="Livraison prévue">
              <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
            </Field>
          </div>
          
          <div className="border border-line rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <LineEditor rows={lines} onChange={setLines} products={db.products.filter((p) => p.status === "actif")} units={db.units} qtyLabel="Qté commandée" />
            </div>
          </div>
          
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions particulières…" rows={2} />
          </Field>
        </div>
        
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
          <Button variant="outline" onClick={() => setShowNew(false)}>Fermer</Button>
          <Button disabled={!supplierId || !poSite || !lines.length || lines.some((l) => !l.productId || l.qty <= 0)} onClick={save}>Enregistrer</Button>
        </div>
      </Modal>

      {/* Modal Détail Bon de Commande - مصلح */}
     <Modal open={!!detail} onClose={() => setDetail(null)} title="Détail du Bon de Commande" sub={detail?.number} width="max-w-4xl">
  {detail && (
    <div className="max-h-[85vh] overflow-y-auto">
      
      {/* ========================================== */}
      {/* 1. العرض العادي (يختفي عند الطباعة) */}
      {/* ========================================== */}
      <div className="no-print space-y-4 p-6">
        <div className="flex items-start gap-4 border-b border-line pb-4">
          <Logo size={48} />
          <div className="flex-1">
            <h2 className="text-lg font-bold text-ink">{db.company.name}</h2>
            <p className="text-xs text-mute">{db.company.address} | ICE: {db.company.ice}</p>
          </div>
          <Button variant="outline" size="sm" icon={<Printer size={14} />} onClick={() => window.print()}>
            Imprimer / PDF
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-paper p-3 rounded border border-line">
            <p className="text-[10px] font-bold uppercase text-mute mb-1">Fournisseur</p>
            <p className="font-bold text-ink">{db.suppliers.find((s) => s.id === detail.supplierId)?.name}</p>
          </div>
          <div className="bg-paper p-3 rounded border border-line">
            <p className="text-[10px] font-bold uppercase text-mute mb-1">Site & Date</p>
            <p className="font-bold text-ink">{siteName(detail.siteId)} · {fmtDate(detail.date)}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded border border-line">
          <table className="w-full text-[12.5px]">
            <thead className="bg-paper/70 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
              <tr>
                <th className="px-3 py-2">Produit</th>
                <th className="px-3 py-2 text-right">Qté</th>
                <th className="px-3 py-2 text-right">Reçu</th>
                <th className="px-3 py-2 text-right">PU HT</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((l, i) => {
                const p = db.products.find((x) => x.id === l.productId);
                return (
                  <tr key={i} className="border-b border-line/70 last:border-0">
                    <td className="px-3 py-2 font-semibold">{p?.name}</td>
                    <td className="px-3 py-2 text-right tnum">{fmtNum(l.qty)}</td>
                    <td className="px-3 py-2 text-right tnum text-pine-700 font-bold">{fmtNum(l.receivedQty)}</td>
                    <td className="px-3 py-2 text-right tnum text-ink2">{fmtMoney(l.unitCost, cur)}</td>
                    <td className="px-3 py-2 text-right tnum font-bold">{fmtMoney(l.qty * l.unitCost, cur)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-right text-[13px] font-semibold text-ink2 border-t border-line pt-3">
          Total HT : <span className="tnum font-display text-[18px] font-bold text-ink">{fmtMoney(poTotal(detail), cur)}</span>
        </p>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. عرض الطباعة الاحترافي */}
      {/* ========================================== */}
      <div className="print-only">
        <div className="p-8">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-pine-900">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-pine-900 mb-3">{db.company.name}</h1>
              <div className="space-y-1 text-sm text-gray-600">
                <p>{db.company.address}</p>
                <p>{db.company.city} - Maroc</p>
                <p className="text-xs mt-2">
                  ICE: {db.company.ice} | IF: {db.company.iff} | RC: {db.company.rc}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-pine-900 uppercase tracking-wide mb-2">Bon de Commande</h2>
              <p className="font-mono text-lg font-bold text-pine-700">{detail.number}</p>
              <p className="text-sm text-gray-600 mt-1">Date: {fmtDate(detail.date)}</p>
              {detail.expectedDate && (
                <p className="text-sm text-gray-600">Livraison prévue: {fmtDate(detail.expectedDate)}</p>
              )}
            </div>
          </div>

          {/* Fournisseur */}
          <div className="mb-8 p-5 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 tracking-wide">Fournisseur</h3>
            <p className="font-bold text-lg text-gray-900">{db.suppliers.find((s) => s.id === detail.supplierId)?.name}</p>
            {(() => {
              const sup = db.suppliers.find((s) => s.id === detail.supplierId);
              return sup && (
                <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                  {sup.address && <p>{sup.address}</p>}
                  {sup.city && <p>{sup.city}</p>}
                  {sup.phone && <p>Tél: {sup.phone}</p>}
                  {sup.email && <p>Email: {sup.email}</p>}
                </div>
              );
            })()}
          </div>

          {/* جدول المنتجات */}
          <table className="w-full mb-8 border-2 border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-sm border-b border-gray-300">Produit</th>
                <th className="px-4 py-3 text-center font-bold text-sm border-b border-gray-300">Qté</th>
                <th className="px-4 py-3 text-right font-bold text-sm border-b border-gray-300">PU HT</th>
                <th className="px-4 py-3 text-right font-bold text-sm border-b border-gray-300">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((l, i) => {
                const p = db.products.find((x) => x.id === l.productId);
                const total = l.qty * l.unitCost;
                return (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 font-semibold text-sm border-b border-gray-200">
                      {p?.name || 'Produit inconnu'}
                      {p?.code && <span className="text-xs text-gray-500 ml-2">({p.code})</span>}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm border-b border-gray-200">{fmtNum(l.qty)}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-gray-600 border-b border-gray-200">{fmtMoney(l.unitCost, cur)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sm border-b border-gray-200">{fmtMoney(total, cur)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100">
                <td colSpan={3} className="px-4 py-3 text-right font-bold text-base">Total HT:</td>
                <td className="px-4 py-3 text-right font-bold text-xl text-pine-900">{fmtMoney(poTotal(detail), cur)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Notes */}
          {detail.notes && (
            <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-xs font-bold uppercase text-yellow-700 mb-2">Notes / Réserves</h3>
              <p className="text-sm text-gray-700">{detail.notes}</p>
            </div>
          )}

          {/* توقيعات */}
          <div className="mt-16 pt-8 border-t-2 border-gray-300">
            <p className="text-sm text-gray-600 mb-8 italic">
              Arrêté le présent bon de commande à la somme de : <span className="font-bold text-gray-900">{fmtMoney(poTotal(detail), cur)} HT</span>
            </p>
            <div className="grid grid-cols-2 gap-16">
              <div>
                <p className="font-bold text-sm mb-1 pb-2 border-b border-gray-400">Cachet et Signature du Fournisseur</p>
                <p className="text-xs text-gray-500">(Lu et approuvé)</p>
                <div className="h-20 mt-4"></div>
              </div>
              <div>
                <p className="font-bold text-sm mb-1 pb-2 border-b border-gray-400">Service des Achats</p>
                <p className="text-xs text-gray-500">Visa et validation</p>
                <div className="h-20 mt-4"></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
            <p>Document généré le {new Date().toLocaleDateString('fr-FR')} via FoodOps - Système de Gestion des Stocks</p>
          </div>

        </div>
      </div>

    </div>
  )}
</Modal>

  
<Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   RÉCEPTIONS
   ============================================================ */
export function ReceptionsPage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Reception | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const [supplierId, setSupplierId] = useState("");
  const [recSite, setRecSite] = useState(siteId ?? "");
  const [date, setDate] = useState(todayISO());
  const [invoiceRef, setInvoiceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);

  const recTotal = (r: Reception) => r.lines.reduce((s, l) => s + l.receivedQty * l.unitCost, 0);

  const rows = useMemo(
    () =>
      [...db.receptions]
        .filter((r) => (siteId ? r.siteId === siteId : allowedSites.some((s) => s.id === r.siteId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.receptions, siteId, allowedSites]
  );

  const openNew = () => {
    setSupplierId(db.suppliers.find((s) => s.status === "actif")?.id ?? "");
    setRecSite(siteId ?? allowedSites[0]?.id ?? "");
    setDate(todayISO());
    setInvoiceRef("");
    setNotes("");
    setLines([]);
    setShowNew(true);
  };

  const save = () => {
    const ok = act(
      (d) =>
        saveReception(d, {
          id: uid(),
          number: "",
          supplierId,
          siteId: recSite,
          date,
          poId: null,
          invoiceRef,
          status: "brouillon",
          notes,
          lines: lines.map((l) => ({
            productId: l.productId,
            orderedQty: l.orderedQty ?? l.qty,
            receivedQty: l.qty,
            unitCost: l.unitCost,
            vatRate: d.products.find((p) => p.id === l.productId)?.vatRate ?? 10,
            lot: l.lot ?? "",
            expiry: l.expiry ?? "",
          })),
          userId,
          createdAt: nowISO(),
        }),
      "Réception enregistrée en brouillon — le stock n'augmentera qu'à la validation."
    );
    if (ok) setShowNew(false);
  };

  const cols: Col<Reception>[] = [
    { key: "num", label: "N°", sortVal: (r) => r.number, render: (r) => <div><span className="font-mono text-[11.5px] font-bold text-pine-700">{r.number}</span>{r.poId && <p className="text-[10.5px] text-mute">sur {db.purchaseOrders.find((p) => p.id === r.poId)?.number}</p>}</div> },
    { key: "date", label: "Date", sortVal: (r) => r.date, render: (r) => <span className="text-mute">{fmtDate(r.date)}</span> },
    { key: "sup", label: "Fournisseur", sortVal: (r) => db.suppliers.find((s) => s.id === r.supplierId)?.name ?? "", render: (r) => <span className="font-semibold">{db.suppliers.find((s) => s.id === r.supplierId)?.name}</span> },
    { key: "site", label: "Site", render: (r) => <span className="font-semibold">{siteName(r.siteId)}</span>, sortVal: (r) => r.siteId },
    { key: "lines", label: "Lignes", align: "center", render: (r) => <span className="tnum">{r.lines.length}</span> },
    { key: "total", label: "Total HT", align: "right", sortVal: recTotal, render: (r) => <span className="tnum font-bold">{fmtMoney(recTotal(r), cur)}</span> },
    { key: "st", label: "Statut", render: (r) => <StatusBadge status={r.status} />, sortVal: (r) => r.status },
    {
      key: "act",
      label: "Actions",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(r)} icon={<Eye size={13} />}>Détail</Button>
          {r.status === "brouillon" && can("receptions.validate") && (
            <Button size="sm" onClick={() => setConfirm({ title: "Valider la réception ?", msg: `La réception ${r.number} augmentera le stock de ${siteName(r.siteId)} (mouvements RECEPTION, coût moyen pondéré mis à jour). Cette validation n'est possible qu'une seule fois.`, fn: () => act((d) => validateReception(d, r.id, userId), `Réception ${r.number} validée — stock augmenté.`) })}>Valider</Button>
          )}
          {r.status === "valide" && can("receptions.cancel") && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler la réception ?", msg: `La réception ${r.number} sera contre-passée : les quantités reçues seront retirées du stock. Impossible si les quantités ont déjà été consommées.`, fn: () => act((d) => cancelReception(d, r.id, userId), `Réception ${r.number} annulée — contre-passation comptabilisée.`) })} icon={<X size={13} />}>Annuler</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Réceptions marchandises" sub="La validation d'une réception est le seul moment où une entrée en stock est comptabilisée.">
        {can("receptions.create") && <Button icon={<Plus size={15} />} onClick={openNew}>Nouvelle réception</Button>}
      </PageHead>

      <DataTable cols={cols} rows={rows} rowKey={(r) => r.id} pageSize={10}
        empty={<EmptyState icon={<Truck size={24} />} title="Aucune réception" sub="Réceptionnez une livraison directe ou générez une réception depuis un bon de commande approuvé." action={can("receptions.create") ? <Button icon={<Plus size={15} />} onClick={openNew}>Créer une réception</Button> : undefined} />}
      />

      {/* Modal Nouvelle Réception */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouvelle réception" sub="Livraison directe — brouillon sans impact sur le stock." width="max-w-4xl">
        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fournisseur" className="sm:col-span-2">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {db.suppliers.filter((s) => s.status === "actif").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Site de réception">
              <Select value={recSite} onChange={(e) => setRecSite(e.target.value)}>
                {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          
          <div className="border border-line rounded-md overflow-hidden">
            <div className="max-h-[300px] overflow-y-auto">
              <LineEditor rows={lines} onChange={setLines} products={db.products.filter((p) => p.status === "actif")} units={db.units} showLot qtyLabel="Qté reçue" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Référence facture / BL">
              <Input value={invoiceRef} onChange={(e) => setInvoiceRef(e.target.value)} placeholder="ex. BL-2026-114" />
            </Field>
            <Field label="Notes">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Réserves, manquants…" />
            </Field>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
          <Button variant="outline" onClick={() => setShowNew(false)}>Fermer</Button>
          <Button disabled={!supplierId || !recSite || !lines.length || lines.some((l) => !l.productId || l.qty <= 0)} onClick={save}>Enregistrer le brouillon</Button>
        </div>
      </Modal>

      {/* Modal Détail Réception - مصلح */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="" sub="" width="max-w-4xl">
        {detail && (
          <div className="max-h-[calc(90vh-100px)] overflow-y-auto pr-2">
            <div className="no-print flex items-start gap-4 border-b border-line pb-4 mb-4">
              <Logo size={64} />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-ink">{db.company.name}</h2>
                <p className="text-sm text-mute">{db.company.address}, {db.company.city}</p>
                <p className="text-xs text-mute mt-1">ICE: {db.company.ice} | RC: {db.company.rc}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>
                  PDF / Imprimer
                </Button>
              </div>
            </div>

            {/* Header الطباعة - مصلح: حذفت hidden */}
            <div className="print-only mb-6">
              <div className="flex items-start justify-between border-b-2 border-pine-900 pb-4">
                <div className="flex items-center gap-3">
                  <Logo size={60} />
                  <div>
                    <h1 className="text-2xl font-bold text-pine-900">{db.company.name}</h1>
                    <p className="text-[11px] text-ink2">{db.company.legalName}</p>
                    <p className="text-[11px] text-ink2">ICE: {db.company.ice} | IF: {db.company.iff} | RC: {db.company.rc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-pine-900">BON DE RÉCEPTION</h2>
                  <p className="font-mono text-[14px] font-bold text-pine-700">{detail.number}</p>
                  <p className="text-[11px] text-ink2">{fmtDate(detail.date)}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-line bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute mb-1">Fournisseur</p>
                <p className="font-bold text-ink text-sm">{db.suppliers.find((s) => s.id === detail.supplierId)?.name}</p>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute mb-1">Site de réception</p>
                <p className="font-bold text-ink text-sm">{siteName(detail.siteId)}</p>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-ink2">Réf. BL:</span>
                <span className="font-mono font-bold text-ink">{detail.invoiceRef || "—"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-ink2">Statut:</span>
                <StatusBadge status={detail.status} />
              </div>
              {detail.poId && (
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-ink2">BC:</span>
                  <span className="font-mono font-bold text-pine-700">{db.purchaseOrders.find((p) => p.id === detail.poId)?.number}</span>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-[12px]">
                <thead className="bg-pine-900 text-pine-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-[0.1em] text-[10px]">Produit</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">Reçu</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">PU HT</th>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-[0.1em] text-[10px]">Lot / DLC</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l, i) => {
                    const p = db.products.find((x) => x.id === l.productId);
                    const isExpired = l.expiry && new Date(l.expiry) < new Date();
                    return (
                      <tr key={i} className="border-b border-line/70 last:border-0">
                        <td className="px-3 py-2 font-semibold text-ink text-xs">{p?.name}</td>
                        <td className="px-3 py-2 text-right">
                          <span className="tnum font-bold text-pine-700 text-xs">{fmtNum(l.receivedQty)}</span>
                        </td>
                        <td className="px-3 py-2 text-right tnum text-ink2 text-xs">{fmtMoney(l.unitCost, cur)}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            {l.lot && <span className="text-[9px] font-mono text-ink2">{l.lot}</span>}
                            {l.expiry && (
                              <span className={`text-[9px] font-semibold ${isExpired ? "text-bad font-bold" : "text-mute"}`}>
                                {fmtDate(l.expiry)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tnum font-bold text-ink text-xs">{fmtMoney(l.receivedQty * l.unitCost, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-paper">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-right font-bold text-ink2 text-xs">Total HT :</td>
                    <td className="px-3 py-2 text-right tnum font-display text-sm font-bold text-pine-900">
                      {fmtMoney(recTotal(detail), cur)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detail.notes && (
              <div className="mt-4 rounded-lg border border-line bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute mb-1">Notes</p>
                <p className="text-xs text-ink2">{detail.notes}</p>
              </div>
            )}

            {/* توقيعات الطباعة - مصلح: حذفت hidden */}
            <div className="print-only mt-8 pt-4 border-t border-line">
              <div className="grid grid-cols-3 gap-8 text-[11px] text-ink2">
                <div>
                  <p className="font-bold text-pine-900 mb-2">Réceptionné par:</p>
                  <div className="h-12 border-b border-line"></div>
                  <p className="mt-1">{db.users.find((u) => u.id === detail.userId)?.name}</p>
                </div>
                <div>
                  <p className="font-bold text-pine-900 mb-2">Validé par:</p>
                  <div className="h-12 border-b border-line"></div>
                  <p className="mt-1">Responsable stock</p>
                </div>
                <div>
                  <p className="font-bold text-pine-900 mb-2">Fournisseur:</p>
                  <div className="h-12 border-b border-line"></div>
                  <p className="mt-1">Signature & Cachet</p>
                </div>
              </div>
            </div>

            <div className="no-print mt-4 flex justify-end gap-2 pt-4 border-t border-line">
              {detail.status === "brouillon" && can("receptions.validate") && (
                <Button 
                  onClick={() => setConfirm({ 
                    title: "Valider la réception ?", 
                    msg: `La réception ${detail.number} augmentera le stock de ${siteName(detail.siteId)}.`, 
                    fn: () => act((d) => validateReception(d, detail.id, userId), `Réception ${detail.number} validée — stock augmenté.`) 
                  })}
                >
                  Valider
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetail(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

<Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   FACTURES FOURNISSEURS + JOURNAL DE CRÉDIT
   ============================================================ */
export function InvoicesPage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [tab, setTab] = useState("factures");
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [fSup, setFSup] = useState("");
  const [fSite, setFSite] = useState(siteId ?? "");
  const [fDate, setFDate] = useState(todayISO());
  const [fDue, setFDue] = useState(todayISO());
  const [fLines, setFLines] = useState<{ description: string; amount: number; vatRate: number }[]>([]);
  const [filterSup, setFilterSup] = useState("");
  const [filterSt, setFilterSt] = useState("");

  const rows = useMemo(
    () =>
      [...db.invoices]
        .filter((i) => (siteId ? i.siteId === siteId : allowedSites.some((s) => s.id === i.siteId)))
        .filter((i) => (!filterSup || i.supplierId === filterSup) && (!filterSt || invoiceStatus(db, i) === filterSt))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db, siteId, allowedSites, filterSup, filterSt]
  );

  const save = () => {
    const ok = act(
      (d) =>
        saveInvoice(d, {
          id: uid(),
          number: "",
          supplierId: fSup,
          siteId: fSite,
          date: fDate,
          dueDate: fDue,
          lines: fLines,
          userId,
          createdAt: nowISO(),
        }),
      "Facture fournisseur enregistrée."
    );
    if (ok) {
      setShowNew(false);
      setFLines([]);
    }
  };

  const cols: Col<Invoice>[] = [
    { key: "num", label: "N°", sortVal: (i) => i.number, render: (i) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{i.number}</span> },
    { key: "sup", label: "Fournisseur", sortVal: (i) => db.suppliers.find((s) => s.id === i.supplierId)?.name ?? "", render: (i) => <span className="font-semibold">{db.suppliers.find((s) => s.id === i.supplierId)?.name}</span> },
    { key: "site", label: "Site", render: (i) => <span>{siteName(i.siteId)}</span>, sortVal: (i) => i.siteId },
    { key: "date", label: "Échéance", sortVal: (i) => i.dueDate, render: (i) => <div><p className="text-mute">{fmtDate(i.date)}</p><p className="text-[10.5px] text-mute">échéance {fmtDate(i.dueDate)}</p></div> },
    { key: "ttc", label: "Total TTC", align: "right", sortVal: (i) => invoiceTotals(i).ttc, render: (i) => <span className="tnum font-bold">{fmtMoney(invoiceTotals(i).ttc, cur)}</span> },
    {
      key: "paid",
      label: "Payé / Reste",
      align: "right",
      render: (i) => {
        const paid = invoicePaid(db, i.id);
        const ttc = invoiceTotals(i).ttc;
        return (
          <div className="text-right">
            <p className="tnum font-semibold text-ok">{fmtMoney(paid, cur)}</p>
            <p className="tnum text-[11px] text-bad">reste {fmtMoney(Math.max(ttc - paid, 0), cur)}</p>
          </div>
        );
      },
    },
    { key: "st", label: "Statut", render: (i) => <StatusBadge status={invoiceStatus(db, i)} />, sortVal: (i) => invoiceStatus(db, i) },
    {
      key: "act",
      label: "Actions",
      render: (i) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(i)} icon={<Eye size={13} />}>Détail</Button>
          {invoiceStatus(db, i) !== "payee" && can("purchases.create") && (
            <Button size="sm" variant="outline" icon={<Wallet size={13} />} onClick={() => setPayFor(i)}>Régler</Button>
          )}
        </div>
      ),
    },
  ];

  const creditCols: Col<Invoice>[] = [
    { key: "sup", label: "Fournisseur", sortVal: (i) => db.suppliers.find((s) => s.id === i.supplierId)?.name ?? "", render: (i) => <span className="font-semibold">{db.suppliers.find((s) => s.id === i.supplierId)?.name}</span> },
    { key: "num", label: "Facture", render: (i) => <span className="font-mono text-[11px] font-bold text-ink2">{i.number}</span>, sortVal: (i) => i.number },
    { key: "date", label: "Date", render: (i) => <span className="text-mute">{fmtDate(i.date)}</span>, sortVal: (i) => i.date },
    { key: "due", label: "Échéance", render: (i) => <span className={invoiceStatus(db, i) === "echue" ? "font-bold text-bad" : "text-ink2"}>{fmtDate(i.dueDate)}</span>, sortVal: (i) => i.dueDate },
    { key: "ttc", label: "Total", align: "right", sortVal: (i) => invoiceTotals(i).ttc, render: (i) => <span className="tnum font-bold">{fmtMoney(invoiceTotals(i).ttc, cur)}</span> },
    { key: "paid", label: "Payé", align: "right", render: (i) => <span className="tnum text-ok">{fmtMoney(invoicePaid(db, i.id), cur)}</span> },
    { key: "rem", label: "Restant dû", align: "right", sortVal: (i) => invoiceTotals(i).ttc - invoicePaid(db, i.id), render: (i) => <span className="tnum font-bold text-bad">{fmtMoney(Math.max(invoiceTotals(i).ttc - invoicePaid(db, i.id), 0), cur)}</span> },
    { key: "st", label: "Statut", render: (i) => <StatusBadge status={invoiceStatus(db, i)} />, sortVal: (i) => invoiceStatus(db, i) },
  ];

  return (
    <div>
      <PageHead title="Factures fournisseurs" sub="La facturation est séparée de la réception marchandises : une facture ne modifie jamais le stock.">
        {can("purchases.create") && <Button icon={<Plus size={15} />} onClick={() => { setFSup(db.suppliers[0]?.id ?? ""); setFSite(siteId ?? allowedSites[0]?.id ?? ""); setShowNew(true); }}>Nouvelle facture</Button>}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Tabs
          tabs={[
            { key: "factures", label: "Factures", count: db.invoices.length },
            { key: "credit", label: "Journal de crédit", count: db.invoices.filter((i) => invoiceStatus(db, i) !== "payee").length },
          ]}
          active={tab}
          onChange={setTab}
        />
        <Select value={filterSup} onChange={(e) => setFilterSup(e.target.value)} className="w-52">
          <option value="">Tous les fournisseurs</option>
          {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={filterSt} onChange={(e) => setFilterSt(e.target.value)} className="w-44">
          <option value="">Tous les statuts</option>
          <option value="impayee">Impayée</option>
          <option value="partielle">Partiellement payée</option>
          <option value="payee">Payée</option>
          <option value="echue">Échue</option>
        </Select>
      </div>

      <DataTable cols={tab === "factures" ? cols : creditCols} rows={rows} rowKey={(i) => i.id} pageSize={10}
        empty={<EmptyState icon={<FileText size={24} />} title="Aucune facture" sub="Enregistrez les factures de vos fournisseurs pour suivre le crédit et les échéances." />}
      />

      {/* Modal Nouvelle Facture */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouvelle facture fournisseur" width="max-w-3xl">
        <div className="space-y-4 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Fournisseur" className="sm:col-span-2">
              <Select value={fSup} onChange={(e) => setFSup(e.target.value)}>
                {db.suppliers.filter((s) => s.status === "actif").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Site concerné">
              <Select value={fSite} onChange={(e) => setFSite(e.target.value)}>
                {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
              </Select>
            </Field>
            <Field label="Échéance">
              <Input type="date" value={fDue} onChange={(e) => setFDue(e.target.value)} />
            </Field>
          </div>
          
          <div className="rounded-md border border-line">
            <div className="max-h-[250px] overflow-y-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-left text-[10px] font-bold uppercase tracking-[0.1em] text-mute sticky top-0">
                    <th className="px-2 py-2">Libellé</th>
                    <th className="w-32 px-2 py-2 text-right">Montant HT</th>
                    <th className="w-24 px-2 py-2 text-right">TVA %</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {fLines.map((l, i) => (
                    <tr key={i} className="border-b border-line/70 last:border-0">
                      <td className="px-1.5 py-1.5"><Input value={l.description} onChange={(e) => setFLines(fLines.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="Livraison marchandises…" className="h-8 text-xs" /></td>
                      <td className="px-1.5 py-1.5"><Input type="number" min={0} step="0.01" value={l.amount || ""} onChange={(e) => setFLines(fLines.map((x, j) => (j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x)))} className="h-8 text-xs text-right tnum" /></td>
                      <td className="px-1.5 py-1.5"><Input type="number" min={0} value={l.vatRate} onChange={(e) => setFLines(fLines.map((x, j) => (j === i ? { ...x, vatRate: parseFloat(e.target.value) || 0 } : x)))} className="h-8 text-xs text-right tnum" /></td>
                      <td className="pr-1.5 text-center"><Button variant="ghost" size="sm" onClick={() => setFLines(fLines.filter((_, j) => j !== i))} icon={<X size={12} />} title="Retirer" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-2.5 py-2 border-t border-line">
              <Button variant="outline" size="sm" icon={<Plus size={12} />} onClick={() => setFLines([...fLines, { description: "", amount: 0, vatRate: db.company.defaultVat }])}>Ajouter</Button>
              {(() => {
                const t = invoiceTotals({ lines: fLines });
                return (
                  <p className="text-xs font-semibold text-ink2">
                    HT {fmtMoney(t.ht, cur)} · TVA {fmtMoney(t.vat, cur)} · <span className="font-display text-sm font-bold text-ink">TTC {fmtMoney(t.ttc, cur)}</span>
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
          <Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button>
          <Button disabled={!fSup || !fLines.length || fLines.some((l) => !l.description.trim() || l.amount <= 0)} onClick={save}>Enregistrer</Button>
        </div>
      </Modal>

      {/* Modal Détail Facture - مصلح */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title="" sub="" width="max-w-3xl">
        {detail && (
          <div className="max-h-[calc(90vh-100px)] overflow-y-auto pr-2">
            <div className="no-print flex items-start gap-4 border-b border-line pb-4 mb-4">
              <Logo size={64} />
              <div className="flex-1">
                <h2 className="text-xl font-bold text-ink">{db.company.name}</h2>
                <p className="text-sm text-mute">{db.company.address}, {db.company.city}</p>
                <p className="text-xs text-mute mt-1">ICE: {db.company.ice} | RC: {db.company.rc}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Printer size={13} />} onClick={() => window.print()}>
                  PDF / Imprimer
                </Button>
              </div>
            </div>

            {/* Header الطباعة - مصلح: حذفت hidden */}
            <div className="print-only mb-6">
              <div className="flex items-start justify-between border-b-2 border-pine-900 pb-4">
                <div className="flex items-center gap-3">
                  <Logo size={60} />
                  <div>
                    <h1 className="text-2xl font-bold text-pine-900">{db.company.name}</h1>
                    <p className="text-[11px] text-ink2">{db.company.legalName}</p>
                    <p className="text-[11px] text-ink2">ICE: {db.company.ice} | IF: {db.company.iff} | RC: {db.company.rc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-pine-900">FACTURE FOURNISSEUR</h2>
                  <p className="font-mono text-[14px] font-bold text-pine-700">{detail.number}</p>
                  <p className="text-[11px] text-ink2">{fmtDate(detail.date)}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-line bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute mb-1">Fournisseur</p>
                <p className="font-bold text-ink text-sm">{db.suppliers.find((s) => s.id === detail.supplierId)?.name}</p>
              </div>
              <div className="rounded-lg border border-line bg-paper p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute mb-1">Site concerné</p>
                <p className="font-bold text-ink text-sm">{siteName(detail.siteId)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-[12px]">
                <thead className="bg-pine-900 text-pine-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold uppercase tracking-[0.1em] text-[10px]">Libellé</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">Montant HT</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">TVA %</th>
                    <th className="px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-[10px]">Total TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.lines.map((l, i) => {
                    const ttc = l.amount + (l.amount * l.vatRate) / 100;
                    return (
                      <tr key={i} className="border-b border-line/70 last:border-0">
                        <td className="px-3 py-2 font-semibold text-ink text-xs">{l.description}</td>
                        <td className="px-3 py-2 text-right tnum text-ink2 text-xs">{fmtMoney(l.amount, cur)}</td>
                        <td className="px-3 py-2 text-right tnum text-ink2 text-xs">{l.vatRate} %</td>
                        <td className="px-3 py-2 text-right tnum font-bold text-ink text-xs">{fmtMoney(ttc, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-paper">
                  {(() => {
                    const t = invoiceTotals(detail);
                    const paid = invoicePaid(db, detail.id);
                    return (
                      <>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-ink2 text-xs">Sous-total HT :</td>
                          <td className="px-3 py-2 text-right tnum font-bold text-ink text-xs">{fmtMoney(t.ht, cur)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-ink2 text-xs">TVA :</td>
                          <td className="px-3 py-2 text-right tnum font-bold text-ink text-xs">{fmtMoney(t.vat, cur)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-bold text-ink2 text-xs">Total TTC :</td>
                          <td className="px-3 py-2 text-right tnum font-display text-sm font-bold text-pine-900">{fmtMoney(t.ttc, cur)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-semibold text-ok text-xs">Déjà payé :</td>
                          <td className="px-3 py-2 text-right tnum font-bold text-ok text-xs">{fmtMoney(paid, cur)}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-bold text-bad text-xs">Reste à payer :</td>
                          <td className="px-3 py-2 text-right tnum font-display text-sm font-bold text-bad">{fmtMoney(Math.max(t.ttc - paid, 0), cur)}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>
            </div>

            <div className="no-print mt-4 flex justify-end gap-2 pt-4 border-t border-line">
              {invoiceStatus(db, detail) !== "payee" && can("purchases.create") && (
                <Button variant="outline" icon={<Wallet size={13} />} onClick={() => { setDetail(null); setPayFor(detail); }}>
                  Régler cette facture
                </Button>
              )}
              <Button variant="outline" onClick={() => setDetail(null)}>
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <PaymentModal invoice={payFor} onClose={() => setPayFor(null)} />
    </div>
  );
}

function PaymentModal({ invoice, onClose }: { invoice: Invoice | null; onClose: () => void }) {
  const { db, act } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [method, setMethod] = useState<PayMethod>("virement");
  const [notes, setNotes] = useState("");

  const remaining = invoice ? Math.max(invoiceTotals(invoice).ttc - invoicePaid(db, invoice.id), 0) : 0;

  const save = () => {
    const ok = act(
      (d) =>
        savePayment(d, {
          id: uid(),
          number: "",
          supplierId: invoice?.supplierId ?? "",
          invoiceId: invoice?.id ?? null,
          date,
          amount: parseFloat(amount) || 0,
          method,
          notes,
          userId,
          createdAt: nowISO(),
        }),
      `Règlement de ${amount} enregistré — solde fournisseur mis à jour.`
    );
    if (ok) {
      onClose();
      setAmount("");
      setNotes("");
    }
  };

  return (
    <Modal open={!!invoice} onClose={onClose} title={`Règlement — ${invoice?.number}`} sub={`Reste dû : ${fmtMoney(remaining, cur)}`} width="max-w-md">
      <div className="space-y-3 max-h-[calc(90vh-200px)] overflow-y-auto pr-2">
        <div className="flex gap-2">
          {[remaining, Math.round(remaining / 2 * 100) / 100].filter((v) => v > 0).map((v, i) => (
            <Button key={i} variant="outline" size="sm" onClick={() => setAmount(String(v))}>
              {i === 0 ? "Totalité" : "Acompte 50 %"} · {fmtMoney(v, cur)}
            </Button>
          ))}
        </div>
        <Field label={`Montant (${cur})`}>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Mode de paiement">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              <option value="virement">Virement bancaire</option>
              <option value="especes">Espèces</option>
              <option value="cheque">Chèque</option>
              <option value="carte">Carte</option>
              <option value="autre">Autre</option>
            </Select>
          </Field>
        </div>
        <Field label="Référence / notes">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="N° de virement, chèque…" />
        </Field>
      </div>
      
      <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-line">
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button disabled={!amount || parseFloat(amount) <= 0} onClick={save}>Enregistrer le règlement</Button>
      </div>
    </Modal>
  );
}

/* ============================================================
   RÈGLEMENTS
   ============================================================ */
export function PaymentsPage() {
  const { db, siteId, allowedSites } = useApp();
  const cur = db.company.currency;
  const [detail, setDetail] = useState<Payment | null>(null);

  const rows = useMemo(
    () =>
      [...db.payments]
        .filter((p) => {
          if (!siteId) return true;
          const inv = db.invoices.find((i) => i.id === p.invoiceId);
          return !inv || inv.siteId === siteId;
        })
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.payments, db.invoices, siteId]
  );

  void allowedSites;

  const cols: Col<Payment>[] = [
    { key: "num", label: "N°", sortVal: (p) => p.number, render: (p) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{p.number}</span> },
    { key: "date", label: "Date", sortVal: (p) => p.date, render: (p) => <span className="text-mute">{fmtDate(p.date)}</span> },
    { key: "sup", label: "Fournisseur", sortVal: (p) => db.suppliers.find((s) => s.id === p.supplierId)?.name ?? "", render: (p) => <span className="font-semibold">{db.suppliers.find((s) => s.id === p.supplierId)?.name}</span> },
    {
      key: "inv",
      label: "Facture liée",
      render: (p) => (p.invoiceId ? <span className="font-mono text-[11px] text-ink2">{db.invoices.find((i) => i.id === p.invoiceId)?.number}</span> : <Badge tone="slate">Acompte</Badge>),
    },
    { key: "method", label: "Mode", render: (p) => <Badge tone="info">{payMethodLabel(p.method)}</Badge>, sortVal: (p) => p.method },
    { key: "amount", label: "Montant", align: "right", sortVal: (p) => p.amount, render: (p) => <span className="tnum font-bold text-ok">{fmtMoney(p.amount, cur)}</span> },
    { key: "user", label: "Par", render: (p) => <span className="text-[11.5px] text-mute">{db.users.find((u) => u.id === p.userId)?.name}</span> },
    { key: "act", label: "", render: (p) => <Button size="sm" variant="ghost" onClick={() => setDetail(p)} icon={<Eye size={13} />}>Détail</Button> },
  ];

  const total = rows.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <PageHead title="Règlements fournisseurs" sub={`Journal des paiements — total affiché : ${fmtMoney(total, cur)}. Les règlements se saisissent depuis les factures (bouton « Régler »).`} />
      <DataTable cols={cols} rows={rows} rowKey={(p) => p.id} pageSize={12}
        footer={`${rows.length} règlement(s) · total ${fmtMoney(total, cur)}`}
        empty={<EmptyState icon={<Wallet size={24} />} title="Aucun règlement" sub="Depuis la page Factures, utilisez « Régler » pour enregistrer un paiement total ou partiel." />}
      />
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Règlement ${detail?.number}`} width="max-w-md">
        {detail && (
          <div className="space-y-2 text-[13px] max-h-[calc(90vh-150px)] overflow-y-auto pr-2">
            <p><span className="text-mute">Fournisseur :</span> <strong>{db.suppliers.find((s) => s.id === detail.supplierId)?.name}</strong></p>
            <p><span className="text-mute">Montant :</span> <strong className="tnum">{fmtMoney(detail.amount, cur)}</strong></p>
            <p><span className="text-mute">Mode :</span> {payMethodLabel(detail.method)}</p>
            <p><span className="text-mute">Date :</span> {fmtDate(detail.date)}</p>
            {detail.notes && <p className="rounded-md bg-paper px-3 py-2 text-ink2">{detail.notes}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

export { supplierBalance };