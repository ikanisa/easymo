'use client';

import { useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useCart } from '@/stores/cart.store';

interface CartFabProps {
  onClick: () => void;
}

export function CartFab({ onClick }: CartFabProps) {
  const { totalItems } = useCart();
  const [isPressed, setIsPressed] = useState(false);

  if (totalItems === 0) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      whileTap={{ scale: 0.9 }}
      onTapStart={() => setIsPressed(true)}
      onTap={() => setIsPressed(false)}
      onTapCancel={() => setIsPressed(false)}
      onClick={onClick}
      className={cn(
        'fixed z-40',
        'w-14 h-14 rounded-full',
        'bg-primary text-primary-foreground shadow-lg shadow-primary/50',
        'flex items-center justify-center',
        'transition-all duration-150',
        'touch-manipulation tap-highlight-none'
      )}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)',
        right: '1rem',
      }}
      aria-label={`View cart (${totalItems} items)`}
    >
      <ShoppingCart className="w-6 h-6" />
      
      {/* Badge */}
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0 }}
          className="absolute -top-1 -right-1 w-6 h-6 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center shadow-lg"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </motion.div>
      </AnimatePresence>

      {/* Ripple Effect */}
      {isPressed && (
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 rounded-full bg-primary"
        />
      )}
    </motion.button>
  );
}
