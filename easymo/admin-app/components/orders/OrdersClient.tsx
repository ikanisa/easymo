"use client";

import { useState } from "react";
import type { Order } from "@/lib/schemas";
import { OrdersTable } from "./OrdersTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { OrderOverrideModal } from "./OrderOverrideModal";

interface OrdersClientProps {
  orders: Order[];
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadingMore?: boolean;
}

export function OrdersClient({ orders, hasMore, onLoadMore, loadingMore }: OrdersClientProps) {
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  return (
    <>
      {orders.length
        ? (
          <OrdersTable
            data={orders}
            hasMore={hasMore}
            onLoadMore={onLoadMore}
            loadingMore={loadingMore}
            onSelectOrder={setSelectedOrder}
          />
        )
        : (
          <EmptyState
            title="No orders yet"
            description="Load fixtures or connect to Supabase to monitor orders in real time."
          />
        )}
      {selectedOrder
        ? (
          <OrderOverrideModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )
        : null}
    </>
  );
}
