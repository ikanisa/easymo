'use client';

import { useState } from 'react';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { MenuGrid } from '@/components/menu/MenuGrid';
import { CartSheet } from '@/components/cart/CartSheet';
import { CartFab } from '@/components/layout/CartFab';
import type { MenuItem, MenuCategory } from '@/types/menu';

const demoCategories: MenuCategory[] = [
  { id: '1', name: 'Appetizers', slug: 'appetizers', emoji: '🥗', display_order: 1, item_count: 2 },
  { id: '2', name: 'Main Dishes', slug: 'mains', emoji: '🍕', display_order: 2, item_count: 2 },
  { id: '3', name: 'Drinks', slug: 'drinks', emoji: '🍺', display_order: 3, item_count: 2 },
  { id: '4', name: 'Desserts', slug: 'desserts', emoji: '🍰', display_order: 4, item_count: 1 },
];

const demoItems: MenuItem[] = [
  {
    id: '1',
    name: 'Margherita Pizza',
    description: 'Classic tomato sauce, fresh mozzarella, basil',
    price: 12000,
    currency: 'RWF',
    emoji: '🍕',
    category_id: '2',
    is_available: true,
    is_popular: true,
    is_vegetarian: true,
    prep_time_minutes: 20,
  },
  {
    id: '2',
    name: 'Caesar Salad',
    description: 'Romaine lettuce, parmesan, croutons',
    price: 8000,
    currency: 'RWF',
    emoji: '🥗',
    category_id: '1',
    is_available: true,
    is_vegetarian: true,
  },
  {
    id: '3',
    name: 'Primus Beer',
    description: 'Ice cold lager beer',
    price: 1500,
    currency: 'RWF',
    emoji: '🍺',
    category_id: '3',
    is_available: true,
    is_popular: true,
  },
  {
    id: '4',
    name: 'Chocolate Cake',
    description: 'Rich chocolate with vanilla ice cream',
    price: 6000,
    currency: 'RWF',
    emoji: '🍰',
    category_id: '4',
    is_available: true,
  },
  {
    id: '5',
    name: 'Beef Burger',
    description: 'Angus beef, cheese, special sauce',
    price: 15000,
    currency: 'RWF',
    emoji: '🍔',
    category_id: '2',
    is_available: true,
    is_popular: true,
  },
  {
    id: '6',
    name: 'Fresh Juice',
    description: 'Orange or passion fruit',
    price: 3000,
    currency: 'RWF',
    emoji: '🧃',
    category_id: '3',
    is_available: true,
  },
  {
    id: '7',
    name: 'Spring Rolls',
    description: 'Crispy vegetable spring rolls',
    price: 5000,
    currency: 'RWF',
    emoji: '🥟',
    category_id: '1',
    is_available: true,
  },
];

export default function DemoPage() {
  const [activeCategory, setActiveCategory] = useState('2');
  const [isCartOpen, setIsCartOpen] = useState(false);

  const filteredItems = demoItems.filter(item => item.category_id === activeCategory);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🍽️</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">Heaven Restaurant</h1>
              <p className="text-sm text-muted-foreground">Table 5 • Kigali</p>
            </div>
          </div>
        </div>
      </header>

      <CategoryTabs
        categories={demoCategories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      <MenuGrid
        items={filteredItems}
        venueSlug="heaven-bar"
      />

      <CartFab onClick={() => setIsCartOpen(true)} />

      <CartSheet
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        venueSlug="heaven-bar"
      />
    </div>
  );
}
