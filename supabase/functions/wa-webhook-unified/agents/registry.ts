/**
 * Agent Registry
 * 
 * Central registry for all domain agents.
 * Manages agent instantiation and lookup.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AgentType, AgentDependencies } from "../core/types.ts";
import { BaseAgent } from "./base-agent.ts";

// Import all domain agents
import { SupportAgent } from "./support-agent.ts";
import { CommerceAgent } from "./commerce-agent.ts"; // Unified commerce agent
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
   * Create agent instance
   */
  private createAgent(type: AgentType, correlationId: string): BaseAgent {
    const deps: AgentDependencies = {
      supabase: this.supabase,
      correlationId,
    };

    switch (type) {
      case "support":
        return new SupportAgent(deps);
      
      case "marketplace":
      case "business_broker":
        // Both marketplace and business_broker now use CommerceAgent
        return new CommerceAgent(deps);
      
      case "farmer":
        return new FarmerAgent(deps);
      
      case "waiter":
        return new WaiterAgent(deps);
      
      case "insurance":
        return new InsuranceAgent(deps);
      
      case "rides":
        return new RidesAgent(deps);
      
      case "jobs":
        return new JobsAgent(deps);
      
      case "property":
        return new PropertyAgent(deps);
      
      case "sales":
        return new SalesAgent(deps);

      default:
        // Fallback to support agent
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
