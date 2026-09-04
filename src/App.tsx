import { lazy, Suspense } from "react";
import { AppProvider, useApp } from "./state/AppContext";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { EmptyState } from "./components/ui";
import { Lock } from "lucide-react";
import type { RefTab } from "./pages/Referentiel";
import { PdfPrintProvider } from './pdf/PdfPrintManager';

/* Chargement paresseux (code-splitting) : chaque page devient un morceau
   séparé, chargé uniquement quand l'utilisateur y accède. */
const Dashboard = lazy(() => import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const OwnerPage = lazy(() => import("./pages/Owner").then((m) => ({ default: m.OwnerPage })));
const ReferentielPage = lazy(() => import("./pages/Referentiel").then((m) => ({ default: m.ReferentielPage })));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchasePages").then((m) => ({ default: m.PurchaseOrdersPage })));
const ReceptionsPage = lazy(() => import("./pages/PurchasePages").then((m) => ({ default: m.ReceptionsPage })));
const InvoicesPage = lazy(() => import("./pages/PurchasePages").then((m) => ({ default: m.InvoicesPage })));
const PaymentsPage = lazy(() => import("./pages/PurchasePages").then((m) => ({ default: m.PaymentsPage })));
const StockPage = lazy(() => import("./pages/StockPages").then((m) => ({ default: m.StockPage })));
const MovementsPage = lazy(() => import("./pages/StockPages").then((m) => ({ default: m.MovementsPage })));
const InitialStockPage = lazy(() => import("./pages/StockPages").then((m) => ({ default: m.InitialStockPage })));
const TransfersPage = lazy(() => import("./pages/FlowPages").then((m) => ({ default: m.TransfersPage })));
const InventoriesPage = lazy(() => import("./pages/FlowPages").then((m) => ({ default: m.InventoriesPage })));
const WastePage = lazy(() => import("./pages/FlowPages").then((m) => ({ default: m.WastePage })));
const ConsumptionsPage = lazy(() => import("./pages/ConsumptionPages").then((m) => ({ default: m.ConsumptionsPage })));
const SalesFoodCostPage = lazy(() => import("./pages/ConsumptionPages").then((m) => ({ default: m.SalesFoodCostPage })));
const ProductsPage = lazy(() => import("./pages/MasterPages").then((m) => ({ default: m.ProductsPage })));
const CategoriesPage = lazy(() => import("./pages/MasterPages").then((m) => ({ default: m.CategoriesPage })));
const SuppliersPage = lazy(() => import("./pages/MasterPages").then((m) => ({ default: m.SuppliersPage })));
const ReportsPage = lazy(() => import("./pages/Reports").then((m) => ({ default: m.ReportsPage })));
const UsersPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.SettingsPage })));
const AuditPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AuditPage })));
const BackupPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.BackupPage })));

function Router() {
  const { route, can } = useApp();
  // routes composées « base:registre » (ex. referentiel:unites)
  const base = route.split(":")[0];
  const tab = route.split(":")[1] as RefTab | undefined;

  const guard = (perm: string, node: React.ReactNode) =>
    can(perm) ? (
      node
    ) : (
      <EmptyState
        icon={<Lock size={24} />}
        title="Accès non autorisé"
        sub="Votre rôle ne permet pas d'accéder à ce module. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur."
      />
    );

  switch (base) {
    case "dashboard":
      return guard("dashboard.view", <Dashboard />);
    case "proprietaire":
      return guard("proprietaire.view", <OwnerPage />);
    case "referentiel":
      return guard("products.view", <ReferentielPage tab={tab} />);
    case "achats":
      return guard("purchases.view", <PurchaseOrdersPage />);
    case "receptions":
      return guard("receptions.view", <ReceptionsPage />);
    case "factures":
      return guard("purchases.view", <InvoicesPage />);
    case "reglements":
      return guard("purchases.view", <PaymentsPage />);
    case "stock":
      return guard("stock.view", <StockPage />);
    case "mouvements":
      return guard("stock.view", <MovementsPage />);
    case "transferts":
      return guard("stock.transfer", <TransfersPage />);
    case "stock-initial":
      return guard("stock.view", <InitialStockPage />);
    case "inventaires":
      return guard("inventory.view", <InventoriesPage />);
    case "pertes":
      return guard("waste.view", <WastePage />);
    case "consommations":
      return guard("consumption.view", <ConsumptionsPage />);
    case "ventes":
      return guard("sales.view", <SalesFoodCostPage />);
    case "produits":
      return guard("products.view", <ProductsPage />);
    case "categories":
      return guard("products.view", <CategoriesPage />);
    case "fournisseurs":
      return guard("suppliers.view", <SuppliersPage />);
    case "rapports":
      return guard("reports.view", <ReportsPage />);
    case "utilisateurs":
      return guard("users.view", <UsersPage />);
    case "parametres":
      return guard("settings.view", <SettingsPage />);
    case "audit":
      return guard("audit.view", <AuditPage />);
    case "sauvegarde":
      return guard("backup.manage", <BackupPage />);
    default:
      return <Dashboard />;
  }
}

function Shell() {
  const { user } = useApp();
  if (!user) return <Login />;
  return (
    <Layout>
      <Suspense
        fallback={
          <div className="px-6 py-12 text-center text-sm opacity-70">Chargement…</div>
        }
      >
        <Router />
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
  <AppProvider>
    <PdfPrintProvider>
      <Shell />
    </PdfPrintProvider>
  </AppProvider>
);
}
