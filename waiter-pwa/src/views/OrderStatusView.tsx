import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CheckCircle, Clock, Package, Home, ChefHat } from 'lucide-react'
import { useSupabase } from '@/contexts/SupabaseContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const log = console

interface Order {
  id: string
  status: string
  total_amount: number
  created_at: string
  items: Array<{
    name: string
    quantity: number
    price: number
  }>
}

const statusSteps = [
  { key: 'confirmed', icon: CheckCircle, label: 'Confirmed' },
  { key: 'preparing', icon: ChefHat, label: 'Preparing' },
  { key: 'ready', icon: Package, label: 'Ready' },
]

export function OrderStatusView() {
  const { orderId } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { supabase } = useSupabase()
  const [order, setOrder] = useState<Order | null>(null)
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!orderId) {
      navigate('/cart')
      return
    }

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        if (error) throw error

        setOrder(data)

        const stepIndex = statusSteps.findIndex((s) => s.key === data.status)
        setCurrentStep(stepIndex >= 0 ? stepIndex : 0)

        log.info('[OrderStatus] Order fetched', { orderId, status: data.status })
      } catch (error) {
        log.error('[OrderStatus] Fetch error', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOrder()

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          log.info('[OrderStatus] Update received', payload.new)
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : null))

          const stepIndex = statusSteps.findIndex((s) => s.key === payload.new.status)
          setCurrentStep(stepIndex >= 0 ? stepIndex : 0)

          // Show notification if order is ready
          if (payload.new.status === 'ready') {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(t('order.readyNotification'), {
                body: t('order.number', { number: orderId.slice(-6) }),
                icon: '/icon-192x192.png',
              })
            }
          }
        }
      )
      .subscribe()

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return () => {
      channel.unsubscribe()
    }
  }, [orderId, supabase, navigate, t])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <p className="text-muted-foreground mb-4">{t('order.notFound')}</p>
        <Button onClick={() => navigate('/menu')}>{t('common.back')}</Button>
      </div>
    )
  }

  const progress = ((currentStep + 1) / statusSteps.length) * 100

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Success Message */}
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div>
              <h2 className="text-lg font-semibold text-green-900 dark:text-green-100">
                {t('order.thankYou')}
              </h2>
              <p className="text-green-700 dark:text-green-300">
                {t('order.number', { number: orderId.slice(-6) })}
              </p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{t('order.trackOrder')}</h3>

          {/* Progress Bar */}
          <div className="w-full bg-muted rounded-full h-2 mb-6">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Status Steps */}
          <div className="flex justify-between">
            {statusSteps.map((step, index) => {
              const Icon = step.icon
              const isActive = index <= currentStep
              const isCurrent = index === currentStep

              return (
                <div
                  key={step.key}
                  className={cn(
                    'flex flex-col items-center',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  <div
                    className={cn(
                      'h-12 w-12 rounded-full flex items-center justify-center mb-2 transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted',
                      isCurrent && 'ring-4 ring-primary/20'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-medium text-center">
                    {t(`order.status.${step.key}`)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Estimated Time */}
          {order.status !== 'ready' && order.status !== 'completed' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">
                {t('order.estimatedTime', { time: '15-20' })}
              </span>
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="bg-card rounded-lg p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{t('payment.orderSummary')}</h3>

          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span>
                  {item.quantity}x {item.name}
                </span>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-semibold">
                <span>{t('payment.total')}</span>
                <span>${order.total_amount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
            <div className="flex justify-between">
              <span>{t('order.placedAt')}</span>
              <span>
                {new Date(order.created_at).toLocaleString([], {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Ready Message */}
        {order.status === 'ready' && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 text-center">
            <Package className="h-12 w-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">
              {t('order.readyNotification')}
            </h3>
            <p className="text-muted-foreground">
              {t('order.readyDescription') || 'Your order is ready for pickup!'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={() => navigate('/menu')}>
            <Home className="mr-2 h-4 w-4" />
            {t('order.backToMenu') || 'Back to Menu'}
          </Button>

          {(order.status === 'ready' || order.status === 'completed') && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                log.info('[OrderStatus] Feedback requested')
                // TODO: Open feedback modal
              }}
            >
              {t('order.rateExperience')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
