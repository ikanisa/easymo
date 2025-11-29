import { describe, it, expect } from 'vitest';
import {
  SUPPORTED_PAYMENT_METHODS,
  isValidPaymentMethod,
  getPaymentMethodForRegion,
  validatePaymentMethod,
  getPaymentErrorMessage,
  PAYMENT_ERROR_CODES,
  PAYMENT_METHOD_REGIONS,
  PAYMENT_METHOD_NAMES,
} from '../src/payment-methods';

describe('Payment Methods', () => {
  describe('SUPPORTED_PAYMENT_METHODS', () => {
    it('should only contain momo_ussd and revolut_link', () => {
      const methods = Object.values(SUPPORTED_PAYMENT_METHODS);
      expect(methods).toEqual(['momo_ussd', 'revolut_link']);
      expect(methods).toHaveLength(2);
    });

    it('should not contain unsupported methods', () => {
      const methods = Object.values(SUPPORTED_PAYMENT_METHODS);
      expect(methods).not.toContain('mpesa');
      expect(methods).not.toContain('stripe');
      expect(methods).not.toContain('paypal');
    });
  });

  describe('isValidPaymentMethod', () => {
    it('should return true for momo_ussd', () => {
      expect(isValidPaymentMethod('momo_ussd')).toBe(true);
    });

    it('should return true for revolut_link', () => {
      expect(isValidPaymentMethod('revolut_link')).toBe(true);
    });

    it('should return false for mpesa', () => {
      expect(isValidPaymentMethod('mpesa')).toBe(false);
    });

    it('should return false for stripe', () => {
      expect(isValidPaymentMethod('stripe')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidPaymentMethod('')).toBe(false);
    });

    it('should return false for random string', () => {
      expect(isValidPaymentMethod('invalid_method')).toBe(false);
    });
  });

  describe('validatePaymentMethod', () => {
    it('should not throw for valid methods', () => {
      expect(() => validatePaymentMethod('momo_ussd')).not.toThrow();
      expect(() => validatePaymentMethod('revolut_link')).not.toThrow();
    });

    it('should throw for mpesa', () => {
      expect(() => validatePaymentMethod('mpesa')).toThrow(
        'Invalid payment method: mpesa'
      );
    });

    it('should throw for stripe', () => {
      expect(() => validatePaymentMethod('stripe')).toThrow(
        'Invalid payment method: stripe'
      );
    });

    it('should include supported methods in error message', () => {
      expect(() => validatePaymentMethod('invalid')).toThrow(
        'Supported methods: momo_ussd, revolut_link'
      );
    });
  });

  describe('getPaymentMethodForRegion', () => {
    it('should return momo_ussd for Africa', () => {
      expect(getPaymentMethodForRegion('Africa')).toBe('momo_ussd');
      expect(getPaymentMethodForRegion('african')).toBe('momo_ussd');
      expect(getPaymentMethodForRegion('South Africa')).toBe('momo_ussd');
    });

    it('should return revolut_link for Malta', () => {
      expect(getPaymentMethodForRegion('Malta')).toBe('revolut_link');
      expect(getPaymentMethodForRegion('malta')).toBe('revolut_link');
    });

    it('should return revolut_link for Europe', () => {
      expect(getPaymentMethodForRegion('Europe')).toBe('revolut_link');
      expect(getPaymentMethodForRegion('European Union')).toBe('revolut_link');
    });

    it('should return revolut_link for UK', () => {
      expect(getPaymentMethodForRegion('UK')).toBe('revolut_link');
      expect(getPaymentMethodForRegion('United Kingdom')).toBe('revolut_link');
    });

    it('should return revolut_link for Canada', () => {
      expect(getPaymentMethodForRegion('Canada')).toBe('revolut_link');
      expect(getPaymentMethodForRegion('canadian')).toBe('revolut_link');
    });

    it('should return null for unsupported regions', () => {
      expect(getPaymentMethodForRegion('USA')).toBeNull();
      expect(getPaymentMethodForRegion('Asia')).toBeNull();
      expect(getPaymentMethodForRegion('Australia')).toBeNull();
    });

    it('should be case insensitive', () => {
      expect(getPaymentMethodForRegion('MALTA')).toBe('revolut_link');
      expect(getPaymentMethodForRegion('AFRICA')).toBe('momo_ussd');
    });
  });

  describe('PAYMENT_METHOD_REGIONS', () => {
    it('should map momo_ussd to Africa only', () => {
      expect(PAYMENT_METHOD_REGIONS.momo_ussd).toEqual(['Africa']);
    });

    it('should map revolut_link to correct regions', () => {
      expect(PAYMENT_METHOD_REGIONS.revolut_link).toEqual([
        'Malta',
        'Europe',
        'UK',
        'Canada',
      ]);
    });
  });

  describe('PAYMENT_METHOD_NAMES', () => {
    it('should have human-readable names', () => {
      expect(PAYMENT_METHOD_NAMES.momo_ussd).toBe('Mobile Money USSD');
      expect(PAYMENT_METHOD_NAMES.revolut_link).toBe('Revolut Payment Link');
    });
  });

  describe('PAYMENT_ERROR_CODES', () => {
    it('should include common error codes', () => {
      expect(PAYMENT_ERROR_CODES.INSUFFICIENT_FUNDS).toBe('INSUFFICIENT_FUNDS');
      expect(PAYMENT_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(PAYMENT_ERROR_CODES.CANCELLED).toBe('CANCELLED');
      expect(PAYMENT_ERROR_CODES.TIMEOUT).toBe('TIMEOUT');
    });

    it('should include USSD-specific codes', () => {
      expect(PAYMENT_ERROR_CODES.INVALID_PIN).toBe('INVALID_PIN');
    });

    it('should include Revolut-specific codes', () => {
      expect(PAYMENT_ERROR_CODES.CARD_DECLINED).toBe('CARD_DECLINED');
      expect(PAYMENT_ERROR_CODES.FRAUD_DETECTED).toBe('FRAUD_DETECTED');
    });
  });

  describe('getPaymentErrorMessage', () => {
    it('should return correct messages for known errors', () => {
      expect(getPaymentErrorMessage('INSUFFICIENT_FUNDS')).toBe(
        'Insufficient funds in account'
      );
      expect(getPaymentErrorMessage('NETWORK_ERROR')).toBe(
        'Network error, please try again'
      );
      expect(getPaymentErrorMessage('CANCELLED')).toBe('Payment was cancelled');
      expect(getPaymentErrorMessage('TIMEOUT')).toBe('Payment timed out');
      expect(getPaymentErrorMessage('INVALID_PIN')).toBe('Invalid PIN entered');
      expect(getPaymentErrorMessage('CARD_DECLINED')).toBe('Card was declined');
      expect(getPaymentErrorMessage('FRAUD_DETECTED')).toBe(
        'Payment flagged as fraudulent'
      );
    });

    it('should return generic message for unknown errors', () => {
      expect(getPaymentErrorMessage('UNKNOWN_ERROR')).toBe('Payment failed');
      expect(getPaymentErrorMessage('')).toBe('Payment failed');
    });
  });
});
