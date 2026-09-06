import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { Product } from '../../../types/product';
import type { PurchaseOrderPrefill } from '../../../types/purchase-order';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import ForecastChart from './ForecastChart';
import ForecastEvaluationChart from './ForecastEvaluationChart';
import './styles.css';

type DashboardPageProps = {
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

function isNoHistoryResponse(value: ForecastResponse | ForecastNoHistoryResponse): value is ForecastNoHistoryResponse {
  return 'forecastStatus' in value && value.forecastStatus === 'NO_HISTORY';
}

export default function ForecastingPage({
  userEmail,
  userRole,
  onLogout,
  onNavigate,
  onCreatePurchaseOrderFromPrefill,
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
        <header className="forecast-header">
          <div>
            <p className="forecast-eyebrow">Demand planning</p>
            <h1>Predictive Analysis</h1>
            <p>Forecast future product demand using historical sales and moving average.</p>
            <small>Forecasts are based on completed sales transactions.</small>
          </div>
          {selectedProduct ? (
            <Button
              variant="secondary"
              onClick={() => {
                void loadLatest(selectedProduct.id);
                void loadInsight(selectedProduct.id);
              }}
              disabled={loadingLatest || generating}
            >
              {loadingLatest ? 'Loading Latest...' : 'Load Latest Forecast'}
            </Button>
          ) : null}
        </header>

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

        <div className="forecast-layout">
          <Card padding="default" className="forecast-config">
            <form onSubmit={generateForecast}>
              <div>
                <h2>Forecast Configuration</h2>
                <p>Moving Average</p>
              </div>

              {loadingProducts ? (
                <div className="forecast-loading">
                  <Spinner size="md" label="Loading products" />
                  <span>Loading active products...</span>
                </div>
              ) : products.length ? (
                <>
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
                    label="Moving Average Window"
                    value={String(windowDays)}
                    onChange={(event) => setWindowDays(Number(event.target.value) as (typeof dayOptions)[number])}
                    helperText="Number of completed historical days used to calculate average daily demand."
                  >
                    {dayOptions.map((days) => (
                      <option key={days} value={days}>{days} Days</option>
                    ))}
                  </Select>

                  <Select
                    label="Forecast Horizon"
                    value={String(horizonDays)}
                    onChange={(event) => setHorizonDays(Number(event.target.value) as (typeof dayOptions)[number])}
                    helperText="Number of future days to forecast."
                  >
                    {dayOptions.map((days) => (
                      <option key={days} value={days}>{days} Days</option>
                    ))}
                  </Select>

                  <Button type="submit" disabled={!selectedProductId || generating} loading={generating}>
                    {generating ? 'Generating Forecast...' : 'Generate Forecast'}
                  </Button>
                </>
              ) : (
                <EmptyState title="No active products are available for forecasting." />
              )}
            </form>
          </Card>

          <Card padding="default" className="forecast-explanation">
            <h2>How this forecast is calculated</h2>
            <p>
              The system totals completed product sales across the selected historical period,
              includes calendar days with no sales as zero demand, and divides the total quantity
              by the number of observed days. The resulting moving average is used as the predicted
              daily demand for the selected forecast horizon.
            </p>
          </Card>
        </div>

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

        {insight && !loadingInsight ? (
          <Card padding="default" className="forecast-insights">
            <div className="forecast-results-header">
              <div>
                <h2>Inventory Decision Support</h2>
                <p>
                  Static reorder uses the configured reorder point. Predictive reorder uses
                  forecasted demand from completed sales.
                </p>
              </div>
              <Badge variant={riskVariants[insight.predictive.risk]}>
                {riskLabels[insight.predictive.risk]}
              </Badge>
            </div>

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

            <div className="forecast-insight-grid">
              <article>
                <span>Current Stock</span>
                <strong>{formatQuantity(insight.inventory.currentQuantity)}</strong>
              </article>
              <article>
                <span>Average Daily Demand</span>
                <strong>{formatQuantity(insight.forecast?.averageDailyDemand, ' units/day')}</strong>
              </article>
              <article>
                <span>Days of Stock Remaining</span>
                <strong>{formatDaysRemaining(insight.predictive.daysOfStockRemaining)}</strong>
              </article>
              <article>
                <span>Estimated Stock-Out</span>
                <strong>{formatStockoutDate(insight.predictive.estimatedStockoutDate)}</strong>
              </article>
              <article>
                <span>Forecast Risk</span>
                <strong>
                  <Badge variant={riskVariants[insight.predictive.risk]}>
                    {riskLabels[insight.predictive.risk]}
                  </Badge>
                </strong>
              </article>
              <article>
                <span>Predictive Reorder</span>
                <strong>{formatNullableQuantity(insight.predictive.predictiveReorderQuantity)}</strong>
              </article>
            </div>

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
          </Card>
        ) : null}

        {forecast && !loadingLatest ? (
          <>
            <section className="forecast-summary" aria-label="Forecast summary">
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

              <div className="forecast-summary-grid">
                <article>
                  <span>Average Daily Demand</span>
                  <strong>{formatQuantity(forecast.averageDailyDemand, ' units/day')}</strong>
                </article>
                <article>
                  <span>Moving Average</span>
                  <strong>{forecast.windowDays ?? windowDays} days</strong>
                </article>
                <article>
                  <span>Forecast Horizon</span>
                  <strong>{forecast.horizonDays ?? forecast.points.length} days</strong>
                </article>
                <article>
                  <span>History Used</span>
                  <strong>{forecast.historyDaysUsed ?? '-'} days</strong>
                </article>
                <article>
                  <span>Generated At</span>
                  <strong>{formatDateTime(forecast.generatedAt)}</strong>
                </article>
                <article>
                  <span>Method</span>
                  <strong>{methodLabel(forecast.method)}</strong>
                </article>
              </div>
            </section>

            <section className="forecast-periods" aria-label="Forecast periods">
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
            </section>

            {evaluation && !loadingEvaluation ? (
              <Card padding="default" className="forecast-evaluation">
                <div className="forecast-results-header">
                  <div>
                    <h2>Forecast Evaluation</h2>
                    <p>Compare matured forecast days with actual completed sales.</p>
                  </div>
                  <Badge variant={evaluation.status === 'READY' ? 'success' : 'info'}>
                    {evaluation.evaluatedPeriods} of {evaluation.totalForecastPeriods} Days
                  </Badge>
                </div>

                <div className="forecast-evaluation-coverage">
                  <span>{formatPercent(evaluation.coveragePercent)} coverage</span>
                  {evaluation.forecastRun.isLimitedHistory ? (
                    <span>
                      Limited history: {evaluation.forecastRun.historyDaysUsed ?? 0} of{' '}
                      {evaluation.forecastRun.windowDays ?? '-'} days used
                    </span>
                  ) : null}
                </div>

                {evaluation.status === 'NOT_READY' ? (
                  <Alert variant="info" title="Evaluation Not Ready">
                    Forecast evaluation will be available after the first forecast day is complete.
                  </Alert>
                ) : null}

                {evaluation.metrics ? (
                  <>
                    <div className="forecast-evaluation-grid">
                      <article>
                        <span>Evaluated Days</span>
                        <strong>
                          {evaluation.evaluatedPeriods} of {evaluation.totalForecastPeriods}
                        </strong>
                      </article>
                      <article>
                        <span>MAE</span>
                        <strong>{formatQuantity(evaluation.metrics.mae, ' units/day')}</strong>
                        <small>Average absolute quantity error per evaluated day.</small>
                      </article>
                      <article>
                        <span>WAPE</span>
                        <strong>{formatPercent(evaluation.metrics.wapePercent)}</strong>
                        <small>
                          {evaluation.metrics.wapePercent === null
                            ? 'Unavailable because actual demand was zero across evaluated days.'
                            : 'Absolute forecast error relative to total actual demand.'}
                        </small>
                      </article>
                      <article>
                        <span>Forecast Bias</span>
                        <strong>
                          <Badge variant={biasVariants[evaluation.metrics.biasDirection]}>
                            {biasLabels[evaluation.metrics.biasDirection]}
                          </Badge>
                        </strong>
                        <small>{formatSignedQuantity(evaluation.metrics.meanError, ' units/day')}</small>
                      </article>
                      <article>
                        <span>Total Predicted</span>
                        <strong>{formatQuantity(evaluation.metrics.totalPredicted)}</strong>
                      </article>
                      <article>
                        <span>Total Actual</span>
                        <strong>{formatQuantity(evaluation.metrics.totalActual)}</strong>
                      </article>
                    </div>

                    <ForecastEvaluationChart points={evaluation.points} />

                    <div className="forecast-table-wrap">
                      <div className="forecast-table-caption">
                        Positive difference = over-forecast. Negative difference = under-forecast.
                      </div>
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
                  </>
                ) : null}
              </Card>
            ) : null}

            <Card padding="default" className="forecast-results">
              <div className="forecast-results-header">
                <div>
                  <h2>Daily Predicted Demand</h2>
                  <p>{forecast.product?.name ?? selectedProduct?.name} - {forecast.product?.sku ?? selectedProduct?.sku}</p>
                </div>
                <Badge variant="info">Moving Average</Badge>
              </div>

              <ForecastChart points={forecast.points} />

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
            </Card>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
