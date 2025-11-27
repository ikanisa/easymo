#!/bin/bash

# One-Command File Creator for Client PWA
# Creates all 4 required page files automatically

set -e

echo "🚀 Creating Client PWA Page Files..."
echo ""

BASE_DIR="/Users/jeanbosco/workspace/easymo-/client-pwa"

# Create directories
echo "📁 Creating directories..."
mkdir -p "$BASE_DIR/app/[venueSlug]/cart"
mkdir -p "$BASE_DIR/app/[venueSlug]/checkout"
mkdir -p "$BASE_DIR/app/[venueSlug]/order/[orderId]"
echo "✅ Directories created"
echo ""

# File 1: Venue Page
echo "📄 Creating app/[venueSlug]/page.tsx..."
cat > "$BASE_DIR/app/[venueSlug]/page.tsx" << 'EOF'
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
  
  const { data: venue, error: venueError } = await supabase
    .from('venues')
    .select('*')
    .eq('slug', params.venueSlug)
    .eq('is_active', true)
    .single();
  
  if (venueError || !venue) {
    notFound();
  }
  
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*, menu_items(count)')
    .eq('venue_id', venue.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  
  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('venue_id', venue.id)
    .eq('is_available', true)
    .order('created_at', { ascending: false });
  
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
EOF
echo "✅ Venue page created"

# File 2: Cart Page
echo "📄 Creating app/[venueSlug]/cart/page.tsx..."
cat > "$BASE_DIR/app/[venueSlug]/cart/page.tsx" << 'EOF'
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
  
  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="container flex items-center justify-between py-4">
          <h1 className="text-xl font-bold">Your Cart ({totalItems} items)</h1>
          <Button variant="ghost" size="sm" onClick={clearCart}>Clear All</Button>
        </div>
      </header>
      
      <div className="container py-6 space-y-4">
        {items.map((item) => (
          <div key={item.id} className="flex gap-4 p-4 bg-card rounded-2xl border border-border">
            <div className="flex-1">
              <h3 className="font-semibold">{item.name}</h3>
              <p className="text-sm text-muted-foreground">
                {formatPrice(item.price, 'RWF')}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, -1)}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span>{item.quantity}</span>
                <Button size="sm" variant="outline" onClick={() => updateQuantity(item.id, 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => removeItem(item.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="font-bold text-primary">
              {formatPrice(item.price * (item.quantity || 1), 'RWF')}
            </div>
          </div>
        ))}
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-2xl p-6">
        <div className="container space-y-4">
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span className="text-primary">{formatPrice(totalAmount, 'RWF')}</span>
          </div>
          <Link href={`/${params.venueSlug}/checkout`}>
            <Button size="lg" className="w-full gap-2">
              Proceed to Checkout <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
EOF
echo "✅ Cart page created"

# File 3: Checkout Page
echo "📄 Creating app/[venueSlug]/checkout/page.tsx..."
cat > "$BASE_DIR/app/[venueSlug]/checkout/page.tsx" << 'EOF'
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
  
  const handlePlaceOrder = async () => {
    setError('');
    setIsProcessing(true);
    
    try {
      if (!customerPhone) throw new Error('Phone number required');
      
      const { data: venue } = await supabase
        .from('venues')
        .select('id')
        .eq('slug', params.venueSlug)
        .single();
      
      if (!venue) throw new Error('Venue not found');
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          venue_id: venue.id,
          table_number: localStorage.getItem('tableNumber'),
          customer_name: customerName || 'Guest',
          customer_phone: customerPhone,
          items: items.map(item => ({
            item_id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1
          })),
          total_amount: totalAmount,
          currency: 'RWF',
          payment_method: paymentMethod,
          status: 'pending_payment'
        })
        .select()
        .single();
      
      if (orderError) throw orderError;
      
      clearCart();
      router.push(`/${params.venueSlug}/order/${order.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>
      
      <div className="space-y-4 mb-6">
        <Input
          placeholder="Name (optional)"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
        <Input
          placeholder="Phone number *"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
          required
        />
        <PaymentSelector selected={paymentMethod} onSelect={setPaymentMethod} />
      </div>
      
      {error && <div className="text-destructive mb-4">{error}</div>}
      
      <Button onClick={handlePlaceOrder} disabled={isProcessing} className="w-full">
        {isProcessing ? <Loader2 className="animate-spin" /> : `Pay ${formatPrice(totalAmount, 'RWF')}`}
      </Button>
    </div>
  );
}
EOF
echo "✅ Checkout page created"

# File 4: Order Tracking Page
echo "📄 Creating app/[venueSlug]/order/[orderId]/page.tsx..."
cat > "$BASE_DIR/app/[venueSlug]/order/[orderId]/page.tsx" << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import { OrderProgress } from '@/components/order/OrderProgress';
import { OrderItems } from '@/components/order/OrderItems';
import { formatPrice } from '@/lib/format';
import confetti from 'canvas-confetti';

export default function OrderTrackingPage({ params }: { params: { orderId: string } }) {
  const [order, setOrder] = useState<any>(null);
  const supabase = createBrowserSupabaseClient();
  
  useOrderRealtime(params.orderId, (updatedOrder) => {
    setOrder(updatedOrder);
    if (updatedOrder.status === 'ready') {
      confetti({ particleCount: 100, spread: 70 });
    }
  });
  
  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .eq('id', params.orderId)
      .single()
      .then(({ data }) => setOrder(data));
  }, [params.orderId]);
  
  if (!order) return <div className="p-6">Loading...</div>;
  
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="text-2xl font-bold mb-6">Order Tracking</h1>
      <OrderProgress status={order.status} />
      <div className="mt-6 bg-card rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Order Items</h3>
        <OrderItems items={order.items} />
        <div className="mt-4 pt-4 border-t border-border flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(order.total_amount, 'RWF')}</span>
        </div>
      </div>
    </div>
  );
}
EOF
echo "✅ Order tracking page created"

echo ""
echo "✅ All 4 page files created successfully!"
echo ""
echo "📁 Files created:"
echo "  - app/[venueSlug]/page.tsx"
echo "  - app/[venueSlug]/cart/page.tsx"
echo "  - app/[venueSlug]/checkout/page.tsx"
echo "  - app/[venueSlug]/order/[orderId]/page.tsx"
echo ""
echo "🎉 Next steps:"
echo "  1. Run database migrations (see COMPLETE_SUMMARY.md)"
echo "  2. Test: pnpm dev"
echo "  3. Visit: http://localhost:3002/heaven-bar?table=5"
echo ""
