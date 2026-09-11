import { Suspense, useState, type ComponentType } from 'react';
import AppShell from '../layouts/AppShell';
import Spinner from '../components/ui/Spinner';
import PageLoadBoundary from '../components/system/PageLoadBoundary';
import type { User } from '../types/auth';
import type { PurchaseOrderPrefill } from '../types/purchase-order';
import {
  AccountSystemPage,
  CategoriesPage,
  DashboardPage,
  ForecastingPage,
  HelpPage,
  InventoryPage,
  ProductsPage,
  PurchaseOrdersPage,
  ReportsPage,
  SalesHistoryPage,
  StockMovementsPage,
  SuppliersPage,
  AuditLogsPage,
  UserManagementPage,
  PosPage,
} from './dashboard-pages';
import type { DashboardPageName } from './dashboard-pages/_shared/DashboardPageShell';
import type { HelpTopicId } from './dashboard-pages/help/guide';

type DashboardProps = {
  user: User;
  defaultRoute: 'Dashboard' | 'POS';
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
};

type DashboardPageComponentProps = {
  helpTopic?: HelpTopicId;
  onOpenHelp?: (topic: HelpTopicId) => void;
  userEmail?: string;
  user?: User;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  onUserUpdated?: (user: User) => void;
  userRole?: User['role'];
  purchaseOrderPrefill?: PurchaseOrderPrefill | null;
  onCreatePurchaseOrderFromPrefill?: (prefill: PurchaseOrderPrefill) => void;
  onPurchaseOrderPrefillConsumed?: () => void;
};

const dashboardPages: Record<DashboardPageName, ComponentType<DashboardPageComponentProps>> = {
  Dashboard: DashboardPage,
  Products: ProductsPage,
  Categories: CategoriesPage,
  Suppliers: SuppliersPage,
  'Purchase Orders': PurchaseOrdersPage,
  Inventory: InventoryPage,
  'Stock Movements': StockMovementsPage,
  'Sales History': SalesHistoryPage,
  Forecasting: ForecastingPage,
  Reports: ReportsPage,
  'User Management': UserManagementPage,
  'Audit Logs': AuditLogsPage,
  POS: PosPage,
  'Account & System': AccountSystemPage,
  'Help & System Guide': HelpPage,
};

export default function Dashboard({ user, defaultRoute, onLogout, onUserUpdated }: DashboardProps) {
  const staffPages: DashboardPageName[] = ['POS', 'Sales History', 'Products', 'Categories', 'Account & System', 'Help & System Guide'];
  const allowedPages = user.role === 'Admin'
    ? (Object.keys(dashboardPages) as DashboardPageName[])
    : staffPages;
  const initialPage = allowedPages.includes(defaultRoute) ? defaultRoute : allowedPages[0];
  const [activePage, setActivePage] = useState<DashboardPageName>(initialPage);
  const [helpTopic, setHelpTopic] = useState<HelpTopicId>('getting-started');
  const [purchaseOrderPrefill, setPurchaseOrderPrefill] = useState<PurchaseOrderPrefill | null>(null);
  const safeActivePage = allowedPages.includes(activePage) ? activePage : initialPage;
  const ActivePage = dashboardPages[safeActivePage];

  const handleNavigate = (page: DashboardPageName) => {
    if (allowedPages.includes(page)) {
      if (page === 'Help & System Guide') setHelpTopic('getting-started');
      setActivePage(page);
    }
  };

  const handleCreatePurchaseOrderFromPrefill = (prefill: PurchaseOrderPrefill) => {
    setPurchaseOrderPrefill(prefill);
    handleNavigate('Purchase Orders');
  };

  const pageStatus = (failed: boolean) => (
    <AppShell
      activePage={safeActivePage}
      userEmail={user.fullName || user.username || user.email}
      userRole={user.role}
      onLogout={onLogout}
      onNavigate={handleNavigate}
    >
      {failed ? (
        <div role="alert">
          <h1>Page could not be loaded</h1>
          <p>Check your connection and reload, or choose another page.</p>
          <button className="ui-button ui-button--secondary" onClick={() => window.location.reload()}>Reload application</button>
        </div>
      ) : <Spinner size="md" label="Loading page" />}
    </AppShell>
  );

  return (
    <PageLoadBoundary key={safeActivePage} fallback={pageStatus(true)}>
      <Suspense fallback={pageStatus(false)}>
        <ActivePage
          key={safeActivePage === 'Help & System Guide' ? helpTopic : safeActivePage}
          helpTopic={helpTopic}
          onOpenHelp={(topic) => { setHelpTopic(topic); setActivePage('Help & System Guide'); }}
          userEmail={user.fullName || user.username || user.email}
          user={user}
          onLogout={onLogout}
          onNavigate={handleNavigate}
          onUserUpdated={onUserUpdated}
          userRole={user.role}
          purchaseOrderPrefill={safeActivePage === 'Purchase Orders' ? purchaseOrderPrefill : null}
          onCreatePurchaseOrderFromPrefill={handleCreatePurchaseOrderFromPrefill}
          onPurchaseOrderPrefillConsumed={() => setPurchaseOrderPrefill(null)}
        />
      </Suspense>
    </PageLoadBoundary>
  );
}
