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
export * from "./vendor_inquiry_tools.ts";

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
  vendorOutreachEnabled: boolean;
  version: string;
} {
  const aiEnabled = Deno.env.get("FEATURE_MARKETPLACE_AI") === "true";
  const vendorOutreachEnabled = Deno.env.get("FEATURE_VENDOR_OUTREACH") === "true";
  return {
    enabled: true,
    aiEnabled,
    vendorOutreachEnabled,
    version: "3.0.0",
  };
}
