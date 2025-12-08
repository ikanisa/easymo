/**
 * Insurance Certificate Extraction Schema
 * JSON Schema for structured extraction from motor insurance certificates
 * 
 * CRITICAL: Field names MUST match what ins_normalize.ts expects:
 * - insurer_name (not "insurer")
 * - policy_number (not "policy_no")
 * - policy_inception (not "effective_from")
 * - policy_expiry (not "expires_on")
 */

export const INSURANCE_SCHEMA = {
  type: "object",
  properties: {
    insurer_name: { type: "string" },
    policy_number: { type: "string" },
    certificate_number: { type: "string" },
    policy_inception: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    policy_expiry: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    carte_jaune_number: { type: ["string", "null"] },
    carte_jaune_expiry: { type: ["string", "null"], pattern: "^(\\d{4}-\\d{2}-\\d{2})?$" },
    make: { type: ["string", "null"] },
    model: { type: ["string", "null"] },
    vehicle_year: { type: ["integer", "null"] },
    registration_plate: { type: ["string", "null"] },
    vin_chassis: { type: ["string", "null"] },
    usage: { type: ["string", "null"] },
    licensed_to_carry: { type: ["integer", "null"] },
  },
  required: [
    "insurer_name",
    "policy_number",
    "certificate_number",
    "policy_inception",
    "policy_expiry",
  ],
  // Removed additionalProperties: false to allow OpenAI flexibility
};
