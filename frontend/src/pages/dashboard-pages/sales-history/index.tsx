import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function SalesHistoryPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Sales History"
      eyebrow="Sales ledger"
      title="Sales History"
      description="Review completed transactions, returns, and revenue movement by period."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Export sales"
      metrics={[
        { label: 'Sales today', value: '$18.7K', helper: '342 transactions' },
        { label: 'Returns', value: '14', helper: 'Within normal range' },
        { label: 'Avg. order', value: '$54.70', helper: '+3.1% this week' },
      ]}
      rows={[
        { title: 'Morning sales batch', detail: 'All POS entries reconciled.', status: 'Closed' },
        { title: 'Online order returns', detail: 'Two refunds require manager approval.', status: 'Review' },
        { title: 'Channel revenue audit', detail: 'Marketplace totals match expected deposits.', status: 'Ready' },
      ]}
    />
  );
}


