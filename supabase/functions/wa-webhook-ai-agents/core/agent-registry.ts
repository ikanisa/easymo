/**
 * Agent Registry
 * Central registry for all AI agents
 * 
 * Part of Unified AI Agent Architecture
 * Created: 2025-11-27
 */

import type { BaseAgent } from './base-agent.ts';
import { WaiterAgent } from '../agents/waiter-agent.ts';
import { SupportAgent } from '../agents/support-agent.ts';
// TODO: Import other agents as they are migrated
// import { FarmerAgent } from '../agents/farmer-agent.ts';
// import { JobsAgent } from '../agents/jobs-agent.ts';
// import { PropertyAgent } from '../agents/property-agent.ts';
// import { MarketplaceAgent } from '../agents/marketplace-agent.ts';

export class AgentRegistry {
  private agents = new Map<string, BaseAgent>();
  private intentMapping = new Map<string, string>();

  constructor() {
    this.registerAllAgents();
    this.setupIntentMapping();
  }

  /**
   * Register all available agents
   */
  private registerAllAgents(): void {
    // Currently implemented agents
    this.register(new WaiterAgent());
    this.register(new SupportAgent());
    
    // TODO: Register as implemented
    // this.register(new FarmerAgent());
    // this.register(new JobsAgent());
    // this.register(new PropertyAgent());
    // this.register(new MarketplaceAgent());
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
    
    // Support Agent
    this.intentMapping.set('support', 'support');
    this.intentMapping.set('help', 'support');
    this.intentMapping.set('question', 'support');
    this.intentMapping.set('issue', 'support');
    
    // TODO: Add mappings for other agents
    // Farmer
    // this.intentMapping.set('farmer', 'farmer_agent');
    // this.intentMapping.set('agriculture', 'farmer_agent');
    // this.intentMapping.set('crop', 'farmer_agent');
    
    // Jobs
    // this.intentMapping.set('jobs', 'jobs_agent');
    // this.intentMapping.set('employment', 'jobs_agent');
    // this.intentMapping.set('hire', 'jobs_agent');
    
    // Property
    // this.intentMapping.set('property', 'real_estate_agent');
    // this.intentMapping.set('rental', 'real_estate_agent');
    // this.intentMapping.set('house', 'real_estate_agent');
    
    // Marketplace
    // this.intentMapping.set('marketplace', 'business_broker_agent');
    // this.intentMapping.set('buy', 'business_broker_agent');
    // this.intentMapping.set('sell', 'business_broker_agent');
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
      return this.agents.get('support') || this.agents.values().next().value;
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
      return this.getAgent('support');
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
