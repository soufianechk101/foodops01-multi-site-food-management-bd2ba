import { useMemo, useState } from "react";
import { Download, Eye, Factory, Pencil, Plus, Tags, UtensilsCrossed, X } from "lucide-react";
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
  PageHead,
  SearchInput,
  Select,
  StockBadge,
  Textarea,
  cn,
  type Col,
} from "../components/ui";
import { computeStocks, entryOf, stockStatus, supplierBalance, invoiceTotals } from "../lib/engine";
import type { Category, Product, Supplier } from "../types";
import { downloadFile, fmtDate, fmtMoney, fmtNum, nowISO, toCSV, todayISO, uid } from "../lib/util";

/* ============================================================
   PRODUITS
   ============================================================ */
export function ProductsPage() {
  const { db, siteId, act, can, toast, siteName, user } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [showNew, setShowNew] = useState(false);
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
      if (cat && p.categoryId !== cat && !db.categories.some((c) => c.id === p.categoryId && c.parentId === cat)) return false;
      if (q && !(p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [db, search, cat]);

  const save = () => {
    if (!form.name.trim()) {
      toast("Le nom du produit est obligatoire.", "error");
      return;
    }
    const isNew = !db.products.some((p) => p.id === form.id);
    const ok = act(
      (d) => {
        if (!d.products.some((p) => p.code === form.code && p.id !== form.id)) {
          const i = d.products.findIndex((p) => p.id === form.id);
          if (i >= 0) d.products[i] = form;
          else d.products.push(form);
          d.audit.push({
            id: uid(), userId: user?.id ?? "", userName: user?.name ?? "Utilisateur",
            action: isNew ? "CREATE" : "UPDATE", module: "Produits",
            detail: `Produit « ${form.name} » ${isNew ? "créé" : "mis à jour"}`, siteId: null, date: nowISO(),
          });
        } else {
          throw new Error(`Le code « ${form.code} » est déjà utilisé par un autre produit.`);
        }
      },
      isNew ? `Produit « ${form.name} » créé.` : `Produit « ${form.name} » mis à jour.`
    );
    if (ok) {
      setShowNew(false);
      setEditing(null);
    }
  };

  const toggleStatus = (p: Product) => {
    const hasHistory = db.movements.some((m) => m.productId === p.id);
    if (p.status === "actif" && hasHistory) {
      setConfirm({
        title: "Désactiver le produit ?",
        msg: `« ${p.name} » possède un historique de stock : il ne sera pas supprimé mais passé inactif (il restera visible dans les rapports historiques).`,
        fn: () =>
          act((d) => {
            const x = d.products.find((y) => y.id === p.id);
            if (x) x.status = "inactif";
          }, `Produit « ${p.name} » désactivé (historique conservé).`),
      });
    } else {
      act((d) => {
        const x = d.products.find((y) => y.id === p.id);
        if (x) x.status = x.status === "actif" ? "inactif" : "actif";
      }, `Produit « ${p.name} » ${p.status === "actif" ? "désactivé" : "réactivé"}.`);
    }
  };

  const remove = (p: Product) => {
    const hasHistory = db.movements.some((m) => m.productId === p.id);
    if (hasHistory) {
      toast(`« ${p.name} » a des mouvements de stock : suppression impossible. Il peut être désactivé.`, "warn");
      return;
    }
    setConfirm({
      title: "Supprimer le produit ?",
      msg: `« ${p.name} » n'a aucun historique : la suppression est définitive.`,
      fn: () =>
        act((d) => {
          d.products = d.products.filter((y) => y.id !== p.id);
        }, `Produit « ${p.name} » supprimé.`),
    });
  };

  const exportCSV = () =>
    downloadFile(
      `produits-${todayISO()}.csv`,
      toCSV(
        [
          { key: "code", label: "Code" }, { key: "nom", label: "Nom" },
          { key: "cat", label: "Catégorie" }, { key: "unite", label: "Unité base" },
          { key: "achat", label: "Unité achat" }, { key: "conv", label: "Conversion" },
          { key: "tva", label: "TVA %" }, { key: "min", label: "Stock min" },
          { key: "reappro", label: "Seuil réappro" }, { key: "prix", label: "Prix d'achat" },
          { key: "fournisseur", label: "Fournisseur" }, { key: "statut", label: "Statut" },
        ],
        rows.map((p) => ({
          code: p.code, nom: p.name,
          cat: db.categories.find((c) => c.id === p.categoryId)?.name ?? "",
          unite: db.units.find((u) => u.id === p.unitId)?.code ?? "",
          achat: db.units.find((u) => u.id === p.purchaseUnitId)?.code ?? "",
          conv: p.conversion, tva: p.vatRate, min: p.minStock, reappro: p.reorderPoint,
          prix: p.purchasePrice.toFixed(2),
          fournisseur: db.suppliers.find((s) => s.id === p.supplierId)?.name ?? "",
          statut: p.status,
        }))
      ),
      "text/csv"
    );

  const cols: Col<Product>[] = [
    { key: "code", label: "Code", sortVal: (p) => p.code, render: (p) => <span className="font-mono text-[11px] font-bold text-ink2">{p.code}</span> },
    { key: "name", label: "Produit", sortVal: (p) => p.name, render: (p) => <span className="font-bold text-ink">{p.name}</span> },
    { key: "cat", label: "Catégorie", sortVal: (p) => db.categories.find((c) => c.id === p.categoryId)?.name ?? "", render: (p) => <span className="text-ink2">{db.categories.find((c) => c.id === p.categoryId)?.name}</span> },
    {
      key: "unit",
      label: "Unités",
      render: (p) => (
        <span className="text-[12px] text-ink2">
          {db.units.find((u) => u.id === p.unitId)?.code}
          {p.purchaseUnitId !== p.unitId && (
            <span className="text-mute"> · achat : {db.units.find((u) => u.id === p.purchaseUnitId)?.code} ×{p.conversion}</span>
          )}
        </span>
      ),
    },
    { key: "price", label: "Prix d'achat", align: "right", sortVal: (p) => p.purchasePrice, render: (p) => <span className="tnum font-semibold">{fmtMoney(p.purchasePrice, cur)}</span> },
    { key: "tva", label: "TVA", align: "center", render: (p) => <span className="tnum text-ink2">{p.vatRate} %</span> },
    { key: "min", label: "Min / Réappro", align: "right", render: (p) => <span className="tnum text-[12px] text-ink2">{fmtNum(p.minStock)} / {fmtNum(p.reorderPoint)}</span> },
    {
      key: "stock",
      label: siteId ? `Stock · ${siteName(siteId)}` : "Stock",
      align: "right",
      sortVal: (p) => (siteId && stocks ? entryOf(stocks, siteId, p.id).qty : 0),
      render: (p) => {
        if (!siteId || !stocks) return <span className="text-[11px] text-mute">sélectionnez un site</span>;
        const e = entryOf(stocks, siteId, p.id);
        return <span className="tnum font-bold">{fmtNum(e.qty)}</span>;
      },
    },
    {
      key: "st",
      label: "Statut",
      render: (p) => {
        if (p.status === "inactif") return <Badge tone="slate" dot>Inactif</Badge>;
        if (!siteId || !stocks) return <Badge tone={p.status === "actif" ? "ok" : "slate"} dot>Actif</Badge>;
        const e = entryOf(stocks, siteId, p.id);
        return <StockBadge kind={db.movements.some((m) => m.siteId === siteId && m.productId === p.id) ? stockStatus(e.qty, p) : "ok"} />;
      },
    },
    {
      key: "act",
      label: "Actions",
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          {can("products.edit") && (
            <Button size="sm" variant="ghost" onClick={() => { setForm({ ...p }); setEditing(p); setShowNew(true); }} icon={<Pencil size={13} />}>Modifier</Button>
          )}
          {can("products.edit") && (
            <Button size="sm" variant="ghost" onClick={() => toggleStatus(p)}>{p.status === "actif" ? "Désactiver" : "Réactiver"}</Button>
          )}
          {can("products.delete") && p.status === "actif" && (
            <Button size="sm" variant="ghost" className="text-bad" onClick={() => remove(p)} icon={<X size={13} />}>Supprimer</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Produits" sub={`${db.products.length} références — les produits sont indépendants du stock, qui reste propre à chaque site.`}>
        <Button variant="outline" icon={<Download size={15} />} onClick={exportCSV}>Export CSV</Button>
        {can("products.create") && <Button icon={<Plus size={15} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowNew(true); }}>Nouveau produit</Button>}
      </PageHead>

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Nom ou code…" className="w-64" />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-56">
          <option value="">Toutes les catégories</option>
          {db.categories.filter((c) => !c.parentId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(p) => p.id} pageSize={12}
        empty={<EmptyState icon={<UtensilsCrossed size={24} />} title="Aucun produit" sub="Créez votre premier produit : matières premières, boissons, produits d'entretien…" />}
      />

      <Modal open={showNew} onClose={() => setShowNew(false)} title={editing ? `Modifier — ${editing.name}` : "Nouveau produit"} width="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Code / SKU"><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></Field>
          <Field label="Nom" className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex. Riz blanc étuvé" /></Field>
          <Field label="Catégorie">
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
          <Field label="Stock minimum" hint="Seuil critique">
            <Input type="number" min={0} step="0.01" value={form.minStock || ""} onChange={(e) => setForm({ ...form, minStock: parseFloat(e.target.value) || 0 })} />
          </Field>
          <Field label="Seuil de réapprovisionnement" hint="Déclenche l'alerte stock bas">
            <Input type="number" min={0} step="0.01" value={form.reorderPoint || ""} onChange={(e) => setForm({ ...form, reorderPoint: parseFloat(e.target.value) || 0 })} />
          </Field>
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
   CATÉGORIES & UNITÉS
   ============================================================ */
export function CategoriesPage() {
  const { db, act, can, toast } = useApp();
  const [newCat, setNewCat] = useState("");
  const [parentCat, setParentCat] = useState("");
  const [newUnit, setNewUnit] = useState({ code: "", name: "" });
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const addCat = () => {
    if (!newCat.trim()) return;
    act((d) => {
      d.categories.push({ id: uid(), name: newCat.trim(), parentId: parentCat || null });
    }, `Catégorie « ${newCat.trim()} » créée.`);
    setNewCat("");
  };

  const removeCat = (c: Category) => {
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

  const addUnit = () => {
    if (!newUnit.code.trim() || !newUnit.name.trim()) return;
    if (db.units.some((u) => u.code === newUnit.code.trim())) {
      toast("Ce code d'unité existe déjà.", "error");
      return;
    }
    act((d) => { d.units.push({ id: uid(), code: newUnit.code.trim(), name: newUnit.name.trim() }); }, `Unité « ${newUnit.code} » créée.`);
    setNewUnit({ code: "", name: "" });
  };

  const removeUnit = (id: string) => {
    const used = db.products.some((p) => p.unitId === id || p.purchaseUnitId === id);
    if (used) {
      toast("Cette unité est utilisée par des produits : suppression impossible.", "warn");
      return;
    }
    setConfirm({
      title: "Supprimer l'unité ?",
      msg: "Cette unité n'est utilisée par aucun produit.",
      fn: () => act((d) => { d.units = d.units.filter((x) => x.id !== id); }, "Unité supprimée."),
    });
  };

  const roots = db.categories.filter((c) => !c.parentId);

  return (
    <div>
      <PageHead title="Catégories & unités" sub="Structure hiérarchique des familles de produits et référentiel des unités de mesure." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card title="Catégories" sub="Familles et sous-familles" className="lg:col-span-3" pad={false}>
          <ul className="p-3">
            {roots.map((r) => (
              <li key={r.id} className="mb-1">
                <div className="group flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-pine-50/70">
                  <span className="flex items-center gap-2 font-bold text-ink">
                    <Tags size={14} className="text-pine-600" />
                    {r.name}
                    <Badge tone="slate">{db.products.filter((p) => p.categoryId === r.id || db.categories.some((c) => c.parentId === r.id && p.categoryId === c.id)).length} produits</Badge>
                  </span>
                  {can("products.create") && (
                    <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => removeCat(r)} icon={<X size={13} />}>Supprimer</Button>
                  )}
                </div>
                <ul className="ml-6 border-l-2 border-line pl-3">
                  {db.categories.filter((c) => c.parentId === r.id).map((c) => (
                    <li key={c.id} className="group flex items-center justify-between rounded-md px-2.5 py-1.5 hover:bg-pine-50/70">
                      <span className="text-[13px] font-semibold text-ink2">
                        {c.name}
                        <span className="tnum ml-2 text-[11px] text-mute">{db.products.filter((p) => p.categoryId === c.id).length} produits</span>
                      </span>
                      {can("products.create") && (
                        <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => removeCat(c)} icon={<X size={13} />}>Supprimer</Button>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          {can("products.create") && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 p-3">
              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nouvelle catégorie…" className="h-8.5 w-48" />
              <Select value={parentCat} onChange={(e) => setParentCat(e.target.value)} className="h-8.5 w-44">
                <option value="">Racine</option>
                {roots.map((r) => <option key={r.id} value={r.id}>Sous « {r.name} »</option>)}
              </Select>
              <Button size="sm" icon={<Plus size={13} />} onClick={addCat}>Ajouter</Button>
            </div>
          )}
        </Card>

        <Card title="Unités de mesure" sub="kg, L, sac, carton… avec conversion" className="lg:col-span-2" pad={false}>
          <ul className="p-3">
            {db.units.map((u) => (
              <li key={u.id} className="group flex items-center justify-between rounded-md px-2.5 py-2 hover:bg-pine-50/70">
                <span className="flex items-center gap-2.5">
                  <span className="tnum w-16 rounded bg-pine-900 px-2 py-1 text-center font-mono text-[11px] font-bold text-pine-100">{u.code}</span>
                  <span className="text-[13px] font-semibold text-ink2">{u.name}</span>
                  <span className="tnum text-[11px] text-mute">{db.products.filter((p) => p.unitId === u.id || p.purchaseUnitId === u.id).length} produits</span>
                </span>
                {can("products.create") && (
                  <Button size="sm" variant="ghost" className="opacity-0 transition-opacity group-hover:opacity-100" onClick={() => removeUnit(u.id)} icon={<X size={13} />}>Supprimer</Button>
                )}
              </li>
            ))}
          </ul>
          {can("products.create") && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/60 p-3">
              <Input value={newUnit.code} onChange={(e) => setNewUnit({ ...newUnit, code: e.target.value })} placeholder="Code" className="h-8.5 w-24" />
              <Input value={newUnit.name} onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })} placeholder="Nom" className="h-8.5 w-36" />
              <Button size="sm" icon={<Plus size={13} />} onClick={addUnit}>Ajouter</Button>
            </div>
          )}
        </Card>
      </div>
      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Supprimer" />
    </div>
  );
}

/* ============================================================
   FOURNISSEURS
   ============================================================ */
export function SuppliersPage() {
  const { db, act, can, toast } = useApp();
  const cur = db.company.currency;
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [detail, setDetail] = useState<Supplier | null>(null);
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

  const save = () => {
    if (!form.name.trim()) {
      toast("Le nom du fournisseur est obligatoire.", "error");
      return;
    }
    const isNew = !db.suppliers.some((s) => s.id === form.id);
    const ok = act((d) => {
      const i = d.suppliers.findIndex((s) => s.id === form.id);
      if (i >= 0) d.suppliers[i] = form;
      else d.suppliers.push(form);
    }, isNew ? `Fournisseur « ${form.name} » créé.` : `Fournisseur « ${form.name} » mis à jour.`);
    if (ok) { setShowNew(false); setEditing(null); }
  };

  const toggle = (s: Supplier) => {
    const hasHistory = db.invoices.some((i) => i.supplierId === s.id) || db.receptions.some((r) => r.supplierId === s.id);
    if (s.status === "actif" && hasHistory) {
      setConfirm({
        title: "Désactiver le fournisseur ?",
        msg: `« ${s.name} » a un historique d'achats : il sera désactivé (conservé pour les rapports) mais plus selectable dans les nouveaux documents.`,
        fn: () => act((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (x) x.status = "inactif"; }, `Fournisseur « ${s.name} » désactivé.`),
      });
    } else {
      act((d) => { const x = d.suppliers.find((y) => y.id === s.id); if (x) x.status = x.status === "actif" ? "inactif" : "actif"; }, `Fournisseur ${s.status === "actif" ? "désactivé" : "réactivé"}.`);
    }
  };

  const cols: Col<Supplier>[] = [
    { key: "code", label: "Code", sortVal: (s) => s.code, render: (s) => <span className="font-mono text-[11px] font-bold text-ink2">{s.code}</span> },
    { key: "name", label: "Fournisseur", sortVal: (s) => s.name, render: (s) => <div><p className="font-bold text-ink">{s.name}</p><p className="text-[11px] text-mute">{s.contact}{s.city ? ` · ${s.city}` : ""}</p></div> },
    { key: "terms", label: "Règlement", render: (s) => <Badge tone="info">{s.paymentTerms}</Badge>, sortVal: (s) => s.paymentTerms },
    { key: "limit", label: "Plafond crédit", align: "right", sortVal: (s) => s.creditLimit, render: (s) => <span className="tnum text-ink2">{fmtMoney(s.creditLimit, cur)}</span> },
    {
      key: "balance",
      label: "Solde dû",
      align: "right",
      sortVal: (s) => supplierBalance(db, s.id).balance,
      render: (s) => {
        const b = supplierBalance(db, s.id).balance;
        return <span className={cn("tnum font-bold", b > 0 ? "text-bad" : "text-ok")}>{fmtMoney(b, cur)}</span>;
      },
    },
    { key: "st", label: "Statut", render: (s) => <Badge tone={s.status === "actif" ? "ok" : "slate"} dot>{s.status === "actif" ? "Actif" : "Inactif"}</Badge> },
    {
      key: "act",
      label: "Actions",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => setDetail(s)} icon={<Eye size={13} />}>Fiche</Button>
          {can("suppliers.edit") && (
            <>
              <Button size="sm" variant="ghost" onClick={() => { setForm({ ...s }); setEditing(s); setShowNew(true); }} icon={<Pencil size={13} />}>Modifier</Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(s)}>{s.status === "actif" ? "Désactiver" : "Réactiver"}</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Fournisseurs" sub="Partenaires d'approvisionnement, conditions de règlement et encours de crédit.">
        {can("suppliers.create") && <Button icon={<Plus size={15} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowNew(true); }}>Nouveau fournisseur</Button>}
      </PageHead>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Nom, code, ville…" className="w-72" />
      </div>

      <DataTable cols={cols} rows={rows} rowKey={(s) => s.id} pageSize={10}
        empty={<EmptyState icon={<Factory size={24} />} title="Aucun fournisseur" sub="Référencez vos partenaires : épicerie, viandes, primeurs, boissons, hygiène…" />}
      />

      <Modal open={showNew} onClose={() => setShowNew(false)} title={editing ? `Modifier — ${editing.name}` : "Nouveau fournisseur"} width="max-w-2xl"
        footer={<><Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button><Button onClick={save}>Enregistrer</Button></>}
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

      {/* fiche fournisseur */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} sub={detail ? `${detail.code} · ${detail.city || "—"} · ${detail.paymentTerms}` : ""} width="max-w-2xl">
        {detail && (() => {
          const b = supplierBalance(db, detail.id);
          const pos = db.purchaseOrders.filter((p) => p.supplierId === detail.id);
          const recs = db.receptions.filter((r) => r.supplierId === detail.id);
          const invs = db.invoices.filter((i) => i.supplierId === detail.id);
          const pays = db.payments.filter((p) => p.supplierId === detail.id);
          return (
            <>
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">Total facturé</p>
                  <p className="tnum mt-1 font-display text-[15px] font-bold">{fmtMoney(b.invoiced, cur)}</p>
                </div>
                <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">Total payé</p>
                  <p className="tnum mt-1 font-display text-[15px] font-bold text-ok">{fmtMoney(b.paid, cur)}</p>
                </div>
                <div className="rounded-md border border-line bg-paper/60 px-3 py-2.5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-mute">Solde dû</p>
                  <p className={cn("tnum mt-1 font-display text-[15px] font-bold", b.balance > 0 ? "text-bad" : "text-ok")}>{fmtMoney(b.balance, cur)}</p>
                </div>
              </div>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { l: "Bons de commande", v: pos.length },
                  { l: "Réceptions", v: recs.length },
                  { l: "Factures", v: invs.length },
                  { l: "Règlements", v: pays.length },
                ].map((x) => (
                  <div key={x.l} className="rounded-md border border-line px-3 py-2 text-center">
                    <p className="tnum font-display text-[18px] font-bold text-pine-700">{x.v}</p>
                    <p className="text-[10.5px] font-semibold text-mute">{x.l}</p>
                  </div>
                ))}
              </div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-mute">Dernières factures</p>
              <table className="w-full text-[12.5px]">
                <tbody>
                  {invs.slice(-5).reverse().map((i) => (
                    <tr key={i.id} className="border-b border-line/70 last:border-0">
                      <td className="py-2 font-mono text-[11px] font-bold text-ink2">{i.number}</td>
                      <td className="py-2 text-mute">{fmtDate(i.date)}</td>
                      <td className="tnum py-2 text-right font-bold">{fmtMoney(invoiceTotals(i).ttc, cur)}</td>
                    </tr>
                  ))}
                  {!invs.length && <tr><td className="py-4 text-center text-mute">Aucune facture.</td></tr>}
                </tbody>
              </table>
              {detail.notes && <p className="mt-3 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink2">{detail.notes}</p>}
            </>
          );
        })()}
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmText="Confirmer" />
    </div>
  );
}
