/**
 * Vehicle Domain Handler
 * Processes vehicle insurance certificate (Yellow Card) OCR requests
 * Ported from vehicle-ocr
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { runOpenAIVision } from "../core/openai.ts";
import { logStructuredEvent } from "../../_shared/observability.ts";
import { VEHICLE_SCHEMA } from "../schemas/vehicle.ts";

interface VehicleOCRRequest {
  profile_id: string;
  org_id: string;
  vehicle_plate: string;
  file_url: string;
  vehicle_id?: string;
}

interface OCRFields {
  plate?: string;
  policy_no?: string;
  insurer?: string;
  effective_from?: string;
  expires_on?: string;
}

interface VehicleOCRResponse {
  success: boolean;
  vehicle_id: string;
  status: "active" | "pending";
  reason?: string;
  ocr_confidence?: number;
  fields?: OCRFields;
}

/**
 * Process vehicle OCR request (inline mode only)
 */
export async function processVehicleRequest(
  client: SupabaseClient,
  payload: VehicleOCRRequest,
): Promise<Response> {
  try {
    const { profile_id, org_id, vehicle_plate, file_url, vehicle_id } = payload;

    if (!profile_id || !org_id || !vehicle_plate || !file_url) {
      return jsonResponse({ error: "missing_required_fields" }, 400);
    }

    await logStructuredEvent("VEHICLE_OCR_START", {
      profile_id,
      plate: vehicle_plate,
      has_vehicle_id: !!vehicle_id,
    }, "info");

    // Extract certificate data using OCR
    const ocrResult = await extractCertificateData(file_url);
    const { fields, confidence, raw } = ocrResult;

    // Validate the certificate
    const plateMatch = fields.plate?.toUpperCase() === vehicle_plate.toUpperCase();
    const notExpired = fields.expires_on
      ? new Date(fields.expires_on) >= new Date()
      : false;
    const highConfidence = confidence >= 0.8;
    const isValid = plateMatch && notExpired && highConfidence;

    // Create or update vehicle
    let finalVehicleId = vehicle_id;

    if (!finalVehicleId) {
      const { data: vehicleData, error: vehicleError } = await client
        .from("vehicles")
        .insert({
          org_id,
          profile_id,
          plate: vehicle_plate,
          status: isValid ? "active" : "pending",
        })
        .select("id")
        .single();

      if (vehicleError) {
        // Check if vehicle already exists
        const { data: existingVehicle } = await client
          .from("vehicles")
          .select("id")
          .eq("org_id", org_id)
          .eq("plate", vehicle_plate)
          .single();

        if (existingVehicle) {
          finalVehicleId = existingVehicle.id;
        } else {
          throw vehicleError;
        }
      } else {
        finalVehicleId = vehicleData.id;
      }
    }

    // Store insurance certificate in driver_insurance_certificates
    const { error: certError } = await client
      .from("driver_insurance_certificates")
      .insert({
        user_id: profile_id,
        insurer_name: fields.insurer || "Unknown",
        policy_number: fields.policy_no || "Unknown",
        certificate_number: fields.policy_no || null,
        policy_inception: fields.effective_from || new Date().toISOString(),
        policy_expiry: fields.expires_on || new Date().toISOString(),
        vehicle_plate: vehicle_plate,
        certificate_media_url: file_url,
        ocr_provider: "openai", // or track which provider was used
        ocr_confidence: confidence,
        raw_ocr_data: { raw, fields, confidence },
        is_validated: isValid,
        status: isValid ? "approved" : "pending_review",
      });

    if (certError) {
      await logStructuredEvent("VEHICLE_CERT_STORE_ERROR", {
        error: certError.message,
      }, "error");
      throw certError;
    }

    // If valid, activate the vehicle
    if (isValid) {
      await client
        .from("vehicles")
        .update({ status: "active" })
        .eq("id", finalVehicleId);
    }

    await logStructuredEvent("VEHICLE_OCR_COMPLETE", {
      profile_id,
      vehicle_id: finalVehicleId,
      status: isValid ? "active" : "pending",
      confidence,
    }, "info");

    const response: VehicleOCRResponse = {
      success: true,
      vehicle_id: finalVehicleId,
      status: isValid ? "active" : "pending",
      reason: !isValid
        ? determineFailureReason(plateMatch, notExpired, highConfidence)
        : undefined,
      ocr_confidence: confidence,
      fields,
    };

    return jsonResponse(response);
  } catch (error) {
    await logStructuredEvent("VEHICLE_OCR_ERROR", {
      error: error instanceof Error ? error.message : String(error),
    }, "error");

    return jsonResponse(
      {
        success: false,
        error: "internal_server_error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
}

/**
 * Extract certificate data using OCR
 */
async function extractCertificateData(
  fileUrl: string,
): Promise<{
  fields: OCRFields;
  confidence: number;
  raw: any;
}> {
  const imageBase64 = await urlToBase64(fileUrl);

  const prompt = {
    system:
      "You are an expert at extracting information from vehicle insurance certificates (Yellow Cards). Extract the following fields: plate number, policy number, insurer name, effective date, and expiry date. Return as JSON.",
    user:
      "Extract: plate, policy_no, insurer, effective_from (YYYY-MM-DD), expires_on (YYYY-MM-DD)",
  };

  const response = await runOpenAIVision({
    imageBase64,
    contentType: "image/jpeg",
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    schema: VEHICLE_SCHEMA,
    maxTokens: 500,
    temperature: 0.1,
  });

  const fields: OCRFields = response.parsed || {};

  // Calculate confidence based on field completeness
  const fieldCount = Object.keys(fields).filter(
    (k) => fields[k as keyof OCRFields],
  ).length;
  const confidence = Math.min((fieldCount / 5) * 100, 95) / 100; // Max 95% from OCR

  return {
    fields,
    confidence,
    raw: response.raw,
  };
}

/**
 * Convert URL to base64
 */
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  return bytesToBase64(bytes);
}

/**
 * Convert bytes to base64
 */
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

/**
 * Determine failure reason
 */
function determineFailureReason(
  plateMatch: boolean,
  notExpired: boolean,
  highConfidence: boolean,
): string {
  if (!plateMatch) return "plate_mismatch";
  if (!notExpired) return "certificate_expired";
  if (!highConfidence) return "low_confidence";
  return "unknown";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
