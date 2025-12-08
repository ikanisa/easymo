/**
 * Vehicle Certificate Extraction Schema
 * JSON Schema for Yellow Card extraction
 */

export const VEHICLE_SCHEMA = {
  type: "object",
  properties: {
    plate: { type: "string" },
    policy_no: { type: "string" },
    insurer: { type: "string" },
    effective_from: { type: "string" },
    expires_on: { type: "string" },
  },
  required: [],
  additionalProperties: true,
};
