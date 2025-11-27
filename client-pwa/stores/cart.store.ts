import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { CartItem } from '@/types/cart';
import type { MenuItem } from '@/types/menu';

interface CartStore {
  items: CartItem[];
  venueId: string | null;
  
  addItem: (item: MenuItem, quantity?: number) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  clearCart: () => void;
  getItemQuantity: (itemId: string) => number;
  
  totalItems: number;
  totalAmount: number;
}

export const useCart = create<CartStore>()(
  persist(
    immer((set, get) => ({
      items: [],
      venueId: null,
      
      addItem: (item, quantity = 1) => set((state) => {
        const existingIndex = state.items.findIndex((i) => i.id === item.id);
        
        if (existingIndex >= 0) {
          state.items[existingIndex].quantity += quantity;
        } else {
          state.items.push({ ...item, quantity });
        }
        
        if (!state.venueId) {
          state.venueId = item.category_id; // Simplified, should be venue ID
        }
      }),
      
      removeItem: (itemId) => set((state) => {
        state.items = state.items.filter((item) => item.id !== itemId);
      }),
      
      updateQuantity: (itemId, delta) => set((state) => {
        const item = state.items.find((i) => i.id === itemId);
        if (item) {
          item.quantity += delta;
          if (item.quantity <= 0) {
            state.items = state.items.filter((i) => i.id !== itemId);
          }
        }
      }),
      
      updateNotes: (itemId, notes) => set((state) => {
        const item = state.items.find((i) => i.id === itemId);
        if (item) {
          item.notes = notes;
        }
      }),
      
      clearCart: () => set({ items: [], venueId: null }),
      
      getItemQuantity: (itemId) => {
        const item = get().items.find((i) => i.id === itemId);
        return item?.quantity || 0;
      },
      
      get totalItems() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
      
      get totalAmount() {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      },
    })),
    {
      name: 'easymo-cart',
      partialize: (state) => ({
        items: state.items,
        venueId: state.venueId,
      }),
    }
  )
);
