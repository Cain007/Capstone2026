import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../shadcn/ui/sheet';
import type { DashboardPageName } from '../../pages/dashboard-pages/_shared/DashboardPageShell';
import {
  getNotificationSnapshot,
  loadNotifications,
  publishNotificationState,
  subscribeToNotifications,
} from './notificationSession';
import './styles.css';

type Props = { onNavigate?: (page: DashboardPageName) => void; onOpen?: () => void };

export default function NotificationCenter({ onNavigate, onOpen }: Props) {
  const { open, criticalOpen, items, loading, error } = useSyncExternalStore(
    subscribeToNotifications,
    getNotificationSnapshot,
    getNotificationSnapshot,
  );
  const bell = useRef<HTMLButtonElement>(null);
  const criticalItems = items.filter((item) => item.priority === 'critical');

  useEffect(() => {
    void loadNotifications(true);
  }, []);

  const closeCritical = () => publishNotificationState({ criticalOpen: false });
  const openPanel = () => {
    onOpen?.();
    publishNotificationState({ open: true });
  };

  return <>
    <button ref={bell} type="button" className="app-shell__icon-button notification-bell" title="Notifications" aria-label={`Notifications${items.length ? `, ${items.length} current alerts` : ''}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { openPanel(); void loadNotifications(false); }}>
      <Bell aria-hidden="true" />
      {items.length > 0 && <span className="notification-count" aria-hidden="true">{items.length > 99 ? '99+' : items.length}</span>}
    </button>
    <Sheet open={open} onOpenChange={(nextOpen) => publishNotificationState({ open: nextOpen })}>
      <SheetContent className="notification-panel" finalFocus={bell}>
        <SheetHeader className="notification-header">
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>Current items requiring operational attention.</SheetDescription>
        </SheetHeader>
        <div className="notification-toolbar">
          <span role="status">{loading ? 'Loading notifications...' : error ? 'Notifications unavailable' : `${items.length} active condition groups`}</span>
          <button type="button" className="app-shell__icon-button" disabled={loading} title="Refresh notifications" aria-label="Refresh notifications" onClick={() => void loadNotifications(false)}><RefreshCw size={16} aria-hidden="true" /></button>
        </div>
        <div className="notification-scroll" aria-busy={loading}>
          {loading ? <div className="notification-state"><Spinner label="Loading current conditions" /></div> : error ? <div className="notification-state" role="alert"><h3>Unable to load notifications.</h3><button type="button" onClick={() => void loadNotifications(false)}>Retry</button></div> : items.length === 0 ? <div className="notification-state"><h3>No current notifications.</h3><p>There are no operational items requiring attention right now.</p></div> : <ul>
            {items.map((item) => <li key={item.id} className={`notification-row notification-row--${item.priority}`}>
              {item.priority === 'info' ? <Info size={18} aria-hidden="true" /> : <TriangleAlert size={18} aria-hidden="true" />}
              <div><div className="notification-meta">{item.category} / {item.priority}</div><h3>{item.title}</h3><p>{item.message}</p><button type="button" onClick={() => { publishNotificationState({ open: false }); onNavigate?.(item.targetPage); }}>Open {item.targetPage === 'Forecasting' ? 'Predictive Analysis' : item.targetPage}</button></div>
            </li>)}
          </ul>}
        </div>
      </SheetContent>
    </Sheet>
    {createPortal(<Modal
      open={criticalOpen}
      title="Critical Inventory Attention"
      description="There are critical inventory conditions that require attention."
      onClose={closeCritical}
      width="480px"
      footer={<>
        <Button variant="secondary" onClick={closeCritical}>Dismiss</Button>
        <Button onClick={() => { closeCritical(); openPanel(); }}>View Notifications</Button>
      </>}
    >
      <ul className="notification-critical-list">
        {criticalItems.map((item) => <li key={item.id}><strong>{item.title}</strong><span>{item.message}</span></li>)}
      </ul>
    </Modal>, document.body)}
  </>;
}
