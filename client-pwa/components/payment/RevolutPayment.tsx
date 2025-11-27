'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Loader2, ExternalLink, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useHaptics } from '@/hooks/useHaptics';
import {
  createRevolutPayment,
  checkRevolutPaymentStatus,
  openRevolutPayment,
} from '@/lib/payment/revolut';

interface RevolutPaymentProps {
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  orderId: string;
  description: string;
  customerEmail?: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
}

export function RevolutPayment({
  amount,
  currency,
  orderId,
  description,
  customerEmail,
  onSuccess,
  onError,
}: RevolutPaymentProps) {
  const { trigger } = useHaptics();
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'polling' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll payment status
  useEffect(() => {
    if (status !== 'polling' || !paymentId) return;

    const pollInterval = setInterval(async () => {
      const result = await checkRevolutPaymentStatus(paymentId);
      
      if (result.status === 'completed') {
        setStatus('success');
        trigger('success');
        onSuccess(paymentId);
        clearInterval(pollInterval);
      } else if (result.status === 'failed' || result.status === 'expired') {
        setStatus('error');
        setErrorMessage(result.message);
        trigger('error');
        onError(result.message);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 10 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (status === 'polling') {
        setStatus('error');
        setErrorMessage('Payment timeout - please try again');
        onError('Payment timeout');
      }
    }, 600000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [status, paymentId, trigger, onSuccess, onError]);

  const handleInitiatePayment = useCallback(async () => {
    setStatus('processing');
    setErrorMessage(null);
    trigger('selection');

    const result = await createRevolutPayment({
      amount,
      currency,
      orderId,
      customerEmail,
      description,
      returnUrl: `${window.location.origin}/${orderId}/payment/success`,
    });

    if (result.success && result.paymentUrl && result.paymentId) {
      setPaymentUrl(result.paymentUrl);
      setPaymentId(result.paymentId);
      setStatus('polling');
      
      // Open Revolut payment page
      openRevolutPayment(result.paymentUrl);
    } else {
      setStatus('error');
      setErrorMessage(result.message);
      trigger('error');
      onError(result.message);
    }
  }, [amount, currency, orderId, customerEmail, description, trigger, onError]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Revolut Pay</h3>
          <p className="text-sm text-muted-foreground">
            {amount.toFixed(2)} {currency}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-2xl bg-muted/50">
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to Revolut to complete your payment securely.
                Accepts cards, Apple Pay, and Google Pay.
              </p>
            </div>

            <Button
              onClick={handleInitiatePayment}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Pay with Revolut
            </Button>
          </motion.div>
        )}

        {(status === 'processing' || status === 'polling') && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Status */}
            <div className="text-center space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-medium text-foreground">
                  {status === 'processing'
                    ? 'Opening Revolut...'
                    : 'Waiting for payment confirmation'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete the payment in the Revolut window
                </p>
              </div>
            </div>

            {/* Reopen Button */}
            {paymentUrl && status === 'polling' && (
              <Button
                onClick={() => openRevolutPayment(paymentUrl)}
                variant="outline"
                className="w-full"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Reopen Payment Window
              </Button>
            )}
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-3 py-6"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-lg">
                Payment Successful!
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Your order is being prepared
              </p>
            </div>
          </motion.div>
        )}

        {status === 'error' && errorMessage && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Payment Failed</p>
                <p className="text-sm text-destructive/80 mt-1">
                  {errorMessage}
                </p>
              </div>
            </div>

            <Button
              onClick={() => {
                setStatus('idle');
                setErrorMessage(null);
                setPaymentUrl(null);
                setPaymentId(null);
              }}
              variant="outline"
              className="w-full"
            >
              Try Again
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
