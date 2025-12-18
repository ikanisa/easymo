/**
 * Help & Support Handler
 * Handles user requests for help/support by showing insurance admin contacts
 */

import { logStructuredEvent } from "../../_shared/observability.ts";
import { supabase } from "../../_shared/wa-webhook-shared/config.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

export async function handleHelpRequest(
  phoneNumber: string
): Promise<void> {

  try {
    await logStructuredEvent("HELP_REQUEST_RECEIVED", {
      phoneNumber: phoneNumber.substring(phoneNumber.length - 4),
    });

    // Fetch active insurance admin contacts using simplified schema (phone, display_name, is_active)
    const { data: contacts, error } = await supabase
      .from("insurance_admin_contacts")
      .select("phone, display_name")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

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

    // Build support message with admin contacts and clickable WhatsApp links
    let message = "🆘 *Help & Support*\n\n";
    message += "Contact our team for assistance:\n\n";

    // All contacts are WhatsApp numbers, show with clickable links
    contacts.forEach((contact, index) => {
      // Create WhatsApp link (wa.me format)
      const cleanNumber = contact.phone.replace(/[^0-9]/g, '');
      const waLink = `https://wa.me/${cleanNumber}`;
      
      message += `${index + 1}. *${contact.display_name}*\n`;
      message += `   ${waLink}\n\n`;
    });

    message += "_Tap any link above to start chatting on WhatsApp._\n\n";
    message += "Or chat with our AI assistant for immediate help.\n";

    await sendText(phoneNumber, message);

    // Send buttons for AI agent option
    const { sendButtons } = await import("../../_shared/wa-webhook-shared/wa/client.ts");
    await sendButtons(
      phoneNumber,
      "Choose an option:",
      [
        { id: "call_center", title: "💬 Chat with AI" },
        { id: "home", title: "🏠 Home" },
      ]
    );

    await logStructuredEvent("HELP_CONTACTS_SENT", {
      phoneNumber: phoneNumber.substring(phoneNumber.length - 4),
      contactCount: contacts.length,
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
