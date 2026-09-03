import './styles.css';
import PageHeader from '../../../components/PageHeader';
import AppShell from '../../../layouts/AppShell';

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
  id?: string;
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
  onAction?: () => void;
  renderRowActions?: (row: Row) => React.ReactNode;
  children?: React.ReactNode;
};

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
  onAction,
  renderRowActions,
  children,
}: DashboardPageShellProps) {
  return (
    <AppShell
      activePage={activePage}
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className={`dashboard-page ${pageClassNames[activePage]}`}
    >
      <section className="dashboard-page-content" aria-label={`${title} workspace`}>
        <PageHeader
          eyebrow={eyebrow}
          title={title}
          description={description}
          actionLabel={actionLabel}
          onAction={onAction}
        />

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
              <div className="dashboard-page-table-row" role="row" key={row.id ?? row.title}>
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.detail}</p>
                </div>
                <div className="dashboard-page-table-row-meta">
                  <span>{row.status}</span>
                  {renderRowActions ? <div className="dashboard-page-row-actions">{renderRowActions(row)}</div> : null}
                </div>
              </div>
            ))}
          </div>
          {children}
        </section>
      </section>
    </AppShell>
  );
}
