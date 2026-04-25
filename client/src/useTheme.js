import { useEffect, useState } from 'react';

const STORAGE_KEY = 'monopoly-theme';
const THEMES = ['monopoly-dark', 'monopoly-light'];

function detectInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (THEMES.includes(saved)) return saved;
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'monopoly-dark' : 'monopoly-light';
}

export function useTheme() {
  const [theme, setTheme] = useState(detectInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () =>
    setTheme(t => (t === 'monopoly-dark' ? 'monopoly-light' : 'monopoly-dark'));

  return { theme, toggle, isDark: theme === 'monopoly-dark' };
}
