import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import localforage from "localforage";
import type { DB, ID, Site, User } from "../types";
import { buildSeed } from "../lib/seed";
import { checkSiteAccess, pushAudit } from "../lib/engine";
import { hashPw, nowISO } from "../lib/util";

// إعداد localforage مرة وحدة فبداية التطبيق
localforage.config({
  name: "FoodOpsDB",
  storeName: "app_state",
  driver: localforage.INDEXEDDB, // نضمنو استخدام IndexedDB
});

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
  if (perm === "proprietaire.view") return user.role === "proprietaire";
  if (user.role === "proprietaire") return true;
  if (user.role === "admin") return true;
  if (user.role === "manager") return MANAGER_PERMS.includes(perm);
  if (user.role === "econome") return ECONOME_PERMS.includes(perm);
  return perm.endsWith(".view") || perm === "reports.export" || perm === "dashboard.view";
}

/* ---------- chargement / sauvegarde (Async avec IndexedDB) ---------- */

export async function persistDB(db: DB): Promise<void> {
  try {
    await localforage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn("Persistance impossible (stockage plein ?).", e);
  }
}

/* ---------- contexte ---------- */

interface AppCtx {
  db: DB;
  user: User | null;
  siteId: ID | null;
  route: string;
  params: Record<string, unknown>;
  toasts: Toast[];
  login: (username: string, password: string) => boolean;
  logout: () => void;
  nav: (route: string, params?: Record<string, unknown>) => void;
  setSite: (id: ID | null) => void;
  toast: (msg: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  act: (fn: (d: DB) => void, okMsg?: string) => boolean;
  replaceDB: (db: DB) => void;
  can: (perm: string) => boolean;
  checkSite: (siteId: ID) => boolean;
  allowedSites: Site[];
  siteName: (id: ID | null | undefined) => string;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);
  const dbRef = useRef<DB | null>(null);
  
  const [user, setUser] = useState<User | null>(null);
  const userRef = useRef<User | null>(null);
  
  const [siteId, setSiteId] = useState<ID | null>(null);
  const [route, setRoute] = useState("dashboard");
  const [params, setParams] = useState<Record<string, unknown>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isReady, setIsReady] = useState(false); // État de chargement initial
  const toastId = useRef(0);

  // Initialisation asynchrone au montage du composant
  useEffect(() => {
    const initApp = async () => {
      let currentDb: DB;
      try {
        const raw = await localforage.getItem<string>(DB_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as DB;
          if (parsed.version === 5 && Array.isArray(parsed.movements)) {
            currentDb = parsed;
          } else {
            currentDb = buildSeed();
            await localforage.setItem(DB_KEY, JSON.stringify(currentDb));
          }
        } else {
          currentDb = buildSeed();
          await localforage.setItem(DB_KEY, JSON.stringify(currentDb));
        }
      } catch (e) {
        console.warn("Erreur de chargement IndexedDB, fallback sur seed.", e);
        currentDb = buildSeed();
      }

      setDb(currentDb);
      dbRef.current = currentDb;

      // Charger la session
      const sessionId = await localforage.getItem<string>(SESSION_KEY);
      if (sessionId) {
        const foundUser = currentDb.users.find((u) => u.id === sessionId && u.active) ?? null;
        setUser(foundUser);
        userRef.current = foundUser;
      }

      // Charger le site
      const storedSite = await localforage.getItem<string>(SITE_KEY);
      setSiteId(storedSite === "all" ? null : (storedSite as ID | null));

      setIsReady(true);
    };

    initApp();
  }, []);

  const toast = useCallback((msg: string, kind: ToastKind = "success") => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const commit = useCallback((next: DB) => {
    if (!dbRef.current) return;
    dbRef.current = next;
    setDb(next);
    // Sauvegarde en arrière-plan (fire-and-forget) pour ne pas bloquer l'UI
    persistDB(next).catch(console.error);
  }, []);

  const act = useCallback(
    (fn: (d: DB) => void, okMsg?: string): boolean => {
      if (!dbRef.current) return false;
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

  // ============================================================
  // PATCH: Restore Session & Site Selection Logic (Harden & Isolate)
  // ============================================================
  const replaceDB = useCallback(
    (next: DB) => {
      // 1. Lire la session AVANT remplacement
      const currentUser = userRef.current;
      const storedSiteId = localStorage.getItem(SITE_KEY);

      // 2. Retrouver l'utilisateur dans la base restaurée
      let restoredUser: User | null = null;
      if (currentUser) {
        restoredUser = next.users.find((u) => u.id === currentUser.id && u.active) ?? null;
      }

      // 3. Réconcilier le site sélectionné (Logical Sequence)
      let finalSiteId: ID | null = null;
      if (storedSiteId && storedSiteId !== "all" && restoredUser) {
        // Site exists & Site active?
        const siteExistsAndActive = next.sites.some((s) => s.id === storedSiteId && s.status === "actif");
        
        if (siteExistsAndActive) {
          try {
            // User authorized? (On réutilise la règle métier existante — pas de duplication)
            checkSiteAccess(next, restoredUser.id, storedSiteId);
            finalSiteId = storedSiteId; // YES → preserve site
          } catch {
            finalSiteId = null; // NO → siteId = null (User has no access)
          }
        }
        // If site doesn't exist or is inactive, finalSiteId remains null.
      }
      // If storedSiteId was "all" or missing, finalSiteId remains null (Case 1).

      // 4. Remplacer la base (persistance via le mécanisme existant)
      commit(next);

      // 5. Mettre à jour l'état React + localforage
      if (restoredUser) {
        // ✅ Utilisateur retrouvé et actif → on garde la session
        setUser(restoredUser);
        userRef.current = restoredUser;
        localforage.setItem(SESSION_KEY, restoredUser.id).catch(console.error);

        setSiteId(finalSiteId);
        localforage.setItem(SITE_KEY, finalSiteId ?? "all").catch(console.error);

        toast("Base de données restaurée. Votre session a été conservée.", "success");
      } else {
        // ❌ Utilisateur absent ou désactivé → invalidation de session propre
        // On n'appelle PAS logout() pour éviter un audit erroné sur l'ancienne base
        localforage.removeItem(SESSION_KEY).catch(console.error);
        localforage.setItem(SITE_KEY, "all").catch(console.error);
        setUser(null);
        userRef.current = null;
        setSiteId(null);

        toast("Base restaurée. Votre compte n'existe plus dans cette sauvegarde ou est désactivé : vous avez été déconnecté.", "warn");
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
    localforage.setItem(SITE_KEY, id ?? "all").catch(console.error);
  }, []);

  const login = useCallback(
    (username: string, password: string): boolean => {
      if (!dbRef.current) return false;
      const d = dbRef.current;
      const u = d.users.find((x) => x.username === username.trim().toLowerCase());
      if (!u || u.passwordHash !== hashPw(password)) return false;
      if (!u.active) {
        toast("Ce compte est désactivé. Contactez un administrateur.", "warn");
        return false;
      }
      setUser(u);
      userRef.current = u;
      localforage.setItem(SESSION_KEY, u.id).catch(console.error);
      
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
    if (u && dbRef.current) {
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
    localforage.removeItem(SESSION_KEY).catch(console.error);
    setUser(null);
    userRef.current = null;
  }, [commit]);

  const can = useCallback((perm: string) => canFor(userRef.current, perm), []);

  const allowedSites = useMemo(() => {
    if (!user || !db) return [];
    const active = db.sites.filter((s) => s.status === "actif");
    return user.siteIds === "all" ? active : active.filter((s) => (user.siteIds as ID[]).includes(s.id));
  }, [db?.sites, user]);

  const checkSite = useCallback(
    (sid: ID): boolean => {
      const u = userRef.current;
      if (!u || !dbRef.current) return false;
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
      if (!db) return "Tous les sites";
      if (!id) return "Tous les sites";
      return db.sites.find((s) => s.id === id)?.name ?? "Site inconnu";
    },
    [db]
  );

  // Afficher un écran de chargement pendant l'initialisation d'IndexedDB
  if (!isReady || !db) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        Chargement de FoodOps...
      </div>
    );
  }

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

export function useUserId(): ID {
  const { user } = useApp();
  return user?.id ?? "u-admin";
}

export const auditNow = nowISO;