/**
 * Agent Verticals and Type Enums
 * Single source of truth for agent type definitions
 * 
 * Consolidated from:
 * - packages/agents/src/types/verticals.ts
 */

/**
 * EasyMO Service Verticals
 * Defines the business domains covered by the platform
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
 * Updated after marketplace + business_broker merge into buy_and_sell
 */
export type AgentType =
  | 'farmer'           // Farmer AI Agent
  | 'sales_cold_caller' // Sales/Marketing Cold Caller AI Agent
  | 'jobs'             // Jobs AI Agent
  | 'waiter'           // Waiter AI Agent
  | 'real_estate'      // Real Estate AI Agent
  | 'buy_and_sell'     // Buy & Sell AI Agent (unified commerce + business brokerage)
  | 'support';         // Support AI Agent (includes concierge routing)

/**
 * Agent slug type (alias for AgentType for backward compatibility)
 */
export type AgentSlug =
  | 'waiter'
  | 'farmer'
  | 'buy_and_sell'
  | 'real_estate'
  | 'jobs'
  | 'sales_cold_caller'
  | 'support';

/**
 * Agent slugs constant object for runtime access
 */
export const AGENT_SLUGS: Record<string, AgentSlug> = {
  WAITER: 'waiter',
  FARMER: 'farmer',
  BUY_AND_SELL: 'buy_and_sell',
  REAL_ESTATE: 'real_estate',
  JOBS: 'jobs',
  SALES_COLD_CALLER: 'sales_cold_caller',
  SUPPORT: 'support',
} as const;

/**
 * Intent analysis result from classifier
 */
export interface IntentAnalysis {
  agent: AgentType;
  vertical: EasyMOVertical;
  confidence: number;
  isOutOfScope: boolean;
  keywords?: string[];
}

/**
 * Mapping between verticals and their associated agents
 */
export interface VerticalMapping {
  vertical: EasyMOVertical;
  agents: AgentType[];
  priority: number;
}
