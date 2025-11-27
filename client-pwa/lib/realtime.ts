/**
 * Supabase Realtime utilities for order updates
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type OrderStatus =
  | 'pending_payment'
  | 'payment_confirmed'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled';

export interface OrderUpdate {
  id: string;
  status: OrderStatus;
  updated_at: string;
  estimated_ready_time?: string;
}

export type OrderUpdateCallback = (update: OrderUpdate) => void;

/**
 * Subscribe to order updates
 */
export function subscribeToOrder(
  orderId: string,
  callback: OrderUpdateCallback
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`order:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        callback(payload.new as OrderUpdate);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Unsubscribe from order updates
 */
export async function unsubscribeFromOrder(channel: RealtimeChannel): Promise<void> {
  const supabase = createClient();
  await supabase.removeChannel(channel);
}

/**
 * Subscribe to all user's orders
 */
export function subscribeToUserOrders(
  userId: string,
  callback: OrderUpdateCallback
): RealtimeChannel {
  const supabase = createClient();

  const channel = supabase
    .channel(`user_orders:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${userId}`,
      },
      (payload) => {
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          callback(payload.new as OrderUpdate);
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Get order status display info
 */
export function getOrderStatusInfo(status: OrderStatus): {
  label: string;
  description: string;
  color: string;
  icon: string;
} {
  const statusMap = {
    pending_payment: {
      label: 'Pending Payment',
      description: 'Complete your payment to confirm',
      color: 'text-yellow-600',
      icon: '⏳',
    },
    payment_confirmed: {
      label: 'Payment Confirmed',
      description: 'Payment received, processing order',
      color: 'text-blue-600',
      icon: '✓',
    },
    received: {
      label: 'Order Received',
      description: 'Your order has been received',
      color: 'text-blue-600',
      icon: '📝',
    },
    preparing: {
      label: 'Preparing',
      description: 'Your order is being prepared',
      color: 'text-orange-600',
      icon: '👨‍🍳',
    },
    ready: {
      label: 'Ready!',
      description: 'Your order is ready',
      color: 'text-green-600',
      icon: '✅',
    },
    served: {
      label: 'Served',
      description: 'Enjoy your meal!',
      color: 'text-green-600',
      icon: '🎉',
    },
    cancelled: {
      label: 'Cancelled',
      description: 'This order has been cancelled',
      color: 'text-red-600',
      icon: '❌',
    },
  };

  return statusMap[status] || statusMap.pending_payment;
}
