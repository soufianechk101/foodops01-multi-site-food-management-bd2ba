import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Crown,
  Percent,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../state/AppContext";
import { Badge, Button, Card, cn, useCountUp } from "../components/ui";
import {
  computeStocks,
  entryOf,
  invoicePaid,
  invoiceStatus,
  invoiceTotals,
  stockStatus,
  supplierBalance,
} from "../lib/engine";
import { addDaysISO, fmtMoney, fmtNum, fmtPct, todayISO } from "../lib/util";

type Alert = { tone: "bad" | "warn"; label: string; value: string; route: string; action: string };

const DeltaChip = ({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) => {
  if (!prev) return <span className="text-[10.5px] font-semibold text-mute">— vs préc.</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10.5px] font-bold",
        good ? "bg-okbg text-ok" : "bg-badbg text-bad"
      )}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {up ? "+" : ""}
      {fmtNum(pct, 1)} %
    </span>
  );
};

export function OwnerPage() {
  const { db, nav, user } = useApp();
  const cur = db.company.currency;
  const target = db.company.targetFoodCost;
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const data = useMemo(() => {
    const today = todayISO();
    const from = addDaysISO(today, -(days - 1));
    const prevTo = addDaysISO(from, -1);
    const prevFrom = addDaysISO(prevTo, -(days - 1));
    const inRange = (d: string) => d >= from && d <= today;
    const inPrev = (d: string) => d >= prevFrom && d <= prevTo;

    const sales = (f: (d: string) => boolean) => db.sales.filter((s) => f(s.date));
    const rev = (f: (d: string) => boolean) => sales(f).reduce((s, x) => s + x.revenue, 0);
    const cov = (f: (d: string) => boolean) => sales(f).reduce((s, x) => s + x.covers, 0);
    const mv = (type: string, f: (d: string) => boolean) =>
      db.movements.filter((m) => m.type === type && m.qty < 0 && f(m.date)).reduce((s, m) => s + m.totalCost, 0);
    const achats = (f: (d: string) => boolean) =>
      db.movements.filter((m) => m.type === "RECEPTION" && f(m.date)).reduce((s, m) => s + m.totalCost, 0);

    const revenue = rev(inRange);
    const revenuePrev = rev(inPrev);
    const conso = mv("CONSUMPTION", inRange);
    const consoPrev = mv("CONSUMPTION", inPrev);
    const waste = mv("WASTE", inRange);
    const wastePrev = mv("WASTE", inPrev);
    const purchases = achats(inRange);
    const covers = cov(inRange);
    const fc = revenue > 0 ? (conso / revenue) * 100 : 0;
    const fcPrev = revenuePrev > 0 ? (consoPrev / revenuePrev) * 100 : 0;

    const stocks = computeStocks(db);
    const stockValue = db.sites.reduce(
      (tot, s) =>
        tot +
        db.products.reduce((acc, p) => acc + Math.max(entryOf(stocks, s.id, p.id).value, 0), 0),
      0
    );

    let paid = 0,
      due = 0,
      overdue = 0;
    for (const inv of db.invoices) {
      const rest = Math.max(invoiceTotals(inv).ttc - invoicePaid(db, inv.id), 0);
      const st = invoiceStatus(db, inv);
      if (st === "payee") paid += invoiceTotals(inv).ttc;
      else if (st === "echue") overdue += rest;
      else due += rest;
    }
    const credit = db.suppliers
      .map((s) => ({ name: s.name, balance: supplierBalance(db, s.id).balance }))
      .filter((x) => x.balance > 0.01)
      .sort((a, b) => b.balance - a.balance);

    /* classement des sites */
    const sites = db.sites
      .map((s) => {
        const sRev = db.sales.filter((x) => x.siteId === s.id && inRange(x.date)).reduce((a, x) => a + x.revenue, 0);
        const sConso = db.movements
          .filter((m) => m.siteId === s.id && m.type === "CONSUMPTION" && m.qty < 0 && inRange(m.date))
          .reduce((a, m) => a + m.totalCost, 0);
        const sStock = db.products.reduce((a, p) => a + Math.max(entryOf(stocks, s.id, p.id).value, 0), 0);
        return { site: s, rev: sRev, conso: sConso, fc: sRev > 0 ? (sConso / sRev) * 100 : null, stock: sStock };
      })
      .sort((a, b) => b.rev - a.rev);

    /* série temporelle */
    const serie = new Map<string, { rev: number; conso: number }>();
    for (const s of db.sales) {
      if (!inRange(s.date)) continue;
      const k = s.date;
      const e = serie.get(k) ?? { rev: 0, conso: 0 };
      e.rev += s.revenue;
      serie.set(k, e);
    }
    for (const m of db.movements) {
      if (m.type !== "CONSUMPTION" || m.qty >= 0 || !inRange(m.date)) continue;
      const e = serie.get(m.date) ?? { rev: 0, conso: 0 };
      e.conso += m.totalCost;
      serie.set(m.date, e);
    }
    const chart = [...serie.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({
        d: d.slice(8, 10) + "/" + d.slice(5, 7),
        CA: Math.round(v.rev),
        Consommation: Math.round(v.conso),
        "Food cost": v.rev > 0 ? Math.round((v.conso / v.rev) * 1000) / 10 : null,
      }));

    /* alertes */
    const alerts: Alert[] = [];
    const late = db.invoices.filter((i) => invoiceStatus(db, i) === "echue");
    if (late.length)
      alerts.push({
        tone: "bad",
        label: `${late.length} facture(s) fournisseur échue(s)`,
        value: fmtMoney(late.reduce((s, i) => s + Math.max(invoiceTotals(i).ttc - invoicePaid(db, i.id), 0), 0), cur),
        route: "factures",
        action: "Régler",
      });
    const ruptures: string[] = [];
    for (const s of db.sites)
      for (const p of db.products.filter((x) => x.status === "actif")) {
        if (!db.movements.some((m) => m.siteId === s.id && m.productId === p.id)) continue;
        if (stockStatus(entryOf(stocks, s.id, p.id).qty, p) === "rupture") ruptures.push(`${p.name} · ${s.code}`);
      }
    if (ruptures.length)
      alerts.push({
        tone: "bad",
        label: `${ruptures.length} rupture(s) de stock : ${ruptures.slice(0, 3).join(", ")}${ruptures.length > 3 ? "…" : ""}`,
        value: "Réapprovisionner",
        route: "stock",
        action: "Voir",
      });
    const fcHot = sites.filter((s) => s.fc !== null && s.fc > target + 5);
    if (fcHot.length)
      alerts.push({
        tone: "warn",
        label: `Food cost au-dessus de l'objectif sur ${fcHot.map((s) => s.site.code).join(", ")}`,
        value: fcHot.map((s) => `${s.site.code} ${fmtPct(s.fc!, 0)}`).join(" · "),
        route: "ventes",
        action: "Analyser",
      });
    const poWait = db.purchaseOrders.filter((p) => p.status === "soumis").length;
    if (poWait)
      alerts.push({ tone: "warn", label: `${poWait} bon(s) de commande en attente d'approbation`, value: "", route: "achats", action: "Approuver" });
    const transit = db.transfers.filter((t) => t.status === "expedie").length;
    if (transit)
      alerts.push({ tone: "warn", label: `${transit} transfert(s) en transit à réceptionner`, value: "", route: "transferts", action: "Réceptionner" });

    return {
      from, revenue, revenuePrev, conso, consoPrev, waste, wastePrev, purchases, covers, fc, fcPrev,
      stockValue, paid, due, overdue, credit, sites, chart, alerts,
    };
  }, [db, days, cur, target]);

  const bigRev = useCountUp(Math.round(data.revenue));
  const kpiRev = useCountUp(Math.round(data.revenue));
  const kpiConso = useCountUp(Math.round(data.conso));
  const kpiWaste = useCountUp(Math.round(data.waste));
  const kpiStock = useCountUp(Math.round(data.stockValue));
  const kpiCredit = useCountUp(Math.round(data.due + data.overdue));
  const kpiCovers = useCountUp(data.covers);
  const maxRev = Math.max(...data.sites.map((s) => s.rev), 1);
  const creditTotal = data.paid + data.due + data.overdue || 1;

  return (
    <div className="space-y-4">
      {/* ---------- bandeau exécutif ---------- */}
      <div className="side-bg relative overflow-hidden rounded-xl border border-pine-900/60 px-6 py-6 text-pine-100 shadow-[0_16px_44px_rgba(10,32,25,0.28)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-copper-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="anim-fade-up">
            <p className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.22em] text-copper-300">
              <Crown size={14} /> Direction · Vue groupe
            </p>
            <h1 className="mt-2 font-display text-[27px] font-bold leading-tight text-white">
              {db.company.legalName}
            </h1>
            <p className="mt-1 text-[12px] text-pine-200">
              {db.company.city} · ICE {db.company.ice} · {db.sites.length} sites · consolidé du {data.from.slice(8, 10)}/{data.from.slice(5, 7)} au{" "}
              {todayISO().slice(8, 10)}/{todayISO().slice(5, 7)}
            </p>
            <div className="mt-4 flex items-end gap-3">
              <p className="tnum font-display text-[40px] font-bold leading-none text-white">
                {fmtMoney(bigRev, cur)}
              </p>
              <div className="mb-1.5">
                <DeltaChip cur={data.revenue} prev={data.revenuePrev} />
                <p className="mt-0.5 text-[10.5px] text-pine-300">chiffre d'affaires groupe</p>
              </div>
            </div>
          </div>
          <div className="anim-fade-up flex flex-col items-end gap-3" style={{ animationDelay: "0.08s" }}>
            <div className="flex rounded-lg border border-white/15 bg-white/5 p-1">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-[12.5px] font-bold transition-all",
                    days === d ? "bg-copper-500 text-white shadow" : "text-pine-200 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {d} jours
                </button>
              ))}
            </div>
            <p className="max-w-[300px] text-right text-[11px] leading-relaxed text-pine-300">
              Consolidation de reporting : totaux explicites du groupe. Le stock opérationnel reste géré site par site.
            </p>
          </div>
        </div>
        <div className="relative mt-5 h-px w-full bg-gradient-to-r from-copper-500/70 via-copper-500/20 to-transparent" />
        <div className="relative mt-4 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-pine-200">
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
            Connecté : <span className="text-copper-300">{user?.name}</span> · Propriétaire
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
            Objectif food cost : <span className="tnum text-copper-300">{fmtPct(target, 0)}</span>
          </span>
          <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1">
            Devise : <span className="text-copper-300">{cur}</span>
          </span>
        </div>
      </div>

      {/* ---------- indicateurs ---------- */}
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {([
          { label: "CA groupe", val: fmtMoney(kpiRev, cur), delta: <DeltaChip cur={data.revenue} prev={data.revenuePrev} />, icon: <TrendingUp size={15} />, hot: false },
          { label: "Consommation", val: fmtMoney(kpiConso, cur), delta: <DeltaChip cur={data.conso} prev={data.consoPrev} invert />, icon: <UtensilsCrossed size={15} />, hot: false },
          { label: "Food cost", val: data.revenue ? fmtPct(data.fc) : "—", delta: <DeltaChip cur={data.fc} prev={data.fcPrev} invert />, icon: <Percent size={15} />, hot: data.fc > target },
          { label: "Valeur du stock", val: fmtMoney(kpiStock, cur), delta: <span className="text-[10.5px] font-semibold text-mute">tous sites</span>, icon: <Boxes size={15} />, hot: false },
          { label: "Crédit fournisseur", val: fmtMoney(kpiCredit, cur), delta: <span className={cn("text-[10.5px] font-bold", data.overdue > 0 ? "text-bad" : "text-mute")}>{data.overdue > 0 ? `dont ${fmtMoney(data.overdue, cur)} échus` : "aucun échu"}</span>, icon: <Wallet size={15} />, hot: false },
          { label: "Couverts", val: fmtNum(kpiCovers, 0), delta: <span className="text-[10.5px] font-semibold text-mute">{fmtMoney(data.covers ? data.revenue / data.covers : 0, cur)} / couvert</span>, icon: <UtensilsCrossed size={15} />, hot: false },
        ] as { label: string; val: string; delta: React.ReactNode; icon: React.ReactNode; hot: boolean }[]).map((k, i) => (
          <div
            key={i}
            className={cn(
              "group rounded-lg border border-line bg-card px-4 py-3.5 transition-all hover:-translate-y-0.5 hover:border-copper-300 hover:shadow-md",
              k.hot && "border-warn/40"
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">{k.label}</p>
              <span className="text-pine-600 transition-transform group-hover:scale-110">{k.icon}</span>
            </div>
            <p className="tnum mt-2 font-display text-[19px] font-bold leading-none text-ink">{k.val}</p>
            <div className="mt-2">{k.delta}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {/* ---------- classement des sites ---------- */}
        <Card
          className="xl:col-span-3"
          title="Classement des sites"
          sub={`Chiffre d'affaires, food cost et valeur de stock par établissement — période ${days} j.`}
        >
          <ul className="space-y-1">
            {data.sites.map((s, i) => (
              <li
                key={s.site.id}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-md px-2.5 py-2.5 transition-all hover:bg-pine-50/70 sm:grid-cols-[auto_minmax(0,1.2fr)_auto_auto_auto]"
              >
                <span className="flex w-8 items-center gap-1">
                  <span className={cn("tnum font-mono text-[13px] font-bold", i === 0 ? "text-copper-600" : "text-mute")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {i === 0 && <Crown size={13} className="text-copper-500" />}
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-[13.5px] font-bold text-ink">{s.site.name}</p>
                    <span className="tnum shrink-0 rounded bg-pine-900 px-1.5 py-px font-mono text-[9.5px] font-bold text-pine-100">{s.site.code}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className={cn("h-full rounded-full transition-[width] duration-700 ease-out", i === 0 ? "bg-gradient-to-r from-copper-500 to-copper-400" : "bg-pine-600/85")}
                      style={{ width: `${Math.max((s.rev / maxRev) * 100, s.rev > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
                <div className="col-start-3 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                  <p className="tnum text-[13.5px] font-bold text-ink">{fmtMoney(s.rev, cur)}</p>
                  <p className="text-[10.5px] text-mute">CA</p>
                </div>
                <div className="col-start-3 row-start-2 text-right sm:col-start-auto sm:row-start-auto">
                  {s.fc !== null ? (
                    <Badge tone={s.fc <= target ? "ok" : s.fc <= target + 5 ? "warn" : "bad"} dot>
                      FC {fmtPct(s.fc, 1)}
                    </Badge>
                  ) : (
                    <Badge tone="slate">FC —</Badge>
                  )}
                </div>
                <div className="hidden text-right sm:block">
                  <p className="tnum text-[12.5px] font-semibold text-ink2">{fmtMoney(s.stock, cur)}</p>
                  <p className="text-[10.5px] text-mute">stock</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line px-2.5 pt-3 text-[11px] text-mute">
            Le food cost « groupe » ({data.revenue ? fmtPct(data.fc) : "—"}) masque les écarts par site : pilotez chaque établissement sur sa ligne.
          </p>
        </Card>

        {/* ---------- tendances + crédit ---------- */}
        <div className="space-y-4 xl:col-span-2">
          <Card title="CA vs consommation" sub="Chiffre d'affaires et coût matière jour par jour">
            <div className="h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.chart} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--color-mute)" }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                  <YAxis yAxisId="m" tick={{ fontSize: 10, fill: "var(--color-mute)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                  <YAxis yAxisId="p" orientation="right" tick={{ fontSize: 10, fill: "var(--color-mute)" }} tickLine={false} axisLine={false} unit="%" hide={days > 30} />
                  <Tooltip
                    formatter={(v: number | string, name: string) => (name === "Food cost" ? [`${v} %`, name] : [fmtMoney(Number(v), cur), name])}
                    contentStyle={{ background: "#102e24", border: "none", borderRadius: 8, fontSize: 11.5, color: "#fff" }}
                    labelStyle={{ color: "#dcebe2", fontWeight: 700 }}
                  />
                  <Bar yAxisId="m" dataKey="CA" fill="var(--color-pine-600)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Bar yAxisId="m" dataKey="Consommation" fill="var(--color-copper-500)" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  <Line yAxisId="p" dataKey="Food cost" stroke="#1a2620" strokeWidth={1.6} dot={false} type="monotone" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] font-semibold text-ink2">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pine-600" />CA</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-copper-500" />Consommation</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 bg-ink" />Food cost %</span>
            </div>
          </Card>

          <Card title="Crédit fournisseur" sub="Encours, exigible et retards de paiement">
            <div className="flex h-3 overflow-hidden rounded-full bg-line">
              <div className="anim-grow bg-bad transition-[width] duration-700" style={{ width: `${(data.overdue / creditTotal) * 100}%`, transformOrigin: "left" }} />
              <div className="anim-grow bg-warn transition-[width] duration-700" style={{ width: `${(data.due / creditTotal) * 100}%`, transformOrigin: "left" }} />
              <div className="anim-grow bg-ok/80 transition-[width] duration-700" style={{ width: `${(data.paid / creditTotal) * 100}%`, transformOrigin: "left" }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-badbg px-2 py-2"><p className="tnum text-[13px] font-bold text-bad">{fmtMoney(data.overdue, cur)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-bad/80">Échu</p></div>
              <div className="rounded-md bg-warnbg px-2 py-2"><p className="tnum text-[13px] font-bold text-warn">{fmtMoney(data.due, cur)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-warn/80">À échoir</p></div>
              <div className="rounded-md bg-okbg px-2 py-2"><p className="tnum text-[13px] font-bold text-ok">{fmtMoney(data.paid, cur)}</p><p className="text-[10px] font-bold uppercase tracking-wide text-ok/80">Réglé</p></div>
            </div>
            {data.credit.length > 0 && (
              <>
                <p className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">Premiers créanciers</p>
                <ul className="mt-1.5 space-y-1.5">
                  {data.credit.slice(0, 3).map((c, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border border-line/80 px-2.5 py-1.5 text-[12.5px]">
                      <span className="font-semibold text-ink2">{c.name}</span>
                      <span className="tnum font-bold text-bad">{fmtMoney(c.balance, cur)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ---------- alertes & gouvernance ---------- */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Alertes & décisions" sub="Ce qui requiert votre arbitrage, en temps réel">
          {data.alerts.length ? (
            <ul className="space-y-2">
              {data.alerts.map((a, i) => (
                <li
                  key={i}
                  className="anim-fade-up flex items-center gap-3 rounded-md border border-line bg-card px-3.5 py-2.5 transition-all hover:border-copper-300 hover:shadow-sm"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", a.tone === "bad" ? "bg-bad" : "bg-warn", "animate-pulse")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-ink">{a.label}</p>
                    {a.value && <p className="tnum text-[11.5px] font-semibold text-ink2">{a.value}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => nav(a.route)} icon={<ArrowUpRight size={13} />}>
                    {a.action}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-ok/30 bg-okbg px-4 py-5">
              <CheckCircle2 size={20} className="text-ok" />
              <p className="text-[13px] font-bold text-ok">Aucune alerte — le groupe est sous contrôle.</p>
            </div>
          )}
        </Card>

        <div className="xl:col-span-2">
          <Card title="Gouvernance" sub="Traçabilité et intégrité du système" className="h-full">
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: <Boxes size={16} />, v: fmtNum(db.movements.length, 0), l: "mouvements de stock" },
                { icon: <ShieldCheck size={16} />, v: fmtNum(db.audit.length, 0), l: "entrées d'audit" },
                { icon: <UtensilsCrossed size={16} />, v: fmtNum(db.products.filter((p) => p.status === "actif").length, 0), l: "produits actifs" },
                { icon: <Wallet size={16} />, v: fmtNum(db.receptions.filter((r) => r.status === "valide").length, 0), l: "réceptions validées" },
              ].map((g, i) => (
                <div key={i} className="rounded-md border border-line bg-paper/60 px-3 py-3 transition-all hover:border-pine-300 hover:bg-pine-50/60">
                  <span className="text-pine-600">{g.icon}</span>
                  <p className="tnum mt-1.5 font-display text-[19px] font-bold leading-none text-ink">{g.v}</p>
                  <p className="mt-1 text-[11px] font-semibold text-mute">{g.l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-mute">
              Chaque variation de stock est un mouvement signé (qui, quoi, quand, où, combien). Les documents annulés sont
              contre-passés, jamais effacés — l'historique du groupe reste auditable de bout en bout.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

