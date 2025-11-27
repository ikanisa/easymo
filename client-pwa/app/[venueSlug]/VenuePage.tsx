'use client';

import { useState, useMemo } from 'react';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { CartSheet } from '@/components/cart/CartSheet';
import { CartFab } from '@/components/layout/CartFab';
import type { MenuItem, MenuCategory } from '@/types/menu';
import type { Venue } from '@/types/venue';

interface VenuePageProps {
  venue: Venue;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  tableNumber?: string;
}

export function VenuePage({ venue, categories, menuItems, tableNumber }: VenuePageProps) {
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || '');
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredItems = useMemo(() => {
    if (!activeCategory) return menuItems;
    return menuItems.filter(item => item.category_id === activeCategory);
  }, [menuItems, activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            {venue.logo_url ? (
              <img
                src={venue.logo_url}
                alt={venue.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">🍽️</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-xl font-bold">{venue.name}</h1>
              {tableNumber && (
                <p className="text-sm text-muted-foreground">Table {tableNumber}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      {categories.length > 0 && (
        <CategoryTabs
          categories={categories}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      )}

      {/* Menu Grid */}
      <MenuGrid
        items={filteredItems}
        venueSlug={venue.slug}
      />

      {/* Cart FAB */}
      <CartFab onClick={() => setIsCartOpen(true)} />

      {/* Cart Sheet */}
      <CartSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        venueSlug={venue.slug}
      />
    </div>
  );
}
