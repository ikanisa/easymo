'use client';

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { CartItem as CartItemType } from '@/types/cart';

interface CartItemProps {
  item: CartItemType;
  className?: string;
}

export const CartItem = memo(function CartItem({ item, className }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const { trigger } = useHaptics();

  const handleIncrease = useCallback(() => {
    trigger('light');
    updateQuantity(item.id, 1);
  }, [item.id, trigger, updateQuantity]);

  const handleDecrease = useCallback(() => {
    trigger('light');
    if (item.quantity === 1) {
      removeItem(item.id);
    } else {
      updateQuantity(item.id, -1);
    }
  }, [item.id, item.quantity, trigger, updateQuantity, removeItem]);

  const handleRemove = useCallback(() => {
    trigger('medium');
    removeItem(item.id);
  }, [item.id, trigger, removeItem]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        'flex gap-3 p-3 rounded-xl bg-card border border-border',
        className
      )}
    >
      {/* Image */}
      <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-2xl">{item.emoji || '🍽️'}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-foreground truncate">{item.name}</h4>
            {item.special_instructions && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                Note: {item.special_instructions}
              </p>
            )}
          </div>
          <button
            onClick={handleRemove}
            className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors text-destructive"
            aria-label="Remove item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          {/* Price */}
          <span className="font-semibold text-primary">
            {formatPrice(item.price * item.quantity, item.currency)}
          </span>

          {/* Quantity Controls */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleDecrease}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-secondary text-secondary-foreground',
                'active:bg-secondary/80 transition-colors',
                'touch-manipulation'
              )}
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </motion.button>

            <span className="w-8 text-center font-semibold">{item.quantity}</span>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleIncrease}
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center',
                'bg-primary text-primary-foreground',
                'active:bg-primary/90 transition-colors',
                'touch-manipulation'
              )}
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
