import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, Flame, History, Percent, Receipt, ShoppingBag, Soup, Trash2, Users, Wallet, Clock } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApp } from "../state/AppContext";
import { Badge, Button, Card, Gauge, PageHead, Stat, cn } from "../components/ui";
import { computeStocks, entryOf, siteExpiries, stockStatus, supplierBalance } from "../lib/engine";
import {
  addDaysISO,
  fmtDate,
  fmtMoney,
  fmtNum,
  fmtPct,
  MV_LABELS,
  relTime,
  todayISO,
} from "../lib/util";

const PALETTE = ["#1b503b", "#337d5d", "#c7822c", "#e2b269", "#2a6f8e", "#8bbaa2", "#a86820", "#b8432a"];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid var(--color-line)",
  background: "var(--color-card)",
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  boxShadow: "0 6px 20px rgba(16,46,36,0.12)",
} as const;

export function Dashboard() {
  const { db, siteId, allowedSites, nav, siteName } = useApp();
  const [days, setDays] = useState(30);
  const cur = db.company.currency;

  const data = useMemo(() => {
    const from = addDaysISO(todayISO(), -(days - 1));
    const siteIds = siteId ? [siteId] : allowedSites.map((s) => s.id);
    const inScope = (sid: string) => siteIds.includes(sid);

    const movs = db.movements.filter((m) => m.date >= from && inScope(m.siteId));
    const sum = (type: string) =>
      movs.filter((m) => m.type === type).reduce((s, m) => s + m.totalCost, 0);

    const purchases = sum("RECEPTION");
    const consumption = sum("CONSUMPTION");
    const waste = sum("WASTE");

    const sales = db.sales.filter((s) => s.date >= from && inScope(s.siteId));
    const revenue = sales.reduce((s, x) => s + x.revenue, 0);
    const covers = sales.reduce((s, x) => s + x.covers, 0);

    const stocks = computeStocks(db);
    let stockValue = 0;
    let stockItems = 0;
    for (const sid of siteIds) {
      for (const p of db.products) {
        const e = entryOf(stocks, sid, p.id);
        if (e.qty !== 0) stockItems++;
        stockValue += Math.max(e.value, 0);
      }
    }

    const supplierCredit = db.suppliers.reduce((s, sup) => s + Math.max(supplierBalance(db, sup.id).balance, 0), 0);

    // séries journalières
    const series: { d: string; achats: number; conso: number; ca: number }[] = [];
    for (let i = 0; i < days; i++) {
      const date = addDaysISO(from, i);
      const dm = movs.filter((m) => m.date === date);
      series.push({
        d: date.slice(8) + "/" + date.slice(5, 7),
        achats: Math.round(dm.filter((m) => m.type === "RECEPTION").reduce((s, m) => s + m.totalCost, 0)),
        conso: Math.round(dm.filter((m) => m.type === "CONSUMPTION").reduce((s, m) => s + m.totalCost, 0)),
        ca: Math.round(sales.filter((s) => s.date === date).reduce((s, x) => s + x.revenue, 0)),
      });
    }

    // valeur du stock par famille (catégorie racine)
    const byCat = new Map<string, number>();
    const rootOf = (catId: string): string => {
      let c = db.categories.find((x) => x.id === catId);
      while (c?.parentId) c = db.categories.find((x) => x.id === c!.parentId);
      return c?.name ?? "Autres";
    };
    for (const sid of siteIds) {
      for (const p of db.products) {
        const e = entryOf(stocks, sid, p.id);
        if (e.value <= 0) continue;
        const k = rootOf(p.categoryId);
        byCat.set(k, (byCat.get(k) ?? 0) + e.value);
      }
    }
    const donut = [...byCat.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);

    // top produits consommés
    const byProd = new Map<string, number>();
    for (const m of movs.filter((m) => m.type === "CONSUMPTION")) {
      byProd.set(m.productId, (byProd.get(m.productId) ?? 0) + m.totalCost);
    }
    const topConso = [...byProd.entries()]
      .map(([pid, value]) => ({ name: db.products.find((p) => p.id === pid)?.name ?? pid, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // stock bas
    const low: { name: string; site: string; qty: number; min: number; kind: string }[] = [];
    for (const sid of siteIds) {
      for (const p of db.products.filter((x) => x.status === "actif")) {
        if (!db.movements.some((m) => m.siteId === sid && m.productId === p.id)) continue;
        const e = entryOf(stocks, sid, p.id);
        const kind = stockStatus(e.qty, p);
        if (kind !== "ok")
          low.push({
            name: p.name,
            site: db.sites.find((s) => s.id === sid)?.code ?? "",
            qty: e.qty,
            min: p.reorderPoint,
            kind,
          });
      }
    }
    low.sort((a, b) => a.qty / (a.min || 1) - b.qty / (b.min || 1));

    // péremptions proches (DLC des réceptions validées)
    const expiries: { name: string; site: string; expiry: string; days: number }[] = [];
    const nowMs = Date.now();
    for (const sid of siteIds) {
      for (const ex of siteExpiries(db, sid)) {
        const e = entryOf(stocks, sid, ex.productId);
        if (!e || e.qty <= 0) continue;
        expiries.push({
          name: db.products.find((pr) => pr.id === ex.productId)?.name ?? ex.productId,
          site: db.sites.find((st) => st.id === sid)?.code ?? "",
          expiry: ex.expiry,
          days: Math.max(Math.ceil((Date.parse(ex.expiry) - nowMs) / 86400000), 0),
        });
      }
    }
    expiries.sort((a, b) => a.days - b.days);

    const journal = [...db.movements]
      .filter((m) => inScope(m.siteId))
      .sort((a, b) => b.seq - a.seq)
      .slice(0, 9);

    return {
      purchases,
      consumption,
      waste,
      revenue,
      covers,
      stockValue,
      stockItems,
      supplierCredit,
      foodCost: revenue > 0 ? (consumption / revenue) * 100 : 0,
      series,
      donut,
      topConso,
      low: low.slice(0, 7),
      expiries: expiries.slice(0, 7),
      journal,
    };
  }, [db, siteId, allowedSites, days]);

  const target = db.company.targetFoodCost;
  const fcDelta = data.foodCost - target;

  return (
    <div>
      <PageHead
        title="Tableau de bord"
        sub={
          siteId
            ? `Vue du site ${siteName(siteId)} — tous les indicateurs respectent ce périmètre.`
            : "Vue consolidée de tous vos sites — sélectionnez un site pour une vue opérationnelle."
        }
      >
        <div className="flex items-center gap-1 rounded-lg border border-line bg-card p-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                "tnum rounded-md px-3 py-1.5 text-[12.5px] font-bold transition-all",
                days === d ? "bg-pine-800 text-pine-50" : "text-ink2 hover:bg-paper"
              )}
            >
              {d} j
            </button>
          ))}
        </div>
        <Button variant="outline" icon={<History size={15} />} onClick={() => nav("mouvements")}>
          Journal des mouvements
        </Button>
      </PageHead>

      {/* KPI */}
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Valeur du stock" value={data.stockValue} icon={<Boxes size={16} />} sub={`${data.stockItems} références en stock`} />
        <Stat label={`Achats (${days} j)`} value={data.purchases} icon={<ShoppingBag size={16} />} tone="copper" sub="Réceptions validées, valorisées au coût d'achat" />
        <Stat label={`Consommation (${days} j)`} value={data.consumption} icon={<Soup size={16} />} tone="info" sub="Sorties cuisine valorisées au coût moyen pondéré" />
        <Stat label={`Pertes (${days} j)`} value={data.waste} icon={<Trash2 size={16} />} tone="bad" sub="Valeur des pertes et déchets validés" />
      </div>

      {/* graphiques principaux */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card
          title="Achats vs consommation"
          sub="Flux quotidiens valorisés (HT)"
          className="xl:col-span-7"
          actions={
            <div className="flex items-center gap-3 text-[11.5px] font-semibold text-ink2">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-copper-500" />Achats</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pine-500" />Consommation</span>
            </div>
          }
        >
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.series} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10.5, fill: "var(--color-mute)" }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} interval={days > 30 ? 6 : days > 10 ? 2 : 0} />
                <YAxis tick={{ fontSize: 10.5, fill: "var(--color-mute)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? Math.round(v / 1000) + "k" : String(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v), cur)} cursor={{ fill: "rgba(16,46,36,0.05)" }} />
                <Bar dataKey="achats" name="Achats" fill="var(--color-copper-500)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="conso" name="Consommation" fill="var(--color-pine-500)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Food cost" sub="Consommation ÷ chiffre d'affaires" className="xl:col-span-5">
          <div className="flex flex-wrap items-center gap-6">
            <Gauge value={data.foodCost} target={target} />
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink2"><Receipt size={14} className="text-pine-600" />Chiffre d'affaires</span>
                <span className="tnum font-display text-[15px] font-bold">{fmtMoney(data.revenue, cur)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink2"><Soup size={14} className="text-pine-600" />Consommation</span>
                <span className="tnum font-display text-[15px] font-bold">{fmtMoney(data.consumption, cur)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-line pb-2">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink2"><Users size={14} className="text-pine-600" />Couverts</span>
                <span className="tnum font-display text-[15px] font-bold">{fmtNum(data.covers, 0)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-ink2"><Wallet size={14} className="text-pine-600" />Crédit fournisseurs</span>
                <span className="tnum font-display text-[15px] font-bold">{fmtMoney(data.supplierCredit, cur)}</span>
              </div>
              <div className="pt-1">
                {data.revenue > 0 ? (
                  <Badge tone={fcDelta > 0 ? "bad" : "ok"} dot>
                    {fcDelta > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {fmtPct(Math.abs(fcDelta))} {fcDelta > 0 ? "au-dessus" : "en dessous"} de l'objectif
                  </Badge>
                ) : (
                  <Badge tone="slate">Aucune vente sur la période</Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* CA + répartition + top + alertes */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card title="Chiffre d'affaires" sub="Évolution quotidienne" className="xl:col-span-4">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 4, right: 4, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-pine-500)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-pine-500)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--color-mute)" }} tickLine={false} axisLine={{ stroke: "var(--color-line)" }} interval={days > 30 ? 8 : 3} />
                <YAxis tick={{ fontSize: 10, fill: "var(--color-mute)" }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (v >= 1000 ? Math.round(v / 1000) + "k" : String(v))} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v), cur)} />
                <Area type="monotone" dataKey="ca" name="CA" stroke="var(--color-pine-600)" strokeWidth={2} fill="url(#caGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <button onClick={() => nav("ventes")} className="mt-2 flex items-center gap-1 text-[12px] font-bold text-copper-600 hover:text-copper-500">
            Saisir les ventes <ArrowRight size={13} />
          </button>
        </Card>

        <Card title="Valeur du stock par famille" sub="Répartition actuelle" className="xl:col-span-4">
          {data.donut.length ? (
            <div className="flex items-center gap-3">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.donut} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} strokeWidth={0}>
                      {data.donut.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v), cur)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5">
                {data.donut.map((d, i) => (
                  <li key={d.name} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink2">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PALETTE[i % PALETTE.length] }} />
                      <span className="truncate">{d.name}</span>
                    </span>
                    <span className="tnum shrink-0 font-bold text-ink">{fmtNum((d.value / (data.stockValue || 1)) * 100, 0)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="py-10 text-center text-[12.5px] text-mute">Aucune valeur de stock sur ce périmètre.</p>
          )}
        </Card>

        <Card
          title="Alertes de stock"
          sub="Ruptures, niveaux critiques et bas"
          className="xl:col-span-4"
          actions={
            data.low.length > 0 ? (
              <Badge tone="bad" dot>{data.low.length}</Badge>
            ) : (
              <Badge tone="ok" dot>Aucune</Badge>
            )
          }
        >
          {data.low.length ? (
            <ul className="space-y-2.5">
              {data.low.map((l, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", l.kind === "rupture" || l.kind === "critique" ? "bg-badbg text-bad" : "bg-warnbg text-warn")}>
                    <AlertTriangle size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-bold text-ink">{l.name}</p>
                      <span className="tnum shrink-0 font-mono text-[10.5px] font-bold text-mute">{l.site}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                        <div
                          className={cn("anim-grow h-full rounded-full", l.qty <= 0 ? "bg-bad" : "bg-warn")}
                          style={{ width: `${Math.min(100, (l.qty / (l.min || 1)) * 100)}%`, transformOrigin: "left" }}
                        />
                      </div>
                      <span className="tnum shrink-0 text-[11px] font-semibold text-ink2">
                        {fmtNum(l.qty)} / {fmtNum(l.min)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-[12.5px] text-mute">
              Tous les niveaux de stock sont au-dessus des seuils.
            </p>
          )}
        </Card>

        <Card
          title="Péremptions proches"
          sub="DLC des réceptions validées (14 jours)"
          className="xl:col-span-4"
          actions={
            data.expiries.length > 0 ? (
              <Badge tone="warn" dot>{data.expiries.length}</Badge>
            ) : (
              <Badge tone="ok" dot>Aucune</Badge>
            )
          }
        >
          {data.expiries.length ? (
            <ul className="space-y-2.5">
              {data.expiries.map((ex, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", ex.days <= 3 ? "bg-badbg text-bad" : "bg-warnbg text-warn")}>
                    <Clock size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-bold text-ink">{ex.name}</p>
                      <span className="tnum shrink-0 font-mono text-[10.5px] font-bold text-mute">{ex.site}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={cn("text-[11px] font-semibold", ex.days <= 3 ? "text-bad" : "text-warn")}>
                        {ex.days <= 0 ? "Expire aujourd'hui" : `Expire dans ${ex.days} j`} · {ex.expiry}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-[12.5px] text-mute">
              Aucune péremption proche sur ce périmètre.
            </p>
          )}
        </Card>
      </div>

      {/* journal + top conso */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card
          title="Derniers mouvements de stock"
          sub="Chaque variation est traçable : document, utilisateur, site, coût"
          className="xl:col-span-8"
          pad={false}
          actions={
            <Button variant="ghost" size="sm" onClick={() => nav("mouvements")}>
              Tout voir <ArrowRight size={13} />
            </Button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <tbody>
                {data.journal.map((m) => {
                  const p = db.products.find((x) => x.id === m.productId);
                  const s = db.sites.find((x) => x.id === m.siteId);
                  const u = db.users.find((x) => x.id === m.userId);
                  const isIn = m.qty > 0;
                  return (
                    <tr key={m.id} className="border-b border-line/70 transition-colors last:border-0 hover:bg-pine-50/60">
                      <td className="w-20 px-4 py-2.5 text-mute">{fmtDate(m.date)}</td>
                      <td className="px-2 py-2.5">
                        <Badge tone={isIn ? "ok" : "warn"}>{MV_LABELS[m.type]}</Badge>
                      </td>
                      <td className="px-2 py-2.5 font-semibold text-ink">{p?.name ?? "—"}</td>
                      <td className="px-2 py-2.5">
                        <span className="font-mono text-[10.5px] font-bold text-mute">{s?.code}</span>
                      </td>
                      <td className={cn("tnum px-2 py-2.5 text-right font-bold", isIn ? "text-ok" : "text-bad")}>
                        {isIn ? "+" : ""}{fmtNum(m.qty)}
                      </td>
                      <td className="tnum px-2 py-2.5 text-right text-ink2">{fmtMoney(m.totalCost, cur)}</td>
                      <td className="tnum hidden px-2 py-2.5 text-right font-mono text-[10.5px] text-mute md:table-cell">{m.refNumber}</td>
                      <td className="hidden w-28 px-4 py-2.5 text-right text-[11.5px] text-mute lg:table-cell">
                        {u?.name.split(" ")[0] ?? "—"} · {relTime(m.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Top produits consommés" sub={`Sur ${days} jours, valorisés au coût moyen`}>
          <ul className="space-y-3">
            {data.topConso.length === 0 && (
              <p className="py-8 text-center text-[12.5px] text-mute">Aucune consommation sur la période.</p>
            )}
            {data.topConso.map((t, i) => {
              const max = data.topConso[0]?.value || 1;
              return (
                <li key={i}>
                  <div className="flex items-center justify-between gap-2 text-[12.5px]">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <span className="tnum flex h-5 w-5 items-center justify-center rounded bg-pine-900 font-mono text-[10px] font-bold text-pine-100">{i + 1}</span>
                      {t.name}
                    </span>
                    <span className="tnum font-bold text-ink2">{fmtMoney(t.value, cur)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line">
                    <div
                      className="anim-grow h-full rounded-full bg-gradient-to-r from-pine-600 to-pine-400"
                      style={{ width: `${(t.value / max) * 100}%`, transformOrigin: "left" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <button onClick={() => nav("consommations")} className="mt-4 flex items-center gap-1 text-[12px] font-bold text-copper-600 hover:text-copper-500">
            Journal des consommations <ArrowRight size={13} />
          </button>
        </Card>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg border border-dashed border-line2 bg-card/60 px-4 py-3 text-[12px] text-mute">
        <Flame size={14} className="shrink-0 text-copper-500" />
        Règle FoodOps : le stock est toujours calculé par <strong className="text-ink2">site + produit</strong> à partir des mouvements validés — jamais de stock global.
        Les brouillons et documents annulés n'impactent pas les quantités.
      </div>
    </div>
  );
}
