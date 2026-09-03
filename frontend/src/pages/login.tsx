import { useState, type FormEvent } from 'react';
import { Alert, Button, Input } from '../components/ui';
import '../styles/login.css';
import type { AuthResponse } from '../types/auth';

type LoginProps = {
  onAuthenticated: (auth: AuthResponse, remember: boolean) => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ onAuthenticated }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    const emailAddress = email.trim();
    if (!emailAddress) {
      setError('Email is required.');
      return;
    }

    if (!EMAIL_PATTERN.test(emailAddress)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (isSignup && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isSignup ? 'signup' : 'login';
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          password,
          ...(isSignup ? { confirmPassword } : {}),
        }),
      });
      const data = (await response.json()) as
        | AuthResponse
        | { message?: string };

      if (!response.ok || !('token' in data)) {
        throw new Error(
          'message' in data && data.message
            ? data.message
            : 'Authentication failed',
        );
      }

      onAuthenticated(data, remember);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to reach the server',
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup((current) => !current);
    setError('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const passwordType = showPassword ? 'text' : 'password';
  const confirmPasswordType = showConfirmPassword ? 'text' : 'password';
  const progressSteps = isSignup
    ? [
        ['Account Setup', 'Create your credentials'],
        ['Secure Access', 'Sign in securely'],
        ['Dashboard', 'Start managing operations'],
      ]
    : [
        ['Account Access', 'Sign in securely'],
        ['Dashboard', 'Manage business records'],
        ['Operations', 'Products, suppliers, and inventory'],
      ];

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Authentication">
        <aside className="login-side-panel" aria-label="Sales and Inventory access">
          <div className="login-brand">
            <span className="login-brand__mark" aria-hidden="true">
              SI
            </span>
            <div>
              <p className="login-brand__name">Sales & Inventory</p>
              <p className="login-brand__subtitle">Predictive Analysis</p>
            </div>
          </div>

          <ol className="login-progress" aria-hidden="true">
            {progressSteps.map(([title, description], index) => (
              <li
                key={title}
                className={index === 0 ? 'is-active' : undefined}
              >
                <span className="login-progress__marker">{index + 1}</span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
              </li>
            ))}
          </ol>

          <p className="login-side-meta">Sales & Inventory System</p>
        </aside>

        <div className="login-form-panel">
          <div className="login-mobile-brand" aria-label="Sales and Inventory">
            <span className="login-brand__mark" aria-hidden="true">
              SI
            </span>
            <div>
              <p className="login-brand__name">Sales & Inventory</p>
              <p className="login-brand__subtitle">Predictive Analysis</p>
            </div>
          </div>

          <div className="login-card" aria-live="polite">
            <div className="login-progress-dots" aria-hidden="true">
              <span className="is-active" />
              <span />
              <span />
            </div>

            <div className="login-form-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M6.75 10.5V8a5.25 5.25 0 0 1 10.5 0v2.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <rect
                  x="4.75"
                  y="10.5"
                  width="14.5"
                  height="9"
                  rx="2.25"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M12 14v2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <div className="login-card__header">
              <p className="login-card__eyebrow">
                {isSignup ? 'New account' : 'Account access'}
              </p>
              <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
              <p>
                {isSignup
                  ? 'Set up your account to access Sales & Inventory.'
                  : 'Sign in to continue to your Sales & Inventory workspace.'}
              </p>
            </div>

            <form className="login-form" onSubmit={handleLogin} noValidate>
              <Input
                id="auth-email"
                label="Email Address"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError('');
                }}
                autoComplete="email"
                placeholder="name@company.com"
                required
                disabled={isLoading}
              />

              <div className="login-password-field">
                <label className="login-password-field__label" htmlFor="auth-password">
                  Password <span aria-hidden="true">*</span>
                </label>
                <div className="login-password-control">
                  <input
                    id="auth-password"
                    className="ui-input"
                    type={passwordType}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError('');
                    }}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    minLength={isSignup ? 8 : undefined}
                    placeholder="Enter your password"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isLoading}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {isSignup ? (
                <div className="login-password-field">
                  <label
                    className="login-password-field__label"
                    htmlFor="auth-confirm-password"
                  >
                    Confirm Password <span aria-hidden="true">*</span>
                  </label>
                  <div className="login-password-control">
                    <input
                      id="auth-confirm-password"
                      className="ui-input"
                      type={confirmPasswordType}
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setError('');
                      }}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Retype your password"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirm password'
                          : 'Show confirm password'
                      }
                      onClick={() => setShowConfirmPassword((current) => !current)}
                      disabled={isLoading}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ) : null}

              <label className="login-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  disabled={isLoading}
                />
                <span>Remember me</span>
              </label>

              {error ? (
                <Alert variant="error" title="Authentication error">
                  {error}
                </Alert>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                disabled={isLoading}
                className="login-submit"
              >
                {isLoading
                  ? isSignup
                    ? 'Creating account...'
                    : 'Signing in...'
                  : isSignup
                    ? 'Create Account'
                    : 'Sign In'}
              </Button>
            </form>

            <div className="login-mode-switch">
              <span>
                {isSignup ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button type="button" onClick={toggleMode} disabled={isLoading}>
                {isSignup ? 'Sign in' : 'Create account'}
              </button>
            </div>
          </div>
          <p className="login-panel-meta">Secure account access</p>
        </div>
      </section>
    </main>
  );
}
