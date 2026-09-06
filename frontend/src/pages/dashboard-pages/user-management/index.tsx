import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { User, UserRole, UserStatus } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type ManagedUser = User & { lastLoginAt: string | null; createdAt: string; updatedAt: string };
type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};
type UserForm = { fullName: string; username: string; email: string; temporaryPassword: string; confirmTemporaryPassword: string; status: UserStatus };
type EditForm = { fullName: string; username: string; email: string; role: UserRole };
type StatusAction = { user: ManagedUser; status: UserStatus; label: string };

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const statuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const emptyForm: UserForm = { fullName: '', username: '', email: '', temporaryPassword: '', confirmTemporaryPassword: '', status: 'ACTIVE' };
const emptyEdit: EditForm = { fullName: '', username: '', email: '', role: 'Staff' };

function token() { return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'); }
function headers(json = false): Record<string, string> {
  const auth = token();
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${auth}` } : {}) };
}
async function apiMessage(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { message?: string };
    if (response.status === 403) return 'You do not have permission to perform this action.';
    if (response.status === 500) return 'Something went wrong. Please try again.';
    return data.message || fallback;
  } catch { return fallback; }
}
function statusLabel(status: UserStatus) { return status.charAt(0) + status.slice(1).toLowerCase(); }
function statusVariant(status: UserStatus): 'success' | 'warning' | 'danger' { return status === 'ACTIVE' ? 'success' : status === 'INACTIVE' ? 'warning' : 'danger'; }
function formatDate(value: string | null, includeTime = false) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : new Intl.DateTimeFormat(undefined, includeTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
}

export default function UserManagementPage({ userEmail, userRole, onLogout, onNavigate }: DashboardPageProps) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | UserRole>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | UserStatus>('ALL');
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagedUser | null>(null);
  const [statusAction, setStatusAction] = useState<StatusAction | null>(null);
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit);
  const [resetForm, setResetForm] = useState({ temporaryPassword: '', confirmTemporaryPassword: '' });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadUsers() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_URL}/api/users`, { headers: headers() });
      if (!response.ok) throw new Error(await apiMessage(response, 'Unable to load users.'));
      const data = (await response.json()) as { users: ManagedUser[] };
      setUsers(data.users);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Unable to load users.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void Promise.resolve().then(loadUsers); }, []);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const searchable = [user.fullName, user.username, user.email].filter(Boolean).join(' ').toLowerCase();
      return (!needle || searchable.includes(needle)) && (roleFilter === 'ALL' || user.role === roleFilter) && (statusFilter === 'ALL' || user.status === statusFilter);
    });
  }, [query, roleFilter, statusFilter, users]);
  const summary = useMemo(() => ({ total: users.length, active: users.filter((user) => user.status === 'ACTIVE').length, admins: users.filter((user) => user.role === 'Admin').length, staff: users.filter((user) => user.role === 'Staff').length }), [users]);
  const updateForm = <K extends keyof UserForm>(key: K, value: UserForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  function openCreate() { setForm(emptyForm); setFormError(''); setNotice(''); setCreateOpen(true); }
  function openEdit(user: ManagedUser) { setEditForm({ fullName: user.fullName || '', username: user.username || '', email: user.email, role: user.role }); setFormError(''); setNotice(''); setEditUser(user); }
  function closeModals() { if (!submitting) { setCreateOpen(false); setEditUser(null); setResetUser(null); setFormError(''); setResetForm({ temporaryPassword: '', confirmTemporaryPassword: '' }); } }
  function statusOptions(user: ManagedUser): StatusAction[] { return statuses.filter((status) => status !== user.status).map((status) => ({ user, status, label: status === 'ACTIVE' ? 'Activate' : status === 'INACTIVE' ? 'Deactivate' : 'Suspend' })); }

  async function submitCreate(event: FormEvent) {
    event.preventDefault(); setFormError('');
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || form.temporaryPassword.length < 8) { setFormError('Complete all required fields. Passwords must be at least 8 characters.'); return; }
    if (form.temporaryPassword !== form.confirmTemporaryPassword) { setFormError('Temporary passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users`, { method: 'POST', headers: headers(true), body: JSON.stringify(form) });
      if (!response.ok) throw new Error(await apiMessage(response, 'Unable to create user.'));
      closeModals(); setNoticeError(false); setNotice('User created successfully.'); await loadUsers();
    } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : 'Unable to create user.'); }
    finally { setSubmitting(false); }
  }
  async function submitEdit(event: FormEvent) {
    event.preventDefault(); if (!editUser) return; setFormError('');
    if (!editForm.fullName.trim() || !editForm.username.trim() || !editForm.email.trim()) { setFormError('Full name, username, and email are required.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${editUser.id}`, { method: 'PUT', headers: headers(true), body: JSON.stringify(editForm) });
      if (!response.ok) throw new Error(await apiMessage(response, 'Unable to update user.'));
      closeModals(); setNoticeError(false); setNotice('User updated successfully.'); await loadUsers();
    } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : 'Unable to update user.'); }
    finally { setSubmitting(false); }
  }
  async function changeStatus() {
    if (!statusAction) return; setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${statusAction.user.id}/status`, { method: 'PATCH', headers: headers(true), body: JSON.stringify({ status: statusAction.status }) });
      if (!response.ok) throw new Error(await apiMessage(response, 'Unable to update account status.'));
      setStatusAction(null); setNoticeError(false); setNotice('Account status updated.'); await loadUsers();
    } catch (requestError) { setNoticeError(true); setNotice(requestError instanceof Error ? requestError.message : 'Unable to update account status.'); setStatusAction(null); }
    finally { setSubmitting(false); }
  }
  async function resetPassword(event: FormEvent) {
    event.preventDefault(); if (!resetUser) return; setFormError('');
    if (resetForm.temporaryPassword.length < 8) { setFormError('Temporary password must be at least 8 characters.'); return; }
    if (resetForm.temporaryPassword !== resetForm.confirmTemporaryPassword) { setFormError('Temporary passwords do not match.'); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/users/${resetUser.id}/reset-password`, { method: 'POST', headers: headers(true), body: JSON.stringify(resetForm) });
      if (!response.ok) throw new Error(await apiMessage(response, 'Unable to reset password.'));
      closeModals(); setNoticeError(false); setNotice('Temporary password set. The user must change it on next login.'); await loadUsers();
    } catch (requestError) { setFormError(requestError instanceof Error ? requestError.message : 'Unable to reset password.'); }
    finally { setSubmitting(false); }
  }

  return (
    <AppShell activePage="User Management" userEmail={userEmail} userRole={userRole} onLogout={onLogout} onNavigate={onNavigate} className="dashboard-page dashboard-page--user-management">
      <section className="user-management-page" aria-label="User Management workspace">
        <PageHeader eyebrow="Administration" title="User Management" description="Manage employee accounts, roles, account status, and password access." actionLabel="Create User" onAction={openCreate} />
        {notice ? <Alert variant={noticeError ? 'error' : 'success'} title={noticeError ? 'Unable to update account' : 'Updated'}>{notice}</Alert> : null}
        <section className="user-summary" aria-label="User summary">
          {[['Total Users', summary.total], ['Active Users', summary.active], ['Admins', summary.admins], ['Staff', summary.staff]].map(([label, value]) => <article className="user-summary__card" key={label}><span>{label}</span><strong>{value}</strong></article>)}
        </section>
        <Card padding="default" className="user-management-card">
          <div className="user-toolbar"><Input label="Search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, username, or email" /><Select label="Role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'ALL' | UserRole)}><option value="ALL">All Roles</option><option value="Admin">Admin</option><option value="Staff">Staff</option></Select><Select label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | UserStatus)}><option value="ALL">All Statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select><Button variant="secondary" onClick={loadUsers} disabled={loading}>Refresh</Button></div>
          {loading ? <div className="user-state"><Spinner size="md" label="Loading users" /><span>Loading users...</span></div> : null}
          {error && !loading ? <div className="user-state"><Alert variant="error" title="Unable to load users">{error}</Alert><Button variant="secondary" onClick={loadUsers}>Retry</Button></div> : null}
          {!loading && !error && users.length === 0 ? <EmptyState title="No users yet." description="Create a Staff account to begin managing employee access." action={<Button onClick={openCreate}>Create User</Button>} /> : null}
          {!loading && !error && users.length > 0 && filteredUsers.length === 0 ? <EmptyState title="No users match your search or filters." description="Adjust the search or filters to see more users." /> : null}
          {!loading && !error && filteredUsers.length > 0 ? <div className="user-table-wrap"><table className="user-table"><thead><tr><th>User</th><th>Username</th><th>Role</th><th>Status</th><th>Last Login</th><th>Created</th><th>Actions</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td><strong>{user.fullName || 'Unnamed user'}</strong><span>{user.email}</span>{user.mustChangePassword ? <small>Password change required</small> : null}</td><td>{user.username || '—'}</td><td><Badge variant={user.role === 'Admin' ? 'info' : 'neutral'}>{user.role}</Badge></td><td><Badge variant={statusVariant(user.status)}>{statusLabel(user.status)}</Badge></td><td>{formatDate(user.lastLoginAt, true)}</td><td>{formatDate(user.createdAt)}</td><td><div className="user-actions"><Button variant="ghost" onClick={() => openEdit(user)}>Edit</Button><select aria-label={`Change status for ${user.email}`} value="" onChange={(event) => { const action = statusOptions(user).find((item) => item.status === event.target.value); if (action) setStatusAction(action); }}><option value="">Status</option>{statusOptions(user).map((action) => <option key={action.status} value={action.status}>{action.label}</option>)}</select><Button variant="ghost" onClick={() => { setResetUser(user); setFormError(''); }}>Reset Password</Button></div></td></tr>)}</tbody></table></div> : null}
        </Card>
      </section>

      <Modal open={createOpen} title="Create User" description="New accounts are created as Staff." onClose={closeModals} closeOnBackdrop={!submitting} footer={<><Button variant="secondary" onClick={closeModals} disabled={submitting}>Cancel</Button><Button type="submit" form="create-user-form" loading={submitting}>Create User</Button></>}><form id="create-user-form" className="user-form" onSubmit={submitCreate}><Input label="Full Name" value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} required /><Input label="Username" value={form.username} onChange={(event) => updateForm('username', event.target.value)} required /><Input label="Email" type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} required /><Input label="Temporary Password" type="password" value={form.temporaryPassword} onChange={(event) => updateForm('temporaryPassword', event.target.value)} minLength={8} required /><Input label="Confirm Temporary Password" type="password" value={form.confirmTemporaryPassword} onChange={(event) => updateForm('confirmTemporaryPassword', event.target.value)} minLength={8} required /><Select label="Status" value={form.status} onChange={(event) => updateForm('status', event.target.value as UserStatus)}>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}</Select>{formError ? <Alert variant="error" title="Unable to create user">{formError}</Alert> : null}</form></Modal>
      <Modal open={Boolean(editUser)} title="Edit User" description="Update identity and role details." onClose={closeModals} closeOnBackdrop={!submitting} footer={<><Button variant="secondary" onClick={closeModals} disabled={submitting}>Cancel</Button><Button type="submit" form="edit-user-form" loading={submitting}>Save Changes</Button></>}><form id="edit-user-form" className="user-form" onSubmit={submitEdit}><Input label="Full Name" value={editForm.fullName} onChange={(event) => setEditForm({ ...editForm, fullName: event.target.value })} required /><Input label="Username" value={editForm.username} onChange={(event) => setEditForm({ ...editForm, username: event.target.value })} required /><Input label="Email" type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} required /><Select label="Role" value={editForm.role} onChange={(event) => setEditForm({ ...editForm, role: event.target.value as UserRole })}><option value="Admin">Admin</option><option value="Staff">Staff</option></Select>{formError ? <Alert variant="error" title="Unable to update user">{formError}</Alert> : null}</form></Modal>
      <Modal open={Boolean(resetUser)} title="Reset Password" description="Set a temporary password for this account." onClose={closeModals} closeOnBackdrop={!submitting} footer={<><Button variant="secondary" onClick={closeModals} disabled={submitting}>Cancel</Button><Button type="submit" form="reset-password-form" loading={submitting}>Reset Password</Button></>}><form id="reset-password-form" className="user-form" onSubmit={resetPassword}><Input label="Temporary Password" type="password" value={resetForm.temporaryPassword} onChange={(event) => setResetForm({ ...resetForm, temporaryPassword: event.target.value })} minLength={8} required /><Input label="Confirm Temporary Password" type="password" value={resetForm.confirmTemporaryPassword} onChange={(event) => setResetForm({ ...resetForm, confirmTemporaryPassword: event.target.value })} minLength={8} required />{formError ? <Alert variant="error" title="Unable to reset password">{formError}</Alert> : null}</form></Modal>
      <ConfirmDialog open={Boolean(statusAction)} title={`${statusAction?.label ?? 'Update'} ${statusAction?.user.fullName || statusAction?.user.email}?`} description={statusAction?.status === 'ACTIVE' ? 'This user will be able to sign in and access the system.' : statusAction?.status === 'SUSPENDED' ? 'This user will be blocked from system access until reactivated.' : 'This user will no longer be able to sign in or access the system.'} confirmLabel={statusAction?.label} danger={statusAction?.status !== 'ACTIVE'} pending={submitting} onCancel={() => setStatusAction(null)} onConfirm={changeStatus} />
    </AppShell>
  );
}
