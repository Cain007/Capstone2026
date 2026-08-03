import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function ForecastingPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Forecasting"
      eyebrow="Demand planning"
      title="Forecasting"
      description="Use demand signals to plan replenishment, promotions, and stock buffers."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Run forecast"
      metrics={[
        { label: 'Demand lift', value: '+14%', helper: 'Next 7 days' },
        { label: 'Risk SKUs', value: '23', helper: 'May stock out' },
        { label: 'Promo impact', value: '$9.8K', helper: 'Projected upside' },
      ]}
      rows={[
        { title: 'Label demand spike', detail: 'Forecast suggests earlier replenishment.', status: 'Plan' },
        { title: 'Scanner promotion', detail: 'Inventory can support two more campaign days.', status: 'Ready' },
        { title: 'Tape reorder model', detail: 'Safety stock recommendation increased.', status: 'Review' },
      ]}
    />
  );
}


