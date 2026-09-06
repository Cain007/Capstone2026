import { useState, type FormEvent } from 'react';
import { Alert, Button, Input } from '../components/ui';
import type { AuthResponse, User } from '../types/auth';
import '../styles/password-change.css';

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
    <main className="password-change-page">
      <section className="password-change-card" aria-labelledby="password-change-title">
        <div className="password-change-mark" aria-hidden="true">SI</div>
        <p className="password-change-eyebrow">Account security</p>
        <h1 id="password-change-title">Set your password</h1>
        <p className="password-change-description">
          {user.fullName || user.username || user.email}, your account is using a temporary password. Create a new password before continuing.
        </p>

        {error ? <Alert variant="error" title="Password not changed">{error}</Alert> : null}

        <form className="password-change-form" onSubmit={handleSubmit}>
          <Input
            id="current-password"
            label="Current / Temporary Password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
          <Input
            id="new-password"
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Input
            id="confirm-password"
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Button type="submit" className="password-change-submit" loading={isLoading}>
            Change Password
          </Button>
          <Button type="button" variant="secondary" onClick={onLogout} disabled={isLoading}>
            Log out
          </Button>
        </form>
      </section>
    </main>
  );
}
