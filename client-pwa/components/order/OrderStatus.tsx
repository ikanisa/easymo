'use client';

import { motion } from 'framer-motion';
import { Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getOrderStatusInfo } from '@/lib/realtime';
import { useOrderRealtime } from '@/hooks/useOrderRealtime';
import type { OrderStatus as OrderStatusType } from '@/lib/realtime';
import { formatDistanceToNow } from 'date-fns';

interface OrderStatusProps {
  orderId: string;
  initialStatus?: OrderStatusType;
  showProgress?: boolean;
}

export function OrderStatus({
  orderId,
  initialStatus,
  showProgress = true,
}: OrderStatusProps) {
  const { status, lastUpdate, estimatedReadyTime } = useOrderRealtime(orderId);
  
  const currentStatus = status || initialStatus;
  if (!currentStatus) return null;

  const statusInfo = getOrderStatusInfo(currentStatus);

  const statusSteps: OrderStatusType[] = [
    'payment_confirmed',
    'received',
    'preparing',
    'ready',
    'served',
  ];

  const currentStepIndex = statusSteps.indexOf(currentStatus);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / statusSteps.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="text-6xl mb-4"
        >
          {statusInfo.icon}
        </motion.div>

        <h2 className={cn('text-2xl font-bold mb-2', statusInfo.color)}>
          {statusInfo.label}
        </h2>
        
        <p className="text-muted-foreground">
          {statusInfo.description}
        </p>

        {lastUpdate && (
          <p className="text-sm text-muted-foreground mt-2">
            Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
          </p>
        )}
      </div>

      {/* Estimated Time */}
      {estimatedReadyTime && currentStatus === 'preparing' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/20"
        >
          <Clock className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Estimated ready time
            </p>
            <p className="text-sm text-muted-foreground">
              {new Date(estimatedReadyTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </motion.div>
      )}

      {/* Progress Bar */}
      {showProgress && currentStepIndex >= 0 && currentStatus !== 'served' && (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
            />
          </div>

          {/* Steps */}
          <div className="flex justify-between">
            {statusSteps.map((step, index) => {
              const stepInfo = getOrderStatusInfo(step);
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div
                  key={step}
                  className={cn(
                    'flex flex-col items-center gap-1',
                    'flex-1 text-center'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      'transition-all duration-300',
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isCompleted ? (
                      isCurrent && currentStatus === 'preparing' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {stepInfo.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
