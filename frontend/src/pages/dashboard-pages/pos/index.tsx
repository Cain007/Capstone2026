import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  Minus,
  Plus,
  ReceiptText,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import PageHeader from '../../../components/PageHeader';
import ProductImage from '../../../components/product/ProductImage';
import { BentoCard } from '../../../components/layout';
import {
  Alert,
  Button,
  EmptyState,
  Input,
  Select,
  Spinner,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { UserRole } from '../../../types/auth';
import type { Product } from '../../../types/product';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type InventoryRecord = {
  productId: string;
  currentQuantity: number;
  updatedAt: string;
};
type POSProduct = Product & { currentQuantity: number };
type CartItem = { product: POSProduct; quantity: number; unitPriceCents: number };
type PaymentMethod = 'CASH' | 'CARD' | 'E_WALLET' | 'BANK_TRANSFER' | 'OTHER';
type CompletedSale = {
  saleNumber: string;
  grandTotalCents: number;
  cashReceivedCents: number | null;
  changeDueCents: number | null;
  paymentMethod: PaymentMethod;
  items: unknown[];
};
type SaleResponse = { sale: CompletedSale };
type PosPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Cash' },
  { value: 'CARD', label: 'Card' },
  { value: 'E_WALLET', label: 'E-Wallet' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'OTHER', label: 'Other' },
];
const moneyFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function getToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function centsFromPrice(value: string | number): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const cents = Number(`${match[1]}${(match[2] || '').padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function centsFromAmount(value: string): number | null {
  if (!value.trim()) return 0;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(`${match[1]}${(match[2] || '').padEnd(2, '0')}`);
  return Number.isSafeInteger(cents) ? cents : null;
}

function centsFromCashInput(value: string): number | null {
  if (!value.trim()) return null;
  return centsFromAmount(value);
}

function formatMoney(cents: number) {
  return moneyFormatter.format(cents / 100);
}

function unitLabel(value: string) {
  return value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 409) return 'One or more products no longer have enough stock. Inventory has been refreshed.';
    if (response.status === 403) return 'You do not have permission to perform this action.';
    if (response.status === 500) return 'Something went wrong. Please try again.';
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

export default function PosPage({ userEmail, userRole, onLogout, onNavigate }: PosPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState('NAME');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [cashReceived, setCashReceived] = useState('');
  const [discount, setDiscount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [conflictIds, setConflictIds] = useState<string[]>([]);
  const [completedSale, setCompletedSale] = useState<CompletedSale | null>(null);

  async function loadData(): Promise<InventoryRecord[] | null> {
    setLoading(true);
    setError('');
    try {
      const [productsResponse, inventoryResponse] = await Promise.all([
        fetch(`${API_URL}/api/products`, { headers: authHeaders() }),
        fetch(`${API_URL}/api/inventory`, { headers: authHeaders() }),
      ]);
      if (!productsResponse.ok) throw new Error(await readMessage(productsResponse, 'Unable to load products.'));
      if (!inventoryResponse.ok) throw new Error(await readMessage(inventoryResponse, 'Unable to load inventory.'));
      const productData = (await productsResponse.json()) as { products: Product[] };
      const inventoryData = (await inventoryResponse.json()) as { inventory: InventoryRecord[] };
      setProducts(productData.products);
      setInventory(inventoryData.inventory);
      return inventoryData.inventory;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load POS data.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, []);

  const productList = useMemo(() => {
    const stockByProduct = new Map(inventory.map((record) => [record.productId, record.currentQuantity]));
    const result: POSProduct[] = products
      .filter((product) => product.status === 'ACTIVE')
      .map((product) => ({ ...product, currentQuantity: stockByProduct.get(product.id) ?? 0 }));
    const needle = query.trim().toLowerCase();
    return result
      .filter((product) => (
        (!needle || [product.name, product.sku, product.category.name].join(' ').toLowerCase().includes(needle)) &&
        (category === 'ALL' || product.categoryId === category)
      ))
      .sort((left, right) => {
        if (sort === 'PRICE_LOW') return (centsFromPrice(left.price) ?? 0) - (centsFromPrice(right.price) ?? 0);
        if (sort === 'PRICE_HIGH') return (centsFromPrice(right.price) ?? 0) - (centsFromPrice(left.price) ?? 0);
        return left.name.localeCompare(right.name);
      });
  }, [category, inventory, products, query, sort]);

  const categories = useMemo(
    () => [...new Map(products.map((product) => [product.category.id, product.category])).values()]
      .sort((left, right) => left.name.localeCompare(right.name)),
    [products],
  );
  const subtotalCents = cart.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
  const discountCents = centsFromAmount(discount);
  const totalCents = discountCents === null ? subtotalCents : subtotalCents - discountCents;
  const discountInvalid = discountCents === null || discountCents > subtotalCents;
  const cashReceivedCents = paymentMethod === 'CASH' ? centsFromCashInput(cashReceived) : null;
  const cashInvalid = paymentMethod === 'CASH' && cashReceived.trim() !== '' && cashReceivedCents === null;
  const cashMissing = paymentMethod === 'CASH' && cashReceivedCents === null;
  const cashInsufficient = paymentMethod === 'CASH' && cashReceivedCents !== null && cashReceivedCents < totalCents;
  const changeDueCents = paymentMethod === 'CASH' && cashReceivedCents !== null && !cashInsufficient
    ? cashReceivedCents - totalCents
    : null;
  const checkoutBlocked = submitting || discountInvalid || cashInvalid || cashMissing || cashInsufficient;

  function addToCart(product: POSProduct) {
    const price = centsFromPrice(product.price);
    if (price === null || product.currentQuantity < 1) return;
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => (
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.currentQuantity) }
            : item
        ));
      }
      return [...current, { product, quantity: 1, unitPriceCents: price }];
    });
  }

  function changeQuantity(productId: string, delta: number) {
    setCart((current) => current.map((item) => (
      item.product.id === productId
        ? { ...item, quantity: Math.max(1, Math.min(item.quantity + delta, item.product.currentQuantity)) }
        : item
    )));
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }

  function clearSale() {
    setCart([]);
    setDiscount('');
    setCashReceived('');
    setCustomerName('');
    setNotes('');
    setCheckoutError('');
    setConflictIds([]);
  }

  async function completeSale() {
    if (!cart.length || checkoutBlocked) {
      if (paymentMethod === 'CASH' && cashMissing) setCheckoutError('Enter cash received.');
      if (cashInvalid) setCheckoutError('Cash received must be a valid peso amount.');
      if (cashInsufficient) setCheckoutError('Insufficient cash.');
      return;
    }

    setSubmitting(true);
    setCheckoutError('');
    setConflictIds([]);
    try {
      const response = await fetch(`${API_URL}/api/sales`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
          paymentMethod,
          discountCents: discountCents ?? 0,
          taxCents: 0,
          customerName: customerName.trim() || null,
          notes: notes.trim() || null,
          ...(paymentMethod === 'CASH' ? { cashReceivedCents } : {}),
        }),
      });

      if (!response.ok) {
        const message = await readMessage(response, 'Unable to complete sale.');
        if (response.status === 409) {
          const refreshedInventory = await loadData();
          if (refreshedInventory) {
            const refreshedByProduct = new Map(refreshedInventory.map((record) => [record.productId, record.currentQuantity]));
            setCart((current) => current.map((item) => ({
              ...item,
              product: { ...item.product, currentQuantity: refreshedByProduct.get(item.product.id) ?? 0 },
            })));
            setConflictIds(cart
              .filter((item) => (refreshedByProduct.get(item.product.id) ?? 0) < item.quantity)
              .map((item) => item.product.id));
          }
        }
        throw new Error(message);
      }

      const data = (await response.json()) as SaleResponse;
      setCompletedSale(data.sale);
      clearSale();
      await loadData();
    } catch (requestError) {
      setCheckoutError(requestError instanceof Error ? requestError.message : 'Unable to complete sale.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell activePage="POS" userEmail={userEmail} userRole={userRole} onLogout={onLogout} onNavigate={onNavigate} className="dashboard-page dashboard-page--pos">
      <section className="pos-page" aria-label="Point of Sale workspace">
        <PageHeader
          eyebrow={`${userRole || 'Staff'} workspace`}
          title="Point of Sale"
          description="Process customer transactions and update inventory in real time."
        />

        {completedSale ? (
          <div className="pos-success" role="status" aria-live="polite">
            <div className="pos-success__icon" aria-hidden="true"><Check size={20} /></div>
            <div className="pos-success__copy">
              <strong>Sale completed</strong>
              <span>Transaction {completedSale.saleNumber}</span>
            </div>
            <div className="pos-success__amount">
              <span>Total</span>
              <strong>{formatMoney(completedSale.grandTotalCents)}</strong>
            </div>
            <div className="pos-success__details">
              <span>{paymentMethods.find((method) => method.value === completedSale.paymentMethod)?.label}</span>
              {completedSale.paymentMethod === 'CASH' && completedSale.cashReceivedCents !== null && completedSale.changeDueCents !== null ? (
                <span>Received {formatMoney(completedSale.cashReceivedCents)} / Change {formatMoney(completedSale.changeDueCents)}</span>
              ) : null}
            </div>
            <Button variant="secondary" iconStart={<ReceiptText size={16} />} onClick={() => setCompletedSale(null)}>New Sale</Button>
          </div>
        ) : null}

        <div className="pos-layout">
          <BentoCard
            className="pos-browser"
            padding="standard"
            title="Product Browser"
            description={`${productList.length} products available for this sale.`}
          >
            <div className="pos-toolbar">
              <div className="pos-search">
                <Search size={17} aria-hidden="true" />
                <Input className="pos-search__input" label="Search products" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, or category" />
              </div>
              <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="ALL">All Categories</option>
                {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
              <Select label="Sort" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="NAME">Name</option>
                <option value="PRICE_LOW">Price Low to High</option>
                <option value="PRICE_HIGH">Price High to Low</option>
              </Select>
            </div>

            {loading ? <div className="pos-state"><Spinner size="md" label="Loading products" /><span>Loading products and inventory...</span></div> : null}
            {error && !loading ? <div className="pos-state"><Alert variant="error" title="Unable to load POS data">{error}</Alert><Button variant="secondary" onClick={loadData}>Retry</Button></div> : null}
            {!loading && !error && !productList.length ? <EmptyState title={products.length ? 'No products match your search.' : 'No products are available for sale.'} description="Try another search or category filter." /> : null}

            <div className="pos-product-grid">
              {!loading && !error ? productList.map((product) => {
                const inCart = cart.find((item) => item.product.id === product.id)?.quantity ?? 0;
                const out = product.currentQuantity < 1;
                return (
                  <article className={`pos-product${out ? ' is-out-of-stock' : ''}`} key={product.id}>
                    <ProductImage imageUrl={product.imageUrl} name={product.name} size="catalog" />
                    <div className="pos-product__top">
                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.category.name} - {product.sku}</p>
                      </div>
                    </div>
                    <div className="pos-product__details">
                      <strong>{formatMoney(centsFromPrice(product.price) ?? 0)}</strong>
                      <span>{product.currentQuantity} {unitLabel(product.unitType)} available</span>
                    </div>
                    <Button
                      variant={out ? 'secondary' : 'primary'}
                      iconStart={!out ? <Plus size={16} /> : undefined}
                      disabled={out || inCart >= product.currentQuantity}
                      onClick={() => addToCart(product)}
                      aria-label={out ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
                    >
                      {out ? 'Out of Stock' : inCart ? `Add (${inCart} in cart)` : 'Add'}
                    </Button>
                  </article>
                );
              }) : null}
            </div>
          </BentoCard>

          <BentoCard
            className="pos-cart"
            padding="standard"
            eyebrow="Checkout"
            title="Current Sale"
            description={`${cart.length} ${cart.length === 1 ? 'line item' : 'line items'}`}
            action={<ShoppingCart size={20} aria-hidden="true" />}
          >

            {checkoutError ? <Alert variant="error" title="Sale not completed">{checkoutError}</Alert> : null}

            {cart.length ? (
              <div className="pos-cart-lines">
                {cart.map((item) => {
                  const stale = conflictIds.includes(item.product.id) || item.product.currentQuantity < item.quantity;
                  return (
                    <div className={`pos-cart-line${stale ? ' is-stale' : ''}`} key={item.product.id}>
                      <div>
                        <strong>{item.product.name}</strong>
                        <span>{item.product.sku} - {formatMoney(item.unitPriceCents)}</span>
                        {stale ? <small>Only {item.product.currentQuantity} remaining</small> : null}
                      </div>
                      <div className="pos-cart-line__bottom">
                        <div className="pos-quantity" aria-label={`${item.product.name} quantity`}>
                          <Button variant="ghost" aria-label={`Decrease quantity for ${item.product.name}`} onClick={() => changeQuantity(item.product.id, -1)}><Minus size={16} /></Button>
                          <span aria-live="polite">{item.quantity}</span>
                          <Button variant="ghost" aria-label={`Increase quantity for ${item.product.name}`} disabled={item.quantity >= item.product.currentQuantity} onClick={() => changeQuantity(item.product.id, 1)}><Plus size={16} /></Button>
                        </div>
                        <strong>{formatMoney(item.unitPriceCents * item.quantity)}</strong>
                        <Button className="pos-remove" variant="ghost" aria-label={`Remove ${item.product.name} from cart`} onClick={() => removeFromCart(item.product.id)}><Trash2 size={16} /></Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState className="pos-cart-empty" title="No items in the current sale." description="Select a product to begin." />
            )}

            {cart.length ? (
              <div className="pos-checkout">
                <div className="pos-totals" aria-label="Sale totals" aria-live="polite">
                  <span>Subtotal <strong>{formatMoney(subtotalCents)}</strong></span>
                  <span>Discount <strong>-{formatMoney(discountCents ?? 0)}</strong></span>
                  <span className="pos-total">Total <strong>{formatMoney(totalCents)}</strong></span>
                </div>
                <details className="pos-sale-options">
                  <summary>Discount and customer details</summary>
                  <div className="pos-sale-options__fields">
                <Input label="Discount (PHP)" type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder="0.00" error={discountInvalid && discount ? 'Cannot exceed subtotal' : undefined} />
                    <Input label="Customer Name (optional)" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
                    <label className="pos-notes-label" htmlFor="pos-notes">Notes (optional)</label>
                    <textarea id="pos-notes" className="ui-textarea" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </div>
                </details>
                <Select
                  label="Payment method"
                  value={paymentMethod}
                  onChange={(event) => {
                    const nextMethod = event.target.value as PaymentMethod;
                    setPaymentMethod(nextMethod);
                    if (nextMethod !== 'CASH') setCashReceived('');
                    setCheckoutError('');
                  }}
                >
                  {paymentMethods.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}
                </Select>
                {paymentMethod === 'CASH' ? (
                  <Input
                    label="Cash Received (PHP)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashReceived}
                    onChange={(event) => {
                      setCashReceived(event.target.value);
                      setCheckoutError('');
                    }}
                    placeholder="0.00"
                    error={cashInvalid ? 'Enter a valid peso amount.' : cashInsufficient ? 'Insufficient cash.' : undefined}
                  />
                ) : null}
                  {paymentMethod === 'CASH' ? (
                    <div className="pos-totals" aria-label="Cash tender">
                      <span>Cash Received <strong>{cashReceivedCents === null ? '-' : formatMoney(cashReceivedCents)}</strong></span>
                      <span className={`pos-change${changeDueCents !== null ? ' is-ready' : ''}`} aria-live="polite">Change Due <strong>{changeDueCents === null ? '-' : formatMoney(changeDueCents)}</strong></span>
                    </div>
                  ) : null}
                <Button className="pos-complete" iconStart={<Banknote size={18} />} onClick={completeSale} loading={submitting} disabled={checkoutBlocked}>
                  {submitting ? 'Processing Sale...' : 'Complete Sale'}
                </Button>
                <Button variant="secondary" onClick={clearSale} disabled={submitting}>Clear Sale</Button>
              </div>
            ) : null}
          </BentoCard>
        </div>
      </section>
    </AppShell>
  );
}
