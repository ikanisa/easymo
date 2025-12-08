import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../../wa/client.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";
import { logStructuredEvent } from "../../../observability.ts";

export interface AdminNotificationPayload {
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
  documentUrl?: string;
}

type AdminContact = {
  id: string;
  displayName: string;
  channel: string;
  destination: string;
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

/**
 * Notify ALL active insurance admin contacts concurrently
 * Each contact gets a notification and a log entry regardless of other failures
 */
export async function notifyInsuranceAdmins(
  client: SupabaseClient,
  payload: AdminNotificationPayload,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leadId, userWaId, extracted } = payload;
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_START", {
    leadId,
    userWaId: userWaId.slice(0, 8) + "***", // Mask PII
  }, "info");

  // Fetch ALL active contacts (broadcast to all)
  const contacts = await fetchActiveContacts(client);

  if (!contacts.length) {
    console.warn("insurance.no_active_admins");
    logStructuredEvent("INSURANCE_ADMIN_NO_TARGETS", {
      leadId,
      userWaId: userWaId.slice(0, 8) + "***",
      message: "No active admin contacts found. Please configure admin contacts.",
    }, "error");
    
    return { sent: 0, failed: 0, errors: ["No active admin contacts found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  
  console.log("insurance.broadcasting_to_all_contacts", {
    leadId,
    totalContacts: contacts.length,
    channels: [...new Set(contacts.map(c => c.channel))],
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_BROADCASTING", {
    leadId,
    totalContacts: contacts.length,
  }, "info");

  // Send to ALL contacts concurrently using Promise.allSettled
  // This ensures one failure doesn't block others
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

  console.log("insurance.broadcast_complete", {
    leadId,
    sent,
    failed,
    totalContacts: contacts.length,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_COMPLETE", {
    leadId,
    sent,
    failed,
    totalContacts: contacts.length,
    hasErrors: errors.length > 0,
  }, sent === 0 && failed > 0 ? "error" : "info");

  return { sent, failed, errors };
}

interface SendToContactOptions {
  contact: AdminContact;
  message: string;
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
}

/**
 * Send notification to a single contact and log the result
 * Always creates a log entry with status='sent' or status='failed'
 */
async function sendToContact(
  client: SupabaseClient,
  options: SendToContactOptions,
): Promise<{ success: boolean; error?: string }> {
  const { contact, message, leadId, userWaId, extracted } = options;
  
  // Only WhatsApp is supported for now
  if (contact.channel !== 'whatsapp') {
    const error = `Unsupported channel: ${contact.channel}`;
    await logNotification(client, contact.id, leadId, 'failed', error, {
      message,
      userWaId,
      extracted,
    });
    return { success: false, error };
  }

  const destination = contact.destination;
  let delivered = false;
  let errorMessage: string | null = null;

  console.log("insurance.attempting_send", {
    contactId: contact.id,
    destination,
    channel: contact.channel,
    messageLength: message.length,
    leadId,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_SEND_ATTEMPT", {
    leadId,
    contactId: contact.id,
    destination: destination.slice(0, 8) + "***", // Mask PII
    messageLength: message.length,
  }, "info");

  try {
    await sendText(destination, message);
    delivered = true;
    console.log("insurance.send_success", {
      contactId: contact.id,
      destination,
      leadId,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_SUCCESS", {
      leadId,
      contactId: contact.id,
      destination: destination.slice(0, 8) + "***", // Mask PII
    }, "info");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
    errorMessage = errMsg;
    console.error("insurance.send_failed", { 
      contactId: contact.id,
      destination,
      error: errMsg,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_FAILED", {
      leadId,
      contactId: contact.id,
      destination: destination.slice(0, 8) + "***", // Mask PII
      error: errMsg,
    }, "error");
  }

  // ALWAYS log the notification attempt (sent or failed)
  await logNotification(
    client,
    contact.id,
    leadId,
    delivered ? 'sent' : 'failed',
    errorMessage,
    {
      message,
      userWaId,
      extracted,
    }
  );

  return { success: delivered, error: errorMessage ?? undefined };
}

/**
 * Fetch all active insurance admin contacts
 */
async function fetchActiveContacts(client: SupabaseClient): Promise<AdminContact[]> {
  try {
    const { data, error } = await client
      .from("insurance_admin_contacts")
      .select("id, display_name, channel, destination")
      .eq("is_active", true)
      .order("created_at");

    if (error) {
      console.error("insurance.fetch_contacts_error", error);
      logStructuredEvent("INSURANCE_ADMIN_FETCH_CONTACTS_ERROR", {
        error: error.message,
      }, "error");
      return [];
    }

    return (data ?? []).map((contact) => ({
      id: contact.id,
      displayName: contact.display_name ?? "Insurance Admin",
      channel: contact.channel ?? "whatsapp",
      destination: contact.destination,
    }));
  } catch (err) {
    console.error("insurance.fetch_contacts_exception", err);
    logStructuredEvent("INSURANCE_ADMIN_FETCH_CONTACTS_EXCEPTION", {
      error: err instanceof Error ? err.message : String(err),
    }, "error");
    return [];
  }
}

/**
 * Log notification attempt to insurance_admin_notifications
 * One row per contact per send attempt
 */
async function logNotification(
  client: SupabaseClient,
  contactId: string,
  leadId: string,
  status: 'sent' | 'failed' | 'queued',
  error: string | null,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { error: insertError } = await client
      .from("insurance_admin_notifications")
      .insert({
        contact_id: contactId,
        lead_id: leadId,
        status,
        error,
        payload,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
        retry_count: 0,
      });

    if (insertError) {
      console.error("insurance.log_notification_error", {
        contactId,
        leadId,
        error: insertError.message,
      });
      logStructuredEvent("INSURANCE_ADMIN_LOG_NOTIFICATION_ERROR", {
        contactId,
        leadId,
        error: insertError.message,
      }, "error");
    }
  } catch (err) {
    console.error("insurance.log_notification_exception", {
      contactId,
      leadId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
