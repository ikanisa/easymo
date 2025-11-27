/**
 * MoMo USSD Payment Integration (Rwanda)
 * Uses USSD dial codes for payment initiation
 */

import { logStructuredEvent } from '../observability';

export interface MoMoPaymentRequest {
  amount: number;
  currency: 'RWF';
  orderId: string;
  phoneNumber: string;
  description: string;
}

export interface MoMoPaymentResponse {
  success: boolean;
  transactionId?: string;
  ussdCode?: string;
  message: string;
  pollUrl?: string;
}

/**
 * Generate MoMo USSD payment code
 * Format: *182*8*1*AMOUNT*PIN#
 */
export function generateMoMoUSSD(amount: number): string {
  // MTN MoMo Rwanda USSD code
  // User will need to dial this and enter their PIN
  return `*182*8*1*${amount}#`;
}

/**
 * Initiate MoMo payment via USSD
 */
export async function initiateMoMoPayment(
  request: MoMoPaymentRequest
): Promise<MoMoPaymentResponse> {
  try {
    await logStructuredEvent('MOMO_PAYMENT_INITIATED', {
      orderId: request.orderId,
      amount: request.amount,
      currency: request.currency,
    });

    // Generate USSD code
    const ussdCode = generateMoMoUSSD(request.amount);

    // Call backend to create payment record
    const response = await fetch('/api/payment/momo/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error('Failed to initiate MoMo payment');
    }

    const data = await response.json();

    return {
      success: true,
      transactionId: data.transactionId,
      ussdCode,
      message: `Dial ${ussdCode} to complete payment`,
      pollUrl: `/api/payment/momo/status/${data.transactionId}`,
    };
  } catch (error) {
    await logStructuredEvent('MOMO_PAYMENT_ERROR', {
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
 * Check MoMo payment status
 */
export async function checkMoMoPaymentStatus(
  transactionId: string
): Promise<{
  status: 'pending' | 'completed' | 'failed' | 'expired';
  message: string;
}> {
  try {
    const response = await fetch(`/api/payment/momo/status/${transactionId}`);
    
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
 * Format phone number for MoMo (Rwanda)
 * Accepts: 078XXXXXXX, 078 XXX XXXX, +250 78 XXX XXXX
 * Returns: 250788888888
 */
export function formatMoMoPhone(phone: string): string {
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle different formats
  if (digits.startsWith('250')) {
    return digits; // Already formatted
  } else if (digits.startsWith('0')) {
    return '250' + digits.slice(1); // 078... -> 25078...
  } else if (digits.length === 9) {
    return '250' + digits; // 78... -> 25078...
  }
  
  return digits;
}

/**
 * Validate Rwanda phone number
 */
export function isValidRwandaPhone(phone: string): boolean {
  const formatted = formatMoMoPhone(phone);
  // Rwanda mobile: 250 7X XXX XXXX (MTN, Airtel)
  return /^2507[0-9]{8}$/.test(formatted);
}

/**
 * Open USSD dialer (mobile only)
 */
export function openUSSDDialer(ussdCode: string): void {
  if (typeof window === 'undefined') return;
  
  // Try to open tel: link with USSD code
  // Some browsers/devices support this
  const telLink = `tel:${encodeURIComponent(ussdCode)}`;
  
  // Try to trigger dialer
  const link = document.createElement('a');
  link.href = telLink;
  link.click();
}
