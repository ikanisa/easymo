// ============================================================================
// DRIVER VERIFICATION HANDLER - COMPLETE VERIFICATION FLOW
// ============================================================================
// Handles complete driver verification including:
// - Driver's license verification (OCR via OpenAI/Gemini)
// - Insurance certificate verification (delegates to driver_insurance.ts)
// - Vehicle inspection status
// - Background check status
// ============================================================================

import { logStructuredEvent } from "../../_shared/observability.ts";
import type { RouterContext } from "../types.ts";
import type { SupabaseClient } from "../deps.ts";
import { setState, clearState, getState } from "../state/store.ts";
import { sendText } from "../wa/client.ts";
import { buildButtons, sendButtonsMessage, sendListMessage } from "../utils/reply.ts";
import { IDS } from "../wa/ids.ts";
import {
  processDriverLicense,
  validateLicenseData,
  saveLicenseCertificate,
  type DriverLicenseData,
} from "../insurance/driver_license_ocr.ts";
import {
  hasValidInsurance,
  getActiveInsurance,
} from "./driver_insurance.ts";

// ============================================================================
// TYPES
// ============================================================================

const VERIFICATION_STATE_KEY = "driver_verification";
const LICENSE_UPLOAD_STATE_KEY = "driver_license_upload";

export type VerificationStatus = {
  licenseVerified: boolean;
  insuranceVerified: boolean;
  vehicleInspected: boolean;
  backgroundCheck: boolean;
  overallComplete: boolean;
  missingItems: string[];
};

export type VerificationStep =
  | "menu"
  | "license_upload"
  | "insurance_redirect"
  | "vehicle_inspection"
  | "background_check";

// ============================================================================
// VERIFICATION STATUS CHECK
// ============================================================================

/**
 * Checks complete driver verification status
 */
export async function checkDriverVerificationStatus(
  ctx: RouterContext
): Promise<VerificationStatus> {
  if (!ctx.profileId) {
    return {
      licenseVerified: false,
      insuranceVerified: false,
      vehicleInspected: false,
      backgroundCheck: false,
      overallComplete: false,
      missingItems: ["profile"],
    };
  }

  const missingItems: string[] = [];

  // Check license
  const { data: license } = await ctx.supabase
    .from("driver_licenses")
    .select("*")
    .eq("user_id", ctx.profileId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const licenseVerified = !!license && !isLicenseExpired(license.expiry_date);
  if (!licenseVerified) missingItems.push("driver_license");

  // Check insurance
  const insuranceVerified = await hasValidInsurance(ctx.supabase, ctx.profileId);
  if (!insuranceVerified) missingItems.push("insurance_certificate");

  // Check vehicle inspection (optional for now)
  const { data: inspection } = await ctx.supabase
    .from("vehicle_inspections")
    .select("*")
    .eq("user_id", ctx.profileId)
    .eq("status", "passed")
    .order("inspection_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const vehicleInspected = !!inspection;
  // Not required for basic operation
  // if (!vehicleInspected) missingItems.push("vehicle_inspection");

  // Check background check (manual process, marked in profile)
  const { data: profile } = await ctx.supabase
    .from("profiles")
    .select("background_check_status, background_check_date")
    .eq("user_id", ctx.profileId)
    .single();

  const backgroundCheck = profile?.background_check_status === "cleared";
  // Not required for basic operation
  // if (!backgroundCheck) missingItems.push("background_check");

  const overallComplete = licenseVerified && insuranceVerified;

  return {
    licenseVerified,
    insuranceVerified,
    vehicleInspected,
    backgroundCheck,
    overallComplete,
    missingItems,
  };
}

// ============================================================================
// VERIFICATION MENU
// ============================================================================

/**
 * Shows driver verification menu
 */
export async function showVerificationMenu(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  const status = await checkDriverVerificationStatus(ctx);

  await setState(ctx.supabase, ctx.profileId, {
    key: VERIFICATION_STATE_KEY,
    data: { step: "menu" },
  });

  const rows = [
    {
      id: IDS.VERIFY_LICENSE,
      title: status.licenseVerified ? "✅ Driver's License" : "📄 Driver's License",
      description: status.licenseVerified
        ? "Verified and active"
        : "Upload your driver's license",
    },
    {
      id: IDS.VERIFY_INSURANCE,
      title: status.insuranceVerified ? "✅ Insurance" : "🛡️ Insurance",
      description: status.insuranceVerified
        ? "Valid insurance on file"
        : "Upload vehicle insurance certificate",
    },
    {
      id: IDS.VERIFY_INSPECTION,
      title: status.vehicleInspected ? "✅ Vehicle Inspection" : "🔧 Vehicle Inspection",
      description: status.vehicleInspected
        ? "Inspection completed"
        : "Optional: Vehicle safety inspection",
    },
    {
      id: IDS.VERIFY_STATUS,
      title: "📊 Verification Status",
      description: status.overallComplete
        ? "All required items complete!"
        : `${status.missingItems.length} items remaining`,
    },
    {
      id: IDS.BACK_MENU,
      title: "← Back",
      description: "Return to main menu",
    },
  ];

  const headerEmoji = status.overallComplete ? "✅" : "📋";
  const headerText = status.overallComplete
    ? "You're fully verified!"
    : "Complete your driver verification";

  await sendListMessage(
    ctx,
    {
      title: "Driver Verification",
      body: headerText,
      sectionTitle: "Verification Items",
      rows,
      buttonText: "View Options",
    },
    { emoji: headerEmoji }
  );

  await logStructuredEvent("DRIVER_VERIFICATION_MENU_SHOWN", {
    userId: ctx.profileId,
    status,
  });

  return true;
}

// ============================================================================
// LICENSE VERIFICATION
// ============================================================================

/**
 * Starts driver's license verification flow
 */
export async function startLicenseVerification(
  ctx: RouterContext
): Promise<boolean> {
  if (!ctx.profileId) return false;

  await setState(ctx.supabase, ctx.profileId, {
    key: LICENSE_UPLOAD_STATE_KEY,
    data: { step: "license_upload" },
  });

  const message =
    "📄 *Driver's License Verification*\n\n" +
    "Please upload a clear photo of your driver's license.\n\n" +
    "We'll automatically verify:\n" +
    "✅ License number\n" +
    "✅ Full name\n" +
    "✅ Expiry date (must not be expired)\n" +
    "✅ License class/category\n\n" +
    "Supported formats: Photo (JPG/PNG) or PDF\n\n" +
    "📸 Take a clear, well-lit photo now!";

  await sendButtonsMessage(
    ctx,
    message,
    buildButtons({ id: IDS.BACK_MENU, title: "← Cancel" })
  );

  await logStructuredEvent("DRIVER_LICENSE_VERIFICATION_STARTED", {
    userId: ctx.profileId,
  });

  return true;
}

/**
 * Handles driver's license upload
 */
export async function handleLicenseUpload(
  ctx: RouterContext,
  mediaId: string,
  mimeType: string
): Promise<boolean> {
  if (!ctx.profileId) return false;

  try {
    // Get WA token from env
    const waToken = Deno.env.get("WA_TOKEN") || "";
    if (!waToken) {
      throw new Error("WA_TOKEN not configured");
    }

    await sendText(ctx.from, "⏳ Processing your driver's license...");

    // Fetch media from WhatsApp
    const { url: signedUrl, mimeType: actualMimeType } = await fetchMediaUrl(
      mediaId,
      waToken
    );

    // Process with OCR (with retry and manual review fallback)
    let data, provider;
    let attempts = 0;
    const MAX_ATTEMPTS = 3;
    let lastError: Error | null = null;

    while (attempts < MAX_ATTEMPTS) {
      try {
        const result = await processDriverLicense(signedUrl, actualMimeType);
        data = result.data;
        provider = result.provider;
        break; // Success, exit retry loop
      } catch (error) {
        attempts++;
        lastError = error instanceof Error ? error : new Error(String(error));
        
        await logStructuredEvent("DRIVER_LICENSE_OCR_RETRY", {
          userId: ctx.profileId,
          attempt: attempts,
          error: lastError.message,
        }, "warn");
        
        if (attempts === MAX_ATTEMPTS) {
          // All retries exhausted, create manual review request
          await sendText(
            ctx.from,
            "⚠️ We're having trouble reading your license automatically. " +
            "Our team will review it manually within 24 hours. " +
            "You'll receive a notification once verified. ✅"
          );
          
          // Create manual review request
          const { error: reviewError } = await ctx.supabase
            .from("manual_reviews")
            .insert({
              user_id: ctx.profileId,
              review_type: "driver_license",
              media_id: mediaId,
              media_url: signedUrl,
              status: "pending",
            });
          
          if (reviewError) {
            await logStructuredEvent("MANUAL_REVIEW_INSERT_FAILED", {
              userId: ctx.profileId,
              error: reviewError.message,
            }, "error");
          } else {
            await logStructuredEvent("MANUAL_REVIEW_CREATED", {
              userId: ctx.profileId,
              reviewType: "driver_license",
            });
          }
          
          return true; // Exit successfully, manual review queued
        }
        
        // Exponential backoff before retry
        const backoffMs = Math.pow(2, attempts) * 1000; // 2s, 4s, 8s
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    // If we get here, OCR succeeded

    // Validate extracted data
    const validation = validateLicenseData(data);
    if (!validation.valid) {
      const missingFields = validation.errors.join(", ");
      await sendText(
        ctx.from,
        `⚠️ Could not read the following from your license:\n${missingFields}\n\n` +
        `Please upload a clearer photo.`
      );
      return true;
    }

    // Check for duplicate license
    const { data: existing } = await ctx.supabase
      .from("driver_licenses")
      .select("user_id")
      .eq("license_number", data.license_number)
      .neq("user_id", ctx.profileId)
      .maybeSingle();

    if (existing) {
      await sendText(
        ctx.from,
        `⚠️ This license number is already registered.\n\n` +
        `If this is your license, please contact support.`
      );
      return true;
    }

    // Save to database
    const { error: saveError } = await saveLicenseCertificate(
      ctx.supabase,
      ctx.profileId,
      data,
      signedUrl,
      mediaId,
      provider,
      data as unknown as Record<string, unknown>
    );

    if (saveError) {
      throw new Error(saveError);
    }

    // Clear state
    await clearState(ctx.supabase, ctx.profileId);

    // Send success message
    const expiryDate = new Date(data.expiry_date).toLocaleDateString();
    await sendText(
      ctx.from,
      `✅ *Driver's License Verified!*\n\n` +
      `📄 License: ${data.license_number}\n` +
      `👤 Name: ${data.full_name}\n` +
      `🚗 Class: ${data.license_class}\n` +
      `📅 Valid until: ${expiryDate}\n\n` +
      `Great! You're one step closer to driving on easyMO! 🎉`
    );

    await logStructuredEvent("DRIVER_LICENSE_VERIFIED", {
      userId: ctx.profileId,
      licenseNumber: data.license_number,
      provider,
    });

    // Show verification menu again
    await showVerificationMenu(ctx);

    return true;
  } catch (error) {
    await logStructuredEvent("DRIVER_LICENSE_UPLOAD_ERROR", {
      userId: ctx.profileId,
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    await sendText(
      ctx.from,
      `⚠️ Failed to process license:\n${error instanceof Error ? error.message : "Unknown error"}\n\n` +
      `Please try again with a clearer photo.`
    );

    return true;
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Checks if license is expired
 */
function isLicenseExpired(expiryDate: string): boolean {
  const expiry = new Date(expiryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return expiry < today;
}

/**
 * Fetch media from WhatsApp and get data URL
 */
async function fetchMediaUrl(
  mediaId: string,
  waToken: string
): Promise<{ url: string; mimeType: string }> {
  // Get media URL from WhatsApp
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v17.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${waToken}`,
      },
    }
  );

  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch media info: ${mediaResponse.status}`);
  }

  const mediaInfo = await mediaResponse.json();
  const mediaUrl = mediaInfo.url;
  const mimeType = mediaInfo.mime_type || "image/jpeg";

  // Download media
  const downloadResponse = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${waToken}`,
    },
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download media: ${downloadResponse.status}`);
  }

  const blob = await downloadResponse.blob();
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

  // Create data URL for OCR
  const dataUrl = `data:${mimeType};base64,${base64}`;

  return { url: dataUrl, mimeType };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const VERIFICATION_STATES = {
  MENU: VERIFICATION_STATE_KEY,
  LICENSE_UPLOAD: LICENSE_UPLOAD_STATE_KEY,
};

export default {
  checkDriverVerificationStatus,
  showVerificationMenu,
  startLicenseVerification,
  handleLicenseUpload,
  VERIFICATION_STATES,
};
