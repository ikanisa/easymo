'use client';

import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type PaymentStatus = 'pending' | 'processing' | 'successful' | 'failed' | 'refunded';

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_amount: number;
  currency: string;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
  waiter_order_items: Array<{
    id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    status: string;
  }>;
  waiter_payments: Array<{
    id: string;
    payment_method: string;
    status: string;
    amount: number;
  }>;
}

export default function OrderStatusPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      router.push('/');
      return;
    }

    loadOrder();

    // Subscribe to order updates
    const channel = supabase
      .channel('order-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'waiter_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // Reload full order to get all relations
          loadOrder();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Connected to order updates');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.error('Realtime connection error:', status);
          setError('Realtime connection lost. Order updates may be delayed.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, router, supabase]);

  const loadOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('waiter_orders')
        .select(`
          *,
          waiter_order_items(*),
          waiter_payments(*)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;

      setOrder(data as Order);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error loading order:', error);
      setError(error.message || 'Failed to load order');
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'confirmed':
        return '✅';
      case 'preparing':
        return '👨‍🍳';
      case 'ready':
        return '🔔';
      case 'completed':
        return '✨';
      case 'cancelled':
        return '❌';
      default:
        return '📋';
    }
  };

  const getPaymentStatusIcon = (status: PaymentStatus) => {
    switch (status) {
      case 'successful':
        return '✅';
      case 'processing':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <span className="text-6xl mb-4 block">😕</span>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t('order.notFound')}
          </h1>
          <p className="text-gray-600 mb-6">{error || t('order.notFoundDesc')}</p>
          <Link
            href="/menu"
            className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {t('order.backToMenu')}
          </Link>
        </div>
      </div>
    );
  }

  const isPaymentPending = order.payment_status === 'pending' || order.payment_status === 'processing';
  const isPaymentSuccess = order.payment_status === 'successful';
  const isOrderComplete = order.status === 'completed';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/menu" className="text-2xl text-gray-700">
              ←
            </Link>
            <h1 className="font-semibold text-lg">{t('order.title')}</h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Order Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="text-6xl mb-3">{getStatusIcon(order.status)}</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t(`order.status.${order.status}`)}
          </h2>
          <p className="text-gray-600">
            {t('order.orderNumber')}: {order.order_number}
          </p>
        </div>

        {/* Payment Status */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('order.paymentStatus')}</h3>
            <span className="text-2xl">{getPaymentStatusIcon(order.payment_status)}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('order.statusLabel')}</span>
              <span className={`font-medium ${
                isPaymentSuccess ? 'text-green-600' :
                isPaymentPending ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {t(`order.paymentStatus.${order.payment_status}`)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('order.amount')}</span>
              <span className="font-medium">
                {order.total_amount.toFixed(2)} {order.currency}
              </span>
            </div>
            {order.waiter_payments && order.waiter_payments[0] && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{t('order.method')}</span>
                <span className="font-medium capitalize">
                  {order.waiter_payments[0].payment_method}
                </span>
              </div>
            )}
          </div>

          {isPaymentPending && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                {t('order.paymentPending')}
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">{t('order.items')}</h3>
          <div className="space-y-3">
            {order.waiter_order_items.map((item) => (
              <div key={item.id} className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {item.quantity}x {item.name}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {t(`order.itemStatus.${item.status}`)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {item.total_price.toFixed(2)} {order.currency}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isOrderComplete && (
            <Link
              href={`/feedback/${order.id}`}
              className="block w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-lg text-center transition-colors"
            >
              {t('order.leaveFeedback')}
            </Link>
          )}

          <Link
            href="/menu"
            className="block w-full bg-white hover:bg-gray-50 text-gray-700 font-semibold py-4 rounded-lg text-center border border-gray-300 transition-colors"
          >
            {t('order.orderAgain')}
          </Link>
        </div>
      </div>
    </div>
  );
}
