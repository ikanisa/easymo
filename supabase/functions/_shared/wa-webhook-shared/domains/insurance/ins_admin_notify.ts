import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../../wa/client.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";

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
    .filter((entry) => entry.length >= 8);
}

export async function notifyInsuranceAdmins(
  client: SupabaseClient,
  payload: AdminNotificationPayload,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leadId, userWaId, extracted } = payload;
  const targets = dedupeAdmins(await resolveAdminTargets(client));

  if (!targets.length) {
    console.warn("insurance.no_active_admins");
    return { sent: 0, failed: 0, errors: ["No active admins found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const admin of targets) {
    const adminWaId = normalizeAdminWaId(admin.waId);
    if (!adminWaId) {
      errors.push("Missing admin wa_id");
      failed++;
      continue;
    }

    const now = new Date().toISOString();
    let delivered = false;
    let lastError: string | null = null;

    try {
      await sendText(adminWaId, message);
      delivered = true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
      lastError = errMsg;
      console.warn("insurance.admin_direct_send_fail", { admin: adminWaId, error: errMsg });
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
      } catch (tplError) {
        const tplMsg = tplError instanceof Error ? tplError.message : String(tplError ?? "unknown");
        lastError = `${errMsg} | tpl:${tplMsg}`;
        console.error("insurance.admin_template_send_fail", { admin: adminWaId, error: tplMsg });
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
      errors.push(`${adminWaId}: ${auditError}`);
      failed++;
      continue;
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
      errors.push(`${adminWaId}: ${notifError.message}`);
      failed++;
      continue;
    }

    console.log("insurance.admin_notif_recorded", {
      admin: adminWaId,
      leadId,
      userWaId,
      delivered,
    });

    if (delivered) {
      sent++;
    } else {
      failed++;
    }
  }

  console.log("insurance.admin_notifications_complete", {
    leadId,
    sent,
    failed,
    totalAdmins: targets.length,
  });

  return { sent, failed, errors };
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

async function resolveAdminTargets(client: SupabaseClient): Promise<AdminTarget[]> {
  const contacts = await fetchActiveContacts(client);
  if (contacts.length) return contacts;

  const { data: admins, error } = await client
    .from("insurance_admins")
    .select("wa_id, name")
    .eq("is_active", true)
    .order("created_at");

  if (error) {
    console.error("insurance.admin_fetch_fail", error);
    return [];
  }

  const mapped = (admins ?? [])
    .map((admin) => ({
      waId: normalizeAdminWaId(
        typeof admin.wa_id === "string" ? admin.wa_id.trim() : "",
      ),
      name: admin.name ?? "Insurance Admin",
    }))
    .filter((entry) => entry.waId && entry.waId.length >= 8);

  if (mapped.length) return mapped;

  const fallbackAdmins = getFallbackAdminIds();
  return fallbackAdmins.map((waId) => ({
    waId,
    name: "fallback",
  }));
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
      .filter((entry) => entry.waId && entry.waId.length >= 8);
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
