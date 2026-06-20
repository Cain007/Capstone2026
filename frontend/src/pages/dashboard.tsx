import type { User } from '../types/auth';

type DashboardProps = {
  user: User;
  onLogout: () => void;
};

export default function Dashboard({ user, onLogout }: DashboardProps) {
  return (
    <main className="dashboard">
      <section className="dashboard-panel">
        <p className="dashboard-label">Authenticated account</p>
        <h1>Welcome to your dashboard</h1>
        <p className="dashboard-email">{user.email}</p>
        <button type="button" className="logout-button" onClick={onLogout}>
          Log out
        </button>
      </section>
    </main>
  );
}
