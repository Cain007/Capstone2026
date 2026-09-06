import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import PageHeader from '../../../components/PageHeader';
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
import type {
  AuditAction,
  AuditEntityType,
  AuditEventRecord,
  AuditEventType,
  AuditListResponse,
  AuditStatus,
  AuthEventStatus,
  AuthEventType,
  AuthFailureReason,
  JsonValue,
  LoginHistoryListResponse,
  LoginHistoryRecord,
  PaginationMetadata,
} from '../../../types/audit';
import type { UserRole } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  userRole?: UserRole;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
};

type AuditFilters = {
  eventType: 'ALL' | AuditEventType;
  action: 'ALL' | AuditAction;
  entityType: 'ALL' | AuditEntityType;
  status: 'ALL' | AuditStatus;
  from: string;
  to: string;
  search: string;
};

type LoginFilters = {
  eventType: 'ALL' | AuthEventType;
  status: 'ALL' | AuthEventStatus;
  failureReason: 'ALL' | AuthFailureReason;
  from: string;
  to: string;
  search: string;
};

type TabName = 'activity' | 'login-history';
type ErrorScope = 'audit' | 'login';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const PAGE_SIZES = [25, 50, 100] as const;
const DEFAULT_LIMIT = 50;

const AUDIT_EVENT_TYPES: AuditEventType[] = [
  'DATA_CHANGE',
  'ADMIN_ACTION',
  'ACCESS_CONTROL',
  'SECURITY',
  'REPORTING',
  'SYSTEM',
];
const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'ARCHIVE',
  'RESTORE',
  'ACTIVATE',
  'DEACTIVATE',
  'ASSIGN_ROLE',
  'REVOKE_ROLE',
  'GRANT_PERMISSION',
  'REVOKE_PERMISSION',
  'EXPORT',
  'IMPORT',
  'VIEW',
  'APPROVE',
  'CANCEL',
];
const AUDIT_ENTITY_TYPES: AuditEntityType[] = [
  'USER',
  'ROLE',
  'PERMISSION',
  'PRODUCT',
  'CATEGORY',
  'SUPPLIER',
  'PURCHASE_ORDER',
  'INVENTORY',
  'SALE',
  'FORECAST_RUN',
  'REPORT',
  'SYSTEM',
];
const AUDIT_STATUSES: AuditStatus[] = ['SUCCESS', 'FAILURE', 'DENIED'];
const AUTH_EVENT_TYPES: AuthEventType[] = [
  'LOGIN',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET_REQUEST',
  'PASSWORD_RESET_COMPLETE',
  'SESSION_EXPIRED',
];
const AUTH_STATUSES: AuthEventStatus[] = ['SUCCESS', 'FAILURE', 'DENIED'];
const FAILURE_REASONS: AuthFailureReason[] = [
  'INVALID_CREDENTIALS',
  'ACCOUNT_NOT_FOUND',
  'ACCOUNT_DISABLED',
  'TOKEN_EXPIRED',
  'TOKEN_INVALID',
  'RATE_LIMITED',
  'PASSWORD_POLICY',
  'USER_NOT_AUTHENTICATED',
  'UNKNOWN',
];

const emptyAuditFilters: AuditFilters = {
  eventType: 'ALL',
  action: 'ALL',
  entityType: 'ALL',
  status: 'ALL',
  from: '',
  to: '',
  search: '',
};
const emptyLoginFilters: LoginFilters = {
  eventType: 'ALL',
  status: 'ALL',
  failureReason: 'ALL',
  from: '',
  to: '',
  search: '',
};
const emptyPagination: PaginationMetadata = {
  page: 1,
  limit: DEFAULT_LIMIT,
  total: 0,
  totalPages: 0,
};

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function authHeaders(): Record<string, string> {
  const authToken = getAuthToken();
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function readApiError(
  response: Response,
  scope: ErrorScope,
): Promise<string> {
  if (response.status === 400) return 'Invalid audit filter.';
  if (response.status === 403) return 'You do not have permission to view audit logs.';
  if (response.status === 401) return 'Your session has expired. Please sign in again.';
  if (response.status >= 500) return 'Unable to load audit logs. Please try again.';

  try {
    const data = (await response.json()) as { message?: string };
    return data.message || (scope === 'audit' ? 'Unable to load audit activity.' : 'Unable to load login history.');
  } catch {
    return scope === 'audit' ? 'Unable to load audit activity.' : 'Unable to load login history.';
  }
}

function buildQuery(page: number, limit: number, filters: Record<string, string>) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== 'ALL') params.set(key, value);
  });

  return params.toString();
}

function humanizeEnum(value: string | null | undefined) {
  if (!value) return '-';
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

function statusVariant(status: AuditStatus | AuthEventStatus) {
  switch (status) {
    case 'SUCCESS':
      return 'success';
    case 'FAILURE':
      return 'danger';
    case 'DENIED':
      return 'warning';
  }
}

function actorPrimary(actor: AuditEventRecord['actor'] | LoginHistoryRecord['user']) {
  return actor?.fullName || actor?.username || actor?.email || 'System / Unknown';
}

function actorSecondary(actor: AuditEventRecord['actor'] | LoginHistoryRecord['user']) {
  if (!actor) return '';
  const secondary = [actor.role, actor.email].filter(Boolean).join(' / ');
  return secondary && secondary !== actorPrimary(actor) ? secondary : '';
}

function loginIdentity(entry: LoginHistoryRecord) {
  if (entry.user) {
    return {
      primary: actorPrimary(entry.user),
      secondary: actorSecondary(entry.user),
    };
  }

  return {
    primary: entry.attemptedEmail || 'Unknown User',
    secondary: entry.attemptedEmail ? 'Attempted identifier' : '',
  };
}

function operationLabel(metadata: JsonValue) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return '';
  const operation = metadata.operation;
  return typeof operation === 'string' ? humanizeEnum(operation) : '';
}

function jsonEntries(value: JsonValue) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).filter(([, entry]) => (
    entry === null ||
    ['string', 'number', 'boolean'].includes(typeof entry)
  ));
}

function hasStructuredJson(value: JsonValue) {
  return jsonEntries(value).length > 0;
}

function jsonText(value: JsonValue) {
  if (value === null || value === undefined) return 'Not applicable';
  return JSON.stringify(value, null, 2);
}

function shortText(value: string | null | undefined) {
  return value || '-';
}

function getEmptyActivityText(filters: AuditFilters) {
  const filtered = Object.values(filters).some((value) => value && value !== 'ALL');
  return filtered
    ? 'No audit events match the selected filters.'
    : 'No audit activity has been recorded yet.';
}

function getEmptyLoginText(filters: LoginFilters) {
  const filtered = Object.values(filters).some((value) => value && value !== 'ALL');
  return filtered
    ? 'No login history records match the selected filters.'
    : 'No login history has been recorded yet.';
}

function JsonDetail({ title, value }: { title: string; value: JsonValue }) {
  const entries = jsonEntries(value);

  return (
    <section className="audit-json-section">
      <h3>{title}</h3>
      {value === null || value === undefined ? (
        <p className="audit-muted">Not applicable</p>
      ) : (
        <>
          {entries.length > 0 ? (
            <dl className="audit-kv-list">
              {entries.map(([key, entry]) => (
                <div key={key}>
                  <dt>{humanizeEnum(key)}</dt>
                  <dd>{entry === null ? '-' : String(entry)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {!hasStructuredJson(value) || Array.isArray(value) ? (
            <pre className="audit-json-block">{jsonText(value)}</pre>
          ) : null}
        </>
      )}
    </section>
  );
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="audit-detail-grid">{children}</dl>;
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  );
}

function PaginationControls({
  pagination,
  loading,
  onPageChange,
}: {
  pagination: PaginationMetadata;
  loading: boolean;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages === 0) return null;

  return (
    <nav className="audit-pagination" aria-label="Audit log pagination">
      <Button
        variant="secondary"
        onClick={() => onPageChange(pagination.page - 1)}
        disabled={loading || pagination.page <= 1}
      >
        Previous
      </Button>
      <span>
        Page {pagination.page} of {pagination.totalPages}
      </span>
      <Button
        variant="secondary"
        onClick={() => onPageChange(pagination.page + 1)}
        disabled={loading || pagination.page >= pagination.totalPages}
      >
        Next
      </Button>
    </nav>
  );
}

export default function AuditLogsPage({
  userEmail,
  userRole = 'Admin',
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabName>('activity');
  const [auditItems, setAuditItems] = useState<AuditEventRecord[]>([]);
  const [auditPagination, setAuditPagination] = useState(emptyPagination);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState<number>(DEFAULT_LIMIT);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>(emptyAuditFilters);
  const [auditSearchDraft, setAuditSearchDraft] = useState('');
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<AuditEventRecord | null>(null);

  const [loginItems, setLoginItems] = useState<LoginHistoryRecord[]>([]);
  const [loginPagination, setLoginPagination] = useState(emptyPagination);
  const [loginPage, setLoginPage] = useState(1);
  const [loginLimit, setLoginLimit] = useState<number>(DEFAULT_LIMIT);
  const [loginFilters, setLoginFilters] = useState<LoginFilters>(emptyLoginFilters);
  const [loginSearchDraft, setLoginSearchDraft] = useState('');
  const [loginLoading, setLoginLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [selectedLogin, setSelectedLogin] = useState<LoginHistoryRecord | null>(null);

  const activeAuditEmptyText = useMemo(
    () => getEmptyActivityText(auditFilters),
    [auditFilters],
  );
  const activeLoginEmptyText = useMemo(
    () => getEmptyLoginText(loginFilters),
    [loginFilters],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadAuditEvents() {
      setAuditLoading(true);
      setAuditError('');
      try {
        const query = buildQuery(auditPage, auditLimit, auditFilters);
        const response = await fetch(`${API_URL}/api/audit-events?${query}`, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readApiError(response, 'audit'));
        const data = (await response.json()) as AuditListResponse;
        setAuditItems(data.items);
        setAuditPagination(data.pagination);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setAuditError(requestError instanceof Error ? requestError.message : 'Unable to load audit activity.');
      } finally {
        if (!controller.signal.aborted) setAuditLoading(false);
      }
    }

    void loadAuditEvents();
    return () => controller.abort();
  }, [auditFilters, auditLimit, auditPage]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLoginHistory() {
      setLoginLoading(true);
      setLoginError('');
      try {
        const query = buildQuery(loginPage, loginLimit, loginFilters);
        const response = await fetch(`${API_URL}/api/security/login-history?${query}`, {
          headers: authHeaders(),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await readApiError(response, 'login'));
        const data = (await response.json()) as LoginHistoryListResponse;
        setLoginItems(data.items);
        setLoginPagination(data.pagination);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setLoginError(requestError instanceof Error ? requestError.message : 'Unable to load login history.');
      } finally {
        if (!controller.signal.aborted) setLoginLoading(false);
      }
    }

    void loadLoginHistory();
    return () => controller.abort();
  }, [loginFilters, loginLimit, loginPage]);

  function updateAuditFilter<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setAuditPage(1);
    setAuditFilters((current) => ({ ...current, [key]: value }));
  }

  function updateLoginFilter<K extends keyof LoginFilters>(key: K, value: LoginFilters[K]) {
    setLoginPage(1);
    setLoginFilters((current) => ({ ...current, [key]: value }));
  }

  function submitAuditSearch(event: FormEvent) {
    event.preventDefault();
    updateAuditFilter('search', auditSearchDraft.trim());
  }

  function submitLoginSearch(event: FormEvent) {
    event.preventDefault();
    updateLoginFilter('search', loginSearchDraft.trim());
  }

  function clearAuditFilters() {
    setAuditPage(1);
    setAuditSearchDraft('');
    setAuditFilters(emptyAuditFilters);
  }

  function clearLoginFilters() {
    setLoginPage(1);
    setLoginSearchDraft('');
    setLoginFilters(emptyLoginFilters);
  }

  function retryActiveTab() {
    if (activeTab === 'activity') {
      setAuditPage((page) => page);
      setAuditFilters((filters) => ({ ...filters }));
      return;
    }
    setLoginPage((page) => page);
    setLoginFilters((filters) => ({ ...filters }));
  }

  if (userRole !== 'Admin') {
    return (
      <AppShell
        activePage="Audit Logs"
        userEmail={userEmail}
        userRole={userRole}
        onLogout={onLogout}
        onNavigate={onNavigate}
        className="dashboard-page dashboard-page--audit-logs"
      >
        <section className="audit-logs-page" aria-label="Audit Logs workspace">
          <PageHeader
            eyebrow="Administration"
            title="Audit Logs"
            description="Review system activity and authentication history."
          />
          <Alert variant="error" title="Permission required">
            You do not have permission to view audit logs.
          </Alert>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      activePage="Audit Logs"
      userEmail={userEmail}
      userRole={userRole}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--audit-logs"
    >
      <section className="audit-logs-page" aria-label="Audit Logs workspace">
        <PageHeader
          eyebrow="Administration"
          title="Audit Logs"
          description="Review system activity and authentication history."
        />

        <div className="audit-tabs" role="tablist" aria-label="Audit log sections">
          <button
            type="button"
            id="audit-tab-activity"
            role="tab"
            aria-selected={activeTab === 'activity'}
            aria-controls="audit-panel-activity"
            className={activeTab === 'activity' ? 'is-active' : undefined}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
          <button
            type="button"
            id="audit-tab-login-history"
            role="tab"
            aria-selected={activeTab === 'login-history'}
            aria-controls="audit-panel-login-history"
            className={activeTab === 'login-history' ? 'is-active' : undefined}
            onClick={() => setActiveTab('login-history')}
          >
            Login History
          </button>
        </div>

        {activeTab === 'activity' ? (
          <Card
            padding="default"
            className="audit-card"
            id="audit-panel-activity"
            role="tabpanel"
            aria-labelledby="audit-tab-activity"
          >
            <form className="audit-filter-grid audit-filter-grid--activity" onSubmit={submitAuditSearch}>
              <Input
                label="Search"
                type="search"
                value={auditSearchDraft}
                onChange={(event) => setAuditSearchDraft(event.target.value)}
                placeholder="Search actor or entity..."
              />
              <Select label="Event Type" value={auditFilters.eventType} onChange={(event) => updateAuditFilter('eventType', event.target.value as AuditFilters['eventType'])}>
                <option value="ALL">All</option>
                {AUDIT_EVENT_TYPES.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Select label="Action" value={auditFilters.action} onChange={(event) => updateAuditFilter('action', event.target.value as AuditFilters['action'])}>
                <option value="ALL">All</option>
                {AUDIT_ACTIONS.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Select label="Entity Type" value={auditFilters.entityType} onChange={(event) => updateAuditFilter('entityType', event.target.value as AuditFilters['entityType'])}>
                <option value="ALL">All</option>
                {AUDIT_ENTITY_TYPES.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Select label="Status" value={auditFilters.status} onChange={(event) => updateAuditFilter('status', event.target.value as AuditFilters['status'])}>
                <option value="ALL">All</option>
                {AUDIT_STATUSES.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Input label="From Date" type="date" value={auditFilters.from} onChange={(event) => updateAuditFilter('from', event.target.value)} />
              <Input label="To Date" type="date" value={auditFilters.to} onChange={(event) => updateAuditFilter('to', event.target.value)} />
              <Select label="Page Size" value={String(auditLimit)} onChange={(event) => { setAuditPage(1); setAuditLimit(Number(event.target.value)); }}>
                {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <div className="audit-filter-actions">
                <Button type="submit" variant="secondary">Apply</Button>
                <Button type="button" variant="ghost" onClick={clearAuditFilters}>Clear Filters</Button>
              </div>
            </form>

            {auditLoading ? (
              <div className="audit-state" role="status" aria-live="polite">
                <Spinner size="md" label="Loading audit activity" />
                <span>Loading audit activity...</span>
              </div>
            ) : null}

            {auditError && !auditLoading ? (
              <div className="audit-state">
                <Alert variant="error" title="Unable to load audit logs">{auditError}</Alert>
                <Button variant="secondary" onClick={retryActiveTab}>Retry</Button>
              </div>
            ) : null}

            {!auditLoading && !auditError && auditItems.length === 0 ? (
              <EmptyState title={activeAuditEmptyText} />
            ) : null}

            {!auditLoading && !auditError && auditItems.length > 0 ? (
              <>
                <div className="audit-table-wrap">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th scope="col">Date / Time</th>
                        <th scope="col">Actor</th>
                        <th scope="col">Action</th>
                        <th scope="col">Entity</th>
                        <th scope="col">Entity Label</th>
                        <th scope="col">Status</th>
                        <th scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditItems.map((event) => (
                        <tr key={event.id}>
                          <td>{formatDateTime(event.createdAt)}</td>
                          <td>
                            <div className="audit-person">
                              <strong>{actorPrimary(event.actor)}</strong>
                              {actorSecondary(event.actor) ? <span>{actorSecondary(event.actor)}</span> : null}
                            </div>
                          </td>
                          <td>
                            <div className="audit-action-label">
                              <strong>{humanizeEnum(event.action)}</strong>
                              {operationLabel(event.metadata) ? <span>{operationLabel(event.metadata)}</span> : null}
                            </div>
                          </td>
                          <td>{humanizeEnum(event.entityType)}</td>
                          <td>{shortText(event.entityLabel)}</td>
                          <td><Badge variant={statusVariant(event.status)}>{humanizeEnum(event.status)}</Badge></td>
                          <td><Button variant="ghost" onClick={() => setSelectedAudit(event)}>View Details</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControls pagination={auditPagination} loading={auditLoading} onPageChange={setAuditPage} />
              </>
            ) : null}
          </Card>
        ) : null}

        {activeTab === 'login-history' ? (
          <Card
            padding="default"
            className="audit-card"
            id="audit-panel-login-history"
            role="tabpanel"
            aria-labelledby="audit-tab-login-history"
          >
            <form className="audit-filter-grid audit-filter-grid--login" onSubmit={submitLoginSearch}>
              <Input
                label="Search"
                type="search"
                value={loginSearchDraft}
                onChange={(event) => setLoginSearchDraft(event.target.value)}
                placeholder="Search user or identifier..."
              />
              <Select label="Status" value={loginFilters.status} onChange={(event) => updateLoginFilter('status', event.target.value as LoginFilters['status'])}>
                <option value="ALL">All</option>
                {AUTH_STATUSES.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Select label="Event Type" value={loginFilters.eventType} onChange={(event) => updateLoginFilter('eventType', event.target.value as LoginFilters['eventType'])}>
                <option value="ALL">All</option>
                {AUTH_EVENT_TYPES.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Select label="Failure Reason" value={loginFilters.failureReason} onChange={(event) => updateLoginFilter('failureReason', event.target.value as LoginFilters['failureReason'])}>
                <option value="ALL">All</option>
                {FAILURE_REASONS.map((value) => <option key={value} value={value}>{humanizeEnum(value)}</option>)}
              </Select>
              <Input label="From Date" type="date" value={loginFilters.from} onChange={(event) => updateLoginFilter('from', event.target.value)} />
              <Input label="To Date" type="date" value={loginFilters.to} onChange={(event) => updateLoginFilter('to', event.target.value)} />
              <Select label="Page Size" value={String(loginLimit)} onChange={(event) => { setLoginPage(1); setLoginLimit(Number(event.target.value)); }}>
                {PAGE_SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
              </Select>
              <div className="audit-filter-actions">
                <Button type="submit" variant="secondary">Apply</Button>
                <Button type="button" variant="ghost" onClick={clearLoginFilters}>Clear Filters</Button>
              </div>
            </form>

            {loginLoading ? (
              <div className="audit-state" role="status" aria-live="polite">
                <Spinner size="md" label="Loading login history" />
                <span>Loading login history...</span>
              </div>
            ) : null}

            {loginError && !loginLoading ? (
              <div className="audit-state">
                <Alert variant="error" title="Unable to load audit logs">{loginError}</Alert>
                <Button variant="secondary" onClick={retryActiveTab}>Retry</Button>
              </div>
            ) : null}

            {!loginLoading && !loginError && loginItems.length === 0 ? (
              <EmptyState title={activeLoginEmptyText} />
            ) : null}

            {!loginLoading && !loginError && loginItems.length > 0 ? (
              <>
                <div className="audit-table-wrap">
                  <table className="audit-table audit-table--login">
                    <thead>
                      <tr>
                        <th scope="col">Date / Time</th>
                        <th scope="col">User / Identifier</th>
                        <th scope="col">Result</th>
                        <th scope="col">Event Type</th>
                        <th scope="col">Failure Reason</th>
                        <th scope="col">IP Address</th>
                        <th scope="col">Device / Browser</th>
                        <th scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginItems.map((entry) => {
                        const identity = loginIdentity(entry);
                        return (
                          <tr key={entry.id}>
                            <td>{formatDateTime(entry.createdAt)}</td>
                            <td>
                              <div className="audit-person">
                                <strong>{identity.primary}</strong>
                                {identity.secondary ? <span>{identity.secondary}</span> : null}
                              </div>
                            </td>
                            <td><Badge variant={statusVariant(entry.status)}>{humanizeEnum(entry.status)}</Badge></td>
                            <td>{humanizeEnum(entry.eventType)}</td>
                            <td>{humanizeEnum(entry.failureReason)}</td>
                            <td>{shortText(entry.ipAddress)}</td>
                            <td><span className="audit-truncate" title={entry.userAgent || undefined}>{shortText(entry.userAgent)}</span></td>
                            <td><Button variant="ghost" onClick={() => setSelectedLogin(entry)}>View Details</Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <PaginationControls pagination={loginPagination} loading={loginLoading} onPageChange={setLoginPage} />
              </>
            ) : null}
          </Card>
        ) : null}

        <Modal
          open={Boolean(selectedAudit)}
          title="Audit Event Details"
          description={selectedAudit ? operationLabel(selectedAudit.metadata) || humanizeEnum(selectedAudit.action) : undefined}
          onClose={() => setSelectedAudit(null)}
          width="980px"
          footer={<Button variant="secondary" onClick={() => setSelectedAudit(null)}>Close</Button>}
        >
          {selectedAudit ? (
            <div className="audit-detail">
              <DetailGrid>
                <DetailItem label="Event ID" value={<span className="audit-mono">{selectedAudit.id}</span>} />
                <DetailItem label="Date / Time" value={formatDateTime(selectedAudit.createdAt)} />
                <DetailItem label="Actor" value={actorPrimary(selectedAudit.actor)} />
                <DetailItem label="Event Type" value={humanizeEnum(selectedAudit.eventType)} />
                <DetailItem label="Action" value={humanizeEnum(selectedAudit.action)} />
                <DetailItem label="Entity" value={humanizeEnum(selectedAudit.entityType)} />
                <DetailItem label="Entity ID" value={<span className="audit-mono">{shortText(selectedAudit.entityId)}</span>} />
                <DetailItem label="Entity Label" value={shortText(selectedAudit.entityLabel)} />
                <DetailItem label="Status" value={<Badge variant={statusVariant(selectedAudit.status)}>{humanizeEnum(selectedAudit.status)}</Badge>} />
                <DetailItem label="IP Address" value={shortText(selectedAudit.ipAddress)} />
                <DetailItem label="User Agent" value={shortText(selectedAudit.userAgent)} />
                <DetailItem label="Request ID" value={<span className="audit-mono">{shortText(selectedAudit.requestId)}</span>} />
                <DetailItem label="Operation" value={operationLabel(selectedAudit.metadata) || '-'} />
              </DetailGrid>
              <div className="audit-json-grid">
                <JsonDetail title="Before" value={selectedAudit.before} />
                <JsonDetail title="After" value={selectedAudit.after} />
                <JsonDetail title="Metadata" value={selectedAudit.metadata} />
              </div>
            </div>
          ) : null}
        </Modal>

        <Modal
          open={Boolean(selectedLogin)}
          title="Login History Details"
          description={selectedLogin ? `${humanizeEnum(selectedLogin.eventType)} / ${humanizeEnum(selectedLogin.status)}` : undefined}
          onClose={() => setSelectedLogin(null)}
          width="820px"
          footer={<Button variant="secondary" onClick={() => setSelectedLogin(null)}>Close</Button>}
        >
          {selectedLogin ? (
            <div className="audit-detail">
              <DetailGrid>
                <DetailItem label="Date / Time" value={formatDateTime(selectedLogin.createdAt)} />
                <DetailItem label="Known User" value={selectedLogin.user ? actorPrimary(selectedLogin.user) : 'Unknown User'} />
                <DetailItem label="Attempted Identifier" value={shortText(selectedLogin.attemptedEmail)} />
                <DetailItem label="Status" value={<Badge variant={statusVariant(selectedLogin.status)}>{humanizeEnum(selectedLogin.status)}</Badge>} />
                <DetailItem label="Event Type" value={humanizeEnum(selectedLogin.eventType)} />
                <DetailItem label="Failure Reason" value={humanizeEnum(selectedLogin.failureReason)} />
                <DetailItem label="IP Address" value={shortText(selectedLogin.ipAddress)} />
                <DetailItem label="User Agent" value={shortText(selectedLogin.userAgent)} />
              </DetailGrid>
              <div className="audit-json-grid audit-json-grid--single">
                <JsonDetail title="Metadata" value={selectedLogin.metadata} />
              </div>
            </div>
          ) : null}
        </Modal>
      </section>
    </AppShell>
  );
}
