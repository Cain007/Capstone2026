import { useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '../components/shadcn/ui/alert';
import { Button } from '../components/shadcn/ui/button';
import { Card } from '../components/shadcn/ui/card';
import { Input } from '../components/shadcn/ui/input';
import { Label } from '../components/shadcn/ui/label';
import type { AuthResponse, User } from '../types/auth';

type PasswordChangeProps = {
  user: User;
  onChanged: (user: User, defaultRoute: AuthResponse['defaultRoute']) => void;
  onLogout: () => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

export default function PasswordChange({ user, onChanged, onLogout }: PasswordChangeProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibleField, setVisibleField] = useState<'current' | 'new' | 'confirm' | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Complete all password fields.');
      return;
    }

    setIsLoading(true);

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
      const data = (await response.json()) as {
        user?: User;
        defaultRoute?: AuthResponse['defaultRoute'];
        message?: string;
      };

      if (!response.ok || !data.user || !data.defaultRoute) {
        throw new Error(data.message || 'Unable to change password.');
      }

      onChanged(data.user, data.defaultRoute);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reach the server.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      panelLabel="Password change"
      eyebrow="Account security"
      title="King of Clouds"
      description="Create a permanent password before entering the operations workspace."
      mode="password-change"
    >
      <Card className="auth-card auth-card--wide" aria-live="polite">
        <div className="auth-card__header">
          <p className="auth-card__eyebrow">KING OF CLOUDS VAPE SHOP</p>
          <h1 className="auth-card__title" id="password-change-title">Set a new password</h1>
          <p className="auth-card__description">
            {user.fullName || user.username || user.email}, your administrator provided a temporary password. Create a new password before continuing.
          </p>
        </div>

        {error ? (
          <Alert className="auth-alert" variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertTitle>Password not changed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <Label className="auth-label" htmlFor="current-password">Current Password</Label>
            <div className="auth-input-wrap">
              <LockKeyhole className="auth-input-icon" aria-hidden="true" />
              <Input
                id="current-password"
                className="auth-input auth-password-input"
                type={visibleField === 'current' ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={visibleField === 'current' ? 'Hide current password' : 'Show current password'}
                onClick={() => setVisibleField((current) => (current === 'current' ? null : 'current'))}
                disabled={isLoading}
              >
                {visibleField === 'current' ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="auth-field">
            <Label className="auth-label" htmlFor="new-password">New Password</Label>
            <div className="auth-input-wrap">
              <LockKeyhole className="auth-input-icon" aria-hidden="true" />
              <Input
                id="new-password"
                className="auth-input auth-password-input"
                type={visibleField === 'new' ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={visibleField === 'new' ? 'Hide new password' : 'Show new password'}
                onClick={() => setVisibleField((current) => (current === 'new' ? null : 'new'))}
                disabled={isLoading}
              >
                {visibleField === 'new' ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            <p className="auth-helper-text">Use at least 8 characters.</p>
          </div>

          <div className="auth-field">
            <Label className="auth-label" htmlFor="confirm-password">Confirm Password</Label>
            <div className="auth-input-wrap">
              <LockKeyhole className="auth-input-icon" aria-hidden="true" />
              <Input
                id="confirm-password"
                className="auth-input auth-password-input"
                type={visibleField === 'confirm' ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={visibleField === 'confirm' ? 'Hide confirmed password' : 'Show confirmed password'}
                onClick={() => setVisibleField((current) => (current === 'confirm' ? null : 'confirm'))}
                disabled={isLoading}
              >
                {visibleField === 'confirm' ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div className="auth-actions">
            <Button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? <LoaderCircle className="auth-submit-spinner" aria-hidden="true" /> : null}
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>
            <Button type="button" variant="outline" className="auth-submit" onClick={onLogout} disabled={isLoading}>
              Log out
            </Button>
          </div>
        </form>
      </Card>
    </AuthLayout>
  );
}
