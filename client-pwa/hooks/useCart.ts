'use client';

import { useCartStore } from '@/stores/cart.store';
import { useCallback } from 'react';

export function useCart() {
  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const updateNotes = useCartStore((state) => state.updateNotes);
  const clearCart = useCartStore((state) => state.clearCart);
  const setVenue = useCartStore((state) => state.setVenue);
  const getTotalItems = useCartStore((state) => state.getTotalItems);
  const getTotalAmount = useCartStore((state) => state.getTotalAmount);
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  const venueId = useCartStore((state) => state.venueId);
  const tableNumber = useCartStore((state) => state.tableNumber);

  const totalItems = useCartStore((state) => state.getTotalItems());
  const totalAmount = useCartStore((state) => state.getTotalAmount());

  return {
    // State
    items,
    venueId,
    tableNumber,
    totalItems,
    totalAmount,
    isEmpty: items.length === 0,

    // Actions
    addItem: useCallback(addItem, [addItem]),
    removeItem: useCallback(removeItem, [removeItem]),
    updateQuantity: useCallback(updateQuantity, [updateQuantity]),
    updateNotes: useCallback(updateNotes, [updateNotes]),
    clearCart: useCallback(clearCart, [clearCart]),
    setVenue: useCallback(setVenue, [setVenue]),

    // Selectors
    getItemQuantity: useCallback(getItemQuantity, [getItemQuantity]),
  };
}
