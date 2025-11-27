'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Phone, MessageSquare, MapPin } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useCart } from '@/stores/cart.store';
import { formatPrice } from '@/lib/format';
import { createOrder } from '@/lib/api/orders';
import type { Venue } from '@/types/venue';

interface CheckoutPageProps {
  venue: Venue;
  tableNumber?: string;
}

export function CheckoutPage({ venue, tableNumber }: CheckoutPageProps) {
  const router = useRouter();
  const { items, totalAmount, totalItems, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    tableNumber: tableNumber || '',
    notes: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsSubmitting(true);

    try {
      const order = await createOrder({
        venueId: venue.id,
        customerName: formData.customerName,
        customerPhone: formData.customerPhone,
        tableNumber: formData.tableNumber,
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: totalAmount,
        total: totalAmount,
        currency: venue.currency,
        notes: formData.notes,
      });

      if (order) {
        clearCart();
        router.push(`/${venue.slug}/order/${order.id}`);
      } else {
        alert('Failed to create order. Please try again.');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Add some items to continue</p>
        <Button asChild>
          <Link href={`/${venue.slug}`}>Browse Menu</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <Link href={`/${venue.slug}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Checkout</h1>
            <p className="text-sm text-muted-foreground">{venue.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Order Summary */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Order Summary</h2>
          <div className="space-y-3">
            {items.map(item => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">
                    {item.quantity}x {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item.price, item.currency)} each
                  </p>
                </div>
                <p className="font-semibold">
                  {formatPrice(item.price * item.quantity, item.currency)}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-3 mt-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Subtotal ({totalItems} items)</span>
                <span>{formatPrice(totalAmount, venue.currency)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Service Fee</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-bold mt-3">
                <span>Total</span>
                <span className="text-primary">{formatPrice(totalAmount, venue.currency)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Customer Information Form */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Your Information</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="customerName" className="block text-sm font-medium mb-2">
                <User className="w-4 h-4 inline mr-2" />
                Name *
              </label>
              <input
                type="text"
                id="customerName"
                name="customerName"
                value={formData.customerName}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                placeholder="Enter your name"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="customerPhone" className="block text-sm font-medium mb-2">
                <Phone className="w-4 h-4 inline mr-2" />
                Phone Number *
              </label>
              <input
                type="tel"
                id="customerPhone"
                name="customerPhone"
                value={formData.customerPhone}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                placeholder="+250 7XX XXX XXX"
              />
            </div>

            {/* Table Number */}
            <div>
              <label htmlFor="tableNumber" className="block text-sm font-medium mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                Table Number *
              </label>
              <input
                type="text"
                id="tableNumber"
                name="tableNumber"
                value={formData.tableNumber}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                placeholder="e.g., 5"
              />
            </div>

            {/* Special Instructions */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium mb-2">
                <MessageSquare className="w-4 h-4 inline mr-2" />
                Special Instructions (Optional)
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors resize-none"
                placeholder="Any special requests? (e.g., allergies, preferences)"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : `Place Order • ${formatPrice(totalAmount, venue.currency)}`}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              By placing this order, you agree to our terms and conditions
            </p>
          </form>
        </Card>

        {/* Payment Info */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            💳 Payment
          </h3>
          <p className="text-sm text-muted-foreground">
            You'll be able to pay with MoMo or cash when your order is ready.
          </p>
        </Card>
      </div>
    </div>
  );
}
