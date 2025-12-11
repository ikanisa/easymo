/**
 * Insurance Admin Module
 * 
 * Handles admin review and approval of insurance certificates
 */

import type { SupabaseClient } from "../deps.ts";
import { sendText } from "../wa/client.ts";
import { logStructuredEvent } from "../observe/log.ts";

export interface InsuranceCertificate {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  vehicle_plate: string;
  insurer_name: string;
  policy_number: string;
  policy_expiry: string;
  created_at: string;
  user_phone: string;
  user_name: string;
}

export interface ManualReview {
  id: string;
  user_id: string;
  media_url: string;
  ocr_attempts: number;
  last_ocr_error: string;
  status: string;
  created_at: string;
  user_phone: string;
  user_name: string;
}

/**
 * Get pending insurance certificates for admin review
 */
export async function getPendingCertificates(
  supabase: SupabaseClient,
  limit = 50,
): Promise<InsuranceCertificate[]> {
  const { data, error } = await supabase.rpc("get_pending_certificates", {
    p_limit: limit,
  });

  if (error) {
    console.error("GET_PENDING_CERTIFICATES_ERROR", error);
    throw error;
  }

  return (data || []) as InsuranceCertificate[];
}

/**
 * Get manual review queue
 */
export async function getManualReviews(
  supabase: SupabaseClient,
  status = "pending",
  limit = 50,
): Promise<ManualReview[]> {
  const { data, error } = await supabase.rpc("get_manual_reviews", {
    p_status: status,
    p_limit: limit,
  });

  if (error) {
    console.error("GET_MANUAL_REVIEWS_ERROR", error);
    throw error;
  }

  return (data || []) as ManualReview[];
}

/**
 * Review and approve/reject an insurance certificate
 */
export async function reviewInsuranceCertificate(
  supabase: SupabaseClient,
  certificateId: string,
  adminId: string,
  approved: boolean,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get certificate details before updating
    const { data: cert, error: fetchError } = await supabase
      .from("driver_insurance_certificates")
      .select("user_id, vehicle_plate, insurer_name, policy_expiry")
      .eq("id", certificateId)
      .single();

    if (fetchError || !cert) {
      return { success: false, error: "Certificate not found" };
    }

    // Update certificate status
    const { error: updateError } = await supabase
      .from("driver_insurance_certificates")
      .update({
        status: approved ? "approved" : "rejected",
        is_validated: approved,
        validated_at: new Date().toISOString(),
        validated_by: adminId,
        rejection_reason: approved ? null : notes,
      })
      .eq("id", certificateId);

    if (updateError) {
      console.error("REVIEW_UPDATE_ERROR", updateError);
      return { success: false, error: updateError.message };
    }

    // Get user's phone number
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone_number, wa_id")
      .eq("user_id", cert.user_id)
      .single();

    const userPhone = profile?.phone_number || profile?.wa_id;

    // Send notification
    if (userPhone) {
      await notifyInsuranceDecision(
        userPhone,
        approved,
        cert.vehicle_plate,
        cert.insurer_name,
        cert.policy_expiry,
        notes,
      );
    }

    // Log admin action
    await logStructuredEvent("INSURANCE_CERTIFICATE_REVIEWED", {
      certificateId,
      adminId,
      approved,
      userId: cert.user_id,
      plate: cert.vehicle_plate,
    });

    return { success: true };
  } catch (error) {
    console.error("REVIEW_CERTIFICATE_ERROR", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send WhatsApp notification for insurance decision
 */
async function notifyInsuranceDecision(
  phone: string,
  approved: boolean,
  plate: string,
  insurer: string,
  expiry: string,
  reason?: string,
): Promise<void> {
  const expiryDate = new Date(expiry).toLocaleDateString();

  if (approved) {
    await sendText(
      phone,
      `✅ Great news! Your insurance certificate has been approved!\n\n` +
      `🚗 Vehicle: ${plate}\n` +
      `🏢 Insurer: ${insurer}\n` +
      `📅 Valid until: ${expiryDate}\n\n` +
      `You can now go online and start accepting rides! 🎉\n\n` +
      `To go online, send "Go Online" or tap the menu.`,
    );
  } else {
    await sendText(
      phone,
      `❌ Your insurance certificate was not approved.\n\n` +
      `🚗 Vehicle: ${plate}\n` +
      `🏢 Insurer: ${insurer}\n\n` +
      `Reason: ${reason || "Certificate does not meet requirements"}\n\n` +
      `Please upload a valid insurance certificate to continue.\n\n` +
      `Need help? Contact support:\n` +
      `📞 WhatsApp: +250 788 123 456\n` +
      `📧 Email: support@easymo.rw`,
    );
  }
}

/**
 * Bulk approve certificates (for admin efficiency)
 */
export async function bulkApproveCertificates(
  supabase: SupabaseClient,
  certificateIds: string[],
  adminId: string,
): Promise<{ approved: number; failed: number }> {
  let approved = 0;
  let failed = 0;

  for (const id of certificateIds) {
    const result = await reviewInsuranceCertificate(
      supabase,
      id,
      adminId,
      true,
    );
    if (result.success) {
      approved++;
    } else {
      failed++;
    }
  }

  await logStructuredEvent("INSURANCE_BULK_APPROVAL", {
    adminId,
    total: certificateIds.length,
    approved,
    failed,
  });

  return { approved, failed };
}

/**
 * Get certificate details for admin review
 */
export async function getCertificateDetails(
  supabase: SupabaseClient,
  certificateId: string,
): Promise<any> {
  const { data, error } = await supabase
    .from("driver_insurance_certificates")
    .select(`
      *,
      profiles!inner(user_id, full_name, phone_number, wa_id),
      vehicles(registration_plate, make, model, vehicle_year)
    `)
    .eq("id", certificateId)
    .single();

  if (error) {
    console.error("GET_CERTIFICATE_DETAILS_ERROR", error);
    throw error;
  }

  return data;
}

/**
 * Get statistics for admin dashboard
 */
export async function getReviewStatistics(
  supabase: SupabaseClient,
): Promise<{
  pending: number;
  approved_today: number;
  rejected_today: number;
  expired: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: stats, error } = await supabase
    .from("driver_insurance_certificates")
    .select("status, validated_at");

  if (error) {
    console.error("GET_REVIEW_STATS_ERROR", error);
    return { pending: 0, approved_today: 0, rejected_today: 0, expired: 0 };
  }

  const pending = stats.filter((s) => s.status === "pending").length;
  const expired = stats.filter((s) => s.status === "expired").length;
  const approved_today = stats.filter(
    (s) =>
      s.status === "approved" &&
      s.validated_at &&
      new Date(s.validated_at) >= today,
  ).length;
  const rejected_today = stats.filter(
    (s) =>
      s.status === "rejected" &&
      s.validated_at &&
      new Date(s.validated_at) >= today,
  ).length;

  return { pending, approved_today, rejected_today, expired };
}
