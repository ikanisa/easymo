/**
 * Proactive Outreach Workflow
 * 
 * Implements the proactive vendor outreach conversation flow where the agent
 * gathers requirements, finds vendors, requests user consent, contacts vendors,
 * and returns verified availability.
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { VendorOutreachService, type Vendor } from "../services/vendor-outreach.ts";
import { UserMemoryService } from "../services/user-memory.ts";

// =====================================================
// TYPES
// =====================================================

export interface OutreachWorkflowState {
  step: OutreachStep;
  items: Array<{
    name: string;
    quantity?: number;
    dosage?: string;
  }>;
  location?: { lat: number; lng: number; text?: string };
  selectedCategory?: string;
  foundVendors?: Vendor[];
  sessionId?: string;
  userConsent?: boolean;
}

export type OutreachStep =
  | "gather_items"
  | "gather_quantity"
  | "gather_location"
  | "gather_urgency"
  | "propose_vendors"
  | "await_consent"
  | "contacting_vendors"
  | "awaiting_responses"
  | "show_results";

// =====================================================
// PROACTIVE OUTREACH WORKFLOW
// =====================================================

export class ProactiveOutreachWorkflow {
  private supabase: SupabaseClient;
  private correlationId?: string;
  private outreachService: VendorOutreachService;
  private memoryService: UserMemoryService;

  constructor(supabase: SupabaseClient, correlationId?: string) {
    this.supabase = supabase;
    this.correlationId = correlationId;
    this.outreachService = new VendorOutreachService(supabase, correlationId);
    this.memoryService = new UserMemoryService(supabase, correlationId);
  }

  /**
   * Start a new proactive outreach session
   */
  async start(params: {
    userPhone: string;
    initialMessage: string;
    category?: string;
  }): Promise<{ message: string; state: OutreachWorkflowState }> {
    logStructuredEvent("PROACTIVE_OUTREACH_START", {
      userPhone: params.userPhone.slice(-4),
      category: params.category,
      correlationId: this.correlationId,
    });

    // Check if we can recall user context for personalization
    const userContext = await this.memoryService.getUserContext(params.userPhone);

    let message = "📋 *Let's find what you need!*\n\n";

    // Personalize if we have past orders
    if (userContext.past_orders.length > 0) {
      message += "I see you've ordered from us before. 🙌\n\n";
    }

    message += "What items are you looking for?\n";
    message += "_(You can list multiple items, e.g., \"Paracetamol 500mg and Amoxicillin\")_";

    const state: OutreachWorkflowState = {
      step: "gather_items",
      items: [],
      selectedCategory: params.category,
    };

    // Use user's preferred location if available
    if (userContext.location) {
      state.location = userContext.location;
    }

    return { message, state };
  }

  /**
   * Process user input and advance workflow
   */
  async processInput(params: {
    userPhone: string;
    message: string;
    currentState: OutreachWorkflowState;
    location?: { lat: number; lng: number };
  }): Promise<{ message: string; state: OutreachWorkflowState }> {
    const { currentState, message: userMessage, userPhone, location } = params;

    switch (currentState.step) {
      case "gather_items":
        return await this.handleGatherItems(userPhone, userMessage, currentState);

      case "gather_location":
        return await this.handleGatherLocation(userPhone, userMessage, currentState, location);

      case "propose_vendors":
        return await this.handleProposeVendors(userPhone, currentState);

      case "await_consent":
        return await this.handleUserConsent(userPhone, userMessage, currentState);

      case "show_results":
        return await this.handleShowResults(userPhone, userMessage, currentState);

      default:
        return {
          message: "I'm not sure what to do next. Type *menu* to start over.",
          state: currentState,
        };
    }
  }

  /**
   * Handle gathering items from user
   */
  private async handleGatherItems(
    userPhone: string,
    userMessage: string,
    currentState: OutreachWorkflowState
  ): Promise<{ message: string; state: OutreachWorkflowState }> {
    // Simple parsing of items (can be enhanced with AI)
    const items = this.parseItemsList(userMessage);

    if (items.length === 0) {
      return {
        message: "I didn't catch that. Could you please tell me what items you need?\n\n_Example: \"Paracetamol 500mg\" or \"Paracetamol and Ibuprofen\"_",
        state: currentState,
      };
    }

    const newState: OutreachWorkflowState = {
      ...currentState,
      items,
      step: currentState.location ? "propose_vendors" : "gather_location",
    };

    // If we have location already, skip to proposing vendors
    if (currentState.location) {
      return await this.handleProposeVendors(userPhone, newState);
    }

    // Otherwise, ask for location
    const message = `✅ Got it! You need:\n${items.map((item, i) => `${i + 1}. ${item.name}${item.dosage ? ` ${item.dosage}` : ""}${item.quantity ? ` x${item.quantity}` : ""}`).join("\n")}\n\n📍 *Share your location* so I can find nearby pharmacies:\n• Tap the 📎 attachment icon\n• Select 📍 Location\n• Choose "Send your current location"\n\n_Or type a location like "Kigali" or "Nyarugenge"_`;

    return { message, state: newState };
  }

  /**
   * Handle location gathering
   */
  private async handleGatherLocation(
    userPhone: string,
    userMessage: string,
    currentState: OutreachWorkflowState,
    location?: { lat: number; lng: number }
  ): Promise<{ message: string; state: OutreachWorkflowState }> {
    let locationData: { lat: number; lng: number; text?: string } | undefined;

    if (location) {
      // GPS location shared
      locationData = location;
      
      // Store as preferred location
      await this.memoryService.storePreferredLocation(userPhone, location);
    } else if (userMessage) {
      // Text location (e.g., "Kigali")
      locationData = { lat: 0, lng: 0, text: userMessage };
      // TODO: Geocode text to lat/lng
    }

    if (!locationData) {
      return {
        message: "📍 Please share your location or type your city/area.",
        state: currentState,
      };
    }

    const newState: OutreachWorkflowState = {
      ...currentState,
      location: locationData,
      step: "propose_vendors",
    };

    return await this.handleProposeVendors(userPhone, newState);
  }

  /**
   * Find vendors and propose them to user
   */
  private async handleProposeVendors(
    userPhone: string,
    currentState: OutreachWorkflowState
  ): Promise<{ message: string; state: OutreachWorkflowState }> {
    // Find suitable vendors
    const category = currentState.selectedCategory || "pharmacy";
    const vendors = await this.outreachService.findVendors({
      category,
      location: currentState.location,
      limit: 10,
    });

    if (vendors.length === 0) {
      return {
        message: `😔 I couldn't find any ${category} businesses near you that accept agent inquiries.\n\nWould you like to:\n1️⃣ Try a different area\n2️⃣ See all pharmacies (you'll contact them yourself)`,
        state: { ...currentState, step: "gather_location" },
      };
    }

    // Sort by reliability score if available
    const sortedVendors = vendors.sort((a, b) => {
      const aTime = a.avg_response_time_minutes || 999;
      const bTime = b.avg_response_time_minutes || 999;
      return aTime - bTime;
    });

    const topVendors = sortedVendors.slice(0, 5);

    let message = `🔍 *Found ${vendors.length} ${category} businesses near you!*\n\n`;
    message += `Top ${topVendors.length} that typically respond quickly:\n\n`;

    topVendors.forEach((vendor, i) => {
      const distance = vendor.distance_km ? ` (${vendor.distance_km.toFixed(1)}km)` : "";
      const responseTime = vendor.avg_response_time_minutes
        ? ` - Usually responds in ${vendor.avg_response_time_minutes} min`
        : "";

      message += `${i + 1}️⃣ *${vendor.name}*${distance}${responseTime}\n`;
      if (vendor.city) message += `   📍 ${vendor.city}\n`;
      message += `\n`;
    });

    message += `\n📞 *Would you like me to contact these pharmacies on your behalf to check who has your items?*\n\n`;
    message += `I'll message them and get back to you with confirmed availability in about 5 minutes. ⏳\n\n`;
    message += `Reply:\n`;
    message += `✅ *YES* - I'll contact them for you\n`;
    message += `❌ *NO* - Show me the list so I can contact them myself`;

    const newState: OutreachWorkflowState = {
      ...currentState,
      foundVendors: topVendors,
      step: "await_consent",
    };

    return { message, state: newState };
  }

  /**
   * Handle user consent to contact vendors
   */
  private async handleUserConsent(
    userPhone: string,
    userMessage: string,
    currentState: OutreachWorkflowState
  ): Promise<{ message: string; state: OutreachWorkflowState }> {
    const normalized = userMessage.toLowerCase().trim();

    // Check for consent
    if (
      normalized.includes("yes") ||
      normalized.includes("ok") ||
      normalized.includes("sure") ||
      normalized.includes("✅") ||
      normalized === "y" ||
      normalized === "1"
    ) {
      // User consents - create outreach session and contact vendors
      const sessionResult = await this.outreachService.createSession({
        userPhone,
        requestSummary: currentState.items.map((i) => i.name).join(", "),
        itemsRequested: currentState.items,
        userLocation: currentState.location,
      });

      if (!sessionResult.success || !sessionResult.sessionId) {
        return {
          message: "😔 Sorry, I had trouble setting up the outreach. Please try again or type *menu*.",
          state: currentState,
        };
      }

      // Contact vendors
      const contactResult = await this.outreachService.contactVendors({
        sessionId: sessionResult.sessionId,
        vendors: currentState.foundVendors || [],
        items: currentState.items,
      });

      if (!contactResult.success) {
        return {
          message: "😔 Sorry, I had trouble contacting the vendors. Please try again or type *menu*.",
          state: currentState,
        };
      }

      const message = `✅ *Great! I'm contacting ${contactResult.contacted} pharmacies now.*\n\n⏳ I'll get back to you in about 5 minutes with confirmed availability and prices.\n\n_You'll receive a notification when I have the results!_`;

      const newState: OutreachWorkflowState = {
        ...currentState,
        sessionId: sessionResult.sessionId,
        userConsent: true,
        step: "awaiting_responses",
      };

      // Store this as a past order request
      await this.memoryService.storePastOrder(userPhone, {
        items: currentState.items,
      });

      return { message, state: newState };
    }

    // User declined - show manual list
    if (
      normalized.includes("no") ||
      normalized.includes("❌") ||
      normalized === "n" ||
      normalized === "2"
    ) {
      let message = `📋 *Here are the pharmacies near you:*\n\n`;

      (currentState.foundVendors || []).forEach((vendor, i) => {
        const distance = vendor.distance_km ? ` (${vendor.distance_km.toFixed(1)}km)` : "";
        message += `${i + 1}. *${vendor.name}*${distance}\n`;
        if (vendor.city) message += `   📍 ${vendor.city}\n`;
        if (vendor.phone) {
          const masked = vendor.phone.length > 8
            ? `${vendor.phone.slice(0, 4)}****${vendor.phone.slice(-3)}`
            : vendor.phone;
          message += `   📞 ${masked}\n`;
        }
        message += `\n`;
      });

      message += `\n_Reply with a number (1-${currentState.foundVendors?.length || 0}) to get full contact details_\n`;
      message += `🔄 _Type *menu* for more options_`;

      return {
        message,
        state: { ...currentState, step: "show_results", userConsent: false },
      };
    }

    // Unclear response - ask again
    return {
      message: `Please reply:\n✅ *YES* - I'll contact them for you\n❌ *NO* - Show me the list`,
      state: currentState,
    };
  }

  /**
   * Handle showing results (when user selected a specific pharmacy)
   */
  private async handleShowResults(
    userPhone: string,
    userMessage: string,
    currentState: OutreachWorkflowState
  ): Promise<{ message: string; state: OutreachWorkflowState }> {
    const selection = parseInt(userMessage.trim());

    if (
      isNaN(selection) ||
      selection < 1 ||
      selection > (currentState.foundVendors?.length || 0)
    ) {
      return {
        message: `Please reply with a number (1-${currentState.foundVendors?.length || 0}) or type *menu*.`,
        state: currentState,
      };
    }

    const selectedVendor = currentState.foundVendors![selection - 1];

    let message = `🏪 *${selectedVendor.name}*\n\n`;

    if (selectedVendor.category) {
      message += `📂 ${selectedVendor.category}\n`;
    }
    if (selectedVendor.address || selectedVendor.city) {
      message += `📍 ${selectedVendor.address || selectedVendor.city}\n`;
    }
    if (selectedVendor.distance_km != null) {
      message += `🚶 ${selectedVendor.distance_km.toFixed(1)}km away\n`;
    }

    if (selectedVendor.phone) {
      message += `\n📞 Contact: ${selectedVendor.phone}\n`;
      message += `💬 WhatsApp: https://wa.me/${selectedVendor.phone.replace(/\D/g, "")}\n`;
    }

    message += `\n🔄 _Type *menu* to search for more businesses_`;

    // Remember this as a favorite vendor
    await this.memoryService.storeFavoriteVendor(userPhone, {
      vendor_id: selectedVendor.id || selectedVendor.phone || "",
      vendor_name: selectedVendor.name,
      category: selectedVendor.category,
      reason: "selected_from_search",
    });

    return { message, state: currentState };
  }

  /**
   * Parse items list from user message
   */
  private parseItemsList(message: string): Array<{
    name: string;
    quantity?: number;
    dosage?: string;
  }> {
    const items: Array<{ name: string; quantity?: number; dosage?: string }> = [];

    // Split by common separators
    const parts = message.split(/,|and|\n/i).map((s) => s.trim()).filter((s) => s);

    for (const part of parts) {
      // Try to extract quantity (e.g., "x 10", "10x", "10 tablets")
      const quantityMatch = part.match(/(?:x\s*)?(\d+)(?:\s*x|\s+(?:tablets|pills|doses|boxes))?/i);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : undefined;

      // Try to extract dosage (e.g., "500mg", "250 mg")
      const dosageMatch = part.match(/(\d+\s*(?:mg|g|ml|mcg))/i);
      const dosage = dosageMatch ? dosageMatch[1] : undefined;

      // Remove quantity and dosage to get item name
      let name = part
        .replace(/(?:x\s*)?\d+(?:\s*x|\s+(?:tablets|pills|doses|boxes))?/gi, "")
        .replace(/\d+\s*(?:mg|g|ml|mcg)/gi, "")
        .trim();

      if (name) {
        items.push({ name, quantity, dosage });
      }
    }

    return items;
  }
}
