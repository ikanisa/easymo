'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, Clock, ChefHat, Bell } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/format';
import type { Venue } from '@/types/venue';

interface Order {
  id: string;
  venueId: string;
  customerName: string;
  customerPhone: string;
  tableNumber: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  subtotal: number;
  total: number;
  currency: string;
  status: string;
  paymentStatus: string;
  notes?: string;
  createdAt: string;
  estimatedReadyTime?: string;
}

interface OrderPageProps {
  venue: Venue;
  order: Order;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Order Received',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    description: 'We\'ve received your order and will start preparing it soon.',
  },
  confirmed: {
    icon: CheckCircle2,
    label: 'Confirmed',
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    description: 'Your order has been confirmed and is being prepared.',
  },
  preparing: {
    icon: ChefHat,
    label: 'Preparing',
    color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    description: 'Our chef is preparing your delicious meal.',
  },
  ready: {
    icon: Bell,
    label: 'Ready',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    description: 'Your order is ready! We\'ll bring it to your table shortly.',
  },
  served: {
    icon: CheckCircle2,
    label: 'Served',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
    description: 'Enjoy your meal!',
  },
};

export function OrderPage({ venue, order }: OrderPageProps) {
  const [currentStatus, setCurrentStatus] = useState(order.status);
  const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  // In a real app, this would be a realtime subscription
  useEffect(() => {
    // Simulate status updates for demo
    const interval = setInterval(() => {
      setCurrentStatus(prev => {
        if (prev === 'pending') return 'confirmed';
        if (prev === 'confirmed') return 'preparing';
        if (prev === 'preparing') return 'ready';
        return prev;
      });
    }, 10000); // Update every 10 seconds for demo

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-gradient-to-b from-primary/10 to-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Order Confirmed!</h1>
          <p className="text-muted-foreground">
            Order #{order.id.slice(0, 8)}
          </p>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Status Card */}
        <Card className={`p-6 ${config.color}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-current/10 flex items-center justify-center flex-shrink-0">
              <StatusIcon className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-1">{config.label}</h2>
              <p className="text-sm opacity-90">{config.description}</p>
              {order.estimatedReadyTime && (
                <p className="text-sm mt-2">
                  Estimated ready time: {new Date(order.estimatedReadyTime).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Order Details */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          
          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{order.customerPhone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Table</span>
              <Badge variant="secondary">Table {order.tableNumber}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">
                {new Date(order.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {order.notes && (
            <div className="border-t border-border pt-3 mt-3">
              <p className="text-sm text-muted-foreground mb-1">Special Instructions:</p>
              <p className="text-sm">{order.notes}</p>
            </div>
          )}
        </Card>

        {/* Items */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-4">Items</h2>
          <div className="space-y-3">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium">
                    {item.quantity}x {item.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatPrice(item.price, order.currency)} each
                  </p>
                </div>
                <p className="font-semibold">
                  {formatPrice(item.price * item.quantity, order.currency)}
                </p>
              </div>
            ))}
            
            <div className="border-t border-border pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Service Fee</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(order.total, order.currency)}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Payment Status */}
        <Card className="p-4">
          <h2 className="text-lg font-semibold mb-2">Payment</h2>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={order.paymentStatus === 'completed' ? 'success' : 'warning'}>
              {order.paymentStatus === 'pending' ? 'Pay when ready' : order.paymentStatus}
            </Badge>
          </div>
          {order.paymentStatus === 'pending' && (
            <p className="text-sm text-muted-foreground mt-2">
              You can pay with MoMo or cash when your order is served.
            </p>
          )}
        </Card>

        {/* Actions */}
        <div className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <Link href={`/${venue.slug}`}>
              Order More Items
            </Link>
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            Need help? Contact the restaurant staff
          </p>
        </div>
      </div>
    </div>
  );
}
