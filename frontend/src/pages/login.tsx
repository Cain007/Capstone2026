import { useState, type FormEvent } from 'react';
import { Alert, Button, Input } from '../components/ui';
import '../styles/login.css';
import type { AuthResponse } from '../types/auth';

type LoginProps = {
  onAuthenticated: (auth: AuthResponse, remember: boolean) => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login({ onAuthenticated }: LoginProps) {
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

  return (
    <main className="login-page">
      <section className="login-shell" aria-label="Authentication">
        <aside className="login-side-panel" aria-label="Sales and Inventory access">
          <div className="login-brand">
            <span className="login-brand__mark" aria-hidden="true">SI</span>
            <div>
              <p className="login-brand__name">Sales &amp; Inventory</p>
              <p className="login-brand__subtitle">Predictive Analysis</p>
            </div>
          </div>
          <ol className="login-progress" aria-hidden="true">
            <li className="is-active"><span className="login-progress__marker">1</span><span><strong>Account Access</strong><small>Sign in securely</small></span></li>
            <li><span className="login-progress__marker">2</span><span><strong>Workspace</strong><small>Manage operations</small></span></li>
            <li><span className="login-progress__marker">3</span><span><strong>Operations</strong><small>Work with business records</small></span></li>
          </ol>
          <p className="login-side-meta">Sales &amp; Inventory System</p>
        </aside>

        <div className="login-form-panel">
          <div className="login-mobile-brand" aria-label="Sales and Inventory">
            <span className="login-brand__mark" aria-hidden="true">SI</span>
            <div><p className="login-brand__name">Sales &amp; Inventory</p><p className="login-brand__subtitle">Predictive Analysis</p></div>
          </div>
          <div className="login-card" aria-live="polite">
            <div className="login-progress-dots" aria-hidden="true"><span className="is-active" /><span /><span /></div>
            <div className="login-form-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none"><path d="M6.75 10.5V8a5.25 5.25 0 0 1 10.5 0v2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><rect x="4.75" y="10.5" width="14.5" height="9" rx="2.25" stroke="currentColor" strokeWidth="1.8" /><path d="M12 14v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </div>
            <div className="login-card__header">
              <p className="login-card__eyebrow">Internal account access</p>
              <h1>Welcome back</h1>
              <p>Sign in to access the Sales &amp; Inventory System.</p>
            </div>
            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <Input id="auth-identifier" label="Email or Username" type="text" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError(''); }} autoComplete="username" placeholder="name@company.com" required disabled={isLoading} />
              <div className="login-password-field">
                <label className="login-password-field__label" htmlFor="auth-password">Password <span aria-hidden="true">*</span></label>
                <div className="login-password-control">
                  <input id="auth-password" className="ui-input" type={passwordType} value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} autoComplete="current-password" placeholder="Enter your password" required disabled={isLoading} />
                  <button type="button" className="login-password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((current) => !current)} disabled={isLoading}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </div>
              <label className="login-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={isLoading} /><span>Remember me</span></label>
              {error ? <Alert variant="error" title="Authentication error">{error}</Alert> : null}
              <Button type="submit" variant="primary" loading={isLoading} disabled={isLoading} className="login-submit">{isLoading ? 'Signing in...' : 'Sign In'}</Button>
            </form>
            <p className="login-account-note">Accounts are managed by the system administrator.</p>
          </div>
          <p className="login-panel-meta">Secure account access</p>
        </div>
      </section>
    </main>
  );
}
