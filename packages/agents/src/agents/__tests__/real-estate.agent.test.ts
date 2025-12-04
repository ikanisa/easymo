/**
 * Tests for RealEstateAgent
 * 
 * Tests real estate-related functionality including:
 * - Property search
 * - Owner contact
 * - Property shortlists
 * - User profile management
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentInput } from '../../types/agent.types';
import { RealEstateAgent } from '../property/real-estate.agent';

describe('RealEstateAgent', () => {
  let agent: RealEstateAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new RealEstateAgent();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('real_estate_agent');
    });

    it('should have comprehensive instructions', () => {
      expect(agent.instructions).toContain('WhatsApp real-estate concierge');
      expect(agent.instructions).toContain('multilingual');
    });

    it('should have guardrails in instructions', () => {
      expect(agent.instructions).toContain('No legal/visa advice');
      expect(agent.instructions).toContain('no price guarantees');
      expect(agent.instructions).toContain('privacy');
    });
  });

  describe('tools', () => {
    it('should have search_listings tool', () => {
      const tool = agent.tools.find(t => t.name === 'search_listings');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Query internal listing DB');
    });

    it('should have deep_listing_search tool', () => {
      const tool = agent.tools.find(t => t.name === 'deep_listing_search');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Scrape');
    });

    it('should have contact_owner_whatsapp tool', () => {
      const tool = agent.tools.find(t => t.name === 'contact_owner_whatsapp');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('templated intro');
    });

    it('should have call_owner_voice tool', () => {
      const tool = agent.tools.find(t => t.name === 'call_owner_voice');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('voice call');
    });

    it('should have generate_shortlist_doc tool', () => {
      const tool = agent.tools.find(t => t.name === 'generate_shortlist_doc');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('mini brochure');
    });

    it('should have store_user_profile tool', () => {
      const tool = agent.tools.find(t => t.name === 'store_user_profile');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('renter profiles');
    });

    it('should have all required tools', () => {
      const toolNames = agent.tools.map(t => t.name);
      expect(toolNames).toContain('search_listings');
      expect(toolNames).toContain('deep_listing_search');
      expect(toolNames).toContain('contact_owner_whatsapp');
      expect(toolNames).toContain('call_owner_voice');
      expect(toolNames).toContain('generate_shortlist_doc');
      expect(toolNames).toContain('store_user_profile');
    });
  });

  describe('tool execution', () => {
    const mockContext = { userId: 'test-renter-123', source: 'whatsapp' as const };

    describe('search_listings', () => {
      it('should return property listings', async () => {
        const tool = agent.tools.find(t => t.name === 'search_listings')!;
        
        const result = await tool.execute(
          { area: 'Kigali', price_max: 500000, beds: 2 },
          mockContext
        );

        expect(result.listings).toBeDefined();
        expect(Array.isArray(result.listings)).toBe(true);
        expect(result.listings.length).toBeGreaterThan(0);
      });

      it('should include listing details', async () => {
        const tool = agent.tools.find(t => t.name === 'search_listings')!;
        
        const result = await tool.execute(
          { area: 'Kigali' },
          mockContext
        );

        const listing = result.listings[0];
        expect(listing).toHaveProperty('id');
        expect(listing).toHaveProperty('title');
        expect(listing).toHaveProperty('price');
        expect(listing).toHaveProperty('beds');
      });
    });

    describe('deep_listing_search', () => {
      it('should return aggregated listings', async () => {
        const tool = agent.tools.find(t => t.name === 'deep_listing_search')!;
        
        const result = await tool.execute(
          { query: '2 bedroom apartment', location: 'Kigali' },
          mockContext
        );

        expect(result.listings).toBeDefined();
        expect(Array.isArray(result.listings)).toBe(true);
      });
    });

    describe('contact_owner_whatsapp', () => {
      it('should send owner message', async () => {
        const tool = agent.tools.find(t => t.name === 'contact_owner_whatsapp')!;
        
        const result = await tool.execute(
          { owner_id: 'owner-123', message_template: 'interest_inquiry' },
          mockContext
        );

        expect(result.status).toBe('sent');
        expect(result.session_id).toBeDefined();
      });
    });

    describe('call_owner_voice', () => {
      it('should initiate voice call', async () => {
        const tool = agent.tools.find(t => t.name === 'call_owner_voice')!;
        
        const result = await tool.execute(
          { owner_phone: '+250788123456' },
          mockContext
        );

        expect(result.call_id).toBeDefined();
        expect(result.status).toBe('initiated');
      });
    });

    describe('generate_shortlist_doc', () => {
      it('should generate property brochure', async () => {
        const tool = agent.tools.find(t => t.name === 'generate_shortlist_doc')!;
        
        const result = await tool.execute(
          { property_ids: ['prop-1', 'prop-2', 'prop-3'] },
          mockContext
        );

        expect(result.document_url).toBeDefined();
        expect(result.document_url).toContain('https://');
      });
    });

    describe('store_user_profile', () => {
      it('should store user preferences', async () => {
        const tool = agent.tools.find(t => t.name === 'store_user_profile')!;
        
        const result = await tool.execute(
          { preferences: { budget: 500000, beds: 2, area: 'Kigali' } },
          mockContext
        );

        expect(result.status).toBe('updated');
        expect(result.profile_id).toBeDefined();
      });
    });
  });

  describe('execute', () => {
    it('should return success response', async () => {
      const input: AgentInput = {
        query: 'I am looking for an apartment in Kigali',
        userId: 'test-renter-123',
      };

      const result = await agent.execute(input);

      expect(result.success).toBe(true);
      expect(result.finalOutput).toBeDefined();
    });
  });

  describe('format methods', () => {
    it('should format listing option correctly', () => {
      const option = { title: 'Cozy Apartment', price: 300000, beds: 2 };
      
      const formatted = (agent as any).formatSingleOption(option);
      
      expect(formatted).toContain('Cozy Apartment');
      expect(formatted).toContain('300000');
      expect(formatted).toContain('2 beds');
    });
  });

  describe('guardrails', () => {
    it('should include no legal advice', () => {
      expect(agent.instructions).toContain('No legal/visa advice');
    });

    it('should include privacy protection', () => {
      expect(agent.instructions).toContain('GDPR');
      expect(agent.instructions).toContain('privacy');
    });

    it('should include estimate vs confirmed distinction', () => {
      expect(agent.instructions).toContain('estimates vs confirmed');
    });

    it('should protect owner contact details', () => {
      expect(agent.instructions).toContain('owner contact details private');
    });
  });
});
