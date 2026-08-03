import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

export default function ProductsPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  return (
    <DashboardPageShell
      activePage="Products"
      eyebrow="Catalog control"
      title="Products"
      description="Manage product details, prices, barcodes, and channel readiness."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Add product"
      metrics={[
        { label: 'Active SKUs', value: '1,284', helper: '96 updated today' },
        { label: 'Drafts', value: '27', helper: 'Awaiting images' },
        { label: 'Price alerts', value: '9', helper: 'Needs margin check' },
      ]}
      rows={[
        { title: 'Wireless Scanner Pro', detail: 'Price update queued for review.', status: 'Pricing' },
        { title: 'Eco Shipping Labels', detail: 'New product copy is incomplete.', status: 'Draft' },
        { title: 'Barcode Roll Pack', detail: 'Images approved for all channels.', status: 'Ready' },
      ]}
    />
  );
}


