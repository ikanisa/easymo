'use client';

import { useEffect, useState } from 'react';
import { supabase } from './client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface OrderUpdate {
  id: string;
  status: string;
  payment_status: string;
  estimated_ready_time?: string;
}

export function useOrderRealtime(orderId: string) {
  const [order, setOrder] = useState<OrderUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      // Subscribe to order updates
      channel = supabase
        .channel(`order:${orderId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'client_orders',
            filter: `id=eq.${orderId}`,
          },
          (payload) => {
            console.log('Order updated:', payload.new);
            setOrder(payload.new as OrderUpdate);
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        setIsConnected(false);
      }
    };
  }, [orderId]);

  return { order, isConnected };
}

export function useVenueOrders(venueId: string) {
  const [orders, setOrders] = useState<OrderUpdate[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;

    const setupRealtime = async () => {
      channel = supabase
        .channel(`venue-orders:${venueId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'client_orders',
            filter: `venue_id=eq.${venueId}`,
          },
          (payload) => {
            console.log('Venue order update:', payload);
            
            if (payload.eventType === 'INSERT') {
              setOrders((prev) => [...prev, payload.new as OrderUpdate]);
            } else if (payload.eventType === 'UPDATE') {
              setOrders((prev) =>
                prev.map((order) =>
                  order.id === payload.new.id ? (payload.new as OrderUpdate) : order
                )
              );
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
          }
        });
    };

    setupRealtime();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
        setIsConnected(false);
      }
    };
  }, [venueId]);

  return { orders, isConnected };
}
