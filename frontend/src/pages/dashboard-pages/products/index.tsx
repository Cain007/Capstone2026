import { useEffect, useState } from 'react';
import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import type { Product } from '../../../types/product';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type ProductFormData = {
  name: string;
  sku: string;
  description: string;
  status: string;
  unitType: string;
  price: string;
  cost: string;
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
  categoryId: '',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ProductsPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  async function loadProducts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/products`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error(`Failed to load products (${response.status})`);
      }
      const data = await response.json();
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load products');
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
        throw new Error(`Failed to load categories (${response.status})`);
      }
      const data = await response.json();
      setCategories(data.categories ?? []);
    } catch (err) {
      setCategoriesError(err instanceof Error ? err.message : 'Unable to load categories');
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

  function openCreateModal() {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setImagePreview(null);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku,
      description: product.description ?? '',
      status: product.status,
      unitType: product.unitType,
      price: product.price == null ? '' : String(product.price),
      cost: product.cost == null ? '' : String(product.cost),
      categoryId: product.categoryId,
    });
    setImagePreview(null);
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setImagePreview(null);
    setFormError(null);
    setSubmitting(false);
  }

  function updateForm(field: keyof ProductFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function resetImage() {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name = typeof formData.name === 'string' ? formData.name.trim() : '';
    const sku = typeof formData.sku === 'string' ? formData.sku.trim() : '';
    const priceRaw = formData.price.trim();
    const categoryId = typeof formData.categoryId === 'string' ? formData.categoryId.trim() : '';

    if (!name) {
      setFormError('Name is required');
      return;
    }
    if (!sku) {
      setFormError('SKU is required');
      return;
    }
    if (!priceRaw) {
      setFormError('Price is required');
      return;
    }
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0) {
      setFormError('Price must be a valid non-negative number');
      return;
    }
    if (!categoryId) {
      setFormError('Category is required');
      return;
    }

    let cost: number | undefined;
    const costRaw = formData.cost.trim();
    if (costRaw) {
      cost = Number(costRaw);
      if (!Number.isFinite(cost) || cost < 0) {
        setFormError('Cost must be a valid non-negative number');
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
        let message = `Request failed (${response.status})`;
        try {
          const data = await response.json();
          if (data.message) message = data.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      await loadProducts();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save product');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/products/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        let message = `Delete failed (${response.status})`;
        try {
          const data = await response.json();
          if (data.message) message = data.message;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      await loadProducts();
      setDeleteConfirm(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete product');
    } finally {
      setDeleting(false);
    }
  }

  const rows = products.map((product) => ({
    title: product.name,
    detail: `${product.sku} · ${product.category?.name ?? 'Uncategorized'}`,
    status: product.status,
    id: product.id,
  }));

  const renderRowActions = (row: { id?: string }) => {
    if (!row.id) return null;
    const product = products.find((p) => p.id === row.id);
    if (!product) return null;
    return (
      <div className="dashboard-page-row-actions">
        <button
          type="button"
          className="dashboard-page-row-button"
          onClick={() => openEditModal(product)}
        >
          Edit
        </button>
        <button
          type="button"
          className="dashboard-page-row-button dashboard-page-row-button--danger"
          onClick={() => setDeleteConfirm(product)}
        >
          Delete
        </button>
      </div>
    );
  };

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
      onAction={openCreateModal}
      metrics={[
        { label: 'Active SKUs', value: String(products.length), helper: 'Live count' },
        { label: 'Drafts', value: '0', helper: 'Awaiting images' },
        { label: 'Price alerts', value: '0', helper: 'Needs margin check' },
      ]}
      rows={rows}
      renderRowActions={renderRowActions}
    >
      {loading && (
        <div className="products-loading">
          <p>Loading products...</p>
        </div>
      )}
      {error && !loading && (
        <div className="products-error">
          <p>{error}</p>
          <button type="button" onClick={loadProducts}>Retry</button>
        </div>
      )}

      {modalOpen && (
        <div className="products-modal-backdrop" onClick={closeModal}>
          <div className="products-modal" onClick={(e) => e.stopPropagation()}>
            <div className="products-modal-head">
              <h3>{editingProduct ? 'Edit Product' : 'New Product'}</h3>
              <button type="button" className="products-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="products-form-field">
                <label htmlFor="product-name">Name</label>
                <input
                  id="product-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Product name"
                />
              </div>
              <div className="products-form-field">
                <label htmlFor="product-sku">SKU</label>
                <input
                  id="product-sku"
                  type="text"
                  value={formData.sku}
                  onChange={(e) => updateForm('sku', e.target.value)}
                  placeholder="SKU"
                />
              </div>
              <div className="products-form-field">
                <label htmlFor="product-price">Price</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => updateForm('price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="products-form-field">
                <label htmlFor="product-category">Category</label>
                <select
                  id="product-category"
                  value={formData.categoryId}
                  onChange={(e) => updateForm('categoryId', e.target.value)}
                  disabled={categoriesLoading}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {categoriesLoading && (
                  <p className="products-field-error" style={{ color: 'var(--page-muted)' }}>Loading categories...</p>
                )}
                {categoriesError && <p className="products-field-error">{categoriesError}</p>}
              </div>
              <div className="products-form-field">
                <label htmlFor="product-description">Description</label>
                <textarea
                  id="product-description"
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="products-form-row">
                <div className="products-form-field">
                  <label htmlFor="product-status">Status</label>
                  <select
                    id="product-status"
                    value={formData.status}
                    onChange={(e) => updateForm('status', e.target.value)}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DISCONTINUED">Discontinued</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>
                <div className="products-form-field">
                  <label htmlFor="product-unitType">Unit Type</label>
                  <select
                    id="product-unitType"
                    value={formData.unitType}
                    onChange={(e) => updateForm('unitType', e.target.value)}
                  >
                    <option value="PIECE">Piece</option>
                    <option value="PACK">Pack</option>
                    <option value="BOX">Box</option>
                    <option value="BOTTLE">Bottle</option>
                    <option value="CARTON">Carton</option>
                    <option value="GRAM">Gram</option>
                    <option value="MILLILITER">Milliliter</option>
                  </select>
                </div>
              </div>
              <div className="products-form-field">
                <label htmlFor="product-cost">Cost</label>
                <input
                  id="product-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) => updateForm('cost', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="products-form-field">
                <label>Product Image</label>
                <div className="products-image-holder">
                  {imagePreview ? (
                    <div className="products-image-preview">
                      <img src={imagePreview} alt="Preview" />
                      <button
                        type="button"
                        className="products-image-remove"
                        onClick={resetImage}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="products-image-placeholder">
                      <span>Product Image</span>
                      <span className="products-image-hint">JPG, JPEG, PNG, WEBP</span>
                    </div>
                  )}
                  <input
                    id="product-image"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="products-image-input"
                  />
                </div>
              </div>
              {formError && <p className="products-form-error">{formError}</p>}
              <div className="products-modal-actions">
                <button type="button" className="products-button-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="products-button-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingProduct ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="products-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="products-modal" onClick={(e) => e.stopPropagation()}>
            <div className="products-modal-head">
              <h3>Delete Product</h3>
              <button type="button" className="products-modal-close" onClick={() => setDeleteConfirm(null)}>
                ×
              </button>
            </div>
            <p className="products-delete-text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            {formError && <p className="products-form-error">{formError}</p>}
            <div className="products-modal-actions">
              <button
                type="button"
                className="products-button-secondary"
                onClick={() => {
                  setDeleteConfirm(null);
                  setFormError(null);
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="products-button-primary products-button-primary--danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardPageShell>
  );
}
