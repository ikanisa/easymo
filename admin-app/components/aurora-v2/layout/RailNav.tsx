'use client';

import { AnimatePresence,motion } from 'framer-motion';
import {
  Bot,
  Briefcase,
  Building,
  HelpCircle,
  Home,
  type LucideIcon,
  MessageCircle,
  Moon,
  Phone,
  Shield,
  Store,
  Sun,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Users, label: 'Users', href: '/users' },
  { icon: Store, label: 'Marketplace', href: '/marketplace' },
  { icon: MessageCircle, label: 'WhatsApp', href: '/whatsapp' },
  { icon: Phone, label: 'Calls', href: '/calls' },
  { icon: Briefcase, label: 'Jobs', href: '/jobs' },
  { icon: Building, label: 'Property', href: '/property' },
  { icon: Bot, label: 'AI Agents', href: '/agents' },
];

interface RailNavProps {
  expanded: boolean;
}

export function RailNav({ expanded }: RailNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin scrollbar-thumb-aurora-border scrollbar-track-transparent">
      <ul className="space-y-1 px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'transition-all duration-200 group relative',
                  isActive
                    ? 'bg-aurora-accent text-white shadow-glow-sm'
                    : 'hover:bg-aurora-surface-elevated text-aurora-text-secondary'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 flex-shrink-0 transition-colors',
                    isActive
                      ? 'text-white'
                      : 'text-aurora-text-muted group-hover:text-aurora-accent'
                  )}
                />

                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.2 }}
                      className="font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {/* Active indicator */}
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-aurora-accent rounded-xl -z-10"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            </li>
          );
        })}

        {/* Divider */}
        <li className="py-2">
          <div className="h-px bg-aurora-border" />
        </li>

        {/* Bottom items */}
        <li>
          <Link
            href="/help"
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl',
              'transition-all duration-200 group',
              'hover:bg-aurora-surface-elevated text-aurora-text-secondary'
            )}
          >
            <HelpCircle className="w-5 h-5 flex-shrink-0 text-aurora-text-muted group-hover:text-aurora-accent" />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="font-medium whitespace-nowrap overflow-hidden"
                >
                  Help
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
