import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function SettingsPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Settings"
      eyebrow="System preferences"
      title="Settings"
      description="Configure locations, notification rules, thresholds, and workspace defaults."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Save changes"
      metrics={[
        { label: 'Locations', value: '3', helper: 'All synchronized' },
        { label: 'Alerts', value: '18', helper: '9 inventory rules' },
        { label: 'Integrations', value: '5', helper: 'All healthy' },
      ]}
      rows={[
        { title: 'Low-stock threshold', detail: 'Review critical quantity for label products.', status: 'Review' },
        { title: 'Email notifications', detail: 'Daily digest is enabled for managers.', status: 'Active' },
        { title: 'POS connection', detail: 'Last sync completed successfully.', status: 'Healthy' },
      ]}
    />
  );
}


