export type Theme = 'ink' | 'paper';

const KEY = 'molan-theme';

export function getStoredTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'paper' ? 'paper' : 'ink';
  } catch {
    return 'ink';
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(KEY, theme); } catch {}
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'paper' ? '#f7f0e2' : '#05060a');
}
