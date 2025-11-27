/**
 * Revolut Pay Link Integration (Malta/Europe)
 * Uses Revolut Payment Links for checkout
 */

import { logStructuredEvent } from '../observability';

export interface RevolutPaymentRequest {
  amount: number;
  currency: 'EUR' | 'USD' | 'GBP';
  orderId: string;
  customerEmail?: string;
  description: string;
  returnUrl: string;
}

export interface RevolutPaymentResponse {
  success: boolean;
  paymentUrl?: string;
  paymentId?: string;
  message: string;
}

/**
 * Create Revolut payment link
 */
export async function createRevolutPayment(
  request: RevolutPaymentRequest
): Promise<RevolutPaymentResponse> {
  try {
    await logStructuredEvent('REVOLUT_PAYMENT_INITIATED', {
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
    });

    // Call backend to create Revolut payment link
    const response = await fetch('/api/payment/revolut/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to create Revolut payment');
    }

    const data = await response.json();

    return {
      success: true,
      paymentUrl: data.paymentUrl,
      paymentId: data.paymentId,
      message: 'Payment link created',
    };
  } catch (error) {
    await logStructuredEvent('REVOLUT_PAYMENT_ERROR', {
      orderId: request.orderId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Payment failed',
    };
  }
}

/**
 * Check Revolut payment status
 */
export async function checkRevolutPaymentStatus(
  paymentId: string
): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'expired';
  message: string;
}> {
  try {
    const response = await fetch(`/api/payment/revolut/status/${paymentId}`);
    
    if (!response.ok) {
      throw new Error('Failed to check payment status');
    }

    return await response.json();
  } catch (error) {
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Status check failed',
    };
  }
}

/**
 * Open Revolut payment in new window/tab
 */
export function openRevolutPayment(paymentUrl: string): void {
  if (typeof window === 'undefined') return;
  
  // Try to open in same tab for mobile, new tab for desktop
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Mobile: redirect in same tab for better UX
    window.location.href = paymentUrl;
  } else {
    // Desktop: open in new tab
    window.open(paymentUrl, '_blank', 'noopener,noreferrer');
  }
}
