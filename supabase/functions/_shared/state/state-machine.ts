/**
 * Typed State Machine
 * Provides type-safe state transitions with validation
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { STATE_KEYS, TIMEOUTS } from "../config/constants.ts";
import { logStructuredEvent } from "../observability.ts";

// ============================================================================
// TYPES
// ============================================================================

/**
 * State definition with allowed transitions
 */
export type StateDefinition<TData = unknown> = {
  key: string;
  data: TData;
  allowedTransitions: string[];
  ttlSeconds?: number;
};

/**
 * State transition result
 */
export type TransitionResult = {
  success: boolean;
  previousState?: string;
  newState: string;
  error?: string;
};

/**
 * State machine configuration
 */
export type StateMachineConfig = {
  /** Default TTL for states */
  defaultTtl: number;
  /** Whether to validate transitions */
  validateTransitions: boolean;
  /** Whether to log transitions */
  logTransitions: boolean;
};

// ============================================================================
// STATE TRANSITION DEFINITIONS
// ============================================================================

/**
 * Valid state transitions map
 */
export const STATE_TRANSITIONS: Record<string, string[]> = {
  // Home can go anywhere
  [STATE_KEYS.HOME]: Object.values(STATE_KEYS),
  
  // Profile flow
  [STATE_KEYS.PROFILE_EDIT_NAME]: [STATE_KEYS.HOME, STATE_KEYS.PROFILE_EDIT_EMAIL],
  [STATE_KEYS.PROFILE_EDIT_EMAIL]: [STATE_KEYS.HOME, STATE_KEYS.PROFILE_EDIT_NAME],
  
  // Wallet transfer flow
  [STATE_KEYS.WALLET_TRANSFER_RECIPIENT]: [STATE_KEYS.HOME, STATE_KEYS.WALLET_TRANSFER_AMOUNT],
  [STATE_KEYS.WALLET_TRANSFER_AMOUNT]: [STATE_KEYS.HOME, STATE_KEYS.WALLET_TRANSFER_RECIPIENT, STATE_KEYS.WALLET_TRANSFER_CONFIRM],
  [STATE_KEYS.WALLET_TRANSFER_CONFIRM]: [STATE_KEYS.HOME, STATE_KEYS.WALLET_TRANSFER_AMOUNT],
  
  // Mobility nearby flow
  [STATE_KEYS.MOBILITY_MENU]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_NEARBY_SELECT, STATE_KEYS.SCHEDULE_ROLE, STATE_KEYS.GO_ONLINE_PROMPT],
  [STATE_KEYS.MOBILITY_NEARBY_SELECT]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_MENU, STATE_KEYS.MOBILITY_NEARBY_LOCATION],
  [STATE_KEYS.MOBILITY_NEARBY_LOCATION]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_NEARBY_SELECT, STATE_KEYS.MOBILITY_NEARBY_RESULTS],
  [STATE_KEYS.MOBILITY_NEARBY_RESULTS]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_MENU, STATE_KEYS.MOBILITY_NEARBY_LOCATION],
  
  // Schedule flow
  [STATE_KEYS.SCHEDULE_ROLE]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_MENU, STATE_KEYS.SCHEDULE_VEHICLE],
  [STATE_KEYS.SCHEDULE_VEHICLE]: [STATE_KEYS.HOME, STATE_KEYS.SCHEDULE_ROLE, STATE_KEYS.SCHEDULE_LOCATION],
  [STATE_KEYS.SCHEDULE_LOCATION]: [STATE_KEYS.HOME, STATE_KEYS.SCHEDULE_VEHICLE, STATE_KEYS.SCHEDULE_DROPOFF],
  [STATE_KEYS.SCHEDULE_DROPOFF]: [STATE_KEYS.HOME, STATE_KEYS.SCHEDULE_LOCATION, STATE_KEYS.SCHEDULE_TIME],
  [STATE_KEYS.SCHEDULE_TIME]: [STATE_KEYS.HOME, STATE_KEYS.SCHEDULE_DROPOFF],
  
  // Go online flow
  [STATE_KEYS.GO_ONLINE_PROMPT]: [STATE_KEYS.HOME, STATE_KEYS.MOBILITY_MENU],
  
  // Trip flow
  [STATE_KEYS.TRIP_IN_PROGRESS]: [STATE_KEYS.HOME],
  
  // Insurance flow
  [STATE_KEYS.INSURANCE_MENU]: [STATE_KEYS.HOME, STATE_KEYS.INSURANCE_UPLOAD, STATE_KEYS.CLAIM_TYPE],
  [STATE_KEYS.INSURANCE_UPLOAD]: [STATE_KEYS.HOME, STATE_KEYS.INSURANCE_MENU],
  
  // Claims flow
  [STATE_KEYS.CLAIM_TYPE]: [STATE_KEYS.HOME, STATE_KEYS.INSURANCE_MENU, STATE_KEYS.CLAIM_DESCRIPTION],
  [STATE_KEYS.CLAIM_DESCRIPTION]: [STATE_KEYS.HOME, STATE_KEYS.CLAIM_TYPE, STATE_KEYS.CLAIM_DOCUMENTS],
  [STATE_KEYS.CLAIM_DOCUMENTS]: [STATE_KEYS.HOME, STATE_KEYS.CLAIM_DESCRIPTION, STATE_KEYS.CLAIM_SUBMITTED],
  [STATE_KEYS.CLAIM_SUBMITTED]: [STATE_KEYS.HOME],
};

// ============================================================================
// STATE MACHINE CLASS
// ============================================================================

export class StateMachine {
  private supabase: SupabaseClient;
  private config: StateMachineConfig;

  constructor(supabase: SupabaseClient, config: Partial<StateMachineConfig> = {}) {
    this.supabase = supabase;
    this.config = {
      defaultTtl: config.defaultTtl ?? TIMEOUTS.STATE_TTL_SECONDS,
      validateTransitions: config.validateTransitions ?? true,
      logTransitions: config.logTransitions ?? true,
    };
  }

  /**
   * Get current state for user
   */
  async getState<TData = unknown>(userId: string): Promise<StateDefinition<TData> | null> {
    const { data, error } = await this.supabase
      .from("user_state")
      .select("key, data, expires_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await this.clearState(userId);
      return null;
    }

    return {
      key: data.key,
      data: data.data as TData,
      allowedTransitions: STATE_TRANSITIONS[data.key] || [STATE_KEYS.HOME],
    };
  }

  /**
   * Transition to new state
   */
  async transition<TData = unknown>(
    userId: string,
    newState: string,
    data: TData,
    options: { ttlSeconds?: number; force?: boolean } = {}
  ): Promise<TransitionResult> {
    const currentState = await this.getState(userId);
    const previousStateKey = currentState?.key || STATE_KEYS.HOME;

    // Validate transition
    if (this.config.validateTransitions && !options.force) {
      const allowedTransitions = STATE_TRANSITIONS[previousStateKey] || [STATE_KEYS.HOME];
      if (!allowedTransitions.includes(newState) && newState !== STATE_KEYS.HOME) {
        if (this.config.logTransitions) {
          logStructuredEvent("STATE_TRANSITION_INVALID", {
            userId,
            from: previousStateKey,
            to: newState,
            allowed: allowedTransitions,
          }, "warn");
        }
        return {
          success: false,
          previousState: previousStateKey,
          newState,
          error: `Invalid transition from ${previousStateKey} to ${newState}`,
        };
      }
    }

    // Calculate expiry
    const ttl = options.ttlSeconds ?? this.config.defaultTtl;
    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

    // Upsert state
    const { error } = await this.supabase
      .from("user_state")
      .upsert({
        user_id: userId,
        key: newState,
        data,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      logStructuredEvent("STATE_TRANSITION_ERROR", {
        userId,
        from: previousStateKey,
        to: newState,
        error: error.message,
      }, "error");
      return {
        success: false,
        previousState: previousStateKey,
        newState,
        error: error.message,
      };
    }

    if (this.config.logTransitions) {
      logStructuredEvent("STATE_TRANSITION", {
        userId,
        from: previousStateKey,
        to: newState,
      }, "debug");
    }

    return {
      success: true,
      previousState: previousStateKey,
      newState,
    };
  }

  /**
   * Clear user state (return to home)
   */
  async clearState(userId: string): Promise<void> {
    await this.supabase
      .from("user_state")
      .delete()
      .eq("user_id", userId);

    if (this.config.logTransitions) {
      logStructuredEvent("STATE_CLEARED", { userId }, "debug");
    }
  }

  /**
   * Check if transition is allowed
   */
  isTransitionAllowed(fromState: string, toState: string): boolean {
    if (toState === STATE_KEYS.HOME) return true;
    const allowed = STATE_TRANSITIONS[fromState] || [STATE_KEYS.HOME];
    return allowed.includes(toState);
  }

  /**
   * Get allowed transitions for a state
   */
  getAllowedTransitions(state: string): string[] {
    return STATE_TRANSITIONS[state] || [STATE_KEYS.HOME];
  }
}

/**
 * Create state machine instance
 */
export function createStateMachine(
  supabase: SupabaseClient,
  config?: Partial<StateMachineConfig>
): StateMachine {
  return new StateMachine(supabase, config);
}
