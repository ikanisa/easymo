/**
 * Tests for BuyAndSellAgent
 * 
 * Tests the unified commerce and business discovery agent including:
 * - Product commerce (pharmacy, hardware, grocery)
 * - Business discovery
 * - Business brokerage
 * - Legal intake
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { BuyAndSellAgent, runBuyAndSellAgent } from '../commerce/buy-and-sell.agent';

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        ilike: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            })),
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'test-123', name: 'Test Business' }, 
            error: null 
          })),
          eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
        })),
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: 'new-123', title: 'Test Listing' }, 
            error: null 
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'order-123', status: 'confirmed' }, 
              error: null 
            }))
          }))
        }))
      }))
    }))
  }))
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(() => Promise.resolve({
      data: {
        local_results: [{
          gps_coordinates: { latitude: -1.9441, longitude: 30.0619 },
          address: 'Kigali, Rwanda',
          title: 'Test Location'
        }]
      }
    }))
  }
}));

describe('BuyAndSellAgent', () => {
  let agent: BuyAndSellAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new BuyAndSellAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('buy_and_sell_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain("Buy & Sell assistant");
      expect(agent.instructions).toContain('marketplace transactions');
      expect(agent.instructions).toContain('business opportunities');
    });

    it('should use Gemini model', () => {
      expect(agent.model).toBe('gemini-1.5-flash');
    });

    it('should have marketplace capabilities in instructions', () => {
      expect(agent.instructions).toContain('MARKETPLACE CAPABILITIES');
      expect(agent.instructions).toContain('pharmacy');
      expect(agent.instructions).toContain('hardware');
      expect(agent.instructions).toContain('grocery');
    });

    it('should have business discovery capabilities in instructions', () => {
      expect(agent.instructions).toContain('BUSINESS DISCOVERY');
      expect(agent.instructions).toContain('maps_geocode');
    });

    it('should have business brokerage capabilities in instructions', () => {
      expect(agent.instructions).toContain('BUSINESS BROKERAGE');
      expect(agent.instructions).toContain('sellers');
      expect(agent.instructions).toContain('buyers');
    });

    it('should have legal intake capabilities in instructions', () => {
      expect(agent.instructions).toContain('LEGAL INTAKE');
      expect(agent.instructions).toContain('handoff required');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('GUARDRAILS');
      expect(agent.instructions).toContain('No medical advice');
      expect(agent.instructions).toContain('No legal');
      expect(agent.instructions).toContain('privacy');
    });
  });

  describe('tools', () => {
    it('should have search_businesses tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_businesses');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Find businesses');
    });

    it('should have maps_geocode tool', () => {
      const tool = agent.tools.find(t => t.name === 'maps_geocode');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('coordinates');
    });

    it('should have business_details tool', () => {
      const tool = agent.tools.find(t => t.name === 'business_details');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('full details');
    });

    it('should have search_products tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_products');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('marketplace');
    });

    it('should have inventory_check tool', () => {
      const tool = agent.tools.find(t => t.name === 'inventory_check');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('stock levels');
    });

    it('should have create_listing tool', () => {
      const tool = agent.tools.find(t => t.name === 'create_listing');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('new product');
    });

    it('should have order_create tool', () => {
      const tool = agent.tools.find(t => t.name === 'order_create');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('order');
    });

    it('should have order_status_update tool', () => {
      const tool = agent.tools.find(t => t.name === 'order_status_update');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('status');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('search_businesses');
      expect(toolNames).toContain('maps_geocode');
      expect(toolNames).toContain('business_details');
      expect(toolNames).toContain('search_products');
      expect(toolNames).toContain('inventory_check');
      expect(toolNames).toContain('create_listing');
      expect(toolNames).toContain('order_create');
      expect(toolNames).toContain('order_status_update');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-user-123', source: 'whatsapp' as const };

    describe('search_businesses', () => {
      it('should search for businesses by category and location', async () => {
        const tool = agent.tools.find(t => t.name === 'search_businesses')!;
        
        const result = await tool.execute(
          { category: 'pharmacy', lat: -1.9441, lng: 30.0619 },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('businesses');
      });
    });

    describe('maps_geocode', () => {
      it('should convert address to coordinates', async () => {
        process.env.SERPAPI_KEY = 'test-api-key';
        const tool = agent.tools.find(t => t.name === 'maps_geocode')!;
        
        const result = await tool.execute(
          { address: 'Kigali City Tower' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('lat');
        expect(result).toHaveProperty('lng');
      });
    });

    describe('business_details', () => {
      it('should fetch business details by ID', async () => {
        const tool = agent.tools.find(t => t.name === 'business_details')!;
        
        const result = await tool.execute(
          { business_id: 'biz-123' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('id');
      });
    });

    describe('search_products', () => {
      it('should search for products', async () => {
        const tool = agent.tools.find(t => t.name === 'search_products')!;
        
        const result = await tool.execute(
          { query: 'paracetamol' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('products');
      });
    });

    describe('inventory_check', () => {
      it('should check inventory for a product', async () => {
        const tool = agent.tools.find(t => t.name === 'inventory_check')!;
        
        const result = await tool.execute(
          { product_id: 'prod-123' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('inventory');
      });
    });

    describe('create_listing', () => {
      it('should create a new listing', async () => {
        const tool = agent.tools.find(t => t.name === 'create_listing')!;
        
        const result = await tool.execute(
          { 
            title: 'Test Product',
            category: 'hardware',
            listing_type: 'product',
            price: 5000,
            description: 'A test product'
          },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('listing');
        expect(result).toHaveProperty('message');
      });
    });

    describe('order_create', () => {
      it('should create an order', async () => {
        const tool = agent.tools.find(t => t.name === 'order_create')!;
        
        const result = await tool.execute(
          { 
            items: [{ product_id: 'prod-123', quantity: 2 }],
            delivery_address: 'KG 123 St'
          },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('order');
        expect(result).toHaveProperty('message');
      });
    });

    describe('order_status_update', () => {
      it('should update order status', async () => {
        const tool = agent.tools.find(t => t.name === 'order_status_update')!;
        
        const result = await tool.execute(
          { order_id: 'order-123', status: 'confirmed' },
          mockContext
        );

        expect(result).toBeDefined();
        expect(result).toHaveProperty('order');
        expect(result).toHaveProperty('message');
      });
    });
  });

  describe('format methods', () => {
    it('should format business option correctly', () => {
      const option = { 
        name: 'Test Pharmacy', 
        category: 'pharmacy',
        address: 'KG 123 St, Kigali',
        phone: '+250788123456',
        rating: 4.5
      };
      
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Test Pharmacy');
      expect(formatted).toContain('pharmacy');
      expect(formatted).toContain('KG 123 St');
      expect(formatted).toContain('4.5');
    });

    it('should format product/listing option correctly', () => {
      const option = { 
        title: 'Paracetamol 500mg', 
        price: 1000,
        description: 'Pain relief medication'
      };
      
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Paracetamol 500mg');
      expect(formatted).toContain('1000');
      expect(formatted).toContain('Pain relief');
    });
  });

  describe('guardrails', () => {
    it('should include no medical advice guardrail', () => {
      expect(agent.instructions).toContain('No medical advice beyond finding a pharmacy');
    });

    it('should include no legal advice guardrail', () => {
      expect(agent.instructions).toContain('No legal, tax, or financial advice');
    });

    it('should include privacy protection', () => {
      expect(agent.instructions).toContain('Protect user privacy');
    });

    it('should include sensitive topics handoff', () => {
      expect(agent.instructions).toContain('Sensitive topics require handoff');
    });
  });

  describe('runBuyAndSellAgent helper', () => {
    it('should be a function', () => {
      expect(typeof runBuyAndSellAgent).toBe('function');
    });

    it('should create and execute agent', async () => {
      const input: AgentInput = {
        query: 'Find a pharmacy near me',
        userId: 'test-user-123',
      };

      // This will run but likely mock responses
      const result = await runBuyAndSellAgent(input);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('finalOutput');
    });
  });
});
