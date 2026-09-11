import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ClipboardList,
  PackageCheck,
  PackageX,
  PhilippinePeso,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { BentoCard } from '../../../components/layout/BentoCard';
import { BentoGrid } from '../../../components/layout/BentoGrid';
import { MetricCard } from '../../../components/layout/MetricCard';
import { Alert, Badge, Button, EmptyState, Spinner } from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type {
  AdminDashboardResponse,
  DashboardLowStockProduct,
  DashboardPredictiveRisk,
  DashboardRecentActivity,
  DashboardStockHealth,
  DashboardUpcomingDelivery,
} from '../../../types/dashboard';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import SalesTrendChart from './SalesTrendChart';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type KpiCard = {
  label: string;
  value: string;
  helper: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  icon: ReactNode;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const moneyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});
const numberFormatter = new Intl.NumberFormat('en-PH');
const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Manila',
});
const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

const stockHealthLabels: Record<DashboardStockHealth, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  LOW: 'Low',
  HEALTHY: 'Healthy',
  UNCONFIGURED: 'Not Configured',
};

const stockHealthVariants: Record<
  DashboardStockHealth,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  OUT_OF_STOCK: 'danger',
  CRITICAL: 'danger',
  LOW: 'warning',
  HEALTHY: 'success',
  UNCONFIGURED: 'neutral',
};

const predictiveRiskLabels: Record<DashboardPredictiveRisk, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  AT_RISK: 'At Risk',
  STABLE: 'Stable',
  NO_DEMAND: 'No Demand Detected',
  NO_FORECAST: 'Forecast Required',
};

const predictiveRiskVariants: Record<
  DashboardPredictiveRisk,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  OUT_OF_STOCK: 'danger',
  CRITICAL: 'danger',
  AT_RISK: 'warning',
  STABLE: 'success',
  NO_DEMAND: 'neutral',
  NO_FORECAST: 'info',
};

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readDashboardError(response: Response) {
  if (response.status === 403) return 'You do not have permission to view dashboard data.';
  if (response.status === 401) return 'Your session has expired. Please sign in again.';
  return 'Unable to load dashboard data.';
}

function money(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function count(value: number) {
  return numberFormatter.format(value);
}

function formatQuantity(value: number) {
  return Number.isInteger(value)
    ? count(value)
    : value.toLocaleString('en-PH', { maximumFractionDigits: 2 });
}

function formatDecimal(value: number | null, suffix = '') {
  if (value === null) return '-';
  return `${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}${suffix}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateTimeFormatter.format(date);
}

function humanizeEnum(value: string | null | undefined) {
  if (!value) return '-';
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function unitLabel(value: string) {
  return humanizeEnum(value);
}

function reorderLabel(product: DashboardLowStockProduct) {
  if (product.recommendedReorderQuantity === null) return 'Not Configured';
  if (product.recommendedReorderQuantity === 0) return 'No reorder needed';
  return `${formatQuantity(product.recommendedReorderQuantity)} ${unitLabel(product.unitType)}`;
}

function entityLabel(activity: DashboardRecentActivity) {
  return activity.entityLabel || humanizeEnum(activity.entityType);
}

function LoadingState({ refreshing }: { refreshing: boolean }) {
  return (
    <section className="real-dashboard-loading" role="status" aria-live="polite">
      <Spinner size="md" label={refreshing ? 'Refreshing dashboard data' : 'Loading dashboard data'} />
      <span>{refreshing ? 'Refreshing dashboard data...' : 'Loading dashboard data...'}</span>
    </section>
  );
}

function StockHealthSummary({
  inventory,
}: {
  inventory: AdminDashboardResponse['inventory'];
}) {
  const items: Array<{ label: string; value: number; variant: 'neutral' | 'success' | 'warning' | 'danger' }> = [
    { label: 'Out of Stock', value: inventory.outOfStock, variant: 'danger' },
    { label: 'Critical', value: inventory.critical, variant: 'danger' },
    { label: 'Low', value: inventory.low, variant: 'warning' },
    { label: 'Healthy', value: inventory.healthy, variant: 'success' },
    { label: 'Not Configured', value: inventory.unconfiguredReorderPoints, variant: 'neutral' },
  ];

  return (
    <div className="real-dashboard-stock-summary" aria-label="Stock health summary">
      {items.map((item) => (
        <span key={item.label}>
          <Badge variant={item.variant}>{count(item.value)}</Badge>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function LowStockTable({ products }: { products: DashboardLowStockProduct[] }) {
  if (!products.length) {
    return <EmptyState title="No inventory items currently require attention." />;
  }

  return (
    <div className="real-dashboard-table-wrap">
      <table className="real-dashboard-table">
        <thead>
          <tr>
            <th scope="col">SKU</th>
            <th scope="col">Product</th>
            <th scope="col">Current Stock</th>
            <th scope="col">Reorder Point</th>
            <th scope="col">Status</th>
            <th scope="col">Static Reorder</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.productId}>
              <td><span className="real-dashboard-mono">{product.sku}</span></td>
              <td><strong>{product.name}</strong></td>
              <td>{formatQuantity(product.currentQuantity)} {unitLabel(product.unitType)}</td>
              <td>{product.reorderPoint === null ? 'Not Configured' : count(product.reorderPoint)}</td>
              <td>
                <Badge variant={stockHealthVariants[product.stockHealth]}>
                  {stockHealthLabels[product.stockHealth]}
                </Badge>
              </td>
              <td>{reorderLabel(product)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PredictiveSummary({
  predictive,
}: {
  predictive: AdminDashboardResponse['predictive'];
}) {
  const primaryItems = [
    { label: 'Critical', value: predictive.critical, variant: 'danger' as const },
    { label: 'At Risk', value: predictive.atRisk, variant: 'warning' as const },
    { label: 'Stable', value: predictive.stable, variant: 'success' as const },
    { label: 'Forecast Required', value: predictive.forecastRequired, variant: 'info' as const },
  ];
  const secondaryItems = [
    { label: 'Out of Stock', value: predictive.outOfStock, variant: 'danger' as const },
    { label: 'No Demand', value: predictive.noDemand, variant: 'neutral' as const },
    { label: 'Limited History', value: predictive.limitedHistory, variant: 'neutral' as const },
  ];

  return (
    <div className="real-dashboard-predictive-summary" aria-label="Predictive inventory risk summary">
      <div className="real-dashboard-predictive-counts">
        {primaryItems.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{count(item.value)}</strong>
            <Badge variant={item.variant}>{item.label}</Badge>
          </article>
        ))}
      </div>
      <div className="real-dashboard-predictive-support">
        <article>
          <span>Suggested Reorder Units</span>
          <strong>{count(predictive.totalPredictiveReorderQuantity)}</strong>
          <p>Total forecast-assisted recommendation across latest product forecasts.</p>
        </article>
        <div className="real-dashboard-predictive-badges">
          {secondaryItems.map((item) => (
            <span key={item.label}>
              <Badge variant={item.variant}>{count(item.value)}</Badge>
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function predictiveEmptyTitle(predictive: AdminDashboardResponse['predictive']) {
  if (predictive.activeProducts === 0) {
    return 'No active products are available for predictive analysis.';
  }

  if (predictive.forecastRequired === predictive.activeProducts) {
    return 'Generate moving-average forecasts to view forecast-assisted inventory risk.';
  }

  if (predictive.noDemand > 0 && predictive.noDemand + predictive.stable === predictive.activeProducts) {
    return 'No forecasted demand currently requires predictive attention.';
  }

  return 'No forecasted products currently require predictive attention.';
}

function PredictiveAttentionTable({
  predictive,
}: {
  predictive: AdminDashboardResponse['predictive'];
}) {
  if (!predictive.attentionProducts.length) {
    return <EmptyState title={predictiveEmptyTitle(predictive)} />;
  }

  return (
    <div className="real-dashboard-table-wrap">
      <table className="real-dashboard-table real-dashboard-table--predictive">
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Current Stock</th>
            <th scope="col">Forecast Risk</th>
            <th scope="col">Avg. Daily Demand</th>
            <th scope="col">Days Remaining</th>
            <th scope="col">Estimated Stock-Out</th>
            <th scope="col">Predictive Reorder</th>
          </tr>
        </thead>
        <tbody>
          {predictive.attentionProducts.map((product) => (
            <tr key={product.productId}>
              <td>
                <strong>{product.name}</strong>
                <span className="real-dashboard-table-subtext real-dashboard-mono">{product.sku}</span>
              </td>
              <td>{count(product.currentQuantity)}</td>
              <td>
                <div className="real-dashboard-risk-cell">
                  <Badge variant={predictiveRiskVariants[product.risk]}>
                    {predictiveRiskLabels[product.risk]}
                  </Badge>
                  {product.isLimitedHistory ? (
                    <Badge variant="neutral">Limited History</Badge>
                  ) : null}
                </div>
              </td>
              <td>{formatDecimal(product.averageDailyDemand)}</td>
              <td>{formatDecimal(product.daysOfStockRemaining, ' days')}</td>
              <td>{product.estimatedStockoutDate ? formatDate(product.estimatedStockoutDate) : '-'}</td>
              <td>
                {product.predictiveReorderQuantity === null
                  ? '-'
                  : count(product.predictiveReorderQuantity)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliveryTable({ deliveries }: { deliveries: DashboardUpcomingDelivery[] }) {
  if (!deliveries.length) {
    return <EmptyState title="No upcoming purchase order deliveries in the next 7 days." />;
  }

  return (
    <div className="real-dashboard-table-wrap">
      <table className="real-dashboard-table">
        <thead>
          <tr>
            <th scope="col">PO Number</th>
            <th scope="col">Supplier</th>
            <th scope="col">Status</th>
            <th scope="col">Expected Delivery</th>
            <th scope="col">Items</th>
            <th scope="col">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((delivery) => (
            <tr key={delivery.id}>
              <td><span className="real-dashboard-mono">{delivery.poNumber}</span></td>
              <td>{delivery.supplier.name}</td>
              <td><Badge variant="info">{humanizeEnum(delivery.status)}</Badge></td>
              <td>{formatDate(delivery.expectedDeliveryDate)}</td>
              <td>{count(delivery.itemCount)}</td>
              <td>{money(delivery.subtotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActivityList({ activities }: { activities: DashboardRecentActivity[] }) {
  if (!activities.length) {
    return <EmptyState title="No recent system activity has been recorded yet." />;
  }

  return (
    <ul className="real-dashboard-activity-list">
      {activities.map((activity) => (
        <li key={activity.id} className="real-dashboard-activity-item">
          <div>
            <div className="real-dashboard-activity-title">
              <Badge variant="neutral">{humanizeEnum(activity.entityType)}</Badge>
              <strong>{humanizeEnum(activity.operation || activity.action)}</strong>
            </div>
            <p>
              {entityLabel(activity)} by {activity.actorDisplay}
            </p>
          </div>
          <time dateTime={activity.createdAt}>{formatDateTime(activity.createdAt)}</time>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const initialLoadStarted = useRef(false);

  const loadDashboardData = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh' && data) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/dashboard/admin`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(await readDashboardError(response));
      }
      setData((await response.json()) as AdminDashboardResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    if (initialLoadStarted.current) return;

    initialLoadStarted.current = true;
    void loadDashboardData();
  }, [loadDashboardData]);

  const kpis = useMemo<KpiCard[]>(() => {
    if (!data) return [];

    return [
      {
        label: 'Transactions Today',
        value: count(data.sales.todayTransactions),
        helper: `Average ${money(data.sales.averageTransactionCents)} per transaction`,
        tone: 'default',
        icon: <ReceiptText />,
      },
      {
        label: 'Units Sold Today',
        value: formatQuantity(data.sales.unitsSoldToday),
        helper: 'Completed sale quantity',
        tone: 'default',
        icon: <PackageCheck />,
      },
      {
        label: 'Low / Critical Stock',
        value: count(data.inventory.low + data.inventory.critical),
        helper: `Critical: ${count(data.inventory.critical)} / Low: ${count(data.inventory.low)}`,
        tone: data.inventory.low + data.inventory.critical > 0 ? 'warning' : 'success',
        icon: <TriangleAlert />,
      },
      {
        label: 'Out of Stock',
        value: count(data.inventory.outOfStock),
        helper: data.inventory.outOfStock > 0 ? 'Requires attention' : 'No items out of stock',
        tone: data.inventory.outOfStock > 0 ? 'danger' : 'success',
        icon: <PackageX />,
      },
      {
        label: 'Open Purchase Orders',
        value: count(data.procurement.openPurchaseOrders),
        helper: `Open PO value ${money(data.procurement.openPurchaseOrderValueCents)}`,
        tone: 'default',
        icon: <ClipboardList />,
      },
      {
        label: 'Average Transaction',
        value: money(data.sales.averageTransactionCents),
        helper: 'Average completed sale value',
        tone: 'default',
        icon: <PhilippinePeso />,
      },
    ];
  }, [data]);

  const showInitialLoading = loading && !data;
  const showDashboard = Boolean(data) && !showInitialLoading;

  return (
    <AppShell
      activePage="Dashboard"
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--dashboard"
    >
      <section className="real-dashboard" aria-label="Dashboard workspace">
        <PageHeader
          eyebrow="Operations"
          title="Dashboard"
          description="Operational overview for King of Clouds Vape Shop."
          secondaryActions={
            <Button
              variant="secondary"
              onClick={() => void loadDashboardData('refresh')}
              iconStart={<RefreshCw />}
              disabled={showInitialLoading || refreshing}
              loading={refreshing}
            >
              Refresh
            </Button>
          }
        />

        {showInitialLoading ? <LoadingState refreshing={false} /> : null}
        {refreshing ? <LoadingState refreshing /> : null}

        {error && !showInitialLoading ? (
          <div className="real-dashboard-error">
            <Alert variant="error" title="Unable to load dashboard data.">
              {error}
            </Alert>
            <Button variant="secondary" onClick={() => void loadDashboardData(data ? 'refresh' : 'initial')}>
              Retry
            </Button>
          </div>
        ) : null}

        {showDashboard && data ? (
          <>
            <BentoGrid className="real-dashboard-bento" gap="standard" dense aria-label="Admin dashboard overview">

              <BentoCard
                className="real-dashboard-primary-sales bento-span-6"
                padding="standard"
                eyebrow="Today's Sales"
                title={money(data.sales.todayRevenueCents)}
                description={`${count(data.sales.todayTransactions)} transactions today`}
              >
                <div className="real-dashboard-primary-sales__meta">
                  <span>
                    <PackageCheck aria-hidden="true" />
                    {formatQuantity(data.sales.unitsSoldToday)} units sold
                  </span>
                  <span>
                    <PhilippinePeso aria-hidden="true" />
                    {money(data.sales.averageTransactionCents)} average transaction
                  </span>
                </div>
              </BentoCard>

              {kpis.map((metric) => (
                <MetricCard
                  key={metric.label}
                  className="real-dashboard-kpi bento-span-3"
                  label={metric.label}
                  value={metric.value}
                  helper={metric.helper}
                  tone={metric.tone}
                  icon={metric.icon}
                />
              ))}

              <BentoCard
                className="real-dashboard-sales bento-span-8"
                padding="analytical"
                variant="analytical"
                eyebrow="Sales performance"
                title="Sales Trend"
                description="Completed sales over the last 7 days."
              >
                <div className="real-dashboard-sales-grid">
                  <SalesTrendChart points={data.salesTrend} />
                  <div className="real-dashboard-secondary-metrics" aria-label="Secondary sales metrics">
                    <article>
                      <span>Rolling 7-Day Sales</span>
                      <strong>{money(data.sales.weekRevenueCents)}</strong>
                    </article>
                    <article>
                      <span>Current Month Sales</span>
                      <strong>{money(data.sales.monthRevenueCents)}</strong>
                    </article>
                    <article>
                      <span>Units Sold Today</span>
                      <strong>{formatQuantity(data.sales.unitsSoldToday)}</strong>
                    </article>
                    <article>
                      <span>Average Transaction</span>
                      <strong>{money(data.sales.averageTransactionCents)}</strong>
                    </article>
                  </div>
                </div>
              </BentoCard>

              <BentoCard
                className="real-dashboard-inventory bento-span-7"
                padding="standard"
                eyebrow="Inventory attention"
                title="Inventory Attention"
                description="Products requiring stock review."
                action={onNavigate ? (
                  <Button variant="secondary" onClick={() => onNavigate('Inventory')}>
                    View Inventory
                  </Button>
                ) : null}
              >
                <StockHealthSummary inventory={data.inventory} />
                <LowStockTable products={data.lowStockProducts} />
              </BentoCard>

              <BentoCard
                className="real-dashboard-procurement bento-span-5"
                padding="standard"
                eyebrow="Procurement"
                title="Procurement"
                description="Open purchase orders and upcoming receiving."
                action={onNavigate ? (
                  <Button variant="secondary" onClick={() => onNavigate('Purchase Orders')}>
                    View Purchase Orders
                  </Button>
                ) : null}
              >
                <div className="real-dashboard-procurement-summary" aria-label="Procurement summary">
                  <article>
                    <span>Open Purchase Orders</span>
                    <strong>{count(data.procurement.openPurchaseOrders)}</strong>
                  </article>
                  <article>
                    <span>Draft Purchase Orders</span>
                    <strong>{count(data.procurement.draftPurchaseOrders)}</strong>
                  </article>
                  <article>
                    <span>Partially Received</span>
                    <strong>{count(data.procurement.partiallyReceived)}</strong>
                  </article>
                  <article title="Full subtotal value of ordered and partially received purchase orders.">
                    <span>Open PO Value</span>
                    <strong>{money(data.procurement.openPurchaseOrderValueCents)}</strong>
                  </article>
                </div>
                <DeliveryTable deliveries={data.procurement.upcomingDeliveries} />
              </BentoCard>

              <BentoCard
                className="real-dashboard-activity bento-span-6"
                padding="standard"
                eyebrow="Recent activity"
                title="System Activity"
                description="Latest audit-derived operational changes."
                action={onNavigate ? (
                  <Button variant="secondary" onClick={() => onNavigate('Audit Logs')}>
                    View Audit Logs
                  </Button>
                ) : null}
              >
                <ActivityList activities={data.recentActivity} />
              </BentoCard>

              <BentoCard
                className="real-dashboard-predictive bento-span-6"
                padding="standard"
                eyebrow="Predictive inventory risk"
                title="Predictive Inventory Risk"
                description="Products at risk based on forecasted demand."
                action={onNavigate && data.predictive.forecastRequired > 0 ? (
                  <Button variant="secondary" onClick={() => onNavigate('Forecasting')}>
                    Open Predictive Analysis
                  </Button>
                ) : null}
              >
                <PredictiveSummary predictive={data.predictive} />
                <PredictiveAttentionTable predictive={data.predictive} />
              </BentoCard>

              {onNavigate ? (
                <BentoCard
                  className="real-dashboard-quick-nav bento-span-full"
                  padding="compact"
                  eyebrow="Actions"
                  title="Operational Shortcuts"
                >
                  <div className="real-dashboard-quick-nav-actions">
                    <Button variant="secondary" iconStart={<ReceiptText />} onClick={() => onNavigate('POS')}>
                      Open POS
                    </Button>
                    <Button variant="secondary" iconStart={<TriangleAlert />} onClick={() => onNavigate('Inventory')}>
                      View Inventory
                    </Button>
                    <Button variant="secondary" iconStart={<ClipboardList />} onClick={() => onNavigate('Purchase Orders')}>
                      Purchase Orders
                    </Button>
                    <Button variant="secondary" iconStart={<TrendingUp />} onClick={() => onNavigate('Forecasting')}>
                      Predictive Analysis
                    </Button>
                  </div>
                </BentoCard>
              ) : null}
            </BentoGrid>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
