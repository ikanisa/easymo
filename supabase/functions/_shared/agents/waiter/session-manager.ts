/**
 * Waiter AI Agent - Session Manager
 *
 * Handles state management for the Waiter AI agent.
 * Implements W-Fix 1: Explicit Waiter state machine
 * Implements W-Fix 3: Unify QR and home entry flows
 *
 * @see docs/GROUND_RULES.md - Observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric, maskPII } from "../../observability.ts";
import {
  WAITER_STATE_KEYS,
  WAITER_STATE_TRANSITIONS,
  createDefaultWaiterContext,
  type WaiterStateKey,
  type WaiterSessionContext,
  type WaiterState,
  type WaiterEntryMode,
} from "./types.ts";
import { getBarInfo } from "./discovery-tools.ts";

const STATE_TTL_SECONDS = 3600; // 1 hour

/**
 * Get current waiter session state
 */
export async function getWaiterState(
  supabase: SupabaseClient,
  userId: string
): Promise<WaiterState | null> {
  try {
    const { data, error } = await supabase
      .from("user_state")
      .select("key, data, created_at, expires_at")
      .eq("user_id", userId)
      .in("key", Object.values(WAITER_STATE_KEYS))
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await clearWaiterState(supabase, userId);
      return null;
    }

    return {
      key: data.key as WaiterStateKey,
      data: data.data as WaiterSessionContext,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    await logStructuredEvent("WAITER_STATE_GET_ERROR", {
      userId: maskPII(userId),
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return null;
  }
}

/**
 * Set waiter session state
 */
export async function setWaiterState(
  supabase: SupabaseClient,
  userId: string,
  key: WaiterStateKey,
  context: WaiterSessionContext
): Promise<boolean> {
  try {
    const expiresAt = new Date(Date.now() + STATE_TTL_SECONDS * 1000).toISOString();

    const { error } = await supabase
      .from("user_state")
      .upsert({
        user_id: userId,
        key,
        data: context,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (error) {
      await logStructuredEvent("WAITER_STATE_SET_ERROR", {
        userId: maskPII(userId),
        key,
        error: error.message,
      }, "error");
      return false;
    }

    await logStructuredEvent("WAITER_STATE_SET", {
      userId: maskPII(userId),
      key,
      venueId: context.venueId,
      entryMode: context.entryMode,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("WAITER_STATE_SET_EXCEPTION", {
      userId: maskPII(userId),
      key,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Clear waiter session state
 */
export async function clearWaiterState(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_state")
      .delete()
      .eq("user_id", userId)
      .in("key", Object.values(WAITER_STATE_KEYS));

    if (error) {
      await logStructuredEvent("WAITER_STATE_CLEAR_ERROR", {
        userId: maskPII(userId),
        error: error.message,
      }, "error");
      return false;
    }

    await logStructuredEvent("WAITER_STATE_CLEARED", {
      userId: maskPII(userId),
    });

    return true;
  } catch (error) {
    await logStructuredEvent("WAITER_STATE_CLEAR_EXCEPTION", {
      userId: maskPII(userId),
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Transition waiter state
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param newKey - New state key
 * @param contextUpdates - Updates to apply to the context
 * @param force - Force transition even if not in allowed transitions
 */
export async function transitionWaiterState(
  supabase: SupabaseClient,
  userId: string,
  newKey: WaiterStateKey,
  contextUpdates: Partial<WaiterSessionContext> = {},
  force = false
): Promise<{ success: boolean; state: WaiterState | null; error?: string }> {
  const currentState = await getWaiterState(supabase, userId);
  const currentKey = currentState?.key || WAITER_STATE_KEYS.NO_VENUE_SELECTED;

  // Validate transition
  if (!force) {
    const allowedTransitions = WAITER_STATE_TRANSITIONS[currentKey] || [];
    if (!allowedTransitions.includes(newKey) && newKey !== WAITER_STATE_KEYS.NO_VENUE_SELECTED) {
      await logStructuredEvent("WAITER_STATE_TRANSITION_INVALID", {
        userId: maskPII(userId),
        from: currentKey,
        to: newKey,
        allowed: allowedTransitions,
      }, "warn");
      return {
        success: false,
        state: currentState,
        error: `Invalid transition from ${currentKey} to ${newKey}`,
      };
    }
  }

  // Merge context
  const currentContext = currentState?.data || createDefaultWaiterContext("home");
  const newContext: WaiterSessionContext = {
    ...currentContext,
    ...contextUpdates,
  };

  const success = await setWaiterState(supabase, userId, newKey, newContext);

  if (success) {
    await logStructuredEvent("WAITER_STATE_TRANSITION", {
      userId: maskPII(userId),
      from: currentKey,
      to: newKey,
      venueId: newContext.venueId,
    });

    recordMetric("waiter.state_transition", 1, {
      from: currentKey,
      to: newKey,
    });
  }

  return {
    success,
    state: success ? { key: newKey, data: newContext } : currentState,
    error: success ? undefined : "Failed to update state",
  };
}

/**
 * Initialize waiter session for home entry (no venue context)
 * Implements W-Fix 2: Venue discovery flow for home entry
 */
export async function initializeWaiterSession(
  supabase: SupabaseClient,
  userId: string,
  entryMode: WaiterEntryMode = "home"
): Promise<WaiterState> {
  await logStructuredEvent("WAITER_SESSION_INIT", {
    userId: maskPII(userId),
    entryMode,
  });

  recordMetric("waiter.session_init", 1, { entry_mode: entryMode });

  const context = createDefaultWaiterContext(entryMode);

  await setWaiterState(
    supabase,
    userId,
    WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    context
  );

  return {
    key: WAITER_STATE_KEYS.NO_VENUE_SELECTED,
    data: context,
  };
}

/**
 * Initialize waiter session from QR code scan
 * Implements W-Fix 3: Unify QR and home entry
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param barId - Bar UUID from QR
 * @param tableNumber - Table number from QR
 */
export async function initializeWaiterSessionFromQR(
  supabase: SupabaseClient,
  userId: string,
  barId: string,
  tableNumber: string
): Promise<WaiterState | null> {
  await logStructuredEvent("WAITER_SESSION_QR_INIT", {
    userId: maskPII(userId),
    barId,
    tableNumber,
  });

  recordMetric("waiter.session_init", 1, { entry_mode: "qr" });

  // Get bar info to validate and populate context
  const barInfo = await getBarInfo(supabase, barId);

  if (!barInfo || !barInfo.isActive) {
    await logStructuredEvent("WAITER_SESSION_QR_BAR_NOT_FOUND", {
      userId: maskPII(userId),
      barId,
    }, "warn");
    return null;
  }

  const context: WaiterSessionContext = {
    entryMode: "qr",
    venueId: barId,
    venueName: barInfo.name,
    tableNumber,
    lastLocation: null,
    cartItemCount: 0,
    cartTotal: 0,
    currency: barInfo.currency || "RWF",
    conversationSessionId: null,
  };

  await setWaiterState(
    supabase,
    userId,
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    context
  );

  return {
    key: WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    data: context,
  };
}

/**
 * Set venue in waiter session (after discovery)
 *
 * @param supabase - Supabase client
 * @param userId - User ID
 * @param barId - Selected bar ID
 * @param tableNumber - Optional table number
 */
export async function setWaiterVenue(
  supabase: SupabaseClient,
  userId: string,
  barId: string,
  tableNumber?: string
): Promise<WaiterState | null> {
  const barInfo = await getBarInfo(supabase, barId);

  if (!barInfo || !barInfo.isActive) {
    await logStructuredEvent("WAITER_SET_VENUE_NOT_FOUND", {
      userId: maskPII(userId),
      barId,
    }, "warn");
    return null;
  }

  const currentState = await getWaiterState(supabase, userId);
  const currentContext = currentState?.data || createDefaultWaiterContext("home");

  const newKey = tableNumber
    ? WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED
    : WAITER_STATE_KEYS.VENUE_SELECTED_NO_TABLE;

  const newContext: WaiterSessionContext = {
    ...currentContext,
    venueId: barId,
    venueName: barInfo.name,
    tableNumber: tableNumber || null,
    currency: barInfo.currency || "RWF",
  };

  await setWaiterState(supabase, userId, newKey, newContext);

  await logStructuredEvent("WAITER_VENUE_SET", {
    userId: maskPII(userId),
    barId,
    barName: barInfo.name,
    tableNumber,
  });

  recordMetric("waiter.venue_selected", 1, {
    has_table: Boolean(tableNumber),
  });

  return {
    key: newKey,
    data: newContext,
  };
}

/**
 * Set table number in waiter session
 */
export async function setWaiterTableNumber(
  supabase: SupabaseClient,
  userId: string,
  tableNumber: string
): Promise<WaiterState | null> {
  const currentState = await getWaiterState(supabase, userId);

  if (!currentState || !currentState.data.venueId) {
    await logStructuredEvent("WAITER_SET_TABLE_NO_VENUE", {
      userId: maskPII(userId),
    }, "warn");
    return null;
  }

  const result = await transitionWaiterState(
    supabase,
    userId,
    WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED,
    { tableNumber }
  );

  if (result.success) {
    await logStructuredEvent("WAITER_TABLE_SET", {
      userId: maskPII(userId),
      venueId: result.state?.data.venueId,
      tableNumber,
    });
  }

  return result.state;
}

/**
 * Update waiter session with location
 */
export async function setWaiterLocation(
  supabase: SupabaseClient,
  userId: string,
  lat: number,
  lng: number
): Promise<boolean> {
  const currentState = await getWaiterState(supabase, userId);

  if (!currentState) {
    return false;
  }

  const newContext: WaiterSessionContext = {
    ...currentState.data,
    lastLocation: {
      lat,
      lng,
      capturedAt: new Date().toISOString(),
    },
  };

  const success = await setWaiterState(supabase, userId, currentState.key, newContext);

  if (success) {
    await logStructuredEvent("WAITER_LOCATION_SET", {
      userId: maskPII(userId),
      lat,
      lng,
    });
  }

  return success;
}

/**
 * Check if session requires venue discovery
 */
export function requiresVenueDiscovery(state: WaiterState | null): boolean {
  if (!state) return true;

  return (
    state.key === WAITER_STATE_KEYS.NO_VENUE_SELECTED ||
    state.key === WAITER_STATE_KEYS.DISCOVERY_MODE ||
    state.key === WAITER_STATE_KEYS.AWAITING_LOCATION ||
    state.key === WAITER_STATE_KEYS.SEARCHING_BAR_NAME ||
    !state.data.venueId
  );
}

/**
 * Check if session is ready for ordering
 */
export function isReadyForOrdering(state: WaiterState | null): boolean {
  if (!state) return false;

  return (
    (state.key === WAITER_STATE_KEYS.VENUE_AND_TABLE_SELECTED ||
     state.key === WAITER_STATE_KEYS.ORDERING) &&
    Boolean(state.data.venueId)
  );
}
