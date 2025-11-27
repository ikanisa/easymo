'use client';

import { useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { MenuItemCard } from './MenuItemCard';
import { useViewTransition } from '@/lib/view-transitions';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  description?: string;
  is_featured?: boolean;
  [key: string]: unknown;
}

interface VirtualizedMenuListProps {
  items: MenuItem[];
  venueSlug: string;
  estimatedItemHeight?: number;
}

export const VirtualizedMenuList = memo(function VirtualizedMenuList({
  items,
  venueSlug,
  estimatedItemHeight = 300,
}: VirtualizedMenuListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { navigate } = useViewTransition();

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan: 5,
    paddingStart: 16,
    paddingEnd: 100,
  });

  const handleItemPress = useCallback((item: MenuItem) => {
    navigate(`/${venueSlug}/item/${item.id}`, { type: 'zoom' });
  }, [venueSlug, navigate]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto scroll-smooth hide-scrollbar"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          className="grid grid-cols-2 gap-4 px-4"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            const isFeature = virtualItem.index === 0 || item.is_featured;
            
            return (
              <motion.div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(virtualItem.index * 0.05, 0.3) }}
                className={isFeature ? 'col-span-2' : ''}
              >
                <MenuItemCard
                  item={item}
                  venueSlug={venueSlug}
                  variant={isFeature ? 'featured' : 'default'}
                  onPress={() => handleItemPress(item)}
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
