import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'lgu-theme';
const listeners = new Set<() => void>();

const readTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage can be blocked; fall through to the system preference.
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

let current: Theme = readTheme();

// The public site is always light; dark mode only applies once staff are signed in.
let staffArea = false;

const apply = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', staffArea && theme === 'dark');
};

export function setStaffArea(active: boolean) {
  staffArea = active;
  apply(current);
}

export function setTheme(theme: Theme) {
  current = theme;
  // Cards with `transition-all` would fade their colours while everything else flips at once, which reads as
  // flicker. Suspend transitions for the switch, force a style flush, then restore them.
  const root = document.documentElement;
  root.classList.add('theme-switching');
  apply(theme);
  void root.offsetHeight;
  window.setTimeout(() => root.classList.remove('theme-switching'), 60);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors; the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current
  );
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), []);
  return { theme, toggle };
}
