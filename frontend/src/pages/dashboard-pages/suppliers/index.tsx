import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
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
import type { Supplier } from '../../../types/supplier';
import { statusBadgeVariant, statusLabel } from '../../../utils/status';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type SupplierStatus = 'ACTIVE' | 'ON_HOLD' | 'INACTIVE' | 'ARCHIVED';
type StatusFilter = 'ALL' | SupplierStatus;
type SortMode = 'UPDATED_DESC' | 'NAME_ASC' | 'CODE_ASC';

type SupplierFormData = {
  name: string;
  legalName: string;
  status: SupplierStatus;
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

const SUPPLIER_STATUSES: SupplierStatus[] = [
  'ACTIVE',
  'ON_HOLD',
  'INACTIVE',
  'ARCHIVED',
];

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

export default function SuppliersPage({ userEmail, onLogout, onNavigate }: DashboardPageProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortMode, setSortMode] = useState<SortMode>('UPDATED_DESC');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formData, setFormData] = useState<SupplierFormData>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadSuppliers() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/suppliers`, {
        headers: { ...authHeaders() },
      });
      if (!response.ok) {
        throw new Error('Unable to load suppliers.');
      }
      const data = (await response.json()) as { suppliers?: Supplier[] };
      setSuppliers(data.suppliers ?? []);
    } catch {
      setError('Unable to load suppliers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSuppliers);
  }, []);

  const summary = useMemo(
    () => ({
      total: suppliers.length,
      active: suppliers.filter((supplier) => supplier.status === 'ACTIVE').length,
      onHold: suppliers.filter((supplier) => supplier.status === 'ON_HOLD').length,
      inactive: suppliers.filter(
        (supplier) =>
          supplier.status === 'INACTIVE' || supplier.status === 'ARCHIVED',
      ).length,
    }),
    [suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = suppliers.filter((supplier) => {
      const matchesStatus =
        statusFilter === 'ALL' || supplier.status === statusFilter;
      const searchableText = [
        supplier.name,
        supplier.supplierCode,
        supplier.legalName ?? '',
        supplier.email ?? '',
        supplier.phone ?? '',
        supplier.city ?? '',
        supplier.province ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return matchesStatus && (!query || searchableText.includes(query));
    });

    return [...filtered].sort((firstSupplier, secondSupplier) => {
      switch (sortMode) {
        case 'NAME_ASC':
          return firstSupplier.name.localeCompare(secondSupplier.name);
        case 'CODE_ASC':
          return firstSupplier.supplierCode.localeCompare(secondSupplier.supplierCode);
        case 'UPDATED_DESC':
        default:
          return (
            new Date(secondSupplier.updatedAt).getTime() -
            new Date(firstSupplier.updatedAt).getTime()
          );
      }
    });
  }, [searchQuery, sortMode, statusFilter, suppliers]);

  function clearFilters() {
    setSearchQuery('');
    setStatusFilter('ALL');
    setSortMode('UPDATED_DESC');
  }

  function openCreateModal() {
    setEditingSupplier(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setSuccessMessage(null);
    setModalOpen(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      legalName: supplier.legalName ?? '',
      status: SUPPLIER_STATUSES.includes(supplier.status)
        ? supplier.status
        : 'ACTIVE',
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
    setSuccessMessage(null);
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
    setFormError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    if (!name) {
      setFormError('Supplier name is required.');
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
        throw new Error(await readMessage(response, 'Unable to save supplier.'));
      }

      await loadSuppliers();
      setSuccessMessage(
        editingSupplier ? 'Supplier updated.' : 'Supplier created.',
      );
      closeModal();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save supplier.');
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
      const response = await fetch(`${API_URL}/api/suppliers/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(await readMessage(response, 'Unable to delete supplier.'));
      }

      await loadSuppliers();
      setSuccessMessage('Supplier deleted.');
      setDeleteConfirm(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Unable to delete supplier.',
      );
    } finally {
      setDeleting(false);
    }
  }

  const hasSuppliers = suppliers.length > 0;
  const hasFilteredSuppliers = filteredSuppliers.length > 0;
  const formTitle = editingSupplier ? 'Edit Supplier' : 'Add Supplier';

  return (
    <AppShell
      activePage="Suppliers"
      userEmail={userEmail}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--suppliers"
    >
      <section className="suppliers-page operational-page" aria-label="Suppliers workspace">
        <PageHeader
          eyebrow="Catalog"
          title="Suppliers"
          description="Maintain supplier and contact information for procurement."
          secondaryActions={(
            <Button variant="primary" onClick={openCreateModal} iconStart={<Plus />}>
              Add Supplier
            </Button>
          )}
        />

        {successMessage ? (
          <Alert variant="success" title="Success">
            {successMessage}
          </Alert>
        ) : null}

        <BentoGrid className="suppliers-summary operational-summary" columns={6} gap="standard" aria-label="Supplier summary">
          <MetricCard className="bento-span-2" label="Total Suppliers" value={summary.total} icon={<Truck />} />
          <MetricCard className="bento-span-2" label="Active" value={summary.active} tone="success" />
          <MetricCard className="bento-span-2" label="On Hold" value={summary.onHold} tone={summary.onHold > 0 ? 'warning' : 'default'} />
          <MetricCard className="bento-span-2" label="Inactive / Archived" value={summary.inactive} />
        </BentoGrid>

        <BentoCard
          className="suppliers-resource-card operational-table-card"
          variant="table"
          padding="standard"
          eyebrow="Master data"
          title="Supplier Directory"
          description={`${filteredSuppliers.length} of ${suppliers.length} suppliers shown.`}
        >
          <div className="suppliers-toolbar operational-toolbar">
            <Input
              label="Search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, code, legal name, email, phone, or location"
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">All Statuses</option>
              {SUPPLIER_STATUSES.map((status) => (
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
              <option value="CODE_ASC">Supplier Code</option>
            </Select>
          </div>

          {loading ? (
            <div className="suppliers-loading operational-state" role="status" aria-live="polite">
              <Spinner size="md" label="Loading suppliers" />
              <span>Loading suppliers...</span>
            </div>
          ) : null}

          {error && !loading ? (
            <div className="suppliers-state operational-state operational-state--block">
              <Alert variant="error" title="Unable to load suppliers.">
                Check your connection and try again.
              </Alert>
              <Button variant="secondary" onClick={loadSuppliers}>
                Retry
              </Button>
            </div>
          ) : null}

          {!loading && !error && !hasSuppliers ? (
            <EmptyState
              title="No suppliers yet."
              description="Add your first supplier to begin managing vendor records."
              action={
                <Button variant="primary" onClick={openCreateModal} iconStart={<Plus />}>
                  Add Supplier
                </Button>
              }
            />
          ) : null}

          {!loading && !error && hasSuppliers && !hasFilteredSuppliers ? (
            <EmptyState
              title="No suppliers match your search or filters."
              description="Clear filters or adjust your search to see more suppliers."
              action={
                <Button variant="secondary" onClick={clearFilters}>
                  Clear Filters
                </Button>
              }
            />
          ) : null}

          {!loading && !error && hasFilteredSuppliers ? (
            <div className="suppliers-table-wrap operational-table-wrap">
              <table className="suppliers-table operational-table">
                <thead>
                  <tr>
                    <th scope="col">Supplier</th>
                    <th scope="col">Code</th>
                    <th scope="col">Contact</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Status</th>
                    <th scope="col">Updated</th>
                    <th scope="col" className="suppliers-actions-heading operational-actions-heading">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id}>
                      <td>
                        <div className="suppliers-supplier-cell">
                          <strong>{supplier.name}</strong>
                          <span>{supplier.legalName || 'No legal name'}</span>
                        </div>
                      </td>
                      <td>
                        <span className="suppliers-code">{supplier.supplierCode}</span>
                      </td>
                      <td>
                        <div className="suppliers-contact-cell">
                          <span>{supplier.email || 'No email'}</span>
                          <span>{supplier.website || 'No website'}</span>
                        </div>
                      </td>
                      <td>{supplier.phone || '-'}</td>
                      <td>
                        <Badge variant={statusBadgeVariant(supplier.status)}>
                          {statusLabel(supplier.status)}
                        </Badge>
                      </td>
                      <td>{formatDate(supplier.updatedAt)}</td>
                      <td>
                        <div className="suppliers-row-actions operational-row-actions">
                          <Button
                            variant="ghost"
                            aria-label={`Edit ${supplier.name}`}
                            onClick={() => openEditModal(supplier)}
                            iconStart={<Pencil />}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            aria-label={`Delete ${supplier.name}`}
                            onClick={() => {
                              setDeleteConfirm(supplier);
                              setDeleteError(null);
                              setSuccessMessage(null);
                            }}
                            iconStart={<Trash2 />}
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
        </BentoCard>

        <Modal
          open={modalOpen}
          title={formTitle}
          description="Supplier records store vendor identity, contact details, address, and account status."
          onClose={() => {
            if (!submitting) closeModal();
          }}
          closeOnBackdrop={!submitting}
          width="760px"
          footer={
            <>
              <Button variant="secondary" onClick={closeModal} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                form="supplier-form"
                loading={submitting}
              >
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </Button>
            </>
          }
        >
          <form id="supplier-form" className="suppliers-form operational-form" onSubmit={handleSubmit}>
            <fieldset className="suppliers-form-section operational-form-section">
              <legend>Supplier Information</legend>
              <div className="suppliers-form-grid operational-form-grid">
                <Input
                  label="Supplier Name"
                  value={formData.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Supplier name"
                  required
                />
                <Input
                  label="Legal Name"
                  value={formData.legalName}
                  onChange={(event) => updateForm('legalName', event.target.value)}
                  placeholder="Legal name"
                />
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(event) =>
                    updateForm('status', event.target.value as SupplierStatus)
                  }
                >
                  {SUPPLIER_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </Select>
              </div>
            </fieldset>

            <fieldset className="suppliers-form-section operational-form-section">
              <legend>Contact Information</legend>
              <div className="suppliers-form-grid operational-form-grid">
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  placeholder="email@example.com"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  placeholder="+63 900 000 0000"
                />
                <Input
                  label="Website"
                  type="url"
                  value={formData.website}
                  onChange={(event) => updateForm('website', event.target.value)}
                  placeholder="https://example.com"
                  className="suppliers-form-span operational-form-span"
                />
              </div>
            </fieldset>

            <fieldset className="suppliers-form-section operational-form-section">
              <legend>Address</legend>
              <div className="suppliers-form-grid operational-form-grid">
                <Input
                  label="Address Line 1"
                  value={formData.addressLine1}
                  onChange={(event) => updateForm('addressLine1', event.target.value)}
                  placeholder="Street address"
                  className="suppliers-form-span operational-form-span"
                />
                <Input
                  label="Address Line 2"
                  value={formData.addressLine2}
                  onChange={(event) => updateForm('addressLine2', event.target.value)}
                  placeholder="Apartment, suite, etc."
                  className="suppliers-form-span operational-form-span"
                />
                <Input
                  label="City"
                  value={formData.city}
                  onChange={(event) => updateForm('city', event.target.value)}
                  placeholder="City"
                />
                <Input
                  label="Province"
                  value={formData.province}
                  onChange={(event) => updateForm('province', event.target.value)}
                  placeholder="Province"
                />
                <Input
                  label="Postal Code"
                  value={formData.postalCode}
                  onChange={(event) => updateForm('postalCode', event.target.value)}
                  placeholder="Postal code"
                />
                <Input
                  label="Country"
                  value={formData.country}
                  onChange={(event) => updateForm('country', event.target.value)}
                  placeholder="Country"
                />
              </div>
            </fieldset>

            <fieldset className="suppliers-form-section operational-form-section">
              <legend>Notes</legend>
              <Textarea
                label="Notes"
                value={formData.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="Optional notes"
                rows={3}
              />
            </fieldset>

            {formError ? <Alert variant="error">{formError}</Alert> : null}
          </form>
        </Modal>

        <ConfirmDialog
          open={Boolean(deleteConfirm)}
          title="Delete supplier?"
          description={
            deleteError ||
            `"${deleteConfirm?.name ?? 'This supplier'}" will be permanently removed.`
          }
          cancelLabel="Cancel"
          confirmLabel="Delete Supplier"
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
