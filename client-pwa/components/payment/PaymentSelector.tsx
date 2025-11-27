'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, CreditCard, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

export type PaymentMethod = 'momo' | 'revolut';

interface PaymentSelectorProps {
  onSelect: (method: PaymentMethod) => void;
  selectedMethod?: PaymentMethod;
  country: 'RW' | 'MT' | 'OTHER';
}

export function PaymentSelector({
  onSelect,
  selectedMethod,
  country,
}: PaymentSelectorProps) {
  const { trigger } = useHaptics();
  const [selected, setSelected] = useState<PaymentMethod | undefined>(selectedMethod);

  const handleSelect = useCallback(
    (method: PaymentMethod) => {
      trigger('selection');
      setSelected(method);
      onSelect(method);
    },
    [onSelect, trigger]
  );

  // Show MoMo for Rwanda, Revolut for Malta/Europe
  const showMoMo = country === 'RW';
  const showRevolut = country === 'MT' || country === 'OTHER';

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">
        Select Payment Method
      </h3>

      <div className="space-y-3">
        {/* MoMo Option */}
        {showMoMo && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect('momo')}
            className={cn(
              'w-full p-4 rounded-2xl border-2 transition-all',
              'flex items-center gap-4',
              'touch-manipulation',
              selected === 'momo'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-border/80'
            )}
          >
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-yellow-400 to-yellow-600'
              )}
            >
              <Smartphone className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 text-left">
              <h4 className="font-semibold text-foreground">MTN Mobile Money</h4>
              <p className="text-sm text-muted-foreground">
                Pay with MoMo USSD
              </p>
            </div>

            {selected === 'momo' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>
        )}

        {/* Revolut Option */}
        {showRevolut && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleSelect('revolut')}
            className={cn(
              'w-full p-4 rounded-2xl border-2 transition-all',
              'flex items-center gap-4',
              'touch-manipulation',
              selected === 'revolut'
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-border/80'
            )}
          >
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                'bg-gradient-to-br from-blue-500 to-blue-700'
              )}
            >
              <CreditCard className="w-6 h-6 text-white" />
            </div>

            <div className="flex-1 text-left">
              <h4 className="font-semibold text-foreground">Revolut Pay</h4>
              <p className="text-sm text-muted-foreground">
                Card, Apple Pay, Google Pay
              </p>
            </div>

            {selected === 'revolut' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
              >
                <ArrowRight className="w-4 h-4 text-primary-foreground" />
              </motion.div>
            )}
          </motion.button>
        )}
      </div>
    </div>
  );
}
