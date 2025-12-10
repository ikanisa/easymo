/**
 * Orders Hook with Real-time Sync
 * Provides live order updates across all connected clients
 */

import { useState, useEffect, useCallback } from 'react';
import { useOrdersRealtime, useOptimisticUpdate } from '@/lib/supabase/realtime';
import { useSoundEffects } from './useSoundEffects';

export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
  special_instructions?: string;
}

export interface Order {
  id: string;
  order_number: string;
  table_number?: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  subtotal: number;
  tax?: number;
  currency: string;
  created_at: string;
  updated_at: string;
  customer_phone?: string;
  customer_name?: string;
  server_name?: string;
  notes?: string;
  payment_method?: string;
  source: 'pos' | 'whatsapp' | 'online' | 'phone';
  order_type: 'dine-in' | 'takeaway' | 'delivery';
}

// Mock data for development
const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    order_number: 'ORD-001',
    table_number: '5',
    status: 'pending',
    items: [
      { id: '1', name: 'Grilled Chicken', quantity: 2, price: 15000 },
      { id: '2', name: 'French Fries', quantity: 2, price: 3000 },
      { id: '3', name: 'Coca Cola', quantity: 2, price: 1500 },
    ],
    subtotal: 39000,
    tax: 7020,
    total: 46020,
    currency: 'RWF',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    server_name: 'Grace Uwase',
    source: 'pos',
    order_type: 'dine-in',
  },
  {
    id: '2',
    order_number: 'ORD-002',
    table_number: '12',
    status: 'preparing',
    items: [
      { id: '1', name: 'Beef Burger', quantity: 1, price: 12000 },
      { id: '2', name: 'Sprite', quantity: 1, price: 1500 },
    ],
    subtotal: 13500,
    tax: 2430,
    total: 15930,
    currency: 'RWF',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    server_name: 'Patrick Habimana',
    source: 'pos',
    order_type: 'dine-in',
  },
  {
    id: '3',
    order_number: 'ORD-003',
    status: 'confirmed',
    items: [
      { id: '1', name: 'Fish & Chips', quantity: 1, price: 18000 },
      { id: '2', name: 'Salad', quantity: 1, price: 5000 },
    ],
    subtotal: 23000,
    tax: 4140,
    total: 27140,
    currency: 'RWF',
    created_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
    customer_phone: '+250788123456',
    customer_name: 'John Doe',
    source: 'whatsapp',
    order_type: 'takeaway',
  },
];

export function useOrders(options?: {
  statuses?: OrderStatus[];
  autoRefresh?: number;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const { playSound } = useSoundEffects();

  // Use optimistic updates for better UX
  const {
    data: orders,
    setData: setOrders,
    pendingUpdates,
    optimisticUpdate,
    optimisticInsert,
  } = useOptimisticUpdate<Order>(MOCK_ORDERS);

  // Real-time subscriptions
  const { isConnected } = useOrdersRealtime(
    // On new order inserted
    (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
      setNewOrderCount((count) => count + 1);
      playSound('newOrder');
      
      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Order!', {
          body: `Order #${newOrder.order_number} - Table ${newOrder.table_number || 'Takeaway'}`,
          icon: '/icons/order.png',
          tag: newOrder.id,
        });
      }
    },
    
    // On order updated
    (updatedOrder) => {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );

      // Play sound if order is ready
      if (updatedOrder.status === 'ready') {
        playSound('orderReady');
        
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Order Ready!', {
            body: `Order #${updatedOrder.order_number} is ready to serve`,
            icon: '/icons/ready.png',
            tag: updatedOrder.id,
          });
        }
      }
    },
    
    // On order deleted
    (deletedOrderId) => {
      setOrders((prev) => prev.filter((order) => order.id !== deletedOrderId));
    }
  );

  // Filter orders by status if specified
  const filteredOrders = options?.statuses
    ? orders.filter((order) => options.statuses!.includes(order.status))
    : orders;

  // Update order status with optimistic update
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      await optimisticUpdate(
        orderId,
        { status: newStatus, updated_at: new Date().toISOString() },
        async () => {
          // In production, call Supabase API
          // const { data } = await supabase
          //   .from('orders')
          //   .update({ status: newStatus })
          //   .eq('id', orderId)
          //   .select()
          //   .single();
          // return data;

          // Mock API call
          await new Promise((resolve) => setTimeout(resolve, 500));
          const order = orders.find((o) => o.id === orderId);
          return { ...order!, status: newStatus, updated_at: new Date().toISOString() };
        }
      );
    },
    [orders, optimisticUpdate]
  );

  // Create new order
  const createOrder = useCallback(
    async (orderData: Partial<Order>) => {
      const newOrder: Order = {
        id: `temp-${Date.now()}`,
        order_number: `ORD-${String(orders.length + 1).padStart(3, '0')}`,
        status: 'pending',
        items: [],
        total: 0,
        subtotal: 0,
        currency: 'RWF',
        source: 'pos',
        order_type: 'dine-in',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...orderData,
      } as Order;

      await optimisticInsert(newOrder, async () => {
        // In production, call Supabase API
        // const { data } = await supabase
        //   .from('orders')
        //   .insert(newOrder)
        //   .select()
        //   .single();
        // return data;

        // Mock API call
        await new Promise((resolve) => setTimeout(resolve, 500));
        return { ...newOrder, id: `order-${Date.now()}` };
      });
    },
    [orders, optimisticInsert]
  );

  // Refetch orders manually
  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      // In production, fetch from Supabase
      // const { data } = await supabase
      //   .from('orders')
      //   .select('*')
      //   .order('created_at', { ascending: false });
      // setOrders(data || []);

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh if specified
  useEffect(() => {
    if (options?.autoRefresh) {
      const interval = setInterval(refetch, options.autoRefresh);
      return () => clearInterval(interval);
    }
  }, [options?.autoRefresh, refetch]);

  // Reset new order count when viewed
  const resetNewOrderCount = useCallback(() => {
    setNewOrderCount(0);
  }, []);

  return {
    orders: filteredOrders,
    activeOrders: orders.filter((o) => !['served', 'cancelled'].includes(o.status)),
    isLoading,
    isConnected,
    newOrderCount,
    pendingUpdates,
    updateOrderStatus,
    createOrder,
    refetch,
    resetNewOrderCount,
  };
}
