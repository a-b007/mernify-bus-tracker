import { useEffect } from 'react';
import { useThemeStore } from '../stores/theme';

export function useTheme() {
  const { theme, toggle, setTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bus-twin-theme', theme);
  }, [theme]);

  // Listen for OS-level changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      // Only follow OS if user hasn't explicitly set a preference
      if (!localStorage.getItem('bus-twin-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setTheme]);

  return { theme, toggle, setTheme } as const;
}
