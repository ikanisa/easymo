/**
 * Tests for generalBrokerTools
 * 
 * Tests the general broker tools for user memory, service requests, and vendor discovery
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findVendorsNearbyTool,
  getUserFactsTool,
  getUserLocationsTool,
  recordServiceRequestTool,
  searchFAQTool,
  searchServiceCatalogTool,
  upsertUserLocationTool,
} from './generalBrokerTools';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('General Broker Tools', () => {
  const mockContext = { userId: 'test-user-123', source: 'whatsapp' as const };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserLocationsTool', () => {
    it('should have correct schema', () => {
      expect(getUserLocationsTool.name).toBe('get_user_locations');
      expect(getUserLocationsTool.description).toContain('saved locations');
    });

    it('should execute and call API', async () => {
      const result = await getUserLocationsTool.execute({}, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('upsertUserLocationTool', () => {
    it('should have correct schema', () => {
      expect(upsertUserLocationTool.name).toBe('upsert_user_location');
      expect(upsertUserLocationTool.description).toContain('Save or update');
    });

    it('should execute with location data', async () => {
      const params = {
        label: 'home' as const,
        latitude: -1.9441,
        longitude: 30.0619,
        address: 'Kigali, Rwanda',
      };

      const result = await upsertUserLocationTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getUserFactsTool', () => {
    it('should have correct schema', () => {
      expect(getUserFactsTool.name).toBe('get_user_facts');
      expect(getUserFactsTool.description).toContain('preferences');
    });

    it('should execute without keys', async () => {
      const result = await getUserFactsTool.execute({}, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should execute with specific keys', async () => {
      const params = { keys: ['language', 'budget'] };
      const result = await getUserFactsTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('recordServiceRequestTool', () => {
    it('should have correct schema', () => {
      expect(recordServiceRequestTool.name).toBe('record_service_request');
      expect(recordServiceRequestTool.description).toContain('service request');
    });

    it('should execute with required params', async () => {
      const params = {
        vertical: 'commerce' as const,
        requestType: 'buy',
        title: 'Looking for laptop',
      };

      const result = await recordServiceRequestTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('findVendorsNearbyTool', () => {
    it('should have correct schema', () => {
      expect(findVendorsNearbyTool.name).toBe('find_vendors_nearby');
      expect(findVendorsNearbyTool.description).toContain('vendors');
    });

    it('should execute with location', async () => {
      const params = {
        vertical: 'commerce' as const,
        latitude: -1.9441,
        longitude: 30.0619,
        radiusKm: 5,
      };

      const result = await findVendorsNearbyTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('searchFAQTool', () => {
    it('should have correct schema', () => {
      expect(searchFAQTool.name).toBe('search_easymo_faq');
      expect(searchFAQTool.description).toContain('FAQ');
    });

    it('should execute with query', async () => {
      const params = {
        query: 'How do I pay?',
        locale: 'en' as const,
      };

      const result = await searchFAQTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('searchServiceCatalogTool', () => {
    it('should have correct schema', () => {
      expect(searchServiceCatalogTool.name).toBe('search_service_catalog');
      expect(searchServiceCatalogTool.description).toContain('service catalog');
    });

    it('should execute with query', async () => {
      const params = { query: 'delivery service' };

      const result = await searchServiceCatalogTool.execute(params, mockContext);
      
      expect(mockFetch).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
