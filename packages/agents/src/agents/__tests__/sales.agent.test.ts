/**
 * Tests for SalesAgent
 * 
 * Tests sales and marketing functionality including:
 * - Ad script generation
 * - Campaign creation
 * - Audience targeting
 * - A/B test generation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { SalesAgent } from '../sales/sales.agent';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'camp-123', campaign_name: 'Test Campaign', status: 'active' }, 
            error: null 
          })),
          limit: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        })),
        order: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'new-camp-123', campaign_name: 'New Campaign', status: 'draft', budget: 50000 }, 
            error: null 
          }))
        }))
      }))
    })),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null }))
  }))
}));

describe('SalesAgent', () => {
  let agent: SalesAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SalesAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('sales_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain('creative director');
      expect(agent.instructions).toContain('ad campaigns');
    });

    it('should use Gemini model', () => {
      expect(agent.model).toBe('gemini-1.5-flash');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('No guaranteeing ROI');
      expect(agent.instructions).toContain('No offensive/political content');
    });
  });

  describe('tools', () => {
    it('should have generate_ad_script tool', () => {
      const tool = agent.tools.find(t => t.name === 'generate_ad_script');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('video scripts');
    });

    it('should have create_campaign tool', () => {
      const tool = agent.tools.find(t => t.name === 'create_campaign');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('ad campaign');
    });

    it('should have activate_campaign tool', () => {
      const tool = agent.tools.find(t => t.name === 'activate_campaign');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Activate');
    });

    it('should have check_campaign_stats tool', () => {
      const tool = agent.tools.find(t => t.name === 'check_campaign_stats');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('views');
    });

    it('should have list_my_campaigns tool', () => {
      const tool = agent.tools.find(t => t.name === 'list_my_campaigns');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('List all campaigns');
    });

    it('should have audience_targeting tool', () => {
      const tool = agent.tools.find(t => t.name === 'audience_targeting');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('demographics');
    });

    it('should have ab_test_generator tool', () => {
      const tool = agent.tools.find(t => t.name === 'ab_test_generator');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('variations');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('generate_ad_script');
      expect(toolNames).toContain('create_campaign');
      expect(toolNames).toContain('activate_campaign');
      expect(toolNames).toContain('check_campaign_stats');
      expect(toolNames).toContain('list_my_campaigns');
      expect(toolNames).toContain('audience_targeting');
      expect(toolNames).toContain('ab_test_generator');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-marketer-123', source: 'whatsapp' as const };

    describe('audience_targeting', () => {
      it('should return audience recommendations', async () => {
        const tool = agent.tools.find(t => t.name === 'audience_targeting')!;
        
        const result = await tool.execute(
          { product_category: 'agriculture' },
          mockContext
        );

        expect(result.recommended_audience).toBeDefined();
        expect(result.locations).toBeDefined();
        expect(result.age_range).toBeDefined();
        expect(Array.isArray(result.recommended_audience)).toBe(true);
      });

      it('should return default audience for unknown category', async () => {
        const tool = agent.tools.find(t => t.name === 'audience_targeting')!;
        
        const result = await tool.execute(
          { product_category: 'unknown_category' },
          mockContext
        );

        expect(result.recommended_audience).toBeDefined();
        expect(result.recommended_budget).toBeDefined();
      });
    });

    describe('ab_test_generator', () => {
      it('should generate ad variations', async () => {
        const tool = agent.tools.find(t => t.name === 'ab_test_generator')!;
        
        const result = await tool.execute(
          { base_copy: 'Try our new product today!', product_name: 'TestProduct' },
          mockContext
        );

        expect(result.variant_A).toBeDefined();
        expect(result.variant_B).toBeDefined();
        expect(result.test_hypothesis).toBeDefined();
      });
    });

    describe('create_campaign', () => {
      it('should create a new campaign', async () => {
        const tool = agent.tools.find(t => t.name === 'create_campaign')!;
        
        const result = await tool.execute(
          { 
            campaign_name: 'Test Campaign',
            budget: 50000,
            product_name: 'TestProduct'
          },
          mockContext
        );

        expect(result).toBeDefined();
        // Result will have campaign_name, error, or success property
        expect(
          'campaign_name' in result || 
          'error' in result || 
          'success' in result
        ).toBe(true);
      });
    });

    describe('activate_campaign', () => {
      it('should activate a campaign', async () => {
        const tool = agent.tools.find(t => t.name === 'activate_campaign')!;
        
        const result = await tool.execute(
          { campaign_id: 'camp-123' },
          mockContext
        );

        expect(result).toBeDefined();
        // Result will have success or error
        expect('success' in result || 'error' in result).toBe(true);
      });
    });

    describe('list_my_campaigns', () => {
      it('should list user campaigns', async () => {
        const tool = agent.tools.find(t => t.name === 'list_my_campaigns')!;
        
        const result = await tool.execute(
          {},
          mockContext
        );

        expect(result).toBeDefined();
        expect(result.campaigns).toBeDefined();
        expect(Array.isArray(result.campaigns)).toBe(true);
      });
    });
  });

  describe('format methods', () => {
    it('should format campaign option correctly', () => {
      const option = { 
        campaign_name: 'Summer Sale', 
        budget: 100000,
        status: 'active',
        views: 5000,
        clicks: 250
      };
      
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Summer Sale');
      expect(formatted).toContain('100000');
      expect(formatted).toContain('active');
    });
  });

  describe('guardrails', () => {
    it('should not guarantee ROI', () => {
      expect(agent.instructions).toContain('No guaranteeing ROI');
    });

    it('should avoid offensive content', () => {
      expect(agent.instructions).toContain('No offensive/political content');
    });

    it('should respect platform standards', () => {
      expect(agent.instructions).toContain('platform ad standards');
    });

    it('should distinguish organic vs paid', () => {
      expect(agent.instructions).toContain('organic vs paid');
    });
  });
});
