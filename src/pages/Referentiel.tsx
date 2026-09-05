import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Download,
  Factory,
  Library,
  Pencil,
  Plus,
  Ruler,
  Tags,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useApp } from "../state/AppContext";
import {
  Badge,
  Button,
  Card,
  Confirm,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  SearchInput,
  Select,
  StockBadge,
  Tabs,
  Textarea,
  cn,
  useCountUp,
  type Col,
} from "../components/ui";
import { computeStocks, entryOf, stockStatus, supplierBalance } from "../lib/engine";
import type { Category, Product, Supplier } from "../types";
import { downloadFile, fmtMoney, fmtNum, nowISO, toCSV, todayISO, uid } from "../lib/util";

export type RefTab = "produits" | "categories" | "unites" | "fournisseurs";

/* ---------- statistique animée ---------- */
function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  const v = useCountUp(value);
  return (
    <div className="min-w-[92px]">
      <p className={cn("tnum font-display text-[26px] font-bold leading-none", accent ? "text-copper-300" : "text-pine-50")}>
        {fmtNum(v, 0)}
      </p>
      <p className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-pine-300">{label}</p>
    </div>
  );
}

/* ============================================================
   HUB — RÉFÉRENTIEL CENTRAL
   ============================================================ */
export function ReferentielPage({ tab: initialTab = "produits" }: { tab?: RefTab }) {
  const { db, route, can } = useApp();
  const [tab, setTab] = useState<RefTab>(initialTab);

  // deep-link : la route « referentiel:<registre> » pilote l'onglet actif
  useEffect(() => {
    const t = route.split(":")[1] as RefTab | undefined;
    if (t && ["produits", "categories", "unites", "fournisseurs"].includes(t)) setTab(t);
  }, [route]);

  const actifs = db.products.filter((p) => p.status === "actif").length;
  const familles = db.categories.filter((c) => !c.parentId).length;

  const tabs = [
    { key: "produits", label: "Produits", count: db.products.length },
    { key: "categories", label: "Catégories", count: db.categories.length },
    { key: "unites", label: "Unités", count: db.units.length },
    ...(can("suppliers.view") ? [{ key: "fournisseurs", label: "Fournisseurs", count: db.suppliers.length }] : []),
  ];

  return (
    <div>
      {/* bandeau référentiel */}
      <div className="side-bg relative mb-4 overflow-hidden rounded-xl border border-pine-800 px-6 py-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "38px 38px",
          }}
        />
        <div className="relative flex flex-wrap items-center gap-x-10 gap-y-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-copper-500 text-pine-950 shadow-lg shadow-copper-500/25">
              <Library size={22} />
            </span>
            <div>
              <h1 className="font-display text-[22px] font-bold leading-tight text-white">Référentiel central</h1>
              <p className="text-[12.5px] font-medium text-pine-300">
                Données maîtres de l'entreprise — la source unique des produits, familles, unités et partenaires.
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-8 gap-y-3">
            <Stat label="Produits" value={db.products.length} accent />
            <Stat label="Actifs" value={actifs} />
            <Stat label="Familles" value={familles} />
            <Stat label="Unités" value={db.units.length} />
            {can("suppliers.view") && <Stat label="Fournisseurs" value={db.suppliers.length} />}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as RefTab)} />
      </div>

      <div key={tab} className="anim-fade-up">
        {tab === "produits" && <ProduitsTab />}
        {tab === "categories" && <CategoriesTab />}
        {tab === "unites" && <UnitesTab />}
        {tab === "fournisseurs" && can("suppliers.view") && <FournisseursTab />}
      </div>
    </div>
  );
}

/* ============================================================
   REGISTRE PRODUITS
   ============================================================ */
function ProduitsTab() {
  const { db, siteId, siteName, act, can, toast, user } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [fam, setFam] = useState("");
  const [st, setSt] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const emptyForm = (): Product => ({
    id: uid(),
    code: "PRD-" + String(db.products.length + 1).padStart(3, "0"),
    name: "",
    categoryId: db.categories[0]?.id ?? "",
    unitId: db.units[0]?.id ?? "",
    purchaseUnitId: db.units[0]?.id ?? "",
    conversion: 1,
    vatRate: db.company.defaultVat,
    minStock: 0,
    reorderPoint: 0,
    supplierId: null,
    purchasePrice: 0,
    status: "actif",
    createdAt: nowISO(),
  });
  const [form, setForm] = useState<Product>(emptyForm());

  const stocks = useMemo(() => (siteId ? computeStocks(db, { siteId }) : null), [db, siteId]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return db.products.filter((p) => {
      if (fam) {
        const c = db.categories.find((x) => x.id === p.categoryId);
        const root = c?.parentId ?? c?.id;
        if (root !== fam && p.categoryId !== fam) return false;
      }
      if (st && p.status !== st) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [db, search, fam, st]);

  const save = () => {
    if (!form.name.trim()) {
      toast("Le nom du produit est obligatoire.", "error");
      return;
    }
    if (db.products.some((p) => p.code === form.code && p.id !== form.id)) {
      toast(`Le code « ${form.code} » est déjà utilisé.`, "error");
      return;
    }
    const isNew = !db.products.some((p) => p.id === form.id);
    const ok = act((d) => {
      const i = d.products.findIndex((p) => p.id === form.id);
      if (i >= 0) d.products[i] = form;
      else d.products.push(form);
      d.audit.push({
        id: uid(), userId: user?.id ?? "", userName: user?.name ?? "Utilisateur",
        action: isNew ? "CREATE" : "UPDATE", module: "Référentiel",
        detail: `Produit « ${form.name} » ${isNew ? "créé" : "mis à jour"}`, siteId: null, date: nowISO(),
      });
    }, isNew ? `Produit « ${form.name} » ajouté au référentiel.` : `Produit « ${form.name} » mis à jour.`);
    if (ok) setShowEdit(false);
  };

  const toggle = (p: Product) => {
    const hasHistory = db.movements.some((m) => m.productId === p.id);
    if (p.status === "actif" && hasHistory) {
      setConfirm({
        title: "Désactiver ce produit ?",
        msg: `« ${p.name} » possède un historique de stock : il sera désactivé (conservé pour les rapports) et non supprimé.`,
        fn: () => act((d) => { const x = d.products.find((y) => y.id === p.id); if (x) x.status = "inactif"; }, `Produit « ${p.name} » désactivé — historique conservé.`),
      });
    } else {
      act((d) => { const x = d.products.find((y) => y.id === p.id); if (x) x.status = x.status === "actif" ? "inactif" : "actif"; }, `Produit « ${p.name} » ${p.status === "actif" ? "désactivé" : "réactivé"}.`);
    }
  };

  const remove = (p: Product) => {
    if (db.movements.some((m) => m.productId === p.id)) {
      toast(`« ${p.name} » a des mouvements de stock : suppression impossible, utilisez la désactivation.`, "warn");
      return;
    }
    setConfirm({
      title: "Supprimer ce produit ?",
      msg: `« ${p.name} » n'a aucun historique : la suppression est définitive.`,
      fn: () => act((d) => { d.products = d.products.filter((y) => y.id !== p.id); }, `Produit « ${p.name} » supprimé du référentiel.`),
    });
  };

  const exportCSV = () =>
    downloadFile(
      `referentiel-produits-${todayISO()}.csv`,
      toCSV(
        [
          { key: "code", label: "Code" }, { key: "nom", label: "Nom" }, { key: "famille", label: "Famille" },
          { key: "unite", label: "Unité base" }, { key: "achat", label: "Unité achat" }, { key: "conv", label: "Conversion" },
          { key: "prix", label: "Prix d'achat" }, { key: "tva", label: "TVA %" }, { key: "min", label: "Min" },
          { key: "reappro", label: "Réappro" }, { key: "fournisseur", label: "Fournisseur" }, { key: "statut", label: "Statut" },
        ],
        rows.map((p) => ({
          code: p.code, nom: p.name,
          famille: db.categories.find((c) => c.id === p.categoryId)?.name ?? "",
          unite: db.units.find((u) => u.id === p.unitId)?.code ?? "",
          achat: db.units.find((u) => u.id === p.purchaseUnitId)?.code ?? "",
          conv: p.conversion, prix: p.purchasePrice.toFixed(2), tva: p.vatRate,
          min: p.minStock, reappro: p.reorderPoint,
          fournisseur: db.suppliers.find((s) => s.id === p.supplierId)?.name ?? "",
          statut: p.status,
        }))
      ),
      "text/csv"
    );

  const cols: Col<Product>[] = [
    { key: "code", label: "Code", sortVal: (p) => p.code, render: (p) => <span className="font-mono text-[11px] font-bold text-ink2">{p.code}</span> },
    {
      key: "name", label: "Produit", sortVal: (p) => p.name,
      render: (p) => (
        <div>
          <p className={cn("font-bold", p.status === "inactif" ? "text-mute line-through decoration-mute/50" : "text-ink")}>{p.name}</p>
          <p className="text-[11px] text-mute">{db.categories.find((c) => c.id === p.categoryId)?.name}</p>
        </div>
      ),
    },
    {
      key: "unit", label: "Unités & conversion",
      render: (p) => {
        const base = db.units.find((u) => u.id === p.unitId)?.code;
        const buy = db.units.find((u) => u.id === p.purchaseUnitId)?.code;
        return p.purchaseUnitId === p.unitId ? (
          <Badge tone="slate">{base}</Badge>
        ) : (
          <span className="tnum text-[12px] font-semibold text-ink2">
            {base} <span className="text-mute">← {buy} ×{p.conversion}</span>
          </span>
        );
      },
    },
    { key: "price", label: "Prix d'achat", align: "right", sortVal: (p) => p.purchasePrice, render: (p) => <span className="tnum font-semibold">{fmtMoney(p.purchasePrice, cur)}</span> },
    { key: "tva", label: "TVA", align: "center", render: (p) => <span className="tnum text-ink2">{p.vatRate} %</span> },
    { key: "seuils", label: "Min / Réappro", align: "right", render: (p) => <span className="tnum text-[12px] text-ink2">{fmtNum(p.minStock)} / {fmtNum(p.reorderPoint)}</span> },
    {
      key: "stock", label: siteId ? `Stock · ${siteName(siteId)}` : "Stock", align: "right",
      sortVal: (p) => (siteId && stocks ? entryOf(stocks, siteId, p.id).qty : 0),
      render: (p) => {
        if (!siteId || !stocks) return <span className="text-[11px] text-mute">tous sites</span>;
        const e = entryOf(stocks, siteId, p.id);
        const touched = db.movements.some((m) => m.siteId === siteId && m.productId === p.id);
        return (
          <span className="flex items-center justify-end gap-2">
            <span className="tnum font-bold">{touched ? fmtNum(e.qty) : "—"}</span>
            {touched && <StockBadge kind={stockStatus(e.qty, p)} />}
          </span>
        );
      },
    },
    {
      key: "st", label: "Statut", sortVal: (p) => p.status,
      render: (p) => <Badge tone={p.status === "actif" ? "ok" : "slate"} dot>{p.status === "actif" ? "Actif" : "Inactif"}</Badge>,
    },
    {
      key: "act", label: "Actions",
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          {can("products.edit") && (
            <Button size="sm" variant="ghost" onClick={() => { setForm({ ...p }); setEditing(p); setShowEdit(true); }} icon={<Pencil size={13} />}>Modifier</Button>
          )}
          {can("products.edit") && (
            <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.status === "actif" ? "Désactiver" : "Réactiver"}</Button>
          )}
          {can("products.delete") && (
            <Button size="sm" variant="ghost" className="text-bad" onClick={() => remove(p)} icon={<Trash2 size={13} />}>Supprimer</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Nom ou code produit…" className="w-64" />
        <Select value={fam} onChange={(e) => setFam(e.target.value)} className="w-52">
          <option value="">Toutes les familles</option>
          {db.categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={st} onChange={(e) => setSt(e.target.value)} className="w-40">
          <option value="">Tous statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </Select>
        <span className="text-[12px] font-semibold text-mute">{rows.length} fiche(s)</span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={exportCSV}>Export CSV</Button>
          {can("products.create") && (
            <Button size="sm" icon={<Plus size={13} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowEdit(true); }}>Nouveau produit</Button>
          )}
        </div>
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(p) => p.id} pageSize={12}
        empty={<EmptyState icon={<UtensilsCrossed size={24} />} title="Aucun produit dans ce filtre" sub="Ajoutez une référence ou élargissez la recherche." action={can("products.create") ? <Button icon={<Plus size={15} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowEdit(true); }}>Nouveau produit</Button> : undefined} />}
      />

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={editing ? `Modifier — ${editing.name}` : "Nouveau produit"} width="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setShowEdit(false)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code / SKU"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nom" className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Riz blanc étuvé" /></Field>
          <Field label="Famille / catégorie">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              {db.categories.map((c) => <option key={c.id} value={c.id}>{c.parentId ? "— " : ""}{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Unité de base">
            <Select value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })}>
              {db.units.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </Select>
          </Field>
          <Field label="Unité d'achat">
            <Select value={form.purchaseUnitId} onChange={(e) => setForm({ ...form, purchaseUnitId: e.target.value })}>
              {db.units.map((u) => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </Select>
          </Field>
          <Field label="Conversion (achat → base)" hint="ex. 1 sac = 25 kg">
            <Input type="number" min={0.01} step="0.01" value={form.conversion || ""} onChange={(e) => setForm({ ...form, conversion: parseFloat(e.target.value) || 1 })} />
          </Field>
          <Field label={`Prix d'achat (${cur})`}>
            <Input type="number" min={0} step="0.01" value={form.purchasePrice || ""} onChange={(e) => setForm({ ...form, purchasePrice: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="TVA %">
            <Input type="number" min={0} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Stock minimum"><Input type="number" min={0} step="0.01" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Seuil de réapprovisionnement"><Input type="number" min={0} step="0.01" value={form.reorderPoint || ""} onChange={(e) => setForm({ ...form, reorderPoint: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Fournisseur par défaut">
            <Select value={form.supplierId ?? ""} onChange={(e) => setForm({ ...form, supplierId: e.target.value || null })}>
              <option value="">— Aucun —</option>
              {db.suppliers.filter((s) => s.status === "actif").map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

/* ============================================================
   REGISTRE CATÉGORIES
   ============================================================ */
function CategoriesTab() {
  const { db, act, can, toast } = useApp();
  const [newCat, setNewCat] = useState("");
  const [parent, setParent] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const roots = db.categories.filter((c) => !c.parentId);
  const countFor = (id: string) =>
    db.products.filter((p) => p.categoryId === id || db.categories.some((c) => c.parentId === id && p.categoryId === c.id)).length;

  const add = () => {
    if (!newCat.trim()) return;
    act((d) => { d.categories.push({ id: uid(), name: newCat.trim(), parentId: parent || null }); }, `Catégorie « ${newCat.trim()} » créée.`);
    setNewCat("");
  };

  const remove = (c: Category) => {
    const used = db.products.some((p) => p.categoryId === c.id) || db.categories.some((x) => x.parentId === c.id);
    if (used) {
      toast(`« ${c.name} » est utilisée par des produits ou des sous-catégories : suppression impossible.`, "warn");
      return;
    }
    setConfirm({
      title: "Supprimer la catégorie ?",
      msg: `« ${c.name} » n'est utilisée nulle part : suppression définitive.`,
      fn: () => act((d) => { d.categories = d.categories.filter((x) => x.id !== c.id); }, `Catégorie « ${c.name} » supprimée.`),
    });
  };

  const maxCount = Math.max(1, ...roots.map((r) => countFor(r.id)));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card title="Familles & sous-familles" sub="Plan de classement du catalogue" className="lg:col-span-3" pad={false}>
        <ul className="p-3">
          {roots.map((r) => (
            <li key={r.id} className="group mb-1 rounded-md px-2 py-1.5 transition-colors hover:bg-pine-50/70">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 font-bold text-ink">
                  <Tags size={14} className="text-pine-600" />
                  {r.name}
                  <Badge tone="slate">{countFor(r.id)} produit(s)</Badge>
                </span>
                {can("products.create") && (
                  <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => remove(r)} icon={<X size={13} />}>Supprimer</Button>
                )}
              </div>
              {db.categories.filter((c) => c.parentId === r.id).length > 0 && (
                <ul className="ml-6 mt-1 border-l-2 border-line pl-3">
                  {db.categories.filter((c) => c.parentId === r.id).map((c) => (
                    <li key={c.id} className="group flex items-center justify-between rounded px-2 py-1 hover:bg-white/70">
                      <span className="text-[13px] font-semibold text-ink2">
                        {c.name}
                        <span className="tnum ml-2 text-[11px] text-mute">{db.products.filter((p) => p.categoryId === c.id).length} produit(s)</span>
                      </span>
                      {can("products.create") && (
                        <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => remove(c)} icon={<X size={13} />}>Supprimer</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        {can("products.create") && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 p-3">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie…" className="h-8.5 w-48" />
            <Select value={parent} onChange={(e) => setParent(e.target.value)} className="h-8.5 w-48">
              <option value="">Famille racine</option>
              {roots.map((r) => <option key={r.id} value={r.id}>Sous « {r.name} »</option>)}
            </Select>
            <Button size="sm" icon={<Plus size={13} />} onClick={add}>Ajouter</Button>
          </div>
        )}
      </Card>

      <Card title="Répartition du catalogue" sub="Produits par famille" className="lg:col-span-2">
        <ul className="space-y-3.5">
          {[...roots].sort((a, b) => countFor(b.id) - countFor(a.id)).map((r, i) => {
            const n = countFor(r.id);
            return (
              <li key={r.id}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-[13px] font-bold text-ink">{r.name}</span>
                  <span className="tnum text-[12px] font-semibold text-ink2">{n} réf.</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-line">
                  <div
                    className="anim-grow h-full rounded-full"
                    style={{
                      width: `${(n / maxCount) * 100}%`,
                      transformOrigin: "left",
                      animationDelay: `${i * 45}ms`,
                      background: i % 2 ? "var(--color-pine-500)" : "var(--color-copper-500)",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 rounded-md border border-line bg-paper/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink2">
          <strong className="text-ink">Règle d'intégrité :</strong> une famille utilisée par des produits ou des
          sous-familles ne peut pas être supprimée — elle peut être renommée ou vidée d'abord.
        </p>
      </Card>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Supprimer" />
    </div>
  );
}

/* ============================================================
   REGISTRE UNITÉS
   ============================================================ */
function UnitesTab() {
  const { db, act, can, toast } = useApp();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const usage = (id: string) => db.products.filter((p) => p.unitId === id || p.purchaseUnitId === id).length;

  const add = () => {
    const c = code.trim();
    const n = name.trim();
    if (!c || !n) {
      toast("Code et nom sont obligatoires.", "error");
      return;
    }
    if (db.units.some((u) => u.code.toLowerCase() === c.toLowerCase())) {
      toast(`L'unité « ${c} » existe déjà.`, "error");
      return;
    }
    act((d) => { d.units.push({ id: uid(), code: c, name: n }); }, `Unité « ${c} » créée.`);
    setCode("");
    setName("");
  };

  const remove = (id: string, label: string) => {
    if (usage(id) > 0) {
      toast(`« ${label} » est utilisée par ${usage(id)} produit(s) : suppression impossible.`, "warn");
      return;
    }
    setConfirm({
      title: "Supprimer l'unité ?",
      msg: `« ${label} » n'est utilisée par aucun produit.`,
      fn: () => act((d) => { d.units = d.units.filter((x) => x.id !== id); }, `Unité « ${label} » supprimée.`),
    });
  };

  const conversions = db.products.filter((p) => p.purchaseUnitId !== p.unitId).slice(0, 7);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Card title="Unités de mesure" sub="Référentiel des unités de base et d'achat" className="lg:col-span-3" pad={false}>
        <ul className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
          {db.units.map((u) => (
            <li key={u.id} className="group flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 transition-all hover:border-pine-300 hover:shadow-sm">
              <span className="tnum w-16 shrink-0 rounded-md bg-pine-900 px-2 py-1.5 text-center font-mono text-[12px] font-bold text-pine-100">{u.code}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-ink">{u.name}</p>
                <p className="tnum text-[11px] text-mute">{usage(u.id)} produit(s) lié(s)</p>
              </div>
              {can("products.create") && (
                <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => remove(u.id, u.code)} icon={<X size={13} />}>Retirer</Button>
              )}
            </li>
          ))}
        </ul>
        {can("products.create") && (
          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 p-3">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code (ex. bt)" className="h-8.5 w-32" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Bouteille)" className="h-8.5 w-44" />
            <Button size="sm" icon={<Plus size={13} />} onClick={add}>Ajouter l'unité</Button>
          </div>
        )}
      </Card>

      <Card title="Conversions actives" sub="Définies sur les fiches produits" className="lg:col-span-2">
        {conversions.length ? (
          <ul className="space-y-2">
            {conversions.map((p) => {
              const base = db.units.find((u) => u.id === p.unitId)?.code ?? "?";
              const buy = db.units.find((u) => u.id === p.purchaseUnitId)?.code ?? "?";
              return (
                <li key={p.id} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2 text-[12.5px]">
                  <Ruler size={13} className="shrink-0 text-copper-600" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">{p.name}</span>
                  <span className="tnum shrink-0 font-mono text-[11.5px] font-bold text-pine-700">
                    1 {buy} = {p.conversion} {base}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={<Ruler size={22} />} title="Aucune conversion" sub="Définissez des unités d'achat différentes des unités de base sur les fiches produits (ex. sac de 25 kg)." />
        )}
        <p className="mt-4 rounded-md border border-line bg-paper/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink2">
          Les réceptions convertissent automatiquement les quantités d'achat en unité de base :
          le stock reste toujours exprimé dans l'unité de référence du produit.
        </p>
      </Card>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Supprimer" />
    </div>
  );
}

/* ============================================================
   REGISTRE FOURNISSEURS
   ============================================================ */
function FournisseursTab() {
  const { db, act, can, toast } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const emptyForm = (): Supplier => ({
    id: uid(), code: "FOU-" + String(db.suppliers.length + 1).padStart(3, "0"),
    name: "", contact: "", phone: "", email: "", address: "", city: "", ice: "",
    paymentTerms: "30 jours", creditLimit: 0, openingBalance: 0, status: "actif", notes: "",
    createdAt: nowISO(),
  });
  const [form, setForm] = useState<Supplier>(emptyForm());

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return db.suppliers.filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.city.toLowerCase().includes(q));
  }, [db.suppliers, search]);

  const totalDue = db.suppliers.reduce((s, x) => s + Math.max(supplierBalance(db, x.id).balance, 0), 0);

  const save = () => {
    if (!form.name.trim()) {
      toast("La raison sociale est obligatoire.", "error");
      return;
    }
    const isNew = !db.suppliers.some((s) => s.id === form.id);
    const ok = act((d) => {
      const i = d.suppliers.findIndex((s) => s.id === form.id);
      if (i >= 0) d.suppliers[i] = form;
      else d.suppliers.push(form);
    }, isNew ? `Fournisseur « ${form.name} » ajouté au référentiel.` : `Fournisseur « ${form.name} » mis à jour.`);
    if (ok) setShowEdit(false);
  };

  const toggle = (s: Supplier) => {
    const hasHistory = db.invoices.some((i) => i.supplierId === s.id) || db.receptions.some((r) => r.supplierId === s.id);
    if (s.status === "actif" && hasHistory) {
      setConfirm({
        title: "Désactiver ce fournisseur ?",
        msg: `« ${s.name} » a un historique d'achats : il sera conservé pour les rapports mais ne sera plus sélectionnable.`,
        fn: () => act((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (x) x.status = "inactif"; }, `Fournisseur « ${s.name} » désactivé.`),
      });
    } else {
      act((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (x) x.status = x.status === "actif" ? "inactif" : "actif"; }, `Fournisseur ${s.status === "actif" ? "désactivé" : "réactivé"}.`);
    }
  };

  const cols: Col<Supplier>[] = [
    { key: "code", label: "Code", sortVal: (s) => s.code, render: (s) => <span className="font-mono text-[11px] font-bold text-ink2">{s.code}</span> },
    {
      key: "name", label: "Fournisseur", sortVal: (s) => s.name,
      render: (s) => (
        <div>
          <p className={cn("font-bold", s.status === "inactif" ? "text-mute" : "text-ink")}>{s.name}</p>
          <p className="text-[11px] text-mute">{[s.contact, s.city].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    { key: "terms", label: "Règlement", render: (s) => <Badge tone="info">{s.paymentTerms}</Badge>, sortVal: (s) => s.paymentTerms },
    { key: "limit", label: "Plafond", align: "right", sortVal: (s) => s.creditLimit, render: (s) => <span className="tnum text-ink2">{fmtMoney(s.creditLimit, cur)}</span> },
    {
      key: "balance", label: "Solde dû", align: "right", sortVal: (s) => supplierBalance(db, s.id).balance,
      render: (s) => {
        const b = supplierBalance(db, s.id).balance;
        return b > 0.005 ? (
          <span className="tnum rounded-md bg-badbg px-2 py-0.5 font-bold text-bad">{fmtMoney(b, cur)}</span>
        ) : (
          <span className="tnum rounded-md bg-okbg px-2 py-0.5 font-bold text-ok">À jour</span>
        );
      },
    },
    { key: "st", label: "Statut", render: (s) => <Badge tone={s.status === "actif" ? "ok" : "slate"} dot>{s.status === "actif" ? "Actif" : "Inactif"}</Badge> },
    {
      key: "act", label: "Actions",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {can("suppliers.edit") && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setForm({ ...s }); setEditing(s); setShowEdit(true); }} icon={<Pencil size={13} />}>Modifier</Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.status === "actif" ? "Désactiver" : "Réactiver"}</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Nom, code, ville…" className="w-64" />
        <span className="text-[12px] font-semibold text-mute">
          {rows.length} partenaire(s) · encours total <strong className="tnum text-bad">{fmtMoney(totalDue, cur)}</strong>
        </span>
        <div className="ml-auto">
          {can("suppliers.create") && (
            <Button size="sm" icon={<Plus size={13} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowEdit(true); }}>Nouveau fournisseur</Button>
          )}
        </div>
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(s) => s.id} pageSize={10}
        empty={<EmptyState icon={<Factory size={24} />} title="Aucun fournisseur" sub="Référencez vos partenaires d'approvisionnement : épicerie, viandes, primeurs, boissons, hygiène…" />}
      />

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={editing ? `Modifier — ${editing.name}` : "Nouveau fournisseur"} width="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setShowEdit(false)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Raison sociale" className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Contact"><Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="E-mail"><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Ville"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <Field label="ICE"><Input value={form.ice} onChange={(e) => setForm({ ...form, ice: e.target.value })} /></Field>
          <Field label="Conditions de paiement">
            <Select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
              {["Comptant", "15 jours", "30 jours", "45 jours", "60 jours"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label={`Plafond de crédit (${cur})`}><Input type="number" min={0} value={form.creditLimit || ""} onChange={(e) => setForm({ ...form, creditLimit: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label={`Solde d'ouverture (${cur})`}><Input type="number" value={form.openingBalance || ""} onChange={(e) => setForm({ ...form, openingBalance: parseFloat(e.target.value) || 0 })} /></Field>
          <Field label="Adresse" className="sm:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Notes" className="sm:col-span-2 lg:col-span-3"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}

export { Archive as RefIcon };
