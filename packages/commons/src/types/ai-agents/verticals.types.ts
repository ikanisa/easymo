/**
 * Agent Verticals and Type Enums
 * Single source of truth for agent type definitions
 * 
 * Consolidated from:
 * - packages/agents/src/types/verticals.ts
 * 
 * Updated: Rwanda-only, commerce-focused agents
 */

/**
 * EasyMO Service Verticals
 * Defines the business domains covered by the platform
 */
export type EasyMOVertical =
  | 'commerce'
  | 'support'
  | 'marketing'
  | 'none'; // Out of scope

/**
 * Active agents in production
 * Simplified to Rwanda commerce focus
 */
export type AgentType =
  | 'buy_and_sell'     // Buy & Sell AI Agent (unified commerce)
  | 'support';         // Support AI Agent (includes concierge routing)

/**
 * Agent slug type (alias for AgentType for backward compatibility)
 */
export type AgentSlug =
  | 'buy_and_sell'
  | 'support';

/**
 * Agent slugs constant object for runtime access
 */
export const AGENT_SLUGS: Record<string, AgentSlug> = {
  BUY_AND_SELL: 'buy_and_sell',
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
