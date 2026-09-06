import { useState, type ComponentType } from 'react';
import type { User } from '../types/auth';
import type { PurchaseOrderPrefill } from '../types/purchase-order';
import {
  AccountSystemPage,
  CategoriesPage,
  DashboardPage,
  ForecastingPage,
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

type DashboardProps = {
  user: User;
  defaultRoute: 'Dashboard' | 'POS';
  onLogout: () => void;
  onUserUpdated: (user: User) => void;
};

type DashboardPageComponentProps = {
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
};

export default function Dashboard({ user, defaultRoute, onLogout, onUserUpdated }: DashboardProps) {
  const staffPages: DashboardPageName[] = ['POS', 'Sales History', 'Products', 'Categories', 'Account & System'];
  const allowedPages = user.role === 'Admin'
    ? (Object.keys(dashboardPages) as DashboardPageName[])
    : staffPages;
  const initialPage = allowedPages.includes(defaultRoute) ? defaultRoute : allowedPages[0];
  const [activePage, setActivePage] = useState<DashboardPageName>(initialPage);
  const [purchaseOrderPrefill, setPurchaseOrderPrefill] = useState<PurchaseOrderPrefill | null>(null);
  const safeActivePage = allowedPages.includes(activePage) ? activePage : initialPage;
  const ActivePage = dashboardPages[safeActivePage];

  const handleNavigate = (page: DashboardPageName) => {
    if (allowedPages.includes(page)) {
      setActivePage(page);
    }
  };

  const handleCreatePurchaseOrderFromPrefill = (prefill: PurchaseOrderPrefill) => {
    setPurchaseOrderPrefill(prefill);
    handleNavigate('Purchase Orders');
  };

  return (
    <ActivePage
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
  );
}
