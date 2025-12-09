'use client';

/**
 * BottomNav - Mobile-friendly navigation for Vendor Portal
 * Home, Members, Groups, Transactions, Reports, Settings
 */

import { 
  BarChart3, 
  FileText, 
  Home, 
  Settings, 
  UserPlus,
  Users 
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

const navItems: NavItem[] = [
  { href: '/vendor-portal', label: 'Home', icon: Home },
  { href: '/vendor-portal/members', label: 'Members', icon: UserPlus },
  { href: '/vendor-portal/groups', label: 'Groups', icon: Users },
  { href: '/vendor-portal/transactions', label: 'Transactions', icon: FileText },
  { href: '/vendor-portal/reports', label: 'Reports', icon: BarChart3 },
  { href: '/vendor-portal/settings', label: 'Settings', icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="vp-nav">
      {navItems.map((item) => {
        // Check if current path matches the nav item
        const isActive = pathname === item.href || 
          (item.href !== '/vendor-portal' && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`vp-nav__item ${isActive ? 'vp-nav__item--active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="vp-nav__icon" aria-hidden="true" />
            <span className="vp-nav__label">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
