import { useEffect, useState } from 'react';
import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import type { Category } from '../../../types/category';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type CategoryFormData = {
  name: string;
  description: string;
  status: string;
  sortOrder: number;
};

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  status: 'ACTIVE',
  sortOrder: 0,
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CategoriesPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadCategories() {
    setLoading(true);
    setError(null);
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
      setError(err instanceof Error ? err.message : 'Unable to load categories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, []);

  function openCreateModal() {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? '',
      status: category.status,
      sortOrder: category.sortOrder,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSubmitting(false);
  }

  function updateForm(field: keyof CategoryFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const name = typeof formData.name === 'string' ? formData.name.trim() : '';
    if (!name) {
      setFormError('Name is required');
      return;
    }

    setSubmitting(true);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders(),
      };

      const body: Record<string, unknown> = {
        name,
        description: formData.description.trim() || null,
        status: formData.status,
        sortOrder: formData.sortOrder,
      };

      const url = editingCategory
        ? `${API_URL}/api/categories/${editingCategory.id}`
        : `${API_URL}/api/categories`;

      const response = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
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

      await loadCategories();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save category');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/categories/${deleteConfirm.id}`, {
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

      await loadCategories();
      setDeleteConfirm(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete category');
    } finally {
      setDeleting(false);
    }
  }

  const rows = categories.map((category) => ({
    title: category.name,
    detail: category.description || category.slug,
    status: category.status,
    id: category.id,
  }));

  const renderRowActions = (row: { id?: string }) => {
    if (!row.id) return null;
    const category = categories.find((c) => c.id === row.id);
    if (!category) return null;
    return (
      <div className="dashboard-page-row-actions">
        <button
          type="button"
          className="dashboard-page-row-button"
          onClick={() => openEditModal(category)}
        >
          Edit
        </button>
        <button
          type="button"
          className="dashboard-page-row-button dashboard-page-row-button--danger"
          onClick={() => setDeleteConfirm(category)}
        >
          Delete
        </button>
      </div>
    );
  };

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
      onAction={openCreateModal}
      metrics={[
        { label: 'Categories', value: String(categories.length), helper: 'Live count' },
        { label: 'Unassigned', value: '0', helper: 'Products need mapping' },
        { label: 'Rule updates', value: '0', helper: 'Scheduled tonight' },
      ]}
      rows={rows}
      renderRowActions={renderRowActions}
    >
      {loading && (
        <div className="categories-loading">
          <p>Loading categories...</p>
        </div>
      )}
      {error && !loading && (
        <div className="categories-error">
          <p>{error}</p>
          <button type="button" onClick={loadCategories}>Retry</button>
        </div>
      )}

      {modalOpen && (
        <div className="categories-modal-backdrop" onClick={closeModal}>
          <div className="categories-modal" onClick={(e) => e.stopPropagation()}>
            <div className="categories-modal-head">
              <h3>{editingCategory ? 'Edit Category' : 'New Category'}</h3>
              <button type="button" className="categories-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="categories-form-field">
                <label htmlFor="category-name">Name</label>
                <input
                  id="category-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Category name"
                />
              </div>
              <div className="categories-form-field">
                <label htmlFor="category-description">Description</label>
                <textarea
                  id="category-description"
                  value={formData.description}
                  onChange={(e) => updateForm('description', e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="categories-form-field">
                <label htmlFor="category-status">Status</label>
                <select
                  id="category-status"
                  value={formData.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div className="categories-form-field">
                <label htmlFor="category-sortOrder">Sort Order</label>
                <input
                  id="category-sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => updateForm('sortOrder', Number(e.target.value))}
                />
              </div>
              {formError && <p className="categories-form-error">{formError}</p>}
              <div className="categories-modal-actions">
                <button type="button" className="categories-button-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="categories-button-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="categories-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="categories-modal" onClick={(e) => e.stopPropagation()}>
            <div className="categories-modal-head">
              <h3>Delete Category</h3>
              <button type="button" className="categories-modal-close" onClick={() => setDeleteConfirm(null)}>
                ×
              </button>
            </div>
            <p className="categories-delete-text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            {formError && <p className="categories-form-error">{formError}</p>}
            <div className="categories-modal-actions">
              <button
                type="button"
                className="categories-button-secondary"
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
                className="categories-button-primary categories-button-primary--danger"
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
