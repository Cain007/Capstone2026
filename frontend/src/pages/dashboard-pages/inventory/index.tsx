import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeftRight, Boxes, RefreshCw, SlidersHorizontal, Warehouse } from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import { BentoCard } from '../../../components/layout/BentoCard';
import { BentoGrid } from '../../../components/layout/BentoGrid';
import { MetricCard } from '../../../components/layout/MetricCard';
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import { statusBadgeVariant, statusLabel } from '../../../utils/status';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type StockHealth = 'OUT_OF_STOCK' | 'CRITICAL' | 'LOW' | 'HEALTHY' | 'UNCONFIGURED';

type InventoryRecord = {
  productId: string;
  sku: string;
  name: string;
  status: string;
  unitType: string;
  category: { id: string; name: string };
  currentQuantity: number;
  reorderPoint: number | null;
  stockHealth: StockHealth;
  recommendedReorderQuantity: number | null;
  updatedAt: string;
};

type MovementType =
  | 'PURCHASE_RECEIPT'
  | 'SALE_DEDUCTION'
  | 'STOCK_ADJUSTMENT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'DAMAGE'
  | 'LOSS'
  | 'INITIAL_STOCK';

type InventoryMovement = {
  id: string;
  quantityChange: number;
  movementType: MovementType;
  note: string | null;
  createdAt: string;
  performedBy: {
    id: string;
    fullName: string | null;
    username: string | null;
    email: string;
  } | null;
};

type InventoryDetail = InventoryRecord & { movements: InventoryMovement[] };

type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type AdjustmentForm = {
  type: 'STOCK_ADJUSTMENT' | 'INITIAL_STOCK';
  quantityChange: string;
  note: string;
};

type PendingAdjustment = {
  record: InventoryRecord;
  quantityChange: number;
  type: AdjustmentForm['type'];
  note: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const productStatuses = ['ALL', 'DRAFT', 'ACTIVE', 'DISCONTINUED', 'ARCHIVED'] as const;
const stockHealthFilters = [
  'ALL',
  'HEALTHY',
  'LOW',
  'CRITICAL',
  'OUT_OF_STOCK',
  'UNCONFIGURED',
] as const;
const stockHealthLabels: Record<StockHealth, string> = {
  OUT_OF_STOCK: 'Out of Stock',
  CRITICAL: 'Critical',
  LOW: 'Low',
  HEALTHY: 'Healthy',
  UNCONFIGURED: 'Not Configured',
};
const stockHealthVariants: Record<
  StockHealth,
  'neutral' | 'success' | 'warning' | 'danger' | 'info'
> = {
  OUT_OF_STOCK: 'danger',
  CRITICAL: 'danger',
  LOW: 'warning',
  HEALTHY: 'success',
  UNCONFIGURED: 'neutral',
};
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
const emptyAdjustment: AdjustmentForm = {
  type: 'STOCK_ADJUSTMENT',
  quantityChange: '',
  note: '',
};

function authHeaders(json = false): Record<string, string> {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function unitLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 403) return 'You do not have permission to perform this action.';
    if (response.status === 404) return 'Product inventory was not found.';
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

function performer(movement: InventoryMovement) {
  return (
    movement.performedBy?.fullName
    || movement.performedBy?.username
    || movement.performedBy?.email
    || 'System'
  );
}

function formatReorderPoint(value: number | null) {
  return value === null ? '-' : String(value);
}

function reorderPointDetail(value: number | null) {
  return value === null ? 'Not configured' : String(value);
}

function recommendedReorderLabel(record: InventoryRecord) {
  if (record.recommendedReorderQuantity === null) {
    return 'Not configured';
  }

  if (record.recommendedReorderQuantity === 0) {
    return 'No reorder needed';
  }

  return `${record.recommendedReorderQuantity} ${unitLabel(record.unitType)}`;
}

export default function InventoryPage({
  userEmail,
  userRole,
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const canAdjust = userRole === 'Admin';
  const [records, setRecords] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<(typeof productStatuses)[number]>('ALL');
  const [stockFilter, setStockFilter] = useState<(typeof stockHealthFilters)[number]>('ALL');
  const [sort, setSort] = useState('UPDATED');
  const [detail, setDetail] = useState<InventoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [adjustRecord, setAdjustRecord] = useState<InventoryRecord | null>(null);
  const [adjustment, setAdjustment] = useState<AdjustmentForm>(emptyAdjustment);
  const [adjustmentError, setAdjustmentError] = useState('');
  const [pendingAdjustment, setPendingAdjustment] = useState<PendingAdjustment | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadInventory() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/inventory`, { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load inventory. Please try again.'));
      }
      const data = (await response.json()) as { inventory: InventoryRecord[] };
      setRecords(data.inventory);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to load inventory. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(productId: string) {
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/inventory/${productId}`, { headers: authHeaders() });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to load inventory detail.'));
      }
      const data = (await response.json()) as {
        inventory: InventoryRecord;
        movements: InventoryMovement[];
      };
      setDetail({ ...data.inventory, movements: data.movements });
    } catch (requestError) {
      setDetailError(
        requestError instanceof Error ? requestError.message : 'Unable to load inventory detail.',
      );
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadInventory);
  }, []);

  const categories = useMemo(
    () => [...new Map(records.map((record) => [record.category.id, record.category])).values()]
      .sort((left, right) => left.name.localeCompare(right.name)),
    [records],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return [...records]
      .filter((record) => (
        !needle
        || `${record.name} ${record.sku} ${record.category.name}`.toLowerCase().includes(needle)
      )
        && (categoryFilter === 'ALL' || record.category.id === categoryFilter)
        && (statusFilter === 'ALL' || record.status === statusFilter)
        && (stockFilter === 'ALL' || record.stockHealth === stockFilter))
      .sort((left, right) => {
        if (sort === 'NAME') return left.name.localeCompare(right.name);
        if (sort === 'LOW') return left.currentQuantity - right.currentQuantity;
        if (sort === 'HIGH') return right.currentQuantity - left.currentQuantity;
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [categoryFilter, query, records, sort, statusFilter, stockFilter]);

  const summary = useMemo(() => ({
    total: records.length,
    out: records.filter((record) => record.stockHealth === 'OUT_OF_STOCK').length,
    critical: records.filter((record) => record.stockHealth === 'CRITICAL').length,
    low: records.filter((record) => record.stockHealth === 'LOW').length,
    healthy: records.filter((record) => record.stockHealth === 'HEALTHY').length,
    unconfigured: records.filter((record) => record.stockHealth === 'UNCONFIGURED').length,
  }), [records]);

  function openAdjust(record: InventoryRecord) {
    setAdjustRecord(record);
    setAdjustment(emptyAdjustment);
    setAdjustmentError('');
  }

  function submitAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!adjustRecord) return;

    const quantityChange = Number(adjustment.quantityChange);
    if (!Number.isInteger(quantityChange) || quantityChange === 0) {
      setAdjustmentError('Quantity change must be a non-zero integer.');
      return;
    }

    if (adjustment.note.length > 500) {
      setAdjustmentError('Note must be 500 characters or fewer.');
      return;
    }

    const pending = {
      record: adjustRecord,
      quantityChange,
      type: adjustment.type,
      note: adjustment.note.trim(),
    };

    if (quantityChange < 0) {
      setPendingAdjustment(pending);
    } else {
      void performAdjustment(pending);
    }
  }

  async function performAdjustment(pending: PendingAdjustment) {
    setSubmitting(true);
    setAdjustmentError('');
    try {
      const response = await fetch(`${API_URL}/api/inventory/${pending.record.productId}/adjust`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          quantityChange: pending.quantityChange,
          type: pending.type,
          note: pending.note || null,
        }),
      });
      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to update inventory.'));
      }
      setAdjustRecord(null);
      setPendingAdjustment(null);
      setNotice('Inventory updated successfully.');
      await loadInventory();
      if (detail?.productId === pending.record.productId) {
        await loadDetail(pending.record.productId);
      }
    } catch (requestError) {
      const message = requestError instanceof Error
        ? requestError.message
        : 'Unable to update inventory.';
      setPendingAdjustment(null);
      setAdjustmentError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      activePage="Inventory"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--inventory"
    >
      <section className="inventory-page operational-page" aria-label="Inventory workspace">
        <PageHeader
          eyebrow="Stock control"
          title="Inventory"
          description="Monitor current stock levels, health status, and adjustments."
          secondaryActions={(
            <Button variant="secondary" onClick={loadInventory} disabled={loading} iconStart={<RefreshCw />}>
              Refresh
            </Button>
          )}
        />

        {notice ? <Alert variant="success" title="Updated">{notice}</Alert> : null}

        {!loading && !error ? (
          <BentoGrid className="inventory-summary operational-summary" columns={6} gap="standard" aria-label="Inventory summary">
            <MetricCard className="bento-span-2" label="Out of Stock" value={summary.out} tone={summary.out > 0 ? 'danger' : 'success'} icon={<Warehouse />} />
            <MetricCard className="bento-span-2" label="Critical" value={summary.critical} tone={summary.critical > 0 ? 'danger' : 'success'} />
            <MetricCard className="bento-span-2" label="Low" value={summary.low} tone={summary.low > 0 ? 'warning' : 'success'} />
            <MetricCard className="bento-span-2" label="Healthy" value={summary.healthy} tone="success" />
            <MetricCard className="bento-span-2" label="Not Configured" value={summary.unconfigured} />
            <MetricCard className="bento-span-2" label="Total Products" value={summary.total} icon={<Boxes />} />
          </BentoGrid>
        ) : null}

        <BentoCard
          className="inventory-card operational-table-card"
          variant="table"
          padding="standard"
          eyebrow="Current inventory"
          title="Stock Register"
          description={`${filtered.length} of ${records.length} inventory records shown.`}
        >
          <div className="inventory-toolbar operational-toolbar">
            <Input
              label="Search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search inventory..."
            />
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="ALL">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </Select>
            <Select
              label="Product Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(
                event.target.value as (typeof productStatuses)[number],
              )}
            >
              <option value="ALL">All Statuses</option>
              {productStatuses.slice(1).map((status) => (
                <option key={status} value={status}>{statusLabel(status)}</option>
              ))}
            </Select>
            <Select
              label="Stock Health"
              value={stockFilter}
              onChange={(event) => setStockFilter(
                event.target.value as (typeof stockHealthFilters)[number],
              )}
            >
              {stockHealthFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter === 'ALL' ? 'All' : stockHealthLabels[filter]}
                </option>
              ))}
            </Select>
            <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="UPDATED">Recently Updated</option>
              <option value="NAME">Name</option>
              <option value="LOW">Stock: Low to High</option>
              <option value="HIGH">Stock: High to Low</option>
            </Select>
          </div>

          {loading ? (
            <div className="inventory-state operational-state">
              <Spinner size="md" label="Loading inventory" />
              <span>Loading inventory...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="inventory-state operational-state operational-state--block">
              <Alert variant="error" title="Unable to load inventory">{error}</Alert>
              <Button variant="secondary" onClick={loadInventory}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && !records.length ? (
            <EmptyState
              title="No products are currently available in inventory."
              description="Products with stock records will appear here."
            />
          ) : null}

          {!loading && !error && records.length > 0 && !filtered.length ? (
            <EmptyState
              title="No inventory records match your search or filters."
              description="Adjust the search or filters to see more products."
            />
          ) : null}

          {!loading && !error && filtered.length ? (
            <div className="inventory-table-wrap operational-table-wrap">
              <table className="inventory-table operational-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th>Status</th>
                    <th>Current Stock</th>
                    <th>Reorder Point</th>
                    <th>Stock Health</th>
                    <th>Recommended Reorder</th>
                    <th>Updated</th>
                    <th className="operational-actions-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((record) => (
                    <tr key={record.productId}>
                      <td><strong>{record.name}</strong></td>
                      <td>{record.sku}</td>
                      <td>{record.category.name}</td>
                      <td>{unitLabel(record.unitType)}</td>
                      <td>
                        <Badge variant={statusBadgeVariant(record.status)}>
                          {statusLabel(record.status)}
                        </Badge>
                      </td>
                      <td>
                        <strong>{record.currentQuantity} {unitLabel(record.unitType)}</strong>
                      </td>
                      <td>{formatReorderPoint(record.reorderPoint)}</td>
                      <td>
                        <Badge variant={stockHealthVariants[record.stockHealth]}>
                          {stockHealthLabels[record.stockHealth]}
                        </Badge>
                      </td>
                      <td>{recommendedReorderLabel(record)}</td>
                      <td>{formatDate(record.updatedAt)}</td>
                      <td>
                        <div className="inventory-actions operational-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`View ${record.name} inventory`}
                            onClick={() => void loadDetail(record.productId)}
                            iconStart={<ArrowLeftRight />}
                          >
                            View
                          </Button>
                          {canAdjust ? (
                            <Button
                              variant="ghost"
                              aria-label={`Adjust ${record.name} stock`}
                              onClick={() => openAdjust(record)}
                              iconStart={<SlidersHorizontal />}
                            >
                              Adjust Stock
                            </Button>
                          ) : null}
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
        open={detailLoading || Boolean(detailError) || Boolean(detail)}
        title={detail?.name || 'Inventory detail'}
        description={detail ? 'Current stock and recent movement history.' : undefined}
        onClose={() => {
          if (!detailLoading) {
            setDetail(null);
            setDetailError('');
          }
        }}
        width="820px"
      >
        {detailLoading ? (
            <div className="inventory-state operational-state">
            <Spinner size="md" label="Loading inventory detail" />
          </div>
        ) : detailError ? (
          <Alert variant="error" title="Unable to load inventory">{detailError}</Alert>
        ) : detail ? (
            <div className="inventory-detail">
              <h3>Inventory Status</h3>
            <div className="inventory-detail__facts operational-detail-grid">
              <span>SKU<strong>{detail.sku}</strong></span>
              <span>Category<strong>{detail.category.name}</strong></span>
              <span>Status<strong>{statusLabel(detail.status)}</strong></span>
              <span>Unit<strong>{unitLabel(detail.unitType)}</strong></span>
              <span>
                Current Stock
                <strong>{detail.currentQuantity} {unitLabel(detail.unitType)}</strong>
              </span>
              <span>Reorder Point<strong>{reorderPointDetail(detail.reorderPoint)}</strong></span>
              <span>
                Stock Health
                <strong>
                  <Badge variant={stockHealthVariants[detail.stockHealth]}>
                    {stockHealthLabels[detail.stockHealth]}
                  </Badge>
                </strong>
              </span>
              <span>
                Recommended Reorder
                <strong>{recommendedReorderLabel(detail)}</strong>
              </span>
              <span>Last Updated<strong>{formatDate(detail.updatedAt)}</strong></span>
            </div>

            <h3>Recent Inventory Movements</h3>
            {detail.movements.length ? (
              <div className="movement-table-wrap">
                <table className="movement-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Change</th>
                      <th>Performed By</th>
                      <th>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatDate(movement.createdAt)}</td>
                        <td>{movementLabels[movement.movementType]}</td>
                        <td className={
                          movement.quantityChange > 0 ? 'movement-positive' : 'movement-negative'
                        }>
                          {movement.quantityChange > 0 ? '+' : ''}
                          {movement.quantityChange}
                        </td>
                        <td>{performer(movement)}</td>
                        <td>{movement.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No inventory movements have been recorded for this product." />
            )}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(adjustRecord)}
        title="Adjust Stock"
        description="Enter a quantity change, not the final stock balance."
        onClose={() => {
          if (!submitting) setAdjustRecord(null);
        }}
        closeOnBackdrop={!submitting}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setAdjustRecord(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" form="inventory-adjustment-form" loading={submitting}>
              Update Stock
            </Button>
          </>
        )}
      >
        <form id="inventory-adjustment-form" className="inventory-form operational-form" onSubmit={submitAdjustment}>
          {adjustRecord ? (
            <div className="inventory-form__product">
              <span>Product</span>
              <strong>{adjustRecord.name}</strong>
              <small>
                Current stock: {adjustRecord.currentQuantity} {unitLabel(adjustRecord.unitType)}
              </small>
            </div>
          ) : null}

          <Select
            label="Adjustment Type"
            value={adjustment.type}
            onChange={(event) => setAdjustment({
              ...adjustment,
              type: event.target.value as AdjustmentForm['type'],
            })}
          >
            <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
            <option value="INITIAL_STOCK">Initial Stock</option>
          </Select>

          {adjustment.type === 'INITIAL_STOCK' && adjustRecord && adjustRecord.currentQuantity > 0 ? (
            <Alert variant="warning">
              Initial Stock is intended for opening inventory. This will add the entered quantity
              to the current stock.
            </Alert>
          ) : null}

          <Input
            label="Quantity Change"
            type="number"
            step="1"
            value={adjustment.quantityChange}
            onChange={(event) => setAdjustment({
              ...adjustment,
              quantityChange: event.target.value,
            })}
            helperText="Enter a positive number to add stock or a negative number to remove stock."
            required
          />
          <Input
            label="Note"
            value={adjustment.note}
            onChange={(event) => setAdjustment({ ...adjustment, note: event.target.value })}
            helperText="Optional, up to 500 characters."
          />
          {adjustmentError ? (
            <Alert variant="error" title="Unable to update inventory">{adjustmentError}</Alert>
          ) : null}
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingAdjustment)}
        title={`Remove ${Math.abs(pendingAdjustment?.quantityChange ?? 0)} units from ${
          pendingAdjustment?.record.name ?? 'product'
        }?`}
        description={`Current Stock: ${pendingAdjustment?.record.currentQuantity ?? 0}. Resulting Stock: ${
          (pendingAdjustment?.record.currentQuantity ?? 0) + (pendingAdjustment?.quantityChange ?? 0)
        }.`}
        confirmLabel="Remove Stock"
        danger
        pending={submitting}
        onCancel={() => setPendingAdjustment(null)}
        onConfirm={() => {
          if (pendingAdjustment) void performAdjustment(pendingAdjustment);
        }}
      />
    </AppShell>
  );
}
