import { useEffect, useState } from 'react';
import './App.css';
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import Home from './pages/home';
import PasswordChange from './pages/password-change';
import type { AuthResponse, User } from './types/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [publicView, setPublicView] = useState<'home' | 'login'>('home');
  const [user, setUser] = useState<User | null>(null);
  const [defaultRoute, setDefaultRoute] = useState<AuthResponse['defaultRoute']>('Dashboard');
  const [initialToken] = useState(
    () =>
      localStorage.getItem('auth_token') ||
      sessionStorage.getItem('auth_token'),
  );
  const [isCheckingSession, setIsCheckingSession] = useState(
    Boolean(initialToken),
  );

  useEffect(() => {
    if (!initialToken) {
      return;
    }

    fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${initialToken}` },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Session expired');
        }

        return (await response.json()) as Omit<AuthResponse, 'token'>;
      })
      .then((data) => {
        setUser(data.user);
        setDefaultRoute(data.defaultRoute);
      })
      .catch(() => {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
        setDefaultRoute('Dashboard');
      })
      .finally(() => setIsCheckingSession(false));
  }, [initialToken]);

  const handleAuthenticated = (auth: AuthResponse, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;

    storage.setItem('auth_token', auth.token);
    otherStorage.removeItem('auth_token');
    setUser(auth.user);
    setDefaultRoute(auth.defaultRoute);
  };

  const handleLogout = () => {
    setPublicView('home');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    setUser(null);
    setDefaultRoute('Dashboard');
  };

  const handlePasswordChanged = (
    updatedUser: User,
    updatedDefaultRoute: AuthResponse['defaultRoute'],
  ) => {
    setUser(updatedUser);
    setDefaultRoute(updatedDefaultRoute);
  };

  if (isCheckingSession) {
    return <main className="session-loading">Loading your account...</main>;
  }

  return user ? user.mustChangePassword ? (
    <PasswordChange
      user={user}
      onChanged={handlePasswordChanged}
      onLogout={handleLogout}
    />
  ) : (
    <Dashboard
      user={user}
      defaultRoute={defaultRoute}
      onLogout={handleLogout}
      onUserUpdated={setUser}
    />
  ) : publicView === 'login' ? (
    <Login onAuthenticated={handleAuthenticated} onBackHome={() => setPublicView('home')} />
  ) : (
    <Home onSignIn={() => setPublicView('login')} />
  );
}

export default App;
