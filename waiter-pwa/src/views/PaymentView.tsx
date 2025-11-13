import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CreditCard, Smartphone, ArrowLeft, Loader2, CheckCircle } from 'lucide-react'
import { useCart } from '@/contexts/CartContext'
import { useSupabase } from '@/contexts/SupabaseContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const log = console

type PaymentMethod = 'momo' | 'revolut' | 'card'

export function PaymentView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { items, total, clearCart } = useCart()
  const { supabase, userId } = useSupabase()

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('momo')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart')
    }
  }, [items, navigate])

  // Create order on mount
  useEffect(() => {
    const createOrder = async () => {
      if (!userId || items.length === 0) return

      try {
        const params = new URLSearchParams(window.location.search)
        const venue = params.get('venue')
        const table = params.get('table')

        const { data, error } = await supabase
          .from('orders')
          .insert({
            user_id: userId,
            items: items,
            total_amount: total,
            status: 'pending',
            metadata: { venue, table, source: 'pwa' },
          })
          .select()
          .single()

        if (error) throw error

        setOrderId(data.id)
        log.info('[Payment] Order created', { orderId: data.id })
      } catch (error) {
        log.error('[Payment] Order creation error', error)
        setError('Failed to create order. Please try again.')
      }
    }

    createOrder()
  }, [userId, items, total, supabase])

  // Listen for payment status updates
  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`payment-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payments',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          log.info('[Payment] Status update', payload.new)
          
          if (payload.new.status === 'successful') {
            clearCart()
            navigate(`/order/${orderId}`)
          } else if (payload.new.status === 'failed') {
            setIsProcessing(false)
            setError('Payment failed. Please try again.')
          }
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [orderId, supabase, navigate, clearCart])

  const handleMoMoPayment = async () => {
    if (!phoneNumber || !orderId) return

    setIsProcessing(true)
    setError(null)

    try {
      const { data, error } = await supabase.functions.invoke('momo_charge', {
        body: {
          orderId,
          userId,
          phoneNumber,
          amount: total,
          currency: 'XAF',
        },
      })

      if (error) throw error

      log.info('[Payment] MoMo initiated', { orderId })
    } catch (error: any) {
      log.error('[Payment] MoMo error', error)
      setIsProcessing(false)
      setError(error.message || 'Payment failed. Please try again.')
    }
  }

  const handleRevolutPayment = async () => {
    if (!orderId) return

    setIsProcessing(true)
    setError(null)

    try {
      const { data, error } = await supabase.functions.invoke('revolut_charge', {
        body: {
          orderId,
          userId,
          amount: total,
          currency: 'EUR',
        },
      })

      if (error) throw error

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }

      log.info('[Payment] Revolut initiated', { orderId })
    } catch (error: any) {
      log.error('[Payment] Revolut error', error)
      setIsProcessing(false)
      setError(error.message || 'Payment failed. Please try again.')
    }
  }

  const handleSubmit = () => {
    if (paymentMethod === 'momo') {
      handleMoMoPayment()
    } else {
      handleRevolutPayment()
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm px-4 py-3 flex items-center safe-area-inset-top">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/cart')}
          disabled={isProcessing}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold ml-3">{t('payment.title')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Order Summary */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">{t('payment.orderSummary')}</h2>

          <div className="space-y-2 mb-4">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-3">
            <div className="flex justify-between font-semibold">
              <span>{t('payment.total')}</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div className="bg-card rounded-lg p-4 shadow-sm">
          <h2 className="font-semibold mb-3">{t('payment.method')}</h2>

          <div className="space-y-3">
            <label
              className={cn(
                'flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                paymentMethod === 'momo'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="momo"
                checked={paymentMethod === 'momo'}
                onChange={() => setPaymentMethod('momo')}
                className="w-4 h-4"
              />
              <Smartphone className="h-5 w-5" />
              <span>{t('payment.mobileMoney')}</span>
            </label>

            <label
              className={cn(
                'flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                paymentMethod === 'revolut'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="revolut"
                checked={paymentMethod === 'revolut'}
                onChange={() => setPaymentMethod('revolut')}
                className="w-4 h-4"
              />
              <CreditCard className="h-5 w-5" />
              <span>Revolut Pay</span>
            </label>

            <label
              className={cn(
                'flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-colors',
                paymentMethod === 'card'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              )}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={() => setPaymentMethod('card')}
                className="w-4 h-4"
              />
              <CreditCard className="h-5 w-5" />
              <span>{t('payment.creditCard')}</span>
            </label>
          </div>
        </div>

        {/* Payment Details */}
        {paymentMethod === 'momo' && (
          <div className="bg-card rounded-lg p-4 shadow-sm">
            <label className="block text-sm font-medium mb-2">
              {t('payment.momo.phoneNumber')}
            </label>
            <input
              type="tel"
              placeholder="+237 6XX XXX XXX"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isProcessing}
            />
            <p className="text-sm text-muted-foreground mt-2">
              {t('payment.momo.description')}
            </p>
          </div>
        )}

        {(paymentMethod === 'revolut' || paymentMethod === 'card') && (
          <div className="bg-card rounded-lg p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">
              {t('payment.card.secure')}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isProcessing || (paymentMethod === 'momo' && !phoneNumber)}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('payment.processing')}
            </>
          ) : (
            t('payment.pay')
          )}
        </Button>
      </div>
    </div>
  )
}
