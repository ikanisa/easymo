'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart, PlusCircle, MessageCircle, User, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileNavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  primary?: boolean;
}

const items: MobileNavItem[] = [
  { icon: Home, label: 'Home', href: '/dashboard' },
  { icon: BarChart, label: 'Analytics', href: '/analytics' },
  { icon: PlusCircle, label: 'Create', href: '/create', primary: true },
  { icon: MessageCircle, label: 'Messages', href: '/messages' },
  { icon: User, label: 'Profile', href: '/profile' },
];

interface MobileBottomNavProps {
  className?: string;
}

export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'glass-surface border-t border-aurora-border',
        'pb-safe', // iOS safe area
        className
      )}
    >
      <ul className="flex items-center justify-around h-16 px-2">
        {items.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-2xl',
                  'transition-all duration-200',
                  item.primary
                    ? 'bg-aurora-accent text-white shadow-glow-sm scale-110 -mt-4'
                    : isActive
                      ? 'text-aurora-accent'
                      : 'text-aurora-text-muted'
                )}
              >
                <Icon className={cn('w-6 h-6', item.primary && 'w-7 h-7')} />
                <span className={cn('text-xs font-medium', item.primary && 'sr-only')}>
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
