'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Home, Search, ShoppingBag, User, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';

interface BottomNavProps {
  venueSlug?: string;
}

export function BottomNav({ venueSlug }: BottomNavProps) {
  const pathname = usePathname();
  const { totalItems } = useCart();
  const { trigger } = useHaptics();

  const navItems = [
    {
      href: venueSlug ? `/${venueSlug}` : '/',
      icon: Home,
      label: 'Menu',
      matchPaths: ['/[venueSlug]', '/'],
    },
    {
      href: venueSlug ? `/${venueSlug}/search` : '/search',
      icon: Search,
      label: 'Search',
      matchPaths: ['/search', '/[venueSlug]/search'],
    },
    {
      href: '/scan',
      icon: QrCode,
      label: 'Scan',
      isCenter: true,
      matchPaths: ['/scan'],
    },
    {
      href: venueSlug ? `/${venueSlug}/cart` : '/cart',
      icon: ShoppingBag,
      label: 'Cart',
      badge: totalItems > 0 ? totalItems : undefined,
      matchPaths: ['/cart', '/[venueSlug]/cart'],
    },
    {
      href: '/profile',
      icon: User,
      label: 'Profile',
      matchPaths: ['/profile', '/orders'],
    },
  ];

  const handleNavClick = () => {
    trigger('selection');
  };

  return (
    <nav className={cn(
      'fixed bottom-0 inset-x-0 z-40',
      'bg-background/80 backdrop-blur-xl',
      'border-t border-border',
      'pb-safe'
    )}>
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = item.matchPaths.some((path) => {
            if (path.includes('[')) {
              return pathname.includes(path.replace(/\[.*?\]/g, ''));
            }
            return pathname === path;
          });

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className="relative -mt-6"
              >
                <motion.div
                  whileTap={{ scale: 0.9 }}
                  className={cn(
                    'w-14 h-14 rounded-full',
                    'bg-gradient-to-br from-primary to-amber-500',
                    'flex items-center justify-center',
                    'shadow-lg shadow-primary/30',
                    'ring-4 ring-background'
                  )}
                >
                  <item.icon className="w-6 h-6 text-primary-foreground" />
                </motion.div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className="relative flex flex-col items-center justify-center w-16 h-full"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={cn(
                  'flex flex-col items-center gap-1',
                  'transition-colors duration-200'
                )}
              >
                <div className="relative">
                  <item.icon
                    className={cn(
                      'w-6 h-6 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  
                  {item.badge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        'absolute -top-1.5 -right-1.5',
                        'min-w-[18px] h-[18px] px-1',
                        'flex items-center justify-center',
                        'bg-primary text-primary-foreground',
                        'text-[10px] font-bold rounded-full'
                      )}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </motion.span>
                  )}
                </div>
                
                <span
                  className={cn(
                    'text-[10px] font-medium transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {item.label}
                </span>
              </motion.div>

              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-0.5 w-8 h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
