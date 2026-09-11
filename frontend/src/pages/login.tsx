import { useState, type FormEvent } from 'react';
import { AlertCircle, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from 'lucide-react';
import AuthLayout from '../components/auth/AuthLayout';
import { Alert, AlertDescription, AlertTitle } from '../components/shadcn/ui/alert';
import { Button } from '../components/shadcn/ui/button';
import { Card } from '../components/shadcn/ui/card';
import { Input } from '../components/shadcn/ui/input';
import { Label } from '../components/shadcn/ui/label';
import type { AuthResponse } from '../types/auth';

type LoginProps = {
  onBackHome: () => void;
  onAuthenticated: (auth: AuthResponse, remember: boolean) => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login({ onAuthenticated, onBackHome }: LoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!identifier.trim()) {
      setError('Email or username is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), password }),
      });
      const data = (await response.json()) as AuthResponse | { message?: string };

      if (!response.ok || !('token' in data)) {
        throw new Error(
          'message' in data && data.message ? data.message : 'Authentication failed',
        );
      }

      onAuthenticated(data, remember);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to reach the server',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const passwordType = showPassword ? 'text' : 'password';
  const loginError =
    error === 'Failed to fetch' || error === 'Unable to reach the server'
      ? 'Unable to reach the server. Please try again.'
      : error;

  return (
    <AuthLayout
      panelLabel="Authentication"
      eyebrow="Operations workspace"
      title="King of Clouds"
      description="Centralized business operations with inventory monitoring, sales analytics, and predictive demand forecasting."
      supportingLine="Smarter stock decisions powered by real sales data."
      mode="login"
      onBackHome={onBackHome}
    >
      <Card className="auth-card" aria-live="polite">
        <div className="auth-card__header">
          <p className="auth-card__eyebrow">Internal account access</p>
          <h2 className="auth-card__title">Welcome back</h2>
          <p className="auth-card__description">Sign in to continue to your workspace.</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <Label className="auth-label" htmlFor="auth-identifier">Email or username</Label>
            <div className="auth-input-wrap">
              <UserRound className="auth-input-icon" aria-hidden="true" />
              <Input
                id="auth-identifier"
                className="auth-input"
                type="text"
                value={identifier}
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setError('');
                }}
                autoComplete="username"
                placeholder="name@company.com"
                required
                disabled={isLoading}
                aria-invalid={Boolean(error && !identifier.trim()) || undefined}
              />
            </div>
          </div>

          <div className="auth-field">
            <Label className="auth-label" htmlFor="auth-password">Password</Label>
            <div className="auth-input-wrap">
              <LockKeyhole className="auth-input-icon" aria-hidden="true" />
              <Input
                id="auth-password"
                className="auth-input auth-password-input"
                type={passwordType}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError('');
                }}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                disabled={isLoading}
                aria-invalid={Boolean(error && !password) || undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((current) => !current)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          </div>

          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={isLoading}
            />
            <span>Remember me</span>
          </label>

          {error ? (
            <Alert className="auth-alert" variant="destructive">
              <AlertCircle aria-hidden="true" />
              <AlertTitle>Authentication error</AlertTitle>
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          ) : null}

          <Button type="submit" className="auth-submit" disabled={isLoading}>
            {isLoading ? <LoaderCircle className="auth-submit-spinner" aria-hidden="true" /> : null}
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="auth-footer-note">Having trouble signing in? Contact your administrator.</p>
      </Card>
    </AuthLayout>
  );
}
