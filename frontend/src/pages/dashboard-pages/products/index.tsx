import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Boxes, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import ProductImage from '../../../components/product/ProductImage';
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
  Textarea,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { Category } from '../../../types/category';
import type { Product } from '../../../types/product';
import type { UserRole } from '../../../types/auth';
import { statusBadgeVariant, statusLabel } from '../../../utils/status';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type ProductStatus = 'DRAFT' | 'ACTIVE' | 'DISCONTINUED' | 'ARCHIVED';
type ProductUnitType =
  | 'PIECE'
  | 'PACK'
  | 'BOX'
  | 'BOTTLE'
  | 'CARTON'
  | 'GRAM'
  | 'MILLILITER';
type StatusFilter = 'ALL' | ProductStatus;
type SortMode = 'UPDATED_DESC' | 'NAME_ASC' | 'PRICE_ASC' | 'PRICE_DESC';

type ProductFormData = {
  name: string;
  sku: string;
  description: string;
  status: ProductStatus;
  unitType: ProductUnitType;
  price: string;
  cost: string;
  reorderPoint: string;
  categoryId: string;
};

const EMPTY_FORM: ProductFormData = {
  name: '',
  sku: '',
  description: '',
  status: 'DRAFT',
  unitType: 'PIECE',
  price: '',
  cost: '',
  reorderPoint: '',
  categoryId: '',
};

const PRODUCT_STATUSES: ProductStatus[] = [
  'DRAFT',
  'ACTIVE',
  'DISCONTINUED',
  'ARCHIVED',
];

const PRODUCT_UNIT_TYPES: ProductUnitType[] = [
  'PIECE',
  'PACK',
  'BOX',
  'BOTTLE',
  'CARTON',
  'GRAM',
  'MILLILITER',
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
});

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable';
  }

  return dateFormatter.format(date);
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatCurrency(value: string | number | null | undefined): string {
  const numericValue = toNumber(value);
  return numericValue === null ? '-' : currencyFormatter.format(numericValue);
}

function formatReorderPoint(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : String(value);
}

function formatUnit(unitType: string): string {
  return unitType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

export default function ProductsPage({ userEmail, userRole, onLogout, onNavigate }: DashboardPageProps) {
  const canManage = userRole === 'Admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('UPDATED_DESC');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [removeImageConfirm, setRemoveImageConfirm] = useState(false);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const busy = submitting || imageBusy;
  const [imageInputKey, setImageInputKey] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/products`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error('Unable to load products.');
      }
      const data = (await response.json()) as { products?: Product[] };
      setProducts(data.products ?? []);
    } catch {
      setError('Unable to load products.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const response = await fetch(`${API_URL}/api/categories`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error('Unable to load categories.');
      }
      const data = (await response.json()) as { categories?: Category[] };
      setCategories(data.categories ?? []);
    } catch {
      setCategoriesError('Unable to load categories.');
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      loadProducts();
      loadCategories();
    });
  }, []);

  useEffect(
    () => () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    },
    [imagePreview],
  );

  const summary = useMemo(
    () => ({
      total: products.length,
      active: products.filter((product) => product.status === 'ACTIVE').length,
      draft: products.filter((product) => product.status === 'DRAFT').length,
      inactive: products.filter(
        (product) =>
          product.status === 'ARCHIVED' || product.status === 'DISCONTINUED',
      ).length,
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory =
        categoryFilter === 'ALL' || product.categoryId === categoryFilter;
      const matchesStatus =
        statusFilter === 'ALL' || product.status === statusFilter;
      const searchableText = [
        product.name,
        product.sku,
        product.slug,
        product.description ?? '',
        product.category?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return (
        matchesCategory &&
        matchesStatus &&
        (!query || searchableText.includes(query))
      );
    });

    return [...filtered].sort((firstProduct, secondProduct) => {
      switch (sortMode) {
        case 'NAME_ASC':
          return firstProduct.name.localeCompare(secondProduct.name);
        case 'PRICE_ASC':
          return (
            (toNumber(firstProduct.price) ?? 0) -
            (toNumber(secondProduct.price) ?? 0)
          );
        case 'PRICE_DESC':
          return (
            (toNumber(secondProduct.price) ?? 0) -
            (toNumber(firstProduct.price) ?? 0)
          );
        case 'UPDATED_DESC':
        default:
          return (
            new Date(secondProduct.updatedAt).getTime() -
            new Date(firstProduct.updatedAt).getTime()
          );
      }
    });
  }, [categoryFilter, products, searchQuery, sortMode, statusFilter]);

  function clearFilters() {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setSortMode('UPDATED_DESC');
  }

  function revokePreview() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
  }

  function openCreateModal() {
    setImageFile(null);
    setImageError(null);
    setImageWarning(null);
    revokePreview();
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setImagePreview(null);
    setFormError(null);
    setSuccessMessage(null);
    setImageInputKey((current) => current + 1);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setImageFile(null);
    setImageError(null);
    setImageWarning(null);
    revokePreview();
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description ?? '',
      status: PRODUCT_STATUSES.includes(product.status as ProductStatus)
        ? (product.status as ProductStatus)
        : 'DRAFT',
      unitType: PRODUCT_UNIT_TYPES.includes(product.unitType as ProductUnitType)
        ? (product.unitType as ProductUnitType)
        : 'PIECE',
      price: product.price == null ? '' : String(product.price),
      cost: product.cost == null ? '' : String(product.cost),
      reorderPoint: product.reorderPoint == null ? '' : String(product.reorderPoint),
      categoryId: product.categoryId,
    });
    setImagePreview(null);
    setFormError(null);
    setSuccessMessage(null);
    setImageInputKey((current) => current + 1);
    setModalOpen(true);
  }

  function closeModal() {
    setImageFile(null);
    setImageError(null);
    revokePreview();
    setModalOpen(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setImagePreview(null);
    setFormError(null);
    setSubmitting(false);
    setImageInputKey((current) => current + 1);
  }

  function updateForm(field: keyof ProductFormData, value: string) {
    setFormError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleImageSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    revokePreview();
    setImagePreview(null);
    setImageFile(null);
    setImageError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      event.target.value = '';
      setImageError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      setImageError('Product image must not exceed 5 MB.');
      return;
    }
    setImageFile(file);
    revokePreview();
    setImagePreview(URL.createObjectURL(file));
  }

  function resetImage() {
    setImageFile(null);
    setImageError(null);
    revokePreview();
    setImagePreview(null);
    setImageInputKey((current) => current + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || imageError || !canManage) return;
    setFormError(null);

    const name = formData.name.trim();
    const sku = formData.sku.trim();
    const priceRaw = formData.price.trim();
    const categoryId = formData.categoryId.trim();

    if (!name) {
      setFormError('Product name is required.');
      return;
    }

    if (!sku) {
      setFormError('SKU is required.');
      return;
    }

    if (!priceRaw) {
      setFormError('Selling price is required.');
      return;
    }

    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Selling price must be a valid non-negative number.');
      return;
    }

    if (!categoryId) {
      setFormError('Category is required.');
      return;
    }

    let cost: number | undefined;
    const costRaw = formData.cost.trim();
    if (costRaw) {
      cost = Number(costRaw);
      if (!Number.isFinite(cost) || cost < 0) {
        setFormError('Cost must be a valid non-negative number.');
        return;
      }
    }

    let reorderPoint: number | null = null;
    const reorderPointRaw = formData.reorderPoint.trim();
    if (reorderPointRaw) {
      reorderPoint = Number(reorderPointRaw);
      if (!Number.isInteger(reorderPoint) || reorderPoint < 0) {
        setFormError('Reorder point must be a non-negative whole number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders(),
      };

      const body: Record<string, unknown> = {
        name,
        sku,
        description: formData.description.trim() || null,
        status: formData.status,
        unitType: formData.unitType,
        price,
        cost,
        reorderPoint,
        categoryId,
      };

      const url = editingProduct
        ? `${API_URL}/api/products/${editingProduct.id}`
        : `${API_URL}/api/products`;

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to save product.'));
      }

      const { product: saved } = await response.json() as { product: Product };
      setProducts(current => [...current.filter(product => product.id !== saved.id), saved]);
      let warning: string | null = null;
      if (imageFile) {
        setImageBusy(true);
        let uploadMessage = 'Unable to upload product image. Please retry from Edit Product.';
        try {
          const data = new FormData();
          data.append('image', imageFile);
          const result = await fetch(`${API_URL}/api/products/${saved.id}/image`, { method: 'POST', headers: authHeaders(), body: data });
          if (!result.ok) {
            uploadMessage = imageResponseMessage(result.status);
            throw new Error(uploadMessage);
          }
          const uploaded = await result.json() as { imageUrl: string };
          setProducts(current => current.map(product => product.id === saved.id ? { ...product, imageUrl: uploaded.imageUrl } : product));
        } catch {
          warning = `${editingProduct ? 'Product was updated' : 'Product was created'}, but the image could not be uploaded. ${uploadMessage}`;
          await loadProducts();
        } finally { setImageBusy(false); }
      }
      setImageWarning(warning);
      setSuccessMessage(warning ? null : editingProduct ? 'Product updated.' : 'Product created.');
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSubmitting(false);
    }
  }

  function imageResponseMessage(status: number) {
    const messages: Record<number, string> = {
      400: 'Select a valid product image.', 401: 'Your session expired. Sign in again.',
      403: 'Only administrators can change product images.', 404: 'Product not found. Reload the catalog.',
      409: 'The product image changed while you were editing. Reload the product and try again.',
      413: 'Product image must not exceed 5 MB.', 415: 'Use a JPEG, PNG, or WebP image.',
      429: 'Too many image requests. Please try again later.',
      502: 'Image storage is currently unavailable.', 503: 'Image storage is currently unavailable.',
    };
    return messages[status] ?? 'Unable to change product image. Please try again.';
  }

  async function removeCurrentImage() {
    if (!editingProduct || busy || !canManage) return;
    setImageBusy(true);
    setImageError(null);
    let removalMessage = 'Unable to remove product image. Please try again.';
    try {
      const result = await fetch(`${API_URL}/api/products/${editingProduct.id}/image`, { method: 'DELETE', headers: authHeaders() });
      if (!result.ok) {
        removalMessage = imageResponseMessage(result.status);
        if (result.status === 409) {
          const fresh = await fetch(`${API_URL}/api/products/${editingProduct.id}`, { headers: authHeaders() });
          if (fresh.ok) {
            const { product } = await fresh.json() as { product: Product };
            setProducts(current => current.map(row => row.id === product.id ? product : row));
            setEditingProduct(product);
          }
        }
        throw new Error(removalMessage);
      }
      setProducts(current => current.map(product => product.id === editingProduct.id ? { ...product, imageUrl: null } : product));
      setEditingProduct(current => current ? { ...current, imageUrl: null } : current);
      resetImage();
      setRemoveImageConfirm(false);
    } catch {
      setImageError(removalMessage);
    } finally { setImageBusy(false); }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;

    setDeleting(true);
    setDeleteError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/products/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to delete product.'));
      }

      await loadProducts();
      setSuccessMessage('Product deleted.');
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to delete product.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const hasProducts = products.length > 0;
  const hasFilteredProducts = filteredProducts.length > 0;
  const formTitle = editingProduct ? 'Edit Product' : 'Add Product';

  return (
    <AppShell
      activePage="Products"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--products"
    >
      <section className="products-page operational-page" aria-label="Products workspace">
        <PageHeader
          eyebrow="Catalog"
          title="Products"
          description="Manage product records, pricing, categories, and inventory-related settings."
          secondaryActions={canManage ? (
            <Button variant="primary" onClick={openCreateModal} iconStart={<Plus />}>
              Add Product
            </Button>
          ) : undefined}
        />

        {successMessage ? (
          <Alert variant="success" title="Success">
            {successMessage}
          </Alert>
        ) : null}
        {imageWarning ? <Alert variant="warning" title="Product saved">{imageWarning}</Alert> : null}

        <BentoGrid className="operational-summary products-summary" columns={6} gap="standard" aria-label="Product summary">
          <MetricCard className="bento-span-2" label="Total Products" value={summary.total} icon={<Boxes />} />
          <MetricCard className="bento-span-2" label="Active" value={summary.active} tone="success" />
          <MetricCard className="bento-span-2" label="Draft" value={summary.draft} />
          <MetricCard className="bento-span-2" label="Archived / Discontinued" value={summary.inactive} tone={summary.inactive > 0 ? 'warning' : 'default'} />
        </BentoGrid>

        {categoriesError ? (
          <Alert variant="warning" title="Categories unavailable.">
            Product filters and form categories may be incomplete.
          </Alert>
        ) : null}

        <BentoCard
          className="products-resource-card operational-table-card"
          variant="table"
          padding="standard"
          eyebrow="Master data"
          title="Product Catalog"
          description={`${filteredProducts.length} of ${products.length} products shown.`}
        >
          <div className="products-toolbar operational-toolbar">
            <Input
              label="Search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, SKU, slug, description, or category"
            />
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              disabled={categoriesLoading}
            >
              <option value="ALL">
                {categoriesLoading ? 'Loading categories...' : 'All Categories'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">All Statuses</option>
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </Select>
            <Select
              label="Sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="UPDATED_DESC">Recently Updated</option>
              <option value="NAME_ASC">Name A-Z</option>
              <option value="PRICE_ASC">Price Low-High</option>
              <option value="PRICE_DESC">Price High-Low</option>
            </Select>
          </div>

          {loading ? (
            <div className="products-loading operational-state" role="status" aria-live="polite">
              <Spinner size="md" label="Loading products" />
              <span>Loading products...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="products-state operational-state operational-state--block">
              <Alert variant="error" title="Unable to load products.">
                Check your connection and try again.
              </Alert>
              <Button variant="secondary" onClick={loadProducts}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && !hasProducts ? (
            <EmptyState
              title="No products yet."
              description="Add your first product to start building the catalog."
              action={canManage ? (
                <Button variant="primary" onClick={openCreateModal} iconStart={<Plus />}>
                  Add Product
                </Button>
              ) : undefined}
            />
          ) : null}

          {!loading && !error && hasProducts && !hasFilteredProducts ? (
            <EmptyState
              title="No products match your search or filters."
              description="Clear filters or adjust your search to see more products."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Filters
                </Button>
              }
            />
          ) : null}

          {!loading && !error && hasFilteredProducts ? (
            <div className="products-table-wrap operational-table-wrap">
              <table className="products-table operational-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Category</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Selling Price</th>
                    <th scope="col">Reorder Point</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className="products-actions-heading operational-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="products-product-cell">
                          <ProductImage imageUrl={product.imageUrl} name={product.name} />
                          <div>
                            <strong>{product.name}</strong>
                            <span title={product.description ?? product.slug}>
                              {product.description || product.slug}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="products-sku">{product.sku}</span>
                      </td>
                      <td>{product.category?.name ?? 'Uncategorized'}</td>
                      <td>{formatUnit(product.unitType)}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>{formatReorderPoint(product.reorderPoint)}</td>
                      <td>
                        <Badge variant={statusBadgeVariant(product.status)}>
                          {statusLabel(product.status)}
                        </Badge>
                      </td>
                      <td>{formatDate(product.updatedAt)}</td>
                      <td>
                        {canManage ? <div className="products-row-actions operational-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Edit ${product.name}`}
                            onClick={() => openEditModal(product)}
                            iconStart={<Pencil />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => {
                              setDeleteConfirm(product);
                              setDeleteError(null);
                              setSuccessMessage(null);
                            }}
                            iconStart={<Trash2 />}
                          >
                            Delete
                          </Button>
                        </div> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </BentoCard>

        <Modal
          open={modalOpen && !removeImageConfirm && canManage}
          title={formTitle}
          description="Product records define catalog pricing, category placement, and selling status."
          onClose={() => {
            if (!busy) closeModal();
          }}
          closeOnBackdrop={!busy}
          width="760px"
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="product-form"
                loading={busy}
              >
                {imageBusy ? 'Uploading image...' : editingProduct ? 'Update Product' : 'Save Product'}
              </Button>
            </>
          }
        >
          <form id="product-form" className="products-form operational-form" onSubmit={handleSubmit}>
            <fieldset className="products-form-section operational-form-section" disabled={busy}>
              <legend>Product Image</legend>
              <div className="products-image-editor">
                <ProductImage imageUrl={imagePreview ?? editingProduct?.imageUrl} name={formData.name || 'Selected product image'} size="preview" loading="eager" />
                <div className="products-image-controls">
                  {editingProduct?.imageUrl && !imageFile ? <strong>Current Product Image</strong> : null}
                  <Input key={imageInputKey} id="product-image" label="Product Image" type="file"
                    accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect}
                    helperText="JPEG, PNG, or WebP. Maximum 5 MB." />
                  {imageFile ? <p className="products-image-filename">{imageFile.name} ({(imageFile.size / 1024).toFixed(1)} KB)</p> : null}
                  <div className="products-image-actions">
                    <Button variant="secondary" iconStart={<Upload />} onClick={() => document.getElementById('product-image')?.click()}>{editingProduct?.imageUrl ? 'Replace Image' : 'Choose Image'}</Button>
                    {imageFile || imageError ? <Button variant="ghost" iconStart={<X />} onClick={resetImage}>Discard Selection</Button> : null}
                    {editingProduct?.imageUrl ? <Button variant="danger" iconStart={<Trash2 />} onClick={() => { setImageError(null); setRemoveImageConfirm(true); }}>Remove Image</Button> : null}
                  </div>
                </div>
              </div>
            </fieldset>
            {imageError ? <Alert variant="error">{imageError}</Alert> : null}
            {imageBusy ? <p role="status">Uploading image...</p> : null}
            <fieldset className="products-form-section operational-form-section" disabled={busy}>
              <legend>Basic Information</legend>
              <div className="products-form-grid operational-form-grid">
                <Input
                  label="Product Name"
                  value={formData.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Product name"
                  required
                />
                <Input
                  label="SKU"
                  value={formData.sku}
                  onChange={(event) => updateForm('sku', event.target.value)}
                  placeholder="SKU"
                  required
                />
                <Select
                  label="Category"
                  value={formData.categoryId}
                  onChange={(event) => updateForm('categoryId', event.target.value)}
                  disabled={categoriesLoading}
                  required
                  helperText={
                    categoriesLoading ? 'Loading categories...' : undefined
                  }
                  error={categoriesError ?? undefined}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                  {editingProduct &&
                  categories.every((category) => category.id !== editingProduct.categoryId) ? (
                    <option value={editingProduct.categoryId}>
                      Current category unavailable
                    </option>
                  ) : null}
                </Select>
                <Select
                  label="Unit Type"
                  value={formData.unitType}
                  onChange={(event) =>
                    updateForm('unitType', event.target.value as ProductUnitType)
                  }
                >
                  {PRODUCT_UNIT_TYPES.map((unitType) => (
                    <option key={unitType} value={unitType}>
                      {formatUnit(unitType)}
                    </option>
                  ))}
                </Select>
                <Textarea
                  label="Description"
                  value={formData.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  placeholder="Optional product description"
                  rows={3}
                  className="products-form-span operational-form-span"
                />
              </div>
            </fieldset>

            <fieldset className="products-form-section operational-form-section" disabled={busy}>
              <legend>Pricing</legend>
              <div className="products-form-grid operational-form-grid">
                <Input
                  label="Selling Price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(event) => updateForm('price', event.target.value)}
                  placeholder="0.00"
                  required
                />
                <Input
                  label="Cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(event) => updateForm('cost', event.target.value)}
                  placeholder="0.00"
                  helperText="Optional"
                />
                <Input
                  label="Reorder Point"
                  type="number"
                  step="1"
                  min="0"
                  value={formData.reorderPoint}
                  onChange={(event) => updateForm('reorderPoint', event.target.value)}
                  placeholder="Optional"
                  helperText="Stock level at or below which this product should be considered for restocking."
                />
              </div>
            </fieldset>

            <fieldset className="products-form-section operational-form-section" disabled={busy}>
              <legend>Classification / Status</legend>
              <div className="products-form-grid operational-form-grid">
              <Select
                label="Product Status"
                value={formData.status}
                onChange={(event) =>
                  updateForm('status', event.target.value as ProductStatus)
                }
              >
                {PRODUCT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </Select>
              </div>
            </fieldset>

            {formError ? <Alert variant="error">{formError}</Alert> : null}
          </form>
        </Modal>
        <ConfirmDialog open={removeImageConfirm && canManage} title="Remove product image?"
          description={imageError ?? `This will remove the current image for ${editingProduct?.name}. The product record will remain.`}
          confirmLabel="Remove Image" danger pending={imageBusy}
          onCancel={() => { if (!imageBusy) { setRemoveImageConfirm(false); setImageError(null); } }}
          onConfirm={removeCurrentImage} />

        <ConfirmDialog
          open={Boolean(deleteConfirm)}
          title="Delete product?"
          description={
            deleteError ||
            `"${deleteConfirm?.name ?? 'This product'}" will be permanently removed.`
          }
          cancelLabel="Cancel"
          confirmLabel="Delete Product"
          pending={deleting}
          danger
          onCancel={() => {
            if (deleting) return;
            setDeleteConfirm(null);
            setDeleteError(null);
          }}
          onConfirm={handleDelete}
        />
      </section>
    </AppShell>
  );
}
