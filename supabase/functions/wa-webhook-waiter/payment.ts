/**
 * Payment utilities for Waiter AI
 * Supports:
 * - Rwanda: MTN MoMo USSD (*182*8*1*AMOUNT#)
 * - Malta/Europe: Revolut payment links
 */

// MTN MoMo USSD constants for Rwanda
const MOMO_USSD_PREFIX = "*182*8*1*";
const MOMO_USSD_SUFFIX = "#";
const MOMO_USSD_PATTERN = /^\*182\*8\*1\*\d+#$/;

/**
 * Generate MTN MoMo USSD payment code for Rwanda
 * Format: *182*8*1*AMOUNT#
 */
export function generateMoMoUSSDCode(amount: number): string {
  const roundedAmount = Math.round(amount);
  return `${MOMO_USSD_PREFIX}${roundedAmount}${MOMO_USSD_SUFFIX}`;
}

/**
 * Generate MTN MoMo USSD payment URL (tel: link for WhatsApp)
 * This opens the phone dialer with the USSD code pre-filled
 */
export function generateMoMoPaymentUrl(amount: number): string {
  const ussdCode = generateMoMoUSSDCode(amount);
  // URL encode the # symbol
  const encodedCode = ussdCode.replace(/#/g, "%23");
  return `tel:${encodedCode}`;
}

/**
 * Generate Revolut payment link
 * Note: Requires Revolut Business account and payment API integration
 */
export function generateRevolutPaymentUrl(
  revolutMeLink: string,
  amount: number,
  currency: string = "EUR",
  orderNumber: string,
): string {
  // Revolut.me link format: https://revolut.me/username
  // With amount: https://revolut.me/username/AMOUNT.CURRENCY
  const formattedAmount = amount.toFixed(2);
  return `${revolutMeLink}/${formattedAmount}.${currency}?description=Order ${orderNumber}`;
}

/**
 * Format payment instructions for customer
 * Returns message text and optional payment URL/USSD code
 */
export function formatPaymentInstructions(
  method: "momo" | "revolut",
  amount: number,
  currency: string,
  orderNumber: string,
  paymentSettings: {
    revolutMeLink?: string;
  },
): {
  message: string;
  url?: string;
  ussdCode?: string;
} {
  if (method === "momo") {
    const ussdCode = generateMoMoUSSDCode(amount);
    const url = generateMoMoPaymentUrl(amount);
    
    return {
      message:
        `💳 *Payment Instructions*\n\n` +
        `Amount: *${amount.toLocaleString()} ${currency}*\n` +
        `Order: #${orderNumber}\n\n` +
        `*MTN MoMo USSD Payment:*\n` +
        `Dial: \`${ussdCode}\`\n\n` +
        `Or tap the link below to open your dialer:\n` +
        `${url}\n\n` +
        `After payment, reply "PAID" to confirm.`,
      url,
      ussdCode,
    };
  } else if (method === "revolut") {
    if (!paymentSettings.revolutMeLink) {
      return {
        message: "⚠️ Revolut payment not configured for this venue.",
      };
    }

    const url = generateRevolutPaymentUrl(
      paymentSettings.revolutMeLink,
      amount,
      currency,
      orderNumber,
    );

    return {
      message:
        `💳 *Payment Instructions*\n\n` +
        `Amount: *${amount.toFixed(2)} ${currency}*\n` +
        `Order: #${orderNumber}\n\n` +
        `*Pay with Revolut:*\n` +
        `Tap the link below to complete payment:\n` +
        `${url}\n\n` +
        `After payment, reply "PAID" to confirm.`,
      url,
    };
  }

  return {
    message: "⚠️ Invalid payment method.",
  };
}

/**
 * Validate MOMO USSD code format
 */
export function isValidMoMoUSSDCode(code: string): boolean {
  return MOMO_USSD_PATTERN.test(code);
}

/**
 * Extract amount from MOMO USSD code
 */
export function extractAmountFromUSSD(code: string): number | null {
  const match = code.match(MOMO_USSD_PATTERN);
  if (!match) return null;
  // Extract the amount between prefix and suffix
  const amountStr = code.replace(MOMO_USSD_PREFIX, "").replace(MOMO_USSD_SUFFIX, "");
  return parseInt(amountStr, 10);
}
