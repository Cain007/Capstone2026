export type DashboardSales = {
  todayRevenueCents: number;
  todayTransactions: number;
  averageTransactionCents: number;
  unitsSoldToday: number;
  weekRevenueCents: number;
  monthRevenueCents: number;
};

export type DashboardSalesTrendPoint = {
  date: string;
  revenueCents: number;
  transactions: number;
};

export type DashboardInventory = {
  totalProducts: number;
  outOfStock: number;
  critical: number;
  low: number;
  healthy: number;
  unconfiguredReorderPoints: number;
};

export type DashboardStockHealth =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'LOW'
  | 'HEALTHY'
  | 'UNCONFIGURED';

export type DashboardLowStockProduct = {
  productId: string;
  sku: string;
  name: string;
  unitType: string;
  currentQuantity: number;
  reorderPoint: number | null;
  stockHealth: DashboardStockHealth;
  recommendedReorderQuantity: number | null;
};

export type DashboardUpcomingDelivery = {
  id: string;
  poNumber: string;
  supplier: {
    id: string;
    name: string;
  };
  status: 'ORDERED' | 'PARTIALLY_RECEIVED';
  subtotalCents: number;
  expectedDeliveryDate: string;
  itemCount: number;
};

export type DashboardProcurement = {
  openPurchaseOrders: number;
  draftPurchaseOrders: number;
  partiallyReceived: number;
  openPurchaseOrderValueCents: number;
  upcomingDeliveries: DashboardUpcomingDelivery[];
};

export type DashboardRecentActivity = {
  id: string;
  createdAt: string;
  actorDisplay: string;
  operation: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
};

export type DashboardPredictiveRisk =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'AT_RISK'
  | 'STABLE'
  | 'NO_DEMAND'
  | 'NO_FORECAST';

export type DashboardPredictiveAttentionProduct = {
  productId: string;
  sku: string;
  name: string;
  currentQuantity: number;
  risk: DashboardPredictiveRisk;
  averageDailyDemand: number | null;
  daysOfStockRemaining: number | null;
  estimatedStockoutDate: string | null;
  predictiveReorderQuantity: number | null;
  horizonDays: number | null;
  historyDaysUsed: number | null;
  isLimitedHistory: boolean | null;
};

export type DashboardPredictive = {
  activeProducts: number;
  outOfStock: number;
  critical: number;
  atRisk: number;
  stable: number;
  noDemand: number;
  forecastRequired: number;
  limitedHistory: number;
  totalPredictiveReorderQuantity: number;
  attentionProducts: DashboardPredictiveAttentionProduct[];
};

export type AdminDashboardResponse = {
  sales: DashboardSales;
  salesTrend: DashboardSalesTrendPoint[];
  inventory: DashboardInventory;
  lowStockProducts: DashboardLowStockProduct[];
  predictive: DashboardPredictive;
  procurement: DashboardProcurement;
  recentActivity: DashboardRecentActivity[];
};
