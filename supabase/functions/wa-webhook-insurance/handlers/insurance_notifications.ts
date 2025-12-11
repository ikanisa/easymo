/**
 * Insurance Notifications Module
 * 
 * Handles automated notifications for insurance events
 */

import type { SupabaseClient } from "../deps.ts";
import { sendText } from "../wa/client.ts";
import { logStructuredEvent } from "../observe/log.ts";

/**
 * Send expiry reminder notifications
 * Should be called by a cron job daily
 */
export async function sendExpiryReminders(
  supabase: SupabaseClient,
  daysBeforeExpiry = 7,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    // Get expiring insurance certificates
    const { data: expiring, error } = await supabase.rpc(
      "get_expiring_insurance",
      {
        p_days_before: daysBeforeExpiry,
      },
    );

    if (error) {
      console.error("GET_EXPIRING_INSURANCE_ERROR", error);
      return { sent: 0, failed: 0 };
    }

    if (!expiring || expiring.length === 0) {
      return { sent: 0, failed: 0 };
    }

    // Send reminders
    for (const cert of expiring) {
      try {
        const expiryDate = new Date(cert.policy_expiry).toLocaleDateString();
        const daysLeft = Math.ceil(
          (new Date(cert.policy_expiry).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        );

        await sendText(
          cert.user_phone,
          `⚠️ Insurance Expiry Reminder\n\n` +
          `Your insurance for vehicle ${cert.vehicle_plate} expires in ${daysLeft} days.\n\n` +
          `📅 Expiry date: ${expiryDate}\n\n` +
          `Please upload a new insurance certificate to continue driving on easyMO.\n\n` +
          `To upload, send "Upload Insurance" or tap the menu.`,
        );

        // Mark reminder as sent
        await supabase
          .from("driver_insurance_certificates")
          .update({ expiry_reminder_sent_at: new Date().toISOString() })
          .eq("id", cert.id);

        sent++;

        await logStructuredEvent("INSURANCE_EXPIRY_REMINDER_SENT", {
          userId: cert.user_id,
          plate: cert.vehicle_plate,
          daysLeft,
        });
      } catch (error) {
        console.error("SEND_EXPIRY_REMINDER_ERROR", error);
        failed++;
      }
    }

    return { sent, failed };
  } catch (error) {
    console.error("SEND_EXPIRY_REMINDERS_ERROR", error);
    return { sent, failed };
  }
}

/**
 * Send notification when insurance is about to expire (1 day before)
 */
export async function sendUrgentExpiryNotifications(
  supabase: SupabaseClient,
): Promise<{ sent: number; failed: number }> {
  return await sendExpiryReminders(supabase, 1);
}

/**
 * Mark expired certificates as expired
 * Should be called by a cron job daily
 */
export async function markExpiredCertificates(
  supabase: SupabaseClient,
): Promise<{ marked: number }> {
  try {
    const { data, error } = await supabase
      .from("driver_insurance_certificates")
      .update({ status: "expired" })
      .eq("status", "approved")
      .lt("policy_expiry", new Date().toISOString().split("T")[0])
      .select("id");

    if (error) {
      console.error("MARK_EXPIRED_ERROR", error);
      return { marked: 0 };
    }

    const marked = data?.length || 0;

    if (marked > 0) {
      await logStructuredEvent("INSURANCE_CERTIFICATES_EXPIRED", {
        count: marked,
      });
    }

    return { marked };
  } catch (error) {
    console.error("MARK_EXPIRED_CERTIFICATES_ERROR", error);
    return { marked: 0 };
  }
}

/**
 * Send notification to drivers whose insurance just expired
 */
export async function notifyExpiredInsurance(
  supabase: SupabaseClient,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  try {
    // Get certificates that expired today
    const today = new Date().toISOString().split("T")[0];

    const { data: expired, error } = await supabase
      .from("driver_insurance_certificates")
      .select(`
        id,
        user_id,
        vehicle_plate,
        policy_expiry,
        profiles!inner(phone_number, wa_id)
      `)
      .eq("status", "expired")
      .eq("policy_expiry", today);

    if (error || !expired || expired.length === 0) {
      return { sent: 0, failed: 0 };
    }

    for (const cert of expired) {
      try {
        const phone = cert.profiles.phone_number || cert.profiles.wa_id;
        if (!phone) continue;

        await sendText(
          phone,
          `❌ Your insurance has expired\n\n` +
          `🚗 Vehicle: ${cert.vehicle_plate}\n` +
          `📅 Expired: ${new Date(cert.policy_expiry).toLocaleDateString()}\n\n` +
          `You can no longer accept rides until you upload a new insurance certificate.\n\n` +
          `To upload, send "Upload Insurance" or tap the menu.\n\n` +
          `Need help? Contact support: +250 788 123 456`,
        );

        sent++;

        await logStructuredEvent("INSURANCE_EXPIRED_NOTIFICATION_SENT", {
          userId: cert.user_id,
          plate: cert.vehicle_plate,
        });
      } catch (error) {
        console.error("NOTIFY_EXPIRED_ERROR", error);
        failed++;
      }
    }

    return { sent, failed };
  } catch (error) {
    console.error("NOTIFY_EXPIRED_INSURANCE_ERROR", error);
    return { sent, failed };
  }
}

/**
 * Send weekly summary to admins
 */
export async function sendAdminWeeklySummary(
  supabase: SupabaseClient,
  adminPhone: string,
): Promise<void> {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: stats } = await supabase
      .from("driver_insurance_certificates")
      .select("status, created_at, validated_at")
      .gte("created_at", weekAgo.toISOString());

    if (!stats) return;

    const uploaded = stats.length;
    const approved = stats.filter((s) => s.status === "approved").length;
    const rejected = stats.filter((s) => s.status === "rejected").length;
    const pending = stats.filter((s) => s.status === "pending").length;

    await sendText(
      adminPhone,
      `📊 Weekly Insurance Summary\n\n` +
      `📤 Uploaded: ${uploaded}\n` +
      `✅ Approved: ${approved}\n` +
      `❌ Rejected: ${rejected}\n` +
      `⏳ Pending: ${pending}\n\n` +
      `Approval rate: ${uploaded > 0 ? Math.round((approved / uploaded) * 100) : 0}%`,
    );

    await logStructuredEvent("ADMIN_WEEKLY_SUMMARY_SENT", {
      uploaded,
      approved,
      rejected,
      pending,
    });
  } catch (error) {
    console.error("SEND_ADMIN_SUMMARY_ERROR", error);
  }
}
