import { useEffect, useRef, useState } from 'react';
import { Bell, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import Spinner from '../ui/Spinner';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../shadcn/ui/sheet';
import type { AdminDashboardResponse } from '../../types/dashboard';
import type { DashboardPageName } from '../../pages/dashboard-pages/_shared/DashboardPageShell';
import { deriveNotifications, type NotificationItem } from './deriveNotifications';
import './styles.css';

type Props = { onNavigate?: (page: DashboardPageName) => void; onOpen?: () => void };
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export default function NotificationCenter({ onNavigate, onOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const bell = useRef<HTMLButtonElement>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function refresh() {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(false);
    setItems([]);
    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/dashboard/admin`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}, signal: request.signal,
      });
      if (!response.ok) throw new Error('Notification source unavailable');
      const data = await response.json() as AdminDashboardResponse;
      const next = deriveNotifications(data);
      if (!request.signal.aborted) setItems(next);
    } catch {
      if (!request.signal.aborted) setError(true);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }

  return <>
    <button ref={bell} type="button" className="app-shell__icon-button notification-bell" title="Notifications" aria-label={`Notifications${items.length ? `, ${items.length} active condition groups` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { onOpen?.(); setOpen(true); void refresh(); }}>
      <Bell aria-hidden="true" />
      {items.length > 0 && <span className="notification-count" aria-hidden="true">{items.length > 99 ? '99+' : items.length}</span>}
    </button>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="notification-panel" finalFocus={bell}>
        <SheetHeader className="notification-header">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Current items requiring operational attention.</SheetDescription>
        </SheetHeader>
        <div className="notification-toolbar">
          <span role="status">{loading ? 'Loading notifications...' : error ? 'Notifications unavailable' : `${items.length} active condition groups`}</span>
          <button type="button" className="app-shell__icon-button" disabled={loading} title="Refresh notifications" aria-label="Refresh notifications" onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true" /></button>
        </div>
        <div className="notification-scroll" aria-busy={loading}>
          {loading ? <div className="notification-state"><Spinner label="Loading current conditions" /></div> : error ? <div className="notification-state" role="alert"><h3>Unable to load notifications.</h3><button type="button" onClick={() => void refresh()}>Retry</button></div> : items.length === 0 ? <div className="notification-state"><h3>No current notifications.</h3><p>There are no operational items requiring attention right now.</p></div> : <ul>
            {items.map(item => <li key={item.id} className={`notification-row notification-row--${item.priority}`}>
              {item.priority === 'info' ? <Info size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
              <div><div className="notification-meta">{item.category} / {item.priority}</div><h3>{item.title}</h3><p>{item.message}</p><button type="button" onClick={() => { setOpen(false); onNavigate?.(item.targetPage); }}>Open {item.targetPage === 'Forecasting' ? 'Predictive Analysis' : item.targetPage}</button></div>
            </li>)}
          </ul>}
        </div>
      </SheetContent>
    </Sheet>
  </>;
}
