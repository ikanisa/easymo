export type InsuranceExtraction = {
  insurer_name: string | null;
  policy_number: string | null;
  certificate_number: string | null;
  policy_inception: string | null;
  policy_expiry: string | null;
  carte_jaune_number: string | null;
  carte_jaune_expiry: string | null;
  make: string | null;
  model: string | null;
  vehicle_year: number | null;
  registration_plate: string | null;
  vin_chassis: string | null;
  usage: string | null;
  licensed_to_carry: number | null;
};

const REQUIRED_FIELDS = [
  "insurer_name",
  "policy_number",
  "certificate_number",
  "policy_inception",
  "policy_expiry",
  "registration_plate",
] as const;

function toNullableString(
  value: unknown,
  { upper = false } = {},
): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return upper ? trimmed.toUpperCase() : trimmed;
}

function normalizePlate(value: unknown): string | null {
  const base = toNullableString(value, { upper: true });
  if (!base) return null;
  return base.replace(/[\s-]+/g, "");
}

function normalizeVin(value: unknown): string | null {
  return toNullableString(value, { upper: true });
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function ensureObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeInsuranceExtraction(
  raw: unknown,
): InsuranceExtraction {
  const source = ensureObject(raw);

  const extracted: InsuranceExtraction = {
    // Fields should already match from OCR schema, but support legacy field names too
    insurer_name: toNullableString(source.insurer_name) ?? toNullableString(source.insurer),
    policy_number: toNullableString(source.policy_number) ?? toNullableString(source.policy_no),
    certificate_number: toNullableString(source.certificate_number),
    policy_inception: normalizeDate(source.policy_inception) ?? normalizeDate(source.effective_from),
    policy_expiry: normalizeDate(source.policy_expiry) ?? normalizeDate(source.expires_on),
    carte_jaune_number: toNullableString(source.carte_jaune_number),
    carte_jaune_expiry: normalizeDate(source.carte_jaune_expiry),
    make: toNullableString(source.make),
    model: toNullableString(source.model),
    vehicle_year: normalizeInteger(source.vehicle_year),
    registration_plate: normalizePlate(source.registration_plate),
    vin_chassis: normalizeVin(source.vin_chassis),
    usage: toNullableString(source.usage),
    licensed_to_carry: normalizeInteger(source.licensed_to_carry),
  };

  for (const key of REQUIRED_FIELDS) {
    if (!extracted[key]) {
      extracted[key] = null;
    }
  }

  return extracted;
}
