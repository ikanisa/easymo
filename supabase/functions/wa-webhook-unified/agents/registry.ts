/**
 * Agent Registry
 * 
 * Central registry for all domain agents.
 * Manages agent instantiation and lookup.
 * 
 * OFFICIAL AGENTS (11 production agents):
 * 1. farmer - Farmer AI Agent
 * 2. insurance - Insurance AI Agent
 * 3. sales_cold_caller - Sales/Marketing Cold Caller AI Agent
 * 4. rides - Rides AI Agent
 * 5. jobs - Jobs AI Agent
 * 6. waiter - Waiter AI Agent
 * 7. real_estate - Real Estate AI Agent
 * 8. marketplace - Marketplace AI Agent (includes pharmacy, hardware, shop)
 * 9. support - Support AI Agent (includes concierge routing)
 * 10. business_broker - Business Broker AI Agent (legacy, aliases to buy_sell)
 * 11. buy_sell - Buy & Sell Agent (consolidates marketplace + business_broker)
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

// Import consolidated agents (from wa-webhook-ai-agents migration)
import { BuySellAgent } from "./buy-sell.ts";

export class AgentRegistry {
  private agents: Map<AgentType, BaseAgent> = new Map();

  /**
   * Map legacy agent types to new consolidated agents
   */
  private static readonly ALIAS_MAP: Record<string, AgentType> = {
    "business_broker": "buy_sell",
    "business_broker_agent": "buy_sell",
    "marketplace": "buy_sell",
    "marketplace_agent": "buy_sell",
  };

  constructor(private supabase: SupabaseClient) {}

  /**
   * Get agent instance by type
   * Lazy-loads agents on first access
   * Supports legacy agent type aliases
   */
  getAgent(type: AgentType | string, correlationId: string): BaseAgent {
    // Resolve aliases to canonical types
    const resolvedType = AgentRegistry.ALIAS_MAP[type] ?? type as AgentType;
    
    if (!this.agents.has(resolvedType)) {
      this.agents.set(resolvedType, this.createAgent(resolvedType, correlationId));
    }
    return this.agents.get(resolvedType)!;
  }

  /**
   * Create agent instance based on the 11 official agent types
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
      
      // 8. Marketplace AI Agent (legacy - now aliases to buy_sell)
      case "marketplace":
        return new BuySellAgent(deps);
      
      // 9. Support AI Agent (includes concierge routing)
      case "support":
        return new SupportAgent(deps);
      
      // 10. Business Broker AI Agent (legacy - now aliases to buy_sell)
      case "business_broker":
        return new BuySellAgent(deps);
      
      // 11. Buy & Sell Agent (consolidated marketplace + business_broker)
      case "buy_sell":
        return new BuySellAgent(deps);

      default:
        // Fallback to support agent for any unknown types
        console.warn(`Agent type ${type} not implemented, using support agent`);
        return new SupportAgent(deps);
    }
  }

  /**
   * List all available agents with their metadata
   */
  listAgents(): Array<{
    type: AgentType;
    name: string;
    description: string;
    consolidates?: string[];
  }> {
    return [
      { type: "waiter", name: "Waiter Agent", description: "Restaurant and bar service" },
      { type: "farmer", name: "Farmer Agent", description: "Agricultural support and market" },
      { type: "support", name: "Support Agent", description: "General help and navigation" },
      { type: "sales_cold_caller", name: "Sales Agent", description: "Sales and customer management" },
      { 
        type: "buy_sell", 
        name: "Buy & Sell Agent", 
        description: "Marketplace transactions and business brokerage",
        consolidates: ["business_broker", "marketplace"]
      },
      { type: "jobs", name: "Jobs Agent", description: "Job search and recruitment" },
      { type: "real_estate", name: "Property Agent", description: "Real estate and rentals" },
      { type: "rides", name: "Rides Agent", description: "Transport and ride-sharing" },
      { type: "insurance", name: "Insurance Agent", description: "Insurance policies and claims" },
    ];
  }

  /**
   * Clear agent cache (useful for testing)
   */
  clearCache(): void {
    this.agents.clear();
  }
}
