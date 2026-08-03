import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function SuppliersPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Suppliers"
      eyebrow="Vendor network"
      title="Suppliers"
      description="Monitor supplier reliability, purchase terms, and delivery exceptions."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Add supplier"
      metrics={[
        { label: 'Partners', value: '64', helper: '51 active this month' },
        { label: 'Delayed POs', value: '7', helper: '2 high priority' },
        { label: 'Avg. lead time', value: '4.2d', helper: '-0.6 days improved' },
      ]}
      rows={[
        { title: 'Northline Distribution', detail: 'Delivery window moved to Wednesday.', status: 'Delay' },
        { title: 'Metro Label Co.', detail: 'New payment terms pending approval.', status: 'Review' },
        { title: 'ScanTech Wholesale', detail: 'Quarterly performance score is ready.', status: 'Ready' },
      ]}
    />
  );
}


