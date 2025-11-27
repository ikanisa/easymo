'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface CartItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  imageUrl?: string;
  notes?: string;
  modifiers?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

interface CartState {
  items: CartItem[];
  venueId: string | null;
  tableNumber: string | null;
  
  // Actions
  addItem: (item: Omit<CartItem, 'id' | 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, delta: number) => void;
  updateNotes: (id: string, notes: string) => void;
  clearCart: () => void;
  setVenue: (venueId: string, tableNumber?: string) => void;
  
  // Selectors
  getTotalItems: () => number;
  getTotalAmount: () => number;
  getItemQuantity: (menuItemId: string) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set, get) => ({
      items: [],
      venueId: null,
      tableNumber: null,

      addItem: (item) => {
        set((state) => {
          // Check if item already exists
          const existing = state.items.find(
            (i) => i.menuItemId === item.menuItemId &&
                   JSON.stringify(i.modifiers) === JSON.stringify(item.modifiers)
          );

          if (existing) {
            existing.quantity += 1;
          } else {
            state.items.push({
              ...item,
              id: `${item.menuItemId}-${Date.now()}`,
              quantity: 1,
            });
          }
        });
      },

      removeItem: (id) => {
        set((state) => {
          state.items = state.items.filter((item) => item.id !== id);
        });
      },

      updateQuantity: (id, delta) => {
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item) {
            item.quantity = Math.max(0, item.quantity + delta);
            if (item.quantity === 0) {
              state.items = state.items.filter((i) => i.id !== id);
            }
          }
        });
      },

      updateNotes: (id, notes) => {
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          if (item) {
            item.notes = notes;
          }
        });
      },

      clearCart: () => {
        set({ items: [], venueId: null, tableNumber: null });
      },

      setVenue: (venueId, tableNumber) => {
        set({ venueId, tableNumber });
      },

      getTotalItems: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },

      getTotalAmount: () => {
        return get().items.reduce((sum, item) => {
          const modifiersTotal = item.modifiers?.reduce(
            (mSum, mod) => mSum + mod.price,
            0
          ) || 0;
          return sum + (item.price + modifiersTotal) * item.quantity;
        }, 0);
      },

      getItemQuantity: (menuItemId) => {
        return get().items
          .filter((item) => item.menuItemId === menuItemId)
          .reduce((sum, item) => sum + item.quantity, 0);
      },
    })),
    {
      name: 'easymo-cart',
      partialize: (state) => ({
        items: state.items,
        venueId: state.venueId,
        tableNumber: state.tableNumber,
      }),
    }
  )
);
