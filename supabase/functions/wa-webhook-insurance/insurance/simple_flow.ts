/**
 * Simplified Insurance Flow
 * - Just provides contact information to users
 * - No document uploads, no OCR, no forwarding
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js";

import { logStructuredEvent } from "../../_shared/observability.ts";

interface InsuranceAdmin {
  wa_id: string;
  display_name: string;
}

/**
 * Fetch the primary insurance admin contact
 * Returns the first active contact or a fallback
 */
async function getInsuranceAdminContact(supabase: SupabaseClient): Promise<InsuranceAdmin | null> {
  const { data, error } = await supabase
    .from("insurance_admin_contacts")
    .select("contact_value, display_name")
    .eq("contact_type", "whatsapp")
    .eq("category", "insurance")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    await logStructuredEvent("INSURANCE_ADMIN_FETCH_ERROR", { error: error.message }, "error");
    return null;
  }

  if (!data) {
    return null;
  }

  return {
    wa_id: data.contact_value.replace(/^\+/, ""), // Remove leading + for WhatsApp API format
    display_name: data.display_name || "Insurance Team"
  };
}

/**
 * Get insurance contact message - simple text with admin WhatsApp contact
 */
export async function getInsuranceContactMessage(supabase: SupabaseClient): Promise<string> {
  const correlationId = crypto.randomUUID();
  await logStructuredEvent("INSURANCE_CONTACT_REQUEST", { correlationId });

  try {
    const admin = await getInsuranceAdminContact(supabase);
    
    if (!admin) {
      // Fallback message if no admin contact is configured
      return `📞 *Insurance Services*

For insurance services, please contact our insurance team directly.

We'll be happy to guide you through the process and answer all your questions.`;
    }

    const waLink = `https://wa.me/${admin.wa_id}`;
    const phoneFormatted = admin.wa_id.startsWith("250") 
      ? `+${admin.wa_id}` 
      : admin.wa_id;

    return `📞 *Insurance Services*

For insurance services, please contact our insurance agent directly:

👤 *${admin.display_name}*
📱 WhatsApp: ${waLink}
☎️ Phone: ${phoneFormatted}

Our agent will guide you through the process and answer all your questions about:
• Motor insurance
• Insurance certificates
• Carte Jaune (Yellow Card)
• Claims and renewals

Tap the link above or call directly!`;

  } catch (error) {
    await logStructuredEvent("INSURANCE_CONTACT_ERROR", {
      correlationId,
      error: error instanceof Error ? error.message : String(error)
    }, "error");
    
    // Return a fallback message
    return `📞 *Insurance Services*

For insurance services, please contact our insurance team.

We apologize for the inconvenience. Please try again later.`;
  }
}
