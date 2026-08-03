import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function UserManagementPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="User Management"
      eyebrow="Access control"
      title="User Management"
      description="Maintain team access, roles, and operational permissions."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Invite user"
      metrics={[
        { label: 'Users', value: '48', helper: '42 active this week' },
        { label: 'Invites', value: '6', helper: 'Awaiting response' },
        { label: 'Role reviews', value: '3', helper: 'Due this week' },
      ]}
      rows={[
        { title: 'Warehouse role update', detail: 'Cycle count permission requested.', status: 'Review' },
        { title: 'New supervisor invite', detail: 'Account invitation expires tomorrow.', status: 'Pending' },
        { title: 'Quarterly access check', detail: 'Finance users need confirmation.', status: 'Open' },
      ]}
    />
  );
}


