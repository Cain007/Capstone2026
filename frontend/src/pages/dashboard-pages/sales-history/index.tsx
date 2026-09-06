import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type PaymentMethod = 'CASH' | 'CARD' | 'E_WALLET' | 'BANK_TRANSFER' | 'OTHER';
type SaleStatus = 'COMPLETED' | 'DRAFT' | 'CANCELLED';
type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED';
type Cashier = { id: string; email: string; fullName: string | null; username: string | null } | null;
type SaleSummary = {
  id: string;
  saleNumber: string;
  soldAt: string;
  status: SaleStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  grandTotalCents: number;
  cashReceivedCents: number | null;
  changeDueCents: number | null;
  cashier: Cashier;
  itemCount: number;
  createdAt: string;
};
type SaleItem = {
  id: string;
  productId: string;
  lineNumber: number;
  productNameSnapshot: string;
  skuSnapshot: string;
  unitPriceCents: number;
  quantity: string | number;
  discountCents: number;
  taxCents: number;
  lineTotalCents: number;
};
type SaleDetail = SaleSummary & {
  customerReference: string | null;
  customerName: string | null;
  notes: string | null;
  completedAt: string | null;
  items: SaleItem[];
};
type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type DateFilter = 'ALL' | 'TODAY' | '7DAYS' | '30DAYS';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const moneyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const dateFormatter = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const paymentLabels: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  E_WALLET: 'E-Wallet',
  BANK_TRANSFER: 'Bank Transfer',
  OTHER: 'Other',
};
const paymentMethods: Array<'ALL' | PaymentMethod> = ['ALL', 'CASH', 'CARD', 'E_WALLET', 'BANK_TRANSFER', 'OTHER'];
const statuses: Array<'ALL' | SaleStatus> = ['ALL', 'COMPLETED', 'DRAFT', 'CANCELLED'];

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function money(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function date(value: string) {
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? 'Unavailable' : dateFormatter.format(result);
}

function statusLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function statusVariant(value: SaleStatus | PaymentStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (value === 'COMPLETED' || value === 'PAID') return 'success';
  if (value === 'CANCELLED' || value === 'FAILED') return 'danger';
  if (value === 'DRAFT' || value === 'PENDING') return 'warning';
  return 'neutral';
}

function cashierName(cashier: Cashier) {
  return cashier?.fullName || cashier?.username || cashier?.email || 'Unknown cashier';
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 403) return 'You do not have permission to view sales.';
    if (response.status === 500) return 'Unable to load sales. Please try again.';
    return data.message || 'Unable to load sales.';
  } catch {
    return 'Unable to load sales. Please try again.';
  }
}

export default function SalesHistoryPage({ userEmail, userRole, onLogout, onNavigate }: DashboardPageProps) {
  const isStaff = userRole === 'Staff';
  const [sales, setSales] = useState<SaleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | PaymentMethod>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SaleStatus>('ALL');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [sort, setSort] = useState('NEWEST');
  const [detail, setDetail] = useState<SaleDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [currentTime] = useState(() => Date.now());

  async function loadSales() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/sales`, { headers: authHeaders() });
      if (!response.ok) throw new Error(await readError(response));
      const data = (await response.json()) as { sales: SaleSummary[] };
      setSales(data.sales);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load sales. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSales);
  }, []);

  const filteredSales = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const cutoff = dateFilter === 'TODAY'
      ? new Date(new Date(currentTime).setHours(0, 0, 0, 0))
      : dateFilter === '7DAYS'
        ? new Date(currentTime - 7 * 86400000)
        : dateFilter === '30DAYS'
          ? new Date(currentTime - 30 * 86400000)
          : null;

    return [...sales]
      .filter((sale) => {
        const cashier = sale.cashier ? `${cashierName(sale.cashier)} ${sale.cashier.email}` : '';
        const searchable = `${sale.saleNumber} ${cashier} ${paymentLabels[sale.paymentMethod]}`.toLowerCase();
        return (
          (!needle || searchable.includes(needle)) &&
          (paymentFilter === 'ALL' || sale.paymentMethod === paymentFilter) &&
          (statusFilter === 'ALL' || sale.status === statusFilter) &&
          (!cutoff || new Date(sale.soldAt) >= cutoff)
        );
      })
      .sort((left, right) => {
        if (sort === 'OLDEST') return new Date(left.soldAt).getTime() - new Date(right.soldAt).getTime();
        if (sort === 'HIGH') return right.grandTotalCents - left.grandTotalCents;
        if (sort === 'LOW') return left.grandTotalCents - right.grandTotalCents;
        return new Date(right.soldAt).getTime() - new Date(left.soldAt).getTime();
      });
  }, [currentTime, dateFilter, paymentFilter, query, sales, sort, statusFilter]);

  const totals = useMemo(() => ({
    gross: sales.reduce((total, sale) => total + sale.subtotalCents, 0),
    discounts: sales.reduce((total, sale) => total + sale.discountCents, 0),
    average: sales.length ? Math.round(sales.reduce((total, sale) => total + sale.grandTotalCents, 0) / sales.length) : 0,
  }), [sales]);

  async function openDetail(id: string) {
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/sales/${id}`, { headers: authHeaders() });
      if (!response.ok) throw new Error(response.status === 404 ? 'Sale not found.' : await readError(response));
      const data = (await response.json()) as { sale: SaleDetail };
      setDetail(data.sale);
    } catch (requestError) {
      setDetailError(requestError instanceof Error ? requestError.message : 'Unable to load sale detail.');
    } finally {
      setDetailLoading(false);
    }
  }

  const title = isStaff ? 'My Sales History' : 'Sales History';
  const description = isStaff ? 'Review your completed sales transactions.' : 'Review completed sales transactions across the system.';

  return (
    <AppShell activePage="Sales History" userEmail={userEmail} userRole={userRole} onLogout={onLogout} onNavigate={onNavigate} className="dashboard-page dashboard-page--sales-history">
      <section className="sales-history-page" aria-label={`${title} workspace`}>
        <header className="sales-history-header">
          <div>
            <p className="sales-eyebrow">Sales ledger</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <Button variant="secondary" onClick={loadSales} disabled={loading}>Refresh</Button>
        </header>

        {!loading && !error ? (
          <section className="sales-summary" aria-label="Sales summary">
            {[
              ['Transactions', sales.length],
              ['Gross Sales', money(totals.gross)],
              ['Total Discounts', money(totals.discounts)],
              ['Average Transaction', money(totals.average)],
            ].map(([label, value]) => (
              <article className="sales-summary__card" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </article>
            ))}
          </section>
        ) : null}

        <Card padding="default" className="sales-history-card">
          <div className="sales-toolbar">
            <Input label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search sale number, cashier, or payment" />
            <Select label="Payment" value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value as 'ALL' | PaymentMethod)}>
              {paymentMethods.map((method) => <option value={method} key={method}>{method === 'ALL' ? 'All Payments' : paymentLabels[method]}</option>)}
            </Select>
            <Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | SaleStatus)}>
              {statuses.map((status) => <option value={status} key={status}>{status === 'ALL' ? 'All Statuses' : statusLabel(status)}</option>)}
            </Select>
            <Select label="Date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}>
              <option value="ALL">All Dates</option>
              <option value="TODAY">Today</option>
              <option value="7DAYS">Last 7 Days</option>
              <option value="30DAYS">Last 30 Days</option>
            </Select>
            <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="NEWEST">Newest First</option>
              <option value="OLDEST">Oldest First</option>
              <option value="HIGH">Highest Total</option>
              <option value="LOW">Lowest Total</option>
            </Select>
          </div>

          {loading ? <div className="sales-state"><Spinner size="md" label="Loading sales" /><span>Loading sales...</span></div> : null}
          {error && !loading ? <div className="sales-state"><Alert variant="error" title="Unable to load sales">{error}</Alert><Button variant="secondary" onClick={loadSales}>Retry</Button></div> : null}
          {!loading && !error && !sales.length ? <EmptyState title={isStaff ? 'You have not completed any sales yet.' : 'No sales transactions have been recorded yet.'} description="Completed POS transactions will appear here." /> : null}
          {!loading && !error && sales.length > 0 && !filteredSales.length ? <EmptyState title="No sales match your current filters." description="Adjust the search or filters to see more transactions." /> : null}
          {!loading && !error && filteredSales.length > 0 ? (
            <div className="sales-table-wrap">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Sale Number</th>
                    <th>Date / Time</th>
                    {!isStaff ? <th>Cashier</th> : null}
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Subtotal</th>
                    <th>Discount</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => (
                    <tr key={sale.id}>
                      <td><strong>{sale.saleNumber}</strong></td>
                      <td>{date(sale.soldAt)}</td>
                      {!isStaff ? <td>{cashierName(sale.cashier)}</td> : null}
                      <td>{sale.itemCount}</td>
                      <td>{paymentLabels[sale.paymentMethod]}</td>
                      <td>{money(sale.subtotalCents)}</td>
                      <td>{money(sale.discountCents)}</td>
                      <td><strong>{money(sale.grandTotalCents)}</strong></td>
                      <td><Badge variant={statusVariant(sale.status)}>{statusLabel(sale.status)}</Badge></td>
                      <td><Button variant="ghost" aria-label={`View ${sale.saleNumber}`} onClick={() => openDetail(sale.id)}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </section>

      <Modal
        open={detailLoading || Boolean(detailError) || Boolean(detail)}
        title={detail?.saleNumber || 'Sale detail'}
        description={detail ? `${statusLabel(detail.status)} transaction` : undefined}
        onClose={() => {
          if (!detailLoading) {
            setDetail(null);
            setDetailError('');
          }
        }}
        width="780px"
      >
        {detailLoading ? <div className="sales-state"><Spinner size="md" label="Loading sale detail" /></div> : null}
        {detailError ? <Alert variant="error" title="Unable to load sale">{detailError}</Alert> : null}
        {detail ? (
          <div className="sale-detail">
            <div className="sale-detail__meta">
              <span>Date / Time<strong>{date(detail.soldAt)}</strong></span>
              <span>Cashier<strong>{cashierName(detail.cashier)}</strong></span>
              <span>Payment<strong>{paymentLabels[detail.paymentMethod]} - {statusLabel(detail.paymentStatus)}</strong></span>
              {detail.paymentMethod === 'CASH' && detail.cashReceivedCents !== null && detail.changeDueCents !== null ? (
                <>
                  <span>Cash Received<strong>{money(detail.cashReceivedCents)}</strong></span>
                  <span>Change Due<strong>{money(detail.changeDueCents)}</strong></span>
                </>
              ) : null}
              {detail.customerName ? <span>Customer<strong>{detail.customerName}</strong></span> : null}
            </div>
            {detail.notes ? <p className="sale-detail__notes"><strong>Notes:</strong> {detail.notes}</p> : null}
            <table className="sale-items">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Unit Price</th>
                  <th>Qty</th>
                  <th>Discount</th>
                  <th>Tax</th>
                  <th>Line Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.productNameSnapshot}</td>
                    <td>{item.skuSnapshot}</td>
                    <td>{money(item.unitPriceCents)}</td>
                    <td>{String(item.quantity)}</td>
                    <td>{money(item.discountCents)}</td>
                    <td>{money(item.taxCents)}</td>
                    <td>{money(item.lineTotalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="sale-detail__totals">
              <span>Subtotal<strong>{money(detail.subtotalCents)}</strong></span>
              <span>Discount<strong>-{money(detail.discountCents)}</strong></span>
              <span>Tax<strong>{money(detail.taxCents)}</strong></span>
              <span className="sale-detail__grand-total">Grand Total<strong>{money(detail.grandTotalCents)}</strong></span>
            </div>
          </div>
        ) : null}
      </Modal>
    </AppShell>
  );
}
