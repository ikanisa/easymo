import { describe, it, expect } from 'vitest';
import { formatUserRefCode } from './utils';

describe('User Reference Code utilities', () => {
  describe('formatUserRefCode', () => {
    it('should format string ref codes with leading zeros', () => {
      expect(formatUserRefCode('123')).toBe('000123');
      expect(formatUserRefCode('1234')).toBe('001234');
      expect(formatUserRefCode('123456')).toBe('123456');
    });

    it('should format numeric ref codes with leading zeros', () => {
      expect(formatUserRefCode(123)).toBe('000123');
      expect(formatUserRefCode(1234)).toBe('001234');
      expect(formatUserRefCode(123456)).toBe('123456');
    });

    it('should handle edge cases', () => {
      expect(formatUserRefCode('0')).toBe('000000');
      expect(formatUserRefCode(0)).toBe('000000');
      expect(formatUserRefCode('1000000')).toBe('1000000'); // Longer than 6 digits
    });

    it('should handle empty or invalid inputs gracefully', () => {
      expect(formatUserRefCode('')).toBe('000000');
    });
  });
});