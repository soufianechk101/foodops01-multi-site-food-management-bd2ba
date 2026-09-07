import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  ClipboardCheck,
  Eye,
  PackageCheck,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
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
  Textarea,
  cn,
  type Col,
  type EditLine,
} from "../components/ui";
import { SitePrompt } from "./StockPages";
import {
  approveTransfer,
  cancelInventory,
  cancelTransfer,
  cancelWaste,
  computeStocks,
  createInventory,
  dispatchTransfer,
  entryOf,
  receiveTransfer,
  saveTransfer,
  saveWaste,
  setInventoryActual,
  validateInventory,
  validateWaste,
} from "../lib/engine";
import type { InventoryDoc, Transfer, Waste } from "../types";
import { fmtDate, fmtMoney, fmtNum, nowISO, todayISO, uid, WASTE_REASONS } from "../lib/util";

/* ============================================================
   TRANSFERTS INTER-SITES
   ============================================================ */
export function TransfersPage() {
  const { db, siteId, allowedSites, act, can } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  // formulaire
  const [fromSite, setFromSite] = useState(siteId ?? allowedSites[0]?.id ?? "");
  const [toSite, setToSite] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);

  const rows = useMemo(
    () =>
      [...db.transfers]
        .filter((t) => (siteId ? t.fromSiteId === siteId || t.toSiteId === siteId : allowedSites.some((s) => s.id === t.fromSiteId || s.id === t.toSiteId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.transfers, siteId, allowedSites]
  );

  const siteCode = (id: string) => db.sites.find((s) => s.id === id)?.code ?? "?";
  const siteNm = (id: string) => db.sites.find((s) => s.id === id)?.name ?? "?";

  const create = () => {
    const ok = act(
      (d) =>
        saveTransfer(d, {
          id: uid(),
          number: "",
          fromSiteId: fromSite,
          toSiteId: toSite,
          date: todayISO(),
          status: "brouillon",
          notes,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty, unitCost: l.unitCost })),
          userId,
          createdAt: nowISO(),
        }),
      "Transfert créé en brouillon — aucun impact sur le stock avant expédition."
    );
    if (ok) {
      setShowNew(false);
      setLines([]);
      setNotes("");
      setToSite("");
    }
  };

  const cols: Col<Transfer>[] = [
    { key: "num", label: "N°", sortVal: (t) => t.number, render: (t) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{t.number}</span> },
    { key: "date", label: "Date", sortVal: (t) => t.date, render: (t) => <span className="text-mute">{fmtDate(t.date)}</span> },
    {
      key: "route",
      label: "Trajet",
      render: (t) => (
        <span className="flex items-center gap-2 font-semibold">
          <span className="tnum rounded bg-pine-900 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-pine-100">{siteCode(t.fromSiteId)}</span>
          <ArrowRight size={13} className="text-copper-600" />
          <span className="tnum rounded bg-copper-500 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-white">{siteCode(t.toSiteId)}</span>
          <span className="hidden text-[11.5px] font-normal text-mute xl:inline">{siteNm(t.toSiteId)}</span>
        </span>
      ),
    },
    { key: "lines", label: "Lignes", align: "center", render: (t) => <span className="tnum">{t.lines.length}</span> },
    {
      key: "qty",
      label: "Qté totale",
      align: "right",
      sortVal: (t) => t.lines.reduce((s, l) => s + l.qty, 0),
      render: (t) => <span className="tnum font-bold">{fmtNum(t.lines.reduce((s, l) => s + l.qty, 0))}</span>,
    },
    {
      key: "val",
      label: "Valeur",
      align: "right",
      sortVal: (t) => t.lines.reduce((s, l) => s + l.qty * l.unitCost, 0),
      render: (t) => <span className="tnum text-ink2">{fmtMoney(t.lines.reduce((s, l) => s + l.qty * l.unitCost, 0), cur)}</span>,
    },
    { key: "st", label: "Statut", render: (t) => <StatusBadge status={t.status} />, sortVal: (t) => t.status },
    {
      key: "act",
      label: "Actions",
      render: (t) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(t)} icon={<Eye size={13} />}>Détail</Button>
          {t.status === "brouillon" && can("stock.transfer") && (
            <>
              <Button size="sm" variant="outline" onClick={() => act((d) => approveTransfer(d, t.id, userId), `Transfert ${t.number} approuvé.`)}>Approuver</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler le transfert ?", msg: `Le transfert ${t.number} sera annulé. Aucun mouvement de stock n'a encore été généré.`, fn: () => act((d) => cancelTransfer(d, t.id, userId), "Transfert annulé.") })} icon={<X size={13} />}>Annuler</Button>
            </>
          )}
          {t.status === "approuve" && can("stock.transfer") && (
            <>
              <Button size="sm" icon={<Send size={13} />} onClick={() => setConfirm({ title: "Expédier le transfert ?", msg: `Le stock quittera immédiatement ${siteNm(t.fromSiteId)} (mouvements TRANSFER_OUT). La destination ne sera approvisionnée qu'à la réception.`, fn: () => act((d) => dispatchTransfer(d, t.id, userId), `Transfert ${t.number} expédié — stock source diminué.`) })}>Expédier</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler le transfert ?", msg: `Le transfert ${t.number} approuvé sera annulé sans impact sur le stock.`, fn: () => act((d) => cancelTransfer(d, t.id, userId), "Transfert annulé.") })} icon={<X size={13} />}>Annuler</Button>
            </>
          )}
          {t.status === "expedie" && can("stock.transfer") && (
            <Button size="sm" variant="copper" icon={<PackageCheck size={13} />} onClick={() => setConfirm({ title: "Réceptionner le transfert ?", msg: `Les quantités entreront dans le stock de ${siteNm(t.toSiteId)} (mouvements TRANSFER_IN). Cette opération n'est possible qu'une seule fois.`, fn: () => act((d) => receiveTransfer(d, t.id, userId), `Transfert ${t.number} réceptionné — stock destination augmenté.`) })}>Réceptionner</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Transferts inter-sites" sub="Le stock sort du site source à l'expédition (TRANSFER_OUT) et entre à destination à la réception (TRANSFER_IN).">
        {can("stock.transfer") && (
          <Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Nouveau transfert</Button>
        )}
      </PageHead>

      <DataTable cols={cols} rows={rows} rowKey={(t) => t.id} pageSize={10}
        empty={<EmptyState title="Aucun transfert" sub="Organisez le réapprovisionnement entre vos sites : entrepôt central vers restaurants, cuisine centrale, etc." action={can("stock.transfer") ? <Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Créer un transfert</Button> : undefined} />}
      />

      {/* création */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouveau transfert" sub="Brouillon — le stock ne bouge qu'à l'expédition puis à la réception." width="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowNew(false)}>Fermer</Button>
            <Button disabled={!fromSite || !toSite || fromSite === toSite || !lines.length || lines.some((l) => !l.productId || l.qty <= 0)} onClick={create}>Créer le brouillon</Button>
          </>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Site source">
            <Select value={fromSite} onChange={(e) => setFromSite(e.target.value)}>
              {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Site destination">
            <Select value={toSite} onChange={(e) => setToSite(e.target.value)}>
              <option value="">— Choisir —</option>
              {allowedSites.filter((s) => s.id !== fromSite).map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
        </div>
        {fromSite === toSite && toSite && (
          <p className="mb-3 rounded-md border border-bad/25 bg-badbg px-3 py-2 text-[12.5px] font-semibold text-bad">
            Le site source et le site destination doivent être différents.
          </p>
        )}
        <LineEditor rows={lines} onChange={setLines} products={db.products.filter((p) => p.status === "actif")} units={db.units} showCost={false} qtyLabel="Qté à transférer" />
        <Field label="Notes" className="mt-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motif du transfert…" />
        </Field>
      </Modal>

      {/* détail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Transfert ${detail?.number}`} sub={detail ? `${siteNm(detail.fromSiteId)} → ${siteNm(detail.toSiteId)} · ${fmtDate(detail.date)}` : ""} width="max-w-2xl">
        {detail && (
          <>
            <div className="mb-3 flex items-center gap-2">
              <StatusBadge status={detail.status} />
              <Badge tone="slate">{db.users.find((u) => u.id === detail.userId)?.name}</Badge>
            </div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                  <th className="py-2">Produit</th>
                  <th className="py-2 text-right">Quantité</th>
                  <th className="py-2 text-right">Coût unitaire</th>
                  <th className="py-2 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => {
                  const p = db.products.find((x) => x.id === l.productId);
                  return (
                    <tr key={i} className="border-b border-line/70 last:border-0">
                      <td className="py-2 font-semibold">{p?.name}</td>
                      <td className="tnum py-2 text-right font-bold">{fmtNum(l.qty)} {db.units.find((u) => u.id === p?.unitId)?.code}</td>
                      <td className="tnum py-2 text-right text-ink2">{fmtMoney(l.unitCost, cur)}</td>
                      <td className="tnum py-2 text-right font-bold">{fmtMoney(l.qty * l.unitCost, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.notes && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink2">{detail.notes}</p>}
          </>
        )}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   INVENTAIRES
   ============================================================ */
export function InventoriesPage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [showCreate, setShowCreate] = useState(false);
  const [invSite, setInvSite] = useState(siteId ?? "");
  const [invCat, setInvCat] = useState("");
  const [saisieId, setSaisieId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);
  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [addPid, setAddPid] = useState("");
  const [detailView, setDetailView] = useState<InventoryDoc | null>(null);

  const saisieLive = saisieId ? db.inventories.find((i) => i.id === saisieId) ?? null : null;
  const detailLive = detailView ? db.inventories.find((i) => i.id === detailView.id) ?? detailView : null;

  const rows = useMemo(
    () =>
      [...db.inventories]
        .filter((i) => (siteId ? i.siteId === siteId : allowedSites.some((s) => s.id === i.siteId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.inventories, siteId, allowedSites]
  );

  const varianceOf = (inv: InventoryDoc) =>
    inv.lines.reduce((s, l) => s + (l.actualQty === null ? 0 : (l.actualQty - l.theoreticalQty) * l.unitCost), 0);

  const openSaisie = (inv: InventoryDoc) => {
    setActuals(Object.fromEntries(inv.lines.map((l) => [l.productId, l.actualQty === null ? "" : String(l.actualQty)])));
    setAddPid("");
    setSaisieId(inv.id);
  };

  const createAndOpen = () => {
    let newId: string | null = null;
    const ok = act(
      (d) => {
        const inv = createInventory(d, { siteId: invSite, date: todayISO(), userId, categoryId: invCat || null });
        newId = inv.id;
      },
      "Inventaire créé — quantités théoriques gelées, prêtes à être comptées."
    );
    if (ok && newId) {
      setShowCreate(false);
      setInvCat("");
      const created = db.inventories.find((x) => x.id === newId) ?? null; // fallback, will be updated via re-render
      // open saisie after state update — use timeout to let db refresh, or directly set id
      setSaisieId(newId);
      // init actuals empty
      setActuals({});
      setAddPid("");
    }
  };

  const saveActual = (inv: InventoryDoc, productId: string, raw: string) => {
    setActuals((a) => ({ ...a, [productId]: raw }));
    act((d) => setInventoryActual(d, inv.id, productId, raw === "" ? null : Math.max(0, parseFloat(raw) || 0), userId));
  };

  const addProduct = () => {
    if (!saisieLive || !addPid) return;
    const ok = act((d) => {
      const inv = d.inventories.find((x) => x.id === saisieLive.id);
      if (!inv) throw new Error("Inventaire introuvable.");
      if (inv.status !== "en_cours") throw new Error("Inventaire clos.");
      if (inv.lines.some((l) => l.productId === addPid)) throw new Error("Produit déjà dans l'inventaire.");
      const stocks = computeStocks(d, { siteId: inv.siteId });
      const e = entryOf(stocks, inv.siteId, addPid);
      inv.lines.push({ productId: addPid, theoreticalQty: Math.round(e.qty * 1000) / 1000, actualQty: null, unitCost: Math.round(e.avgCost * 100) / 100 });
    }, "Produit ajouté à l'inventaire.");
    if (ok) setAddPid("");
  };

  const cols: Col<InventoryDoc>[] = [
    { key: "num", label: "N°", sortVal: (i) => i.number, render: (i) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{i.number}</span> },
    { key: "date", label: "Date", sortVal: (i) => i.date, render: (i) => <span className="text-mute">{fmtDate(i.date)}</span> },
    { key: "site", label: "Site", sortVal: (i) => i.siteId, render: (i) => <span className="font-semibold">{siteName(i.siteId)}</span> },
    { key: "lines", label: "Produits", align: "center", render: (i) => <span className="tnum">{i.lines.length}</span> },
    {
      key: "counted",
      label: "Comptés",
      align: "center",
      render: (i) => {
        const c = i.lines.filter((l) => l.actualQty !== null).length;
        return <Badge tone={c === i.lines.length ? "ok" : "warn"}>{c} / {i.lines.length}</Badge>;
      },
    },
    {
      key: "var",
      label: "Écart (valeur)",
      align: "right",
      sortVal: varianceOf,
      render: (i) => {
        const v = varianceOf(i);
        if (i.status === "en_cours") return <span className="text-mute">—</span>;
        return <span className={cn("tnum font-bold", Math.abs(v) < 0.01 ? "text-ok" : v < 0 ? "text-bad" : "text-copper-600")}>{v > 0 ? "+" : ""}{fmtMoney(v, cur)}</span>;
      },
    },
    { key: "st", label: "Statut", render: (i) => <StatusBadge status={i.status} />, sortVal: (i) => i.status },
    {
      key: "act",
      label: "Actions",
      render: (i) => (
        <div className="flex items-center justify-end gap-1.5">
          {i.status === "en_cours" ? (
            <>
              <Button size="sm" onClick={() => openSaisie(i)} icon={<ClipboardCheck size={13} />}>Saisir</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Supprimer l'inventaire ?", msg: `L'inventaire ${i.number} sera annulé sans ajustement de stock.`, fn: () => act((d) => cancelInventory(d, i.id, userId), "Inventaire annulé.") })} icon={<Trash2 size={13} />}>Supprimer</Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setDetailView(i)} icon={<Eye size={13} />}>Voir</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Inventaires" sub="Comptage physique : théorique gelé vs réel compté, écarts transformés en ajustements de stock.">
        {can("inventory.create") && <Button icon={<Plus size={15} />} onClick={() => { setInvSite(siteId ?? allowedSites[0]?.id ?? ""); setShowCreate(true); }}>Nouvel inventaire</Button>}
      </PageHead>

      <DataTable cols={cols} rows={rows} rowKey={(i) => i.id} pageSize={10}
        empty={<EmptyState title="Aucun inventaire" sub="Créez un inventaire pour comparer le stock théorique au stock physique et régulariser les écarts." />}
      />

      {/* Modal création — choix site/périmètre puis ouverture page saisie */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvel inventaire" sub="Les quantités théoriques seront gelées à la création puis saisies en page dédiée." width="max-w-md"
        footer={<><Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button><Button disabled={!invSite} onClick={createAndOpen}>Créer et saisir</Button></>}
      >
        <div className="space-y-3">
          <Field label="Site">
            <Select value={invSite} onChange={(e) => setInvSite(e.target.value)}>
              {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Périmètre (optionnel)">
            <Select value={invCat} onChange={(e) => setInvCat(e.target.value)}>
              <option value="">Tous les produits</option>
              {db.categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      {/* Page dédiée saisie — plein écran comme Sortie de jour — portal hors anim-fade-up pour fixed viewport correct */}
      {saisieLive && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-40 flex flex-col bg-paper">
          <div className="flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-card px-4">
            <Button variant="outline" size="sm" onClick={() => setSaisieId(null)}>← Retour</Button>
            <div className="min-w-0">
              <p className="font-display text-[15px] font-bold text-ink truncate">Inventaire {saisieLive.number} — {siteName(saisieLive.siteId)}</p>
              <p className="text-[11.5px] text-mute">{fmtDate(saisieLive.date)} · <StatusBadge status={saisieLive.status} /> {saisieLive.status === "en_cours" ? "— saisissez les quantités comptées" : "— lecture seule (validé/annulé)"}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-6xl rounded-xl border border-line bg-card p-6 shadow-sm">
              <div className="overflow-x-auto rounded-md border border-line">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="border-b border-line bg-paper/70 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                      <th className="px-3 py-2">Produit</th>
                      <th className="px-2 py-2 text-right">Théorique</th>
                      <th className="px-2 py-2 text-right">Compté</th>
                      <th className="px-2 py-2 text-right">Écart</th>
                      <th className="px-2 py-2 text-right">Écart %</th>
                      <th className="px-3 py-2 text-right">Valeur écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {saisieLive.lines.map((l) => {
                      const p = db.products.find((x) => x.id === l.productId);
                      const actual = l.actualQty;
                      const variance = actual === null ? null : Math.round((actual - l.theoreticalQty) * 1000) / 1000;
                      const pct = actual === null || l.theoreticalQty === 0 ? null : ((actual - l.theoreticalQty) / l.theoreticalQty) * 100;
                      const isEnCours = saisieLive.status === "en_cours";
                      return (
                        <tr key={l.productId} className={cn("border-b border-line/70 last:border-0", variance !== null && Math.abs(variance) > 0.001 && "bg-warnbg/40")}>
                          <td className="px-3 py-2">
                            <p className="font-semibold">{p?.name}</p>
                            <p className="text-[10.5px] text-mute">{db.units.find((u) => u.id === p?.unitId)?.code} · PU {fmtMoney(l.unitCost, cur)}</p>
                          </td>
                          <td className="tnum px-2 py-2 text-right font-bold">{fmtNum(l.theoreticalQty)}</td>
                          <td className="px-2 py-2 text-right">
                            {isEnCours && can("inventory.create") ? (
                              <Input type="number" min={0} step="0.01" placeholder="—" value={actuals[l.productId] ?? ""} onChange={(e) => saveActual(saisieLive, l.productId, e.target.value)} className="ml-auto h-8 w-22 text-right tnum" />
                            ) : (
                              <span className="tnum font-bold">{actual === null ? "—" : fmtNum(actual)}</span>
                            )}
                          </td>
                          <td className={cn("tnum px-2 py-2 text-right font-bold", variance === null ? "text-mute" : variance < 0 ? "text-bad" : variance > 0 ? "text-copper-600" : "text-ok")}>
                            {variance === null ? "—" : (variance > 0 ? "+" : "") + fmtNum(variance)}
                          </td>
                          <td className="tnum px-2 py-2 text-right text-ink2">{pct === null ? "—" : fmtNum(pct, 1) + " %"}</td>
                          <td className={cn("tnum px-3 py-2 text-right font-bold", variance === null ? "text-mute" : variance * l.unitCost < 0 ? "text-bad" : "text-ink")}>
                            {variance === null ? "—" : fmtMoney(variance * l.unitCost, cur)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {saisieLive.status === "en_cours" && can("inventory.create") && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-line2 bg-paper/60 px-3 py-3">
                  <span className="text-[12.5px] font-bold text-ink">Ajouter un produit :</span>
                  <Select value={addPid} onChange={(e) => setAddPid(e.target.value)} className="min-w-64">
                    <option value="">— Choisir —</option>
                    {db.products.filter((p) => p.status === "actif" && !saisieLive.lines.some((l) => l.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
                  </Select>
                  <Button size="sm" variant="outline" icon={<Plus size={13} />} disabled={!addPid} onClick={addProduct}>Ajouter</Button>
                  <span className="text-[11.5px] text-mute">Théorique calculé automatiquement.</span>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                <p className="text-[12px] text-mute">
                  Écart total : <strong className={cn("tnum", varianceOf(saisieLive) < 0 ? "text-bad" : "text-ink")}>{fmtMoney(varianceOf(saisieLive), cur)}</strong>
                  {saisieLive.status === "valide" && " — comptabilisé via ajustements d'inventaire."}
                  {saisieLive.status === "en_cours" && ` · ${saisieLive.lines.filter((l) => l.actualQty !== null).length} / ${saisieLive.lines.length} comptés`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-card px-4 py-3">
            <Button variant="outline" onClick={() => setSaisieId(null)}>Fermer</Button>
            <div className="flex items-center gap-2">
              {saisieLive.status === "en_cours" && (
                <Button variant="ghost" onClick={() => setConfirm({ title: "Supprimer l'inventaire ?", msg: `L'inventaire ${saisieLive.number} sera annulé sans ajustement.`, fn: () => { act((d) => cancelInventory(d, saisieLive.id, userId), "Inventaire annulé."); setSaisieId(null); } })} icon={<Trash2 size={13} />}>Supprimer</Button>
              )}
              {saisieLive.status === "en_cours" && can("inventory.validate") && (
                <Button onClick={() => setConfirm({ title: "Valider l'inventaire ?", msg: "Les écarts saisis généreront des ajustements de stock définitifs (INVENTORY_ADJUSTMENT).", fn: () => { act((d) => validateInventory(d, saisieLive.id, userId), `Inventaire ${saisieLive.number} validé.`); setSaisieId(null); } })}>Valider l'inventaire</Button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Lecture seule pour inventaires validés/annulés — si ouvert via Voir depuis la liste */}
      <Modal open={!!detailLive} onClose={() => setDetailView(null)} title={`Inventaire ${detailLive?.number}`} sub={detailLive ? `${siteName(detailLive.siteId)} · ${fmtDate(detailLive.date)}` : ""} width="max-w-4xl">
        {detailLive && (
          <>
            <div className="mb-3 flex items-center gap-2"><StatusBadge status={detailLive.status} /></div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                    <th className="px-3 py-2">Produit</th>
                    <th className="px-2 py-2 text-right">Théorique</th>
                    <th className="px-2 py-2 text-right">Compté</th>
                    <th className="px-2 py-2 text-right">Écart</th>
                    <th className="px-3 py-2 text-right">Valeur écart</th>
                  </tr>
                </thead>
                <tbody>
                  {detailLive.lines.map((l) => {
                    const p = db.products.find((x) => x.id === l.productId);
                    const variance = l.actualQty === null ? null : Math.round((l.actualQty - l.theoreticalQty) * 1000) / 1000;
                    return (
                      <tr key={l.productId} className="border-b border-line/70 last:border-0">
                        <td className="px-3 py-2 font-semibold">{p?.name}</td>
                        <td className="tnum px-2 py-2 text-right">{fmtNum(l.theoreticalQty)}</td>
                        <td className="tnum px-2 py-2 text-right font-bold">{l.actualQty === null ? "—" : fmtNum(l.actualQty)}</td>
                        <td className={cn("tnum px-2 py-2 text-right font-bold", variance === null ? "text-mute" : variance < 0 ? "text-bad" : "text-ok")}>{variance === null ? "—" : fmtNum(variance)}</td>
                        <td className="tnum px-3 py-2 text-right font-bold">{variance === null ? "—" : fmtMoney(variance * l.unitCost, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-mute">Écart total : <strong className={cn("tnum", varianceOf(detailLive) < 0 ? "text-bad" : "text-ink")}>{fmtMoney(varianceOf(detailLive), cur)}</strong>{detailLive.status === "valide" && " — comptabilisé."}</p>
          </>
        )}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   PERTES & DÉCHETS
   ============================================================ */
export function WastePage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Waste | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);
  const [wSite, setWSite] = useState(siteId ?? "");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState(WASTE_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);

  const stocks = useMemo(() => computeStocks(db), [db]);
  const lineValue = (w: Waste) =>
    w.lines.reduce((s, l) => s + l.qty * entryOf(stocks, w.siteId, l.productId).avgCost, 0);

  const rows = useMemo(
    () =>
      [...db.wastes]
        .filter((w) => (siteId ? w.siteId === siteId : allowedSites.some((s) => s.id === w.siteId)))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.wastes, siteId, allowedSites]
  );

  const byReason = useMemo(() => {
    const map = new Map<string, number>();
    for (const w of rows.filter((w) => w.status === "valide")) {
      map.set(w.reason, (map.get(w.reason) ?? 0) + lineValue(w));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, db, siteId]);

  const totalLoss = byReason.reduce((s, [, v]) => s + v, 0);

  const create = () => {
    const ok = act(
      (d) =>
        saveWaste(d, {
          id: uid(),
          number: "",
          siteId: wSite,
          date,
          reason,
          status: "brouillon",
          notes,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          userId,
          createdAt: nowISO(),
        }),
      "Perte enregistrée en brouillon — le stock ne baissera qu'à la validation."
    );
    if (ok) {
      setShowNew(false);
      setLines([]);
      setNotes("");
    }
  };

  const cols: Col<Waste>[] = [
    { key: "num", label: "N°", sortVal: (w) => w.number, render: (w) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{w.number}</span> },
    { key: "date", label: "Date", sortVal: (w) => w.date, render: (w) => <span className="text-mute">{fmtDate(w.date)}</span> },
    { key: "site", label: "Site", sortVal: (w) => w.siteId, render: (w) => <span className="font-semibold">{siteName(w.siteId)}</span> },
    { key: "reason", label: "Motif", render: (w) => <Badge tone="warn">{w.reason}</Badge>, sortVal: (w) => w.reason },
    { key: "lines", label: "Lignes", align: "center", render: (w) => <span className="tnum">{w.lines.length}</span> },
    { key: "val", label: "Valeur estimée", align: "right", sortVal: (w) => lineValue(w), render: (w) => <span className="tnum font-bold text-bad">−{fmtMoney(lineValue(w), cur)}</span> },
    { key: "st", label: "Statut", render: (w) => <StatusBadge status={w.status} />, sortVal: (w) => w.status },
    {
      key: "act",
      label: "Actions",
      render: (w) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(w)} icon={<Eye size={13} />}>Détail</Button>
          {w.status === "brouillon" && can("waste.validate") && (
            <Button size="sm" onClick={() => setConfirm({ title: "Valider la perte ?", msg: `La perte ${w.number} diminuera définitivement le stock de ${siteName(w.siteId)} et alimentera la valeur des pertes.`, fn: () => act((d) => validateWaste(d, w.id, userId), `Perte ${w.number} validée — stock diminué.`) })}>Valider</Button>
          )}
          {w.status === "valide" && can("waste.validate") && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler la perte ?", msg: `La perte ${w.number} sera contre-passée : les quantités seront restituées au stock.`, fn: () => act((d) => cancelWaste(d, w.id, userId), `Perte ${w.number} annulée — quantités restituées.`) })} icon={<X size={13} />}>Annuler</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Pertes & déchets" sub="Expirés, casses, surproduction… chaque perte validée réduit le stock et alimente le reporting.">
        {can("waste.create") && <Button icon={<Plus size={15} />} onClick={() => { setWSite(siteId ?? allowedSites[0]?.id ?? ""); setShowNew(true); }}>Déclarer une perte</Button>}
      </PageHead>

      <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute">Valeur totale des pertes validées</p>
          <p className="tnum mt-1.5 font-display text-[24px] font-bold text-bad">−{fmtMoney(totalLoss, cur)}</p>
        </Card>
        <Card className="lg:col-span-2" title="Pertes par motif" pad>
          {byReason.length ? (
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {byReason.map(([r, v]) => (
                <li key={r} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="w-36 shrink-0 truncate font-semibold text-ink2">{r}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <div className="anim-grow h-full rounded-full bg-bad/80" style={{ width: `${(v / (totalLoss || 1)) * 100}%`, transformOrigin: "left" }} />
                  </div>
                  <span className="tnum w-24 shrink-0 text-right font-bold">{fmtMoney(v, cur)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-[12.5px] text-mute">Aucune perte validée sur ce périmètre.</p>
          )}
        </Card>
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(w) => w.id} pageSize={10}
        empty={<EmptyState icon={<Trash2 size={24} />} title="Aucune perte enregistrée" sub="Déclarez les expirations, casses et erreurs de préparation pour refléter le stock réel." />}
      />

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Déclarer une perte" sub="Brouillon — le stock ne diminue qu'à la validation." width="max-h"
        footer={<><Button variant="outline" onClick={() => setShowNew(false)}>Fermer</Button><Button disabled={!wSite || !lines.length || lines.some((l) => !l.productId || l.qty <= 0)} onClick={create}>Enregistrer le brouillon</Button></>}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Site">
            <Select value={wSite} onChange={(e) => setWSite(e.target.value)}>
              {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Motif">
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {WASTE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
        </div>
        <LineEditor rows={lines} onChange={setLines} products={db.products.filter((p) => p.status === "actif")} units={db.units} showCost={false} qtyLabel="Qté perdue" />
        <Field label="Notes" className="mt-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Circonstances…" />
        </Field>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Perte ${detail?.number}`} sub={detail ? `${siteName(detail.siteId)} · ${fmtDate(detail.date)} · ${detail.reason}` : ""} width="max-w-2xl">
        {detail && (
          <>
            <div className="mb-3"><StatusBadge status={detail.status} /></div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                  <th className="py-2">Produit</th>
                  <th className="py-2 text-right">Quantité</th>
                  <th className="py-2 text-right">Coût moyen</th>
                  <th className="py-2 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {detail.lines.map((l, i) => {
                  const p = db.products.find((x) => x.id === l.productId);
                  const cost = entryOf(stocks, detail.siteId, l.productId).avgCost;
                  return (
                    <tr key={i} className="border-b border-line/70 last:border-0">
                      <td className="py-2 font-semibold">{p?.name}</td>
                      <td className="tnum py-2 text-right font-bold">{fmtNum(l.qty)} {db.units.find((u) => u.id === p?.unitId)?.code}</td>
                      <td className="tnum py-2 text-right text-ink2">{fmtMoney(cost, cur)}</td>
                      <td className="tnum py-2 text-right font-bold text-bad">{fmtMoney(l.qty * cost, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {detail.notes && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink2">{detail.notes}</p>}
          </>
        )}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}