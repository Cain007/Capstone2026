import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { Category } from '../../../types/category';
import type { Product } from '../../../types/product';
import type { Supplier } from '../../../types/supplier';
import { statusBadgeVariant, statusLabel } from '../../../utils/status';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type DashboardData = {
  products: Product[];
  categories: Category[];
  suppliers: Supplier[];
};

type ActivityItem = {
  id: string;
  type: 'Product' | 'Category' | 'Supplier';
  name: string;
  status: string;
  updatedAt: string;
};

type AttentionItem = {
  label: string;
  count: number;
  helper: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Unable to load dashboard data');
  }

  return (await response.json()) as T;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return dateTimeFormatter.format(date);
}

export default function DashboardPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData>({
    products: [],
    categories: [],
    suppliers: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const initialLoadStarted = useRef(false);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const [productsResponse, categoriesResponse, suppliersResponse] = await Promise.all([
        fetchJson<{ products?: Product[] }>('/api/products'),
        fetchJson<{ categories?: Category[] }>('/api/categories'),
        fetchJson<{ suppliers?: Supplier[] }>('/api/suppliers'),
      ]);

      setData({
        products: productsResponse.products ?? [],
        categories: categoriesResponse.categories ?? [],
        suppliers: suppliersResponse.suppliers ?? [],
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadStarted.current) {
      return;
    }

    initialLoadStarted.current = true;
    void loadDashboardData();
  }, [loadDashboardData]);

  const metrics = useMemo(() => {
    const activeProducts = data.products.filter(
      (product) => product.status === 'ACTIVE',
    ).length;

    return [
      {
        label: 'Total Products',
        value: data.products.length,
        helper: 'Products in the catalog',
      },
      {
        label: 'Active Products',
        value: activeProducts,
        helper: 'Available catalog records',
      },
      {
        label: 'Categories',
        value: data.categories.length,
        helper: 'Category records',
      },
      {
        label: 'Suppliers',
        value: data.suppliers.length,
        helper: 'Supplier records',
      },
    ];
  }, [data.categories.length, data.products, data.suppliers.length]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items = [
      {
        label: 'Draft Products',
        count: data.products.filter((product) => product.status === 'DRAFT').length,
        helper: 'Products not active yet',
      },
      {
        label: 'Archived Categories',
        count: data.categories.filter((category) => category.status === 'ARCHIVED').length,
        helper: 'Categories outside active use',
      },
      {
        label: 'Suppliers On Hold',
        count: data.suppliers.filter((supplier) => supplier.status === 'ON_HOLD').length,
        helper: 'Suppliers paused for review',
      },
      {
        label: 'Inactive Suppliers',
        count: data.suppliers.filter((supplier) => supplier.status === 'INACTIVE').length,
        helper: 'Suppliers not currently active',
      },
    ];

    return items.filter((item) => item.count > 0);
  }, [data.categories, data.products, data.suppliers]);

  const recentActivity = useMemo<ActivityItem[]>(() => {
    const products = data.products.map((product) => ({
      id: `product-${product.id}`,
      type: 'Product' as const,
      name: product.name,
      status: product.status,
      updatedAt: product.updatedAt,
    }));

    const categories = data.categories.map((category) => ({
      id: `category-${category.id}`,
      type: 'Category' as const,
      name: category.name,
      status: category.status,
      updatedAt: category.updatedAt,
    }));

    const suppliers = data.suppliers.map((supplier) => ({
      id: `supplier-${supplier.id}`,
      type: 'Supplier' as const,
      name: supplier.name,
      status: supplier.status,
      updatedAt: supplier.updatedAt,
    }));

    return [...products, ...categories, ...suppliers]
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      )
      .slice(0, 8);
  }, [data.categories, data.products, data.suppliers]);

  const showLoadedContent = !loading && !error;
  const showEmptyActivity = showLoadedContent && recentActivity.length === 0;

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
          eyebrow="Operations overview"
          title="Dashboard"
          description="Overview of your product catalog, categories, and suppliers."
        />

        {loading ? (
          <section className="real-dashboard-loading" role="status" aria-live="polite">
            <Spinner size="md" label="Loading dashboard data" />
            <span>Loading dashboard data...</span>
          </section>
        ) : null}

        {error && !loading ? (
          <Alert variant="error" title="Unable to load dashboard data.">
            Check your connection and try again.
          </Alert>
        ) : null}

        {error && !loading ? (
          <div className="real-dashboard-retry">
            <Button variant="secondary" onClick={loadDashboardData}>
              Retry
            </Button>
          </div>
        ) : null}

        {showLoadedContent ? (
          <>
            <section className="real-dashboard-kpis" aria-label="Catalog summary">
              {metrics.map((metric) => (
                <Card key={metric.label} padding="compact" className="real-dashboard-kpi">
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                  <span>{metric.helper}</span>
                </Card>
              ))}
            </section>

            <div className="real-dashboard-grid">
              <Card padding="default" className="real-dashboard-activity">
                <div className="real-dashboard-section-head">
                  <div>
                    <p className="real-dashboard-kicker">Catalog activity</p>
                    <h2>Recent Catalog Activity</h2>
                  </div>
                  <span>{recentActivity.length} recent</span>
                </div>

                {showEmptyActivity ? (
                  <EmptyState
                    title="No recent catalog activity."
                    description="Products, categories, and suppliers will appear here after they are updated."
                  />
                ) : (
                  <ul className="real-dashboard-activity-list">
                    {recentActivity.map((activity) => (
                      <li key={activity.id} className="real-dashboard-activity-item">
                        <div>
                          <div className="real-dashboard-activity-title">
                            <Badge variant="info">{activity.type}</Badge>
                            <strong>{activity.name}</strong>
                          </div>
                          <p>Updated {formatDateTime(activity.updatedAt)}</p>
                        </div>
                        <Badge variant={statusBadgeVariant(activity.status)}>
                          {statusLabel(activity.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card padding="default" className="real-dashboard-attention">
                <div className="real-dashboard-section-head">
                  <div>
                    <p className="real-dashboard-kicker">Status review</p>
                    <h2>Needs Attention</h2>
                  </div>
                </div>

                {attentionItems.length > 0 ? (
                  <ul className="real-dashboard-attention-list">
                    {attentionItems.map((item) => (
                      <li key={item.label}>
                        <div>
                          <strong>{item.label}</strong>
                          <p>{item.helper}</p>
                        </div>
                        <Badge variant="warning">{item.count}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    title="No catalog status items need attention."
                    description="Draft products, archived categories, and paused suppliers are currently clear."
                  />
                )}
              </Card>
            </div>

            {onNavigate ? (
              <Card padding="compact" className="real-dashboard-quick-nav">
                <div>
                  <p className="real-dashboard-kicker">Shortcuts</p>
                  <h2>Quick Navigation</h2>
                </div>
                <div className="real-dashboard-quick-nav-actions">
                  <Button variant="secondary" onClick={() => onNavigate('Products')}>
                    Manage Products
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate('Categories')}>
                    Manage Categories
                  </Button>
                  <Button variant="secondary" onClick={() => onNavigate('Suppliers')}>
                    Manage Suppliers
                  </Button>
                </div>
              </Card>
            ) : null}
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
