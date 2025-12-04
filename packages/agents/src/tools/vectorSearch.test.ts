/**
 * Tests for vectorSearch tool
 * 
 * Tests semantic search schema validation and tool definition.
 * Note: executeVectorSearch requires integration testing with actual OpenAI/Supabase
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vectorSearchSchema,vectorSearchTool } from './vectorSearch';

describe('vectorSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('vectorSearchSchema', () => {
    it('should validate correct params', () => {
      const result = vectorSearchSchema.parse({
        query: 'apartment in Kigali',
        collection: 'real_estate',
        limit: 5,
      });

      expect(result.query).toBe('apartment in Kigali');
      expect(result.collection).toBe('real_estate');
      expect(result.limit).toBe(5);
    });

    it('should accept jobs collection', () => {
      const result = vectorSearchSchema.parse({
        query: 'driver position',
        collection: 'jobs',
      });

      expect(result.collection).toBe('jobs');
    });

    it('should reject invalid collection', () => {
      expect(() => {
        vectorSearchSchema.parse({
          query: 'test',
          collection: 'invalid',
        });
      }).toThrow();
    });

    it('should reject empty query', () => {
      expect(() => {
        vectorSearchSchema.parse({
          query: '',
          collection: 'real_estate',
        });
      }).toThrow();
    });

    it('should reject limit over maximum', () => {
      expect(() => {
        vectorSearchSchema.parse({
          query: 'test',
          collection: 'real_estate',
          limit: 100,
        });
      }).toThrow();
    });

    it('should reject limit under minimum', () => {
      expect(() => {
        vectorSearchSchema.parse({
          query: 'test',
          collection: 'real_estate',
          limit: 0,
        });
      }).toThrow();
    });

    it('should apply default limit', () => {
      const result = vectorSearchSchema.parse({
        query: 'test',
        collection: 'jobs',
      });

      expect(result.limit).toBe(5);
    });

    it('should accept optional filter', () => {
      const result = vectorSearchSchema.parse({
        query: 'luxury apartment',
        collection: 'real_estate',
        filter: { price_max: 500000 },
      });

      expect(result.filter).toEqual({ price_max: 500000 });
    });
  });

  describe('vectorSearchTool', () => {
    it('should have correct name', () => {
      expect(vectorSearchTool.name).toBe('VectorSearch');
    });

    it('should have description', () => {
      expect(vectorSearchTool.description).toContain('semantic search');
    });

    it('should have parameters schema', () => {
      expect(vectorSearchTool.parameters).toBeDefined();
    });

    it('should have execute function', () => {
      expect(typeof vectorSearchTool.execute).toBe('function');
    });
  });
});
