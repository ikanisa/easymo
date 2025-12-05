/**
 * Call Capability Types
 * 
 * Type definitions for unified call handling across all easyMO agents.
 * Based on patterns from google/adk-go and microsoft/call-center-ai.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type CallChannel = 'phone' | 'whatsapp_call' | 'whatsapp_voice_note';

export type CallDirection = 'inbound' | 'outbound';

export type CallStatus = 'initiated' | 'in_progress' | 'completed' | 'abandoned' | 'failed';

export type TranscriptRole = 'user' | 'assistant' | 'system';

export type CallSentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export type CallDisposition = 
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'CALL_BACK'
  | 'NO_ANSWER'
  | 'DO_NOT_CALL'
  | 'WRONG_NUMBER'
  | 'VOICEMAIL';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Main call record
 */
export interface Call {
  id: string;
  user_id?: string;
  agent_id: string;
  channel: CallChannel;
  direction: CallDirection;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  status: CallStatus;
  provider_call_id?: string;
  from_number?: string;
  to_number?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Transcript chunk during call
 */
export interface TranscriptChunk {
  id?: number;
  call_id: string;
  seq: number;
  role: TranscriptRole;
  started_at: string;
  ended_at?: string;
  text: string;
  confidence?: number;
  raw?: Record<string, unknown>;
  created_at?: string;
}

/**
 * Call summary with structured entities
 */
export interface CallSummary {
  call_id: string;
  summary: string;
  language?: string;
  main_intent?: string;
  sentiment?: CallSentiment;
  entities: Record<string, unknown>;
  next_actions: NextAction[];
  duration_seconds?: number;
  word_count?: number;
  created_at?: string;
  updated_at?: string;
}

/**
 * Recommended follow-up action
 */
export interface NextAction {
  type: 'notify' | 'callback' | 'match' | 'escalate' | 'task';
  priority: 'high' | 'medium' | 'low';
  description: string;
  scheduled_for?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input for creating a new call
 */
export interface CreateCallInput {
  user_id?: string;
  agent_id: string;
  channel: CallChannel;
  direction: CallDirection;
  provider_call_id?: string;
  from_number?: string;
  to_number?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for updating call status
 */
export interface UpdateCallInput {
  call_id: string;
  status?: CallStatus;
  ended_at?: string;
  duration_seconds?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Input for adding a transcript chunk
 */
export interface AddTranscriptInput {
  call_id: string;
  role: TranscriptRole;
  text: string;
  confidence?: number;
  started_at?: string;
  ended_at?: string;
  raw?: Record<string, unknown>;
}

/**
 * Input for saving call summary
 */
export interface SaveSummaryInput {
  call_id: string;
  summary: string;
  language?: string;
  main_intent?: string;
  sentiment?: CallSentiment;
  entities?: Record<string, unknown>;
  next_actions?: NextAction[];
}

// ============================================================================
// DOMAIN INTAKE TYPES
// ============================================================================

/**
 * Jobs call intake data
 */
export interface JobsCallIntake {
  call_id: string;
  mode: 'jobseeker' | 'poster';
  role_title?: string;
  category?: string;
  seniority?: string;
  location_country?: string;
  location_city?: string;
  location_district?: string;
  location_sector?: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  employment_type?: 'full_time' | 'part_time' | 'gig' | 'one_off' | 'internship' | 'freelance';
  remote_preference?: 'onsite' | 'remote' | 'hybrid';
  experience_years?: number;
  skills?: string[];
  certifications?: string[];
  education_level?: string;
  availability_date?: string;
  can_start_immediately?: boolean;
  preferred_contact_method?: string;
  notes?: string;
}

/**
 * Farmers call intake data
 */
export interface FarmersCallIntake {
  call_id: string;
  side: 'farmer' | 'buyer';
  produce_type: string;
  variety?: string;
  quantity?: number;
  unit?: string;
  expected_harvest_date?: string;
  delivery_window_start?: string;
  delivery_window_end?: string;
  location_country?: string;
  location_district?: string;
  location_sector?: string;
  location_cell?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  quality_grade?: string;
  organic?: boolean;
  certifications?: string[];
  payment_preference?: 'wallet' | 'cod' | 'bank_transfer' | 'mobile_money';
  notes?: string;
}

/**
 * Real estate call intake data
 */
export interface RealEstateCallIntake {
  call_id: string;
  side: 'buyer' | 'tenant' | 'owner' | 'landlord';
  transaction_type: 'buy' | 'rent';
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  parking?: boolean;
  parking_spots?: number;
  furnished?: boolean;
  furnished_level?: string;
  size_sqm?: number;
  plot_size_sqm?: number;
  location_country?: string;
  location_city?: string;
  location_district?: string;
  location_sector?: string;
  location_street?: string;
  preferred_neighborhoods?: string[];
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  payment_frequency?: 'monthly' | 'quarterly' | 'yearly' | 'one_time';
  move_in_date?: string;
  stay_duration_months?: number;
  urgency?: 'immediate' | 'flexible' | 'within_month' | 'within_3_months';
  must_haves?: string[];
  nice_to_haves?: string[];
  deal_breakers?: string[];
  notes?: string;
}

// ============================================================================
// SALES/COLD CALLER TYPES
// ============================================================================

/**
 * Claim field definition from campaign schema
 */
export interface ClaimField {
  name: string;
  type: 'text' | 'integer' | 'boolean' | 'date' | 'enum';
  required?: boolean;
  enum_values?: string[];
  description?: string;
}

/**
 * Campaign configuration
 */
export interface CampaignConfig {
  id: string;
  name: string;
  segment: string;
  script_goal: string;
  target_outcome?: string;
  claim_schema: ClaimField[];
  max_attempts: number;
  call_window_start: string;
  call_window_end: string;
  call_window_timezone: string;
  cooldown_minutes: number;
  language: string;
  voice_style?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
}

/**
 * Sales lead data
 */
export interface SalesLead {
  id: string;
  segment?: string;
  business_name?: string;
  contact_name?: string;
  phone_number: string;
  whatsapp_number?: string;
  email?: string;
  category?: string;
  subcategory?: string;
  location_country?: string;
  location_district?: string;
  location_sector?: string;
  location_address?: string;
  tags?: string[];
  source?: string;
  source_id?: string;
  opted_out: boolean;
  opted_out_at?: string;
  opt_out_reason?: string;
  lead_status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost' | 'dormant';
}

/**
 * Call interaction record
 */
export interface CallInteraction {
  id?: string;
  call_id: string;
  lead_id?: string;
  campaign_id?: string;
  disposition: CallDisposition;
  disposition_notes?: string;
  follow_up_at?: string;
  follow_up_notes?: string;
  follow_up_completed?: boolean;
  attempt_number?: number;
  notes?: string;
}

/**
 * Captured claim value
 */
export interface ClaimValue {
  call_id: string;
  key: string;
  value?: string;
  value_type?: string;
  confidence?: number;
  confirmed_by_user?: boolean;
}

// ============================================================================
// MATCHING TYPES
// ============================================================================

/**
 * Match reason/score breakdown
 */
export interface MatchReason {
  field: string;
  score: number;
  reason: string;
}

/**
 * Generic match result
 */
export interface MatchResult {
  id: string;
  intake_call_id: string;
  match_score: number;
  match_reasons: MatchReason[];
  status: string;
  created_at: string;
  expires_at?: string;
}

// ============================================================================
// AGENT IDs
// ============================================================================

export const AGENT_IDS = {
  JOBS: 'jobs_ai',
  FARMERS: 'farmers_ai',
  REAL_ESTATE: 'real_estate_ai',
  SALES: 'sales_ai',
  WAITER: 'waiter_ai',
  GENERAL: 'general_ai',
} as const;

export type AgentId = typeof AGENT_IDS[keyof typeof AGENT_IDS];
