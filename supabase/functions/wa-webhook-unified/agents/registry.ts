/**
 * Agent Registry
 * 
 * Central registry for all domain agents.
 * Manages agent instantiation and lookup.
 * 
 * OFFICIAL AGENTS (10 production agents matching agent_registry database):
 * 1. farmer - Farmer AI Agent
 * 2. insurance - Insurance AI Agent
 * 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent
 * 4. rides - Rides AI Agent
 * 5. jobs - Jobs AI Agent
 * 6. waiter - Waiter AI Agent
 * 7. real_estate - Real Estate AI Agent
 * 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop)
 * 9. support - Support AI Agent (includes concierge routing)
 * 10. business_broker - Business Broker AI Agent (includes legal intake)
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentType, AgentDependencies } from "../core/types.ts";
import { BaseAgent } from "./base-agent.ts";

// Import all domain agents
import { SupportAgent } from "./support-agent.ts";
import { CommerceAgent } from "./commerce-agent.ts"; // Unified commerce agent (marketplace)
import { FarmerAgent } from "./farmer-agent.ts";
import { WaiterAgent } from "./waiter-agent.ts";
import { InsuranceAgent } from "./insurance-agent.ts";
import { RidesAgent } from "./rides-agent.ts";
import { JobsAgent } from "./jobs-agent.ts";
import { PropertyAgent } from "./property-agent.ts";
import { SalesAgent } from "./sales-agent.ts";

export class AgentRegistry {
  private agents: Map<AgentType, BaseAgent> = new Map();

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get agent instance by type
   * Lazy-loads agents on first access
   */
  getAgent(type: AgentType, correlationId: string): BaseAgent {
    if (!this.agents.has(type)) {
      this.agents.set(type, this.createAgent(type, correlationId));
    }
    return this.agents.get(type)!;
  }

  /**
   * Create agent instance based on the 10 official agent types
   */
  private createAgent(type: AgentType, correlationId: string): BaseAgent {
    const deps: AgentDependencies = {
      supabase: this.supabase,
      correlationId,
    };

    switch (type) {
      // 1. Farmer AI Agent
      case "farmer":
        return new FarmerAgent(deps);
      
      // 2. Insurance AI Agent
      case "insurance":
        return new InsuranceAgent(deps);
      
      // 3. Sales/Marketing Cold Caller AI Agent
      case "sales_cold_caller":
        return new SalesAgent(deps);
      
      // 4. Rides AI Agent
      case "rides":
        return new RidesAgent(deps);
      
      // 5. Jobs AI Agent
      case "jobs":
        return new JobsAgent(deps);
      
      // 6. Waiter AI Agent
      case "waiter":
        return new WaiterAgent(deps);
      
      // 7. Real Estate AI Agent (was property-agent)
      case "real_estate":
        return new PropertyAgent(deps);
      
      // 8. Marketplace AI Agent (includes pharmacy, hardware, shop)
      case "marketplace":
        return new CommerceAgent(deps);
      
      // 9. Support AI Agent (includes concierge routing)
      case "support":
        return new SupportAgent(deps);
      
      // 10. Business Broker AI Agent (includes legal intake)
      case "business_broker":
        return new CommerceAgent(deps); // Uses commerce agent for business discovery

      default:
        // Fallback to support agent for any unknown types
        console.warn(`Agent type ${type} not implemented, using support agent`);
        return new SupportAgent(deps);
    }
  }

  /**
   * Clear agent cache (useful for testing)
   */
  clearCache(): void {
    this.agents.clear();
  }
}
