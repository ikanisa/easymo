'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Smartphone, CreditCard, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatPrice } from '@/lib/format';
import { updatePaymentStatus } from '@/lib/api/orders';
import type { Venue } from '@/types/venue';

interface Order {
  id: string;
  total: number;
  currency: string;
  customerPhone: string;
  paymentStatus: string;
}

interface PaymentPageProps {
  venue: Venue;
  order: Order;
}

type PaymentMethod = 'momo' | 'revolut' | null;

export function PaymentPage({ venue, order }: PaymentPageProps) {
  const router = useRouter();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCopyUSSD = () => {
    navigator.clipboard.writeText('*182*8*1#');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMoMoComplete = async () => {
    setIsProcessing(true);
    // In real implementation, verify payment through backend
    await updatePaymentStatus(order.id, 'completed', 'momo');
    router.push(`/${venue.slug}/order/${order.id}`);
  };

  const handleRevolutComplete = async () => {
    setIsProcessing(true);
    // In real implementation, verify payment callback
    await updatePaymentStatus(order.id, 'completed', 'revolut');
    router.push(`/${venue.slug}/order/${order.id}`);
  };

  if (order.paymentStatus === 'completed') {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Payment Complete!</h2>
        <p className="text-muted-foreground mb-6 text-center">
          Your payment has been received
        </p>
        <Button asChild>
          <Link href={`/${venue.slug}/order/${order.id}`}>View Order</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-4 px-4 py-4">
          <Link href={`/${venue.slug}/order/${order.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Payment</h1>
            <p className="text-sm text-muted-foreground">{venue.name}</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Amount to Pay */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <p className="text-sm text-muted-foreground mb-1">Amount to Pay</p>
          <p className="text-4xl font-bold text-primary">
            {formatPrice(order.total, order.currency)}
          </p>
        </Card>

        {/* Payment Method Selection */}
        {!selectedMethod && (
          <>
            <h2 className="text-lg font-semibold">Select Payment Method</h2>

            {/* MoMo USSD */}
            <Card
              className="p-4 cursor-pointer hover:border-primary/50 transition-colors active:scale-98"
              onClick={() => setSelectedMethod('momo')}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Smartphone className="w-6 h-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">MTN MoMo (Rwanda)</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Pay using MoMo USSD code
                  </p>
                  <Badge variant="secondary">Instant • No fees</Badge>
                </div>
              </div>
            </Card>

            {/* Revolut Link */}
            <Card
              className="p-4 cursor-pointer hover:border-primary/50 transition-colors active:scale-98"
              onClick={() => setSelectedMethod('revolut')}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Revolut (International)</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Pay with card or Revolut account
                  </p>
                  <Badge variant="secondary">Cards accepted</Badge>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* MoMo USSD Instructions */}
        {selectedMethod === 'momo' && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedMethod(null)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Payment Method
            </Button>

            <Card className="p-6 bg-orange-500/5 border-orange-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-lg font-semibold">MoMo USSD Payment</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Step 1: Dial USSD Code</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-3 bg-background rounded-xl font-mono text-lg">
                      *182*8*1#
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyUSSD}
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Step 2: Select Option</p>
                  <p className="text-sm text-muted-foreground">
                    Choose "Send Money" from the menu
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Step 3: Enter Details</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Recipient:</span>
                      <code className="font-mono">0788 XXX XXX</code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Amount:</span>
                      <code className="font-mono font-semibold">
                        {order.total.toLocaleString()} RWF
                      </code>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reference:</span>
                      <code className="font-mono">{order.id.slice(0, 8)}</code>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Step 4: Confirm</p>
                  <p className="text-sm text-muted-foreground">
                    Enter your MoMo PIN to complete the transaction
                  </p>
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <Button
                    onClick={handleMoMoComplete}
                    disabled={isProcessing}
                    className="w-full"
                    size="lg"
                  >
                    {isProcessing ? 'Processing...' : 'I Have Completed Payment'}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Click after you receive the MoMo confirmation SMS
                  </p>
                </div>
              </div>
            </Card>

            {/* Help Card */}
            <Card className="p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">💡 Need Help?</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Make sure you have enough balance in your MoMo account</li>
                <li>• You'll receive an SMS confirmation when payment is successful</li>
                <li>• Contact restaurant staff if you encounter any issues</li>
              </ul>
            </Card>
          </div>
        )}

        {/* Revolut Link Instructions */}
        {selectedMethod === 'revolut' && (
          <div className="space-y-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedMethod(null)}
              className="mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Change Payment Method
            </Button>

            <Card className="p-6 bg-blue-500/5 border-blue-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold">Revolut Payment</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    You'll be redirected to Revolut to complete your payment securely.
                  </p>
                </div>

                <div className="p-4 bg-background rounded-xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm text-muted-foreground">Order Total</span>
                    <span className="text-lg font-semibold">
                      {formatPrice(order.total, order.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Payment Method</span>
                    <Badge>Card / Revolut Account</Badge>
                  </div>
                </div>

                <Button
                  onClick={() => {
                    // Generate Revolut payment link
                    const amount = (order.total / 100).toFixed(2); // Convert to EUR/USD
                    const reference = order.id.slice(0, 8);
                    const revolutLink = `https://revolut.me/vendorname/${amount}?reference=${reference}`;
                    window.open(revolutLink, '_blank');
                  }}
                  className="w-full"
                  size="lg"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open Revolut Payment
                </Button>

                <div className="border-t border-border pt-4">
                  <Button
                    onClick={handleRevolutComplete}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full"
                  >
                    {isProcessing ? 'Verifying...' : 'I Have Completed Payment'}
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    Click after completing payment on Revolut
                  </p>
                </div>
              </div>
            </Card>

            {/* Accepted Cards */}
            <Card className="p-4">
              <p className="text-sm font-medium mb-3">Accepted Payment Methods</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">💳 Visa</Badge>
                <Badge variant="secondary">💳 Mastercard</Badge>
                <Badge variant="secondary">💳 Amex</Badge>
                <Badge variant="secondary">🏦 Revolut</Badge>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
