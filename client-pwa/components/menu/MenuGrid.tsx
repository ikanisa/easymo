'use client';

import { MenuItemCard } from './MenuItemCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { MenuItem } from '@/types/menu';

interface MenuGridProps {
  items: MenuItem[];
  venueSlug: string;
  isLoading?: boolean;
  onItemClick?: (item: MenuItem) => void;
}

export function MenuGrid({ items, venueSlug, isLoading, onItemClick }: MenuGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-2xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
        <p className="text-sm text-muted-foreground text-center">
          Try selecting a different category
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {items.map((item) => (
        <MenuItemCard
          key={item.id}
          item={item}
          venueSlug={venueSlug}
          onPress={() => onItemClick?.(item)}
        />
      ))}
    </div>
  );
}
