'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  BookOpen,
  Package,
  Users,
  BarChart3,
  CreditCard,
  Settings,
  ChefHat,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, shortcut: '1' },
  { name: 'Orders', href: '/orders', icon: ShoppingBag, shortcut: '2' },
  { name: 'Tables', href: '/tables', icon: Utensils, shortcut: '3' },
  { name: 'Menu', href: '/menu', icon: BookOpen, shortcut: '4' },
  { name: 'Inventory', href: '/inventory', icon: Package, shortcut: '5' },
  { name: 'Staff', href: '/staff', icon: Users, shortcut: '6' },
  { name: 'Analytics', href: '/analytics', icon: BarChart3, shortcut: '7' },
  { name: 'Settings', href: '/settings', icon: Settings, shortcut: '9' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  useKeyboardShortcuts({
    'mod+\\': () => setSidebarOpen(!sidebarOpen),
  });

  return (
    <div className="flex h-screen bg-zinc-950">
      <aside className={cn('flex flex-col border-r border-zinc-800 bg-zinc-900 transition-all', sidebarOpen ? 'w-64' : 'w-16')}>
        <div className="flex h-14 items-center border-b border-zinc-800 px-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <ChefHat className="h-6 w-6 text-amber-500" />
              <span className="text-lg font-bold text-white">Bar Manager</span>
            </div>
          ) : (
            <ChefHat className="h-6 w-6 text-amber-500 mx-auto" />
          )}
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                )}
              >
                <item.icon className="h-5 w-5" />
                {sidebarOpen && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-zinc-800 p-2">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex w-full items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
