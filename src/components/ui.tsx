import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { cn } from "../lib/cn";
import type { Product, Unit } from "../types";
import { useApp } from "../state/AppContext";
import { fmtMoney, fmtNum } from "../lib/util";
import type { StockStatusKind } from "../lib/engine";

export { cn };

/* ================= boutons ================= */

type BtnVariant = "primary" | "outline" | "ghost" | "danger" | "copper" | "dark";

export function Button({
  variant = "primary",
  size = "md",
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
  icon?: ReactNode;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-semibold rounded-md transition-all duration-150 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap";
  const sizes = { sm: "h-8 px-2.5 text-[12.5px]", md: "h-9.5 px-3.5 text-[13.5px]" };
  const variants: Record<BtnVariant, string> = {
    primary: "bg-pine-700 text-pine-50 hover:bg-pine-600 shadow-sm shadow-pine-900/20",
    dark: "bg-pine-950 text-pine-50 hover:bg-pine-800",
    copper: "bg-copper-500 text-white hover:bg-copper-400 shadow-sm shadow-copper-800/25",
    outline: "border border-line2 bg-card text-ink hover:border-pine-400 hover:text-pine-700",
    ghost: "text-ink2 hover:bg-pine-900/6 hover:text-ink",
    danger: "bg-bad text-white hover:bg-[#a13a24] shadow-sm",
  };
  return (
    <button className={cn(base, sizes[size], variants[variant], className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function IconBtn({
  title,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink2 transition-colors hover:bg-pine-900/8 hover:text-ink disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ================= badges ================= */

type Tone = "ok" | "warn" | "bad" | "info" | "slate" | "copper" | "pine";

const toneCls: Record<Tone, string> = {
  ok: "bg-okbg text-ok border-ok/25",
  warn: "bg-warnbg text-warn border-warn/25",
  bad: "bg-badbg text-bad border-bad/25",
  info: "bg-infobg text-info border-info/25",
  slate: "bg-ink/6 text-ink2 border-ink/12",
  copper: "bg-copper-100 text-copper-700 border-copper-500/25",
  pine: "bg-pine-100 text-pine-700 border-pine-500/25",
};

export function Badge({
  tone = "slate",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[11px] font-bold tracking-wide",
        toneCls[tone],
        className
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

const STATUS_MAP: Record<string, { label: string; tone: Tone }> = {
  brouillon: { label: "Brouillon", tone: "slate" },
  soumis: { label: "Soumis", tone: "info" },
  approuve: { label: "Approuvé", tone: "pine" },
  partiel: { label: "Partiellement reçu", tone: "warn" },
  recu: { label: "Reçu", tone: "ok" },
  valide: { label: "Validé", tone: "ok" },
  annule: { label: "Annulé", tone: "bad" },
  expedie: { label: "Expédié", tone: "info" },
  en_cours: { label: "En cours", tone: "warn" },
  payee: { label: "Payée", tone: "ok" },
  partielle: { label: "Partiellement payée", tone: "warn" },
  impayee: { label: "Impayée", tone: "slate" },
  echue: { label: "Échue", tone: "bad" },
  actif: { label: "Actif", tone: "ok" },
  inactif: { label: "Inactif", tone: "slate" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: "slate" as Tone };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function StockBadge({ kind }: { kind: StockStatusKind }) {
  const map: Record<StockStatusKind, { label: string; tone: Tone }> = {
    ok: { label: "En stock", tone: "ok" },
    bas: { label: "Stock bas", tone: "warn" },
    critique: { label: "Critique", tone: "bad" },
    rupture: { label: "Rupture", tone: "bad" },
  };
  const s = map[kind];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

/* ================= cartes & stats ================= */

export function Card({
  title,
  sub,
  actions,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-line bg-card shadow-[0_1px_2px_rgba(16,46,36,0.05)] transition-shadow hover:shadow-[0_4px_14px_rgba(16,46,36,0.07)]",
        className
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div>
            <h3 className="font-display text-[15px] font-semibold text-ink">{title}</h3>
            {sub && <p className="mt-0.5 text-[12px] text-mute">{sub}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function useCountUp(target: number, duration = 650): number {
  const [val, setVal] = useState(target);
  const fromRef = useRef(target);
  const first = useRef(true);
  
  useEffect(() => {
    if (first.current) {
      first.current = false;
      fromRef.current = 0;
    }
    const from = fromRef.current;
    const start = performance.now();
    let raf = 0;
    
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  
  return val;
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "pine",
  format = "money",
}: {
  label: string;
  value: number;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  format?: "money" | "num" | "pct";
}) {
  const { db } = useApp();
  const v = useCountUp(value);
  const display =
    format === "money"
      ? fmtMoney(v, db.company.currency)
      : format === "pct"
        ? fmtNum(v, 1) + " %"
        : fmtNum(v, 0);
        
  const iconTone: Record<Tone, string> = {
    ok: "bg-okbg text-ok",
    warn: "bg-warnbg text-warn",
    bad: "bg-badbg text-bad",
    info: "bg-infobg text-info",
    slate: "bg-ink/6 text-ink2",
    copper: "bg-copper-100 text-copper-600",
    pine: "bg-pine-100 text-pine-700",
  };
  
  return (
    <div className="group rounded-lg border border-line bg-card p-4 shadow-[0_1px_2px_rgba(16,46,36,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-line2 hover:shadow-[0_6px_18px_rgba(16,46,36,0.09)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mute">{label}</p>
        {icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-110", iconTone[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className="tnum mt-2 font-display text-[22px] font-bold leading-none text-ink">{display}</p>
      {sub && <div className="mt-2 text-[12px] leading-snug text-ink2">{sub}</div>}
    </div>
  );
}

/* ================= modales ================= */

export function Modal({ 
  open, 
  onClose, 
  title, 
  sub, 
  children, 
  footer, 
  width = "max-w-3xl",
  className
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  sub?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  className?: string;
}) {
  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 print:static print:z-auto print:p-0 ${className ?? ''}`}>
      {/* Overlay - كيختفي فـ الطباعة */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity print:hidden" 
        onClick={onClose} 
      />
      
      {/* محتوى Modal */}
      <div className={`relative z-10 w-full ${width} bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 print:static print:z-auto print:shadow-none print:rounded-none print:max-h-none print:w-full print:bg-white`}>
        
        {/* Header */}
        {(title || sub) && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0 print:hidden">
            <div>
              {title && <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>}
              {sub && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
            </div>
            <button 
              onClick={onClose}
              aria-label="Fermer"
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 print:overflow-visible print:px-0 print:py-0">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl shrink-0 print:hidden">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* ================= formulaires ================= */

export function Field({
  label,
  children,
  className,
  hint,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.1em] text-mute">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-mute">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full h-9.5 rounded-md border border-line2 bg-white px-3 text-[13.5px] text-ink placeholder:text-mute/70 transition-colors focus:border-pine-500 focus:outline-none focus:ring-2 focus:ring-pine-500/15 disabled:bg-paper disabled:text-mute";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={cn(inputCls, "appearance-none pr-8 cursor-pointer", props.className)} />
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-mute" />
    </div>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "h-auto min-h-18 py-2", props.className)} />;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputCls, "pl-8")}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-mute hover:text-ink"
          title="Effacer"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ================= onglets ================= */

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-paper p-1 w-fit">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-semibold transition-all",
            active === t.key
              ? "bg-pine-800 text-pine-50 shadow-sm"
              : "text-ink2 hover:bg-white hover:text-ink"
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span
              className={cn(
                "tnum rounded-full px-1.5 py-px text-[10.5px] font-bold",
                active === t.key ? "bg-pine-600 text-pine-50" : "bg-ink/8 text-ink2"
              )}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ================= table de données ================= */

export interface Col<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
  sortVal?: (row: T) => string | number;
  render?: (row: T) => ReactNode;
}

export function DataTable<T>({
  cols,
  rows,
  rowKey,
  onRowClick,
  empty,
  pageSize = 12,
  footer,
  dense,
}: {
  cols: Col<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  pageSize?: number;
  footer?: ReactNode;
  dense?: boolean;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = cols.find((c) => c.key === sort.key);
    if (!col?.sortVal) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortVal!(a);
      const bv = col.sortVal!(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
      return String(av).localeCompare(String(bv), "fr") * sort.dir;
    });
  }, [rows, sort, cols]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const view = sorted.slice(cur * pageSize, cur * pageSize + pageSize);

  useEffect(() => setPage(0), [rows.length, sort]);

  if (!rows.length)
    return (
      <div className="rounded-lg border border-line bg-card">
        {empty ?? (
          <EmptyState
            icon={<Inbox size={26} />}
            title="Aucune donnée"
            sub="Aucun enregistrement ne correspond à vos critères."
          />
        )}
      </div>
    );

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-left">
              {cols.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={cn(
                    "px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-mute select-none",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                    c.sortVal && "cursor-pointer hover:text-ink"
                  )}
                  onClick={() =>
                    c.sortVal &&
                    setSort((s) =>
                      s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }
                    )
                  }
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sort?.key === c.key && (
                      <ChevronDown size={12} className={cn("transition-transform", sort.dir === -1 && "rotate-180")} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr
                key={rowKey(r)}
                onClick={() => onRowClick?.(r)}
                className={cn(
                  "border-b border-line/70 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-pine-50/70"
                )}
              >
                {cols.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3.5 text-ink",
                      dense ? "py-1.5" : "py-2.5",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center"
                    )}
                  >
                    {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(footer || pages > 1) && (
        <div className="flex items-center justify-between gap-3 border-t border-line bg-paper/60 px-3.5 py-2.5">
          <div className="text-[12px] text-mute">{footer ?? `${sorted.length} enregistrement${sorted.length > 1 ? "s" : ""}`}</div>
          {pages > 1 && (
            <div className="flex items-center gap-1">
              <IconBtn title="Page précédente" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                <ChevronLeft size={15} />
              </IconBtn>
              <span className="tnum px-1 text-[12px] font-semibold text-ink2">
                {cur + 1} / {pages}
              </span>
              <IconBtn title="Page suivante" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                <ChevronRight size={15} />
              </IconBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  sub,
  action,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-pine-100 text-pine-600">
        {icon ?? <Inbox size={22} />}
      </span>
      <p className="font-display text-[15px] font-semibold text-ink">{title}</p>
      {sub && <p className="max-w-sm text-[12.5px] leading-relaxed text-mute">{sub}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function PageHead({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[24px] font-bold leading-tight text-ink">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-ink2">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ================= jauge Food Cost ================= */

export function Gauge({
  value,
  target,
  size = 168,
}: {
  value: number;
  target: number;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(60, value));
  const angle = -90 + (clamped / 60) * 180;
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const r = size / 2 - 14;
  
  const arc = (from: number, to: number) => {
    const f = rad(from);
    const t = rad(to);
    return `M ${cx + r * Math.cos(f)} ${cy + r * Math.sin(f)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${cx + r * Math.cos(t)} ${cy + r * Math.sin(t)}`;
  };
  
  const targetAngle = -90 + (Math.min(60, target) / 60) * 180;
  const over = value > target;
  
  return (
    <svg width={size} height={size / 2 + 26} viewBox={`0 0 ${size} ${size / 2 + 26}`}>
      <path d={arc(-90, 90)} fill="none" stroke="var(--color-line)" strokeWidth="11" strokeLinecap="round" />
      <path
        d={arc(-90, Math.max(-89.9, angle))}
        fill="none"
        stroke={over ? "var(--color-bad)" : "var(--color-ok)"}
        strokeWidth="11"
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      <line
        x1={cx + (r - 15) * Math.cos(rad(targetAngle))}
        y1={cy + (r - 15) * Math.sin(rad(targetAngle))}
        x2={cx + (r + 10) * Math.cos(rad(targetAngle))}
        y2={cy + (r + 10) * Math.sin(rad(targetAngle))}
        stroke="var(--color-copper-500)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <text x={cx} y={cy - 6} textAnchor="middle" className="font-display" fontSize="26" fontWeight="700" fill="var(--color-ink)">
        {fmtNum(value, 1)}%
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--color-mute)">
        objectif {fmtNum(target, 0)} %
      </text>
    </svg>
  );
}

/* ================= éditeur de lignes de document ================= */

export interface EditLine {
  productId: string;
  qty: number;
  orderedQty?: number;
  unitCost: number;
  lot?: string;
  expiry?: string;
}

export function LineEditor({
  rows,
  onChange,
  products,
  units,
  showOrdered,
  showCost = true,
  costEditable = true,
  showLot,
  qtyLabel = "Quantité",
}: {
  rows: EditLine[];
  onChange: (rows: EditLine[]) => void;
  products: Product[];
  units: Unit[];
  showOrdered?: boolean;
  showCost?: boolean;
  costEditable?: boolean;
  showLot?: boolean;
  qtyLabel?: string;
}) {
  const { db } = useApp();
  const unitOf = (id: string) => units.find((u) => u.id === id)?.code ?? "";
  const total = rows.reduce((s, l) => s + l.qty * l.unitCost, 0);

  const update = (i: number, patch: Partial<EditLine>) =>
    onChange(rows.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-left text-[10.5px] font-bold uppercase tracking-[0.1em] text-mute">
              <th className="px-2.5 py-2">Produit</th>
              {showOrdered && <th className="px-2 py-2 text-right">Commandé</th>}
              <th className="px-2 py-2 text-right">{qtyLabel}</th>
              <th className="px-2 py-2 text-center">Unité</th>
              {showCost && <th className="px-2 py-2 text-right">PU HT</th>}
              {showLot && <th className="px-2 py-2">Lot / DLC</th>}
              <th className="px-2 py-2 text-right">Total</th>
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => {
              const p = products.find((x) => x.id === l.productId);
              return (
                <tr key={i} className="border-b border-line/70 last:border-0">
                  <td className="px-1.5 py-1.5">
                    <Select
                      value={l.productId}
                      onChange={(e) => {
                        const np = products.find((x) => x.id === e.target.value);
                        update(i, {
                          productId: e.target.value,
                          unitCost: costEditable && np ? np.purchasePrice : l.unitCost,
                        });
                      }}
                      className="h-8.5 min-w-44 text-[12.5px]"
                    >
                      <option value="">— Choisir —</option>
                      {products.map((p2) => (
                        <option key={p2.id} value={p2.id}>
                          {p2.code} · {p2.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  {showOrdered && (
                    <td className="tnum px-2 py-1.5 text-right text-ink2">{fmtNum(l.orderedQty ?? 0)}</td>
                  )}
                  <td className="px-1.5 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.qty || ""}
                      placeholder="0"
                      onChange={(e) => update(i, { qty: parseFloat(e.target.value) || 0 })}
                      className="h-8.5 w-22 text-right tnum"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center text-[11.5px] font-semibold text-mute">
                    {p ? unitOf(p.unitId) : "—"}
                  </td>
                  {showCost && (
                    <td className="px-1.5 py-1.5">
                      {costEditable ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.unitCost || ""}
                          placeholder="0,00"
                          onChange={(e) => update(i, { unitCost: parseFloat(e.target.value) || 0 })}
                          className="h-8.5 w-24 text-right tnum"
                        />
                      ) : (
                        <span className="tnum block px-2 text-right">{fmtNum(l.unitCost)}</span>
                      )}
                    </td>
                  )}
                  {showLot && (
                    <td className="px-1.5 py-1.5">
                      <div className="flex gap-1">
                        <Input
                          value={l.lot ?? ""}
                          placeholder="Lot"
                          onChange={(e) => update(i, { lot: e.target.value })}
                          className="h-8.5 w-20 text-[11.5px]"
                        />
                        <Input
                          type="date"
                          value={l.expiry ?? ""}
                          onChange={(e) => update(i, { expiry: e.target.value })}
                          className="h-8.5 w-32 text-[11.5px]"
                        />
                      </div>
                    </td>
                  )}
                  <td className="tnum px-2.5 py-1.5 text-right font-semibold">
                    {showCost ? fmtMoney(l.qty * l.unitCost, db.company.currency) : fmtNum(l.qty)}
                  </td>
                  <td className="py-1.5 pr-1.5 text-center">
                    <IconBtn title="Supprimer la ligne" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-[12.5px] text-mute">
                  Aucune ligne — ajoutez des produits ci-dessous.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() =>
            onChange([
              ...rows,
              { productId: "", qty: 0, unitCost: 0, ...(showLot ? { lot: "", expiry: "" } : {}) },
            ])
          }
        >
          Ajouter une ligne
        </Button>
        <div className="text-[13px] font-semibold text-ink2">
          Total HT :{" "}
          <span className="tnum font-display text-[15px] font-bold text-ink">
            {fmtMoney(total, db.company.currency)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* divers */
export function CheckIcon() {
  return <Check size={14} />;
}

/* ================= confirmation dialog ================= */

export function Confirm({
  open,
  onClose,
  title,
  message,
  onConfirm,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "danger",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: React.ReactNode; // <-- هاد التغيير هو لي غادي يحل مشكلة 'Element'
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary" | "copper";
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="text-[13.5px] text-ink2 leading-relaxed mb-6">{message}</div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          {cancelText}
        </Button>
        <Button 
          variant={variant === "danger" ? "danger" : variant === "copper" ? "copper" : "primary"} 
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}