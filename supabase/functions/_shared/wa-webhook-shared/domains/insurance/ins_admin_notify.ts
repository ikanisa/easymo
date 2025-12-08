import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../../wa/client.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";
import { logStructuredEvent } from "../../../observability.ts";

// Constants
const MIN_WHATSAPP_ID_LENGTH = 8;

export interface AdminNotificationPayload {
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
  documentUrl?: string;
}

type AdminContact = {
  id: string;
  destination: string;
  displayName: string;
  channel: 'whatsapp' | 'email';
};

function formatAdminNotificationMessage(
  extracted: InsuranceExtraction,
  userWaId: string,
): string {
  const safe = (val: string | number | null | undefined) =>
    val === null || val === undefined ? "—" : String(val).trim() || "—";

  const sections = [
    "🔔 *New Insurance Certificate Submitted*",
    "",
    "📋 *Certificate Details:*",
    `• Insurer: ${safe(extracted.insurer_name)}`,
    `• Policy Number: ${safe(extracted.policy_number)}`,
    `• Certificate Number: ${safe(extracted.certificate_number)}`,
    `• Registration Plate: ${safe(extracted.registration_plate)}`,
    `• VIN/Chassis: ${safe(extracted.vin_chassis)}`,
    "",
    "📅 *Policy Dates:*",
    `• Inception: ${safe(extracted.policy_inception)}`,
    `• Expiry: ${safe(extracted.policy_expiry)}`,
    "",
    "🚗 *Vehicle Information:*",
    `• Make: ${safe(extracted.make)}`,
    `• Model: ${safe(extracted.model)}`,
    `• Year: ${safe(extracted.vehicle_year)}`,
    `• VIN: ${safe(extracted.vin_chassis)}`,
    "",
    "👤 *Customer Contact:*",
    `• WhatsApp: https://wa.me/${userWaId}`,
    `• Direct: wa.me/${userWaId}`,
    "",
    "💬 *Click the link above to contact the customer directly*",
  ];

  return sections.join("\n");
}

function normalizeAdminWaId(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return hasPlus ? `+${digits}` : digits;
}

export async function notifyInsuranceAdmins(
  client: SupabaseClient,
  payload: AdminNotificationPayload,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leadId, userWaId, extracted } = payload;
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_START", {
    leadId,
    userWaId: userWaId.slice(0, 8) + "***", // Mask PII
  }, "info");

  // Query all active contacts from insurance_admin_contacts table
  const contacts = await fetchActiveContacts(client);

  if (!contacts.length) {
    console.warn("insurance.no_active_admins");
    logStructuredEvent("INSURANCE_ADMIN_NO_TARGETS", {
      leadId,
      userWaId: userWaId.slice(0, 8) + "***",
      message: "No active admin contacts found. Please configure admin contacts in insurance_admin_contacts table.",
    }, "error");
    
    return { sent: 0, failed: 0, errors: ["No active admins found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  
  console.log("insurance.sending_to_all_admins", {
    leadId,
    totalAdmins: contacts.length,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_SENDING", {
    leadId,
    totalAdmins: contacts.length,
  }, "info");

  // Send to ALL contacts concurrently (broadcast)
  const results = await Promise.allSettled(
    contacts.map((contact) => sendToContact(client, {
      contact,
      message,
      leadId,
      userWaId,
      extracted,
    }))
  );

  // Aggregate results
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value.success) {
        sent++;
      } else {
        failed++;
        if (result.value.error) {
          errors.push(`${contacts[index].destination}: ${result.value.error}`);
        }
      }
    } else {
      failed++;
      errors.push(`${contacts[index].destination}: ${result.reason}`);
    }
  });

  console.log("insurance.admin_notifications_complete", {
    leadId,
    sent,
    failed,
    totalAdmins: contacts.length,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_COMPLETE", {
    leadId,
    sent,
    failed,
    totalAdmins: contacts.length,
    hasErrors: errors.length > 0,
  }, sent === 0 && failed > 0 ? "error" : "info");

  return { sent, failed, errors };
}

// Options for sendToContact function
interface SendToContactOptions {
  contact: AdminContact;
  message: string;
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
}

// Helper function to send notification to a single contact
async function sendToContact(
  client: SupabaseClient,
  options: SendToContactOptions,
): Promise<{ success: boolean; error?: string }> {
  const { contact, message, leadId, userWaId, extracted } = options;
  
  // Only support WhatsApp channel for now
  if (contact.channel !== 'whatsapp') {
    const error = `Unsupported channel: ${contact.channel}`;
    
    // Log failed attempt for non-WhatsApp channels
    try {
      await client
        .from("insurance_admin_notifications")
        .insert({
          contact_id: contact.id,
          certificate_id: leadId,
          status: "failed",
          error,
          payload: {
            message,
            extracted,
            lead_id: leadId,
            user_wa_id: userWaId,
          },
          sent_at: new Date().toISOString(),
        });
    } catch (insertError) {
      console.error("Failed to log unsupported channel notification:", insertError);
    }
    
    return { success: false, error };
  }

  const destination = normalizeAdminWaId(contact.destination);
  if (!destination || destination.length < MIN_WHATSAPP_ID_LENGTH) {
    const error = "Invalid WhatsApp ID";
    
    try {
      await client
        .from("insurance_admin_notifications")
        .insert({
          contact_id: contact.id,
          certificate_id: leadId,
          status: "failed",
          error,
          payload: {
            message,
            extracted,
            lead_id: leadId,
            user_wa_id: userWaId,
          },
          sent_at: new Date().toISOString(),
        });
    } catch (insertError) {
      console.error("Failed to log invalid WhatsApp ID notification:", insertError);
    }
    
    return { success: false, error };
  }

  const now = new Date().toISOString();
  let delivered = false;
  let lastError: string | null = null;

  console.log("insurance.attempting_whatsapp_send", {
    contact: destination,
    messageLength: message.length,
    leadId,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_SEND_ATTEMPT", {
    leadId,
    destination: destination.slice(0, 8) + "***", // Mask PII
    messageLength: message.length,
  }, "info");

  try {
    await sendText(destination, message);
    delivered = true;
    console.log("insurance.whatsapp_send_success", {
      contact: destination,
      leadId,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_SUCCESS", {
      leadId,
      destination: destination.slice(0, 8) + "***", // Mask PII
    }, "info");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
    lastError = errMsg;
    console.error("insurance.admin_direct_send_fail", { 
      contact: destination, 
      error: errMsg,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_FAILED", {
      leadId,
      destination: destination.slice(0, 8) + "***", // Mask PII
      error: errMsg,
      attemptType: "direct_send",
    }, "error");
    
    // Try template fallback
    try {
      const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
      const lang = Deno.env.get("WA_TEMPLATE_LANG") ?? "en";
      const compact = message.replace(/[*_]|[\r\n]+/g, " ").trim().slice(0, 1024);
      const { sendTemplate } = await import("../../wa/client.ts");
      await sendTemplate(destination, {
        name: templateName,
        language: lang,
        bodyParameters: [{ type: "text", text: compact }],
      });
      delivered = true;
      lastError = null;
      logStructuredEvent("INSURANCE_ADMIN_SEND_SUCCESS", {
        leadId,
        destination: destination.slice(0, 8) + "***", // Mask PII
        attemptType: "template_fallback",
      }, "info");
    } catch (tplError) {
      const tplMsg = tplError instanceof Error ? tplError.message : String(tplError ?? "unknown");
      lastError = `${errMsg} | tpl:${tplMsg}`;
      console.error("insurance.admin_template_send_fail", { contact: destination, error: tplMsg });
      logStructuredEvent("INSURANCE_ADMIN_SEND_FAILED", {
        leadId,
        destination: destination.slice(0, 8) + "***", // Mask PII
        error: tplMsg,
        attemptType: "template_fallback",
      }, "error");
    }
  }

  // Insert notification log (one row per contact per send)
  const { error: insertError } = await client
    .from("insurance_admin_notifications")
    .insert({
      contact_id: contact.id,
      certificate_id: leadId,
      status: delivered ? "sent" : "failed",
      error: delivered ? null : lastError,
      payload: {
        message,
        extracted,
        lead_id: leadId,
        user_wa_id: userWaId,
      },
      sent_at: now,
    });

  if (insertError) {
    console.error("insurance.admin_notif_record_fail", {
      contact: destination,
      error: insertError.message,
    });
    return { success: false, error: insertError.message };
  }

  console.log("insurance.admin_notif_recorded", {
    contact: destination,
    leadId,
    userWaId,
    delivered,
  });

  return { success: delivered, error: delivered ? undefined : lastError ?? undefined };
}

export async function sendDirectAdminNotification(
  client: SupabaseClient,
  adminWaId: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  // DEPRECATED: This function will be removed in v2.0.0 (Q1 2025)
  // Use insurance_admin_contacts table instead to configure admin recipients
  // All notifications are now sent directly via notifyInsuranceAdmins()
  console.warn("sendDirectAdminNotification is deprecated and will be removed in v2.0.0. Use insurance_admin_contacts table instead.");
  
  try {
    await sendText(adminWaId, message);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

async function fetchActiveContacts(client: SupabaseClient): Promise<AdminContact[]> {
  try {
    const { data, error } = await client
      .from("insurance_admin_contacts")
      .select("id, destination, display_name, channel")
      .eq("is_active", true)
      .order("created_at");

    if (error) {
      console.error("insurance.admin_contacts_fetch_fail", error);
      return [];
    }

    return (data ?? [])
      .map((contact) => ({
        id: contact.id,
        destination: contact.destination ?? "",
        displayName: contact.display_name ?? "Insurance Admin",
        channel: contact.channel as 'whatsapp' | 'email',
      }))
      .filter((contact) => {
        // For WhatsApp, validate phone number
        if (contact.channel === 'whatsapp') {
          const normalized = normalizeAdminWaId(contact.destination);
          return normalized && normalized.length >= MIN_WHATSAPP_ID_LENGTH;
        }
        // For email, just check it's not empty
        if (contact.channel === 'email') {
          return contact.destination.trim().length > 0;
        }
        return false;
      });
  } catch (err) {
    console.error("insurance.admin_contacts_fetch_error", err);
    return [];
  }
}
