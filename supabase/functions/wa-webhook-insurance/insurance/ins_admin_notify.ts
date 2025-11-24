import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../../_shared/wa-webhook-shared/wa/client.ts";
import type { InsuranceExtraction } from "./ins_normalize.ts";

export interface AdminNotificationPayload {
  leadId: string;
  userWaId: string;
  extracted: InsuranceExtraction;
  documentUrl?: string;
}

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
  const digits = value.replace(/[^0-9]/g, "").trim();
  return digits;
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

  // Sync admins from contacts to ensure complete list (idempotent)
  try {
    await client.rpc('sync_insurance_admins_from_contacts');
  } catch (e) {
    console.warn('insurance.admin_sync_contacts_warn', e instanceof Error ? e.message : String(e ?? 'err'));
    // Fallback: perform programmatic sync if RPC not available
    try {
      const { data: contacts, error: contactsError } = await client
        .from('insurance_admin_contacts')
        .select('contact_type, contact_value, display_name, is_active')
        .eq('is_active', true)
        .order('display_order');
      if (!contactsError && contacts && contacts.length) {
        const rows = contacts
          .filter((c: any) => String(c.contact_type || '').toLowerCase() === 'whatsapp')
          .map((c: any) => ({
            wa_id: normalizeAdminWaId(c.contact_value || ''),
            name: (c.display_name || 'Insurance Admin').trim(),
            role: 'admin',
            is_active: true,
            receives_all_alerts: true,
          }))
          .filter((r) => r.wa_id && r.wa_id.length >= 8);
        if (rows.length) {
          const { error: upErr } = await client
            .from('insurance_admins')
            .upsert(rows, { onConflict: 'wa_id' });
          if (upErr) console.warn('insurance.admin_programmatic_upsert_fail', upErr.message);
        }
      }
    } catch (e2) {
      console.warn('insurance.admin_programmatic_sync_warn', e2 instanceof Error ? e2.message : String(e2 ?? 'err'));
    }
  }

  // Fetch active admins (primary table)
  const { data: admins, error: adminError } = await client
    .from("insurance_admins")
    .select("wa_id, name")
    .eq("is_active", true)
    .order("created_at");

  if (adminError) {
    console.error("insurance.admin_fetch_fail", adminError);
    return { sent: 0, failed: 0, errors: [adminError.message] };
  }

  let dbAdmins = (admins ?? [])
    .map((admin) => ({
      wa_id: typeof admin.wa_id === "string" ? admin.wa_id.trim() : "",
      name: admin.name ?? "",
    }))
    .map((a) => ({ ...a, wa_id: normalizeAdminWaId(a.wa_id) }))
    .filter((a) => a.wa_id && a.wa_id.length >= 8);

  // Fallback: use insurance_admin_contacts if primary table is empty
  if (!dbAdmins.length) {
    try {
      const { data: contacts, error: contactsError } = await client
        .from("insurance_admin_contacts")
        .select("contact_type, contact_value, display_name")
        .eq("is_active", true)
        .order("display_order");
      if (!contactsError && contacts && contacts.length) {
        dbAdmins = contacts
          .filter((c: any) => String(c.contact_type || "").toLowerCase() === "whatsapp")
          .map((c: any) => ({
            wa_id: (c.contact_value || "").trim(),
            name: c.display_name || "admin",
          }))
          .filter((c: any) => Boolean(c.wa_id));
      }
    } catch (_) {
      // swallow and continue to env fallback
    }
  }

  const fallbackAdmins = getFallbackAdminIds();
  const targets = dbAdmins.length
    ? dbAdmins
    : fallbackAdmins.map((waId) => ({ wa_id: waId, name: "fallback" }));

  if (!targets.length) {
    console.warn("insurance.no_active_admins");
    return { sent: 0, failed: 0, errors: ["No active admins found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const admin of targets) {
    const adminWaId = normalizeAdminWaId(admin.wa_id);
    if (!adminWaId) {
      errors.push("Missing admin wa_id");
      failed++;
      continue;
    }

    try {
      // Try free-form text first (works only within 24h customer service window)
      await sendText(adminWaId, message);
    } catch (error) {
      // Fallback to approved template for business-initiated delivery outside 24h
      const errMsg = error instanceof Error ? error.message : String(error ?? "unknown");
      console.warn("insurance.admin_direct_send_fail", { admin: adminWaId, error: errMsg });
      try {
        const templateName = Deno.env.get("WA_INSURANCE_ADMIN_TEMPLATE") ?? "insurance_admin_alert";
        const lang = Deno.env.get("WA_TEMPLATE_LANG") ?? "en";
        // Compact message as 1 body parameter to match a generic template
        const compact = message.replace(/[*_]|[\r\n]+/g, ' ').trim().slice(0, 1024);
        const { sendTemplate } = await import("../../_shared/wa-webhook-shared/wa/client.ts");
        await sendTemplate(adminWaId, { name: templateName, language: lang, bodyParameters: [{ type: 'text', text: compact }] });
      } catch (tplError) {
        const tplMsg = tplError instanceof Error ? tplError.message : String(tplError ?? "unknown");
        console.error("insurance.admin_template_send_fail", { admin: adminWaId, error: tplMsg });
        errors.push(`${adminWaId}: ${errMsg} | tpl:${tplMsg}`);
        failed++;
        continue;
      }
    }

    try {
      // Queue notification via notifications table
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
          },
          status: "queued",
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

      // Track admin notification
      // Insert audit only if admin exists in insurance_admins (FK constraint)
      const { data: exists } = await client
        .from("insurance_admins")
        .select("wa_id")
        .eq("wa_id", adminWaId)
        .maybeSingle();
      if (exists?.wa_id) {
        const { error: auditError } = await client
          .from("insurance_admin_notifications")
          .insert({
            lead_id: leadId,
            admin_wa_id: adminWaId,
            user_wa_id: userWaId,
            notification_payload: {
              message,
              extracted,
            },
            status: "queued",
          });
        if (auditError) {
          console.error("insurance.admin_notif_record_fail", {
            admin: adminWaId,
            error: auditError.message,
          });
          errors.push(`${adminWaId}: ${auditError.message}`);
          failed++;
          continue;
        }
      }

      console.log("insurance.admin_notif_queued", {
        admin: adminWaId,
        leadId,
        userWaId,
      });
      sent++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("insurance.admin_notif_error", {
        admin: adminWaId,
        error: msg,
      });
      errors.push(`${adminWaId}: ${msg}`);
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
