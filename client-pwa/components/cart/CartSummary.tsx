'use client';

import { Card } from '@/components/ui/Card';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

interface CartSummaryProps {
  subtotal: number;
  tax?: number;
  serviceFee?: number;
  discount?: number;
  total: number;
  currency: string;
  className?: string;
}

export function CartSummary({
  subtotal,
  tax = 0,
  serviceFee = 0,
  discount = 0,
  total,
  currency,
  className,
}: CartSummaryProps) {
  return (
    <Card variant="elevated" className={cn('p-4', className)}>
      <h3 className="font-semibold mb-3">Order Summary</h3>
      
      <div className="space-y-2 text-sm">
        {/* Subtotal */}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{formatPrice(subtotal, currency)}</span>
        </div>

        {/* Tax */}
        {tax > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (18%)</span>
            <span className="font-medium">{formatPrice(tax, currency)}</span>
          </div>
        )}

        {/* Service Fee */}
        {serviceFee > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Service Fee</span>
            <span className="font-medium">{formatPrice(serviceFee, currency)}</span>
          </div>
        )}

        {/* Discount */}
        {discount > 0 && (
          <div className="flex justify-between text-green-500">
            <span>Discount</span>
            <span className="font-medium">-{formatPrice(discount, currency)}</span>
          </div>
        )}

        <div className="border-t border-border pt-2 mt-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-base">Total</span>
            <span className="font-bold text-primary text-xl">
              {formatPrice(total, currency)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
