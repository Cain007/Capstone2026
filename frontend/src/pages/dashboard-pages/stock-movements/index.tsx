import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Eye, RefreshCw } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { BentoCard } from '../../../components/layout/BentoCard';
import { BentoGrid } from '../../../components/layout/BentoGrid';
import { MetricCard } from '../../../components/layout/MetricCard';
import { Alert, Badge, Button, EmptyState, Input, Modal, Select, Spinner } from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'SALE_DEDUCTION'
  | 'STOCK_ADJUSTMENT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'DAMAGE'
  | 'LOSS'
  | 'INITIAL_STOCK';

type Movement = {
  id: string;
  product: { id: string; sku: string; name: string };
  quantityChange: number;
  movementType: MovementType;
  unitCostCents: number | null;
  note: string | null;
  performedBy: { id: string; fullName: string | null; username: string | null; email: string } | null;
  saleItem: { id: string; sale: { id: string; saleNumber: string } } | null;
  createdAt: string;
};

type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type DateFilter = 'ALL' | 'TODAY' | '7DAYS' | '30DAYS';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const movementTypes: Array<'ALL' | MovementType> = [
  'ALL',
  'INITIAL_STOCK',
  'STOCK_ADJUSTMENT',
  'SALE_DEDUCTION',
  'PURCHASE_RECEIPT',
  'RETURN_IN',
  'RETURN_OUT',
  'DAMAGE',
  'LOSS',
];

const movementLabels: Record<MovementType, string> = {
  INITIAL_STOCK: 'Initial Stock',
  STOCK_ADJUSTMENT: 'Stock Adjustment',
  SALE_DEDUCTION: 'Sale',
  PURCHASE_RECEIPT: 'Purchase Receipt',
  RETURN_IN: 'Return In',
  RETURN_OUT: 'Return Out',
  DAMAGE: 'Damage',
  LOSS: 'Loss',
};

const movementVariant = (type: MovementType) => (
  type === 'SALE_DEDUCTION'
  || type === 'DAMAGE'
  || type === 'LOSS'
  || type === 'RETURN_OUT'
    ? 'danger'
    : 'success'
);

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function performer(value: Movement['performedBy']) {
  return value?.fullName || value?.username || value?.email || 'System';
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 403) return 'You do not have permission to view stock movements.';
    return data.message || 'Unable to load stock movements. Please try again.';
  } catch {
    return 'Unable to load stock movements. Please try again.';
  }
}

export default function StockMovementsPage({
  userEmail,
  userRole,
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | MovementType>('ALL');
  const [direction, setDirection] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [selected, setSelected] = useState<Movement | null>(null);
  const [currentTime] = useState(() => Date.now());

  async function loadMovements() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/inventory/movements`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { movements: Movement[] };
      setMovements(data.movements);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load stock movements. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadMovements);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = dateFilter === 'TODAY'
      ? new Date(new Date(currentTime).setHours(0, 0, 0, 0))
      : dateFilter === '7DAYS'
        ? new Date(currentTime - 7 * 86400000)
        : dateFilter === '30DAYS'
          ? new Date(currentTime - 30 * 86400000)
          : null;

    return movements.filter((movement) => {
      const saleNumber = movement.saleItem?.sale.saleNumber || '';
      const searchable = `${movement.product.name} ${movement.product.sku} ${performer(movement.performedBy)} ${saleNumber} ${movement.note || ''}`.toLowerCase();

      return (
        (!needle || searchable.includes(needle))
        && (typeFilter === 'ALL' || movement.movementType === typeFilter)
        && (direction === 'ALL' || (direction === 'IN' ? movement.quantityChange > 0 : movement.quantityChange < 0))
        && (!cutoff || new Date(movement.createdAt) >= cutoff)
      );
    });
  }, [currentTime, dateFilter, direction, movements, query, typeFilter]);

  const summary = useMemo(() => ({
    total: movements.length,
    added: movements
      .filter((movement) => movement.quantityChange > 0)
      .reduce((total, movement) => total + movement.quantityChange, 0),
    removed: Math.abs(
      movements
        .filter((movement) => movement.quantityChange < 0)
        .reduce((total, movement) => total + movement.quantityChange, 0),
    ),
    sales: movements.filter((movement) => movement.movementType === 'SALE_DEDUCTION').length,
  }), [movements]);

  return (
    <AppShell
      activePage="Stock Movements"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--stock-movements"
    >
      <section className="stock-movements-page operational-page" aria-label="Stock Movements workspace">
        <PageHeader
          eyebrow="Inventory ledger"
          title="Stock Movements"
          description="Review inventory increases and decreases across operations."
          secondaryActions={(
            <Button variant="secondary" onClick={loadMovements} disabled={loading} iconStart={<RefreshCw />}>
              Refresh
            </Button>
          )}
        />

        {!loading && !error ? (
          <BentoGrid className="movement-summary operational-summary" columns={6} gap="standard" aria-label="Movement summary">
            <MetricCard className="bento-span-2" label="Total Movements" value={summary.total} icon={<ArrowLeftRight />} />
            <MetricCard className="bento-span-2" label="Units Added" value={`+${summary.added}`} tone="success" />
            <MetricCard className="bento-span-2" label="Units Removed" value={`-${summary.removed}`} tone={summary.removed > 0 ? 'danger' : 'default'} />
            <MetricCard className="bento-span-2" label="Sale Movements" value={summary.sales} />
          </BentoGrid>
        ) : null}

        <BentoCard
          className="movement-card operational-table-card"
          variant="table"
          padding="standard"
          eyebrow="Movement history"
          title="Inventory Ledger"
          description={`${filtered.length} of ${movements.length} movements shown.`}
        >
          <div className="movement-toolbar operational-toolbar">
            <Input
              label="Search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search product, performer, sale, or note"
            />
            <Select
              label="Movement Type"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'ALL' | MovementType)}
            >
              {movementTypes.map((type) => (
                <option value={type} key={type}>{type === 'ALL' ? 'All Types' : movementLabels[type]}</option>
              ))}
            </Select>
            <Select label="Direction" value={direction} onChange={(event) => setDirection(event.target.value)}>
              <option value="ALL">All Directions</option>
              <option value="IN">Stock In</option>
              <option value="OUT">Stock Out</option>
            </Select>
            <Select label="Date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </Select>
          </div>

          {loading ? (
            <div className="movement-state operational-state" role="status" aria-live="polite">
              <Spinner size="md" label="Loading stock movements" />
              <span>Loading stock movements...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="movement-state operational-state operational-state--block">
              <Alert variant="error" title="Unable to load stock movements">{error}</Alert>
              <Button variant="secondary" onClick={loadMovements}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && !movements.length ? (
            <EmptyState title="No inventory movements have been recorded yet." description="Stock changes will appear here as inventory is updated." />
          ) : null}

          {!loading && !error && movements.length > 0 && !filtered.length ? (
            <EmptyState title="No stock movements match your current filters." description="Adjust the search or filters to see more movements." />
          ) : null}

          {!loading && !error && filtered.length ? (
            <div className="movement-table-wrap operational-table-wrap">
              <table className="movement-ledger operational-table">
                <thead>
                  <tr>
                    <th scope="col">Date / Time</th>
                    <th scope="col">Product</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Type</th>
                    <th scope="col">Quantity</th>
                    <th scope="col">Performed By</th>
                    <th scope="col">Reference</th>
                    <th scope="col">Note</th>
                    <th scope="col" className="operational-actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDate(movement.createdAt)}</td>
                      <td><strong>{movement.product.name}</strong></td>
                      <td>{movement.product.sku}</td>
                      <td><Badge variant={movementVariant(movement.movementType)}>{movementLabels[movement.movementType]}</Badge></td>
                      <td className={movement.quantityChange > 0 ? 'movement-in' : 'movement-out'}>
                        {movement.quantityChange > 0 ? '+' : ''}
                        {movement.quantityChange}
                      </td>
                      <td>{performer(movement.performedBy)}</td>
                      <td>{movement.saleItem?.sale.saleNumber || '-'}</td>
                      <td className="movement-note">{movement.note || '-'}</td>
                      <td>
                        <div className="operational-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`View movement for ${movement.product.name}`}
                            onClick={() => setSelected(movement)}
                            iconStart={<Eye />}
                          >
                            View
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </BentoCard>
      </section>

      <Modal
        open={Boolean(selected)}
        title="Movement Detail"
        description="Historical inventory movement record."
        onClose={() => setSelected(null)}
        width="640px"
      >
        {selected ? (
          <div className="movement-detail operational-detail-grid">
            <span>Product<strong>{selected.product.name}</strong></span>
            <span>SKU<strong>{selected.product.sku}</strong></span>
            <span>Movement Type<strong>{movementLabels[selected.movementType]}</strong></span>
            <span>
              Quantity Change
              <strong className={selected.quantityChange > 0 ? 'movement-in' : 'movement-out'}>
                {selected.quantityChange > 0 ? '+' : ''}
                {selected.quantityChange}
              </strong>
            </span>
            <span>Date<strong>{formatDate(selected.createdAt)}</strong></span>
            <span>Performed By<strong>{performer(selected.performedBy)}</strong></span>
            <span>Sale Reference<strong>{selected.saleItem?.sale.saleNumber || '-'}</strong></span>
            <span className="movement-detail__wide">Note<strong>{selected.note || '-'}</strong></span>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
