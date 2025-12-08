/**
 * Help & Support Handler
 * Handles user requests for help/support by showing insurance admin contacts
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

interface InsuranceAdminContact {
  id: string;
  contact_type: string;
  contact_value: string;
  display_name: string;
  is_active: boolean;
  display_order: number;
}

export async function handleHelpRequest(
  phoneNumber: string
): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    await logStructuredEvent("HELP_REQUEST_RECEIVED", {
      phoneNumber: phoneNumber.substring(phoneNumber.length - 4),
    });

    // Fetch active insurance admin contacts
    const { data: contacts, error } = await supabase
      .from("insurance_admin_contacts")
      .select("id, contact_type, contact_value, display_name, is_active, display_order")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      await logStructuredEvent("HELP_CONTACTS_FETCH_ERROR", {
        error: error.message,
      });
      
      await sendText(
        phoneNumber,
        "❌ Sorry, we're having trouble loading support contacts. Please try again later."
      );
      return;
    }

    if (!contacts || contacts.length === 0) {
      await logStructuredEvent("HELP_NO_CONTACTS_FOUND", {});
      
      await sendText(
        phoneNumber,
        "📞 *Help & Support*\n\n" +
        "We're here to help! Please contact our support team:\n\n" +
        "📧 Email: support@easymo.rw\n" +
        "🌐 Website: www.easymo.rw"
      );
      return;
    }

    // Build support message with admin contacts
    let message = "📞 *Help & Support*\n\n";
    message += "Need assistance? Contact our support team:\n\n";

    const whatsappContacts = contacts.filter(c => c.contact_type === "whatsapp");
    const otherContacts = contacts.filter(c => c.contact_type !== "whatsapp");

    // Show WhatsApp contacts first
    if (whatsappContacts.length > 0) {
      message += "💬 *WhatsApp Support:*\n";
      whatsappContacts.forEach((contact, index) => {
        message += `${index + 1}. ${contact.display_name}\n`;
        message += `   📱 ${contact.contact_value}\n`;
        message += `   _Tap the number to chat with support_\n\n`;
      });
    }

    // Show other contact types
    if (otherContacts.length > 0) {
      message += "\n📧 *Other Contacts:*\n";
      otherContacts.forEach((contact) => {
        const icon = contact.contact_type === "email" ? "📧" : 
                     contact.contact_type === "phone" ? "📞" : "📞";
        message += `${icon} ${contact.display_name}: ${contact.contact_value}\n`;
      });
    }

    message += "\n\n💡 *How can we help?*\n";
    message += "• General inquiries\n";
    message += "• Insurance claims support\n";
    message += "• Account assistance\n";
    message += "• Technical issues\n";
    message += "• Billing questions\n\n";
    message += "_Our team is ready to assist you!_";

    await sendText(phoneNumber, message);

    await logStructuredEvent("HELP_CONTACTS_SENT", {
      phoneNumber: phoneNumber.substring(phoneNumber.length - 4),
      contactCount: contacts.length,
      whatsappCount: whatsappContacts.length,
    });

  } catch (error) {
    await logStructuredEvent("HELP_HANDLER_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    });

    await sendText(
      phoneNumber,
      "❌ Sorry, something went wrong. Please try again or contact support@easymo.rw"
    );
  }
}
