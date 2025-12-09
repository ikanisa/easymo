/**
 * Common Agent Session Types
 *
 * Implements C1: Common agent session model
 * Every agent session should track standard fields for consistency.
 *
 * @see docs/GROUND_RULES.md - Observability requirements
 */

/**
 * Agent types supported in the system
 */
export type AgentType =
  | "waiter"
  | "real_estate"
  | "mobility"
  | "jobs"
  | "insurance"
  | "marketplace"
  | "farmer"
  | "support"
  | "call_center";

/**
 * Entry source - how the user started the agent session
 */
export type EntrySource =
  | "home_tile"
  | "qr"
  | "deep_link"
  | "pwa"
  | "whatsapp_direct"
  | "voice"
  | "api";

/**
 * Common agent session context
 * All agent-specific contexts should extend this base
 */
export interface BaseAgentSessionContext {
  /** Type of agent */
  agentType: AgentType;
  /** How the user entered the agent */
  entrySource: EntrySource;
  /** User ID from profiles table */
  userId: string;
  /** Organization ID (for vendor/agency/bar context) */
  orgId: string | null;
  /** Last known user location */
  location: {
    lat: number;
    lng: number;
    capturedAt: string;
  } | null;
  /** User's preferred language */
  locale: string;
  /** Session started at */
  startedAt: string;
  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Agent session state
 */
export interface AgentSession<TContext extends BaseAgentSessionContext = BaseAgentSessionContext> {
  /** Session ID */
  id: string;
  /** Current state key */
  stateKey: string;
  /** Session context */
  context: TContext;
  /** When session was created */
  createdAt: string;
  /** When session expires */
  expiresAt: string;
}

/**
 * Agent message for logging
 * Implements C2: Shared logging tables
 */
export interface AgentMessage {
  /** Message ID */
  id?: string;
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agentType: AgentType;
  /** Message direction */
  direction: "inbound" | "outbound";
  /** Message type */
  messageType: "text" | "interactive" | "location" | "image" | "document" | "audio" | "video";
  /** Message content (sanitized) */
  content: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Agent event for logging
 * Implements C2: Shared logging tables
 */
export interface AgentEvent {
  /** Event ID */
  id?: string;
  /** Session ID */
  sessionId: string;
  /** Agent type */
  agentType: AgentType;
  /** Event type (e.g., "venue_resolved", "property_viewing_scheduled", "order_created") */
  eventType: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: string;
}

/**
 * Create a new agent session context
 */
export function createBaseAgentContext(
  agentType: AgentType,
  userId: string,
  entrySource: EntrySource = "whatsapp_direct",
  locale = "en"
): BaseAgentSessionContext {
  const now = new Date().toISOString();
  return {
    agentType,
    entrySource,
    userId,
    orgId: null,
    location: null,
    locale,
    startedAt: now,
    lastActivityAt: now,
  };
}

/**
 * Standard agent state keys that all agents should support
 */
export const COMMON_STATE_KEYS = {
  /** Initial/home state */
  HOME: "home",
  /** Awaiting location share */
  AWAITING_LOCATION: "awaiting_location",
  /** General error state */
  ERROR: "error",
} as const;
