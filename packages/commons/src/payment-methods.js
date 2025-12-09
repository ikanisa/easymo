/**
 * EasyMO Supported Payment Methods
 *
 * CRITICAL: EasyMO ONLY supports USSD in Africa and Revolut in Europe/UK/Canada/Malta.
 * We do NOT support: M-Pesa, Stripe, PayPal, or direct card payments.
 */
export const SUPPORTED_PAYMENT_METHODS = {
    MOMO_USSD: 'momo_ussd',
    REVOLUT_LINK: 'revolut_link',
};
export const PAYMENT_METHOD_REGIONS = {
    [SUPPORTED_PAYMENT_METHODS.MOMO_USSD]: ['Africa'],
    [SUPPORTED_PAYMENT_METHODS.REVOLUT_LINK]: ['Malta', 'Europe', 'UK', 'Canada'],
};
export const PAYMENT_METHOD_NAMES = {
    [SUPPORTED_PAYMENT_METHODS.MOMO_USSD]: 'Mobile Money USSD',
    [SUPPORTED_PAYMENT_METHODS.REVOLUT_LINK]: 'Revolut Payment Link',
};
/**
 * Validate if a payment method is supported
 */
export function isValidPaymentMethod(method) {
    return Object.values(SUPPORTED_PAYMENT_METHODS).includes(method);
}
/**
 * Get payment method for a region
 */
export function getPaymentMethodForRegion(region) {
    const normalizedRegion = region.toLowerCase();
    if (normalizedRegion.includes('africa') || normalizedRegion.includes('african')) {
        return SUPPORTED_PAYMENT_METHODS.MOMO_USSD;
    }
    if (normalizedRegion.includes('malta') ||
        normalizedRegion.includes('europe') ||
        normalizedRegion.includes('uk') ||
        normalizedRegion.includes('united kingdom') ||
        normalizedRegion.includes('canada') ||
        normalizedRegion.includes('canadian')) {
        return SUPPORTED_PAYMENT_METHODS.REVOLUT_LINK;
    }
    return null;
}
/**
 * Common payment error codes
 */
export const PAYMENT_ERROR_CODES = {
    // Common
    INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
    NETWORK_ERROR: 'NETWORK_ERROR',
    CANCELLED: 'CANCELLED',
    TIMEOUT: 'TIMEOUT',
    // USSD specific
    INVALID_PIN: 'INVALID_PIN',
    // Revolut specific
    CARD_DECLINED: 'CARD_DECLINED',
    FRAUD_DETECTED: 'FRAUD_DETECTED',
};
/**
 * Validate payment method and throw if invalid
 */
export function validatePaymentMethod(method) {
    if (!isValidPaymentMethod(method)) {
        throw new Error(`Invalid payment method: ${method}. ` +
            `Supported methods: ${Object.values(SUPPORTED_PAYMENT_METHODS).join(', ')}`);
    }
}
/**
 * Get human-readable error message
 */
export function getPaymentErrorMessage(errorCode) {
    const messages = {
        [PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS]: 'Insufficient funds in account',
        [PAYMENT_ERROR_CODES.NETWORK_ERROR]: 'Network error, please try again',
        [PAYMENT_ERROR_CODES.CANCELLED]: 'Payment was cancelled',
        [PAYMENT_ERROR_CODES.TIMEOUT]: 'Payment timed out',
        [PAYMENT_ERROR_CODES.INVALID_PIN]: 'Invalid PIN entered',
        [PAYMENT_ERROR_CODES.CARD_DECLINED]: 'Card was declined',
        [PAYMENT_ERROR_CODES.FRAUD_DETECTED]: 'Payment flagged as fraudulent',
    };
    return messages[errorCode] || 'Payment failed';
}
