/**
 * Tests for FarmerAgent
 * 
 * Tests farmer-specific functionality including:
 * - Produce listing creation
 * - Buyer search
 * - Price estimation
 * - Deal logging
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { FarmerAgent } from '../farmer/farmer.agent';

// Mock the farmer market config
vi.mock('../../../../../config/farmer-agent/markets/index', () => ({
  getMarketConfig: vi.fn((marketCode: string) => {
    if (marketCode === 'unknown') return null;
    return {
      marketCode: 'RW',
      currency: 'RWF',
      allowedCities: ['Kigali', 'Butare', 'Gisenyi'],
      codFallback: {
        enabled: true,
        requiresConfirmation: false,
        instructions: 'Pay on delivery'
      },
      commodities: [
        {
          commodity: 'maize',
          varieties: [
            {
              code: 'MAIZE_YELLOW',
              name: 'Yellow Maize',
              defaultUnit: 'kg',
              allowedUnits: ['kg', 'ton'],
              grades: ['Grade A', 'Grade B'],
              minOrder: 50
            }
          ]
        }
      ]
    };
  }),
  matchCommodity: vi.fn((config: any, commodityValue: string) => {
    if (commodityValue === 'unknown') return null;
    return {
      commodity: 'maize',
      varieties: [
        {
          code: 'MAIZE_YELLOW',
          name: 'Yellow Maize',
          defaultUnit: 'kg',
          allowedUnits: ['kg', 'ton'],
          grades: ['Grade A', 'Grade B'],
          minOrder: 50
        }
      ]
    };
  }),
  matchVariety: vi.fn((commodityRule: any, varietyValue?: string) => {
    if (varietyValue === 'unknown') return null;
    return {
      code: 'MAIZE_YELLOW',
      name: 'Yellow Maize',
      defaultUnit: 'kg',
      allowedUnits: ['kg', 'ton'],
      grades: ['Grade A', 'Grade B'],
      minOrder: 50
    };
  }),
  normalize: vi.fn((str: string) => str?.toLowerCase()),
}));

describe('FarmerAgent', () => {
  let agent: FarmerAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new FarmerAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('farmer_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain('farmers');
      expect(agent.instructions).toContain('merchant buyers');
      expect(agent.instructions).toContain('listings');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('No financial advice');
      expect(agent.instructions).toContain('No health/medical claims');
      expect(agent.instructions).toContain('privacy');
    });
  });

  describe('tools', () => {
    it('should have create_or_update_produce_listing tool', () => {
      const tool = agent.tools.find(t => t.name === 'create_or_update_produce_listing');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('listing');
    });

    it('should have search_buyers tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_buyers');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Match farmers to buyers');
    });

    it('should have price_estimator tool', () => {
      const tool = agent.tools.find(t => t.name === 'price_estimator');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('price ranges');
    });

    it('should have matchmaker_job tool', () => {
      const tool = agent.tools.find(t => t.name === 'matchmaker_job');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('match task');
    });

    it('should have log_deal tool', () => {
      const tool = agent.tools.find(t => t.name === 'log_deal');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Confirmed deal');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('create_or_update_produce_listing');
      expect(toolNames).toContain('search_buyers');
      expect(toolNames).toContain('price_estimator');
      expect(toolNames).toContain('matchmaker_job');
      expect(toolNames).toContain('log_deal');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-farmer-123', source: 'whatsapp' as const };

    describe('search_buyers', () => {
      it('should return buyer matches', async () => {
        const tool = agent.tools.find(t => t.name === 'search_buyers')!;
        
        const result = await tool.execute(
          { commodity: 'maize', location: 'Kigali', volume: 100 },
          mockContext
        );

        expect(result.buyers).toBeDefined();
        expect(Array.isArray(result.buyers)).toBe(true);
        expect(result.buyers.length).toBeGreaterThan(0);
      });

      it('should include buyer details', async () => {
        const tool = agent.tools.find(t => t.name === 'search_buyers')!;
        
        const result = await tool.execute(
          { commodity: 'maize', location: 'Kigali' },
          mockContext
        );

        const buyer = result.buyers[0];
        expect(buyer).toHaveProperty('id');
        expect(buyer).toHaveProperty('name');
      });
    });

    describe('price_estimator', () => {
      it('should return price range', async () => {
        const tool = agent.tools.find(t => t.name === 'price_estimator')!;
        
        const result = await tool.execute(
          { commodity: 'maize', market: 'RW' },
          mockContext
        );

        expect(result.min).toBeDefined();
        expect(result.avg).toBeDefined();
        expect(result.max).toBeDefined();
        expect(result.currency).toBe('RWF');
      });
    });

    describe('matchmaker_job', () => {
      it('should queue match task', async () => {
        const tool = agent.tools.find(t => t.name === 'matchmaker_job')!;
        
        const result = await tool.execute(
          { listing_id: 'listing-123' },
          mockContext
        );

        expect(result.status).toBe('queued');
        expect(result.potential_matches).toBeDefined();
      });
    });

    describe('log_deal', () => {
      it('should log confirmed deal', async () => {
        const tool = agent.tools.find(t => t.name === 'log_deal')!;
        
        const result = await tool.execute(
          { 
            buyer_id: 'buyer-123',
            farmer_id: 'farmer-123',
            commodity: 'maize',
            quantity: 100,
            price: 50000
          },
          mockContext
        );

        expect(result.deal_id).toBeDefined();
        expect(result.status).toBe('logged');
      });
    });
  });

  describe('execute', () => {
    it('should return success response with full params', async () => {
      const input: AgentInput = {
        query: 'I want to sell my maize',
        userId: 'test-farmer-123',
        context: {
          userId: 'test-farmer-123',
          source: 'whatsapp',
          metadata: {
            action: 'create_or_update_produce_listing',
            params: {
              marketCode: 'RW',
              commodity: 'maize',
              quantity: 100,
              city: 'Kigali'
            }
          }
        }
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
    });

    it('should handle listing creation with context', async () => {
      const input: AgentInput = {
        query: 'Create a listing',
        userId: 'test-farmer-123',
        context: {
          userId: 'test-farmer-123',
          source: 'whatsapp',
          metadata: {
            action: 'create_or_update_produce_listing',
            params: {
              marketCode: 'RW',
              commodity: 'maize',
              quantity: 100,
              city: 'Kigali'
            }
          }
        }
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.toolsInvoked).toContain('create_or_update_produce_listing');
    });
  });

  describe('guardrails', () => {
    it('should include no financial advice', () => {
      expect(agent.instructions).toContain('No financial advice');
    });

    it('should include privacy protection', () => {
      expect(agent.instructions).toContain('Respect buyer/farmer privacy');
    });

    it('should include consent requirement', () => {
      expect(agent.instructions).toContain('without consent');
    });

    it('should include low literacy support', () => {
      expect(agent.instructions).toContain('low smartphone literacy');
    });
  });
});
