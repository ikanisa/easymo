'use client';

import { ReactNode, useEffect, useState } from 'react';

type ThemeOption = 'light' | 'dark' | 'system';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeOption;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: ThemeProviderProps) {
  const [theme, setTheme] = useState<Exclude<ThemeOption, 'system'>>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (next: Exclude<ThemeOption, 'system'>) => {
      setTheme(next);
    };

    const resolveSystemTheme = () => (mediaQuery.matches ? 'dark' : 'light');

    const update = () => {
      const resolved = defaultTheme === 'system' ? resolveSystemTheme() : defaultTheme;
      applyTheme(resolved as Exclude<ThemeOption, 'system'>);
    };

    update();

    if (defaultTheme === 'system') {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }

    return undefined;
  }, [defaultTheme]);

  useEffect(() => {
    const classList = document.documentElement.classList;
    classList.remove('light', 'dark');
    classList.add(theme);
  }, [theme]);

  return <>{children}</>;
}
