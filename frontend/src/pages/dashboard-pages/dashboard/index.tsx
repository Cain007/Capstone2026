import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function DashboardPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Dashboard"
      eyebrow="Operations overview"
      title="Dashboard"
      description="Track revenue, replenishment, and team activity from one calm command surface."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="New report"
      metrics={[
        { label: 'Revenue', value: '$128.4K', helper: '+12.4% this week' },
        { label: 'Orders', value: '342', helper: '74 waiting fulfillment' },
        { label: 'Low stock', value: '18', helper: '3 critical items' },
      ]}
      rows={[
        { title: 'Approve weekly replenishment', detail: 'Fast moving items need confirmation.', status: 'Review' },
        { title: 'Investigate stock variance', detail: 'Receiving count differs from expected units.', status: 'Open' },
        { title: 'Publish sales summary', detail: 'Finance report is ready for export.', status: 'Ready' },
      ]}
    />
  );
}


