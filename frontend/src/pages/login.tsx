import { useState } from 'react';
import githubIcon from '../assets/github.png';
import '../styles/login.css';
import type { AuthResponse } from '../types/auth';

type LoginProps = {
  onAuthenticated: (auth: AuthResponse, remember: boolean) => void;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function Login({ onAuthenticated }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isSignup ? 'signup' : 'login';
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
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
  };

  return (
    <div className="login-container">
      <div className="aurora-bg">
        <div className="aurora-glow aurora-1"></div>
        <div className="aurora-glow aurora-2"></div>
        <div className="aurora-glow aurora-3"></div>
      </div>

      <div className="grid-pattern"></div>

      <div className="login-content">
        <div className="login-right">
          <div className="glass-card">
            <div className="form-header">
              <h2>{isSignup ? 'Create Account' : 'Welcome Back'}</h2>
              <p>
                {isSignup
                  ? 'Sign up with your email and password'
                  : 'Sign in to your account'}
              </p>
            </div>

            <form onSubmit={handleLogin}>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    placeholder="admin@vapeshop.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                  />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                    minLength={isSignup ? 8 : undefined}
                    required
                  />
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
              </div>

              {isSignup && (
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm Password</label>
                  <div className="input-wrapper">
                    <input
                      id="confirm-password"
                      type="password"
                      placeholder="Retype your password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      required
                    />
                    <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                </div>
              )}

              <div className="form-options">
                <label className="remember-me">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  Remember me
                </label>
                {!isSignup && (
                  <span className="forgot-password">Forgot password?</span>
                )}
              </div>

              {error && (
                <div className="auth-error" role="alert">
                  {error}
                </div>
              )}

              <button type="submit" className="login-btn" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    {isSignup ? 'Creating account...' : 'Signing in...'}
                  </>
                ) : (
                  <>
                    {isSignup ? 'Create Account' : 'Sign In'}
                    <span className="btn-icon" aria-hidden="true">&rarr;</span>
                  </>
                )}
              </button>
            </form>

            <div className="divider">
              <span>or continue with</span>
            </div>

            <div className="social-login">
              <button type="button" className="social-btn" disabled title="Google login is not connected yet">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
              <button type="button" className="social-btn" disabled title="GitHub login is not connected yet">
                <img className="social-icon-image" src={githubIcon} alt="" />
                GitHub
              </button>
            </div>

            <div className="signup-link">
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button type="button" className="link-button" onClick={toggleMode}>
                {isSignup ? 'Sign in here' : 'Sign up here'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="data-nodes">
        <div className="data-node node-1"></div>
        <div className="data-node node-2"></div>
        <div className="data-node node-3"></div>
        <div className="data-node node-4"></div>
      </div>
    </div>
  );
}
