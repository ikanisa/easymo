'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS, NavGroup } from './nav-items';

const GROUP_ORDER: NavGroup[] = ['Overview', 'Operations', 'Messaging', 'Platform'];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="sidebar">
      <div className="sidebar__title">Admin Panel</div>
      {GROUP_ORDER.map((group) => {
        const groupItems = NAV_ITEMS.filter((item) => item.group === group);
        return (
          <div key={group} className="sidebar__section">
            <div className="sidebar__section-title">{group}</div>
            <ul className="sidebar__list">
              {groupItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <li key={item.href} className="sidebar__item">
                    <Link
                      href={item.href}
                      className={isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link'}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="sidebar__link-label">{item.label}</span>
                      <span className="sidebar__link-description">{item.description}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
