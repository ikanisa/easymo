'use client';

import { useState, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, RefreshCw, Volume2, VolumeX, Filter, Plus } from 'lucide-react';
import { useOrders, OrderStatus } from '@/hooks/useOrders';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { OrderCard } from './OrderCard';
import { OrderDetailPanel } from './OrderDetailPanel';
import { cn } from '@/lib/utils';

const STATUS_COLUMNS: { id: OrderStatus; label: string; color: string }[] = [
  { id: 'pending', label: 'New Orders', color: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
  { id: 'confirmed', label: 'Confirmed', color: 'bg-purple-500/10 border-purple-500/20 text-purple-500' },
  { id: 'preparing', label: 'Preparing', color: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
  { id: 'ready', label: 'Ready', color: 'bg-green-500/10 border-green-500/20 text-green-500' },
];

export function OrderQueue() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const { orders, updateOrderStatus, isLoading, refetch } = useOrders();

  // Filter orders
  const filteredOrders = useMemo(() => {
    if (!searchQuery) return orders;
    const query = searchQuery.toLowerCase();
    return orders.filter(
      (order) =>
        order.order_number.toLowerCase().includes(query) ||
        order.table_number?.toLowerCase().includes(query) ||
        order.customer_phone?.includes(query)
    );
  }, [orders, searchQuery]);

  // Group orders by status
  const groupedOrders = useMemo(() => {
    const groups: Record<OrderStatus, typeof orders> = {
      pending: [],
      confirmed: [],
      preparing: [],
      ready: [],
      served: [],
      cancelled: [],
    };

    filteredOrders.forEach((order) => {
      if (groups[order.status]) {
        groups[order.status].push(order);
      }
    });

    return groups;
  }, [filteredOrders]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const orderId = active.id as string;
      const newStatus = over.id as OrderStatus;

      // Find the order
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      // Only update if status changed
      if (order.status !== newStatus) {
        updateOrderStatus({ orderId, status: newStatus });
      }
    },
    [orders, updateOrderStatus]
  );

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId),
    [orders, selectedOrderId]
  );

  const activeOrder = useMemo(
    () => orders.find((o) => o.id === activeId),
    [orders, activeId]
  );

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Orders</h1>
            <p className="text-sm text-zinc-400">Manage orders with drag & drop</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                placeholder="Search orders... (⌘F)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 bg-zinc-900 border-zinc-800 pl-9"
              />
            </div>

            {/* Sound Toggle */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                'border-zinc-800',
                soundEnabled ? 'bg-primary/10 text-primary' : 'bg-zinc-900'
              )}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>

            {/* Refresh */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              className="border-zinc-800 bg-zinc-900"
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>

            {/* New Order */}
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-w-max">
            {STATUS_COLUMNS.map((column) => (
              <div key={column.id} className="flex w-80 flex-col">
                {/* Column Header */}
                <div
                  className={cn(
                    'mb-3 flex items-center justify-between rounded-lg border px-3 py-2',
                    column.color
                  )}
                >
                  <span className="font-semibold">{column.label}</span>
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">
                    {groupedOrders[column.id]?.length || 0}
                  </Badge>
                </div>

                {/* Drop Zone */}
                <SortableContext
                  id={column.id}
                  items={groupedOrders[column.id]?.map((o) => o.id) || []}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-zinc-900/30 p-3 border border-zinc-800">
                    <AnimatePresence mode="popLayout">
                      {groupedOrders[column.id]?.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          isSelected={selectedOrderId === order.id}
                          onSelect={() => setSelectedOrderId(order.id)}
                        />
                      ))}
                    </AnimatePresence>

                    {(!groupedOrders[column.id] || groupedOrders[column.id].length === 0) && (
                      <div className="flex h-32 items-center justify-center text-sm text-zinc-600">
                        Drop orders here
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeOrder && (
              <div className="rotate-3 opacity-80">
                <OrderCard order={activeOrder} isSelected={false} onSelect={() => {}} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Order Detail Panel */}
      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailPanel
            order={selectedOrder}
            onClose={() => setSelectedOrderId(null)}
            onStatusChange={(status) => updateOrderStatus({ orderId: selectedOrder.id, status })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
