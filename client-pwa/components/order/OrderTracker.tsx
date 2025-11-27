'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  ChefHat, 
  UtensilsCrossed, 
  CheckCircle2,
  Bell,
  MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/utils';

interface OrderTrackerProps {
  orderId: string;
}

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed';

interface OrderUpdate {
  status: OrderStatus;
  message?: string;
  estimated_time?: number;
  updated_at: string;
}

const STATUS_CONFIG: Record<OrderStatus, {
  icon: any;
  label: string;
  color: string;
  description: string;
}> = {
  pending: {
    icon: Clock,
    label: 'Order Received',
    color: 'text-yellow-500',
    description: 'Waiting for confirmation',
  },
  confirmed: {
    icon: CheckCircle2,
    label: 'Confirmed',
    color: 'text-blue-500',
    description: 'Your order has been confirmed',
  },
  preparing: {
    icon: ChefHat,
    label: 'Preparing',
    color: 'text-orange-500',
    description: 'The kitchen is preparing your order',
  },
  ready: {
    icon: Bell,
    label: 'Ready!',
    color: 'text-green-500',
    description: 'Your order is ready for pickup/serving',
  },
  served: {
    icon: UtensilsCrossed,
    label: 'Served',
    color: 'text-primary',
    description: 'Enjoy your meal!',
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-green-600',
    description: 'Thank you for your order!',
  },
};

const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];

export function OrderTracker({ orderId }: OrderTrackerProps) {
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [updates, setUpdates] = useState<OrderUpdate[]>([]);
  const { notification, orderConfirmed } = useHaptics();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: any) => {
          const newStatus = payload.new.status as OrderStatus;
          const prevStatus = status;
          
          setStatus(newStatus);
          setEstimatedTime(payload.new.estimated_ready_time);
          
          setUpdates((prev) => [
            {
              status: newStatus,
              message: payload.new.status_message,
              estimated_time: payload.new.estimated_ready_time,
              updated_at: payload.new.updated_at,
            },
            ...prev,
          ]);

          notification();

          if (newStatus === 'ready' && prevStatus !== 'ready') {
            orderConfirmed();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, status]);

  useEffect(() => {
    const fetchOrder = async () => {
      const { data } = await supabase
        .from('orders')
        .select('status, estimated_ready_time, status_message, updated_at')
        .eq('id', orderId)
        .single();

      if (data) {
        setStatus(data.status);
        setEstimatedTime(data.estimated_ready_time);
      }
    };

    fetchOrder();
  }, [orderId]);

  const currentStatusIndex = STATUS_ORDER.indexOf(status);
  const currentConfig = STATUS_CONFIG[status];

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <motion.div
          key={status}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn(
            'w-24 h-24 mx-auto rounded-full',
            'flex items-center justify-center',
            'bg-gradient-to-br',
            status === 'ready' && 'from-green-500 to-emerald-600 animate-pulse',
            status === 'preparing' && 'from-orange-500 to-amber-600',
            status === 'confirmed' && 'from-blue-500 to-indigo-600',
            status === 'pending' && 'from-yellow-500 to-amber-500',
            status === 'served' && 'from-primary to-amber-500',
            status === 'completed' && 'from-green-600 to-emerald-700'
          )}
        >
          <currentConfig.icon className="w-12 h-12 text-white" />
        </motion.div>

        <motion.div
          key={`label-${status}`}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
        >
          <h2 className="text-2xl font-bold">{currentConfig.label}</h2>
          <p className="text-muted-foreground">{currentConfig.description}</p>
        </motion.div>

        {estimatedTime && status === 'preparing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted"
          >
            <Clock className="w-4 h-4" />
            <span className="font-medium">~{estimatedTime} min remaining</span>
          </motion.div>
        )}
      </div>

      <div className="relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={{ 
              width: `${(currentStatusIndex / (STATUS_ORDER.length - 1)) * 100}%` 
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />
        </div>

        <div className="relative flex justify-between">
          {STATUS_ORDER.slice(0, -1).map((s, index) => {
            const config = STATUS_CONFIG[s];
            const isActive = index <= currentStatusIndex;
            const isCurrent = s === status;

            return (
              <div key={s} className="flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.2 : 1,
                    backgroundColor: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  }}
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    'transition-colors z-10',
                    isActive ? 'text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  <config.icon className="w-5 h-5" />
                </motion.div>
                <span className={cn(
                  'text-xs mt-2 text-center max-w-[60px]',
                  isActive ? 'text-foreground font-medium' : 'text-muted-foreground'
                )}>
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {updates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Recent Updates</h3>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {updates.slice(0, 5).map((update) => (
                <motion.div
                  key={`${update.status}-${update.updated_at}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-muted/50"
                >
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    STATUS_CONFIG[update.status].color,
                    'bg-current/10'
                  )}>
                    {(() => {
                      const Icon = STATUS_CONFIG[update.status].icon;
                      return <Icon className="w-4 h-4" />;
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{STATUS_CONFIG[update.status].label}</p>
                    {update.message && (
                      <p className="text-sm text-muted-foreground">{update.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(update.updated_at).toLocaleTimeString()}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {status !== 'completed' && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          className={cn(
            'w-full py-4 rounded-2xl',
            'bg-secondary text-secondary-foreground',
            'flex items-center justify-center gap-2',
            'font-medium'
          )}
        >
          <MessageSquare className="w-5 h-5" />
          Need Assistance?
        </motion.button>
      )}
    </div>
  );
}
