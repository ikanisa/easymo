'use client';

import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import type { MenuCategory } from '@/types/menu';

interface CategoryTabsProps {
  categories: MenuCategory[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  activeCategory,
  onCategoryChange,
}: CategoryTabsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const { trigger } = useHaptics();

  // Scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();

      const scrollLeft =
        tabRect.left -
        containerRect.left -
        containerRect.width / 2 +
        tabRect.width / 2;

      container.scrollTo({
        left: container.scrollLeft + scrollLeft,
        behavior: 'smooth',
      });
    }
  }, [activeCategory]);

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      trigger('selection');
      onCategoryChange(categoryId);
    },
    [onCategoryChange, trigger]
  );

  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto hide-scrollbar scroll-smooth px-4 py-3 gap-2"
      >
        {categories.map((category) => {
          const isActive = category.id === activeCategory;
          return (
            <motion.button
              key={category.id}
              ref={isActive ? activeRef : null}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleCategoryPress(category.id)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full',
                'text-sm font-medium whitespace-nowrap',
                'transition-all duration-200',
                'touch-manipulation tap-highlight-none',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <span className="mr-1.5">{category.emoji}</span>
              {category.name}
              {category.item_count && (
                <span className="ml-1.5 opacity-70">({category.item_count})</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
