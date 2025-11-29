'use client';

import { Bell, Menu, Moon, Search, Settings, Sun,User } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { cn } from '@/lib/utils';

interface GlassHeaderProps {
  onMenuClick?: () => void;
}

export function GlassHeader({ onMenuClick }: GlassHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 h-14',
        'glass-header backdrop-blur-xl',
        'border-b border-aurora-border-subtle',
        'transition-all duration-300'
      )}
    >
      <div className="h-full max-w-full mx-auto px-4 flex items-center gap-4">
        {/* Mobile Menu Button */}
        <button
          onClick={onMenuClick}
          className={cn(
            'lg:hidden p-2 rounded-lg',
            'hover:bg-aurora-surface-elevated',
            'transition-colors duration-150',
            'text-aurora-text-secondary hover:text-aurora-text-primary'
          )}
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-aurora-accent to-purple-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">EM</span>
          </div>
          <span className="font-semibold text-lg hidden sm:block text-aurora-text-primary">
            EasyMO
          </span>
        </Link>

        {/* Global Search */}
        <div className="flex-1 max-w-xl mx-auto">
          <button
            onClick={() => setSearchOpen(true)}
            className={cn(
              'w-full h-9 px-3 rounded-lg',
              'bg-aurora-surface border border-aurora-border',
              'flex items-center gap-2',
              'hover:border-aurora-accent/30 transition-all duration-200',
              'text-aurora-text-muted text-sm'
            )}
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search...</span>
            <kbd className="ml-auto hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-xs bg-aurora-surface-muted rounded border border-aurora-border">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <NotificationBell />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Settings */}
          <Link
            href="/settings"
            className={cn(
              'p-2 rounded-lg',
              'hover:bg-aurora-surface-elevated',
              'transition-colors duration-150',
              'text-aurora-text-secondary hover:text-aurora-text-primary',
              'hidden sm:flex'
            )}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function NotificationBell() {
  const [hasNotifications] = useState(true);

  return (
    <button
      className={cn(
        'relative p-2 rounded-lg',
        'hover:bg-aurora-surface-elevated',
        'transition-colors duration-150',
        'text-aurora-text-secondary hover:text-aurora-text-primary'
      )}
      aria-label="Notifications"
    >
      <Bell className="w-5 h-5" />
      {hasNotifications && (
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aurora-error rounded-full ring-2 ring-aurora-surface" />
      )}
    </button>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'p-2 rounded-lg',
        'hover:bg-aurora-surface-elevated',
        'transition-colors duration-150',
        'text-aurora-text-secondary hover:text-aurora-text-primary'
      )}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}

function UserMenu() {
  return (
    <button
      className={cn(
        'flex items-center gap-2 p-1.5 rounded-lg',
        'hover:bg-aurora-surface-elevated',
        'transition-colors duration-150'
      )}
      aria-label="User menu"
    >
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-aurora-accent to-purple-600 flex items-center justify-center">
        <User className="w-4 h-4 text-white" />
      </div>
      <span className="hidden md:inline text-sm font-medium text-aurora-text-primary">
        Admin
      </span>
    </button>
  );
}
