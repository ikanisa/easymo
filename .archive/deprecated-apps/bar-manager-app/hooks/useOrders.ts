/**
 * Custom React hooks for the Bar Manager application
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/client';

type Order = Database['public']['Tables']['orders']['Row'] & {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
    special_instructions?: string;
  }>;
};

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';

interface UseOrdersOptions {
  statuses?: OrderStatus[];
  autoRefresh?: number;
}

export function useOrders(options: UseOrdersOptions = {}) {
  const { statuses, autoRefresh } = options;
  const queryClient = useQueryClient();
  const supabase = createClient();

  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', statuses],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            name,
            quantity,
            price,
            modifiers,
            special_instructions
          )
        `)
        .order('created_at', { ascending: false });

      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data as any[]).map((order) => ({
        ...order,
        items: order.order_items || [],
      })) as Order[];
    },
    refetchInterval: autoRefresh,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, supabase]);

  return {
    orders,
    isLoading,
    refetch,
    updateOrderStatus: updateStatusMutation.mutate,
    activeOrders: orders.filter((o) => !['served', 'cancelled'].includes(o.status)),
    newOrderCount: orders.filter((o) => o.status === 'pending').length,
  };
}

export function useTables() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .order('table_number');

      if (error) throw error;
      return data;
    },
  });

  const updateTableMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase
        .from('tables')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
  });

  return {
    tables,
    isLoading,
    updateTable: updateTableMutation.mutate,
  };
}

export function useAnalytics() {
  const supabase = createClient();

  const { data: todayStats, isLoading } = useQuery({
    queryKey: ['analytics', 'today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data: orders, error } = await supabase
        .from('orders')
        .select('total, created_at, status')
        .gte('created_at', today);

      if (error) throw error;

      const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
      const totalOrders = orders.length;
      const completedOrders = orders.filter((o) => o.status === 'served').length;

      return {
        totalRevenue,
        totalOrders,
        completedOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      };
    },
  });

  return {
    todayStats,
    isLoading,
  };
}
