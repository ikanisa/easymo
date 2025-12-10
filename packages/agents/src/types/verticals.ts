/**
 * @deprecated Import from '@easymo/types' or '@easymo/types/ai-agents' instead.
 * This file will be removed in the next major version.
 * 
 * Migration guide:
 * - import { EasyMOVertical, AgentType, IntentAnalysis } from '@easymo/types/ai-agents'
 * - Or: import type { AgentType } from '@easymo/types'
 */

/**
 * EasyMO Vertical Types
 * 
 * Type definitions for EasyMO service verticals and intent classification.
 */

export type EasyMOVertical = 
  | 'mobility'
  | 'commerce'
  | 'hospitality'
  | 'property'
  | 'jobs'
  | 'farming'
  | 'marketing'
  | 'support'
  | 'business'
  | 'none'; // Out of scope

/**
 * Official 7 agents matching production agent_registry database.
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
  | 'jobs'             // Jobs AI Agent
  | 'waiter'           // Waiter AI Agent
  | 'real_estate'      // Real Estate AI Agent
  | 'buy_and_sell'     // Buy & Sell AI Agent (unified commerce + business brokerage)
  | 'support';         // Support AI Agent (includes concierge routing)

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
