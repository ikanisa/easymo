'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, Copy, Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useHaptics } from '@/hooks/useHaptics';
import {
  initiateMoMoPayment,
  checkMoMoPaymentStatus,
  formatMoMoPhone,
  isValidRwandaPhone,
  openUSSDDialer,
} from '@/lib/payment/momo';

interface MoMoPaymentProps {
  amount: number;
  orderId: string;
  description: string;
  onSuccess: (transactionId: string) => void;
  onError: (error: string) => void;
}

export function MoMoPayment({
  amount,
  orderId,
  description,
  onSuccess,
  onError,
}: MoMoPaymentProps) {
  const { trigger } = useHaptics();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [ussdCode, setUssdCode] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'processing' | 'polling' | 'success' | 'error'>('idle');
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll payment status
  useEffect(() => {
    if (status !== 'polling' || !transactionId) return;

    const pollInterval = setInterval(async () => {
      const result = await checkMoMoPaymentStatus(transactionId);
      
      if (result.status === 'completed') {
        setStatus('success');
        trigger('success');
        onSuccess(transactionId);
        clearInterval(pollInterval);
      } else if (result.status === 'failed' || result.status === 'expired') {
        setStatus('error');
        setErrorMessage(result.message);
        trigger('error');
        onError(result.message);
        clearInterval(pollInterval);
      }
    }, 3000); // Poll every 3 seconds

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(pollInterval);
      if (status === 'polling') {
        setStatus('error');
        setErrorMessage('Payment timeout - please try again');
        onError('Payment timeout');
      }
    }, 300000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
    };
  }, [status, transactionId, trigger, onSuccess, onError]);

  const handleInitiatePayment = useCallback(async () => {
    // Validate phone
    if (!isValidRwandaPhone(phoneNumber)) {
      setErrorMessage('Please enter a valid Rwanda phone number');
      trigger('error');
      return;
    }

    setStatus('processing');
    setErrorMessage(null);
    trigger('selection');

    const result = await initiateMoMoPayment({
      amount,
      currency: 'RWF',
      orderId,
      phoneNumber: formatMoMoPhone(phoneNumber),
      description,
    });

    if (result.success && result.ussdCode && result.transactionId) {
      setUssdCode(result.ussdCode);
      setTransactionId(result.transactionId);
      setStatus('polling');
      
      // Try to open USSD dialer
      openUSSDDialer(result.ussdCode);
    } else {
      setStatus('error');
      setErrorMessage(result.message);
      trigger('error');
      onError(result.message);
    }
  }, [phoneNumber, amount, orderId, description, trigger, onError]);

  const handleCopyUSSD = useCallback(() => {
    if (!ussdCode) return;
    
    navigator.clipboard.writeText(ussdCode);
    setCopied(true);
    trigger('light');
    
    setTimeout(() => setCopied(false), 2000);
  }, [ussdCode, trigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">MTN Mobile Money</h3>
          <p className="text-sm text-muted-foreground">
            {amount.toLocaleString()} RWF
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium mb-2">
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="078 XXX XXXX"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Enter your MTN MoMo number
              </p>
            </div>

            <Button
              onClick={handleInitiatePayment}
              disabled={!phoneNumber}
              className="w-full"
              size="lg"
            >
              Continue to Payment
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
            {/* USSD Code Display */}
            {ussdCode && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/20 dark:to-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <p className="text-sm text-muted-foreground mb-2">
                  Dial this code on your phone:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-2xl font-bold text-foreground font-mono">
                    {ussdCode}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyUSSD}
                    className="flex-shrink-0"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="text-center space-y-3">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <div>
                <p className="font-medium text-foreground">
                  {status === 'processing'
                    ? 'Initiating payment...'
                    : 'Waiting for payment confirmation'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Complete the payment on your phone
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">How to complete payment:</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Dial {ussdCode} on your MTN number</li>
                <li>Enter your MoMo PIN</li>
                <li>Confirm the payment</li>
              </ol>
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
                setUssdCode(null);
                setTransactionId(null);
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
