import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function InventoryPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Inventory"
      eyebrow="Stock control"
      title="Inventory"
      description="See available stock, reserved units, and reorder pressure across locations."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Create count"
      metrics={[
        { label: 'Units on hand', value: '38.2K', helper: 'Across 3 sites' },
        { label: 'Reserved', value: '2,418', helper: 'Ready for picking' },
        { label: 'Critical', value: '8', helper: 'Below threshold' },
      ]}
      rows={[
        { title: 'Barcode Rolls', detail: 'Main warehouse has 8 units remaining.', status: 'Critical' },
        { title: 'Shipping Labels', detail: 'Reorder point reached this morning.', status: 'Low' },
        { title: 'Packaging Tape', detail: 'Cycle count variance is resolved.', status: 'Clear' },
      ]}
    />
  );
}


