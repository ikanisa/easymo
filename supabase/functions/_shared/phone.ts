import { parsePhoneNumberFromString } from "https://cdn.jsdelivr.net/npm/libphonenumber-js@1.12.29/+esm";

export function normalizeE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return null;
  // E.164 supports up to 15 digits, typically at least 8 for international numbers
  if (digits.length < 6 || digits.length > 15) return null;
  return `+${digits}`;
}

export function toE164(raw: string): string {
  const normalized = normalizeE164(raw);
  if (normalized) return normalized;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : raw.trim();
}

export function buildNumberLookupCandidates(raw: string): string[] {
  const variants = new Set<string>();
  const trimmed = raw.trim();
  if (trimmed) variants.add(trimmed);

  const collapsed = trimmed.replace(/\s+/g, "");
  if (collapsed) variants.add(collapsed);

  const digitsOnly = trimmed.replace(/[^0-9]/g, "");
  if (digitsOnly) variants.add(digitsOnly);

  const normalized = normalizeE164(trimmed) ??
    normalizeE164(collapsed) ??
    (digitsOnly ? `+${digitsOnly}` : null);
  if (normalized) {
    variants.add(normalized);
    const withoutPlus = normalized.replace(/^\+/, "");
    if (withoutPlus) variants.add(withoutPlus);
    variants.add(`00${withoutPlus}`);
    variants.add(`0${withoutPlus}`);
  }

  return Array.from(variants).filter((value) => value.length > 0);
}

export function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

export function buildDigitFuzzyPattern(digits: string): string {
  if (!digits) return "%";
  return `%${digits.split("").join("%")}%`;
}

export function detectCountryIso(raw: string): string | null {
  const normalized = normalizeE164(raw);
  if (!normalized) return null;
  try {
    const parsed = parsePhoneNumberFromString(normalized);
    return parsed?.country ?? null;
  } catch (_err) {
    return null;
  }
}
