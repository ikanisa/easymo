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
  | 'legal'
  | 'jobs'
  | 'farming'
  | 'marketing'
  | 'sora_video'
  | 'payments'
  | 'support'
  | 'none'; // Out of scope

export type AgentType =
  | 'booking'
  | 'redemption'
  | 'real_estate'
  | 'jobs'
  | 'farmer'
  | 'sales'
  | 'support'
  | 'general_broker'
  | 'triage';

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
