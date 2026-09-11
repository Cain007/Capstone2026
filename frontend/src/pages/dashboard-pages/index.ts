import { lazy } from 'react';

export const CategoriesPage = lazy(() => import('./categories'));
export const DashboardPage = lazy(() => import('./dashboard'));
export const ForecastingPage = lazy(() => import('./forecasting'));
export const HelpPage = lazy(() => import('./help'));
export const InventoryPage = lazy(() => import('./inventory'));
export const ProductsPage = lazy(() => import('./products'));
export const PurchaseOrdersPage = lazy(() => import('./purchase-orders'));
export const PosPage = lazy(() => import('./pos'));
export const ReportsPage = lazy(() => import('./reports'));
export const SalesHistoryPage = lazy(() => import('./sales-history'));
export const StockMovementsPage = lazy(() => import('./stock-movements'));
export const AccountSystemPage = lazy(() => import('./settings'));
export const SuppliersPage = lazy(() => import('./suppliers'));
export const AuditLogsPage = lazy(() => import('./audit-logs'));
export const UserManagementPage = lazy(() => import('./user-management'));
