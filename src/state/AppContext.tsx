import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DB, ID, Site, User } from "../types";
import { buildSeed } from "../lib/seed";
import { checkSiteAccess, pushAudit } from "../lib/engine";
import { hashPw, nowISO } from "../lib/util";

const DB_KEY = "foodops-db-v3";
const SESSION_KEY = "foodops-session-v3";
const SITE_KEY = "foodops-site-v3";

export type ToastKind = "success" | "error" | "info" | "warn";
export interface Toast {
  id: number;
  kind: ToastKind;
  msg: string;
}

/* ---------- permissions par rôle ---------- */
const ALL_PERMS = [
  "dashboard.view",
  "products.view", "products.create", "products.edit", "products.delete",
  "suppliers.view", "suppliers.create", "suppliers.edit",
  "purchases.view", "purchases.create", "purchases.approve",
  "receptions.view", "receptions.create", "receptions.validate", "receptions.cancel",
  "stock.view", "stock.adjust", "stock.transfer",
  "consumption.view", "consumption.create", "consumption.validate",
  "waste.view", "waste.create", "waste.validate",
  "inventory.view", "inventory.create", "inventory.validate",
  "sales.view", "sales.create",
  "reports.view", "reports.export",
  "users.view", "users.create", "users.edit", "users.delete",
  "settings.view", "settings.edit",
  "backup.manage",
  "audit.view",
];

const MANAGER_PERMS = ALL_PERMS.filter(
  (p) =>
    !["users.create", "users.delete", "settings.edit", "backup.manage", "audit.view"].includes(p)
);

const ECONOME_PERMS = [
  "dashboard.view",
  "products.view",
  "suppliers.view",
  "purchases.view", "purchases.create",
  "receptions.view", "receptions.create", "receptions.validate",
  "stock.view", "stock.adjust", "stock.transfer",
  "consumption.view", "consumption.create", "consumption.validate",
  "waste.view", "waste.create", "waste.validate",
  "inventory.view", "inventory.create",
  "sales.view", "sales.create",
  "reports.view",
];

function canFor(user: User | null, perm: string): boolean {
  if (!user) return false;
  // L'espace propriétaire est strictement réservé au rôle Propriétaire.
  if (perm === "proprietaire.view") return user.role === "proprietaire";
  if (user.role === "proprietaire") return true;
  if (user.role === "admin") return true;
  if (user.role === "manager") return MANAGER_PERMS.includes(perm);
  if (user.role === "econome") return ECONOME_PERMS.includes(perm);
  // contrôleur : lecture seule + exports
  return perm.endsWith(".view") || perm === "reports.export" || perm === "dashboard.view";
}

/* ---------- chargement / sauvegarde ---------- */

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 5 && Array.isArray(parsed.movements)) return parsed;
    }
  } catch {
    console.warn("Base locale illisible — régénération du jeu de démonstration.");
  }
  const seeded = buildSeed();
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  } catch {
    /* stockage indisponible : mode mémoire */
  }
  return seeded;
}

export function persistDB(db: DB): void {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    console.warn("Persistance impossible (stockage plein ?).");
  }
}

/* ---------- contexte ---------- */

interface AppCtx {
  db: DB;
  user: User | null;
  siteId: ID | null; // null = tous les sites
  route: string;
  params: Record<string, unknown>;
  toasts: Toast[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  nav: (route: string, params?: Record<string, unknown>) => void;
  setSite: (id: ID | null) => void;
  toast: (msg: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  /** exécute une mutation du moteur de stock (clonage + audit + persistance + toast) */
  act: (fn: (d: DB) => void, okMsg?: string) => boolean;
  /** remplace la base entière (restauration de sauvegarde) */
  replaceDB: (db: DB) => void;
  can: (perm: string) => boolean;
  checkSite: (siteId: ID) => boolean;
  allowedSites: Site[];
  siteName: (id: ID | null | undefined) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(loadDB);
  const dbRef = useRef(db);
  dbRef.current = db;

  const [user, setUser] = useState<User | null>(() => {
    const id = localStorage.getItem(SESSION_KEY);
    const d = dbRef.current;
    return d.users.find((u) => u.id === id && u.active) ?? null;
  });
  const userRef = useRef(user);
  userRef.current = user;

  const [siteId, setSiteId] = useState<ID | null>(() => {
    const stored = localStorage.getItem(SITE_KEY);
    return stored === "all" ? null : stored ?? null;
  });
  const [route, setRoute] = useState("dashboard");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const commit = useCallback((next: DB) => {
    dbRef.current = next;
    setDb(next);
    persistDB(next);
  }, []);

  /** Mutation atomique : clone → moteur → persistance. Toute erreur
      métier est convertie en message français (jamais d'erreur brute). */
  const act = useCallback(
    (fn: (d: DB) => void, okMsg?: string): boolean => {
      try {
        const clone = structuredClone(dbRef.current);
        fn(clone);
        commit(clone);
        if (okMsg) toast(okMsg, "success");
        return true;
      } catch (e) {
        const msg =
          e instanceof Error && e.message
            ? e.message
            : "Une erreur inattendue s'est produite. L'opération a été annulée.";
        console.error("[FoodOps]", e);
        toast(msg, "error");
        return false;
      }
    },
    [commit, toast]
  );

  const replaceDB = useCallback(
  (next: DB) => {
    const currentUser = userRef.current;
    const currentSiteId = localStorage.getItem(SITE_KEY);

    // Vérifier que la base restaurée contient une structure utilisateur valide.
    const restoredUser = currentUser
      ? next.users.find(
          (u) => u.id === currentUser.id && u.active
        ) ?? null
      : null;

    // Vérifier que le site sélectionné existe encore et reste accessible.
    let restoredSiteId: ID | null = null;

    if (currentSiteId && currentSiteId !== "all" && restoredUser) {
      const siteExists = next.sites.some(
        (s) => s.id === currentSiteId && s.status === "actif"
      );

      if (siteExists) {
        try {
          checkSiteAccess(next, restoredUser.id, currentSiteId);
          restoredSiteId = currentSiteId;
        } catch {
          restoredSiteId = null;
        }
      }
    }

    // Remplacer la base avant de finaliser l'état de session.
    commit(next);

    if (restoredUser) {
      // Le même utilisateur existe encore dans la base restaurée.
      setUser(restoredUser);
      localStorage.setItem(SESSION_KEY, restoredUser.id);

      setSiteId(restoredSiteId);
      localStorage.setItem(SITE_KEY, restoredSiteId ?? "all");

      toast(
        "Base de données restaurée. Votre session a été conservée.",
        "success"
      );
    } else {
      // L'utilisateur courant n'existe plus ou est désactivé
      // dans la base restaurée : fermeture de session obligatoire.
      localStorage.removeItem(SESSION_KEY);
      localStorage.setItem(SITE_KEY, "all");
      setUser(null);
      setSiteId(null);

      toast(
        "Base restaurée. Votre compte n'existe plus dans cette sauvegarde : vous avez été déconnecté.",
        "warn"
      );
    }
  },
  [commit, toast]
);

  const nav = useCallback((r: string, p?: Record<string, unknown>) => {
    setRoute(r);
    setParams(p ?? {});
    window.scrollTo({ top: 0 });
  }, []);

  const setSite = useCallback((id: ID | null) => {
    setSiteId(id);
    localStorage.setItem(SITE_KEY, id ?? "all");
  }, []);

  const login = useCallback(
    (username: string, password: string): boolean => {
      const d = dbRef.current;
      const u = d.users.find((x) => x.username === username.trim().toLowerCase());
      if (!u || u.passwordHash !== hashPw(password)) return false;
      if (!u.active) {
        toast("Ce compte est désactivé. Contactez un administrateur.", "warn");
        return false;
      }
      setUser(u);
      localStorage.setItem(SESSION_KEY, u.id);
      const clone = structuredClone(d);
      pushAudit(clone, {
        userId: u.id,
        action: "LOGIN",
        module: "Sécurité",
        detail: "Connexion à l'application",
        siteId: null,
      });
      commit(clone);
      toast(`Bienvenue, ${u.name.split(" ")[0]}.`, "success");
      return true;
    },
    [commit, toast]
  );

  const logout = useCallback(() => {
    const u = userRef.current;
    if (u) {
      const clone = structuredClone(dbRef.current);
      pushAudit(clone, {
        userId: u.id,
        action: "LOGOUT",
        module: "Sécurité",
        detail: "Déconnexion",
        siteId: null,
      });
      commit(clone);
    }
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, [commit]);

  const can = useCallback((perm: string) => canFor(userRef.current, perm), []);

  const allowedSites = useMemo(() => {
    if (!user) return [];
    const active = db.sites.filter((s) => s.status === "actif");
    return user.siteIds === "all" ? active : active.filter((s) => (user.siteIds as ID[]).includes(s.id));
  }, [db.sites, user]);

  const checkSite = useCallback(
    (sid: ID): boolean => {
      const u = userRef.current;
      if (!u) return false;
      try {
        checkSiteAccess(dbRef.current, u.id, sid);
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const siteName = useCallback(
    (id: ID | null | undefined): string => {
      if (!id) return "Tous les sites";
      return db.sites.find((s) => s.id === id)?.name ?? "Site inconnu";
    },
    [db.sites]
  );

  const value: AppCtx = {
    db,
    user,
    siteId,
    route,
    params,
    toasts,
    login,
    logout,
    nav,
    setSite,
    toast,
    dismissToast,
    act,
    replaceDB,
    can,
    checkSite,
    allowedSites,
    siteName,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp doit être utilisé dans <AppProvider>.");
  return ctx;
}

/* utilitaire : id utilisateur courant pour le moteur */
export function useUserId(): ID {
  const { user } = useApp();
  return user?.id ?? "u-admin";
}

export const auditNow = nowISO;
