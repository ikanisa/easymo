/**
 * Shared types for Buy & Sell module
 * 
 * Extracted from agent.ts to reduce coupling and improve maintainability.
 * See: REFACTORING_ASSESSMENT.md Part 4.2 for Buy & Sell restructuring analysis
 */

/**
 * Marketplace conversation context for AI agent
 * Tracks user state across conversation turns
 */
export interface MarketplaceContext {
  phone: string;
  flowType: "selling" | "buying" | "inquiry" | "category_selection" | "awaiting_location" | "show_results" | "vendor_outreach" | null;
  flowStep: string | null;
  collectedData: Record<string, unknown>;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  location?: { lat: number; lng: number };
  currentListingId?: string | null;
  currentIntentId?: string | null;
  selectedCategory?: string;
  searchResults?: Array<Record<string, unknown>>;
  // Vendor outreach state
  pendingVendorOutreach?: {
    businessIds: string[];
    requestSummary: string;
    requestType: "product" | "service" | "medicine";
    awaitingConsent: boolean;
  };
  currentInquiryId?: string | null;
}
