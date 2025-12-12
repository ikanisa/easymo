/**
 * Context Types
 * Shared context types used across all services
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import type { Language, ServiceName } from "../config/constants.ts";

// ============================================================================
// ROUTER CONTEXT
// ============================================================================

/**
 * Base context available in all handlers
 */
export type BaseContext = {
  /** Supabase client instance */
  supabase: SupabaseClient;
  /** WhatsApp user phone number (E.164 format) */
  from: string;
  /** User's profile ID (if exists) */
  profileId?: string;
  /** User's preferred language */
  locale: Language;
};

/**
 * Extended context with request metadata
 */
export type RouterContext = BaseContext & {
  /** Unique request ID */
  requestId: string;
  /** Correlation ID for distributed tracing */
  correlationId: string;
  /** Originating service */
  service: ServiceName;
  /** Request timestamp */
  timestamp: Date;
};

/**
 * Handler context with state
 */
export type HandlerContext<TState = unknown> = RouterContext & {
  /** Current user state */
  state: UserState<TState>;
};

// ============================================================================
// USER STATE
// ============================================================================

/**
 * User state structure
 */
export type UserState<TData = unknown> = {
  /** State key identifier */
  key: string;
  /** State data */
  data: TData;
  /** When state was created */
  createdAt?: string;
  /** When state expires */
  expiresAt?: string;
};

/**
 * State update payload
 */
export type StateUpdate<TData = unknown> = {
  key: string;
  data: TData;
  ttlSeconds?: number;
};

// ============================================================================
// HANDLER TYPES
// ============================================================================

/**
 * Handler function signature
 */
export type Handler<TContext = RouterContext> = (
  ctx: TContext
) => Promise<HandlerResult>;

/**
 * Handler result
 */
export type HandlerResult = {
  /** Whether the message was handled */
  handled: boolean;
  /** Optional response to send */
  response?: unknown;
  /** Optional error */
  error?: Error;
};

/**
 * Middleware function signature
 */
export type Middleware<TContext = RouterContext> = (
  ctx: TContext,
  next: () => Promise<HandlerResult>
) => Promise<HandlerResult>;

// ============================================================================
// USER PROFILE
// ============================================================================

/**
 * User profile structure
 */
export type UserProfile = {
  user_id: string;
  whatsapp_e164: string;
  full_name?: string | null;
  email?: string | null;
  language: Language;
  country_code?: string | null;
  role?: string | null;
  created_at: string;
  updated_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

// ============================================================================
// LOCATION
// ============================================================================

/**
 * Geographic coordinates
 */
export type Coordinates = {
  lat: number;
  lng: number;
};

/**
 * Location with metadata
 */
export type Location = Coordinates & {
  name?: string;
  address?: string;
  capturedAt?: string;
};

/**
 * Saved location (favorite)
 */
export type SavedLocation = Location & {
  id: string;
  label: string;
  userId: string;
};
