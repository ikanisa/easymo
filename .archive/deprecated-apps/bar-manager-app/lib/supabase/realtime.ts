/**
 * Supabase Realtime Integration
 * Provides live updates for orders, tables, and inventory across all connected clients
 */

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState, useCallback } from 'react';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Types
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeSubscription {
  channel: RealtimeChannel;
  unsubscribe: () => void;
}

export interface OrderUpdate {
  id: string;
  status: string;
  updated_at: string;
}

export interface TableUpdate {
  id: string;
  status: string;
  current_order_id?: string;
}

export interface InventoryUpdate {
  id: string;
  stock_level: number;
  updated_at: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Subscribe to order changes in real-time
 */
export function useOrdersRealtime(
  onInsert?: (order: any) => void,
  onUpdate?: (order: any) => void,
  onDelete?: (orderId: string) => void
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('orders-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('🔵 New order:', payload.new);
          onInsert?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('🟡 Order updated:', payload.new);
          onUpdate?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('🔴 Order deleted:', payload.old.id);
          onDelete?.(payload.old.id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to orders channel');
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          console.log('❌ Disconnected from orders channel');
          setIsConnected(false);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('⚠️ Error in orders channel');
          setIsConnected(false);
        }
      });

    return () => {
      console.log('🔌 Unsubscribing from orders channel');
      supabase.removeChannel(channel);
    };
  }, [onInsert, onUpdate, onDelete]);

  return { isConnected };
}

/**
 * Subscribe to table status changes in real-time
 */
export function useTablesRealtime(
  onUpdate?: (table: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('tables-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('🪑 Table updated:', payload.new);
          onUpdate?.(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to tables channel');
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return { isConnected };
}

/**
 * Subscribe to inventory changes in real-time
 */
export function useInventoryRealtime(
  onUpdate?: (item: any) => void
) {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const channel = supabase
      .channel('inventory-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory_items',
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('📦 Inventory updated:', payload.new);
          onUpdate?.(payload.new);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to inventory channel');
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);

  return { isConnected };
}

/**
 * Broadcast presence (who's online)
 */
export function usePresence(userId: string, userName: string) {
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    const channel = supabase.channel('presence-channel');

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
        console.log('👥 Online users:', users.length);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('👋 User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('👋 User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            user_name: userName,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userName]);

  return { onlineUsers };
}

/**
 * Send custom broadcast messages
 */
export function useBroadcast(channelName: string) {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    const ch = supabase.channel(channelName);
    ch.subscribe();
    setChannel(ch);

    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelName]);

  const broadcast = useCallback(
    (event: string, payload: any) => {
      if (!channel) return;
      channel.send({
        type: 'broadcast',
        event,
        payload,
      });
    },
    [channel]
  );

  const onBroadcast = useCallback(
    (event: string, callback: (payload: any) => void) => {
      if (!channel) return;
      channel.on('broadcast', { event }, ({ payload }) => {
        callback(payload);
      });
    },
    [channel]
  );

  return { broadcast, onBroadcast };
}

/**
 * Custom hook for optimistic updates
 */
export function useOptimisticUpdate<T>(
  initialData: T[],
  idKey: keyof T = 'id' as keyof T
) {
  const [data, setData] = useState<T[]>(initialData);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string | number>>(new Set());

  const optimisticUpdate = useCallback(
    async (
      id: string | number,
      updates: Partial<T>,
      updateFn: () => Promise<T>
    ) => {
      // Add to pending
      setPendingUpdates((prev) => new Set([...prev, id]));

      // Optimistically update UI
      setData((prev) =>
        prev.map((item) =>
          item[idKey] === id ? { ...item, ...updates } : item
        )
      );

      try {
        // Perform actual update
        const result = await updateFn();

        // Update with real data
        setData((prev) =>
          prev.map((item) =>
            item[idKey] === id ? result : item
          )
        );

        // Remove from pending
        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        return result;
      } catch (error) {
        // Revert on error
        setData((prev) =>
          prev.map((item) =>
            item[idKey] === id
              ? initialData.find((d) => d[idKey] === id) || item
              : item
          )
        );

        // Remove from pending
        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        throw error;
      }
    },
    [initialData, idKey]
  );

  const optimisticInsert = useCallback(
    async (newItem: T, insertFn: () => Promise<T>) => {
      const tempId = `temp-${Date.now()}`;
      const itemWithTempId = { ...newItem, [idKey]: tempId };

      // Optimistically add to UI
      setData((prev) => [...prev, itemWithTempId as T]);
      setPendingUpdates((prev) => new Set([...prev, tempId]));

      try {
        // Perform actual insert
        const result = await insertFn();

        // Replace temp item with real data
        setData((prev) =>
          prev.map((item) =>
            item[idKey] === tempId ? result : item
          )
        );

        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });

        return result;
      } catch (error) {
        // Remove temp item on error
        setData((prev) =>
          prev.filter((item) => item[idKey] !== tempId)
        );

        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(tempId);
          return next;
        });

        throw error;
      }
    },
    [idKey]
  );

  const optimisticDelete = useCallback(
    async (id: string | number, deleteFn: () => Promise<void>) => {
      const item = data.find((d) => d[idKey] === id);
      if (!item) return;

      // Optimistically remove from UI
      setData((prev) => prev.filter((d) => d[idKey] !== id));
      setPendingUpdates((prev) => new Set([...prev, id]));

      try {
        // Perform actual delete
        await deleteFn();

        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (error) {
        // Restore on error
        setData((prev) => [...prev, item]);

        setPendingUpdates((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });

        throw error;
      }
    },
    [data, idKey]
  );

  return {
    data,
    setData,
    pendingUpdates,
    optimisticUpdate,
    optimisticInsert,
    optimisticDelete,
  };
}

/**
 * Connection status indicator
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [latency, setLatency] = useState<number>(0);

  useEffect(() => {
    const channel = supabase.channel('status-check');

    let pingInterval: NodeJS.Timeout;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('connected');

        // Ping every 30 seconds to measure latency
        pingInterval = setInterval(async () => {
          const start = Date.now();
          await channel.send({
            type: 'broadcast',
            event: 'ping',
            payload: {},
          });
          const end = Date.now();
          setLatency(end - start);
        }, 30000);
      } else if (status === 'CLOSED') {
        setStatus('disconnected');
      } else {
        setStatus('connecting');
      }
    });

    return () => {
      clearInterval(pingInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  return { status, latency };
}
