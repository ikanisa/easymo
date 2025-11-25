import type { InsuranceExtraction } from "./ins_normalize.ts";

function safe(
  value: string | number | null | undefined,
  fallback = "—",
): string {
  if (value === null || value === undefined) return fallback;
  const text = typeof value === "number" ? String(value) : value.trim();
  return text.length ? text : fallback;
}

export function buildUserSummary(extracted: InsuranceExtraction): string {
  return [
    "Thanks! Here’s what we captured:",
    `• Insurer: ${safe(extracted.insurer_name)}`,
    `• Policy #: ${safe(extracted.policy_number)}`,
    `• Certificate #: ${safe(extracted.certificate_number)}`,
    `• Plate: ${safe(extracted.registration_plate)}`,
    `• VIN/Chassis: ${safe(extracted.vin_chassis)}`,
    `• Inception: ${safe(extracted.policy_inception)} • Expiry: ` +
      `$${safe(extracted.policy_expiry)}`,
    `• Make/Model/Year: ${safe(extracted.make)}/${safe(extracted.model)}/${safe(extracted.vehicle_year)}`,
    "Our team will contact you shortly.",
  ].join("\n");
}

export function buildUserErrorMessage(): string {
  return "We couldn’t read the document. Please send a clearer photo or a PDF.";
}

export function buildAdminAlert(
  extracted: InsuranceExtraction,
  clientDigits: string,
): string {
  return [
    "New motor insurance lead:",
    `• Plate ${safe(extracted.registration_plate)}, Policy ` +
      `${safe(extracted.policy_number)}, Cert ${safe(extracted.certificate_number)}, Exp ` +
      `${safe(extracted.policy_expiry)}`,
    `Chat client: https://wa.me/${clientDigits}`,
  ].join("\n");
}
