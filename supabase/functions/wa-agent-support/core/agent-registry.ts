/**
 * Agent Registry
 * Central registry for all AI agents
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 * Updated: 2025-12-01 - Added Rides and Insurance agents
 * Updated: 2025-12-05 - Merged marketplace and business_broker into buy_sell
 * Updated: 2025-12-05 - Merged marketplace and business_broker into buy_and_sell
 * Updated: 2025-12-10 - Removed Rides and Insurance agents (replaced with WhatsApp workflows)
 * 
 * OFFICIAL AGENTS (7 production agents matching ai_agents database table):
 * OFFICIAL AGENTS (7 production agents):
 * 1. waiter - Restaurant/Bar ordering, table booking
 * 2. farmer - Agricultural support, market prices
 * 3. jobs - Job search, employment, gigs
 * 4. real_estate - Property rentals, listings
 * 5. buy_and_sell - Buy & Sell (merged: marketplace + business_broker)
 * 6. support - General help, customer service
 * 7. sales_cold_caller - Sales/Marketing outreach
 * 
 * DELETED (replaced with WhatsApp button-based workflows):
 * - rides - Now handled via wa-webhook-mobility workflows
 * - insurance - Now handled via wa-webhook-insurance workflows
 * 5. buy_sell - Buy & Sell (merged: marketplace + business_broker)
 * 6. rides - Transport, ride-sharing, delivery
 * 7. insurance - Motor insurance, policies, claims
 * 8. support - General help, customer service
 * 9. sales_cold_caller - Sales/Marketing outreach
 * 5. buy_and_sell - Buy & Sell (merged: marketplace + business_broker)
 * 6. support - General help, customer service
 * 7. sales_cold_caller - Sales/Marketing outreach
 * 
 * DEPRECATED (merged into buy_sell):
 * - marketplace
 * - business_broker
 */

import type { BaseAgent } from './base-agent.ts';
import { WaiterAgent } from '../agents/waiter-agent.ts';
import { SupportAgent } from '../agents/support-agent.ts';
import { FarmerAgent } from '../agents/farmer-agent.ts';
import { JobsAgent } from '../agents/jobs-agent.ts';
import { PropertyAgent } from '../agents/property-agent.ts';
import { BuyAndSellAgent } from '../agents/buy-and-sell-agent.ts';

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
    this.register(new BuyAndSellAgent());
    // RidesAgent and InsuranceAgent removed - replaced with WhatsApp workflows
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
    
    // Support Agent (now also handles rides and insurance routing via workflows)
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
    
    // Buy & Sell Agent (merged: marketplace + business_broker)
    this.intentMapping.set('buy', 'buy_sell_agent');
    this.intentMapping.set('sell', 'buy_sell_agent');
    this.intentMapping.set('product', 'buy_sell_agent');
    this.intentMapping.set('shop', 'buy_sell_agent');
    this.intentMapping.set('store', 'buy_sell_agent');
    this.intentMapping.set('purchase', 'buy_sell_agent');
    this.intentMapping.set('selling', 'buy_sell_agent');
    this.intentMapping.set('buying', 'buy_sell_agent');
    this.intentMapping.set('market', 'buy_sell_agent');
    this.intentMapping.set('item', 'buy_sell_agent');
    this.intentMapping.set('goods', 'buy_sell_agent');
    this.intentMapping.set('trade', 'buy_sell_agent');
    this.intentMapping.set('merchant', 'buy_sell_agent');
    this.intentMapping.set('business', 'buy_sell_agent');
    this.intentMapping.set('service', 'buy_sell_agent');
    this.intentMapping.set('company', 'buy_sell_agent');
    this.intentMapping.set('enterprise', 'buy_sell_agent');
    this.intentMapping.set('startup', 'buy_sell_agent');
    this.intentMapping.set('venture', 'buy_sell_agent');
    this.intentMapping.set('broker', 'buy_sell_agent');
    this.intentMapping.set('investment', 'buy_sell_agent');
    this.intentMapping.set('partner', 'buy_sell_agent');
    this.intentMapping.set('opportunity', 'buy_sell_agent');
    this.intentMapping.set('marketplace', 'buy_sell_agent');
    this.intentMapping.set('shopping', 'buy_sell_agent');
    
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
    this.intentMapping.set('buy', 'buy_and_sell_agent');
    this.intentMapping.set('sell', 'buy_and_sell_agent');
    this.intentMapping.set('product', 'buy_and_sell_agent');
    this.intentMapping.set('shop', 'buy_and_sell_agent');
    this.intentMapping.set('store', 'buy_and_sell_agent');
    this.intentMapping.set('purchase', 'buy_and_sell_agent');
    this.intentMapping.set('selling', 'buy_and_sell_agent');
    this.intentMapping.set('buying', 'buy_and_sell_agent');
    this.intentMapping.set('market', 'buy_and_sell_agent');
    this.intentMapping.set('item', 'buy_and_sell_agent');
    this.intentMapping.set('goods', 'buy_and_sell_agent');
    this.intentMapping.set('trade', 'buy_and_sell_agent');
    this.intentMapping.set('merchant', 'buy_and_sell_agent');
    this.intentMapping.set('business', 'buy_and_sell_agent');
    this.intentMapping.set('service', 'buy_and_sell_agent');
    this.intentMapping.set('company', 'buy_and_sell_agent');
    this.intentMapping.set('enterprise', 'buy_and_sell_agent');
    this.intentMapping.set('startup', 'buy_and_sell_agent');
    this.intentMapping.set('venture', 'buy_and_sell_agent');
    this.intentMapping.set('broker', 'buy_and_sell_agent');
    this.intentMapping.set('investment', 'buy_and_sell_agent');
    this.intentMapping.set('partner', 'buy_and_sell_agent');
    this.intentMapping.set('opportunity', 'buy_and_sell_agent');
    this.intentMapping.set('marketplace', 'buy_and_sell_agent');
    this.intentMapping.set('shopping', 'buy_and_sell_agent');
    
    // Rides intents - route to support (handled via WhatsApp workflows)
    this.intentMapping.set('rides', 'support_agent');
    this.intentMapping.set('ride', 'support_agent');
    this.intentMapping.set('driver', 'support_agent');
    this.intentMapping.set('passenger', 'support_agent');
    this.intentMapping.set('transport', 'support_agent');
    this.intentMapping.set('taxi', 'support_agent');
    this.intentMapping.set('moto', 'support_agent');
    
    // Insurance intents - route to support (handled via WhatsApp workflows)
    this.intentMapping.set('insurance', 'support_agent');
    this.intentMapping.set('insure', 'support_agent');
    this.intentMapping.set('policy', 'support_agent');
    this.intentMapping.set('certificate', 'support_agent');
    this.intentMapping.set('carte_jaune', 'support_agent');
    this.intentMapping.set('claim', 'support_agent');
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
    // Handle legacy agent types
    if (type === 'business_broker_agent' || type === 'marketplace_agent' || type === 'buy_and_sell_agent') {
      type = 'buy_sell_agent';
    }
    // Handle deleted agents - route to support
    if (type === 'rides_agent' || type === 'insurance_agent') {
      type = 'support_agent';
    }
    
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
