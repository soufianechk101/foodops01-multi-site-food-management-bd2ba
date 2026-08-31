import { useState, type FormEvent } from "react";
import { ArrowRight, Database, KeyRound, Layers, Lock, Percent, UserRound } from "lucide-react";
import { useApp } from "../state/AppContext";
import { Button, Field, Input } from "../components/ui";
import { LogoMark } from "../components/Layout";
import { DEMO_ACCOUNTS } from "../lib/seed";
import { cn } from "../lib/cn";

export function Login() {
  const { login, db } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const ok = login(username, password);
    if (!ok) {
      setError(true);
      setTimeout(() => setError(false), 600);
    }
  };

  return (
    <div className="flex min-h-full">
      {/* panneau marque */}
      <div className="side-bg relative hidden w-[46%] flex-col justify-between overflow-hidden p-10 text-pine-100 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="relative flex items-center gap-3">
          <LogoMark size={42} />
          <div>
            <p className="font-display text-[22px] font-bold leading-none text-white">FoodOps</p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-pine-300">
              F&B Control Suite
            </p>
          </div>
        </div>

        <div className="relative">
          <h1 className="font-display text-[38px] font-bold leading-[1.12] text-white">
            Le stock de chaque site,
            <br />
            <span className="text-copper-300">au gramme près.</span>
          </h1>
          <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-pine-200">
            Achats, réceptions, transferts, inventaires, consommations et food cost —
            une traçabilité complète, site par site, même sans connexion.
          </p>
          <ul className="mt-8 space-y-3.5">
            {[
              { icon: <Layers size={16} />, txt: "Stock multi-sites : jamais global, toujours par site" },
              { icon: <Database size={16} />, txt: "Base locale hors-ligne, sauvegarde & restauration" },
              { icon: <Percent size={16} />, txt: "Food cost quotidien comparé à l'objectif" },
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-[13.5px] font-medium text-pine-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/8 text-copper-300">
                  {f.icon}
                </span>
                {f.txt}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11.5px] text-pine-300">
          <span>{db.company.legalName}</span>
          <span className="tnum font-mono">v3.0 · {db.movements.length} mouvements en base</span>
        </div>
      </div>

      {/* formulaire */}
      <div className="ledger-bg flex flex-1 items-center justify-center p-6">
        <div className={cn("w-full max-w-[400px]", error && "anim-shake")}>
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <p className="font-display text-[20px] font-bold text-ink">FoodOps</p>
          </div>
          <div className="rounded-xl border border-line bg-card p-7 shadow-[0_10px_36px_rgba(16,46,36,0.1)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-pine-800 text-copper-300">
              <KeyRound size={20} />
            </span>
            <h2 className="mt-4 font-display text-[22px] font-bold text-ink">Connexion</h2>
            <p className="mt-1 text-[13px] text-mute">
              Accédez à votre espace de pilotage F&B.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <Field label="Nom d'utilisateur">
                <div className="relative">
                  <UserRound size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ex. admin"
                    className="pl-9"
                    autoFocus
                    required
                  />
                </div>
              </Field>
              <Field label="Mot de passe">
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                    required
                  />
                </div>
              </Field>
              {error && (
                <p className="rounded-md border border-bad/25 bg-badbg px-3 py-2 text-[12.5px] font-semibold text-bad">
                  Identifiants incorrects ou compte désactivé.
                </p>
              )}
              <Button type="submit" className="w-full" icon={<ArrowRight size={15} />}>
                Se connecter
              </Button>
            </form>
          </div>

          <div className="mt-4 rounded-lg border border-line bg-card/80 p-3.5">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-mute">
              Comptes de démonstration
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.username}
                  onClick={() => {
                    setUsername(a.username);
                    setPassword(a.password);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1.5 text-left transition-all hover:border-copper-400 hover:bg-copper-50",
                    a.username === "proprietaire" ? "col-span-2 border-copper-300 bg-copper-50/70" : "border-line"
                  )}
                >
                  <span className={cn("block text-[12px] font-bold", a.username === "proprietaire" ? "text-copper-700" : "text-ink")}>
                    {a.role}
                  </span>
                  <span className="block font-mono text-[10.5px] text-mute">
                    {a.username} / {a.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
