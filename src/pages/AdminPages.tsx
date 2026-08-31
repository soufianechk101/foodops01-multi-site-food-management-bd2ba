import { useMemo, useRef, useState } from "react";
import {
  Building2,
  Database,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserRound,
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
  PageHead,
  SearchInput,
  Select,
  Tabs,
  Textarea,
  cn,
  type Col,
} from "../components/ui";
import { pushAudit } from "../lib/engine";
import { buildSeed } from "../lib/seed";
import { runEngineTests, type TestResult } from "../lib/tests";
import { CheckCircle2, FlaskConical, Play, XCircle } from "lucide-react";

function DiagnosticsPanel() {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const [duration, setDuration] = useState(0);

  const run = () => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const t0 = performance.now();
      const res = runEngineTests();
      setDuration(Math.round(performance.now() - t0));
      setResults(res);
      setRunning(false);
    }, 350);
  };

  const passed = results?.filter((r) => r.pass).length ?? 0;
  const total = results?.length ?? 0;

  return (
    <Card
      className="mt-4"
      title="Diagnostics — tests automatisés du moteur"
      sub="12 scénarios exécutés sur un clone de travail de la base : isolation multi-sites, coût moyen pondéré, double comptabilisation, stock négatif, transferts, inventaires, permissions, sauvegarde… Vos données ne sont jamais modifiées."
      actions={
        <Button onClick={run} disabled={running} icon={running ? undefined : <Play size={14} />}>
          {running ? "Exécution en cours…" : results ? "Relancer les tests" : "Lancer les tests"}
        </Button>
      }
    >
      {running && (
        <div className="flex items-center gap-3 py-6">
          <span className="h-2.5 w-2.5 animate-ping rounded-full bg-copper-500" />
          <p className="text-[13px] font-semibold text-ink2">
            Vérification du moteur de stock — mouvements, gardes-fous et intégrité…
          </p>
        </div>
      )}
      {!running && !results && (
        <p className="flex items-center gap-2.5 py-5 text-[13px] text-mute">
          <FlaskConical size={16} className="text-pine-600" />
          Aucune exécution pour le moment. Lancez la suite pour certifier le moteur de cette installation.
        </p>
      )}
      {!running && results && (
        <>
          <div
            className={cn(
              "mb-3 flex items-center gap-3 rounded-md border px-3.5 py-2.5",
              passed === total ? "border-ok/30 bg-okbg" : "border-bad/30 bg-badbg"
            )}
          >
            {passed === total ? <CheckCircle2 size={18} className="text-ok" /> : <XCircle size={18} className="text-bad" />}
            <p className={cn("text-[13px] font-bold", passed === total ? "text-ok" : "text-bad")}>
              {passed} / {total} tests réussis en {duration} ms —{" "}
              {passed === total ? "moteur de stock certifié conforme." : "des anomalies ont été détectées."}
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {results.map((r, i) => (
              <li key={i} className={cn("rounded-md border px-3 py-2.5", r.pass ? "border-line bg-card" : "border-bad/40 bg-badbg/50")}>
                <div className="flex items-center gap-2">
                  {r.pass ? <CheckCircle2 size={14} className="shrink-0 text-ok" /> : <XCircle size={14} className="shrink-0 text-bad" />}
                  <span className="text-[12.5px] font-bold text-ink">{r.name}</span>
                  <span className="ml-auto rounded bg-paper px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-mute">{r.module}</span>
                </div>
                <p className="mt-1 pl-6 text-[11.5px] leading-relaxed text-ink2">{r.detail}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
import type { DB, Role, Site, User } from "../types";
import {
  downloadFile,
  fmtDateTime,
  hashPw,
  nowISO,
  ROLE_LABELS,
  todayISO,
  uid,
} from "../lib/util";

/* ============================================================
   UTILISATEURS & RÔLES
   ============================================================ */
export function UsersPage() {
  const { db, act, can, user: me } = useApp();
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; msg: string; fn: () => void } | null>(null);

  const emptyForm = () => ({
    id: uid(), name: "", username: "", password: "", role: "econome" as Role,
    siteIds: "all" as string[] | "all", active: true,
  });
  const [form, setForm] = useState(emptyForm());

  const save = () => {
    if (!form.name.trim() || !form.username.trim()) return;
    const ok = act((d) => {
      if ((form.role === "proprietaire" || editing?.role === "proprietaire") && me?.role !== "proprietaire")
        throw new Error("Seul le Propriétaire peut créer, modifier ou retirer un compte Propriétaire.");
      const username = form.username.trim().toLowerCase();
      if (d.users.some((u) => u.username === username && u.id !== form.id))
        throw new Error(`Le nom d'utilisateur « ${username} » existe déjà.`);
      const i = d.users.findIndex((u) => u.id === form.id);
      const base: User = {
        id: form.id,
        name: form.name.trim(),
        username,
        passwordHash: form.password ? hashPw(form.password) : i >= 0 ? d.users[i].passwordHash : hashPw("password"),
        role: form.role,
        siteIds: form.siteIds,
        active: form.active,
        createdAt: i >= 0 ? d.users[i].createdAt : nowISO(),
      };
      if (i >= 0) d.users[i] = base;
      else d.users.push(base);
    }, editing ? "Utilisateur mis à jour." : "Utilisateur créé.");
    if (ok) { setShowNew(false); setEditing(null); }
  };

  const toggleActive = (u: User) => {
    if (u.id === me?.id) return;
    if (u.role === "proprietaire" && me?.role !== "proprietaire") return;
    setConfirm({
      title: u.active ? "Désactiver le compte ?" : "Réactiver le compte ?",
      msg: u.active ? `${u.name} ne pourra plus se connecter. L'historique de ses actions est conservé dans le journal d'audit.` : `${u.name} pourra de nouveau se connecter.`,
      fn: () => act((d) => { const x = d.users.find((y) => y.id === u.id); if (x) x.active = !x.active; }, `Compte ${u.active ? "désactivé" : "réactivé"}.`),
    });
  };

  const ROLE_DESC: Record<Role, string> = {
    proprietaire: "Direction du groupe : consolidation multi-sites, espace propriétaire exclusif et tous les pouvoirs de l'administrateur.",
    admin: "Accès total : utilisateurs, paramètres, sauvegardes, audit et toutes les opérations.",
    manager: "Opérations complètes (achats, stock, ventes, rapports) hors gestion des utilisateurs et sauvegardes.",
    econome: "Opérations de stock et de caisse : réceptions, consommations, pertes, transferts, saisie des ventes.",
    controleur: "Lecture seule sur l'ensemble du système + export des rapports.",
  };

  const cols: Col<User>[] = [
    {
      key: "name",
      label: "Utilisateur",
      sortVal: (u) => u.name,
      render: (u) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pine-800 font-display text-[11.5px] font-bold text-pine-50">
            {u.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div>
            <p className="font-bold text-ink">{u.name} {u.id === me?.id && <span className="text-[10.5px] font-semibold text-copper-600">(vous)</span>}</p>
            <p className="font-mono text-[10.5px] text-mute">@{u.username}</p>
          </div>
        </div>
      ),
    },
    { key: "role", label: "Rôle", sortVal: (u) => u.role, render: (u) => <Badge tone={u.role === "proprietaire" ? "copper" : u.role === "controleur" ? "info" : "pine"}>{ROLE_LABELS[u.role]}</Badge> },
    {
      key: "sites",
      label: "Sites autorisés",
      render: (u) =>
        u.siteIds === "all" ? (
          <Badge tone="ok" dot>Tous les sites</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {(u.siteIds as string[]).map((sid) => (
              <span key={sid} className="tnum rounded bg-pine-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-pine-100">
                {db.sites.find((s) => s.id === sid)?.code ?? "?"}
              </span>
            ))}
          </div>
        ),
    },
    { key: "active", label: "Statut", render: (u) => <Badge tone={u.active ? "ok" : "bad"} dot>{u.active ? "Actif" : "Désactivé"}</Badge> },
    {
      key: "act",
      label: "Actions",
      render: (u) => (
        <div className="flex items-center justify-end gap-1">
          {can("users.edit") && (u.role !== "proprietaire" || me?.role === "proprietaire") && (
            <Button size="sm" variant="ghost" onClick={() => { setForm({ id: u.id, name: u.name, username: u.username, password: "", role: u.role, siteIds: u.siteIds, active: u.active }); setEditing(u); setShowNew(true); }} icon={<Pencil size={13} />}>Modifier</Button>
          )}
          {can("users.edit") && u.id !== me?.id && (u.role !== "proprietaire" || me?.role === "proprietaire") && (
            <Button size="sm" variant="ghost" onClick={() => toggleActive(u)}>{u.active ? "Désactiver" : "Réactiver"}</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHead title="Utilisateurs & rôles" sub="Les permissions sont appliquées dans l'interface ET dans le moteur de données ; l'accès aux sites est contrôlé par utilisateur.">
        {can("users.create") && <Button icon={<Plus size={15} />} onClick={() => { setForm(emptyForm()); setEditing(null); setShowNew(true); }}>Nouvel utilisateur</Button>}
      </PageHead>

      <DataTable cols={cols} rows={db.users} rowKey={(u) => u.id} pageSize={10}
        empty={<EmptyState icon={<UserRound size={24} />} title="Aucun utilisateur" />}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(ROLE_DESC) as Role[]).map((r) => (
          <Card key={r} className="transition-transform hover:-translate-y-0.5">
            <Badge tone={r === "proprietaire" ? "copper" : r === "controleur" ? "info" : "pine"}>{ROLE_LABELS[r]}</Badge>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{ROLE_DESC[r]}</p>
            <p className="tnum mt-2 text-[11px] font-semibold text-mute">{db.users.filter((u) => u.role === r).length} compte(s)</p>
          </Card>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title={editing ? `Modifier — ${editing.name}` : "Nouvel utilisateur"} width="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setShowNew(false)}>Annuler</Button><Button onClick={save} disabled={!form.name.trim() || !form.username.trim()}>Enregistrer</Button></>}
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nom complet"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Nom d'utilisateur"><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          </div>
          <Field label={editing ? "Nouveau mot de passe (laisser vide pour conserver)" : "Mot de passe"}>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
          </Field>
          <Field label="Rôle">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          <Field label="Accès aux sites">
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-[13px] font-semibold">
                <input type="checkbox" checked={form.siteIds === "all"} onChange={(e) => setForm({ ...form, siteIds: e.target.checked ? "all" : [] })} className="h-4 w-4 accent-pine-700" />
                Tous les sites
              </label>
              {form.siteIds !== "all" && (
                <div className="grid grid-cols-2 gap-1.5 rounded-md border border-line p-2.5">
                  {db.sites.filter((s) => s.status === "actif").map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-[12.5px] font-semibold text-ink2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-pine-700"
                        checked={(form.siteIds as string[]).includes(s.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            siteIds: e.target.checked
                              ? [...(form.siteIds as string[]), s.id]
                              : (form.siteIds as string[]).filter((x) => x !== s.id),
                          })
                        }
                      />
                      {s.code} — {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </Field>
        </div>
      </Modal>

      <Confirm open={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => confirm?.fn()} title={confirm?.title ?? ""} message={confirm?.msg ?? ""} confirmLabel="Confirmer" />
    </div>
  );
}

/* ============================================================
   PARAMÈTRES (société, sites, préférences)
   ============================================================ */
export function SettingsPage() {
  const { db, act, can, toast } = useApp();
  const [tab, setTab] = useState("societe");
  const [company, setCompany] = useState(db.company);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [showSite, setShowSite] = useState(false);
  const [siteForm, setSiteForm] = useState<Site>({ id: uid(), code: "", name: "", address: "", city: "", phone: "", manager: "", status: "actif", createdAt: nowISO() });
  const editable = can("settings.edit");

  const saveCompany = () => {
    act((d) => { d.company = { ...company }; }, "Paramètres de la société enregistrés.");
  };

  const saveSite = () => {
    if (!siteForm.name.trim() || !siteForm.code.trim()) {
      toast("Le code et le nom du site sont obligatoires.", "error");
      return;
    }
    const ok = act((d) => {
      const code = siteForm.code.trim().toUpperCase();
      if (d.sites.some((s) => s.code === code && s.id !== siteForm.id))
        throw new Error(`Le code « ${code} » est déjà utilisé par un autre site.`);
      const i = d.sites.findIndex((s) => s.id === siteForm.id);
      if (i >= 0) d.sites[i] = { ...siteForm, code };
      else d.sites.push({ ...siteForm, code });
    }, editingSite ? "Site mis à jour." : `Site « ${siteForm.name} » créé.`);
    if (ok) { setShowSite(false); setEditingSite(null); }
  };

  const toggleSite = (s: Site) => {
    act((d) => {
      const x = d.sites.find((y) => y.id === s.id);
      if (x) x.status = x.status === "actif" ? "inactif" : "actif";
    }, `Site « ${s.name} » ${s.status === "actif" ? "désactivé" : "réactivé"} — l'historique est conservé.`);
  };

  const setPref = (patch: Partial<DB["company"]>, msg: string) => {
    act((d) => { d.company = { ...d.company, ...patch }; setCompany({ ...d.company, ...patch }); }, msg);
  };

  return (
    <div>
      <PageHead title="Paramètres" sub="Société, sites et règles de gestion du système." />
      <div className="mb-4">
        <Tabs tabs={[{ key: "societe", label: "Société" }, { key: "sites", label: `Sites (${db.sites.length})` }, { key: "prefs", label: "Règles de gestion" }]} active={tab} onChange={setTab} />
      </div>

      {tab === "societe" && (
        <Card title="Identité de la société" sub="Utilisée sur les documents imprimés et les rapports." className="max-w-3xl">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nom commercial"><Input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} disabled={!editable} /></Field>
            <Field label="Raison sociale" className="sm:col-span-2"><Input value={company.legalName} onChange={(e) => setCompany({ ...company, legalName: e.target.value })} disabled={!editable} /></Field>
            <Field label="Adresse" className="sm:col-span-2"><Input value={company.address} onChange={(e) => setCompany({ ...company, address: e.target.value })} disabled={!editable} /></Field>
            <Field label="Ville"><Input value={company.city} onChange={(e) => setCompany({ ...company, city: e.target.value })} disabled={!editable} /></Field>
            <Field label="Pays"><Input value={company.country} onChange={(e) => setCompany({ ...company, country: e.target.value })} disabled={!editable} /></Field>
            <Field label="Téléphone"><Input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} disabled={!editable} /></Field>
            <Field label="E-mail"><Input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} disabled={!editable} /></Field>
            <Field label="ICE"><Input value={company.ice} onChange={(e) => setCompany({ ...company, ice: e.target.value })} disabled={!editable} /></Field>
            <Field label="Identifiant fiscal"><Input value={company.iff} onChange={(e) => setCompany({ ...company, iff: e.target.value })} disabled={!editable} /></Field>
            <Field label="RC"><Input value={company.rc} onChange={(e) => setCompany({ ...company, rc: e.target.value })} disabled={!editable} /></Field>
          </div>
          {editable && <div className="mt-4"><Button onClick={saveCompany}>Enregistrer la société</Button></div>}
        </Card>
      )}

      {tab === "sites" && (
        <div>
          <div className="mb-3 flex justify-end">
            {editable && <Button icon={<Plus size={15} />} onClick={() => { setSiteForm({ id: uid(), code: "", name: "", address: "", city: "", phone: "", manager: "", status: "actif", createdAt: nowISO() }); setEditingSite(null); setShowSite(true); }}>Nouveau site</Button>}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {db.sites.map((s) => {
              const movCount = db.movements.filter((m) => m.siteId === s.id).length;
              return (
                <Card key={s.id} className="transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="tnum flex h-10 w-12 items-center justify-center rounded-md bg-pine-900 font-mono text-[12px] font-bold text-pine-100">{s.code}</span>
                      <div>
                        <p className="font-display text-[15px] font-bold text-ink">{s.name}</p>
                        <p className="text-[12px] text-mute">{s.city} · {s.manager || "—"}</p>
                      </div>
                    </div>
                    <Badge tone={s.status === "actif" ? "ok" : "slate"} dot>{s.status === "actif" ? "Actif" : "Inactif"}</Badge>
                  </div>
                  <p className="mt-3 text-[12px] text-ink2">{s.address} · {s.phone}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="tnum text-[11.5px] font-semibold text-mute">{movCount} mouvements de stock</span>
                    {editable && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => { setSiteForm({ ...s }); setEditingSite(s); setShowSite(true); }} icon={<Pencil size={13} />}>Modifier</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleSite(s)}>{s.status === "actif" ? "Désactiver" : "Réactiver"}</Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === "prefs" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Stock" sub="Règles appliquées par le moteur à chaque opération">
            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-[13.5px] font-bold text-ink">Autoriser le stock négatif</span>
                  <span className="block text-[12px] text-mute">Si désactivé, toute sortie supérieure au disponible est refusée avec un message clair.</span>
                </span>
                <button disabled={!editable} onClick={() => setPref({ allowNegativeStock: !db.company.allowNegativeStock }, db.company.allowNegativeStock ? "Stock négatif désactivé — les sorties excédentaires seront refusées." : "Stock négatif autorisé (déconseillé).")} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", db.company.allowNegativeStock ? "bg-bad" : "bg-pine-600")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", db.company.allowNegativeStock ? "left-5.5" : "left-0.5")} />
                </button>
              </label>
              <div className="border-t border-line pt-4">
                <p className="text-[13.5px] font-bold text-ink">Méthode de valorisation</p>
                <p className="mt-1 rounded-md bg-paper px-3 py-2 text-[12.5px] text-ink2">
                  <strong>Coût moyen pondéré</strong>, calculé par <span className="font-mono text-[11.5px]">site + produit</span> à chaque entrée. Les sorties sont valorisées à ce coût.
                </p>
              </div>
            </div>
          </Card>
          <Card title="Pilotage & numérotation">
            <div className="space-y-4">
              <Field label="Objectif food cost (%)" hint="Seuil d'alerte sur le tableau de bord et les analyses">
                <Input type="number" min={1} max={90} value={db.company.targetFoodCost} disabled={!editable}
                  onChange={(e) => setPref({ targetFoodCost: parseFloat(e.target.value) || 30 }, "Objectif food cost mis à jour.")} className="w-40" />
              </Field>
              <Field label="Devise">
                <Select value={db.company.currency} disabled={!editable} onChange={(e) => setPref({ currency: e.target.value }, `Devise d'affichage : ${e.target.value}.`)} className="w-40">
                  <option value="MAD">MAD — Dirham</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="USD">USD — Dollar</option>
                </Select>
              </Field>
              <Field label="TVA par défaut (%)">
                <Input type="number" min={0} value={db.company.defaultVat} disabled={!editable}
                  onChange={(e) => setPref({ defaultVat: parseFloat(e.target.value) || 0 }, "TVA par défaut mise à jour.")} className="w-40" />
              </Field>
              <label className="flex items-start justify-between gap-4 border-t border-line pt-4">
                <span>
                  <span className="block text-[13.5px] font-bold text-ink">Préfixe site dans les numéros</span>
                  <span className="block text-[12px] text-mute">ex. AGA-REC-2026-000001 au lieu de REC-2026-000001</span>
                </span>
                <button disabled={!editable} onClick={() => setPref({ sitePrefixNumbering: !db.company.sitePrefixNumbering }, db.company.sitePrefixNumbering ? "Numérotation sans préfixe site." : "Numérotation avec préfixe site activée.")} className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", db.company.sitePrefixNumbering ? "bg-pine-600" : "bg-line2")}>
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", db.company.sitePrefixNumbering ? "left-5.5" : "left-0.5")} />
                </button>
              </label>
            </div>
          </Card>
        </div>
      )}

      <Modal open={showSite} onClose={() => setShowSite(false)} title={editingSite ? `Modifier — ${editingSite.name}` : "Nouveau site"} width="max-w-lg"
        footer={<><Button variant="outline" onClick={() => setShowSite(false)}>Annuler</Button><Button onClick={saveSite}>Enregistrer</Button></>}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Code (3-4 lettres)"><Input value={siteForm.code} onChange={(e) => setSiteForm({ ...siteForm, code: e.target.value })} placeholder="ex. AGA" /></Field>
          <Field label="Nom"><Input value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="ex. Restaurant Principal" /></Field>
          <Field label="Adresse" className="sm:col-span-2"><Input value={siteForm.address} onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })} /></Field>
          <Field label="Ville"><Input value={siteForm.city} onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })} /></Field>
          <Field label="Téléphone"><Input value={siteForm.phone} onChange={(e) => setSiteForm({ ...siteForm, phone: e.target.value })} /></Field>
          <Field label="Responsable" className="sm:col-span-2"><Input value={siteForm.manager} onChange={(e) => setSiteForm({ ...siteForm, manager: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================
   JOURNAL D'AUDIT
   ============================================================ */
export function AuditPage() {
  const { db } = useApp();
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");

  const modules = useMemo(() => [...new Set(db.audit.map((a) => a.module))].sort(), [db.audit]);
  const actions = useMemo(() => [...new Set(db.audit.map((a) => a.action))].sort(), [db.audit]);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return [...db.audit]
      .filter((a) => {
        if (module && a.module !== module) return false;
        if (action && a.action !== action) return false;
        if (q && !(a.userName.toLowerCase().includes(q) || a.detail.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.audit, search, module, action]);

  const ACTION_TONES: Record<string, "ok" | "bad" | "warn" | "info" | "slate" | "copper"> = {
    CREATE: "ok", UPDATE: "info", DELETE: "bad", VALIDATE: "ok", CANCEL: "bad",
    LOGIN: "copper", LOGOUT: "slate", STOCK_ADJUSTMENT: "warn", TRANSFER: "warn", INVENTORY: "copper",
  };

  const cols: Col<(typeof rows)[number]>[] = [
    { key: "date", label: "Horodatage", sortVal: (a) => a.date, render: (a) => <span className="tnum font-mono text-[11px] text-mute">{fmtDateTime(a.date)}</span> },
    { key: "user", label: "Utilisateur", sortVal: (a) => a.userName, render: (a) => <span className="font-semibold">{a.userName}</span> },
    { key: "action", label: "Action", sortVal: (a) => a.action, render: (a) => <Badge tone={ACTION_TONES[a.action] ?? "slate"}>{a.action}</Badge> },
    { key: "module", label: "Module", sortVal: (a) => a.module, render: (a) => <span className="text-ink2">{a.module}</span> },
    { key: "detail", label: "Détail", render: (a) => <span className="text-[12.5px]">{a.detail}</span> },
    { key: "site", label: "Site", render: (a) => a.siteId ? <span className="tnum rounded bg-pine-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-pine-100">{db.sites.find((s) => s.id === a.siteId)?.code}</span> : <span className="text-mute">—</span> },
  ];

  return (
    <div>
      <PageHead title="Journal d'audit" sub="Traçabilité complète : qui, quoi, quand, sur quel site. Les enregistrements ne sont jamais supprimés." />
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <SearchInput value={search} onChange={setSearch} placeholder="Utilisateur ou détail…" className="w-64" />
        <Select value={module} onChange={(e) => setModule(e.target.value)} className="w-44">
          <option value="">Tous les modules</option>
          {modules.map((m) => <option key={m}>{m}</option>)}
        </Select>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-44">
          <option value="">Toutes les actions</option>
          {actions.map((m) => <option key={m}>{m}</option>)}
        </Select>
      </div>
      <DataTable cols={cols} rows={rows} rowKey={(a) => a.id} pageSize={15} dense
        empty={<EmptyState icon={<ShieldCheck size={24} />} title="Aucune entrée d'audit" />}
      />
    </div>
  );
}

/* ============================================================
   SAUVEGARDE & RESTAURATION
   ============================================================ */
const META_KEY = "foodops-backups-meta";

export function BackupPage() {
  const { db, act, replaceDB, user } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<DB | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [meta, setMeta] = useState<{ name: string; date: string; sizeKB: number; movements: number }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) ?? "[]");
    } catch {
      return [];
    }
  });

  const sizeKB = Math.round((JSON.stringify(db).length / 1024) * 10) / 10;

  const exportBackup = () => {
    const name = `foodops-sauvegarde-${todayISO()}-${new Date().toTimeString().slice(0, 5).replace(":", "h")}.json`;
    downloadFile(name, JSON.stringify(db, null, 2), "application/json");
    const next = [{ name, date: nowISO(), sizeKB, movements: db.movements.length }, ...meta].slice(0, 8);
    setMeta(next);
    localStorage.setItem(META_KEY, JSON.stringify(next));
    act((d) => {
      pushAudit(d, { userId: user?.id ?? "", action: "UPDATE", module: "Sauvegarde", detail: `Sauvegarde exportée : ${name}`, siteId: null });
    }, `Sauvegarde exportée : ${name}`);
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as DB;
        if (parsed.version !== 5 || !Array.isArray(parsed.movements) || !Array.isArray(parsed.products) || !parsed.company)
          throw new Error("structure invalide");
        setPending(parsed);
      } catch {
        act(() => { throw new Error("Fichier de sauvegarde invalide : la restauration a été refusée pour protéger vos données."); });
      }
    };
    reader.readAsText(file);
  };

  const doRestore = () => {
    if (!pending) return;
    // sauvegarde de sécurité automatique avant restauration
    downloadFile(`foodops-securite-avant-restauration-${todayISO()}.json`, JSON.stringify(db, null, 2), "application/json");
    replaceDB(pending);
    setPending(null);
  };

  return (
    <div>
      <PageHead title="Sauvegarde & restauration" sub="La base locale complète (société, sites, produits, documents, mouvements, audit) dans un seul fichier." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Base actuelle">
          <div className="space-y-2 text-[13px]">
            <p className="flex justify-between"><span className="text-mute">Mouvements de stock</span><strong className="tnum">{db.movements.length}</strong></p>
            <p className="flex justify-between"><span className="text-mute">Documents d'achat</span><strong className="tnum">{db.purchaseOrders.length + db.receptions.length + db.invoices.length}</strong></p>
            <p className="flex justify-between"><span className="text-mute">Entrées d'audit</span><strong className="tnum">{db.audit.length}</strong></p>
            <p className="flex justify-between"><span className="text-mute">Taille de la base</span><strong className="tnum">{sizeKB} Ko</strong></p>
            <p className="flex justify-between"><span className="text-mute">Dernière initialisation</span><strong className="tnum">{fmtDateTime(db.seededAt)}</strong></p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button icon={<Download size={15} />} onClick={exportBackup}>Exporter une sauvegarde (.json)</Button>
            <Button variant="outline" icon={<Upload size={15} />} onClick={() => fileRef.current?.click()}>Restaurer un fichier…</Button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
          </div>
        </Card>

        <Card title="Historique des sauvegardes" sub="Derniers exports depuis ce poste">
          {meta.length ? (
            <ul className="space-y-2">
              {meta.map((m, i) => (
                <li key={i} className="flex items-center gap-2.5 rounded-md border border-line px-3 py-2">
                  <Database size={15} className="shrink-0 text-pine-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] font-bold text-ink2">{m.name}</p>
                    <p className="text-[11px] text-mute">{fmtDateTime(m.date)} · {m.sizeKB} Ko · {m.movements} mouvements</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-[12.5px] text-mute">Aucune sauvegarde exportée pour le moment.</p>
          )}
        </Card>

        <Card title="Zone sensible" className="border-bad/30">
          <p className="text-[12.5px] leading-relaxed text-ink2">
            La réinitialisation régénère le jeu de démonstration complet (société, sites, produits et ~30 jours
            d'opérations réalistes). <strong className="text-bad">Vos données actuelles seront remplacées.</strong>
          </p>
          <Button variant="danger" className="mt-4" icon={<RefreshCw size={15} />} onClick={() => setConfirmReset(true)}>
            Réinitialiser la démonstration
          </Button>
        </Card>
      </div>

      <DiagnosticsPanel />

      <Confirm
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={doRestore}
        title="Restaurer cette sauvegarde ?"
        confirmLabel="Restaurer"
        message={
          <>
            Le fichier contient <strong>{pending?.movements.length ?? 0} mouvements</strong> et{" "}
            <strong>{pending?.products.length ?? 0} produits</strong>. Une sauvegarde de sécurité de la base actuelle
            sera téléchargée automatiquement avant le remplacement.
          </>
        }
      />
      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => replaceDB(buildSeed())}
        title="Réinitialiser la démonstration ?"
        confirmLabel="Réinitialiser"
        message={<>Toutes les données actuelles seront remplacées par le jeu de démonstration. Pensez à exporter une sauvegarde avant.</>}
      />
    </div>
  );
}


