import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const listeners = new Set<() => void>();
const snapshot = (): Theme => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  listeners.forEach(update => update());
}

function storageChanged(event: StorageEvent) {
  if (event.key === 'koc_theme' || event.key === null) applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
}

function subscribe(update: () => void) {
  if (!listeners.size) window.addEventListener('storage', storageChanged);
  listeners.add(update);
  return () => {
    listeners.delete(update);
    if (!listeners.size) window.removeEventListener('storage', storageChanged);
  };
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem('koc_theme', theme); } catch { /* Theme remains usable when storage is unavailable. */ }
  applyTheme(theme);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, snapshot);
}
