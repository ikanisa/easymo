/**
 * Insurance Contacts Handler
 * 
 * Handles fetching and formatting insurance contacts from database
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { normalizePhone, isValidPhone, getCountryCode } from "../../_shared/phone-utils.ts";

export interface InsuranceContact {
  display_name: string;
  phone: string;
}

/**
 * Fetch active insurance contacts from database
 * Simplified schema: phone, display_name, is_active only
 */
export async function fetchInsuranceContacts(
  supabase: SupabaseClient,
  requestId: string,
): Promise<{ contacts: InsuranceContact[] | null; error: Error | null }> {
  try {
    const result = await supabase
      .from("insurance_admin_contacts")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (result.error) {
      await logStructuredEvent("INSURANCE_DB_ERROR", {
        requestId,
        error: result.error.message,
      }, "error");
      
      return { contacts: null, error: result.error };
    }
    
    // Normalize DB rows to expected interface: support both 'phone' and legacy 'destination'
    const rows: any[] = result.data ?? [];
    const contacts = rows.map((r) => ({
      display_name: r.display_name ?? r.name ?? null,
      phone: (r.phone ?? r.destination ?? r.phone) ?? null,
    })).filter(c => c.phone && c.display_name) as InsuranceContact[];

    return { contacts, error: null };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    await logStructuredEvent("INSURANCE_DB_EXCEPTION", {
      requestId,
      error: error.message,
    }, "error");
    
    return { contacts: null, error };
  }
}

/**
 * Validate and normalize phone number for WhatsApp link
 * Returns normalized number (without +) or null if invalid
 */
function validateAndNormalizePhone(phone: string): string | null {
  if (!phone || typeof phone !== "string") {
    return null;
  }
  
  // Normalize phone number (keeps + if present)
  const normalized = normalizePhone(phone.trim());
  
  // Validate phone number format
  if (!isValidPhone(normalized)) {
    return null;
  }
  
  // Extract country code to validate it exists
  const countryCode = getCountryCode(normalized);
  if (!countryCode) {
    // If no country code detected, try to add + if missing
    const withPlus = normalized.startsWith("+") ? normalized : `+${normalized}`;
    if (isValidPhone(withPlus) && getCountryCode(withPlus)) {
      return withPlus.replace(/^\+/, ""); // Remove + for wa.me link
    }
    return null;
  }
  
  // Remove + prefix for wa.me link (wa.me requires number without +)
  return normalized.replace(/^\+/, "");
}

/**
 * Format insurance contacts into WhatsApp links
 * Validates phone numbers and filters out invalid ones
 */
export async function formatContactLinks(
  contacts: InsuranceContact[],
  requestId: string,
): Promise<string> {
  const validContacts: Array<{ name: string; phone: string }> = [];
  const invalidContacts: Array<{ name: string; phone: string }> = [];
  
  for (const contact of contacts) {
    const normalizedPhone = validateAndNormalizePhone(contact.phone);
    
    if (normalizedPhone) {
      validContacts.push({
        name: contact.display_name,
        phone: normalizedPhone,
      });
    } else {
      invalidContacts.push({
        name: contact.display_name,
        phone: contact.phone,
      });
      
      // Log invalid phone number for monitoring
      await logStructuredEvent("INSURANCE_INVALID_PHONE_FORMAT", {
        requestId,
        phone: contact.phone,
        displayName: contact.display_name,
        normalized: normalizePhone(contact.phone),
      }, "warn");
    }
  }
  
  // Log summary of validation results
  if (invalidContacts.length > 0) {
    await logStructuredEvent("INSURANCE_PHONE_VALIDATION_SUMMARY", {
      requestId,
      totalContacts: contacts.length,
      validCount: validContacts.length,
      invalidCount: invalidContacts.length,
      invalidPhones: invalidContacts.map(c => c.phone),
    }, "warn");
  }
  
  // Format valid contacts as WhatsApp links
  const contactLinks = validContacts
    .map((c) => `• ${c.name}: https://wa.me/${c.phone}`)
    .join("\n");
  
  return contactLinks;
}
