'use client';

import { memo, useCallback } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Plus, Flame, Leaf } from 'lucide-react';
import { clsx } from 'clsx';
import { useCart } from '@/hooks/useCart';
import { useHaptics } from '@/hooks/useHaptics';
import { formatPrice } from '@/lib/format';
import type { MenuItem } from '@/types/menu';

interface MenuItemCardProps {
  item: MenuItem;
  onPress?: () => void;
  variant?: 'default' | 'compact';
}

export const MenuItemCard = memo(function MenuItemCard({
  item,
  onPress,
  variant = 'default',
}: MenuItemCardProps) {
  const { addItem, getItemQuantity } = useCart();
  const { trigger } = useHaptics();
  const quantity = getItemQuantity(item.id);

  const handleQuickAdd = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      trigger('light');
      addItem({
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        currency: item.currency,
        imageUrl: item.image_url,
      });
    },
    [addItem, item, trigger]
  );

  const handlePress = useCallback(() => {
    if (onPress) {
      trigger('selection');
      onPress();
    }
  }, [onPress, trigger]);

  if (variant === 'compact') {
    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={handlePress}
        className={clsx(
          'flex items-center gap-3 p-3 rounded-xl',
          'bg-card border border-border',
          'active:bg-accent transition-colors',
          'touch-manipulation cursor-pointer'
        )}
      >
        {/* Image */}
        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          {item.image_url ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              sizes="64px"
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-muted flex items-center justify-center text-2xl">
              {item.emoji || '🍽️'}
            </div>
          )}
          {quantity > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
              {quantity}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{item.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1">
            {item.description}
          </p>
          <p className="text-primary font-semibold mt-1">
            {formatPrice(item.price, item.currency)}
          </p>
        </div>

        {/* Quick Add */}
        <button
          onClick={handleQuickAdd}
          className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center',
            'bg-primary text-primary-foreground',
            'active:scale-90 transition-transform'
          )}
          aria-label={`Add ${item.name} to cart`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handlePress}
      className={clsx(
        'group relative overflow-hidden rounded-2xl',
        'bg-card border border-border',
        'active:border-primary/50 transition-colors',
        'touch-manipulation cursor-pointer'
      )}
    >
      {/* Image */}
      <div className="relative w-full aspect-square overflow-hidden bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            sizes="50vw"
            className="object-cover group-active:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {item.emoji || '🍽️'}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {item.is_popular && (
            <span className="px-2 py-0.5 bg-red-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-full flex items-center gap-1">
              <Flame className="w-3 h-3" /> Popular
            </span>
          )}
          {item.is_vegetarian && (
            <span className="px-2 py-0.5 bg-green-500/90 backdrop-blur-sm text-white text-xs font-medium rounded-full flex items-center gap-1">
              <Leaf className="w-3 h-3" /> Veg
            </span>
          )}
        </div>

        {/* Quantity Badge */}
        {quantity > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-7 h-7 bg-primary text-primary-foreground text-sm font-bold rounded-full flex items-center justify-center shadow-lg"
          >
            {quantity}
          </motion.div>
        )}

        {/* Quick Add Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleQuickAdd}
          className={clsx(
            'absolute bottom-3 right-3',
            'w-11 h-11 rounded-full',
            'bg-primary text-primary-foreground shadow-lg',
            'flex items-center justify-center'
          )}
          aria-label={`Add ${item.name} to cart`}
        >
          <Plus className="w-5 h-5" />
        </motion.button>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-2">
          <p className="text-lg font-bold text-primary">
            {formatPrice(item.price, item.currency)}
          </p>
          {item.prep_time_minutes && (
            <span className="text-xs text-muted-foreground">
              ~{item.prep_time_minutes} min
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
