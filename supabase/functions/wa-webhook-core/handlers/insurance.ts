import { logStructuredEvent } from "../../_shared/observability.ts";
import { supabase } from "../../_shared/wa-webhook-shared/config.ts";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";

type InsuranceContact = {
  phone: string;
  display_name?: string | null;
};

async function fetchInsuranceContacts(
  maskedPhone: string,
  correlationId: string,
): Promise<InsuranceContact[] | null> {
  // Primary schema: `phone` (whitelist-style table)
  const phoneAttempt = await supabase
    .from("insurance_admin_contacts")
    .select("phone, display_name")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (!phoneAttempt.error) {
    return (phoneAttempt.data ?? []).map((c: any) => ({
      phone: String(c.phone ?? ""),
      display_name: c.display_name ?? null,
    }));
  }

  const phoneError = phoneAttempt.error.message ?? "unknown_error";
  const looksLikePhoneColumnMissing =
    /phone/i.test(phoneError) && /(does not exist|column)/i.test(phoneError);

  // Fallback schema: `destination` (legacy/admin-contacts style table)
  if (looksLikePhoneColumnMissing) {
    const destinationAttempt = await supabase
      .from("insurance_admin_contacts")
      .select("destination, display_name")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!destinationAttempt.error) {
      await logStructuredEvent("INSURANCE_CONTACT_SCHEMA_FALLBACK", {
        from: maskedPhone,
        correlationId,
        primarySchema: "phone",
        fallbackSchema: "destination",
        primaryError: phoneError,
      }, "warn");

      return (destinationAttempt.data ?? []).map((c: any) => ({
        phone: String(c.destination ?? ""),
        display_name: c.display_name ?? null,
      }));
    }

    await logStructuredEvent("INSURANCE_CONTACT_QUERY_ERROR", {
      from: maskedPhone,
      correlationId,
      primarySchema: "phone",
      fallbackSchema: "destination",
      primaryError: phoneError,
      fallbackError: destinationAttempt.error.message ?? "unknown_error",
    }, "error");
    return null;
  }

  await logStructuredEvent("INSURANCE_CONTACT_QUERY_ERROR", {
    from: maskedPhone,
    correlationId,
    schema: "phone",
    error: phoneError,
  }, "error");
  return null;
}

/**
 * Simple insurance flow:
 * - fetch active contacts from insurance_admin_contacts (phone, display_name)
 * - send wa.me links to user
 */
export async function handleInsuranceAgentRequest(
  phoneNumber: string,
  correlationId?: string,
): Promise<void> {
  const corrId = correlationId || crypto.randomUUID();

  if (!phoneNumber || typeof phoneNumber !== "string" || phoneNumber.trim().length === 0) {
    await logStructuredEvent("INSURANCE_INVALID_PHONE", {
      correlationId: corrId,
    }, "error");
    throw new Error("Invalid phone number provided to handleInsuranceAgentRequest");
  }

  const maskedPhone = `***${phoneNumber.slice(-4)}`;

  try {
    await logStructuredEvent("INSURANCE_REQUEST_START", {
      from: maskedPhone,
      correlationId: corrId,
    });

    const contacts = await fetchInsuranceContacts(maskedPhone, corrId);
    if (!contacts) {
      await sendText(phoneNumber, "🛡️ *Insurance Services*\n\nFor insurance services, please contact our support team.");
      return;
    }

    if (!contacts || contacts.length === 0) {
      await logStructuredEvent("INSURANCE_NO_CONTACTS_FOUND", {
        from: maskedPhone,
        correlationId: corrId,
      }, "warn");
      await sendText(phoneNumber, "🛡️ *Insurance Services*\n\nInsurance services are currently unavailable. Please try again later.");
      return;
    }

    await logStructuredEvent("INSURANCE_CONTACTS_FETCHED", {
      from: maskedPhone,
      contactCount: contacts.length,
      correlationId: corrId,
    });

    const prefilledMessage = encodeURIComponent("Hi, I need motor insurance. Can you help me with a quote?");
    let message = "🛡️ *Insurance Made Easy!*\n\n";
    message += "Get protected today! Our insurance team is ready to help you.\n\n";
    message += "📞 *Contact our agents:*\n\n";

    contacts.forEach((contact: any, index: number) => {
      // Use phone column (correct schema)
      const phone = contact.phone || "";
      const cleanNumber = String(phone).replace(/^\+/, "").replace(/\D/g, "");
      if (!cleanNumber) return;
      const whatsappLink = `https://wa.me/${cleanNumber}?text=${prefilledMessage}`;
      message += `${index + 1}. ${contact.display_name || "Insurance Agent"}\n`;
      message += `   💬 ${whatsappLink}\n\n`;
    });

    message += "✨ _Fast quotes • Easy claims • Peace of mind_";

    await sendText(phoneNumber, message.trim());

    await logStructuredEvent("INSURANCE_MESSAGE_SENT", {
      from: maskedPhone,
      contactCount: contacts.length,
      correlationId: corrId,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await logStructuredEvent("INSURANCE_HANDLER_ERROR", {
      from: maskedPhone,
      error: errorMessage,
      correlationId: corrId,
    }, "error");
    await sendText(phoneNumber, "🛡️ *Insurance Services*\n\nFor insurance services, please contact our support team.");
  }
}
