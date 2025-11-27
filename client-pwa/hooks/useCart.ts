import { useCartStore } from '@/stores/cart';

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
