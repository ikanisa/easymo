/**
 * Hook for real-time order updates
 */

import { useEffect, useState, useCallback } from 'react';
import { subscribeToOrder, unsubscribeFromOrder } from '@/lib/realtime';
import type { OrderUpdate, OrderStatus } from '@/lib/realtime';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useOrderRealtime(orderId: string | null) {
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [estimatedReadyTime, setEstimatedReadyTime] = useState<string | null>(null);

  const handleUpdate = useCallback((update: OrderUpdate) => {
    setStatus(update.status);
    setLastUpdate(new Date(update.updated_at));
    if (update.estimated_ready_time) {
      setEstimatedReadyTime(update.estimated_ready_time);
    }

    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      const statusInfo = getOrderStatusInfo(update.status);
      new Notification('Order Update', {
        body: statusInfo.description,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: `order-${orderId}`,
      });
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId) return;

    let channel: RealtimeChannel;

    // Subscribe to order updates
    channel = subscribeToOrder(orderId, handleUpdate);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      if (channel) {
        unsubscribeFromOrder(channel);
      }
    };
  }, [orderId, handleUpdate]);

  return {
    status,
    lastUpdate,
    estimatedReadyTime,
  };
}

function getOrderStatusInfo(status: OrderStatus) {
  // Inline version for notification
  const map = {
    pending_payment: { description: 'Complete your payment to confirm' },
    payment_confirmed: { description: 'Payment received!' },
    received: { description: 'Order received' },
    preparing: { description: 'Your order is being prepared' },
    ready: { description: 'Your order is ready!' },
    served: { description: 'Enjoy your meal!' },
    cancelled: { description: 'Order cancelled' },
  };
  return map[status] || map.pending_payment;
}
