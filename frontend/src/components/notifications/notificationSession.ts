import type { AdminDashboardResponse } from '../../types/dashboard';
import { deriveNotifications, type NotificationItem } from './deriveNotifications';

export type NotificationState = {
  open: boolean;
  criticalOpen: boolean;
  items: NotificationItem[];
  loading: boolean;
  error: boolean;
  initialized: boolean;
};

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const initialState: NotificationState = {
  open: false,
  criticalOpen: false,
  items: [],
  loading: false,
  error: false,
  initialized: false,
};

let state = initialState;
let sessionToken: string | null = null;
let request: Promise<void> | null = null;
let requestVersion = 0;
const listeners = new Set<() => void>();

function authToken() {
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
}

export function publishNotificationState(next: Partial<NotificationState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeToNotifications(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getNotificationSnapshot() {
  return state;
}

export async function loadNotifications(initial: boolean) {
  const token = authToken();
  if (!token) return;

  if (token !== sessionToken) {
    sessionToken = token;
    state = initialState;
    request = null;
  }

  if (initial && (state.initialized || request)) return request ?? undefined;
  if (request) return request;

  publishNotificationState({ loading: true, error: false });
  const activeRequestVersion = ++requestVersion;
  const activeRequest = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/dashboard/admin`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Notification source unavailable');
      const data = await response.json() as AdminDashboardResponse;
      if (sessionToken !== token) return;

      const items = deriveNotifications(data);
      publishNotificationState({
        items,
        loading: false,
        error: false,
        initialized: true,
        criticalOpen: initial && items.some((item) => item.priority === 'critical'),
      });
    } catch {
      if (sessionToken === token) {
        publishNotificationState({ loading: false, error: true, initialized: true });
      }
    } finally {
      if (requestVersion === activeRequestVersion) request = null;
    }
  })();
  request = activeRequest;
  return request;
}

export function resetNotificationSession() {
  requestVersion += 1;
  sessionToken = null;
  request = null;
  state = initialState;
  listeners.forEach((listener) => listener());
}
