/**
 * Payment utilities for Waiter AI
 * Supports MOMO USSD (Rwanda) and Revolut (Europe/Malta)
 */

/**
 * Generate MOMO USSD code display string
 * Format for MTN Rwanda: *182*8*1*AMOUNT#
 */
export function generateMoMoUSSDCode(amount: number): string {
  return `*182*8*1*${Math.round(amount)}#`;
}

/**
 * Generate MOMO USSD payment URL for auto-dial
 */
export function generateMoMoPaymentUrl(amount: number): string {
  const ussdCode = generateMoMoUSSDCode(amount);
  return `tel:${encodeURIComponent(ussdCode)}`;
}

/**
 * Generate Revolut payment URL
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
  currency: string,
  orderNumber: string
): string {
  let baseUrl = revolutMeLink.trim();
  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://revolut.me/${baseUrl}`;
  }
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const description = encodeURIComponent(`Order ${orderNumber}`);
  return `${baseUrl}/${amount}${currency}?description=${description}`;
}

/**
 * Format payment instructions for WhatsApp message
 */
export function formatPaymentInstructions(
  method: "momo" | "revolut" | "cash",
  amount: number,
  currency: string,
  orderNumber: string,
  paymentSettings?: any
): { message: string; url?: string } {
  switch (method) {
    case "momo": {
      const ussdCode = generateMoMoUSSDCode(amount);
      const ussdUrl = generateMoMoPaymentUrl(amount);
      return {
        message: 
          `📱 *Pay with Mobile Money*\n\n` +
          `To pay ${amount.toLocaleString()} ${currency}:\n\n` +
          `1️⃣ Dial: \`${ussdCode}\`\n` +
          `2️⃣ Enter your PIN\n` +
          `3️⃣ Confirm the payment\n\n` +
          `Or tap this link to dial automatically:\n${ussdUrl}`,
        url: ussdUrl,
      };
    }

    case "revolut": {
      const revolutLink = paymentSettings?.revolut_link;
      if (!revolutLink) {
        return {
          message: `💳 Please pay ${amount.toLocaleString()} ${currency} via Revolut or card.\n\nAsk staff for payment details.`,
        };
      }
      const paymentUrl = generateRevolutPaymentUrl(revolutLink, amount, currency, orderNumber);
      return {
        message: 
          `�� *Pay with Revolut*\n\n` +
          `Amount: ${amount.toLocaleString()} ${currency}\n\n` +
          `Tap the link below to pay securely:\n${paymentUrl}\n\n` +
          `After payment, tap "I've Paid" to confirm.`,
        url: paymentUrl,
      };
    }

    case "cash":
    default:
      return {
        message: 
          `💵 *Cash Payment*\n\n` +
          `Amount due: ${amount.toLocaleString()} ${currency}\n\n` +
          `Please pay the waiter when your order is served.\nOrder #${orderNumber}`,
      };
  }
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
