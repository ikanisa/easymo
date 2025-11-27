'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, CreditCard, QrCode, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/utils';

interface PaymentSelectorProps {
  orderId: string;
  amount: number;
  currency: 'RWF' | 'EUR';
  venueCountry: 'RW' | 'MT';
  onPaymentComplete: () => void;
}

type PaymentMethod = 'momo_ussd' | 'momo_qr' | 'revolut';

export function PaymentSelector({
  orderId,
  amount,
  currency,
  venueCountry,
  onPaymentComplete,
}: PaymentSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { trigger, checkout } = useHaptics();

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const availableMethods = venueCountry === 'RW'
    ? [
        { id: 'momo_ussd' as const, label: 'MTN MoMo', icon: Smartphone, description: 'Dial USSD code' },
        { id: 'momo_qr' as const, label: 'Scan to Pay', icon: QrCode, description: 'Scan QR with MoMo app' },
      ]
    : [
        { id: 'revolut' as const, label: 'Revolut', icon: CreditCard, description: 'Pay with Revolut link' },
      ];

  const handleMethodSelect = useCallback((method: PaymentMethod) => {
    trigger('selection');
    setSelectedMethod(method);
  }, [trigger]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    trigger('light');
    setTimeout(() => setCopied(false), 2000);
  }, [trigger]);

  const handlePayment = useCallback(async () => {
    setIsProcessing(true);
    checkout();
    
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false);
      onPaymentComplete();
    }, 2000);
  }, [checkout, onPaymentComplete]);

  const momoUssdCode = `*182*8*1*${amount}#`;
  const momoQrData = `mtn://pay?merchant=EASYMO&amount=${amount}&ref=${orderId}`;
  const revolutLink = `https://revolut.me/easymo?amount=${amount}&currency=${currency}&ref=${orderId}`;

  return (
    <div className="space-y-6">
      {/* Amount Display */}
      <div className="text-center py-6 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5">
        <p className="text-muted-foreground text-sm mb-1">Amount to Pay</p>
        <p className="text-4xl font-bold text-primary">
          {formatPrice(amount, currency)}
        </p>
      </div>

      {/* Payment Method Selection */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Choose Payment Method</p>
        <div className="grid gap-3">
          {availableMethods.map((method) => (
            <motion.button
              key={method.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleMethodSelect(method.id)}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all',
                'flex items-center gap-4 text-left',
                selectedMethod === method.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center',
                selectedMethod === method.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}>
                <method.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-medium">{method.label}</p>
                <p className="text-sm text-muted-foreground">{method.description}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Payment Instructions */}
      <AnimatePresence mode="wait">
        {selectedMethod === 'momo_ussd' && (
          <motion.div
            key="momo-ussd"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="p-6 rounded-2xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">Dial this code on your phone:</p>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-background border border-border">
                <code className="flex-1 text-2xl font-mono font-bold">{momoUssdCode}</code>
                <button
                  onClick={() => handleCopy(momoUssdCode)}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                1. Dial the code above<br />
                2. Enter your MoMo PIN<br />
                3. Confirm payment
              </p>
            </div>
          </motion.div>
        )}

        {selectedMethod === 'momo_qr' && (
          <motion.div
            key="momo-qr"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="p-6 rounded-2xl bg-muted/50 border border-border text-center">
              <p className="text-sm text-muted-foreground mb-4">Scan with MTN MoMo App</p>
              <div className="inline-block p-4 bg-white rounded-xl">
                {/* QR Code would go here - using placeholder */}
                <div className="w-48 h-48 bg-muted flex items-center justify-center">
                  <QrCode className="w-24 h-24 text-muted-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Open MTN MoMo app → Scan QR → Confirm payment
              </p>
            </div>
          </motion.div>
        )}

        {selectedMethod === 'revolut' && (
          <motion.div
            key="revolut"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="p-6 rounded-2xl bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground mb-3">Pay via Revolut link:</p>
              <a
                href={revolutLink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-2 p-4 rounded-xl',
                  'bg-primary text-primary-foreground font-medium',
                  'hover:bg-primary/90 transition-colors'
                )}
                onClick={() => trigger('medium')}
              >
                <ExternalLink className="w-5 h-5" />
                Open Revolut Payment
              </a>
              <p className="text-xs text-muted-foreground mt-3 text-center">
                You'll be redirected to Revolut to complete payment
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Button */}
      {selectedMethod && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handlePayment}
          disabled={isProcessing}
          className={cn(
            'w-full py-4 rounded-2xl font-medium',
            'bg-primary text-primary-foreground',
            'hover:bg-primary/90 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'flex items-center justify-center gap-2'
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            'I have completed payment'
          )}
        </motion.button>
      )}
    </div>
  );
}
