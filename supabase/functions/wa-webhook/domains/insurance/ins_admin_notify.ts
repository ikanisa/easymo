import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { sendText } from "../../wa/client.ts";
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

export async function notifyInsuranceAdmins(
  client: SupabaseClient,
  payload: AdminNotificationPayload,
): Promise<{ sent: number; failed: number; errors: string[] }> {
  const { leadId, userWaId, extracted } = payload;

  // Fetch active admins
  const { data: admins, error: adminError } = await client
    .from("insurance_admins")
    .select("wa_id, name")
    .eq("is_active", true)
    .order("created_at");

  if (adminError) {
    console.error("insurance.admin_fetch_fail", adminError);
    return { sent: 0, failed: 0, errors: [adminError.message] };
  }

  if (!admins || admins.length === 0) {
    console.warn("insurance.no_active_admins");
    return { sent: 0, failed: 0, errors: ["No active admins found"] };
  }

  const message = formatAdminNotificationMessage(extracted, userWaId);
  const errors: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const admin of admins) {
    const adminWaId = typeof admin.wa_id === "string"
      ? admin.wa_id.trim()
      : "";
    if (!adminWaId) {
      errors.push("Missing admin wa_id");
      failed++;
      continue;
    }

    try {
      await sendText(adminWaId, message);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error ?? "unknown");
      console.error("insurance.admin_direct_send_fail", {
        admin: adminWaId,
        error: msg,
      });
      errors.push(`${adminWaId}: ${msg}`);
      failed++;
      continue;
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
    totalAdmins: admins.length,
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
