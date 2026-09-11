import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarRange, CircleHelp, Info, PackageSearch, RefreshCw, TriangleAlert } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { BentoCard } from '../../../components/layout/BentoCard';
import { BentoGrid } from '../../../components/layout/BentoGrid';
import { MetricCard } from '../../../components/layout/MetricCard';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Select,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { Product } from '../../../types/product';
import type { PurchaseOrderPrefill } from '../../../types/purchase-order';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import type { HelpTopicId } from '../help/guide';
import ForecastChart from './ForecastChart';
import ForecastEvaluationChart from './ForecastEvaluationChart';
import './styles.css';

type DashboardPageProps = {
  onOpenHelp?: (topic: HelpTopicId) => void;
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  onCreatePurchaseOrderFromPrefill?: (prefill: PurchaseOrderPrefill) => void;
};

type ForecastProduct = {
  id: string;
  sku: string;
  name: string;
};

type ForecastPoint = {
  date: string;
  predictedQuantity: number;
};

type Forecast = {
  runId: string;
  product: ForecastProduct | null;
  method: 'MOVING_AVERAGE';
  granularity: 'DAILY';
  windowDays?: number;
  horizonDays?: number;
  historyDaysUsed?: number;
  isLimitedHistory?: boolean;
  averageDailyDemand?: number;
  sourceStartDate: string;
  sourceEndDate: string;
  horizonStartDate: string;
  horizonEndDate: string;
  status: string;
  version: number;
  generatedAt: string;
  points: ForecastPoint[];
};

type ForecastResponse = {
  forecast: Forecast;
};

type ForecastNoHistoryResponse = {
  forecastStatus: 'NO_HISTORY';
  message: string;
  product: ForecastProduct;
};

type StockHealth = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY' | 'UNCONFIGURED';
type ForecastRisk =
  | 'OUT_OF_STOCK'
  | 'CRITICAL'
  | 'AT_RISK'
  | 'STABLE'
  | 'NO_DEMAND'
  | 'NO_FORECAST';

type ForecastInsight = {
  product: ForecastProduct;
  inventory: {
    currentQuantity: number;
    reorderPoint: number | null;
    stockHealth: StockHealth;
    staticRecommendedReorderQuantity: number | null;
  };
  forecast: {
    runId: string;
    method: 'MOVING_AVERAGE';
    windowDays: number | null;
    horizonDays: number;
    historyDaysUsed: number | null;
    isLimitedHistory: boolean | null;
    averageDailyDemand: number;
  } | null;
  predictive: {
    daysOfStockRemaining: number | null;
    estimatedStockoutDate: string | null;
    forecastDemandForHorizon: number | null;
    predictiveReorderQuantity: number | null;
    risk: ForecastRisk;
  };
};

type ForecastInsightResponse = {
  insight: ForecastInsight;
};

type ForecastBiasDirection = 'OVER_FORECAST' | 'UNDER_FORECAST' | 'BALANCED';

type ForecastEvaluationPoint = {
  date: string;
  predictedQuantity: number;
  actualQuantity: number;
  error: number;
  absoluteError: number;
};

type ForecastEvaluation = {
  status: 'READY' | 'NOT_READY';
  product: ForecastProduct;
  forecastRun: {
    id: string;
    generatedAt: string;
    windowDays: number | null;
    horizonDays: number;
    historyDaysUsed: number | null;
    isLimitedHistory: boolean | null;
  };
  evaluatedPeriods: number;
  totalForecastPeriods: number;
  coveragePercent: number;
  metrics: {
    totalPredicted: number;
    totalActual: number;
    mae: number;
    wapePercent: number | null;
    meanError: number;
    biasDirection: ForecastBiasDirection;
  } | null;
  points: ForecastEvaluationPoint[];
};

type ForecastEvaluationResponse = ForecastEvaluation;

type ApiMessage = {
  message?: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const dayOptions = [7, 14, 30] as const;
const stockHealthLabels: Record<StockHealth, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  LOW: 'Low',
  HEALTHY: 'Healthy',
  UNCONFIGURED: 'Not Configured',
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
  NO_DEMAND: 'info',
  NO_FORECAST: 'neutral',
};
const biasLabels: Record<ForecastBiasDirection, string> = {
  OVER_FORECAST: 'Over Forecast',
  UNDER_FORECAST: 'Under Forecast',
  BALANCED: 'Balanced',
};
const biasVariants: Record<ForecastBiasDirection, 'neutral' | 'success' | 'warning'> = {
  OVER_FORECAST: 'warning',
  UNDER_FORECAST: 'warning',
  BALANCED: 'success',
};

function authHeaders(json = false): Record<string, string> {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as ApiMessage;
    if (response.status === 400) return data.message || 'Invalid forecast configuration.';
    if (response.status === 403) return 'You do not have permission to access forecasting.';
    if (response.status === 409) {
      return data.message || 'Forecasts can only be generated for active products.';
    }
    if (response.status >= 500) return fallback;
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatQuantity(value: number | undefined, suffix = ' units') {
  if (value === undefined) return '-';
  if (value === 0) return `0${suffix}`;
  return `${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function formatNullableQuantity(value: number | null, suffix = ' units') {
  return value === null ? '-' : formatQuantity(value, suffix);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '-';
  if (value === 0) return '0%';
  return `${value.toLocaleString('en-PH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })}%`;
}

function formatWape(value: number | null | undefined) {
  return value === null || value === undefined ? 'Not available' : formatPercent(value);
}

function formatSignedQuantity(value: number, suffix = ' units') {
  if (value === 0) return `0${suffix}`;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function formatDaysRemaining(value: number | null) {
  if (value === null) return '-';
  if (value === 0) return '0 days';
  return `${value.toLocaleString('en-PH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  })} days`;
}

function formatStockoutDate(value: string | null) {
  return value === null ? 'Not projected' : formatDate(value);
}

function methodLabel(method: Forecast['method']) {
  return method === 'MOVING_AVERAGE' ? 'Moving Average' : method;
}

function metricToneForRisk(risk: ForecastRisk): 'default' | 'success' | 'warning' | 'danger' {
  if (risk === 'OUT_OF_STOCK' || risk === 'CRITICAL') return 'danger';
  if (risk === 'AT_RISK') return 'warning';
  if (risk === 'STABLE') return 'success';
  return 'default';
}

function isNoHistoryResponse(value: ForecastResponse | ForecastNoHistoryResponse): value is ForecastNoHistoryResponse {
  return 'forecastStatus' in value && value.forecastStatus === 'NO_HISTORY';
}

export default function ForecastingPage({
  userEmail,
  userRole,
  onLogout,
  onNavigate,
  onCreatePurchaseOrderFromPrefill,
  onOpenHelp,
}: DashboardPageProps) {
  const [products, setProducts] = useState<ForecastProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [windowDays, setWindowDays] = useState<(typeof dayOptions)[number]>(7);
  const [horizonDays, setHorizonDays] = useState<(typeof dayOptions)[number]>(14);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [insight, setInsight] = useState<ForecastInsight | null>(null);
  const [evaluation, setEvaluation] = useState<ForecastEvaluation | null>(null);
  const [noHistoryMessage, setNoHistoryMessage] = useState('');
  const [latestMessage, setLatestMessage] = useState('');
  const [productError, setProductError] = useState('');
  const [forecastError, setForecastError] = useState('');
  const [insightError, setInsightError] = useState('');
  const [evaluationError, setEvaluationError] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [loadingEvaluation, setLoadingEvaluation] = useState(false);
  const [generating, setGenerating] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductError('');
    try {
      const response = await fetch(`${API_URL}/api/products`, { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load products.'));
      }
      const data = (await response.json()) as { products: Product[] };
      const activeProducts = data.products
        .filter((product) => product.status === 'ACTIVE')
        .map((product) => ({ id: product.id, sku: product.sku, name: product.name }))
        .sort((left, right) => left.name.localeCompare(right.name));
      setProducts(activeProducts);
      setSelectedProductId((current) => (
        current && activeProducts.some((product) => product.id === current)
          ? current
          : activeProducts[0]?.id ?? ''
      ));
    } catch (requestError) {
      setProductError(requestError instanceof Error ? requestError.message : 'Unable to load products.');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadInsight = useCallback(async (productId: string) => {
    setInsight(null);
    setInsightError('');

    if (!productId) return;

    setLoadingInsight(true);
    try {
      const response = await fetch(`${API_URL}/api/forecasts/products/${productId}/insights`, {
        headers: authHeaders(),
      });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load inventory decision support.'));
      }
      const data = (await response.json()) as ForecastInsightResponse;
      setInsight(data.insight);
    } catch (requestError) {
      setInsightError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load inventory decision support.',
      );
    } finally {
      setLoadingInsight(false);
    }
  }, []);

  const loadEvaluation = useCallback(async (productId: string) => {
    setEvaluation(null);
    setEvaluationError('');

    if (!productId) return;

    setLoadingEvaluation(true);
    try {
      const response = await fetch(`${API_URL}/api/forecasts/products/${productId}/evaluation/latest`, {
        headers: authHeaders(),
      });
      if (response.status === 404) {
        return;
      }
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load forecast evaluation.'));
      }
      const data = (await response.json()) as ForecastEvaluationResponse;
      setEvaluation(data);
    } catch (requestError) {
      setEvaluationError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load forecast evaluation.',
      );
    } finally {
      setLoadingEvaluation(false);
    }
  }, []);

  const loadLatest = useCallback(async (productId: string) => {
    setForecast(null);
    setEvaluation(null);
    setNoHistoryMessage('');
    setLatestMessage('');
    setForecastError('');

    if (!productId) return;

    setLoadingLatest(true);
    try {
      const response = await fetch(`${API_URL}/api/forecasts/products/${productId}/latest`, {
        headers: authHeaders(),
      });
      if (response.status === 404) {
        setLatestMessage('No forecast has been generated for this product yet.');
        setEvaluation(null);
        return;
      }
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load the latest forecast.'));
      }
      const data = (await response.json()) as ForecastResponse;
      setForecast(data.forecast);
      void loadEvaluation(productId);
    } catch (requestError) {
      setForecastError(
        requestError instanceof Error ? requestError.message : 'Unable to load the latest forecast.',
      );
    } finally {
      setLoadingLatest(false);
    }
  }, [loadEvaluation]);

  async function generateForecast(event: FormEvent) {
    event.preventDefault();
    if (!selectedProductId || generating) return;

    setGenerating(true);
    setForecastError('');
    setNoHistoryMessage('');
    setLatestMessage('');
    try {
      const response = await fetch(`${API_URL}/api/forecasts/products/${selectedProductId}/generate`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ windowDays, horizonDays }),
      });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to generate the forecast. Please try again.'));
      }
      const data = (await response.json()) as ForecastResponse | ForecastNoHistoryResponse;
      if (isNoHistoryResponse(data)) {
        setForecast(null);
        setEvaluation(null);
        void loadInsight(selectedProductId);
        setNoHistoryMessage(
          data.message || 'Not enough historical sales data is available to generate a forecast for this product yet.',
        );
        return;
      }
      setForecast(data.forecast);
      void loadInsight(selectedProductId);
      void loadEvaluation(selectedProductId);
    } catch (requestError) {
      setForecastError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to generate the forecast. Please try again.',
      );
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadProducts);
  }, [loadProducts]);

  useEffect(() => {
    void Promise.resolve().then(() => loadLatest(selectedProductId));
    void Promise.resolve().then(() => loadInsight(selectedProductId));
  }, [loadInsight, loadLatest, selectedProductId]);

  const zeroDemand = forecast?.averageDailyDemand === 0;
  const predictiveReorderQuantity = insight?.predictive.predictiveReorderQuantity ?? 0;
  const canCreatePredictivePurchaseOrder =
    userRole === 'Admin' &&
    Boolean(insight) &&
    Boolean(selectedProduct) &&
    predictiveReorderQuantity > 0 &&
    insight?.predictive.risk !== 'NO_FORECAST' &&
    insight?.predictive.risk !== 'NO_DEMAND';

  function createPredictivePurchaseOrder() {
    if (!selectedProduct || !canCreatePredictivePurchaseOrder) return;

    onCreatePurchaseOrderFromPrefill?.({
      productId: selectedProduct.id,
      quantityOrdered: predictiveReorderQuantity,
      source: 'PREDICTIVE_ANALYSIS',
      productName: selectedProduct.name,
      sku: selectedProduct.sku,
    });
  }

  return (
    <AppShell
      activePage="Forecasting"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--forecasting"
    >
      <section className="forecast-page" aria-label="Predictive analysis workspace">
        <PageHeader
          eyebrow="Demand planning"
          title="Predictive Analysis"
          description="Generate Moving Average demand forecasts and evaluate predictive inventory risk."
          secondaryActions={selectedProduct ? (
            <Button
              variant="secondary"
              iconStart={<RefreshCw />}
              onClick={() => {
                void loadLatest(selectedProduct.id);
                void loadInsight(selectedProduct.id);
              }}
              disabled={loadingLatest || generating}
              loading={loadingLatest}
            >
              Load Latest Forecast
            </Button>
          ) : null}
        />

        {productError ? (
          <Alert variant="error" title="Unable to load products">{productError}</Alert>
        ) : null}
        {forecastError ? (
          <Alert variant="error" title="Forecast unavailable">{forecastError}</Alert>
        ) : null}
        {insightError ? (
          <Alert variant="error" title="Decision support unavailable">{insightError}</Alert>
        ) : null}
        {evaluationError ? (
          <Alert variant="error" title="Forecast evaluation unavailable">{evaluationError}</Alert>
        ) : null}
        {noHistoryMessage ? (
          <Alert variant="info" title="Not enough historical sales data">
            {noHistoryMessage} Forecasting becomes available after the product has completed observable sales history.
          </Alert>
        ) : null}
        {latestMessage && !noHistoryMessage ? (
          <Alert variant="info" title="No saved forecast">{latestMessage}</Alert>
        ) : null}

        <BentoGrid className="forecast-layout" gap="standard" dense aria-label="Predictive analysis layout">
          <BentoCard
            className="forecast-config bento-span-full"
            variant="form"
            padding="standard"
            eyebrow="Forecast controls"
            title="Forecast Settings"
            description="Select an active product, historical window, and forecast horizon."
            action={(
              <Button variant="ghost" iconStart={<CircleHelp />} onClick={() => onOpenHelp?.('moving-average')}>
                Learn more
              </Button>
            )}
          >
            <form onSubmit={generateForecast}>
              {loadingProducts ? (
                <div className="forecast-loading">
                  <Spinner size="md" label="Loading products" />
                  <span>Loading active products...</span>
                </div>
              ) : products.length ? (
                <>
                  <div className="forecast-control-grid">
                    <Select
                      label="Product"
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                    >
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} - {product.sku}
                        </option>
                      ))}
                    </Select>

                    <Select
                      label="Historical Window"
                      value={String(windowDays)}
                      onChange={(event) => setWindowDays(Number(event.target.value) as (typeof dayOptions)[number])}
                      helperText="Completed historical days used for average demand."
                    >
                      {dayOptions.map((days) => (
                        <option key={days} value={days}>{days} Days</option>
                      ))}
                    </Select>

                    <Select
                      label="Forecast Horizon"
                      value={String(horizonDays)}
                      onChange={(event) => setHorizonDays(Number(event.target.value) as (typeof dayOptions)[number])}
                      helperText="Future days to project."
                    >
                      {dayOptions.map((days) => (
                        <option key={days} value={days}>{days} Days</option>
                      ))}
                    </Select>

                    <Button type="submit" disabled={!selectedProductId || generating} loading={generating}>
                      Generate Forecast
                    </Button>
                  </div>
                </>
              ) : (
                <EmptyState title="No active products are available for forecasting." />
              )}
            </form>
          </BentoCard>

          <BentoCard
            className="forecast-help-surface bento-span-full"
            padding="compact"
            variant="muted"
            eyebrow="Method"
            title="How is this forecast calculated?"
            description="Learn how the Moving Average forecast works."
            action={(
              <Button variant="secondary" iconStart={<Info />} onClick={() => onOpenHelp?.('moving-average')}>
                Learn more
              </Button>
            )}
          />

        {!selectedProductId && !loadingProducts ? (
          <EmptyState title="Select a product to view or generate a forecast." />
        ) : null}

        {loadingLatest ? (
          <div className="forecast-state">
            <Spinner size="md" label="Loading latest forecast" />
            <span>Loading latest forecast...</span>
          </div>
        ) : null}

        {loadingInsight ? (
          <div className="forecast-state">
            <Spinner size="md" label="Loading inventory decision support" />
            <span>Loading inventory decision support...</span>
          </div>
        ) : null}

        {loadingEvaluation ? (
          <div className="forecast-state">
            <Spinner size="md" label="Loading forecast evaluation" />
            <span>Loading forecast evaluation...</span>
          </div>
        ) : null}

        {forecast && !loadingLatest ? (
          <>
            <BentoCard
              className="forecast-summary bento-span-full"
              padding="standard"
              eyebrow="Current forecast"
              title="Forecast Summary"
              description={`${forecast.product?.name ?? selectedProduct?.name} - ${forecast.product?.sku ?? selectedProduct?.sku}`}
            >
              {forecast.isLimitedHistory ? (
                <Alert variant="warning" title="Limited History">
                  Forecast uses {forecast.historyDaysUsed ?? 0} available historical days instead of
                  the requested {forecast.windowDays ?? windowDays} days.
                </Alert>
              ) : null}
              {zeroDemand ? (
                <Alert variant="info" title="Zero demand observed">
                  No completed sales were recorded during the observed period.
                </Alert>
              ) : null}

              <BentoGrid className="forecast-summary-grid" columns={6} gap="compact">
                <MetricCard className="bento-span-2" label="Average Daily Demand" value={formatQuantity(forecast.averageDailyDemand, ' units/day')} icon={<PackageSearch />} />
                <MetricCard className="bento-span-2" label="Moving Average" value={`${forecast.windowDays ?? windowDays} days`} icon={<CalendarRange />} />
                <MetricCard className="bento-span-2" label="Forecast Horizon" value={`${forecast.horizonDays ?? forecast.points.length} days`} />
                <MetricCard className="bento-span-2" label="History Used" value={`${forecast.historyDaysUsed ?? '-'} days`} />
                <MetricCard className="bento-span-2" label="Generated At" value={formatDateTime(forecast.generatedAt)} />
                <MetricCard className="bento-span-2" label="Method" value={methodLabel(forecast.method)} />
              </BentoGrid>
            </BentoCard>

            <BentoCard
              className="forecast-results bento-span-8"
              padding="analytical"
              variant="analytical"
              eyebrow="Forecast chart"
              title="Forecasted Daily Demand"
              description="Projected daily demand across the selected forecast horizon."
            >
              <ForecastChart points={forecast.points} />
            </BentoCard>

            <BentoCard
              className="forecast-periods bento-span-4"
              padding="standard"
              variant="muted"
              eyebrow="Forecast context"
              title="Source and Horizon"
              description="Compact metadata for the current forecast run."
            >
              <div className="forecast-period-list">
                <article>
                  <span>Historical Source</span>
                  <strong>{formatDate(forecast.sourceStartDate)} - {formatDate(forecast.sourceEndDate)}</strong>
                </article>
                <article>
                  <span>Forecast Period</span>
                  <strong>{formatDate(forecast.horizonStartDate)} - {formatDate(forecast.horizonEndDate)}</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong><Badge variant="neutral">{forecast.status}</Badge></strong>
                </article>
              </div>
            </BentoCard>

            <BentoCard
              className="forecast-table-card bento-span-full"
              padding="standard"
              variant="table"
              eyebrow="Forecast evidence"
              title="Daily Predicted Demand"
              description="Exact predicted quantity by forecast date."
            >
              <div className="forecast-table-wrap">
                <table className="forecast-table">
                  <thead>
                    <tr>
                      <th>Forecast Date</th>
                      <th>Predicted Demand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.points.map((point) => (
                      <tr key={point.date}>
                        <td>{formatDate(point.date)}</td>
                        <td>{formatQuantity(point.predictedQuantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BentoCard>
          </>
        ) : null}

        {insight && !loadingInsight ? (
          <BentoCard
            className="forecast-insights bento-span-full"
            padding="standard"
            eyebrow="Forecast-based risk"
            title="Inventory Decision Support"
            description="Forecast-based stock risk and reorder guidance."
            action={(
              <Badge variant={riskVariants[insight.predictive.risk]}>
                {riskLabels[insight.predictive.risk]}
              </Badge>
            )}
          >

            {insight.predictive.risk === 'NO_FORECAST' ? (
              <Alert variant="info" title="Forecast Required">
                Generate a moving-average forecast to view predictive inventory recommendations.
              </Alert>
            ) : null}
            {insight.predictive.risk === 'NO_DEMAND' ? (
              <Alert variant="info" title="No Demand Detected">
                No stock-out is projected because no demand was observed in the forecast period.
              </Alert>
            ) : null}
            {insight.forecast?.isLimitedHistory ? (
              <Alert variant="warning" title="Limited History">
                Decision support uses {insight.forecast.historyDaysUsed ?? 0} available historical
                days instead of the requested {insight.forecast.windowDays ?? '-'} days.
              </Alert>
            ) : null}

            <BentoGrid className="forecast-insight-grid" columns={6} gap="compact">
              <MetricCard className="bento-span-2" label="Current Stock" value={formatQuantity(insight.inventory.currentQuantity)} icon={<PackageSearch />} />
              <MetricCard className="bento-span-2" label="Average Daily Demand" value={formatQuantity(insight.forecast?.averageDailyDemand, ' units/day')} />
              <MetricCard className="bento-span-2" label="Days Remaining" value={formatDaysRemaining(insight.predictive.daysOfStockRemaining)} />
              <MetricCard className="bento-span-2" label="Estimated Stock-Out" value={formatStockoutDate(insight.predictive.estimatedStockoutDate)} />
              <MetricCard
                className="bento-span-2"
                label="Forecast Risk"
                value={<Badge variant={riskVariants[insight.predictive.risk]}>{riskLabels[insight.predictive.risk]}</Badge>}
                tone={metricToneForRisk(insight.predictive.risk)}
                icon={<TriangleAlert />}
              />
              <MetricCard className="bento-span-2" label="Predictive Reorder" value={formatNullableQuantity(insight.predictive.predictiveReorderQuantity)} />
            </BentoGrid>

            <div className="forecast-comparison">
              <article>
                <span>Static Stock Health</span>
                <strong>{stockHealthLabels[insight.inventory.stockHealth]}</strong>
              </article>
              <article>
                <span>Reorder Point</span>
                <strong>{insight.inventory.reorderPoint === null ? 'Not configured' : insight.inventory.reorderPoint}</strong>
              </article>
              <article>
                <span>Static Reorder</span>
                <strong>{formatNullableQuantity(insight.inventory.staticRecommendedReorderQuantity)}</strong>
              </article>
              <article>
                <span>Forecast Horizon Demand</span>
                <strong>{formatNullableQuantity(insight.predictive.forecastDemandForHorizon)}</strong>
              </article>
            </div>

            {canCreatePredictivePurchaseOrder ? (
              <div className="forecast-procurement-cta">
                <div>
                  <strong>Create Purchase Order</strong>
                  <p>
                    Use the predictive recommendation as a starting quantity. You can review and
                    change it before creating the order.
                  </p>
                </div>
                <Button onClick={createPredictivePurchaseOrder}>
                  Create Purchase Order
                </Button>
              </div>
            ) : insight.predictive.risk !== 'NO_FORECAST' && insight.predictive.risk !== 'NO_DEMAND' ? (
              <div className="forecast-procurement-note">
                No predictive reorder is currently recommended.
              </div>
            ) : null}
          </BentoCard>
        ) : null}

        {evaluation && !loadingEvaluation ? (
          <>
            <BentoCard
              className="forecast-evaluation bento-span-4"
              padding="standard"
              eyebrow="Forecast evaluation"
              title="Forecast Evaluation"
              description="Compare matured forecast values with actual completed sales."
              action={(
                <Badge variant={evaluation.status === 'READY' ? 'success' : 'info'}>
                  {evaluation.status === 'READY' ? 'Ready' : 'Not ready yet'}
                </Badge>
              )}
            >
              <div className="forecast-evaluation-coverage">
                <span>{formatPercent(evaluation.coveragePercent)} coverage</span>
                <span>{evaluation.evaluatedPeriods} of {evaluation.totalForecastPeriods} days</span>
                {evaluation.forecastRun.isLimitedHistory ? (
                  <span>
                    Limited history: {evaluation.forecastRun.historyDaysUsed ?? 0} of{' '}
                    {evaluation.forecastRun.windowDays ?? '-'} days used
                  </span>
                ) : null}
              </div>

              {evaluation.status === 'NOT_READY' ? (
                <Alert variant="info" title="Evaluation Not Ready">
                  Evaluation becomes available once forecast dates have matured and actual sales can be compared.
                </Alert>
              ) : null}

              {evaluation.metrics ? (
                <div className="forecast-evaluation-grid">
                  <MetricCard label="Evaluated Periods" value={`${evaluation.evaluatedPeriods} of ${evaluation.totalForecastPeriods}`} />
                  <MetricCard label="MAE" value={formatQuantity(evaluation.metrics.mae, ' units/day')} helper="Average absolute quantity error." />
                  <MetricCard
                    label="WAPE"
                    value={formatWape(evaluation.metrics.wapePercent)}
                    helper={evaluation.metrics.wapePercent === null
                      ? 'Unavailable because actual demand was zero.'
                      : 'Absolute error relative to total actual demand.'}
                  />
                  <MetricCard
                    label="Mean Error"
                    value={formatSignedQuantity(evaluation.metrics.meanError, ' units/day')}
                    helper="Positive means over-forecast; negative means under-forecast."
                    tone={evaluation.metrics.meanError === 0 ? 'success' : 'warning'}
                  />
                  <MetricCard
                    label="Bias Direction"
                    value={<Badge variant={biasVariants[evaluation.metrics.biasDirection]}>{biasLabels[evaluation.metrics.biasDirection]}</Badge>}
                  />
                  <MetricCard label="Total Predicted" value={formatQuantity(evaluation.metrics.totalPredicted)} />
                  <MetricCard label="Total Actual" value={formatQuantity(evaluation.metrics.totalActual)} />
                </div>
              ) : null}
            </BentoCard>

            {evaluation.metrics ? (
              <>
                <BentoCard
                  className="forecast-evaluation-chart-card bento-span-8"
                  padding="analytical"
                  variant="analytical"
                  eyebrow="Evaluation chart"
                  title="Predicted vs Actual Demand"
                  description="Predicted demand compared with actual completed-sales demand."
                >
                  <ForecastEvaluationChart points={evaluation.points} />
                </BentoCard>

                <BentoCard
                  className="forecast-evaluation-table-card bento-span-full"
                  padding="standard"
                  variant="table"
                  eyebrow="Evaluation evidence"
                  title="Daily Comparison"
                  description="Positive difference = over-forecast. Negative difference = under-forecast."
                >
                  <div className="forecast-table-wrap">
                    <table className="forecast-table forecast-table--evaluation">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Predicted</th>
                          <th>Actual</th>
                          <th>Difference</th>
                          <th>Absolute Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {evaluation.points.map((point) => (
                          <tr key={point.date}>
                            <td>{formatDate(point.date)}</td>
                            <td>{formatQuantity(point.predictedQuantity)}</td>
                            <td>{formatQuantity(point.actualQuantity)}</td>
                            <td className={point.error > 0 ? 'is-over' : point.error < 0 ? 'is-under' : undefined}>
                              {formatSignedQuantity(point.error)}
                            </td>
                            <td>{formatQuantity(point.absoluteError)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </BentoCard>
              </>
            ) : null}
          </>
        ) : null}
        </BentoGrid>

      </section>
    </AppShell>
  );
}
