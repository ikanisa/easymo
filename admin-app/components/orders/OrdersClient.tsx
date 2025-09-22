'use client';

import { useState } from 'react';
import type { Order } from '@/lib/schemas';
import { OrdersTable } from './OrdersTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { OrderOverrideModal } from './OrderOverrideModal';

interface OrdersClientProps {
  orders: Order[];
}

export function OrdersClient({ orders }: OrdersClientProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <>
      {orders.length ? (
        <OrdersTable data={orders} onSelectOrder={setSelectedOrder} />
      ) : (
        <EmptyState
          title="No orders yet"
          description="Load fixtures or connect to Supabase to monitor orders in real time."
        />
      )}
      {selectedOrder ? (
        <OrderOverrideModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      ) : null}
    </>
  );
}
