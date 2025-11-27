/**
 * Cart Store with Zustand
 * Persistent cart with offline support
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category?: string;
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  customizations?: Record<string, string>;
  specialInstructions?: string;
  addedAt: string;
}

interface CartState {
  items: CartItem[];
  venueId: string | null;
  venueSlug: string | null;
  tableId: string | null;
  tableNumber: string | null;
  
  // Computed
  totalItems: number;
  subtotal: number;
  
  // Actions
  setVenue: (venueId: string, venueSlug: string) => void;
  setTable: (tableId: string, tableNumber: string) => void;
  addItem: (menuItem: MenuItem, quantity?: number, customizations?: Record<string, string>) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  setSpecialInstructions: (itemId: string, instructions: string) => void;
  clearCart: () => void;
  getItemQuantity: (menuItemId: string) => number;
}

export const useCartStore = create<CartState>()(
  persist(
    immer((set, get) => ({
      items: [],
      venueId: null,
      venueSlug: null,
      tableId: null,
      tableNumber: null,
      totalItems: 0,
      subtotal: 0,

      setVenue: (venueId, venueSlug) => {
        set((state) => {
          // Clear cart if venue changes
          if (state.venueId && state.venueId !== venueId) {
            state.items = [];
            state.totalItems = 0;
            state.subtotal = 0;
          }
          state.venueId = venueId;
          state.venueSlug = venueSlug;
        });
      },

      setTable: (tableId, tableNumber) => {
        set((state) => {
          state.tableId = tableId;
          state.tableNumber = tableNumber;
        });
      },

      addItem: (menuItem, quantity = 1, customizations) => {
        set((state) => {
          const existingIndex = state.items.findIndex(
            (item) => 
              item.menuItem.id === menuItem.id && 
              JSON.stringify(item.customizations) === JSON.stringify(customizations)
          );

          if (existingIndex >= 0) {
            state.items[existingIndex].quantity += quantity;
          } else {
            state.items.push({
              id: `${menuItem.id}-${Date.now()}`,
              menuItem,
              quantity,
              customizations,
              addedAt: new Date().toISOString(),
            });
          }

          // Recalculate totals
          state.totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          state.subtotal = state.items.reduce(
            (sum, item) => sum + item.menuItem.price * item.quantity,
            0
          );
        });

        // Update app badge
        if ('setAppBadge' in navigator) {
          (navigator as any).setAppBadge(get().totalItems).catch(() => {});
        }
      },

      removeItem: (itemId) => {
        set((state) => {
          state.items = state.items.filter((item) => item.id !== itemId);
          state.totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          state.subtotal = state.items.reduce(
            (sum, item) => sum + item.menuItem.price * item.quantity,
            0
          );
        });

        // Update app badge
        if ('setAppBadge' in navigator) {
          const total = get().totalItems;
          if (total > 0) {
            (navigator as any).setAppBadge(total).catch(() => {});
          } else {
            (navigator as any).clearAppBadge().catch(() => {});
          }
        }
      },

      updateQuantity: (itemId, delta) => {
        set((state) => {
          const item = state.items.find((i) => i.id === itemId);
          if (item) {
            const newQuantity = item.quantity + delta;
            if (newQuantity <= 0) {
              state.items = state.items.filter((i) => i.id !== itemId);
            } else {
              item.quantity = newQuantity;
            }
          }
          state.totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          state.subtotal = state.items.reduce(
            (sum, item) => sum + item.menuItem.price * item.quantity,
            0
          );
        });
      },

      setQuantity: (itemId, quantity) => {
        set((state) => {
          const item = state.items.find((i) => i.id === itemId);
          if (item) {
            if (quantity <= 0) {
              state.items = state.items.filter((i) => i.id !== itemId);
            } else {
              item.quantity = quantity;
            }
          }
          state.totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
          state.subtotal = state.items.reduce(
            (sum, item) => sum + item.menuItem.price * item.quantity,
            0
          );
        });
      },

      setSpecialInstructions: (itemId, instructions) => {
        set((state) => {
          const item = state.items.find((i) => i.id === itemId);
          if (item) {
            item.specialInstructions = instructions;
          }
        });
      },

      clearCart: () => {
        set((state) => {
          state.items = [];
          state.totalItems = 0;
          state.subtotal = 0;
          state.tableId = null;
          state.tableNumber = null;
        });

        // Clear app badge
        if ('clearAppBadge' in navigator) {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      },

      getItemQuantity: (menuItemId) => {
        return get().items
          .filter((item) => item.menuItem.id === menuItemId)
          .reduce((sum, item) => sum + item.quantity, 0);
      },
    })),
    {
      name: 'easymo-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        venueId: state.venueId,
        venueSlug: state.venueSlug,
        tableId: state.tableId,
        tableNumber: state.tableNumber,
        totalItems: state.totalItems,
        subtotal: state.subtotal,
      }),
    }
  )
);

// Custom hook with computed values
export function useCart() {
  const store = useCartStore();
  
  return {
    ...store,
    isEmpty: store.items.length === 0,
    formattedSubtotal: new Intl.NumberFormat('en-RW', {
      style: 'currency',
      currency: 'RWF',
      minimumFractionDigits: 0,
    }).format(store.subtotal),
  };
}
