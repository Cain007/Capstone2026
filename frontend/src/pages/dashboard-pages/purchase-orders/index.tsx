import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Eye, Trash2 } from 'lucide-react';
import { BentoCard, MetricCard } from '../../../components/layout';
import PageHeader from '../../../components/PageHeader';
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
  Textarea,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { Product } from '../../../types/product';
import type { UserRole } from '../../../types/auth';
import type {
  ProductOption,
  PurchaseOrderCreateRequest,
  PurchaseOrderDetail,
  PurchaseOrderPrefill,
  PurchaseOrderReceiveRequest,
  PurchaseOrderStatus,
  PurchaseOrderSummary,
  SupplierOption,
} from '../../../types/purchase-order';
import type { Supplier } from '../../../types/supplier';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  userRole?: UserRole;
  purchaseOrderPrefill?: PurchaseOrderPrefill | null;
  onPurchaseOrderPrefillConsumed?: () => void;
};

type StatusFilter = 'ALL' | PurchaseOrderStatus;
type SortMode = 'NEWEST' | 'OLDEST' | 'HIGHEST_VALUE' | 'LOWEST_VALUE';
type CreateStatus = 'DRAFT' | 'ORDERED';

type CreateLine = {
  id: string;
  productId: string;
  quantityOrdered: string;
  unitCost: string;
};

type ReceiveLine = {
  purchaseOrderItemId: string;
  quantityReceived: string;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PO_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
];
const RECEIVABLE_STATUSES = new Set<PurchaseOrderStatus>(['ORDERED', 'PARTIALLY_RECEIVED']);

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const dateFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
});

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(json = false): Record<string, string> {
  const token = getAuthToken();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

function statusLabel(status: PurchaseOrderStatus) {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'ORDERED':
      return 'Ordered';
    case 'PARTIALLY_RECEIVED':
      return 'Partially Received';
    case 'RECEIVED':
      return 'Received';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

function statusVariant(status: PurchaseOrderStatus) {
  switch (status) {
    case 'DRAFT':
      return 'neutral';
    case 'ORDERED':
      return 'info';
    case 'PARTIALLY_RECEIVED':
      return 'warning';
    case 'RECEIVED':
      return 'success';
    case 'CANCELLED':
      return 'neutral';
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : dateFormatter.format(date);
}

function formatMoney(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function userLabel(user: { email: string; fullName: string | null; username: string | null } | null) {
  if (!user) return '-';
  return user.fullName || user.username || user.email;
}

function pesoInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [pesos, centavos = ''] = trimmed.split('.');
  const cents = Number(pesos) * 100 + Number(centavos.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

function centsToPesoInput(value: string | number | null): string {
  if (value === null || value === '') return '0.00';
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return '0.00';
  return numeric.toFixed(2);
}

function lineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newLine(products: ProductOption[], selectedProductIds: Set<string>): CreateLine {
  const product = products.find((option) => !selectedProductIds.has(option.id));
  return {
    id: lineId(),
    productId: product?.id ?? '',
    quantityOrdered: '1',
    unitCost: centsToPesoInput(product?.cost ?? null),
  };
}

export default function PurchaseOrdersPage({
  userEmail,
  userRole = 'Admin',
  onLogout,
  onNavigate,
  purchaseOrderPrefill,
  onPurchaseOrderPrefillConsumed,
}: DashboardPageProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderSummary[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('NEWEST');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<CreateStatus>('DRAFT');
  const [createSupplierId, setCreateSupplierId] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [createNotes, setCreateNotes] = useState('');
  const [createLines, setCreateLines] = useState<CreateLine[]>([]);
  const [prefillNotice, setPrefillNotice] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([]);
  const [receiveNote, setReceiveNote] = useState('');
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [orderConfirm, setOrderConfirm] = useState<PurchaseOrderSummary | PurchaseOrderDetail | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);

  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.status === 'ACTIVE'),
    [suppliers],
  );

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === 'ACTIVE'),
    [products],
  );

  async function loadPurchaseOrders() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/purchase-orders`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to load purchase orders.'));
      const data = (await response.json()) as { purchaseOrders?: PurchaseOrderSummary[] };
      setPurchaseOrders(data.purchaseOrders ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load purchase orders.');
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    setOptionsLoading(true);
    try {
      const [supplierResponse, productResponse] = await Promise.all([
        fetch(`${API_URL}/api/suppliers`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/products`, { headers: authHeaders() }),
      ]);
      if (!supplierResponse.ok) throw new Error(await readMessage(supplierResponse, 'Unable to load suppliers.'));
      if (!productResponse.ok) throw new Error(await readMessage(productResponse, 'Unable to load products.'));
      const supplierData = (await supplierResponse.json()) as { suppliers?: Supplier[] };
      const productData = (await productResponse.json()) as { products?: Product[] };
      setSuppliers((supplierData.suppliers ?? []).map((supplier) => ({
        id: supplier.id,
        supplierCode: supplier.supplierCode,
        name: supplier.name,
        status: supplier.status,
      })));
      setProducts((productData.products ?? []).map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.name,
        status: product.status,
        cost: product.cost,
      })));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load procurement options.');
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([loadPurchaseOrders(), loadOptions()]));
  }, []);

  useEffect(() => {
    if (!purchaseOrderPrefill || optionsLoading) return;

    void Promise.resolve().then(() => {
      const product = activeProducts.find((option) => option.id === purchaseOrderPrefill.productId);
      if (!product || purchaseOrderPrefill.quantityOrdered <= 0) {
        onPurchaseOrderPrefillConsumed?.();
        return;
      }

      setNotice(null);
      setCreateSupplierId('');
      setCreateStatus('DRAFT');
      setExpectedDeliveryDate('');
      setCreateNotes('');
      setCreateLines([{
        id: lineId(),
        productId: product.id,
        quantityOrdered: String(purchaseOrderPrefill.quantityOrdered),
        unitCost: centsToPesoInput(product.cost),
      }]);
      setFormError(null);
      setPrefillNotice(true);
      setCreateOpen(true);
      onPurchaseOrderPrefillConsumed?.();
    });
  }, [activeProducts, onPurchaseOrderPrefillConsumed, optionsLoading, purchaseOrderPrefill]);

  const summary = useMemo(
    () => ({
      total: purchaseOrders.length,
      draft: purchaseOrders.filter((order) => order.status === 'DRAFT').length,
      open: purchaseOrders.filter((order) => RECEIVABLE_STATUSES.has(order.status)).length,
      received: purchaseOrders.filter((order) => order.status === 'RECEIVED').length,
    }),
    [purchaseOrders],
  );

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const rows = purchaseOrders.filter((order) => {
      const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;
      const matchesSupplier = supplierFilter === 'ALL' || order.supplier.id === supplierFilter;
      const searchable = [
        order.poNumber,
        order.supplier.name,
        order.supplier.supplierCode,
        userLabel(order.createdBy),
      ].join(' ').toLowerCase();
      return matchesStatus && matchesSupplier && (!query || searchable.includes(query));
    });

    return [...rows].sort((first, second) => {
      switch (sortMode) {
        case 'OLDEST':
          return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
        case 'HIGHEST_VALUE':
          return second.subtotalCents - first.subtotalCents;
        case 'LOWEST_VALUE':
          return first.subtotalCents - second.subtotalCents;
        case 'NEWEST':
        default:
          return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
      }
    });
  }, [purchaseOrders, searchQuery, sortMode, statusFilter, supplierFilter]);

  const selectedProductIds = useMemo(
    () => new Set(createLines.map((line) => line.productId).filter(Boolean)),
    [createLines],
  );

  const estimatedSubtotal = useMemo(
    () => createLines.reduce((sum, line) => {
      const quantity = Number(line.quantityOrdered);
      const cents = pesoInputToCents(line.unitCost);
      if (!Number.isInteger(quantity) || quantity <= 0 || cents === null) return sum;
      return sum + quantity * cents;
    }, 0),
    [createLines],
  );

  function resetCreateForm() {
    setCreateStatus('DRAFT');
    setCreateSupplierId('');
    setExpectedDeliveryDate('');
    setCreateNotes('');
    setCreateLines([newLine(activeProducts, new Set())]);
    setPrefillNotice(false);
    setFormError(null);
    setSubmitting(false);
  }

  function openCreateModal() {
    setNotice(null);
    setCreateSupplierId('');
    setCreateLines([newLine(activeProducts, new Set())]);
    setExpectedDeliveryDate('');
    setCreateNotes('');
    setCreateStatus('DRAFT');
    setFormError(null);
    setPrefillNotice(false);
    setCreateOpen(true);
  }

  function updateCreateLine(id: string, field: keyof Omit<CreateLine, 'id'>, value: string) {
    setFormError(null);
    setCreateLines((lines) =>
      lines.map((line) => {
        if (line.id !== id) return line;
        if (field === 'productId') {
          const product = activeProducts.find((option) => option.id === value);
          return { ...line, productId: value, unitCost: centsToPesoInput(product?.cost ?? line.unitCost) };
        }
        return { ...line, [field]: value };
      }),
    );
  }

  function addCreateLine() {
    setCreateLines((lines) => [...lines, newLine(activeProducts, new Set(lines.map((line) => line.productId)))]);
  }

  function removeCreateLine(id: string) {
    setCreateLines((lines) => lines.filter((line) => line.id !== id));
  }

  function validateCreateRequest(): PurchaseOrderCreateRequest | null {
    if (!createSupplierId) {
      setFormError('Choose an active supplier.');
      return null;
    }

    if (createLines.length === 0) {
      setFormError('Add at least one product line.');
      return null;
    }

    const productIds = new Set<string>();
    const items: PurchaseOrderCreateRequest['items'] = [];

    for (const line of createLines) {
      if (!line.productId) {
        setFormError('Choose a product for every line.');
        return null;
      }
      if (productIds.has(line.productId)) {
        setFormError('Duplicate products are not allowed in a purchase order.');
        return null;
      }
      productIds.add(line.productId);

      const quantity = Number(line.quantityOrdered);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setFormError('Quantity ordered must be a positive integer.');
        return null;
      }

      const unitCostCents = pesoInputToCents(line.unitCost);
      if (unitCostCents === null) {
        setFormError('Unit cost must be a valid peso amount with up to two decimals.');
        return null;
      }

      items.push({ productId: line.productId, quantityOrdered: quantity, unitCostCents });
    }

    return {
      supplierId: createSupplierId,
      status: createStatus,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: createNotes.trim() || undefined,
      items,
    };
  }

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    const requestBody = validateCreateRequest();
    if (!requestBody) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await fetch(`${API_URL}/api/purchase-orders`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to create purchase order.'));
      const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
      setCreateOpen(false);
      resetCreateForm();
      await loadPurchaseOrders();
      setNotice(`Purchase Order ${data.purchaseOrder.poNumber} created successfully.`);
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : 'Unable to create purchase order.');
    } finally {
      setSubmitting(false);
    }
  }

  async function openDetail(orderId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/purchase-orders/${orderId}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to load purchase order.'));
      const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
      setDetail(data.purchaseOrder);
      setDetailOpen(true);
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load purchase order.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail(orderId: string) {
    const response = await fetch(`${API_URL}/api/purchase-orders/${orderId}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error(await readMessage(response, 'Unable to refresh purchase order.'));
    const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
    setDetail(data.purchaseOrder);
  }

  async function markAsOrdered() {
    if (!orderConfirm || ordering) return;

    setOrdering(true);
    setOrderError(null);
    setNotice(null);

    try {
      const response = await fetch(`${API_URL}/api/purchase-orders/${orderConfirm.id}/order`, {
        method: 'POST',
        headers: authHeaders(),
      });
      if (!response.ok) {
        const message = response.status === 409
          ? 'This purchase order is no longer in Draft status.'
          : await readMessage(response, 'Unable to mark purchase order as ordered.');

        await loadPurchaseOrders();
        if (detail?.id === orderConfirm.id) {
          try {
            await refreshDetail(orderConfirm.id);
          } catch {
            setDetail(null);
            setDetailOpen(false);
          }
        }

        throw new Error(message);
      }

      const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
      await loadPurchaseOrders();
      if (detail?.id === data.purchaseOrder.id) {
        setDetail(data.purchaseOrder);
      }
      setOrderConfirm(null);
      setNotice(`${data.purchaseOrder.poNumber} marked as ordered.`);
    } catch (requestError) {
      setOrderError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to mark purchase order as ordered.',
      );
    } finally {
      setOrdering(false);
    }
  }

  async function openReceiveFromSummary(orderId: string) {
    setDetailLoading(true);
    setDetailError(null);
    setNotice(null);
    try {
      const response = await fetch(`${API_URL}/api/purchase-orders/${orderId}`, {
        headers: authHeaders(),
      });
      if (!response.ok) throw new Error(await readMessage(response, 'Unable to load purchase order.'));
      const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
      setDetail(data.purchaseOrder);
      setDetailOpen(false);
      openReceiveModal(data.purchaseOrder);
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load purchase order.');
    } finally {
      setDetailLoading(false);
    }
  }

  function openReceiveModal(order: PurchaseOrderDetail) {
    setDetailOpen(false);
    setReceiveError(null);
    setReceiveNote('');
    setReceiveLines(
      order.items
        .filter((item) => item.remainingQuantity > 0)
        .map((item) => ({ purchaseOrderItemId: item.id, quantityReceived: '' })),
    );
    setReceiveOpen(true);
  }

  function updateReceiveLine(purchaseOrderItemId: string, quantityReceived: string) {
    setReceiveError(null);
    setReceiveLines((lines) =>
      lines.map((line) =>
        line.purchaseOrderItemId === purchaseOrderItemId ? { ...line, quantityReceived } : line,
      ),
    );
  }

  function validateReceiveRequest(order: PurchaseOrderDetail): PurchaseOrderReceiveRequest | null {
    const items: PurchaseOrderReceiveRequest['items'] = [];
    const itemMap = new Map(order.items.map((item) => [item.id, item]));

    for (const line of receiveLines) {
      if (!line.quantityReceived.trim()) continue;
      const quantity = Number(line.quantityReceived);
      const item = itemMap.get(line.purchaseOrderItemId);
      if (!item) {
        setReceiveError('A purchase order item could not be matched.');
        return null;
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        setReceiveError('Receive quantities must be whole numbers.');
        return null;
      }
      if (quantity === 0) continue;
      if (quantity > item.remainingQuantity) {
        setReceiveError('Received quantity exceeds the remaining ordered quantity.');
        return null;
      }
      items.push({ purchaseOrderItemId: line.purchaseOrderItemId, quantityReceived: quantity });
    }

    if (items.length === 0) {
      setReceiveError('Enter a receive quantity for at least one line.');
      return null;
    }

    return { items, note: receiveNote.trim() || undefined };
  }

  async function submitReceive(event: FormEvent) {
    event.preventDefault();
    if (!detail) return;
    const requestBody = validateReceiveRequest(detail);
    if (!requestBody) return;

    setReceiving(true);
    setReceiveError(null);
    try {
      const response = await fetch(`${API_URL}/api/purchase-orders/${detail.id}/receive`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const message = await readMessage(response, 'Unable to receive purchase order.');
        if (response.status === 409) {
          await refreshDetail(detail.id);
        }
        throw new Error(message);
      }
      const data = (await response.json()) as { purchaseOrder: PurchaseOrderDetail };
      setDetail(data.purchaseOrder);
      setReceiveOpen(false);
      setReceiveLines([]);
      setReceiveNote('');
      await loadPurchaseOrders();
      setNotice('Inventory receipt recorded successfully.');
    } catch (requestError) {
      setReceiveError(requestError instanceof Error ? requestError.message : 'Unable to receive purchase order.');
    } finally {
      setReceiving(false);
    }
  }

  const noActiveOptions = activeSuppliers.length === 0 || activeProducts.length === 0;
  const canAddLine = activeProducts.length > selectedProductIds.size;

  return (
    <AppShell
      activePage="Purchase Orders"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--purchase-orders"
    >
      <section className="purchase-orders-page operational-page" aria-label="Purchase Orders workspace">
        <PageHeader
          eyebrow="Procurement"
          title="Purchase Orders"
          description="Create, review, order, and receive supplier purchase orders."
          secondaryActions={<Button iconStart={<Plus size={16} />} onClick={openCreateModal}>New Purchase Order</Button>}
        />

        {notice ? (
          <Alert variant="success" title="Success">
            {notice}
          </Alert>
        ) : null}

        <section className="purchase-order-summary" aria-label="Purchase order summary">
          <MetricCard label="Total Purchase Orders" value={summary.total} />
          <MetricCard label="Draft" value={summary.draft} tone="default" />
          <MetricCard label="Open Orders" value={summary.open} tone="warning" />
          <MetricCard label="Received" value={summary.received} tone="success" />
        </section>

        <BentoCard padding="standard" variant="table" title="Purchase Order Register" className="purchase-order-card operational-table-card">
          <div className="purchase-order-toolbar operational-toolbar">
            <Input
              label="Search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search PO number, supplier, or creator"
            />
            <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="ALL">All Statuses</option>
              {PO_STATUSES.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
            <Select label="Supplier" value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)}>
              <option value="ALL">All Suppliers</option>
              {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </Select>
            <Select label="Sort" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="NEWEST">Newest</option>
              <option value="OLDEST">Oldest</option>
              <option value="HIGHEST_VALUE">Highest Value</option>
              <option value="LOWEST_VALUE">Lowest Value</option>
            </Select>
          </div>

          {loading || optionsLoading ? (
            <div className="purchase-order-state" role="status" aria-live="polite">
              <Spinner size="md" label="Loading purchase orders" />
              <span>Loading purchase orders...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="purchase-order-state">
              <Alert variant="error" title="Unable to load procurement data">{error}</Alert>
              <Button variant="secondary" onClick={() => void Promise.all([loadPurchaseOrders(), loadOptions()])}>Retry</Button>
            </div>
          ) : null}

          {!loading && !error && purchaseOrders.length === 0 ? (
            <EmptyState
              title="No purchase orders have been created yet."
              description="Create an ordered PO when purchased inventory needs to be received."
              action={<Button onClick={openCreateModal}>Create Purchase Order</Button>}
            />
          ) : null}

          {!loading && !error && purchaseOrders.length > 0 && filteredOrders.length === 0 ? (
            <EmptyState title="No purchase orders match your filters." description="Adjust search, status, supplier, or sorting options." />
          ) : null}

          {!loading && !error && filteredOrders.length > 0 ? (
            <div className="purchase-order-table-wrap operational-table-wrap">
              <table className="purchase-order-table operational-table">
                <thead>
                  <tr>
                    <th scope="col">PO Number</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Status</th>
                    <th scope="col">Items</th>
                    <th scope="col">Subtotal</th>
                    <th scope="col">Ordered</th>
                    <th scope="col">Expected Delivery</th>
                    <th scope="col">Created</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td><strong className="purchase-order-number">{order.poNumber}</strong></td>
                      <td><div className="purchase-order-supplier"><strong>{order.supplier.name}</strong><span>{order.supplier.supplierCode}</span></div></td>
                      <td><Badge variant={statusVariant(order.status)}>{statusLabel(order.status)}</Badge></td>
                      <td>{order.itemCount}</td>
                      <td>{formatMoney(order.subtotalCents)}</td>
                      <td>{formatDate(order.orderedAt)}</td>
                      <td>{formatDate(order.expectedDeliveryDate)}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
                        <div className="purchase-order-actions">
                          <Button variant="ghost" iconStart={<Eye size={15} />} onClick={() => void openDetail(order.id)}>View</Button>
                          {order.status === 'DRAFT' ? (
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setOrderError(null);
                                setOrderConfirm(order);
                              }}
                              disabled={ordering}
                            >
                              Mark as Ordered
                            </Button>
                          ) : null}
                          {RECEIVABLE_STATUSES.has(order.status) ? (
                            <Button
                              variant="secondary"
                              onClick={() => void openReceiveFromSummary(order.id)}
                              disabled={ordering}
                            >
                              Receive
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

        <Modal
          open={createOpen}
          title="Create Purchase Order"
          description="Create a supplier order as Draft or Ordered. Ordered POs can be received later."
          onClose={() => {
            if (!submitting) {
              setCreateOpen(false);
              setPrefillNotice(false);
            }
          }}
          closeOnBackdrop={!submitting}
          width="960px"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreateOpen(false);
                  setPrefillNotice(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" form="purchase-order-create-form" loading={submitting}>Create Purchase Order</Button>
            </>
          }
        >
          <form id="purchase-order-create-form" className="purchase-order-form operational-form" onSubmit={submitCreate}>
            {noActiveOptions ? (
              <Alert variant="warning" title="Procurement options unavailable">
                Active suppliers and active products are required before purchase orders can be created.
              </Alert>
            ) : null}
            {prefillNotice ? (
              <Alert variant="info" title="Predictive recommendation applied">
                Product and quantity were prefilled from the latest predictive inventory recommendation.
                Review all details before creating the purchase order.
              </Alert>
            ) : null}
            <div className="purchase-order-form-grid">
              <Select label="Supplier" value={createSupplierId} onChange={(event) => setCreateSupplierId(event.target.value)} required disabled={noActiveOptions}>
                <option value="">Select supplier</option>
                {activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} - {supplier.supplierCode}</option>)}
              </Select>
              <Select label="Status" value={createStatus} onChange={(event) => setCreateStatus(event.target.value as CreateStatus)}>
                <option value="DRAFT">Draft</option>
                <option value="ORDERED">Ordered</option>
              </Select>
              <Input label="Expected Delivery Date" type="date" value={expectedDeliveryDate} onChange={(event) => setExpectedDeliveryDate(event.target.value)} />
            </div>
            <Textarea label="Notes" rows={2} value={createNotes} onChange={(event) => setCreateNotes(event.target.value)} placeholder="Optional purchasing note" />

            <div className="purchase-order-lines-head">
              <h3>Purchase Order Items</h3>
              <Button variant="secondary" onClick={addCreateLine} disabled={!canAddLine || noActiveOptions}>Add Product</Button>
            </div>
            <div className="purchase-order-lines">
              {createLines.map((line, index) => {
                const quantity = Number(line.quantityOrdered);
                const unitCostCents = pesoInputToCents(line.unitCost) ?? 0;
                const lineTotal = Number.isInteger(quantity) && quantity > 0 ? quantity * unitCostCents : 0;
                const selectedIdsExceptCurrent = new Set(createLines.filter((current) => current.id !== line.id).map((current) => current.productId));
                return (
                  <div className="purchase-order-line" key={line.id}>
                    <Select label={`Product ${index + 1}`} value={line.productId} onChange={(event) => updateCreateLine(line.id, 'productId', event.target.value)} required>
                      <option value="">Select product</option>
                      {activeProducts.map((product) => (
                        <option key={product.id} value={product.id} disabled={selectedIdsExceptCurrent.has(product.id)}>
                          {product.name} - {product.sku}
                        </option>
                      ))}
                    </Select>
                    <Input label="Quantity Ordered" type="number" min="1" step="1" value={line.quantityOrdered} onChange={(event) => updateCreateLine(line.id, 'quantityOrdered', event.target.value)} required />
                    <Input label="Unit Cost" type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateCreateLine(line.id, 'unitCost', event.target.value)} required />
                    <div className="purchase-order-line-total"><span>Line Total</span><strong>{formatMoney(lineTotal)}</strong></div>
                    <Button variant="ghost" title="Remove item" aria-label={`Remove item ${index + 1}`} onClick={() => removeCreateLine(line.id)} disabled={createLines.length === 1}><Trash2 size={16} /></Button>
                  </div>
                );
              })}
            </div>
            <div className="purchase-order-subtotal"><span>Estimated Subtotal</span><strong>{formatMoney(estimatedSubtotal)}</strong></div>
            {formError ? <Alert variant="error" title="Unable to create purchase order">{formError}</Alert> : null}
          </form>
        </Modal>

        <Modal
          open={detailOpen || detailLoading || Boolean(detailError)}
          title={detail?.poNumber ?? 'Purchase Order'}
          description="Purchase order detail and receiving status."
          onClose={() => {
            if (!receiving) {
              setDetailOpen(false);
              setDetail(null);
              setDetailError(null);
            }
          }}
          width="960px"
          footer={
            detail ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDetailOpen(false);
                    setDetail(null);
                  }}
                  disabled={receiving}
                >
                  Close
                </Button>
                {detail.status === 'DRAFT' ? (
                  <Button
                    onClick={() => {
                      setOrderError(null);
                      setOrderConfirm(detail);
                    }}
                    disabled={ordering || receiving}
                  >
                    Mark as Ordered
                  </Button>
                ) : null}
                {RECEIVABLE_STATUSES.has(detail.status) ? <Button onClick={() => openReceiveModal(detail)} disabled={receiving || ordering}>Receive Items</Button> : null}
              </>
            ) : undefined
          }
        >
          {detailLoading ? <div className="purchase-order-state"><Spinner size="md" label="Loading purchase order" /><span>Loading purchase order...</span></div> : null}
          {detailError ? <Alert variant="error" title="Unable to load purchase order">{detailError}</Alert> : null}
          {detail ? (
            <div className="purchase-order-detail">
              <div className="purchase-order-detail-grid">
                <div><span>Supplier</span><strong>{detail.supplier.name}</strong></div>
                <div><span>Status</span><strong>{statusLabel(detail.status)}</strong></div>
                <div><span>Subtotal</span><strong>{formatMoney(detail.subtotalCents)}</strong></div>
                <div><span>Ordered Date</span><strong>{formatDate(detail.orderedAt)}</strong></div>
                <div><span>Expected Delivery</span><strong>{formatDate(detail.expectedDeliveryDate)}</strong></div>
                <div><span>Received Date</span><strong>{formatDate(detail.receivedAt)}</strong></div>
                <div><span>Created By</span><strong>{userLabel(detail.createdBy)}</strong></div>
                <div><span>Updated By</span><strong>{userLabel(detail.updatedBy)}</strong></div>
                <div className="purchase-order-detail-wide"><span>Notes</span><strong>{detail.notes || '-'}</strong></div>
              </div>
              <div className="purchase-order-table-wrap operational-table-wrap">
                <table className="purchase-order-table purchase-order-item-table operational-table">
                  <thead>
                    <tr><th>Product</th><th>SKU</th><th>Ordered</th><th>Received</th><th>Remaining</th><th>Unit Cost</th><th>Line Total</th></tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item) => (
                      <tr key={item.id}>
                        <td><strong>{item.productNameSnapshot}</strong></td>
                        <td>{item.skuSnapshot}</td>
                        <td>{item.quantityOrdered}</td>
                        <td>{item.quantityReceived}</td>
                        <td>{item.remainingQuantity}</td>
                        <td>{formatMoney(item.unitCostCents)}</td>
                        <td>{formatMoney(item.lineTotalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={receiveOpen}
          title="Receive Items"
          description={detail ? `Record delivered quantities for ${detail.poNumber}.` : undefined}
          onClose={() => {
            if (!receiving) setReceiveOpen(false);
          }}
          closeOnBackdrop={!receiving}
          width="860px"
          footer={
            <>
              <Button variant="secondary" onClick={() => setReceiveOpen(false)} disabled={receiving}>Cancel</Button>
              <Button type="submit" form="purchase-order-receive-form" loading={receiving}>Record Receipt</Button>
            </>
          }
        >
          {detail ? (
            <form id="purchase-order-receive-form" className="purchase-order-form operational-form" onSubmit={submitReceive}>
              <div className="purchase-order-receive-lines">
                {detail.items.filter((item) => item.remainingQuantity > 0).map((item) => {
                  const line = receiveLines.find((current) => current.purchaseOrderItemId === item.id);
                  return (
                    <div className="purchase-order-receive-line" key={item.id}>
                      <div><span>Product</span><strong>{item.productNameSnapshot}</strong><small>{item.skuSnapshot}</small></div>
                      <div><span>Ordered</span><strong>{item.quantityOrdered}</strong></div>
                      <div><span>Previously Received</span><strong>{item.quantityReceived}</strong></div>
                      <div><span>Remaining</span><strong>{item.remainingQuantity}</strong></div>
                      <Input label="Receive Now" type="number" min="0" step="1" max={item.remainingQuantity} value={line?.quantityReceived ?? ''} onChange={(event) => updateReceiveLine(item.id, event.target.value)} />
                    </div>
                  );
                })}
              </div>
              <Textarea label="Receiving Note" rows={2} value={receiveNote} onChange={(event) => setReceiveNote(event.target.value)} placeholder="Optional note" />
              {receiveError ? <Alert variant="error" title="Unable to record receipt">{receiveError}</Alert> : null}
            </form>
          ) : null}
        </Modal>

        <ConfirmDialog
          open={Boolean(orderConfirm)}
          title="Mark purchase order as ordered?"
          description={
            orderError ||
            `This will move ${orderConfirm?.poNumber ?? 'this purchase order'} from Draft to Ordered and make it eligible for receiving.`
          }
          confirmLabel="Mark as Ordered"
          cancelLabel="Cancel"
          pending={ordering}
          onCancel={() => {
            if (ordering) return;
            setOrderConfirm(null);
            setOrderError(null);
          }}
          onConfirm={markAsOrdered}
        />
      </section>
    </AppShell>
  );
}
