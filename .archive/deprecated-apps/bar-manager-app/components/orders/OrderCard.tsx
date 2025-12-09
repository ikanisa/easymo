'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { Clock, MoreVertical, Phone, MessageSquare, Printer } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: string;
  table_number: string | null;
  status: string;
  created_at: string;
  total: number;
  currency: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    modifiers?: string[];
    special_instructions?: string;
  }>;
  customer_phone?: string | null;
  order_type?: string;
  source?: string;
}

interface OrderCardProps {
  order: Order;
  isSelected: boolean;
  onSelect: () => void;
}

export function OrderCard({ order, isSelected, onSelect }: OrderCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const elapsedTime = formatDistanceToNow(new Date(order.created_at), { addSuffix: false });
  const elapsedMs = Date.now() - new Date(order.created_at).getTime();
  const isDelayed = elapsedMs > 10 * 60 * 1000; // 10 minutes

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      whileHover={{ scale: 1.02 }}
      onClick={onSelect}
      className={cn(
        'relative cursor-grab active:cursor-grabbing rounded-lg border bg-zinc-900 p-4 transition-all',
        'hover:shadow-lg hover:border-primary/30',
        isSelected && 'ring-2 ring-primary border-primary',
        isDelayed && 'border-red-500/50',
        isDragging && 'opacity-50 rotate-3'
      )}
    >
      {/* Delayed Indicator */}
      {isDelayed && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500"
        />
      )}

      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white">#{order.order_number}</span>
            {order.source === 'whatsapp' && (
              <Badge variant="success" className="text-xs">
                WhatsApp
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-zinc-400">
            {order.table_number && (
              <span className="font-medium">Table {order.table_number}</span>
            )}
            {order.order_type === 'takeaway' && (
              <Badge variant="outline" className="text-xs border-zinc-700">
                Takeaway
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center gap-1 rounded-lg px-2 py-1 text-xs',
              isDelayed ? 'bg-red-500/10 text-red-500' : 'bg-zinc-800 text-zinc-400'
            )}
          >
            <Clock className="h-3 w-3" />
            {elapsedTime}
          </div>
        </div>
      </div>

      {/* Items Preview */}
      <div className="mb-3 space-y-1.5">
        {order.items.slice(0, 3).map((item, index) => (
          <div key={index} className="flex items-start justify-between text-sm">
            <span className="flex items-start gap-2 text-zinc-300">
              <span className="font-medium text-primary">{item.quantity}×</span>
              <span className="flex-1">{item.name}</span>
            </span>
            <span className="text-zinc-500">
              {formatCurrency(item.price * item.quantity, 'RWF')}
            </span>
          </div>
        ))}
        {order.items.length > 3 && (
          <p className="text-xs text-zinc-500">+{order.items.length - 3} more items</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <span className="text-lg font-bold text-white">
          {formatCurrency(order.total, order.currency)}
        </span>

        <div className="flex items-center gap-1">
          {order.customer_phone && (
            <>
              <button
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle phone call
                }}
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  // Handle WhatsApp
                }}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              // Handle print
            }}
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
