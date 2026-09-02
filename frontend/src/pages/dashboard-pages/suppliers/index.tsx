import { useEffect, useState } from 'react';
import { DashboardPageShell, type DashboardPageName } from '../_shared/DashboardPageShell';
import type { Supplier } from '../../../types/supplier';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type SupplierFormData = {
  name: string;
  legalName: string;
  status: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  notes: string;
};

const EMPTY_FORM: SupplierFormData = {
  name: '',
  legalName: '',
  status: 'ACTIVE',
  email: '',
  phone: '',
  website: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Philippines',
  notes: '',
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function SuppliersPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/suppliers`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error(`Failed to load suppliers (${response.status})`);
      }
      const data = await response.json();
      setSuppliers(data.suppliers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suppliers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSuppliers);
  }, []);

  function openCreateModal() {
    setEditingSupplier(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      legalName: supplier.legalName ?? '',
      status: supplier.status,
      email: supplier.email ?? '',
      phone: supplier.phone ?? '',
      website: supplier.website ?? '',
      addressLine1: supplier.addressLine1 ?? '',
      addressLine2: supplier.addressLine2 ?? '',
      city: supplier.city ?? '',
      province: supplier.province ?? '',
      postalCode: supplier.postalCode ?? '',
      country: supplier.country,
      notes: supplier.notes ?? '',
    });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingSupplier(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSubmitting(false);
  }

  function updateForm(field: keyof SupplierFormData, value: string) {
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
        legalName: formData.legalName.trim() || null,
        status: formData.status,
        email: formData.email.trim() || null,
        phone: formData.phone.trim() || null,
        website: formData.website.trim() || null,
        addressLine1: formData.addressLine1.trim() || null,
        addressLine2: formData.addressLine2.trim() || null,
        city: formData.city.trim() || null,
        province: formData.province.trim() || null,
        postalCode: formData.postalCode.trim() || null,
        country: formData.country.trim() || 'Philippines',
        notes: formData.notes.trim() || null,
      };

      const url = editingSupplier
        ? `${API_URL}/api/suppliers/${editingSupplier.id}`
        : `${API_URL}/api/suppliers`;

      const response = await fetch(url, {
        method: editingSupplier ? 'PUT' : 'POST',
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

      await loadSuppliers();
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save supplier');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/suppliers/${deleteConfirm.id}`, {
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

      await loadSuppliers();
      setDeleteConfirm(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to delete supplier');
    } finally {
      setDeleting(false);
    }
  }

  const rows = suppliers.map((supplier) => ({
    title: supplier.name,
    detail: `${supplier.supplierCode} · ${supplier.email ?? 'No email'} · ${supplier.phone ?? 'No phone'}`,
    status: supplier.status,
    id: supplier.id,
  }));

  const renderRowActions = (row: { id?: string }) => {
    if (!row.id) return null;
    const supplier = suppliers.find((s) => s.id === row.id);
    if (!supplier) return null;
    return (
      <div className="dashboard-page-row-actions">
        <button
          type="button"
          className="dashboard-page-row-button"
          onClick={() => openEditModal(supplier)}
        >
          Edit
        </button>
        <button
          type="button"
          className="dashboard-page-row-button dashboard-page-row-button--danger"
          onClick={() => setDeleteConfirm(supplier)}
        >
          Delete
        </button>
      </div>
    );
  };

  return (
    <DashboardPageShell
      activePage="Suppliers"
      eyebrow="Vendor network"
      title="Suppliers"
      description="Monitor supplier reliability, purchase terms, and delivery exceptions."
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      actionLabel="Add supplier"
      onAction={openCreateModal}
      metrics={[
        { label: 'Partners', value: String(suppliers.length), helper: 'Live count' },
        { label: 'Delayed POs', value: '0', helper: '2 high priority' },
        { label: 'Avg. lead time', value: '0d', helper: '-0.6 days improved' },
      ]}
      rows={rows}
      renderRowActions={renderRowActions}
    >
      {loading && (
        <div className="suppliers-loading">
          <p>Loading suppliers...</p>
        </div>
      )}
      {error && !loading && (
        <div className="suppliers-error">
          <p>{error}</p>
          <button type="button" onClick={loadSuppliers}>Retry</button>
        </div>
      )}

      {modalOpen && (
        <div className="suppliers-modal-backdrop" onClick={closeModal}>
          <div className="suppliers-modal" onClick={(e) => e.stopPropagation()}>
            <div className="suppliers-modal-head">
              <h3>{editingSupplier ? 'Edit Supplier' : 'New Supplier'}</h3>
              <button type="button" className="suppliers-modal-close" onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-name">Name</label>
                <input
                  id="supplier-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => updateForm('name', e.target.value)}
                  placeholder="Supplier name"
                />
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-legalName">Legal Name</label>
                <input
                  id="supplier-legalName"
                  type="text"
                  value={formData.legalName}
                  onChange={(e) => updateForm('legalName', e.target.value)}
                  placeholder="Legal name"
                />
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-status">Status</label>
                <select
                  id="supplier-status"
                  value={formData.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_HOLD">On hold</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
              <div className="suppliers-form-row">
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-email">Email</label>
                  <input
                    id="supplier-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateForm('email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-phone">Phone</label>
                  <input
                    id="supplier-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateForm('phone', e.target.value)}
                    placeholder="+63 900 000 0000"
                  />
                </div>
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-website">Website</label>
                <input
                  id="supplier-website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => updateForm('website', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-addressLine1">Address Line 1</label>
                <input
                  id="supplier-addressLine1"
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => updateForm('addressLine1', e.target.value)}
                  placeholder="Street address"
                />
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-addressLine2">Address Line 2</label>
                <input
                  id="supplier-addressLine2"
                  type="text"
                  value={formData.addressLine2}
                  onChange={(e) => updateForm('addressLine2', e.target.value)}
                  placeholder="Apartment, suite, etc."
                />
              </div>
              <div className="suppliers-form-row">
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-city">City</label>
                  <input
                    id="supplier-city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-province">Province</label>
                  <input
                    id="supplier-province"
                    type="text"
                    value={formData.province}
                    onChange={(e) => updateForm('province', e.target.value)}
                    placeholder="Province"
                  />
                </div>
              </div>
              <div className="suppliers-form-row">
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-postalCode">Postal Code</label>
                  <input
                    id="supplier-postalCode"
                    type="text"
                    value={formData.postalCode}
                    onChange={(e) => updateForm('postalCode', e.target.value)}
                    placeholder="Postal code"
                  />
                </div>
                <div className="suppliers-form-field">
                  <label htmlFor="supplier-country">Country</label>
                  <input
                    id="supplier-country"
                    type="text"
                    value={formData.country}
                    onChange={(e) => updateForm('country', e.target.value)}
                    placeholder="Country"
                  />
                </div>
              </div>
              <div className="suppliers-form-field">
                <label htmlFor="supplier-notes">Notes</label>
                <textarea
                  id="supplier-notes"
                  value={formData.notes}
                  onChange={(e) => updateForm('notes', e.target.value)}
                  placeholder="Optional notes"
                  rows={3}
                />
              </div>
              {formError && <p className="suppliers-form-error">{formError}</p>}
              <div className="suppliers-modal-actions">
                <button type="button" className="suppliers-button-secondary" onClick={closeModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="suppliers-button-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingSupplier ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="suppliers-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="suppliers-modal" onClick={(e) => e.stopPropagation()}>
            <div className="suppliers-modal-head">
              <h3>Delete Supplier</h3>
              <button type="button" className="suppliers-modal-close" onClick={() => setDeleteConfirm(null)}>
                ×
              </button>
            </div>
            <p className="suppliers-delete-text">
              Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            {formError && <p className="suppliers-form-error">{formError}</p>}
            <div className="suppliers-modal-actions">
              <button
                type="button"
                className="suppliers-button-secondary"
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
                className="suppliers-button-primary suppliers-button-primary--danger"
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
