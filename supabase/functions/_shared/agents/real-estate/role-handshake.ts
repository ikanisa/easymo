/**
 * Real Estate AI Agent - Role Handshake Manager
 *
 * Implements RE-Fix 1: Early role handshake
 * - Identifies user role (buyer/tenant vs landlord vs agent)
 * - Routes to appropriate flow based on role
 *
 * @see docs/GROUND_RULES.md - Observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent, recordMetric, maskPII } from "../../observability.ts";
import {
  REAL_ESTATE_STATE_KEYS,
  ROLE_LABELS,
  createDefaultRealEstateContext,
  type RealEstateRole,
  type RealEstateSessionContext,
  type RealEstateState,
  type RealEstateStateKey,
} from "./types.ts";

const STATE_TTL_SECONDS = 3600; // 1 hour

/**
 * Get current real estate session state
 */
export async function getRealEstateState(
  supabase: SupabaseClient,
  userId: string
): Promise<RealEstateState | null> {
  try {
    const { data, error } = await supabase
      .from("user_state")
      .select("key, data, created_at, expires_at")
      .eq("user_id", userId)
      .in("key", Object.values(REAL_ESTATE_STATE_KEYS))
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Check expiry
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      await clearRealEstateState(supabase, userId);
      return null;
    }

    return {
      key: data.key as RealEstateStateKey,
      data: data.data as RealEstateSessionContext,
      createdAt: data.created_at,
      expiresAt: data.expires_at,
    };
  } catch (error) {
    await logStructuredEvent("REAL_ESTATE_STATE_GET_ERROR", {
      userId: maskPII(userId),
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return null;
  }
}

/**
 * Set real estate session state
 */
export async function setRealEstateState(
  supabase: SupabaseClient,
  userId: string,
  key: RealEstateStateKey,
  context: RealEstateSessionContext
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
      await logStructuredEvent("REAL_ESTATE_STATE_SET_ERROR", {
        userId: maskPII(userId),
        key,
        error: error.message,
      }, "error");
      return false;
    }

    await logStructuredEvent("REAL_ESTATE_STATE_SET", {
      userId: maskPII(userId),
      key,
      role: context.role,
      entrySource: context.entrySource,
    });

    return true;
  } catch (error) {
    await logStructuredEvent("REAL_ESTATE_STATE_SET_EXCEPTION", {
      userId: maskPII(userId),
      key,
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Clear real estate session state
 */
export async function clearRealEstateState(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_state")
      .delete()
      .eq("user_id", userId)
      .in("key", Object.values(REAL_ESTATE_STATE_KEYS));

    if (error) {
      await logStructuredEvent("REAL_ESTATE_STATE_CLEAR_ERROR", {
        userId: maskPII(userId),
        error: error.message,
      }, "error");
      return false;
    }

    return true;
  } catch (error) {
    await logStructuredEvent("REAL_ESTATE_STATE_CLEAR_EXCEPTION", {
      userId: maskPII(userId),
      error: error instanceof Error ? error.message : String(error),
    }, "error");
    return false;
  }
}

/**
 * Initialize role selection state
 */
export async function initializeRoleSelection(
  supabase: SupabaseClient,
  userId: string,
  entrySource: "whatsapp" | "pwa" | "deep_link" = "whatsapp"
): Promise<RealEstateState> {
  await logStructuredEvent("REAL_ESTATE_ROLE_SELECTION_INIT", {
    userId: maskPII(userId),
    entrySource,
  });

  recordMetric("real_estate.session_init", 1, { entry_source: entrySource });

  const context = createDefaultRealEstateContext(entrySource);

  await setRealEstateState(
    supabase,
    userId,
    REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
    context
  );

  return {
    key: REAL_ESTATE_STATE_KEYS.ROLE_SELECTION,
    data: context,
  };
}

/**
 * Set user role and transition to appropriate state
 */
export async function setUserRole(
  supabase: SupabaseClient,
  userId: string,
  role: RealEstateRole
): Promise<RealEstateState> {
  const currentState = await getRealEstateState(supabase, userId);
  const currentContext = currentState?.data || createDefaultRealEstateContext("whatsapp");

  const newContext: RealEstateSessionContext = {
    ...currentContext,
    role,
  };

  // Determine next state based on role
  let nextKey: RealEstateStateKey;
  switch (role) {
    case "buyer_tenant":
      nextKey = REAL_ESTATE_STATE_KEYS.PROPERTY_SEARCH;
      break;
    case "landlord_owner":
      nextKey = REAL_ESTATE_STATE_KEYS.PROPERTY_LISTING;
      break;
    case "agency_staff":
      nextKey = REAL_ESTATE_STATE_KEYS.AGENCY_MANAGEMENT;
      break;
    default:
      nextKey = REAL_ESTATE_STATE_KEYS.AI_CHAT;
  }

  await setRealEstateState(supabase, userId, nextKey, newContext);

  await logStructuredEvent("REAL_ESTATE_ROLE_SET", {
    userId: maskPII(userId),
    role,
    nextState: nextKey,
  });

  recordMetric("real_estate.role_selected", 1, { role });

  return {
    key: nextKey,
    data: newContext,
  };
}

/**
 * Check if user needs role handshake
 */
export function requiresRoleHandshake(state: RealEstateState | null): boolean {
  if (!state) return true;
  return state.key === REAL_ESTATE_STATE_KEYS.ROLE_SELECTION || !state.data.role;
}

/**
 * Format role selection message for WhatsApp
 */
export function formatRoleSelectionMessage(): {
  body: string;
  buttons: Array<{ id: string; title: string }>;
} {
  return {
    body:
      "🏠 *Welcome to easyMO Real Estate!*\n\n" +
      "To help you better, please tell me what you're looking for:\n\n" +
      `${ROLE_LABELS.buyer_tenant.emoji} *${ROLE_LABELS.buyer_tenant.title}*\n` +
      `${ROLE_LABELS.buyer_tenant.description}\n\n` +
      `${ROLE_LABELS.landlord_owner.emoji} *${ROLE_LABELS.landlord_owner.title}*\n` +
      `${ROLE_LABELS.landlord_owner.description}\n\n` +
      `${ROLE_LABELS.agency_staff.emoji} *${ROLE_LABELS.agency_staff.title}*\n` +
      `${ROLE_LABELS.agency_staff.description}`,
    buttons: [
      { id: "re_role_buyer", title: "🏠 Find Property" },
      { id: "re_role_landlord", title: "🏢 List Property" },
      { id: "re_role_agent", title: "👔 I'm an Agent" },
    ],
  };
}

/**
 * Parse role from button ID
 */
export function parseRoleFromButtonId(buttonId: string): RealEstateRole | null {
  switch (buttonId) {
    case "re_role_buyer":
      return "buyer_tenant";
    case "re_role_landlord":
      return "landlord_owner";
    case "re_role_agent":
      return "agency_staff";
    default:
      return null;
  }
}
