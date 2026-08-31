import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Crown,
  Database,
  Factory,
  FileText,
  Flag,
  Flame,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Percent,
  Receipt,
  Ruler,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Soup,
  Tags,
  Trash2,
  Truck,
  UserRound,
  UtensilsCrossed,
  Wallet,
  X,
  CheckCheck,
} from "lucide-react";
import { useApp, type Toast } from "../state/AppContext";
import { cn, Badge } from "./ui";
import { computeStocks, entryOf, invoiceStatus, stockStatus, siteExpiries } from "../lib/engine";
import { fmtDate, ROLE_LABELS, todayISO } from "../lib/util";

export const ROUTE_TITLES: Record<string, string> = {
  dashboard: "Tableau de bord",
  proprietaire: "Espace propriétaire",
  "referentiel:produits": "Référentiel — Produits",
  "referentiel:categories": "Référentiel — Catégories",
  "referentiel:unites": "Référentiel — Unités",
  "referentiel:fournisseurs": "Référentiel — Fournisseurs",
  achats: "Bons de commande",
  receptions: "Réceptions",
  factures: "Factures fournisseurs",
  reglements: "Règlements fournisseurs",
  stock: "Stock actuel",
  mouvements: "Mouvements de stock",
  transferts: "Transferts inter-sites",
  "stock-initial": "Stock initial",
  inventaires: "Inventaires",
  pertes: "Pertes & déchets",
  consommations: "Consommations",
  ventes: "Ventes & Food Cost",
  produits: "Produits",
  categories: "Catégories & unités",
  fournisseurs: "Fournisseurs",
  rapports: "Rapports",
  utilisateurs: "Utilisateurs",
  parametres: "Paramètres",
  audit: "Journal d'audit",
  sauvegarde: "Sauvegarde & restauration",
};

const NAV: {
  group: string;
  items: { route: string; label: string; icon: ReactNode; perm: string }[];
}[] = [
  {
    group: "Pilotage",
    items: [{ route: "dashboard", label: "Tableau de bord", icon: <LayoutDashboard size={16} />, perm: "dashboard.view" }],
  },
  {
    group: "Direction",
    items: [{ route: "proprietaire", label: "Espace propriétaire", icon: <Crown size={16} />, perm: "proprietaire.view" }],
  },
  {
    group: "Opérations",
    items: [
      { route: "achats", label: "Bons de commande", icon: <ShoppingBag size={16} />, perm: "purchases.view" },
      { route: "receptions", label: "Réceptions", icon: <Truck size={16} />, perm: "receptions.view" },
      { route: "factures", label: "Factures fournisseurs", icon: <FileText size={16} />, perm: "purchases.view" },
      { route: "reglements", label: "Règlements", icon: <CreditCard size={16} />, perm: "purchases.view" },
    ],
  },
  {
    group: "Stock",
    items: [
      { route: "stock", label: "Stock actuel", icon: <Boxes size={16} />, perm: "stock.view" },
      { route: "mouvements", label: "Mouvements", icon: <History size={16} />, perm: "stock.view" },
      { route: "transferts", label: "Transferts", icon: <ArrowLeftRight size={16} />, perm: "stock.transfer" },
      { route: "stock-initial", label: "Stock initial", icon: <Flag size={16} />, perm: "stock.adjust" },
      { route: "inventaires", label: "Inventaires", icon: <ClipboardCheck size={16} />, perm: "inventory.view" },
      { route: "pertes", label: "Pertes", icon: <Trash2 size={16} />, perm: "waste.view" },
    ],
  },
  {
    group: "Consommation & ventes",
    items: [
      { route: "consommations", label: "Consommations", icon: <Soup size={16} />, perm: "consumption.view" },
      { route: "ventes", label: "Ventes & Food Cost", icon: <Percent size={16} />, perm: "sales.view" },
    ],
  },
  {
    group: "Référentiel",
    items: [
      { route: "referentiel:produits", label: "Produits", icon: <UtensilsCrossed size={16} />, perm: "products.view" },
      { route: "referentiel:categories", label: "Catégories", icon: <Tags size={16} />, perm: "products.view" },
      { route: "referentiel:unites", label: "Unités", icon: <Ruler size={16} />, perm: "products.view" },
      { route: "referentiel:fournisseurs", label: "Fournisseurs", icon: <Factory size={16} />, perm: "suppliers.view" },
    ],
  },
  {
    group: "Analyse",
    items: [{ route: "rapports", label: "Rapports", icon: <BarChart3 size={16} />, perm: "reports.view" }],
  },
  {
    group: "Administration",
    items: [
      { route: "utilisateurs", label: "Utilisateurs", icon: <UserRound size={16} />, perm: "users.view" },
      { route: "parametres", label: "Paramètres", icon: <Settings size={16} />, perm: "settings.view" },
      { route: "audit", label: "Journal d'audit", icon: <ShieldCheck size={16} />, perm: "audit.view" },
      { route: "sauvegarde", label: "Sauvegarde", icon: <Database size={16} />, perm: "backup.manage" },
    ],
  },
];

/* ---------- logo ---------- */
export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect x="3" y="3" width="34" height="34" rx="9" fill="var(--color-copper-500)" />
      <rect x="3" y="3" width="34" height="34" rx="9" fill="url(#lg1)" fillOpacity="0.35" />
      <path d="M12 13.5h16M12 20h16M12 26.5h10" stroke="#0a2019" strokeWidth="3" strokeLinecap="round" />
      <circle cx="28.5" cy="26.5" r="3.2" fill="#0a2019" />
      <defs>
        <linearGradient id="lg1" x1="3" y1="3" x2="37" y2="37">
          <stop stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------- toasts ---------- */
function ToastHost() {
  const { toasts, dismissToast } = useApp();
  const style: Record<Toast["kind"], string> = {
    success: "border-l-ok",
    error: "border-l-bad",
    warn: "border-l-warn",
    info: "border-l-info",
  };
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(380px,90vw)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "anim-toast pointer-events-auto flex items-start gap-2.5 rounded-md border border-line border-l-4 bg-card px-3.5 py-3 shadow-lg shadow-pine-950/10",
            style[t.kind]
          )}
        >
          <p className="flex-1 text-[13px] font-medium leading-snug text-ink">{t.msg}</p>
          <button onClick={() => dismissToast(t.id)} className="text-mute hover:text-ink" title="Fermer">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------- sélecteur de site ---------- */
function SiteSelector() {
  const { allowedSites, siteId, setSite, db } = useApp();
  const [open, setOpen] = useState(false);
  const current = siteId ? db.sites.find((s) => s.id === siteId) : null;
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-md border border-line2 bg-card px-3 text-[13px] font-semibold text-ink transition-colors hover:border-pine-400"
        title="Changer de site — toutes les données affichées dépendent de ce choix"
      >
        <Building2 size={15} className="text-pine-600" />
        <span className="max-w-40 truncate">{current ? current.name : "Tous les sites"}</span>
        {current && (
          <span className="tnum rounded bg-pine-100 px-1.5 py-px font-mono text-[10.5px] font-bold text-pine-700">
            {current.code}
          </span>
        )}
        <ChevronDown size={14} className={cn("text-mute transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute left-0 z-50 mt-1.5 w-64 rounded-lg border border-line bg-card p-1.5 shadow-xl shadow-pine-950/12">
            <p className="px-2.5 pb-1 pt-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute">
              Site de travail
            </p>
            <button
              onClick={() => {
                setSite(null);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[13px] font-semibold hover:bg-pine-50",
                !siteId ? "text-pine-700" : "text-ink"
              )}
            >
              Tous les sites (consolidé)
              {!siteId && <Check size={15} className="text-copper-600" />}
            </button>
            <div className="my-1 border-t border-line" />
            {allowedSites.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSite(s.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left hover:bg-pine-50",
                  siteId === s.id ? "text-pine-700" : "text-ink"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="tnum flex h-7 w-9 items-center justify-center rounded bg-pine-900 font-mono text-[10.5px] font-bold text-pine-100">
                    {s.code}
                  </span>
                  <span className="text-[13px] font-semibold">{s.name}</span>
                </span>
                {siteId === s.id && <Check size={15} className="text-copper-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- notifications ---------- */
function NotifBell() {
  const { db, siteId, allowedSites, nav } = useApp();
  const [open, setOpen] = useState(false);

  const alerts = useMemo(() => {
    const list: { label: string; detail: string; tone: "bad" | "warn" | "info"; route: string }[] = [];
    const sites = siteId ? [siteId] : allowedSites.map((s) => s.id);
    const stocks = computeStocks(db);
    for (const sid of sites) {
      const siteName = db.sites.find((s) => s.id === sid)?.name ?? "";
      for (const p of db.products.filter((x) => x.status === "actif")) {
        const e = entryOf(stocks, sid, p.id);
        if (!db.movements.some((m) => m.siteId === sid && m.productId === p.id)) continue;
        const st = stockStatus(e.qty, p);
        if (st === "rupture")
          list.push({ label: `Rupture — ${p.name}`, detail: siteName, tone: "bad", route: "stock" });
        else if (st === "critique")
          list.push({ label: `Stock critique — ${p.name}`, detail: `${siteName} · ${e.qty} restants`, tone: "bad", route: "stock" });
      }
    }
    for (const inv of db.invoices) {
      if (invoiceStatus(db, inv) === "echue") {
        const sup = db.suppliers.find((s) => s.id === inv.supplierId);
        list.push({ label: `Facture échue ${inv.number}`, detail: sup?.name ?? "", tone: "warn", route: "factures" });
      }
    }
    for (const t of db.transfers.filter((t) => t.status === "approuve" || t.status === "brouillon")) {
      list.push({
        label: `Transfert ${t.number} en attente`,
        detail: `${db.sites.find((s) => s.id === t.fromSiteId)?.code} → ${db.sites.find((s) => s.id === t.toSiteId)?.code}`,
        tone: "info",
        route: "transferts",
      });
    }
    for (const i of db.inventories.filter((i) => i.status === "en_cours")) {
      list.push({
        label: `Inventaire ${i.number} à compléter`,
        detail: db.sites.find((s) => s.id === i.siteId)?.name ?? "",
        tone: "info",
        route: "inventaires",
      });
    }
    const nowMs = Date.now();
    for (const sid of sites) {
      for (const ex of siteExpiries(db, sid)) {
        const e = entryOf(stocks, sid, ex.productId);
        if (!e || e.qty <= 0) continue;
        const p = db.products.find((x) => x.id === ex.productId);
        const d = Math.max(Math.ceil((Date.parse(ex.expiry) - nowMs) / 86400000), 0);
        list.push({
          label: `DLC proche — ${p?.name ?? ex.productId}`,
          detail: `${db.sites.find((s) => s.id === sid)?.name ?? ""} · expire dans ${d} j`,
          tone: d <= 3 ? "bad" : "warn",
          route: "stock",
        });
      }
    }
    return list.slice(0, 14);
  }, [db, siteId, allowedSites]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line2 bg-card text-ink2 transition-colors hover:border-pine-400 hover:text-ink"
        title="Notifications"
      >
        <Bell size={16} />
        {alerts.length > 0 && (
          <span className="tnum absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-copper-500 px-1 text-[10px] font-bold text-white">
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute right-0 z-50 mt-1.5 w-[340px] rounded-lg border border-line bg-card shadow-xl shadow-pine-950/12">
            <p className="border-b border-line px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-mute">
              Alertes & éléments en attente
            </p>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {alerts.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-mute">
                  <CheckCheck size={18} className="mx-auto mb-1.5 text-ok" />
                  Aucune alerte. Tout est sous contrôle.
                </p>
              )}
              {alerts.map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    nav(a.route);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-pine-50"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      a.tone === "bad" ? "bg-bad" : a.tone === "warn" ? "bg-warn" : "bg-info"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">{a.label}</span>
                    <span className="block truncate text-[11.5px] text-mute">{a.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- coquille ---------- */
export function Layout({ children }: { children: ReactNode }) {
  const { user, route, nav, logout, can, db } = useApp();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebar = (
    <aside className="side-bg flex h-full w-[236px] flex-col text-pine-100">
      <div className="flex items-center gap-2.5 px-4 pb-5 pt-5">
        <LogoMark />
        <div>
          <p className="font-display text-[17px] font-bold leading-none text-white">FoodOps</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-pine-300">
            F&B Control Suite
          </p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {NAV.map((g) => {
          const items = g.items.filter((i) => can(i.perm));
          if (!items.length) return null;
          const closed = collapsed[g.group];
          return (
            <div key={g.group} className="mb-1.5">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g.group]: !closed }))}
                className="flex w-full items-center justify-between px-2.5 pb-1 pt-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-pine-300/80 hover:text-pine-200"
              >
                {g.group}
                <ChevronDown size={12} className={cn("transition-transform duration-200", closed && "-rotate-90")} />
              </button>
              {!closed && (
                <div className="space-y-0.5">
                  {items.map((i) => {
                    const active = route === i.route;
                    return (
                      <button
                        key={i.route}
                        onClick={() => {
                          nav(i.route);
                          setMobileOpen(false);
                        }}
                        className={cn(
                          "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7.5px] text-left text-[13px] font-semibold transition-all duration-150",
                          active
                            ? "bg-white/10 text-white"
                            : "text-pine-200/75 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-0 top-1/2 h-4.5 w-[3px] -translate-y-1/2 rounded-r-full bg-copper-400 transition-all",
                            active ? "opacity-100" : "opacity-0 group-hover:opacity-40"
                          )}
                        />
                        <span className={cn(active ? "text-copper-300" : "text-pine-300/70 group-hover:text-pine-200")}>
                          {i.icon}
                        </span>
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-md bg-white/5 px-2.5 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-copper-500 font-display text-[12px] font-bold text-white">
            {user?.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-white">{user?.name}</p>
            <p className="truncate text-[10.5px] text-pine-300">{user ? ROLE_LABELS[user.role] : ""}</p>
          </div>
          <button onClick={logout} title="Se déconnecter" className="text-pine-300 transition-colors hover:text-white">
            <LogOut size={15} />
          </button>
        </div>
        <p className="mt-2 px-1 text-center text-[10px] text-pine-400/70">
          {db.company.name} · base locale hors-ligne
        </p>
      </div>
    </aside>
  );

  return (
    <div className="flex h-full overflow-hidden">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-pine-950/60 anim-fade" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full anim-fade-up">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[58px] shrink-0 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur-sm">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-line2 bg-card lg:hidden"
            onClick={() => setMobileOpen(true)}
            title="Menu"
          >
            <Menu size={17} />
          </button>
          <div className="min-w-0">
            <p className="font-display text-[16px] font-bold leading-tight text-ink">
              {ROUTE_TITLES[route] ?? "FoodOps"}
            </p>
            <p className="hidden items-center gap-1 text-[11px] text-mute sm:flex">
              <CalendarDays size={11} />
              {fmtDate(todayISO())} · {db.company.name}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <SiteSelector />
            <NotifBell />
            <div className="hidden items-center gap-2 rounded-md border border-line2 bg-card px-2.5 py-1.5 sm:flex">
              <Wallet size={14} className="text-pine-600" />
              <span className="text-[12px] font-bold text-ink2">{db.company.currency}</span>
            </div>
          </div>
        </header>

        <main className="ledger-bg flex-1 overflow-y-auto">
          <div key={route} className="anim-fade-up mx-auto w-full max-w-[1380px] px-4 py-5 lg:px-6">
            {children}
          </div>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}

export { Badge as LayoutBadge };
