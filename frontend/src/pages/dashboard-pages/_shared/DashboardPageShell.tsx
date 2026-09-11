import './styles.css';
import PageHeader from '../../../components/PageHeader';
import { BentoCard } from '../../../components/layout/BentoCard';
import { BentoGrid } from '../../../components/layout/BentoGrid';
import { MetricCard } from '../../../components/layout/MetricCard';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';

export type DashboardPageName =
  | 'Dashboard'
  | 'Products'
  | 'Categories'
  | 'Suppliers'
  | 'Purchase Orders'
  | 'Inventory'
  | 'Stock Movements'
  | 'Sales History'
  | 'Forecasting'
  | 'Reports'
  | 'User Management'
  | 'Audit Logs'
  | 'Account & System'
  | 'Help & System Guide'
  | 'POS';

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
  userRole?: UserRole;
  userDisplayName?: string;
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
  'Purchase Orders': 'dashboard-page--purchase-orders',
  Inventory: 'dashboard-page--inventory',
  'Stock Movements': 'dashboard-page--stock-movements',
  'Sales History': 'dashboard-page--sales-history',
  Forecasting: 'dashboard-page--forecasting',
  Reports: 'dashboard-page--reports',
  'User Management': 'dashboard-page--user-management',
  'Audit Logs': 'dashboard-page--audit-logs',
  'Account & System': 'dashboard-page--settings',
  'Help & System Guide': 'dashboard-page--help',
  POS: 'dashboard-page--pos',
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
  userRole,
  userDisplayName,
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
      userRole={userRole}
      userDisplayName={userDisplayName}
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

        <BentoGrid className="dashboard-page-metrics" columns={6} gap="compact" aria-label={`${title} metrics`}>
          {metrics.map((metric) => (
            <MetricCard
              className="dashboard-page-metric bento-span-2"
              key={metric.label}
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
            />
          ))}
        </BentoGrid>

        <BentoCard className="dashboard-page-panel" padding="standard" variant="table">
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
        </BentoCard>
      </section>
    </AppShell>
  );
}
