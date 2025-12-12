/**
 * Marketplace Domain Handler (Coming Soon)
 * 
 * This is a stub implementation for the marketplace domain.
 * Full marketplace functionality will be implemented in a future release.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../_shared/observability.ts";

export interface MarketplaceMessage {
  text: string;
  from: string;
  messageId: string;
}

export interface MarketplaceResponse {
  text: string;
  buttons?: Array<{ id: string; title: string }>;
}

/**
 * Handle marketplace-related messages
 * Currently returns a "coming soon" message
 */
export async function handleMarketplace(
  message: MarketplaceMessage,
  _supabase: SupabaseClient
): Promise<MarketplaceResponse> {
  console.log(JSON.stringify({
    event: "MARKETPLACE_STUB_INVOKED",
    from: message.from,
    messageId: message.messageId,
  }));

  return {
    text: "🛍️ **Marketplace Coming Soon!**\n\nWe're building an amazing marketplace experience for you.\n\nIn the meantime, explore our other services:",
    buttons: [
      { id: "jobs", title: "💼 Find Jobs" },
      { id: "mobility", title: "🚗 Book Rides" },
      { id: "property", title: "🏠 Rent Property" },
      { id: "home", title: "🏠 Back to Home" },
    ],
  };
}

/**
 * Get marketplace feature status
 */
export function getMarketplaceStatus(): {
  enabled: boolean;
  comingSoon: boolean;
  eta: string;
} {
  return {
    enabled: false,
    comingSoon: true,
    eta: "Q1 2026",
  };
}
