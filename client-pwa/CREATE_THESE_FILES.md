# 🚀 Phase 4 Implementation Guide - CREATE THESE FILES

## Directory Structure to Create

```
client-pwa/
├── app/
│   └── [venueSlug]/
│       ├── page.tsx          ← CREATE THIS
│       ├── cart/
│       │   └── page.tsx      ← CREATE THIS
│       ├── checkout/
│       │   └── page.tsx      ← CREATE THIS
│       └── order/
│           └── [orderId]/
│               └── page.tsx  ← CREATE THIS
└── components/
    └── layout/
        └── CartFab.tsx       ✅ ALREADY CREATED
```

---

## FILE 1: app/[venueSlug]/page.tsx

```typescript
import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { VenueHeader } from '@/components/venue/VenueHeader';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { VirtualizedMenuList } from '@/components/menu/VirtualizedMenuList';
import { CartFab } from '@/components/layout/CartFab';

interface VenuePageProps {
  params: { venueSlug: string };
  searchParams: { table?: string };
}

export default async function VenuePage({ params, searchParams }: VenuePageProps) {
  const supabase = createServerSupabaseClient();
  
  // Fetch venue data
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', params.venueSlug)
    .eq('is_active', true)
    .single();
  
  if (venueError || !venue) {
    notFound();
  }
  
  // Fetch menu categories
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*, menu_items(count)')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  
  // Fetch all menu items
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_available', true)
    .order('created_at', { ascending: false });
  
  // Store table number in client-side storage
  const tableNumber = searchParams.table;
  
  return (
    <div className="min-h-screen bg-background">
      <VenueHeader 
        venue={venue} 
        tableNumber={tableNumber} 
      />
      
      <CategoryTabs 
        categories={categories || []}
        activeCategory="all"
        onCategoryChange={() => {}}
      />
      
      <VirtualizedMenuList 
        items={items || []}
        venueSlug={params.venueSlug}
      />
      
      <CartFab venueSlug={params.venueSlug} />
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: VenuePageProps) {
  const supabase = createServerSupabaseClient();
  
  const { data: venue } = await supabase
    .from('venues')
    .select('name, address')
    .eq('slug', params.venueSlug)
    .single();
  
  return {
    title: venue?.name || 'Restaurant Menu',
    description: `Browse and order from ${venue?.name || 'our restaurant'}`,
  };
}
```

---

## FILE 2: app/[venueSlug]/cart/page.tsx

```typescript
'use client';

import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { formatPrice } from '@/lib/format';
import { motion } from 'framer-motion';

interface CartPageProps {
  params: { venueSlug: string };
}

export default function CartPage({ params }: CartPageProps) {
  const { items, totalAmount, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background">
        <ShoppingBag className="w-24 h-24 text-muted-foreground mb-6" />
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground text-center mb-8">
          Add items from the menu to get started
        </p>
        <Link href={`/${params.venueSlug}`}>
          <Button size="lg" className="gap-2">
            Browse Menu <ArrowRight className="w-4 h-4" />
          </Button>
        </Link>
      </div>
    );
  }
  
  const subtotal = totalAmount;
  const tax = subtotal * 0; // No tax for now
  const total = subtotal + tax;
  
  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <h1 className="text-xl font-bold">Your Cart ({totalItems} items)</h1>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearCart}
            className="text-destructive hover:text-destructive/90"
          >
            Clear All
          </Button>
        </div>
      </header>
      
      {/* Cart Items */}
      <div className="container py-6 space-y-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ delay: index * 0.05 }}
            className="flex gap-4 p-4 bg-card rounded-2xl border border-border"
          >
            {/* Item Image */}
            {item.image_url && (
              <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src={item.image_url}
                  alt={item.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </div>
            )}
            
            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatPrice(item.price, item.currency || 'RWF')}
              </p>
              
              {/* Quantity Controls */}
              <div className="flex items-center gap-3 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateQuantity(item.id, -1)}
                  className="h-8 w-8 p-0"
                >
                  <Minus className="w-4 h-4" />
                </Button>
                
                <span className="text-sm font-medium w-8 text-center">
                  {item.quantity}
                </span>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateQuantity(item.id, 1)}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(item.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive/90 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Item Total */}
            <div className="text-right">
              <p className="font-bold text-primary">
                {formatPrice(item.price * (item.quantity || 1), item.currency || 'RWF')}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Summary Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl">
        <div className="container py-6 pb-safe-bottom space-y-4">
          {/* Summary */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatPrice(subtotal, 'RWF')}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span className="font-medium">{formatPrice(tax, 'RWF')}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{formatPrice(total, 'RWF')}</span>
            </div>
          </div>
          
          {/* Checkout Button */}
          <Link href={`/${params.venueSlug}/checkout`} className="block">
            <Button size="lg" className="w-full gap-2">
              Proceed to Checkout <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

---

## FILE 3: app/[venueSlug]/checkout/page.tsx

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/hooks/useCart';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PaymentSelector } from '@/components/payment/PaymentSelector';
import { formatPrice } from '@/lib/format';
import { Loader2 } from 'lucide-react';

interface CheckoutPageProps {
  params: { venueSlug: string };
}

export default function CheckoutPage({ params }: CheckoutPageProps) {
  const { items, totalAmount, clearCart } = useCart();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'momo' | 'revolut'>('momo');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  
  // Redirect if cart is empty
  if (items.length === 0) {
    router.push(`/${params.venueSlug}`);
    return null;
  }
  
  const handlePlaceOrder = async () => {
    setError('');
    setIsProcessing(true);
    
    try {
      // Validate inputs
      if (!customerPhone) {
        throw new Error('Phone number is required');
      }
      
      // Get venue ID
      const { data: venue, error: venueError } = await supabase
        .from('venues')
        .select('id')
        .eq('slug', params.venueSlug)
        .single();
      
      if (venueError || !venue) {
        throw new Error('Venue not found');
      }
      
      // Get table number from localStorage
      const tableNumber = typeof window !== 'undefined' 
        ? localStorage.getItem('tableNumber') 
        : null;
      
      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          venue_id: venue.id,
          table_number: tableNumber,
          customer_name: customerName || 'Guest',
          customer_phone: customerPhone,
          items: items.map(item => ({
            item_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            currency: item.currency || 'RWF'
          })),
          total_amount: totalAmount,
          currency: 'RWF',
          payment_method: paymentMethod,
          status: 'pending_payment'
        })
        .select()
        .single();
      
      if (orderError) {
        throw orderError;
      }
      
      // Clear cart
      clearCart();
      
      // Navigate to order tracking
      router.push(`/${params.venueSlug}/order/${order.id}`);
    } catch (err: any) {
      console.error('Order creation failed:', err);
      setError(err.message || 'Failed to create order. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="container py-4">
          <h1 className="text-xl font-bold">Checkout</h1>
        </div>
      </header>
      
      <div className="container py-6 space-y-6">
        {/* Order Summary */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h2 className="font-semibold mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map(item => (
              <div key={item.id} className="flex justify-between">
                <span className="text-muted-foreground">
                  {item.quantity}x {item.name}
                </span>
                <span className="font-medium">
                  {formatPrice(item.price * (item.quantity || 1), 'RWF')}
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t border-border font-bold">
              <span>Total</span>
              <span className="text-primary">{formatPrice(totalAmount, 'RWF')}</span>
            </div>
          </div>
        </div>
        
        {/* Customer Info */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold">Your Information</h2>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Name (Optional)</label>
            <Input
              type="text"
              placeholder="Enter your name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone Number *</label>
            <Input
              type="tel"
              placeholder="+250 788 123 456"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              For order updates and payment confirmation
            </p>
          </div>
        </div>
        
        {/* Payment Method */}
        <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
          <h2 className="font-semibold">Payment Method</h2>
          <PaymentSelector
            selected={paymentMethod}
            onSelect={setPaymentMethod}
          />
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
      </div>
      
      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl">
        <div className="container py-4 pb-safe-bottom">
          <Button 
            onClick={handlePlaceOrder} 
            disabled={isProcessing || !customerPhone}
            size="lg"
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              `Place Order - ${formatPrice(totalAmount, 'RWF')}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

## FILE 4: app/[venueSlug]/order/[orderId]/page.tsx

```typescript
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { OrderProgress } from '@/components/order/OrderProgress';
import { OrderItems } from '@/components/order/OrderItems';
import { formatPrice } from '@/lib/format';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Loader2 } from 'lucide-react';

interface OrderTrackingPageProps {
  params: { venueSlug: string; orderId: string };
}

interface Order {
  id: string;
  venue_id: string;
  table_number: string | null;
  customer_name: string;
  customer_phone: string;
  items: any[];
  total_amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  ready_at: string | null;
  served_at: string | null;
}

export default function OrderTrackingPage({ params }: OrderTrackingPageProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createBrowserSupabaseClient();
  
  // Subscribe to real-time updates
  useOrderRealtime(params.orderId, (updatedOrder) => {
    setOrder(updatedOrder);
    
    // Trigger confetti when order is ready
    if (updatedOrder.status === 'ready' && order?.status !== 'ready') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f9a825', '#fbc25f', '#fab53d']
      });
      
      // Request notification permission and send notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Your order is ready! 🎉', {
          body: 'Your food is ready to be served',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png'
        });
      }
    }
  });
  
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', params.orderId)
          .single();
        
        if (error) throw error;
        setOrder(data);
      } catch (error) {
        console.error('Failed to fetch order:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchOrder();
  }, [params.orderId, supabase]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6">
        <h2 className="text-xl font-semibold mb-2">Order not found</h2>
        <p className="text-muted-foreground">This order may have been cancelled or doesn't exist.</p>
      </div>
    );
  }
  
  const statusMap = {
    pending_payment: { label: 'Waiting for Payment', icon: Clock, color: 'text-yellow-500' },
    paid: { label: 'Payment Confirmed', icon: CheckCircle2, color: 'text-green-500' },
    preparing: { label: 'Preparing Your Order', icon: Clock, color: 'text-blue-500' },
    ready: { label: 'Ready to Serve!', icon: CheckCircle2, color: 'text-green-500' },
    served: { label: 'Served', icon: CheckCircle2, color: 'text-gray-500' },
  };
  
  const currentStatus = statusMap[order.status as keyof typeof statusMap] || statusMap.pending_payment;
  const StatusIcon = currentStatus.icon;
  
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container py-6">
          <h1 className="text-2xl font-bold mb-2">Order Tracking</h1>
          <p className="text-sm text-muted-foreground">
            Order #{order.id.slice(0, 8)}
          </p>
        </div>
      </header>
      
      {/* Status Card */}
      <div className="container py-6">
        <div className="bg-card rounded-2xl border border-border p-6 text-center">
          <StatusIcon className={`w-16 h-16 mx-auto mb-4 ${currentStatus.color}`} />
          <h2 className="text-xl font-bold mb-2">{currentStatus.label}</h2>
          {order.status === 'preparing' && (
            <p className="text-sm text-muted-foreground">
              Estimated time: ~15 minutes
            </p>
          )}
        </div>
      </div>
      
      {/* Progress Timeline */}
      <div className="container py-6">
        <OrderProgress status={order.status} />
      </div>
      
      {/* Order Details */}
      <div className="container space-y-6">
        {/* Items */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-semibold mb-4">Order Items</h3>
          <OrderItems items={order.items} />
        </div>
        
        {/* Summary */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-semibold mb-4">Order Summary</h3>
          <div className="space-y-2 text-sm">
            {order.table_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Table</span>
                <span className="font-medium">#{order.table_number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-medium capitalize">{order.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Status</span>
              <span className={`font-medium ${
                order.payment_status === 'completed' ? 'text-green-500' : 'text-yellow-500'
              }`}>
                {order.payment_status}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-border font-bold">
              <span>Total</span>
              <span className="text-primary">
                {formatPrice(order.total_amount, order.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Next Steps:

1. **Create these 4 files manually** in the specified locations
2. **Ensure components exist**:
   - ✅ CartFab (already created)
   - Check VenueHeader, CategoryTabs, VirtualizedMenuList exist
   - Check OrderProgress, OrderItems exist
3. **Create database tables** (next step - Phase 5)

Would you like me to proceed with Phase 5 (Database Schema)?
