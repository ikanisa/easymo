/**
 * Marketplace Domain Handler
 *
 * Re-exports the AI agent and database operations for the marketplace domain.
 * This module provides a unified interface for marketplace functionality.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
export { MarketplaceAgent } from "../agent.ts";
export * from "../db/index.ts";
export * from "../utils/index.ts";

export interface MarketplaceMessage {
  text: string;
  from: string;
  messageId: string;
  location?: { lat: number; lng: number };
}

export interface MarketplaceResponse {
  text: string;
  buttons?: Array<{ id: string; title: string }>;
}

/**
 * Get marketplace feature status
 */
export function getMarketplaceStatus(): {
  enabled: boolean;
  aiEnabled: boolean;
  version: string;
} {
  const aiEnabled = Deno.env.get("FEATURE_MARKETPLACE_AI") === "true";
  return {
    enabled: true,
    aiEnabled,
    version: "2.0.0",
  };
}
