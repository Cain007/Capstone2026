import { useEffect, useState } from 'react';
import './App.css';
import Dashboard from './pages/dashboard';
import Login from './pages/login';
import type { AuthResponse, User } from './types/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function App() {
  const [user, setUser] = useState<User | null>(null);
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

        return (await response.json()) as { user: User };
      })
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_token');
      })
      .finally(() => setIsCheckingSession(false));
  }, [initialToken]);

  const handleAuthenticated = (auth: AuthResponse, remember: boolean) => {
    const storage = remember ? localStorage : sessionStorage;
    const otherStorage = remember ? sessionStorage : localStorage;

    storage.setItem('auth_token', auth.token);
    otherStorage.removeItem('auth_token');
    setUser(auth.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    setUser(null);
  };

  if (isCheckingSession) {
    return <main className="session-loading">Loading your account...</main>;
  }

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <Login onAuthenticated={handleAuthenticated} />
  );
}

export default App;
