import { useEffect, useState } from 'react';

type ThemeMode = 'light' | 'dark';
const STORAGE_KEY = 'serula-theme';

function getInitialTheme(): ThemeMode {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Private browsing may block storage; fall back to system preference. */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* Theme still works for this session. */ }
  }, [theme]);

  return <button
    type="button"
    className="theme-toggle"
    aria-label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
    aria-pressed={theme === 'dark'}
    title={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
    onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
  ><span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span><span>{theme === 'dark' ? 'Koyu tema' : 'Açık tema'}</span></button>;
}
