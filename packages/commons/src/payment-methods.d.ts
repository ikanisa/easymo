/**
 * EasyMO Supported Payment Methods
 *
 * CRITICAL: EasyMO ONLY supports USSD in Africa and Revolut in Europe/UK/Canada/Malta.
 * We do NOT support: M-Pesa, Stripe, PayPal, or direct card payments.
 */
export declare const SUPPORTED_PAYMENT_METHODS: {
    readonly MOMO_USSD: "momo_ussd";
    readonly REVOLUT_LINK: "revolut_link";
};
export type PaymentMethod = typeof SUPPORTED_PAYMENT_METHODS[keyof typeof SUPPORTED_PAYMENT_METHODS];
export declare const PAYMENT_METHOD_REGIONS: Record<PaymentMethod, string[]>;
export declare const PAYMENT_METHOD_NAMES: Record<PaymentMethod, string>;
/**
 * Validate if a payment method is supported
 */
export declare function isValidPaymentMethod(method: string): method is PaymentMethod;
/**
 * Get payment method for a region
 */
export declare function getPaymentMethodForRegion(region: string): PaymentMethod | null;
/**
 * Common payment error codes
 */
export declare const PAYMENT_ERROR_CODES: {
    readonly INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS";
    readonly NETWORK_ERROR: "NETWORK_ERROR";
    readonly CANCELLED: "CANCELLED";
    readonly TIMEOUT: "TIMEOUT";
    readonly INVALID_PIN: "INVALID_PIN";
    readonly CARD_DECLINED: "CARD_DECLINED";
    readonly FRAUD_DETECTED: "FRAUD_DETECTED";
};
export type PaymentErrorCode = typeof PAYMENT_ERROR_CODES[keyof typeof PAYMENT_ERROR_CODES];
/**
 * Validate payment method and throw if invalid
 */
export declare function validatePaymentMethod(method: string): asserts method is PaymentMethod;
/**
 * Get human-readable error message
 */
export declare function getPaymentErrorMessage(errorCode: string): string;
//# sourceMappingURL=payment-methods.d.ts.map