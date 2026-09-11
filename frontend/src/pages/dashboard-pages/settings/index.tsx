import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { BentoCard } from '../../../components/layout';
import PageHeader from '../../../components/PageHeader';
import {
  Alert,
  Badge,
  Button,
  Input,
} from '../../../components/ui';
import AppShell from '../../../layouts/AppShell';
import type { AuthResponse, User, UserStatus } from '../../../types/auth';
import type { DashboardPageName } from '../_shared/DashboardPageShell';
import './styles.css';

type DashboardPageProps = {
  userEmail?: string;
  user?: User;
  onLogout?: () => void;
  onNavigate?: (page: DashboardPageName) => void;
  onUserUpdated?: (user: User) => void;
};

type ApiMessage = {
  message?: string;
  user?: User;
  defaultRoute?: AuthResponse['defaultRoute'];
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const MIN_PASSWORD_LENGTH = 8;

const statusLabels: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  SUSPENDED: 'Suspended',
};

const statusVariants: Record<UserStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  INACTIVE: 'warning',
  SUSPENDED: 'danger',
};

const systemFacts = [
  { label: 'Application', value: 'KING OF CLOUDS VAPE SHOP' },
  { label: 'System', value: 'Inventory, Sales & Forecasting Management' },
  { label: 'Currency', value: 'Philippine Peso (PHP)' },
  { label: 'Business Timezone', value: 'Asia/Manila' },
  { label: 'Forecast Method', value: 'Moving Average' },
];

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() || '-';
}

async function readResponse(response: Response, fallback: string): Promise<ApiMessage> {
  try {
    return (await response.json()) as ApiMessage;
  } catch {
    return { message: fallback };
  }
}

export default function AccountSystemPage({
  userEmail,
  user,
  onLogout,
  onNavigate,
  onUserUpdated,
}: DashboardPageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFormError('Complete all password fields.');
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setFormError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const token = getAuthToken();
      const response = await fetch(`${API_URL}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await readResponse(response, 'Unable to change password.');

      if (!response.ok || !data.user) {
        throw new Error(data.message || 'Unable to change password.');
      }

      onUserUpdated?.(data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMessage(data.message || 'Password changed successfully.');
    } catch (requestError) {
      setFormError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to change password.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      activePage="Account & System"
      userEmail={userEmail}
      userRole={user?.role}
      onLogout={onLogout}
      onNavigate={onNavigate}
      className="dashboard-page dashboard-page--settings"
    >
      <section className="settings-page" aria-label="Account and system workspace">
        <PageHeader
          eyebrow="Account"
          title="Account & System"
          description="Review your account details and application information."
        />

        <div className="settings-grid">
          <BentoCard padding="standard" className="settings-card">
            <div className="settings-card__header">
              <div>
                <p className="settings-eyebrow">Account</p>
                <h2>Account Information</h2>
              </div>
              {user ? (
                <Badge variant={statusVariants[user.status]}>
                  {statusLabels[user.status]}
                </Badge>
              ) : null}
            </div>

            <dl className="settings-facts">
              <div>
                <dt>Full Name</dt>
                <dd>{displayValue(user?.fullName)}</dd>
              </div>
              <div>
                <dt>Username</dt>
                <dd>{displayValue(user?.username)}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{displayValue(user?.email)}</dd>
              </div>
              <div>
                <dt>Role</dt>
                <dd>{displayValue(user?.role)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{user ? statusLabels[user.status] : '-'}</dd>
              </div>
            </dl>
          </BentoCard>

        <BentoCard padding="standard" className="settings-card settings-password-card">
          <div className="settings-card__header">
            <div>
              <p className="settings-eyebrow">Security</p>
              <h2>Change Password</h2>
            </div>
          </div>

          {successMessage ? (
            <Alert variant="success" title="Password updated">
              {successMessage}
            </Alert>
          ) : null}

          {formError ? (
            <Alert variant="error" title="Password not changed">
              {formError}
            </Alert>
          ) : null}

          <form className="settings-password-form" onSubmit={handleSubmit}>
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                setFormError('');
                setSuccessMessage('');
              }}
              autoComplete="current-password"
              required
            />
            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(event) => {
                setNewPassword(event.target.value);
                setFormError('');
                setSuccessMessage('');
              }}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setFormError('');
                setSuccessMessage('');
              }}
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <Button type="submit" iconStart={<KeyRound size={16} />} loading={submitting}>
              Change Password
            </Button>
          </form>
        </BentoCard>
        </div>
          <BentoCard padding="standard" className="settings-card settings-system-card">
            <div className="settings-card__header">
              <div>
                <p className="settings-eyebrow">Read-only configuration</p>
                <h2>System Information</h2>
              </div>
            </div>

            <dl className="settings-facts">
              {systemFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
          </BentoCard>
      </section>
    </AppShell>
  );
}
