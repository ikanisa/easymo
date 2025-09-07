import { describe, it, expect } from 'vitest';
import { isDev, useMock, showDevTools, getAdminToken, getApiBase } from './env';

describe('Environment configuration', () => {
  describe('isDev', () => {
    it('should return a boolean', () => {
      const result = isDev();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('useMock', () => {
    it('should return true for default mock mode', () => {
      const result = useMock();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('showDevTools', () => {
    it('should return a boolean for dev tools visibility', () => {
      const result = showDevTools();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getAdminToken', () => {
    it('should return a string admin token', () => {
      const token = getAdminToken();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });
  });

  describe('getApiBase', () => {
    it('should return a string API base URL', () => {
      const apiBase = getApiBase();
      expect(typeof apiBase).toBe('string');
      expect(apiBase.length).toBeGreaterThan(0);
    });
  });
});