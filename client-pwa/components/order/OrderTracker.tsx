'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  CheckCircle2, 
  ChefHat, 
  Package, 
  Truck,
  XCircle,
  AlertCircle 
} from 'lucide-react';
import { useAdvancedHaptics } from '@/lib/haptics';
import { usePushNotifications } from '@/lib/push-notifications';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivering' | 'completed' | 'cancelled';

interface OrderStep {
  status: OrderStatus;
  icon: typeof Clock;
  label: string;
  color: string;
}

const ORDER_STEPS: OrderStep[] = [
  { status: 'pending', icon: Clock, label: 'Order Placed', color: 'text-yellow-500' },
  { status: 'confirmed', icon: CheckCircle2, label: 'Confirmed', color: 'text-blue-500' },
  { status: 'preparing', icon: ChefHat, label: 'Preparing', color: 'text-orange-500' },
  { status: 'ready', icon: Package, label: 'Ready', color: 'text-green-500' },
  { status: 'delivering', icon: Truck, label: 'On the Way', color: 'text-purple-500' },
  { status: 'completed', icon: CheckCircle2, label: 'Delivered', color: 'text-green-600' },
];

interface OrderTrackerProps {
  orderId: string;
  currentStatus: OrderStatus;
  estimatedTime?: number; // minutes
  onStatusChange?: (status: OrderStatus) => void;
}

export function OrderTracker({
  orderId,
  currentStatus,
  estimatedTime,
  onStatusChange,
}: OrderTrackerProps) {
  const [status, setStatus] = useState<OrderStatus>(currentStatus);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(estimatedTime || null);
  const haptics = useAdvancedHaptics();
  const notifications = usePushNotifications();

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000');

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', orderId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'status_update' && data.orderId === orderId) {
        setStatus(data.status);
        setTimeRemaining(data.estimatedTime);
        
        // Haptic feedback
        haptics.notification();
        
        // Push notification
        notifications.showNotification({
          title: 'Order Update',
          body: `Your order is now ${data.status}`,
          tag: `order-${orderId}`,
          data: { orderId, status: data.status },
        });

        onStatusChange?.(data.status);
      }
    };

    return () => {
      ws.close();
    };
  }, [orderId, haptics, notifications, onStatusChange]);

  // Countdown timer
  useEffect(() => {
    if (!timeRemaining) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (!prev || prev <= 0) return null;
        return prev - 1;
      });
    }, 60000); // Every minute

    return () => clearInterval(interval);
  }, [timeRemaining]);

  const currentStepIndex = ORDER_STEPS.findIndex((step) => step.status === status);
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';

  return (
    <div className="w-full max-w-md mx-auto p-6 space-y-6">
      {/* Status Header */}
      <div className="text-center space-y-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10"
          >
            {isCancelled ? (
              <XCircle className="w-10 h-10 text-red-500" />
            ) : (
              (() => {
                const Icon = ORDER_STEPS[currentStepIndex]?.icon || Clock;
                return <Icon className={`w-10 h-10 ${ORDER_STEPS[currentStepIndex]?.color}`} />;
              })()
            )}
          </motion.div>
        </AnimatePresence>

        <h2 className="text-2xl font-bold">
          {isCancelled ? 'Order Cancelled' : ORDER_STEPS[currentStepIndex]?.label}
        </h2>

        {timeRemaining && !isCancelled && !isCompleted && (
          <p className="text-muted-foreground">
            Estimated time: {timeRemaining} min
          </p>
        )}
      </div>

      {/* Progress Steps */}
      {!isCancelled && (
        <div className="relative space-y-4">
          {ORDER_STEPS.filter((step) => step.status !== 'cancelled').map((step, index) => {
            const isActive = index === currentStepIndex;
            const isCompleted = index < currentStepIndex;
            const Icon = step.icon;

            return (
              <motion.div
                key={step.status}
                initial={false}
                animate={{
                  opacity: isActive || isCompleted ? 1 : 0.4,
                  x: isActive ? 4 : 0,
                }}
                className="relative flex items-center gap-4"
              >
                {/* Connector Line */}
                {index < ORDER_STEPS.length - 2 && (
                  <div className="absolute left-5 top-12 w-0.5 h-8 bg-border">
                    <motion.div
                      className="w-full bg-primary"
                      initial={{ height: '0%' }}
                      animate={{ height: isCompleted ? '100%' : '0%' }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}

                {/* Icon */}
                <motion.div
                  className={`
                    relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2
                    ${isActive || isCompleted ? 'border-primary bg-primary/10' : 'border-border bg-background'}
                  `}
                  animate={{
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    repeat: isActive ? Infinity : 0,
                    duration: 2,
                  }}
                >
                  <Icon className={`w-5 h-5 ${isActive || isCompleted ? step.color : 'text-muted-foreground'}`} />
                  
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary"
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.5,
                      }}
                    />
                  )}
                </motion.div>

                {/* Label */}
                <div className="flex-1">
                  <p className={`font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {step.label}
                  </p>
                </div>

                {/* Checkmark */}
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-primary"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Cancelled Message */}
      {isCancelled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20"
        >
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">
            This order has been cancelled. Please contact support if you have questions.
          </p>
        </motion.div>
      )}
    </div>
  );
}
