/**
 * Agent Registry
 * Central registry for all AI agents
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * Updated: 2025-12-01 - Added Rides and Insurance agents
 * 
 * OFFICIAL AGENTS (10 production agents matching ai_agents database table):
 * 1. waiter - Restaurant/Bar ordering, table booking
 * 2. farmer - Agricultural support, market prices
 * 3. jobs - Job search, employment, gigs
 * 4. real_estate - Property rentals, listings
 * 5. marketplace - Buy/sell products, business directory
 * 6. rides - Transport, ride-sharing, delivery
 * 7. insurance - Motor insurance, policies, claims
 * 8. support - General help, customer service
 * 9. sales_cold_caller - Sales/Marketing outreach
 * 10. business_broker - Deprecated, use marketplace
 */

import type { BaseAgent } from './base-agent.ts';
import { WaiterAgent } from '../agents/waiter-agent.ts';
import { SupportAgent } from '../agents/support-agent.ts';
import { FarmerAgent } from '../agents/farmer-agent.ts';
import { JobsAgent } from '../agents/jobs-agent.ts';
import { PropertyAgent } from '../agents/property-agent.ts';
import { MarketplaceAgent } from '../agents/marketplace-agent.ts';
import { RidesAgent } from '../agents/rides-agent.ts';
import { InsuranceAgent } from '../agents/insurance-agent.ts';

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private intentMapping = new Map<string, string>();

  constructor() {
    this.registerAllAgents();
    this.setupIntentMapping();
  }

  /**
   * Register all available agents
   * All agents use database-driven configuration via AgentConfigLoader
   */
  private registerAllAgents(): void {
    // Core service agents
    this.register(new WaiterAgent());
    this.register(new SupportAgent());
    this.register(new FarmerAgent());
    this.register(new JobsAgent());
    this.register(new PropertyAgent());
    this.register(new MarketplaceAgent());
    this.register(new RidesAgent());
    this.register(new InsuranceAgent());
  }

  /**
   * Map intents/keywords to agent types
   */
  private setupIntentMapping(): void {
    // Waiter Agent
    this.intentMapping.set('waiter', 'waiter_agent');
    this.intentMapping.set('restaurant', 'waiter_agent');
    this.intentMapping.set('food', 'waiter_agent');
    this.intentMapping.set('bar', 'waiter_agent');
    this.intentMapping.set('menu', 'waiter_agent');
    this.intentMapping.set('order', 'waiter_agent');
    
    // Support Agent
    this.intentMapping.set('support', 'support_agent');
    this.intentMapping.set('help', 'support_agent');
    this.intentMapping.set('question', 'support_agent');
    this.intentMapping.set('customer_support', 'support_agent');
    
    // Farmer Agent
    this.intentMapping.set('farmer', 'farmer_agent');
    this.intentMapping.set('agriculture', 'farmer_agent');
    this.intentMapping.set('crop', 'farmer_agent');
    this.intentMapping.set('farming', 'farmer_agent');
    this.intentMapping.set('produce', 'farmer_agent');
    
    // Jobs Agent
    this.intentMapping.set('jobs', 'jobs_agent');
    this.intentMapping.set('employment', 'jobs_agent');
    this.intentMapping.set('hire', 'jobs_agent');
    this.intentMapping.set('work', 'jobs_agent');
    this.intentMapping.set('career', 'jobs_agent');
    
    // Property Agent
    this.intentMapping.set('property', 'real_estate_agent');
    this.intentMapping.set('rental', 'real_estate_agent');
    this.intentMapping.set('house', 'real_estate_agent');
    this.intentMapping.set('apartment', 'real_estate_agent');
    this.intentMapping.set('real_estate', 'real_estate_agent');
    
    // Marketplace Agent (includes business broker functionality)
    this.intentMapping.set('marketplace', 'business_broker_agent');
    this.intentMapping.set('buy', 'business_broker_agent');
    this.intentMapping.set('sell', 'business_broker_agent');
    this.intentMapping.set('shopping', 'business_broker_agent');
    this.intentMapping.set('business', 'business_broker_agent');
    
    // Rides Agent
    this.intentMapping.set('rides', 'rides_agent');
    this.intentMapping.set('ride', 'rides_agent');
    this.intentMapping.set('driver', 'rides_agent');
    this.intentMapping.set('passenger', 'rides_agent');
    this.intentMapping.set('transport', 'rides_agent');
    this.intentMapping.set('taxi', 'rides_agent');
    this.intentMapping.set('moto', 'rides_agent');
    
    // Insurance Agent
    this.intentMapping.set('insurance', 'insurance_agent');
    this.intentMapping.set('insure', 'insurance_agent');
    this.intentMapping.set('policy', 'insurance_agent');
    this.intentMapping.set('certificate', 'insurance_agent');
    this.intentMapping.set('carte_jaune', 'insurance_agent');
    this.intentMapping.set('claim', 'insurance_agent');
  }

  /**
   * Register a new agent
   */
  register(agent: BaseAgent): void {
    this.agents.set(agent.type, agent);
    console.log(`Agent registered: ${agent.type} (${agent.name})`);
  }

  /**
   * Get agent by type
   */
  getAgent(type: string): BaseAgent {
    const agent = this.agents.get(type);
    if (!agent) {
      // Fallback to support agent if agent not found
      console.warn(`Agent not found: ${type}, falling back to support agent`);
      return this.agents.get('support_agent') || this.agents.values().next().value;
    }
    return agent;
  }

  /**
   * Get agent by intent/keyword
   */
  getAgentByIntent(intent: string): BaseAgent {
    const agentType = this.intentMapping.get(intent.toLowerCase());
    if (!agentType) {
      // Fallback to support agent
      return this.getAgent('support_agent');
    }
    return this.getAgent(agentType);
  }

  /**
   * List all registered agents
   */
  listAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Check if agent exists
   */
  hasAgent(type: string): boolean {
    return this.agents.has(type);
  }
}
