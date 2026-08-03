import { useState, type ComponentType } from 'react';
import type { User } from '../types/auth';
import {
  CategoriesPage,
  DashboardPage,
  ForecastingPage,
  InventoryPage,
  ProductsPage,
  ReportsPage,
  SalesHistoryPage,
  SettingsPage,
  SuppliersPage,
  UserManagementPage,
} from './dashboard-pages';
import type { DashboardPageName } from './dashboard-pages/_shared/DashboardPageShell';

type DashboardProps = {
  user: User;
  onLogout: () => void;
};

type DashboardPageComponentProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

const dashboardPages: Record<DashboardPageName, ComponentType<DashboardPageComponentProps>> = {
  Dashboard: DashboardPage,
  Products: ProductsPage,
  Categories: CategoriesPage,
  Suppliers: SuppliersPage,
  Inventory: InventoryPage,
  'Sales History': SalesHistoryPage,
  Forecasting: ForecastingPage,
  Reports: ReportsPage,
  'User Management': UserManagementPage,
  Settings: SettingsPage,
};

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [activePage, setActivePage] = useState<DashboardPageName>('Dashboard');
  const ActivePage = dashboardPages[activePage];

  return (
    <ActivePage
      userEmail={user.email}
      onLogout={onLogout}
      onNavigate={setActivePage}
    />
  );
}

