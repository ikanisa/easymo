'use client';

import { Bell, LogOut, Menu, Moon, Search, Settings, Sun, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSupabaseAuth } from '@/components/providers/SupabaseAuthProvider';
import { cn } from '@/lib/utils';

interface GlassHeaderProps {
  onMenuClick?: () => void;
}

export function GlassHeader({ onMenuClick }: GlassHeaderProps) {
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
  const { user, signOut, status } = useSupabaseAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Get display name from user metadata or email
  const displayName = (() => {
    if (!user) return 'Admin';
    const fullName = (user.user_metadata as Record<string, unknown> | undefined)?.full_name;
    if (typeof fullName === 'string' && fullName) {
      return fullName;
    }
    if (user.email) {
      return user.email.split('@')[0];
    }
    return 'Admin';
  })();

  // Get initials for avatar
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  if (status === 'loading') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 p-1.5 rounded-lg',
          'animate-pulse'
        )}
      >
        <div className="w-7 h-7 rounded-full bg-gray-300" />
        <div className="hidden md:block w-16 h-4 bg-gray-300 rounded" />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 p-1.5 rounded-lg',
          'hover:bg-aurora-surface-elevated',
          'transition-colors duration-150'
        )}
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-aurora-accent to-purple-600 flex items-center justify-center">
          {initials ? (
            <span className="text-white text-xs font-medium">{initials}</span>
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </div>
        <span className="hidden md:inline text-sm font-medium text-aurora-text-primary max-w-[120px] truncate">
          {displayName}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          
          {/* Menu */}
          <div 
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              'w-56 rounded-lg shadow-lg',
              'bg-white border border-gray-200',
              'py-1'
            )}
            role="menu"
            aria-orientation="vertical"
          >
            {/* User Info */}
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              {user?.email && (
                <p className="text-xs text-gray-500 truncate">{user.email}</p>
              )}
            </div>

            {/* Settings Link */}
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className={cn(
                'flex items-center gap-2 px-4 py-2',
                'text-sm text-gray-700',
                'hover:bg-gray-100 transition-colors'
              )}
              role="menuitem"
            >
              <Settings className="w-4 h-4" />
              Settings
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-2',
                'text-sm text-red-600',
                'hover:bg-red-50 transition-colors'
              )}
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
