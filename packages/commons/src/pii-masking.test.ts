import { describe, expect,it } from 'vitest';

import {
  maskCardNumber,
  maskEmail,
  maskIdNumber,
  maskPhone,
  maskPII,
} from './pii-masking';

describe('PII Masking', () => {
  describe('maskPhone', () => {
    it('should mask international phone numbers', () => {
      expect(maskPhone('+254712345678')).toBe('+254*****78');
      expect(maskPhone('+250788123456')).toBe('+250*****56');
      expect(maskPhone('+1234567890')).toBe('+1******90');
    });

    it('should mask local phone numbers', () => {
      expect(maskPhone('0712345678')).toBe('0712***78');
      expect(maskPhone('0788123456')).toBe('0788***56');
    });

    it('should handle phone numbers with spaces', () => {
      expect(maskPhone('+254 712 345 678')).toBe('+254*****78');
      expect(maskPhone('0712 345 678')).toBe('0712***78');
    });

    it('should handle short phone numbers', () => {
      expect(maskPhone('123')).toBe('***');
      expect(maskPhone('12')).toBe('**');
    });
  });

  describe('maskEmail', () => {
    it('should mask email addresses', () => {
      expect(maskEmail('john.doe@example.com')).toBe('jo****@example.com');
      expect(maskEmail('alice@test.co')).toBe('al****@test.co');
    });

    it('should handle short email addresses', () => {
      expect(maskEmail('a@test.co')).toBe('a*@test.co');
      expect(maskEmail('ab@test.co')).toBe('a*@test.co');
    });

    it('should handle invalid emails', () => {
      expect(maskEmail('notanemail')).toBe('***');
      expect(maskEmail('')).toBe('***');
    });
  });

  describe('maskIdNumber', () => {
    it('should mask ID numbers', () => {
      expect(maskIdNumber('1234567890123')).toBe('12*********23');
      expect(maskIdNumber('A12345678')).toBe('A1*****78');
    });

    it('should handle short IDs', () => {
      expect(maskIdNumber('1234')).toBe('****');
      expect(maskIdNumber('123')).toBe('***');
    });

    it('should handle IDs with dashes', () => {
      expect(maskIdNumber('123-456-7890')).toBe('12******90');
    });
  });

  describe('maskCardNumber', () => {
    it('should mask credit card numbers', () => {
      expect(maskCardNumber('4532123456781234')).toBe('************1234');
      expect(maskCardNumber('4532-1234-5678-1234')).toBe('************1234');
    });

    it('should handle short card numbers', () => {
      expect(maskCardNumber('1234')).toBe('****');
      expect(maskCardNumber('123')).toBe('***');
    });
  });

  describe('maskPII', () => {
    it('should auto-mask phone fields', () => {
      const data = {
        phone: '+254712345678',
        mobile: '0788123456',
        username: 'john',
      };

      const masked = maskPII(data);
      expect(masked.phone).toBe('+254*****78');
      expect(masked.mobile).toBe('0788***56');
      expect(masked.username).toBe('john');
    });

    it('should auto-mask email fields', () => {
      const data = {
        email: 'john@example.com',
        name: 'John Doe',
      };

      const masked = maskPII(data);
      expect(masked.email).toBe('jo****@example.com');
      expect(masked.name).toBe('John Doe');
    });

    it('should auto-mask ID fields', () => {
      const data = {
        nationalId: '1234567890123',
        passport: 'A12345678',
        username: 'john',
      };

      const masked = maskPII(data);
      expect(masked.nationalId).toBe('12*********23');
      expect(masked.passport).toBe('A1*****78');
      expect(masked.username).toBe('john');
    });

    it('should handle nested objects', () => {
      const data = {
        user: {
          phone: '+254712345678',
          email: 'john@example.com',
        },
        metadata: {
          source: 'whatsapp',
        },
      };

      const masked = maskPII(data);
      expect(masked.user.phone).toBe('+254*****78');
      expect(masked.user.email).toBe('jo****@example.com');
      expect(masked.metadata.source).toBe('whatsapp');
    });

    it('should handle null and undefined', () => {
      expect(maskPII(null as any)).toBe(null);
      expect(maskPII(undefined as any)).toBe(undefined);
    });
  });
});
