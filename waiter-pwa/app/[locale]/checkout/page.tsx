'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import Link from 'next/link';

type PaymentMethod = 'momo' | 'revolut' | null;

export default function CheckoutPage() {
  const t = useTranslations();
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [cartTotal, setCartTotal] = useState(0);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load cart from context or local storage
    const loadCart = async () => {
      // In a real app, this would come from CartContext
      // For now, retrieve from draft_orders
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          router.push('/');
          return;
        }

        const { data: draftOrder } = await supabase
          .from('draft_orders')
          .select('*, draft_order_items(*, menu_items(*))')
          .eq('user_id', user.id)
          .eq('status', 'draft')
          .single();

        if (draftOrder) {
          setCartItems(draftOrder.draft_order_items || []);
          setCartTotal(draftOrder.total || 0);
        } else {
          // No cart, redirect to menu
          router.push('/menu');
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      }
    };

    loadCart();
  }, [router, supabase]);

  const handleCreateOrder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/');
        return;
      }

      // Get draft order
      const { data: draftOrder } = await supabase
        .from('draft_orders')
        .select('*, draft_order_items(*, menu_items(*))')
        .eq('user_id', user.id)
        .eq('status', 'draft')
        .single();

      if (!draftOrder) {
        setError('No cart found');
        setIsLoading(false);
        return;
      }

      // Create order from draft
      const orderNumber = `ORD-${Date.now()}`;
      const { data: order, error: orderError } = await supabase
        .from('waiter_orders')
        .insert({
          order_number: orderNumber,
          user_id: user.id,
          restaurant_id: localStorage.getItem('venue_id') || 'default-venue',
          table_number: localStorage.getItem('table_number') || '',
          items: draftOrder.draft_order_items,
          subtotal: draftOrder.subtotal,
          tax: draftOrder.tax || 0,
          total_amount: draftOrder.total,
          currency: 'XAF', // Default, should come from venue settings
          status: 'pending',
          payment_status: 'pending',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Mark draft as submitted
      await supabase
        .from('draft_orders')
        .update({ status: 'submitted' })
        .eq('id', draftOrder.id);

      setOrderId(order.id);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error creating order:', error);
      setError(error.message || 'Failed to create order');
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!orderId || !paymentMethod) return;

    setIsLoading(true);
    setError(null);

    try {
      if (paymentMethod === 'momo') {
        if (!phoneNumber) {
          setError('Please enter phone number');
          setIsLoading(false);
          return;
        }

        // Call momo-charge function
        const { data, error } = await supabase.functions.invoke('momo-charge', {
          body: {
            orderId,
            amount: cartTotal,
            currency: 'XAF',
            phoneNumber,
            provider: 'mtn',
          },
        });

        if (error) throw error;

        if (data.success) {
          // Redirect to order status page
          router.push(`/order/${orderId}`);
        } else {
          setError(data.error || 'Payment failed');
          setIsLoading(false);
        }
      } else if (paymentMethod === 'revolut') {
        // Call revolut-charge function
        const { data, error } = await supabase.functions.invoke('revolut-charge', {
          body: {
            orderId,
            amount: cartTotal,
            currency: 'EUR',
            returnUrl: `${window.location.origin}/order/${orderId}`,
          },
        });

        if (error) throw error;

        if (data.success && data.checkoutUrl) {
          // Redirect to Revolut checkout
          window.location.href = data.checkoutUrl;
        } else {
          setError(data.error || 'Payment failed');
          setIsLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Error processing payment:', error);
      setError(error.message || 'Payment failed');
      setIsLoading(false);
    }
  };

  if (!orderId) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/menu" className="text-2xl text-gray-700">
                ←
              </Link>
              <h1 className="font-semibold text-lg">{t('checkout.title')}</h1>
            </div>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{t('checkout.orderSummary')}</h2>
            
            {cartItems.length > 0 ? (
              <div className="space-y-3">
                {cartItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-700">
                      {item.quantity}x {item.menu_items?.name || 'Item'}
                    </span>
                    <span className="font-medium">
                      {(item.total_price || 0).toFixed(2)} XAF
                    </span>
                  </div>
                ))}
                
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between font-semibold text-lg">
                    <span>{t('checkout.total')}</span>
                    <span>{cartTotal.toFixed(2)} XAF</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">{t('cart.empty')}</p>
            )}
          </div>

          {/* Create Order Button */}
          <button
            onClick={handleCreateOrder}
            disabled={isLoading || cartItems.length === 0}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('common.loading') : t('checkout.createOrder')}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Payment selection UI
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/menu" className="text-2xl text-gray-700">
              ←
            </Link>
            <h1 className="font-semibold text-lg">{t('checkout.payment')}</h1>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6">
        <div className="space-y-4">
          {/* Payment Method Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">{t('checkout.selectPaymentMethod')}</h2>
            
            <div className="space-y-3">
              {/* Mobile Money */}
              <button
                onClick={() => setPaymentMethod('momo')}
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  paymentMethod === 'momo'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="font-semibold">{t('checkout.momo')}</div>
                    <div className="text-sm text-gray-500">{t('checkout.momoDesc')}</div>
                  </div>
                </div>
              </button>

              {/* Revolut/Card */}
              <button
                onClick={() => setPaymentMethod('revolut')}
                className={`w-full p-4 border-2 rounded-lg text-left transition-colors ${
                  paymentMethod === 'revolut'
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">💳</span>
                  <div>
                    <div className="font-semibold">{t('checkout.card')}</div>
                    <div className="text-sm text-gray-500">{t('checkout.cardDesc')}</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* MoMo Phone Number Input */}
          {paymentMethod === 'momo' && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                {t('checkout.phoneNumber')}
              </label>
              <input
                type="tel"
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+237 6XX XXX XXX"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              <p className="mt-2 text-sm text-gray-500">
                {t('checkout.phoneHint')}
              </p>
            </div>
          )}

          {/* Pay Button */}
          <button
            onClick={handlePayment}
            disabled={isLoading || !paymentMethod || (paymentMethod === 'momo' && !phoneNumber)}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? t('common.loading') : t('checkout.payNow')} - {cartTotal.toFixed(2)} XAF
          </button>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
