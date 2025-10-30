/**
 * Tests for agent tools
 */

import { describe, it, expect } from 'vitest';
import { 
  checkAvailabilityTool,
  createBookingTool,
  checkBalanceTool,
  menuLookupTool,
  webSearchTool,
} from './index';

const mockContext = {
  userId: 'test-user-123',
  source: 'web' as const,
};

describe('Tools', () => {
  describe('checkAvailabilityTool', () => {
    it('should have correct schema', () => {
      expect(checkAvailabilityTool.name).toBe('CheckAvailability');
      expect(checkAvailabilityTool.parameters).toBeDefined();
    });

    it('should execute successfully', async () => {
      const result = await checkAvailabilityTool.execute(
        { date: '2025-11-01' },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.slots).toBeInstanceOf(Array);
    });

    it('should validate date format', () => {
      expect(() => {
        checkAvailabilityTool.parameters.parse({
          date: 'invalid-date',
        });
      }).toThrow();
    });
  });

  describe('createBookingTool', () => {
    it('should have correct schema', () => {
      expect(createBookingTool.name).toBe('CreateBooking');
      expect(createBookingTool.parameters).toBeDefined();
    });

    it('should execute successfully', async () => {
      const result = await createBookingTool.execute(
        {
          slotId: '123e4567-e89b-12d3-a456-426614174000',
          guestCount: 4,
        },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.booking).toBeDefined();
      expect(result.booking.userId).toBe(mockContext.userId);
    });

    it('should validate UUID format', () => {
      expect(() => {
        createBookingTool.parameters.parse({
          slotId: 'not-a-uuid',
          guestCount: 4,
        });
      }).toThrow();
    });
  });

  describe('checkBalanceTool', () => {
    it('should have correct schema', () => {
      expect(checkBalanceTool.name).toBe('CheckBalance');
      expect(checkBalanceTool.parameters).toBeDefined();
    });

    it('should execute successfully without token type', async () => {
      const result = await checkBalanceTool.execute({}, mockContext);

      expect(result).toBeDefined();
      expect(result.balances).toBeInstanceOf(Array);
      expect(result.balances.length).toBeGreaterThan(0);
    });

    it('should filter by token type', async () => {
      const result = await checkBalanceTool.execute(
        { tokenType: 'voucher' },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.balances).toBeInstanceOf(Array);
      expect(result.balances.every(b => b.type === 'voucher')).toBe(true);
    });
  });

  describe('menuLookupTool', () => {
    it('should have correct schema', () => {
      expect(menuLookupTool.name).toBe('MenuLookup');
      expect(menuLookupTool.parameters).toBeDefined();
    });

    it('should execute successfully', async () => {
      const result = await menuLookupTool.execute(
        { query: 'beer', category: 'drinks', limit: 10 },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.items).toBeInstanceOf(Array);
    });

    it('should filter by category', async () => {
      const result = await menuLookupTool.execute(
        { query: '', category: 'food', limit: 10 },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.items.every(item => item.category === 'food')).toBe(true);
    });
  });

  describe('webSearchTool', () => {
    it('should have correct schema', () => {
      expect(webSearchTool.name).toBe('WebSearch');
      expect(webSearchTool.parameters).toBeDefined();
    });

    it('should execute successfully', async () => {
      const result = await webSearchTool.execute(
        { query: 'test query', maxResults: 5 },
        mockContext
      );

      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
    });

    it('should enforce max results limit', () => {
      expect(() => {
        webSearchTool.parameters.parse({
          query: 'test',
          maxResults: 100, // Over limit
        });
      }).toThrow();
    });
  });
});
