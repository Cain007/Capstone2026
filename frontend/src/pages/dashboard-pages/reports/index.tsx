import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function ReportsPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Reports"
      eyebrow="Business reporting"
      title="Reports"
      description="Prepare operational, financial, and inventory reports for stakeholders."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Build report"
      metrics={[
        { label: 'Saved reports', value: '31', helper: '12 scheduled' },
        { label: 'Exports', value: '86', helper: 'This month' },
        { label: 'Pending', value: '4', helper: 'Need final review' },
      ]}
      rows={[
        { title: 'Weekly stock movement', detail: 'Draft includes warehouse comparison.', status: 'Draft' },
        { title: 'Sales margin rollup', detail: 'Finance export is ready.', status: 'Ready' },
        { title: 'Supplier scorecard', detail: 'Awaiting two late delivery notes.', status: 'Open' },
      ]}
    />
  );
}


