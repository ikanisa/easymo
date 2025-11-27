'use client';

import { useCallback } from 'react';
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { useCart } from '@/stores/cart.store';
import { useHaptics } from '@/hooks/useHaptics';
import { formatPrice } from '@/lib/format';

interface CartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  venueSlug: string;
}

export function CartSheet({ isOpen, onClose, venueSlug }: CartSheetProps) {
  const { items, totalAmount, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const { trigger } = useHaptics();

  const handleQuantityChange = useCallback(
    (itemId: string, delta: number) => {
      trigger('light');
      updateQuantity(itemId, delta);
    },
    [updateQuantity, trigger]
  );

  const handleRemoveItem = useCallback(
    (itemId: string) => {
      trigger('medium');
      removeItem(itemId);
    },
    [removeItem, trigger]
  );

  const handleClearCart = useCallback(() => {
    trigger('heavy');
    clearCart();
  }, [clearCart, trigger]);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Your Cart">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShoppingBag className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Add some delicious items to get started
          </p>
          <Button onClick={onClose}>Browse Menu</Button>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 rounded-xl bg-secondary/50"
              >
                {/* Item Image */}
                <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                  {item.image_url ? (
                    <Image
                      src={item.image_url}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl">{item.emoji || '🍽️'}</span>
                    </div>
                  )}
                </div>

                {/* Item Details */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {item.name}
                  </h4>
                  <p className="text-sm text-primary font-semibold mt-1">
                    {formatPrice(item.price, item.currency)}
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleQuantityChange(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-background flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-transform"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="self-start p-2 rounded-full hover:bg-destructive/10 text-destructive transition-colors"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Cart Summary */}
          <div className="border-t border-border p-4 space-y-4">
            {/* Summary Row */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Items ({totalItems})</span>
                <span className="font-medium">{formatPrice(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span className="font-medium">Free</span>
              </div>
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCart}
                className="flex-1"
              >
                Clear
              </Button>
              <Button
                asChild
                size="lg"
                className="flex-1"
                onClick={onClose}
              >
                <Link href={`/${venueSlug}/checkout`} className="flex items-center gap-2">
                  Checkout
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
