'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';

interface CartFabProps {
  venueSlug: string;
  className?: string;
}

export function CartFab({ venueSlug, className }: CartFabProps) {
  const { totalItems, totalAmount } = useCart();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(totalItems > 0);
  }, [totalItems]);

  return (
    <AnimatePresence>
      {isVisible && (
        <Link href={`/${venueSlug}/cart`}>
          <motion.div
            initial={{ scale: 0, y: 100 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 100 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
              'fixed z-50',
              'w-16 h-16 rounded-full shadow-2xl',
              'bg-primary text-primary-foreground',
              'flex items-center justify-center',
              'cursor-pointer active:shadow-glow',
              'transition-all duration-200',
              className
            )}
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 24px)',
              right: '24px',
            }}
          >
            <div className="relative">
              <ShoppingBag className="w-7 h-7" />
              
              {/* Item count badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white text-xs font-bold rounded-full flex items-center justify-center"
              >
                {totalItems}
              </motion.div>
            </div>
          </motion.div>
        </Link>
      )}
    </AnimatePresence>
  );
}
