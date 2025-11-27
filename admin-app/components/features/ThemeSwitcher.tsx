/**
 * Aurora Theme Switcher Component
 * Dark mode toggle with persistence
 */

'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

type Theme = 'light' | 'dark' | 'system';

export interface ThemeSwitcherProps {
  variant?: 'toggle' | 'dropdown';
  className?: string;
}

export function ThemeSwitcher({ variant = 'toggle', className }: ThemeSwitcherProps) {
  const [theme, setTheme] = useState<Theme>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('aurora-theme') as Theme;
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme('system');
      applyTheme(systemTheme);
    }
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const resolvedTheme = newTheme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : newTheme;
    
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('aurora-theme', newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) return null;

  if (variant === 'toggle') {
    return (
      <button
        onClick={() => handleThemeChange(theme === 'light' ? 'dark' : 'light')}
        className={cn(
          'relative inline-flex items-center justify-center w-10 h-10',
          'rounded-lg bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
          'hover:bg-[var(--aurora-surface-muted)] transition-all duration-200',
          className
        )}
      >
        <motion.div animate={{ rotate: theme === 'dark' ? 180 : 0 }} transition={{ duration: 0.3 }}>
          {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </motion.div>
      </button>
    );
  }

  return (
    <div className={cn('flex gap-1 p-1 rounded-lg bg-[var(--aurora-surface-muted)]', className)}>
      {(['light', 'dark', 'system'] as Theme[]).map((t) => (
        <button
          key={t}
          onClick={() => handleThemeChange(t)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
            theme === t ? 'bg-[var(--aurora-surface)] shadow-sm' : 'hover:text-[var(--aurora-text-primary)]'
          )}
        >
          {t === 'light' && <Sun className="w-4 h-4" />}
          {t === 'dark' && <Moon className="w-4 h-4" />}
          {t === 'system' && <Monitor className="w-4 h-4" />}
          {t}
        </button>
      ))}
    </div>
  );
}
