/**
 * EasyMO Vertical Types
 * 
 * Type definitions for EasyMO service verticals and intent classification.
 */

export type EasyMOVertical = 
  | 'mobility'
  | 'commerce'
  | 'hospitality'
  | 'insurance'
  | 'property'
  | 'jobs'
  | 'farming'
  | 'marketing'
  | 'support'
  | 'business'
  | 'none'; // Out of scope

/**
 * Official 10 agents matching production agent_registry database.
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'insurance'        // Insurance AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
  | 'rides'            // Rides AI Agent
  | 'jobs'             // Jobs AI Agent
  | 'waiter'           // Waiter AI Agent
  | 'real_estate'      // Real Estate AI Agent
  | 'marketplace'      // Marketplace AI Agent (includes pharmacy, hardware, shop)
  | 'support'          // Support AI Agent (includes concierge routing)
  | 'business_broker'; // Business Broker AI Agent (includes legal intake)

export interface IntentAnalysis {
  agent: AgentType;
  vertical: EasyMOVertical;
  confidence: number;
  isOutOfScope: boolean;
  keywords?: string[];
}

export interface VerticalMapping {
  vertical: EasyMOVertical;
  agents: AgentType[];
  priority: number;
}
