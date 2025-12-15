/**
 * Insurance Contacts Handler
 * 
 * Handles fetching and formatting insurance contacts from database
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";

export interface InsuranceContact {
  display_name: string;
  destination: string;
}

/**
 * Fetch active insurance contacts from database
 */
export async function fetchInsuranceContacts(
  supabase: SupabaseClient,
  requestId: string,
): Promise<{ contacts: InsuranceContact[] | null; error: Error | null }> {
  // Set a reasonable timeout to avoid long-running queries
  const queryTimeout = setTimeout(() => {
    throw new Error("Database query timeout");
  }, 5000); // 5 second timeout

  try {
    const result = await supabase
      .from("insurance_admin_contacts")
      .select("display_name, destination")
      .eq("channel", "whatsapp")
      .eq("category", "insurance")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    
    clearTimeout(queryTimeout);
    
    if (result.error) {
      await logStructuredEvent("INSURANCE_DB_ERROR", {
        requestId,
        error: result.error.message,
      }, "error");
      
      return { contacts: null, error: result.error };
    }
    
    return { contacts: result.data, error: null };
  } catch (e) {
    clearTimeout(queryTimeout);
    const error = e instanceof Error ? e : new Error(String(e));
    await logStructuredEvent("INSURANCE_DB_EXCEPTION", {
      requestId,
      error: error.message,
    }, "error");
    
    return { contacts: null, error };
  }
}

/**
 * Format insurance contacts into WhatsApp links
 */
export async function formatContactLinks(
  contacts: InsuranceContact[],
  requestId: string,
): Promise<string> {
  const contactLinks = contacts
    .map((c) => {
      // Clean phone number: remove spaces, dashes, and + prefix for wa.me link
      const cleanNumber = c.destination
        .replace(/[\s\-+]/g, "")
        .replace(/^00/, ""); // Also handle 00 prefix
      
      // Basic validation: ensure it's a valid phone number (digits only, 10-15 chars)
      if (!/^\d{10,15}$/.test(cleanNumber)) {
        logStructuredEvent("INSURANCE_INVALID_PHONE_FORMAT", {
          requestId,
          destination: c.destination,
          displayName: c.display_name,
        }, "warn");
        return null; // Skip invalid numbers
      }
      
      return `• ${c.display_name}: https://wa.me/${cleanNumber}`;
    })
    .filter((link): link is string => link !== null) // Remove null entries
    .join("\n");
  
  return contactLinks;
}

