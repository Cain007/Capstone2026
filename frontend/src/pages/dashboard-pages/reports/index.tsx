import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import InventoryHealthChart from './InventoryHealthChart';
import ReportSalesTrendChart from './ReportSalesTrendChart';
import TopProductsChart from './TopProductsChart';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type StockHealth = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY' | 'UNCONFIGURED';
type ForecastRisk =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'AT_RISK'
  | 'STABLE'
  | 'NO_DEMAND'
  | 'NO_FORECAST';

type ReportSummary = {
  period: { from: string; to: string; timezone: 'Asia/Manila' };
  sales: {
    revenueCents: number;
    transactions: number;
    unitsSold: number;
    averageTransactionCents: number;
    discountsCents: number;
    taxCents: number;
  };
  salesTrend: Array<{
    date: string;
    revenueCents: number;
    transactions: number;
    unitsSold: number;
  }>;
  topProducts: Array<{
    productId: string;
    sku: string;
    name: string;
    quantitySold: number;
    revenueCents: number;
  }>;
  inventory: {
    totalProducts: number;
    outOfStock: number;
    critical: number;
    low: number;
    healthy: number;
    unconfigured: number;
  };
  inventoryAttention: Array<{
    productId: string;
    sku: string;
    name: string;
    currentQuantity: number;
    reorderPoint: number | null;
    stockHealth: StockHealth;
    recommendedReorderQuantity: number | null;
  }>;
  forecast: {
    activeProducts: number;
    productsWithForecast: number;
    forecastRequired: number;
    critical: number;
    atRisk: number;
    stable: number;
    noDemand: number;
    limitedHistory: number;
    totalPredictiveReorderQuantity: number;
  };
  forecastAttention: Array<{
    productId: string;
    sku: string;
    name: string;
    risk: ForecastRisk;
    averageDailyDemand: number | null;
    daysOfStockRemaining: number | null;
    estimatedStockoutDate: string | null;
    predictiveReorderQuantity: number | null;
    historyDaysUsed: number | null;
    isLimitedHistory: boolean | null;
  }>;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const moneyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const numberFormatter = new Intl.NumberFormat('en-PH');
const fullDateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeZone: 'Asia/Manila',
});
const stockHealthLabels: Record<StockHealth, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  LOW: 'Low',
  HEALTHY: 'Healthy',
  UNCONFIGURED: 'Not Configured',
};
const stockHealthVariants: Record<StockHealth, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  OUT_OF_STOCK: 'danger',
  CRITICAL: 'danger',
  LOW: 'warning',
  HEALTHY: 'success',
  UNCONFIGURED: 'neutral',
};
const riskLabels: Record<ForecastRisk, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  AT_RISK: 'At Risk',
  STABLE: 'Stable',
  NO_DEMAND: 'No Demand Detected',
  NO_FORECAST: 'Forecast Required',
};
const riskVariants: Record<ForecastRisk, 'neutral' | 'success' | 'warning' | 'danger' | 'info'> = {
  OUT_OF_STOCK: 'danger',
  CRITICAL: 'danger',
  AT_RISK: 'warning',
  STABLE: 'success',
  NO_DEMAND: 'neutral',
  NO_FORECAST: 'info',
};
type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function manilaDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function defaultRange() {
  const today = manilaDateKey();
  return { from: addDays(today, -29), to: today };
}

function money(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function count(value: number) {
  return numberFormatter.format(value);
}

function quantity(value: number | null, suffix = '') {
  if (value === null) return '-';
  return `${value.toLocaleString('en-PH', { maximumFractionDigits: 2 })}${suffix}`;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : fullDateFormatter.format(date);
}

async function readReportError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 400) return data.message || 'Invalid report date range.';
    if (response.status === 403) return 'You do not have permission to view reports.';
    if (response.status === 401) return 'Your session has expired. Please sign in again.';
    return data.message || 'Unable to load report.';
  } catch {
    return 'Unable to load report.';
  }
}

export default function ReportsPage({
  userEmail,
  userRole,
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const [from, setFrom] = useState(() => defaultRange().from);
  const [to, setTo] = useState(() => defaultRange().to);
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const initialLoadStarted = useRef(false);
  const inventorySummaryItems: Array<{ label: string; value: number; variant: BadgeVariant }> = report
    ? [
        { label: 'Out of Stock', value: report.inventory.outOfStock, variant: 'danger' },
        { label: 'Critical', value: report.inventory.critical, variant: 'danger' },
        { label: 'Low', value: report.inventory.low, variant: 'warning' },
        { label: 'Healthy', value: report.inventory.healthy, variant: 'success' },
        { label: 'Not Configured', value: report.inventory.unconfigured, variant: 'neutral' },
      ]
    : [];

  async function loadReport(mode: 'initial' | 'refresh' = 'refresh') {
    if (mode === 'initial' || !report) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const query = new URLSearchParams({ from, to });
      const response = await fetch(`${API_URL}/api/reports/summary?${query}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readReportError(response));

      setReport((await response.json()) as ReportSummary);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    void loadReport('initial');
  });

  function submitReport(event: FormEvent) {
    event.preventDefault();
    void loadReport('refresh');
  }

  function resetRange() {
    const range = defaultRange();
    setFrom(range.from);
    setTo(range.to);
  }

  return (
    <AppShell
      activePage="Reports"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--reports"
    >
      <section className="reports-page" aria-label="Reports workspace">
        <header className="reports-header">
          <div>
            <p className="reports-eyebrow">Business reporting</p>
            <h1>Reports</h1>
            <p>Review sales performance, current inventory status, and predictive inventory insights.</p>
          </div>
        </header>

        <Card padding="default" className="reports-filter-card">
          <form className="reports-filters" onSubmit={submitReport}>
            <Input label="From Date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} required />
            <Input label="To Date" type="date" value={to} onChange={(event) => setTo(event.target.value)} required />
            <div className="reports-filter-actions">
              <Button type="submit" loading={refreshing}>
                {refreshing ? 'Generating...' : 'Generate Report'}
              </Button>
              <Button type="button" variant="secondary" onClick={resetRange} disabled={refreshing}>
                Reset to Last 30 Days
              </Button>
            </div>
          </form>
        </Card>

        {loading ? (
          <section className="reports-state" role="status" aria-live="polite">
            <Spinner size="md" label="Loading reports" />
            <span>Loading report...</span>
          </section>
        ) : null}

        {error && !loading ? (
          <div className="reports-state">
            <Alert variant="error" title="Unable to load report">{error}</Alert>
            <Button variant="secondary" onClick={() => void loadReport('refresh')}>Retry</Button>
          </div>
        ) : null}

        {report && !loading ? (
          <>
            <section className="reports-period" aria-label="Report period">
              <span>Sales Report Period</span>
              <strong>{formatDate(report.period.from)} to {formatDate(report.period.to)}</strong>
              <small>{report.period.timezone}</small>
            </section>

            <Card padding="default" className="reports-section">
              <div className="reports-section-head">
                <div>
                  <p className="reports-eyebrow">Sales report</p>
                  <h2>Completed Sales</h2>
                </div>
              </div>
              <div className="reports-summary-grid reports-summary-grid--sales">
                {[
                  ['Total Sales', money(report.sales.revenueCents)],
                  ['Transactions', count(report.sales.transactions)],
                  ['Units Sold', quantity(report.sales.unitsSold)],
                  ['Average Transaction', money(report.sales.averageTransactionCents)],
                  ['Discounts', money(report.sales.discountsCents)],
                  ['Tax', money(report.sales.taxCents)],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </article>
                ))}
              </div>
              <ReportSalesTrendChart points={report.salesTrend} />

              <div className="reports-table-block">
                <h3>Top Products</h3>
                {!report.topProducts.length ? (
                  <EmptyState title="No completed sales were recorded in this period." />
                ) : (
                  <>
                    <TopProductsChart products={report.topProducts} />
                    <div className="reports-table-wrap">
                      <table className="reports-table">
                        <thead>
                          <tr>
                            <th>Rank</th>
                            <th>Product</th>
                            <th>SKU</th>
                            <th>Quantity Sold</th>
                            <th>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.topProducts.map((product, index) => (
                            <tr key={product.productId}>
                              <td>{index + 1}</td>
                              <td><strong>{product.name}</strong></td>
                              <td>{product.sku}</td>
                              <td>{quantity(product.quantitySold)}</td>
                              <td>{money(product.revenueCents)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card padding="default" className="reports-section">
              <div className="reports-section-head">
                <div>
                  <p className="reports-eyebrow">Inventory report</p>
                  <h2>Current Inventory Snapshot</h2>
                  <span>Inventory values reflect the current stock balance, not historical stock as of the selected report dates.</span>
                </div>
              </div>
              <div className="reports-summary-grid">
                {inventorySummaryItems.map(({ label, value, variant }) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{count(value)}</strong>
                    <Badge variant={variant}>{label}</Badge>
                  </article>
                ))}
              </div>
              <InventoryHealthChart inventory={report.inventory} />
              {!report.inventoryAttention.length ? (
                <EmptyState title="No current inventory items require attention." />
              ) : (
                <div className="reports-table-wrap">
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Product</th>
                        <th>Current Stock</th>
                        <th>Reorder Point</th>
                        <th>Status</th>
                        <th>Static Reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.inventoryAttention.map((product) => (
                        <tr key={product.productId}>
                          <td>{product.sku}</td>
                          <td><strong>{product.name}</strong></td>
                          <td>{count(product.currentQuantity)}</td>
                          <td>{product.reorderPoint === null ? '-' : count(product.reorderPoint)}</td>
                          <td>
                            <Badge variant={stockHealthVariants[product.stockHealth]}>
                              {stockHealthLabels[product.stockHealth]}
                            </Badge>
                          </td>
                          <td>{product.recommendedReorderQuantity === null ? '-' : count(product.recommendedReorderQuantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card padding="default" className="reports-section">
              <div className="reports-section-head">
                <div>
                  <p className="reports-eyebrow">Predictive report</p>
                  <h2>Predictive Inventory Summary</h2>
                  <span>Forecast-assisted future risk based on latest persisted moving-average forecasts, not the selected sales period.</span>
                </div>
              </div>
              <div className="reports-summary-grid reports-summary-grid--forecast">
                {[
                  ['Products with Forecast', report.forecast.productsWithForecast],
                  ['Forecast Required', report.forecast.forecastRequired],
                  ['Critical', report.forecast.critical],
                  ['At Risk', report.forecast.atRisk],
                  ['Stable', report.forecast.stable],
                  ['Limited History', report.forecast.limitedHistory],
                  ['Suggested Reorder Units', report.forecast.totalPredictiveReorderQuantity],
                ].map(([label, value]) => (
                  <article key={label}>
                    <span>{label}</span>
                    <strong>{count(value as number)}</strong>
                  </article>
                ))}
              </div>
              {!report.forecastAttention.length ? (
                <EmptyState
                  title={
                    report.forecast.activeProducts === 0
                      ? 'No active products are available for predictive reporting.'
                      : 'No forecasted products currently require predictive attention.'
                  }
                />
              ) : (
                <div className="reports-table-wrap">
                  <table className="reports-table reports-table--forecast">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Risk</th>
                        <th>Average Daily Demand</th>
                        <th>Days Remaining</th>
                        <th>Estimated Stock-Out</th>
                        <th>Predictive Reorder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.forecastAttention.map((product) => (
                        <tr key={product.productId}>
                          <td>
                            <strong>{product.name}</strong>
                            <span>{product.sku}</span>
                          </td>
                          <td>
                            <div className="reports-badge-stack">
                              <Badge variant={riskVariants[product.risk]}>{riskLabels[product.risk]}</Badge>
                              {product.isLimitedHistory ? <Badge variant="neutral">Limited History</Badge> : null}
                            </div>
                          </td>
                          <td>{quantity(product.averageDailyDemand)}</td>
                          <td>{quantity(product.daysOfStockRemaining, ' days')}</td>
                          <td>{formatDate(product.estimatedStockoutDate)}</td>
                          <td>{product.predictiveReorderQuantity === null ? '-' : count(product.predictiveReorderQuantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
