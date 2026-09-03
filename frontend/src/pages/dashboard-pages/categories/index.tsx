import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../../components/PageHeader';
import {
  Alert,
  Badge,
  Button,
  Card,
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
import { statusBadgeVariant, statusLabel } from '../../../utils/status';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
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
};

type StatusFilter = 'ALL' | 'ACTIVE' | 'ARCHIVED';

const EMPTY_FORM: CategoryFormData = {
  name: '',
  description: '',
  status: 'ACTIVE',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

async function readMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || fallback;
  } catch {
    return fallback;
  }
}

export default function CategoriesPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadCategories() {
    setLoading(true);
    setError(null);
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
      setError('Unable to load categories.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadCategories);
  }, []);

  const summary = useMemo(
    () => ({
      total: categories.length,
      active: categories.filter((category) => category.status === 'ACTIVE').length,
      archived: categories.filter((category) => category.status === 'ARCHIVED').length,
    }),
    [categories],
  );

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories.filter((category) => {
      const matchesStatus =
        statusFilter === 'ALL' || category.status === statusFilter;
      const searchableText = [
        category.name,
        category.slug,
        category.description ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [categories, searchQuery, statusFilter]);

  function openCreateModal() {
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? '',
      status: category.status,
    });
    setFormError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSubmitting(false);
  }

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('ALL');
  }

  function updateForm(field: keyof CategoryFormData, value: string) {
    setFormError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError('Category name is required.');
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
        sortOrder: editingCategory?.sortOrder ?? 0,
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
        throw new Error(await readMessage(response, 'Unable to save category.'));
      }

      await loadCategories();
      setSuccessMessage(
        editingCategory ? 'Category updated.' : 'Category created.',
      );
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch(`${API_URL}/api/categories/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to delete category.'));
      }

      await loadCategories();
      setSuccessMessage('Category deleted.');
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to delete category.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const formTitle = editingCategory ? 'Edit Category' : 'Add Category';

  return (
    <AppShell
      activePage="Categories"
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--categories"
    >
      <section className="categories-page" aria-label="Categories workspace">
        <PageHeader
          eyebrow="Catalog"
          title="Categories"
          description="Organize products into manageable catalog groups."
          actionLabel="+ Add Category"
          onAction={openCreateModal}
        />

        {successMessage ? (
          <Alert variant="success" title="Success">
            {successMessage}
          </Alert>
        ) : null}

        <Card padding="compact" className="categories-summary" aria-label="Category summary">
          <div>
            <span>Total Categories</span>
            <strong>{summary.total}</strong>
          </div>
          <div>
            <span>Active</span>
            <strong>{summary.active}</strong>
          </div>
          <div>
            <span>Archived</span>
            <strong>{summary.archived}</strong>
          </div>
        </Card>

        <Card padding="default" className="categories-resource-card">
          <div className="categories-toolbar">
            <Input
              label="Search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, slug, or description"
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </div>

          {loading ? (
            <div className="categories-loading" role="status" aria-live="polite">
              <Spinner size="md" label="Loading categories" />
              <span>Loading categories...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="categories-state">
              <Alert variant="error" title="Unable to load categories.">
                Check your connection and try again.
              </Alert>
              <Button variant="secondary" onClick={loadCategories}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && categories.length === 0 ? (
            <EmptyState
              title="No categories yet."
              description="Create your first category to organize the product catalog."
              action={
                <Button variant="primary" onClick={openCreateModal}>
                  + Add Category
                </Button>
              }
            />
          ) : null}

          {!loading && !error && categories.length > 0 && filteredCategories.length === 0 ? (
            <EmptyState
              title="No categories match your search or filters."
              description="Clear filters or adjust your search to see more categories."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : null}

          {!loading && !error && filteredCategories.length > 0 ? (
            <div className="categories-table-wrap">
              <table className="categories-table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Description</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className="categories-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className="categories-category-cell">
                          <strong>{category.name}</strong>
                          <span>{category.slug}</span>
                        </div>
                      </td>
                      <td>
                        <span
                          className="categories-description"
                          title={category.description ?? 'No description'}
                        >
                          {category.description || 'No description'}
                        </span>
                      </td>
                      <td>
                        <Badge variant={statusBadgeVariant(category.status)}>
                          {statusLabel(category.status)}
                        </Badge>
                      </td>
                      <td>{formatDate(category.updatedAt)}</td>
                      <td>
                        <div className="categories-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Edit ${category.name}`}
                            onClick={() => openEditModal(category)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={`Delete ${category.name}`}
                            onClick={() => {
                              setDeleteConfirm(category);
                              setDeleteError(null);
                              setSuccessMessage(null);
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Modal
          open={modalOpen}
          title={formTitle}
          description="Category names and status are used throughout catalog management."
          onClose={() => {
            if (!submitting) closeModal();
          }}
          closeOnBackdrop={!submitting}
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="category-form"
                loading={submitting}
              >
                {editingCategory ? 'Update Category' : 'Save Category'}
              </Button>
            </>
          }
        >
          <form id="category-form" className="categories-form" onSubmit={handleSubmit}>
            <Input
              label="Category Name"
              value={formData.name}
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="Category name"
              required
              error={formError && !formData.name.trim() ? formError : undefined}
            />
            <Textarea
              label="Description"
              value={formData.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Optional description"
              rows={3}
            />
            <Select
              label="Status"
              value={formData.status}
              onChange={(event) => updateForm('status', event.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
            {formError && formData.name.trim() ? (
              <Alert variant="error">{formError}</Alert>
            ) : null}
          </form>
        </Modal>

        <ConfirmDialog
          open={Boolean(deleteConfirm)}
          title="Delete category?"
          description={
            deleteError ||
            `"${deleteConfirm?.name ?? 'This category'}" will be permanently removed.`
          }
          cancelLabel="Cancel"
          confirmLabel="Delete Category"
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
