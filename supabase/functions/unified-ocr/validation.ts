/**
 * Input validation schemas for unified-ocr requests
 * Prevents malformed requests from reaching OCR processing
 */

export interface InsuranceInlineRequest {
  inline: {
    signedUrl: string;
    mime?: string;
  };
  domain?: "insurance";
}

export interface VehicleRequest {
  profile_id: string;
  org_id: string;
  vehicle_plate: string;
  file_url: string;
  vehicle_id?: string;
  domain?: "vehicle";
}

export type ValidatedRequest = InsuranceInlineRequest | VehicleRequest;

/**
 * Validate insurance inline request
 */
export function validateInsuranceInline(body: any): InsuranceInlineRequest | { error: string } {
  if (!body.inline || typeof body.inline !== "object") {
    return { error: "missing_inline_object" };
  }

  if (typeof body.inline.signedUrl !== "string" || !body.inline.signedUrl.trim()) {
    return { error: "missing_signed_url" };
  }

  // Validate URL format
  try {
    new URL(body.inline.signedUrl);
  } catch {
    return { error: "invalid_signed_url_format" };
  }

  if (body.inline.mime && typeof body.inline.mime !== "string") {
    return { error: "invalid_mime_type" };
  }

  return body as InsuranceInlineRequest;
}

/**
 * Validate vehicle request
 */
export function validateVehicleRequest(body: any): VehicleRequest | { error: string } {
  const required = ["profile_id", "org_id", "vehicle_plate", "file_url"];
  const missing = required.filter((field) => !body[field] || typeof body[field] !== "string");

  if (missing.length > 0) {
    return { error: `missing_required_fields: ${missing.join(", ")}` };
  }

  // Validate file URL format
  try {
    new URL(body.file_url);
  } catch {
    return { error: "invalid_file_url_format" };
  }

  // Validate UUIDs (profile_id, org_id, optional vehicle_id)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  if (!uuidRegex.test(body.profile_id)) {
    return { error: "invalid_profile_id_format" };
  }

  if (!uuidRegex.test(body.org_id)) {
    return { error: "invalid_org_id_format" };
  }

  if (body.vehicle_id && !uuidRegex.test(body.vehicle_id)) {
    return { error: "invalid_vehicle_id_format" };
  }

  return body as VehicleRequest;
}

/**
 * Validate domain parameter
 */
export function validateDomain(domain: string | null): "insurance" | "menu" | "vehicle" | { error: string } {
  if (!domain) {
    return { error: "missing_domain_parameter" };
  }

  const valid = ["insurance", "menu", "vehicle"];
  if (!valid.includes(domain)) {
    return { error: `invalid_domain: must be one of ${valid.join(", ")}` };
  }

  return domain as "insurance" | "menu" | "vehicle";
}
