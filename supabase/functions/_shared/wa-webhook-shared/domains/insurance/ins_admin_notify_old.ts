import type { SupabaseClient } from "@supabase/supabase-js";
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

type AdminTarget = {
  waId: string;
  name: string;
  contactId?: string;
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

function getFallbackAdminIds(): string[] {
  const raw = Deno.env.get("INSURANCE_ADMIN_FALLBACK_WA_IDS") ?? "";
  if (!raw.trim()) return [];
  return raw.split(",")
    .map((entry) => normalizeAdminWaId(entry))
    .filter((entry) => entry.length >= MIN_WHATSAPP_ID_LENGTH);
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

  const { targets, resolutionSource } = await resolveAdminTargets(client);
  const dedupedTargets = dedupeAdmins(targets);

  if (!dedupedTargets.length) {
    console.warn("insurance.no_active_admins");
    logStructuredEvent("INSURANCE_ADMIN_NO_TARGETS", {
      leadId,
      userWaId: userWaId.slice(0, 8) + "***",
      checkedSources: ["insurance_admin_contacts", "insurance_admins", "INSURANCE_ADMIN_FALLBACK_WA_IDS"],
      message: "No active admin contacts found in any source. Please configure admin contacts.",
    }, "error");
    
    // Insert critical alert to notifications table for ADMIN monitoring (not sent to user)
    // This creates an internal alert record that can be monitored by ops team
    try {
      // Use configured system alert admin WA ID, or skip alert if not configured
      // Set SYSTEM_ALERT_ADMIN_WA_ID env var to enable system alerts
      const systemAlertWaId = Deno.env.get("SYSTEM_ALERT_ADMIN_WA_ID");
      if (systemAlertWaId) {
        await client.from("notifications").insert({
          to_wa_id: systemAlertWaId, // System admin contact, NOT the user
          notification_type: "system_alert",
          payload: {
            alert_type: "CRITICAL",
            event: "INSURANCE_ADMIN_NO_TARGETS",
            leadId,
            userWaId: userWaId.slice(0, 8) + "***", // Masked
            message: "Insurance admin notification failed: No admin contacts configured. Please add contacts to insurance_admin_contacts table or set INSURANCE_ADMIN_FALLBACK_WA_IDS environment variable.",
            fix_instructions: [
              "Add admin contacts to insurance_admin_contacts table with contact_type='whatsapp' and is_active=true",
              "OR set INSURANCE_ADMIN_FALLBACK_WA_IDS environment variable (comma-separated WhatsApp IDs)",
              "OR add entries to insurance_admins table with is_active=true",
            ],
          },
          status: "queued",
          retry_count: 0,
        });
      } else {
        console.warn("SYSTEM_ALERT_ADMIN_WA_ID not configured - system alert not sent");
      }
    } catch (alertError) {
      console.error("Failed to insert system alert:", alertError);
    }
    
    return { sent: 0, failed: 0, errors: ["No active admins found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  
  console.log("insurance.sending_to_all_admins", {
    leadId,
    totalAdmins: dedupedTargets.length,
    adminWaIds: dedupedTargets.map(t => normalizeAdminWaId(t.waId)).filter(Boolean),
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_SENDING", {
    leadId,
    totalAdmins: dedupedTargets.length,
    resolutionSource,
  }, "info");

  // Send to ALL admins concurrently (not sequentially)
  const resolvedTargetsCount = dedupedTargets.length;
  const results = await Promise.allSettled(
    dedupedTargets.map((admin) => sendToAdmin(client, {
      admin,
      message,
      leadId,
      userWaId,
      extracted,
      resolutionSource,
      resolvedTargetsCount,
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
          errors.push(`${dedupedTargets[index].waId}: ${result.value.error}`);
        }
      }
    } else {
      failed++;
      errors.push(`${dedupedTargets[index].waId}: ${result.reason}`);
    }
  });

  console.log("insurance.admin_notifications_complete", {
    leadId,
    sent,
    failed,
    totalAdmins: dedupedTargets.length,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_NOTIFY_COMPLETE", {
    leadId,
    sent,
    failed,
    totalAdmins: dedupedTargets.length,
    resolutionSource,
    hasErrors: errors.length > 0,
  }, sent === 0 && failed > 0 ? "error" : "info");

  return { sent, failed, errors };
}

// Options for sendToAdmin function
interface SendToAdminOptions {
  admin: AdminTarget;
  message: string;
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
  resolutionSource: string;
  resolvedTargetsCount: number;
}

// Helper function to send notification to a single admin
async function sendToAdmin(
  client: SupabaseClient,
  options: SendToAdminOptions,
): Promise<{ success: boolean; error?: string }> {
  const { admin, message, leadId, userWaId, extracted, resolutionSource, resolvedTargetsCount } = options;
  const adminWaId = normalizeAdminWaId(admin.waId);
  if (!adminWaId) {
    return { success: false, error: "Missing admin wa_id" };
  }

  const now = new Date().toISOString();
  let delivered = false;
  let lastError: string | null = null;

  console.log("insurance.attempting_whatsapp_send", {
    admin: adminWaId,
    messageLength: message.length,
    leadId,
  });
  
  logStructuredEvent("INSURANCE_ADMIN_SEND_ATTEMPT", {
    leadId,
    adminWaId: adminWaId.slice(0, 8) + "***", // Mask PII
    messageLength: message.length,
  }, "info");

  try {
    await sendText(adminWaId, message);
    delivered = true;
    console.log("insurance.whatsapp_send_success", {
      admin: adminWaId,
      leadId,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_SUCCESS", {
      leadId,
      adminWaId: adminWaId.slice(0, 8) + "***", // Mask PII
    }, "info");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
    lastError = errMsg;
    console.error("insurance.admin_direct_send_fail", { 
      admin: adminWaId, 
      error: errMsg,
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    logStructuredEvent("INSURANCE_ADMIN_SEND_FAILED", {
      leadId,
      adminWaId: adminWaId.slice(0, 8) + "***", // Mask PII
      error: errMsg,
      attemptType: "direct_send",
    }, "error");
    try {
      const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
      const lang = Deno.env.get("WA_TEMPLATE_LANG") ?? "en";
      const compact = message.replace(/[*_]|[\r\n]+/g, " ").trim().slice(0, 1024);
      const { sendTemplate } = await import("../../wa/client.ts");
      await sendTemplate(adminWaId, {
        name: templateName,
        language: lang,
        bodyParameters: [{ type: "text", text: compact }],
      });
      delivered = true;
      lastError = null;
      logStructuredEvent("INSURANCE_ADMIN_SEND_SUCCESS", {
        leadId,
        adminWaId: adminWaId.slice(0, 8) + "***", // Mask PII
        attemptType: "template_fallback",
      }, "info");
    } catch (tplError) {
      const tplMsg = tplError instanceof Error ? tplError.message : String(tplError ?? "unknown");
      lastError = `${errMsg} | tpl:${tplMsg}`;
      console.error("insurance.admin_template_send_fail", { admin: adminWaId, error: tplMsg });
      logStructuredEvent("INSURANCE_ADMIN_SEND_FAILED", {
        leadId,
        adminWaId: adminWaId.slice(0, 8) + "***", // Mask PII
        error: tplMsg,
        attemptType: "template_fallback",
      }, "error");
    }
  }

  const auditInsert = await client
    .from("insurance_admin_notifications")
    .insert({
      lead_id: leadId,
      admin_wa_id: adminWaId,
      user_wa_id: userWaId,
      notification_payload: {
        message,
        extracted,
        lead_id: leadId,
        user_wa_id: userWaId,
        resolved_targets_count: resolvedTargetsCount,
        resolution_source: resolutionSource,
      },
      status: delivered ? "sent" : "queued",
      sent_at: delivered ? now : null,
      retry_count: 0,
      error_message: delivered ? null : lastError,
      updated_at: now,
    })
    .select("id")
    .single();

  if (auditInsert.error || !auditInsert.data) {
    const auditError = auditInsert.error?.message ?? "audit_insert_failed";
    console.error("insurance.admin_notif_record_fail", {
      admin: adminWaId,
      error: auditError,
    });
    return { success: false, error: auditError };
  }

  const adminNotificationId = auditInsert.data.id;

  const { error: notifError } = await client
    .from("notifications")
    .insert({
      to_wa_id: adminWaId,
      notification_type: "insurance_admin_alert",
      payload: {
        text: message,
        lead_id: leadId,
        user_wa_id: userWaId,
        extracted,
        admin_notification_id: adminNotificationId,
        admin_contact_id: admin.contactId ?? null,
      },
      status: delivered ? "sent" : "queued",
      sent_at: delivered ? now : null,
      retry_count: 0,
    });

  if (notifError) {
    console.error("insurance.admin_notif_queue_fail", {
      admin: adminWaId,
      error: notifError.message,
    });
    return { success: false, error: notifError.message };
  }

  console.log("insurance.admin_notif_recorded", {
    admin: adminWaId,
    leadId,
    userWaId,
    delivered,
  });

  return { success: delivered };
}

export async function sendDirectAdminNotification(
  client: SupabaseClient,
  adminWaId: string,
  message: string,
  metadata?: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await client
      .from("notifications")
      .insert({
        to_wa_id: adminWaId,
        notification_type: "insurance_admin_direct",
        payload: {
          text: message,
          metadata,
        },
        status: "queued",
        retry_count: 0,
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
}

async function resolveAdminTargets(client: SupabaseClient): Promise<{ targets: AdminTarget[]; resolutionSource: string }> {
  const contacts = await fetchActiveContacts(client);
  if (contacts.length) return { targets: contacts, resolutionSource: "insurance_admin_contacts" };

  const { data: admins, error } = await client
    .from("insurance_admins")
    .select("wa_id, name")
    .eq("is_active", true)
    .order("created_at");

  if (error) {
    console.error("insurance.admin_fetch_fail", error);
    return { targets: [], resolutionSource: "none" };
  }

  const mapped = (admins ?? [])
    .map((admin) => ({
      waId: normalizeAdminWaId(
        typeof admin.wa_id === "string" ? admin.wa_id.trim() : "",
      ),
      name: admin.name ?? "Insurance Admin",
    }))
    .filter((entry) => entry.waId && entry.waId.length >= MIN_WHATSAPP_ID_LENGTH);

  if (mapped.length) return { targets: mapped, resolutionSource: "insurance_admins" };

  const fallbackAdmins = getFallbackAdminIds();
  return { 
    targets: fallbackAdmins.map((waId) => ({
      waId,
      name: "fallback",
    })), 
    resolutionSource: fallbackAdmins.length > 0 ? "INSURANCE_ADMIN_FALLBACK_WA_IDS" : "none" 
  };
}

async function fetchActiveContacts(client: SupabaseClient): Promise<AdminTarget[]> {
  try {
    const { data, error } = await client
      .from("insurance_admin_contacts")
      .select("id, contact_value, display_name")
      .eq("is_active", true)
      .eq("contact_type", "whatsapp")
      .order("display_order");

    if (error) {
      console.error("insurance.admin_contacts_fetch_fail", error);
      return [];
    }

    return (data ?? [])
      .map((contact) => ({
        contactId: contact.id,
        waId: normalizeAdminWaId(contact.contact_value ?? ""),
        name: contact.display_name ?? "Insurance Admin",
      }))
      .filter((entry) => entry.waId && entry.waId.length >= MIN_WHATSAPP_ID_LENGTH);
  } catch (err) {
    console.error("insurance.admin_contacts_fetch_error", err);
    return [];
  }
}
function dedupeAdmins(targets: AdminTarget[]): AdminTarget[] {
  const map = new Map<string, AdminTarget>();
  for (const target of targets) {
    const id = normalizeAdminWaId(target.waId);
    if (!id) continue;
    if (!map.has(id)) {
      map.set(id, { ...target, waId: id });
    }
  }
  return Array.from(map.values());
}
