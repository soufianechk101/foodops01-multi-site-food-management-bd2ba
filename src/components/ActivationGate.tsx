import { useEffect, useState } from "react";
import { ShieldCheck, KeyRound, Clock, Crown, LogOut } from "lucide-react";
import { Button, Input, Field } from "./ui";

type Status = {
  activated: boolean;
  type: "demo" | "life" | null;
  expiresAt: string | null;
  daysLeft: number | null;
  code: string | null;
  activatedAt?: string;
  expired?: boolean;
};

declare global {
  interface Window {
    foodopsDesktop?: {
      activationStatus: () => Promise<Status>;
      activate: (code: string) => Promise<{ ok: boolean; error?: string; status?: Status }>;
      deactivate: () => Promise<{ ok: boolean }>;
    };
  }
}

export function ActivationGate({ children }: { children: React.ReactNode }) {
  const isDesktop = typeof window !== "undefined" && !!window.foodopsDesktop;
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!window.foodopsDesktop) { setLoading(false); return; }
    const s = await window.foodopsDesktop.activationStatus();
    setStatus(s);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  // En web (pas Electron) → pas de gate, laisse passer
  if (!isDesktop) return <>{children}</>;

  if (loading) return <div className="flex h-screen items-center justify-center bg-paper text-sm text-mute">Vérification de la licence…</div>;

  // Activé → afficher l'app + bandeau si demo
  if (status?.activated) {
    return (
      <>
        {status.type === "demo" && status.daysLeft !== null && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 px-3 py-1.5 text-[12.5px] font-semibold text-amber-900">
            <Clock size={14} /> Version DEMO — expire dans {status.daysLeft} jour(s) {status.expiresAt ? `(${new Date(status.expiresAt).toLocaleDateString()})` : ""}
            {status.daysLeft <= 1 && <span className="rounded bg-bad px-1.5 py-0.5 text-white text-[11px]">Expire bientôt</span>}
          </div>
        )}
        {status.type === "life" && (
          <div className="flex items-center justify-center gap-2 bg-pine-700 px-3 py-1 text-[11.5px] font-bold text-pine-100">
            <Crown size={13} /> Licence à vie activée
          </div>
        )}
        {children}
      </>
    );
  }

  // Non activé / expiré → écran d'activation bloquant
  const doActivate = async () => {
    setErr(null);
    if (!code.trim()) { setErr("Saisissez votre code d'activation."); return; }
    setBusy(true);
    try {
      const res = await window.foodopsDesktop!.activate(code);
      if (!res.ok) setErr(res.error || "Code invalide.");
      else await refresh();
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div className="w-full max-w-md rounded-xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pine-900 text-white"><ShieldCheck size={20} /></div>
          <div>
            <h1 className="font-display text-[17px] font-bold text-ink">Activation FoodOps</h1>
            <p className="text-[12.5px] text-mute">Saisissez votre code pour déverrouiller l'application.</p>
          </div>
        </div>

        {status?.expired && (
          <div className="mb-4 rounded-md border border-bad/25 bg-badbg px-3 py-2 text-[12.5px] font-semibold text-bad">
            Votre période démo de 5 jours est expirée. Saisissez un nouveau code (DEMO ou LIFE).
          </div>
        )}

        <div className="space-y-3">
          <Field label="Code d'activation">
            <div className="relative">
              <KeyRound size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-mute" />
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="FOODOPS-DEMO-XXXX-XXXX ou FOODOPS-LIFE-XXXX-XXXX" className="pl-8 font-mono text-[12.5px] tracking-wide" />
            </div>
          </Field>
          {err && <p className="rounded-md bg-badbg px-3 py-2 text-[12.5px] font-semibold text-bad">{err}</p>}
          <Button onClick={doActivate} disabled={busy} className="w-full">{busy ? "Vérification…" : "Activer"}</Button>
        </div>

        <div className="mt-5 rounded-md bg-paper px-3 py-3 text-[11.5px] leading-snug text-mute">
          <p className="font-bold text-ink2">Deux types de licence :</p>
          <ul className="mt-1 list-disc pl-4">
            <li><span className="font-mono font-bold">FOODOPS-DEMO-XXXX-XXXX</span> → démo 5 jours à partir de l'activation</li>
            <li><span className="font-mono font-bold">FOODOPS-LIFE-XXXX-XXXX</span> → licence à vie, jamais d'expiration</li>
          </ul>
          <p className="mt-2">Contactez le fournisseur pour obtenir votre code. Validation 100% offline.</p>
        </div>
      </div>
    </div>
  );
}
