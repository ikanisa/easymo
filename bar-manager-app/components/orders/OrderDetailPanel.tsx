'use client';

import { motion } from 'framer-motion';
import { X, Clock, User, Phone, MapPin, Edit, Trash2, Printer, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import { OrderStatus } from '@/hooks/useOrders';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: string;
  table_number: string | null;
  status: OrderStatus;
  created_at: string;
  total: number;
  subtotal?: number;
  tax?: number;
  currency: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
    special_instructions?: string;
  }>;
  customer_name?: string | null;
  customer_phone?: string | null;
  notes?: string | null;
  order_type?: string;
  source?: string;
}

interface OrderDetailPanelProps {
  order: Order;
  onClose: () => void;
  onStatusChange: (status: OrderStatus) => void;
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'served',
  served: null,
  cancelled: null,
};

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string }> = {
  pending: { label: 'New', color: 'bg-blue-500' },
  confirmed: { label: 'Confirmed', color: 'bg-purple-500' },
  preparing: { label: 'Preparing', color: 'bg-amber-500' },
  ready: { label: 'Ready', color: 'bg-green-500' },
  served: { label: 'Served', color: 'bg-zinc-500' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500' },
};

export function OrderDetailPanel({ order, onClose, onStatusChange }: OrderDetailPanelProps) {
  const nextStatus = STATUS_FLOW[order.status];
  const config = STATUS_CONFIG[order.status];

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed right-0 top-0 z-50 h-screen w-[480px] bg-zinc-900 border-l border-zinc-800 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">Order #{order.order_number}</h2>
            <p className="text-sm text-zinc-400">
              {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Badge */}
          <div className="mb-6">
            <Badge
              className={cn('text-white', config.color)}
              variant="default"
            >
              <Clock className="mr-1 h-3 w-3" />
              {config.label}
            </Badge>
          </div>

          {/* Customer Info */}
          {(order.customer_name || order.customer_phone) && (
            <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
              <h3 className="mb-3 font-semibold text-white">Customer</h3>
              <div className="space-y-2 text-sm">
                {order.customer_name && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <User className="h-4 w-4 text-zinc-500" />
                    {order.customer_name}
                  </div>
                )}
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Phone className="h-4 w-4 text-zinc-500" />
                    {order.customer_phone}
                  </div>
                )}
                {order.table_number && (
                  <div className="flex items-center gap-2 text-zinc-300">
                    <MapPin className="h-4 w-4 text-zinc-500" />
                    Table {order.table_number}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items */}
          <div className="mb-6">
            <h3 className="mb-3 font-semibold text-white">Items</h3>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/20 text-xs font-bold text-primary">
                          {item.quantity}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-white">{item.name}</p>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="mt-1 text-xs text-zinc-400">
                              + {item.modifiers.join(', ')}
                            </p>
                          )}
                          {item.special_instructions && (
                            <p className="mt-1 text-xs text-amber-400">
                              ⚠️ {item.special_instructions}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-white">
                      {formatCurrency(item.price * item.quantity, order.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="mb-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
              <h3 className="mb-2 font-semibold text-amber-400">Notes</h3>
              <p className="text-sm text-amber-200">{order.notes}</p>
            </div>
          )}

          {/* Totals */}
          <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-800/30 p-4">
            {order.subtotal && (
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal, order.currency)}</span>
              </div>
            )}
            {order.tax && (
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Tax</span>
                <span>{formatCurrency(order.tax, order.currency)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-zinc-700 pt-2 text-lg font-bold text-white">
              <span>Total</span>
              <span>{formatCurrency(order.total, order.currency)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-3 flex gap-2">
            <Button variant="outline" className="flex-1 border-zinc-700">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" className="flex-1 border-zinc-700">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button variant="destructive" className="flex-1">
              <Trash2 className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>

          {nextStatus && (
            <Button
              onClick={() => onStatusChange(nextStatus)}
              className="w-full bg-primary hover:bg-primary/90"
              size="lg"
            >
              {order.status === 'pending' && 'Confirm Order'}
              {order.status === 'confirmed' && 'Start Preparing'}
              {order.status === 'preparing' && 'Mark as Ready'}
              {order.status === 'ready' && 'Mark as Served'}
            </Button>
          )}
        </div>
      </motion.div>
    </>
  );
}
