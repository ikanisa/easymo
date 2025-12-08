/**
 * Insurance Certificate Extraction Schema
 * JSON Schema for structured extraction
 */

export const INSURANCE_SCHEMA = {
  type: "object",
  properties: {
    policy_no: { type: "string" },
    insurer: { type: "string" },
    effective_from: { type: "string" },
    expires_on: { type: "string" },
    coverage_amount: { type: "number" },
    beneficiary: { type: "string" },
    policy_type: { type: "string" },
  },
  required: ["policy_no", "insurer"],
  additionalProperties: true,
};
