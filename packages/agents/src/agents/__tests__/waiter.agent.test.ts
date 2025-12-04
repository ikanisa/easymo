/**
 * Tests for WaiterAgent
 * 
 * Tests waiter-specific functionality including:
 * - Menu search
 * - Order creation
 * - Payment integration (MoMo)
 * - Loyalty lookups
 * - Table bookings
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { WaiterAgent } from '../waiter/waiter.agent';

describe('WaiterAgent', () => {
  let agent: WaiterAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new WaiterAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('waiter_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain('virtual restaurant waiter');
      expect(agent.instructions).toContain('WhatsApp');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('Never invent menu items');
      expect(agent.instructions).toContain('never promise allergy safety');
    });
  });

  describe('tools', () => {
    it('should have search_menu_supabase tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_menu_supabase');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Search dishes');
    });

    it('should have deepsearch tool', () => {
      const tool = agent.tools.find(t => t.name === 'deepsearch');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Web / Deep Search');
    });

    it('should have momo_charge tool', () => {
      const tool = agent.tools.find(t => t.name === 'momo_charge');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('MoMo payment');
    });

    it('should have send_order tool', () => {
      const tool = agent.tools.find(t => t.name === 'send_order');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('kitchen ticket');
    });

    it('should have lookup_loyalty tool', () => {
      const tool = agent.tools.find(t => t.name === 'lookup_loyalty');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('loyalty points');
    });

    it('should have book_table tool', () => {
      const tool = agent.tools.find(t => t.name === 'book_table');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('reservation');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('search_menu_supabase');
      expect(toolNames).toContain('deepsearch');
      expect(toolNames).toContain('momo_charge');
      expect(toolNames).toContain('send_order');
      expect(toolNames).toContain('lookup_loyalty');
      expect(toolNames).toContain('book_table');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-user-123', source: 'whatsapp' as const };

    describe('search_menu_supabase', () => {
      it('should return menu items', async () => {
        const tool = agent.tools.find(t => t.name === 'search_menu_supabase')!;
        
        const result = await tool.execute(
          { restaurant_id: 'rest-123', query: 'fish' },
          mockContext
        );

        expect(result.items).toBeDefined();
        expect(Array.isArray(result.items)).toBe(true);
        expect(result.items.length).toBeGreaterThan(0);
      });

      it('should include price and availability in items', async () => {
        const tool = agent.tools.find(t => t.name === 'search_menu_supabase')!;
        
        const result = await tool.execute(
          { restaurant_id: 'rest-123', query: 'tilapia' },
          mockContext
        );

        const item = result.items[0];
        expect(item).toHaveProperty('price');
        expect(item).toHaveProperty('available');
        expect(item).toHaveProperty('name');
      });
    });

    describe('deepsearch', () => {
      it('should return search summary', async () => {
        const tool = agent.tools.find(t => t.name === 'deepsearch')!;
        
        const result = await tool.execute(
          { query: 'nutritional info' },
          mockContext
        );

        expect(result.summary).toBeDefined();
      });
    });

    describe('momo_charge', () => {
      it('should initiate payment and return status', async () => {
        const tool = agent.tools.find(t => t.name === 'momo_charge')!;
        
        const result = await tool.execute(
          { phone: '250788123456', amount: 5000, order_id: 'order-123' },
          mockContext
        );

        expect(result.status).toBeDefined();
        expect(result.txn_id).toBeDefined();
      });
    });

    describe('send_order', () => {
      it('should create kitchen ticket', async () => {
        const tool = agent.tools.find(t => t.name === 'send_order')!;
        
        const result = await tool.execute(
          { 
            order_details: { items: ['tilapia', 'rice'] },
            table_number: 'T5'
          },
          mockContext
        );

        expect(result.ticket_id).toBeDefined();
        expect(result.status).toBe('sent_to_kitchen');
      });
    });

    describe('lookup_loyalty', () => {
      it('should return loyalty info', async () => {
        const tool = agent.tools.find(t => t.name === 'lookup_loyalty')!;
        
        const result = await tool.execute(
          { user_id: 'user-123' },
          mockContext
        );

        expect(result.points).toBeDefined();
        expect(result.tier).toBeDefined();
      });
    });

    describe('book_table', () => {
      it('should create reservation', async () => {
        const tool = agent.tools.find(t => t.name === 'book_table')!;
        
        const result = await tool.execute(
          { 
            date: '2025-12-25',
            time: '19:00',
            party_size: 4,
            name: 'John Doe'
          },
          mockContext
        );

        expect(result.reservation_id).toBeDefined();
        expect(result.status).toBe('confirmed');
      });
    });
  });

  describe('execute', () => {
    it('should return success response', async () => {
      const input: AgentInput = {
        query: 'Show me the menu',
        userId: 'test-user-123',
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
    });

    it('should handle context parameter', async () => {
      const input: AgentInput = {
        query: 'What do you have?',
        userId: 'test-user-123',
        context: {
          userId: 'test-user-123',
          source: 'whatsapp',
          metadata: { restaurant_id: 'rest-123' }
        }
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
    });
  });

  describe('format methods', () => {
    it('should format single option correctly', () => {
      const option = { name: 'Grilled Fish', price: 5000 };
      
      // Access protected method via type casting
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Grilled Fish');
      expect(formatted).toContain('5000');
    });
  });

  describe('guardrails', () => {
    it('should include domain restriction in instructions', () => {
      expect(agent.instructions).toContain('Domain-only');
      expect(agent.instructions).toContain('no politics');
    });

    it('should include menu grounding in instructions', () => {
      expect(agent.instructions).toContain('ground answers in menu DB');
    });

    it('should include payment confirmation in instructions', () => {
      expect(agent.instructions).toContain('Double-confirm orders');
    });
  });
});
