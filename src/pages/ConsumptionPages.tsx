import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Eye, Plus, Receipt, Soup, X } from "lucide-react";
import { useApp, useUserId } from "../state/AppContext";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  EmptyState,
  Field,
  Gauge,
  Input,
  LineEditor,
  Modal,
  PageHead,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  cn,
  type Col,
  type EditLine,
} from "../components/ui";
import {
  cancelConsumption,
  computeStocks,
  entryOf,
  saveConsumption,
  saveSale,
  validateConsumption,
} from "../lib/engine";
import type { Consumption, Service } from "../types";
import {
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  monthKey,
  monthLabel,
  nowISO,
  SERVICES,
  serviceLabel,
  todayISO,
  uid,
} from "../lib/util";

/* ============================================================
   CONSOMMATIONS
   ============================================================ */
export function ConsumptionsPage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Consumption | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);
  const [serviceFilter, setServiceFilter] = useState("");

  const [cSite, setCSite] = useState(siteId ?? "");
  const [date, setDate] = useState(todayISO());
  const [service, setService] = useState<Service>("dejeuner");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<EditLine[]>([]);

  const stocks = useMemo(() => computeStocks(db), [db]);
  const docValue = (c: Consumption) =>
    c.lines.reduce((s, l) => s + l.qty * entryOf(stocks, c.siteId, l.productId).avgCost, 0);

  const rows = useMemo(
    () =>
      [...db.consumptions]
        .filter((c) => (siteId ? c.siteId === siteId : allowedSites.some((s) => s.id === c.siteId)))
        .filter((c) => !serviceFilter || c.service === serviceFilter)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.consumptions, siteId, allowedSites, serviceFilter]
  );

  const create = () => {
    const ok = act(
      (d) =>
        saveConsumption(d, {
          id: uid(),
          number: "",
          siteId: cSite,
          date,
          service,
          status: "brouillon",
          notes,
          lines: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
          userId,
          createdAt: nowISO(),
        }),
      "Consommation enregistrée en brouillon — le stock ne baissera qu'à la validation."
    );
    if (ok) {
      setShowNew(false);
      setLines([]);
      setNotes("");
    }
  };

  const cols: Col<Consumption>[] = [
    { key: "num", label: "N°", sortVal: (c) => c.number, render: (c) => <span className="font-mono text-[11.5px] font-bold text-pine-700">{c.number}</span> },
    { key: "date", label: "Date", sortVal: (c) => c.date, render: (c) => <span className="text-mute">{fmtDate(c.date)}</span> },
    { key: "site", label: "Site", render: (c) => <span className="font-semibold">{siteName(c.siteId)}</span>, sortVal: (c) => c.siteId },
    { key: "service", label: "Service", render: (c) => <Badge tone="copper">{serviceLabel(c.service)}</Badge>, sortVal: (c) => c.service },
    { key: "lines", label: "Lignes", align: "center", render: (c) => <span className="tnum">{c.lines.length}</span> },
    { key: "val", label: "Coût (estimé)", align: "right", sortVal: docValue, render: (c) => <span className="tnum font-bold">{fmtMoney(docValue(c), cur)}</span> },
    { key: "st", label: "Statut", render: (c) => <StatusBadge status={c.status} />, sortVal: (c) => c.status },
    {
      key: "act",
      label: "Actions",
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDetail(c)} icon={<Eye size={13} />}>Détail</Button>
          {c.status === "brouillon" && can("consumption.validate") && (
            <Button size="sm" onClick={() => setConfirm({ title: "Valider la consommation ?", msg: `La consommation ${c.number} réduira le stock de ${siteName(c.siteId)} (mouvements CONSUMPTION valorisés au coût moyen pondéré).`, fn: () => act((d) => validateConsumption(d, c.id, userId), `Consommation ${c.number} validée — stock réduit.`) })}>Valider</Button>
          )}
          {c.status === "valide" && can("consumption.validate") && (
            <Button size="sm" variant="ghost" onClick={() => setConfirm({ title: "Annuler la consommation ?", msg: `La consommation ${c.number} sera contre-passée : les quantités seront restituées au stock.`, fn: () => act((d) => cancelConsumption(d, c.id, userId), `Consommation ${c.number} annulée — quantités restituées.`) })} icon={<X size={13} />}>Annuler</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Consommations" sub="Sorties de stock par service — valorisées au coût moyen pondéré du site, elles alimentent le food cost.">
        {can("consumption.create") && <Button icon={<Plus size={15} />} onClick={() => { setCSite(siteId ?? allowedSites[0]?.id ?? ""); setShowNew(true); }}>Nouvelle consommation</Button>}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <button onClick={() => setServiceFilter("")} className={cn("rounded-full border px-3 py-1 text-[12px] font-bold transition-all", !serviceFilter ? "border-pine-700 bg-pine-800 text-pine-50" : "border-line2 bg-card text-ink2 hover:border-pine-400")}>
          Tous services
        </button>
        {SERVICES.map((s) => (
          <button key={s.value} onClick={() => setServiceFilter(s.value === serviceFilter ? "" : s.value)} className={cn("rounded-full border px-3 py-1 text-[12px] font-bold transition-all", serviceFilter === s.value ? "border-pine-700 bg-pine-800 text-pine-50" : "border-line2 bg-card text-ink2 hover:border-pine-400")}>
            {s.label}
          </button>
        ))}
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(c) => c.id} pageSize={10}
        empty={<EmptyState icon={<Soup size={24} />} title="Aucune consommation" sub="Enregistrez les sorties de matières par service (déjeuner, dîner, bar…) pour suivre le coût réel." action={can("consumption.create") ? <Button icon={<Plus size={15} />} onClick={() => setShowNew(true)}>Créer une consommation</Button> : undefined} />}
      />

      <Modal open={showNew} onClose={() => setShowNew(false)} title="Nouvelle consommation" sub="Brouillon — le stock ne diminue qu'à la validation." width="max-h"
        footer={<><Button variant="outline" onClick={() => setShowNew(false)}>Fermer</Button><Button disabled={!cSite || !lines.length || lines.some((l) => !l.productId || l.qty <= 0)} onClick={create}>Enregistrer le brouillon</Button></>}
      >
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Site">
            <Select value={cSite} onChange={(e) => setCSite(e.target.value)}>
              {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Service">
            <Select value={service} onChange={(e) => setService(e.target.value as Service)}>
              {SERVICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </Field>
        </div>
        <LineEditor rows={lines} onChange={setLines} products={db.products.filter((p) => p.status === "actif")} units={db.units} showCost={false} qtyLabel="Qté consommée" />
        <Field label="Notes" className="mt-3">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Menu, événement…" />
        </Field>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Consommation ${detail?.number}`} sub={detail ? `${siteName(detail.siteId)} · ${fmtDate(detail.date)} · ${serviceLabel(detail.service)}` : ""} width="max-w-2xl">
        {detail && (
          <>
            <div className="mb-3"><StatusBadge status={detail.status} /></div>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                  <th className="py-2">Produit</th>
                  <th className="py-2 text-right">Quantité</th>
                  <th className="py-2 text-right">Coût moyen</th>
                  <th className="py-2 text-right">Coût total</th>
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
                      <td className="tnum py-2 text-right font-bold">{fmtMoney(l.qty * cost, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-right text-[13px] font-semibold text-ink2">
              Coût total : <span className="tnum font-display text-[16px] font-bold text-ink">{fmtMoney(docValue(detail), cur)}</span>
            </p>
            {detail.notes && <p className="mt-2 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink2">{detail.notes}</p>}
          </>
        )}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   VENTES & FOOD COST
   ============================================================ */
export function SalesFoodCostPage() {
  const { db, siteId, allowedSites, act, can, siteName } = useApp();
  const userId = useUserId();
  const cur = db.company.currency;
  const [tab, setTab] = useState("foodcost");

  const months = useMemo(() => {
    const keys: string[] = [];
    const d = new Date();
    for (let i = 0; i < 4; i++) {
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      d.setMonth(d.getMonth() - 1);
    }
    return keys;
  }, []);
  const [month, setMonth] = useState(months[0]);

  const analysis = useMemo(() => {
    const siteIds = siteId ? [siteId] : allowedSites.map((s) => s.id);
    const sales = db.sales.filter((s) => monthKey(s.date) === month && siteIds.includes(s.siteId));
    const revenue = sales.reduce((s, x) => s + x.revenue, 0);
    const covers = sales.reduce((s, x) => s + x.covers, 0);

    const consoMovs = db.movements.filter(
      (m) => m.type === "CONSUMPTION" && m.qty < 0 && monthKey(m.date) === month && siteIds.includes(m.siteId)
    );
    const consumption = consoMovs.reduce((s, m) => s + m.totalCost, 0);
    const foodCost = revenue > 0 ? (consumption / revenue) * 100 : 0;

    const byService = SERVICES.map((sv) => {
      const rev = sales.filter((s) => s.service === sv.value).reduce((s, x) => s + x.revenue, 0);
      const consoDocs = db.consumptions.filter(
        (c) => c.status === "valide" && monthKey(c.date) === month && siteIds.includes(c.siteId) && c.service === sv.value
      );
      const stocks = computeStocks(db);
      const cost = consoDocs.reduce(
        (s, c) => s + c.lines.reduce((x, l) => x + l.qty * entryOf(stocks, c.siteId, l.productId).avgCost, 0),
        0
      );
      return { service: sv.label, rev, cost, fc: rev > 0 ? (cost / rev) * 100 : null, covers: sales.filter((s) => s.service === sv.value).reduce((s, x) => s + x.covers, 0) };
    }).filter((x) => x.rev > 0 || x.cost > 0);

    const rootOf = (catId: string): string => {
      let c = db.categories.find((x) => x.id === catId);
      while (c?.parentId) c = db.categories.find((x) => x.id === c!.parentId);
      return c?.name ?? "Autres";
    };
    const catMap = new Map<string, number>();
    for (const m of consoMovs) {
      const p = db.products.find((x) => x.id === m.productId);
      if (!p) continue;
      const k = rootOf(p.categoryId);
      catMap.set(k, (catMap.get(k) ?? 0) + m.totalCost);
    }
    const byCat = [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return { revenue, covers, consumption, foodCost, byService, byCat };
  }, [db, siteId, allowedSites, month]);

  const target = db.company.targetFoodCost;
  const delta = analysis.foodCost - target;

  // saisie
  const [sDate, setSDate] = useState(todayISO());
  const [sSite, setSSite] = useState(siteId ?? allowedSites[0]?.id ?? "");
  const [grid, setGrid] = useState<Record<string, { revenue: string; covers: string }>>({});

  const cellKey = (sv: string) => `${sDate}|${sSite}|${sv}`;
  const existing = (sv: string) => db.sales.find((s) => s.date === sDate && s.siteId === sSite && s.service === sv);

  const saveCell = (sv: Service) => {
    const g = grid[cellKey(sv)];
    const ok = act(
      (d) =>
        saveSale(d, {
          id: uid(),
          siteId: sSite,
          date: sDate,
          service: sv,
          revenue: parseFloat(g?.revenue ?? "") || 0,
          covers: parseInt(g?.covers ?? "") || 0,
          userId,
          createdAt: nowISO(),
        }),
      `Ventes ${serviceLabel(sv)} du ${fmtDate(sDate)} enregistrées.`
    );
    if (ok) setGrid((x) => { const n = { ...x }; delete n[cellKey(sv)]; return n; });
  };

  return (
    <div>
      <PageHead title="Ventes & Food Cost" sub="Food cost = consommation ÷ chiffre d'affaires. Saisissez le CA et les couverts par service pour un contrôle quotidien.">
        <Tabs
          tabs={[
            { key: "foodcost", label: "Analyse food cost" },
            { key: "saisie", label: "Saisie des ventes" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </PageHead>

      {tab === "foodcost" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-52 capitalize">
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </Select>
            <Badge tone={delta > 0 ? "bad" : "ok"} dot className="text-[12px]">
              {delta > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {analysis.revenue > 0 ? `${fmtPct(Math.abs(delta))} ${delta > 0 ? "au-dessus" : "en dessous"} de l'objectif de ${fmtNum(target, 0)} %` : "Aucune vente sur la période"}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Card className="xl:col-span-4" title="Food cost du mois" sub={siteId ? siteName(siteId) : "Tous les sites"}>
              <div className="flex flex-col items-center">
                <Gauge value={analysis.foodCost} target={target} size={210} />
                <div className="mt-3 grid w-full grid-cols-2 gap-2.5">
                  <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">CA du mois</p>
                    <p className="tnum mt-1 font-display text-[16px] font-bold">{fmtMoney(analysis.revenue, cur)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">Consommation</p>
                    <p className="tnum mt-1 font-display text-[16px] font-bold">{fmtMoney(analysis.consumption, cur)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">Couverts</p>
                    <p className="tnum mt-1 font-display text-[16px] font-bold">{fmtNum(analysis.covers, 0)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">CA / couvert</p>
                    <p className="tnum mt-1 font-display text-[16px] font-bold">{analysis.covers > 0 ? fmtMoney(analysis.revenue / analysis.covers, cur) : "—"}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="xl:col-span-5" title="Food cost par service" sub="Anomalies surlignées par rapport à l'objectif" pad={false}>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
                    <th className="px-4 py-2.5">Service</th>
                    <th className="px-2 py-2.5 text-right">CA</th>
                    <th className="px-2 py-2.5 text-right">Consommation</th>
                    <th className="px-2 py-2.5 text-right">Couverts</th>
                    <th className="px-4 py-2.5 text-right">Food cost</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.byService.map((s) => (
                    <tr key={s.service} className={cn("border-b border-line/70 last:border-0", s.fc !== null && s.fc > target && "bg-badbg/40")}>
                      <td className="px-4 py-2.5 font-semibold">{s.service}</td>
                      <td className="tnum px-2 py-2.5 text-right font-bold">{fmtMoney(s.rev, cur)}</td>
                      <td className="tnum px-2 py-2.5 text-right text-ink2">{fmtMoney(s.cost, cur)}</td>
                      <td className="tnum px-2 py-2.5 text-right text-ink2">{fmtNum(s.covers, 0)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {s.fc === null ? <span className="text-mute">—</span> : (
                          <Badge tone={s.fc > target ? "bad" : "ok"} dot>{fmtPct(s.fc)}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!analysis.byService.length && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-mute">Aucune donnée sur ce mois.</td></tr>
                  )}
                </tbody>
              </table>
            </Card>

            <Card className="xl:col-span-3" title="Consommation par famille">
              <ul className="space-y-2.5">
                {analysis.byCat.map((c) => {
                  const max = analysis.byCat[0]?.value || 1;
                  return (
                    <li key={c.name}>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-semibold text-ink2">{c.name}</span>
                        <span className="tnum font-bold">{fmtMoney(c.value, cur)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                        <div className="anim-grow h-full rounded-full bg-copper-500/85" style={{ width: `${(c.value / max) * 100}%`, transformOrigin: "left" }} />
                      </div>
                    </li>
                  );
                })}
                {!analysis.byCat.length && <p className="py-6 text-center text-[12.5px] text-mute">Aucune consommation validée ce mois.</p>}
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab === "saisie" && (
        <Card title="Saisie du chiffre d'affaires" sub="Une ligne par service et par jour — la saisie est cumulable (modification de la valeur existante)." className="max-w-3xl">
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Site">
              <Select value={sSite} onChange={(e) => setSSite(e.target.value)}>
                {allowedSites.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
              </Select>
            </Field>
            <Field label="Date">
              <Input type="date" value={sDate} onChange={(e) => setSDate(e.target.value)} />
            </Field>
          </div>
          <div className="space-y-2.5">
            {SERVICES.map((sv) => {
              const ex = existing(sv.value);
              const g = grid[cellKey(sv.value)] ?? {
                revenue: ex ? String(ex.revenue) : "",
                covers: ex ? String(ex.covers) : "",
              };
              return (
                <div key={sv.value} className="flex flex-wrap items-center gap-2.5 rounded-md border border-line bg-paper/50 px-3 py-2.5">
                  <span className="flex w-40 items-center gap-2 text-[13px] font-bold text-ink">
                    <Receipt size={14} className="text-pine-600" />
                    {sv.label}
                  </span>
                  <Input type="number" min={0} placeholder={`CA (${cur})`} value={g.revenue} onChange={(e) => setGrid((x) => ({ ...x, [cellKey(sv.value)]: { ...g, revenue: e.target.value } }))} className="h-8.5 w-36 text-right tnum" />
                  <Input type="number" min={0} placeholder="Couverts" value={g.covers} onChange={(e) => setGrid((x) => ({ ...x, [cellKey(sv.value)]: { ...g, covers: e.target.value } }))} className="h-8.5 w-28 text-right tnum" />
                  {ex && <Badge tone="pine">Enregistré : {fmtMoney(ex.revenue, cur)}</Badge>}
                  {can("sales.create") && (
                    <Button size="sm" variant="outline" className="ml-auto" disabled={g.revenue === "" && g.covers === ""} onClick={() => saveCell(sv.value)}>
                      {ex ? "Mettre à jour" : "Enregistrer"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
