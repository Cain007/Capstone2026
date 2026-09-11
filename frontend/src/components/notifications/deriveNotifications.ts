import type { AdminDashboardResponse } from '../../types/dashboard';
import type { DashboardPageName } from '../../pages/dashboard-pages/_shared/DashboardPageShell';

export type NotificationItem = {
  id: string;
  category: 'Inventory' | 'Predictive' | 'Procurement' | 'Forecast';
  priority: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  targetPage: DashboardPageName;
};

const rank = { critical: 0, warning: 1, info: 2 };

// Aggregate conditions avoid the dashboard's capped product and delivery lists.
export function deriveNotifications(data: AdminDashboardResponse): NotificationItem[] {
  const items: NotificationItem[] = [];
  function add(category: NotificationItem['category'], condition: string, priority: NotificationItem['priority'], title: string, count: number, message: string, targetPage: DashboardPageName) {
    if (count > 0) items.push({ id: `${category}-all-${condition}`, category, priority, title, message: `${message}: ${count.toLocaleString('en-PH')}.`, targetPage });
  }
  const stock = data.inventory;
  add('Inventory', 'OUT_OF_STOCK', 'critical', 'Out of stock', stock.outOfStock, 'Products with no stock', 'Inventory');
  add('Inventory', 'CRITICAL', 'critical', 'Critical stock', stock.critical, 'Products with critical static stock health', 'Inventory');
  add('Inventory', 'LOW', 'warning', 'Low stock', stock.low, 'Products with low static stock health', 'Inventory');
  add('Inventory', 'UNCONFIGURED', 'info', 'Reorder points not configured', stock.unconfiguredReorderPoints, 'Products with positive stock but no reorder point', 'Inventory');
  const risk = data.predictive;
  add('Predictive', 'OUT_OF_STOCK', 'critical', 'Predictive review: out of stock', risk.outOfStock, 'Active products out of stock in predictive monitoring', 'Forecasting');
  add('Predictive', 'CRITICAL', 'critical', 'Critical predictive coverage', risk.critical, 'Active products with forecast-based coverage of 3 days or less', 'Forecasting');
  add('Predictive', 'AT_RISK', 'warning', 'Predictive stock risk', risk.atRisk, 'Active products with forecast-based coverage above 3 and up to 7 days', 'Forecasting');
  add('Forecast', 'NO_FORECAST', 'info', 'Forecast gaps', risk.forecastRequired, 'Active products classified No Forecast', 'Forecasting');
  const orders = data.procurement;
  add('Procurement', 'PARTIALLY_RECEIVED', 'warning', 'Purchase orders partially received', orders.partiallyReceived, 'Partially received orders with outstanding quantities', 'Purchase Orders');
  add('Procurement', 'ORDERED', 'info', 'Purchase orders awaiting receiving', orders.openPurchaseOrders - orders.partiallyReceived, 'Orders marked Ordered and awaiting receiving', 'Purchase Orders');
  return items.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
