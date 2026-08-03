import './styles.css';

export type DashboardPageName =
  | 'Dashboard'
  | 'Products'
  | 'Categories'
  | 'Suppliers'
  | 'Inventory'
  | 'Sales History'
  | 'Forecasting'
  | 'Reports'
  | 'User Management'
  | 'Settings';

type Metric = {
  label: string;
  value: string;
  helper: string;
};

type Row = {
  title: string;
  detail: string;
  status: string;
};

type DashboardPageShellProps = {
  activePage: DashboardPageName;
  eyebrow: string;
  title: string;
  description: string;
  metrics: Metric[];
  rows: Row[];
  actionLabel: string;
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

const navigationItems: DashboardPageName[] = [
  'Dashboard',
  'Products',
  'Categories',
  'Suppliers',
  'Inventory',
  'Sales History',
  'Forecasting',
  'Reports',
  'User Management',
  'Settings',
];

const pageClassNames: Record<DashboardPageName, string> = {
  Dashboard: 'dashboard-page--dashboard',
  Products: 'dashboard-page--products',
  Categories: 'dashboard-page--categories',
  Suppliers: 'dashboard-page--suppliers',
  Inventory: 'dashboard-page--inventory',
  'Sales History': 'dashboard-page--sales-history',
  Forecasting: 'dashboard-page--forecasting',
  Reports: 'dashboard-page--reports',
  'User Management': 'dashboard-page--user-management',
  Settings: 'dashboard-page--settings',
};

export function DashboardPageShell({
  activePage,
  eyebrow,
  title,
  description,
  metrics,
  rows,
  actionLabel,
  userEmail,
  onLogout,
  onNavigate,
}: DashboardPageShellProps) {
  return (
    <main className={`dashboard-page ${pageClassNames[activePage]}`}>
      <aside className="dashboard-page-sidebar" aria-label="Dashboard navigation">
        <div className="dashboard-page-brand">
          <span className="dashboard-page-logo" aria-hidden="true">
            <span />
          </span>
          <div>
            <p className="dashboard-page-brand-name">StockFlow</p>
            <p className="dashboard-page-brand-subtitle">Retail operations hub</p>
          </div>
        </div>

        <nav className="dashboard-page-nav">
          <p className="dashboard-page-nav-label">Menu</p>
          <ul>
            {navigationItems.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onNavigate?.(item)}
                  className={
                    item === activePage
                      ? 'dashboard-page-nav-item is-active'
                      : 'dashboard-page-nav-item'
                  }
                >
                  <span className="dashboard-page-nav-dot" aria-hidden="true" />
                  <span>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {userEmail && onLogout ? (
          <section className="dashboard-page-user-card">
            <p className="dashboard-page-user-label">Signed in as</p>
            <strong>{userEmail}</strong>
            <button type="button" onClick={onLogout}>
              Log out
            </button>
          </section>
        ) : null}
      </aside>

      <section className="dashboard-page-content">
        <header className="dashboard-page-header">
          <div>
            <p className="dashboard-page-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <button type="button" className="dashboard-page-action">
            {actionLabel}
          </button>
        </header>

        <section className="dashboard-page-metrics" aria-label={`${title} metrics`}>
          {metrics.map((metric) => (
            <article className="dashboard-page-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <p>{metric.helper}</p>
            </article>
          ))}
        </section>

        <section className="dashboard-page-panel">
          <div className="dashboard-page-panel-head">
            <div>
              <p className="dashboard-page-eyebrow">Workspace</p>
              <h2>{activePage} queue</h2>
            </div>
            <span>{rows.length} open items</span>
          </div>

          <div className="dashboard-page-table" role="table" aria-label={`${title} queue`}>
            {rows.map((row) => (
              <div className="dashboard-page-table-row" role="row" key={row.title}>
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.detail}</p>
                </div>
                <span>{row.status}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}


