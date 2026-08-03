import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function CategoriesPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Categories"
      eyebrow="Merchandising"
      title="Categories"
      description="Organize assortments and keep category rules clear for shoppers and staff."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="New category"
      metrics={[
        { label: 'Categories', value: '42', helper: '8 featured groups' },
        { label: 'Unassigned', value: '16', helper: 'Products need mapping' },
        { label: 'Rule updates', value: '5', helper: 'Scheduled tonight' },
      ]}
      rows={[
        { title: 'Warehouse Supplies', detail: 'Add reorder-focused category rules.', status: 'Open' },
        { title: 'Scanning Equipment', detail: 'Featured tile copy is ready.', status: 'Ready' },
        { title: 'Packing Essentials', detail: 'Review child category order.', status: 'Review' },
      ]}
    />
  );
}


