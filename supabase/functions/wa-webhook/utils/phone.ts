export function normalizeE164(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const prefixed = trimmed.startsWith("+") ? `+${digits}` : `+${digits}`;
  // Basic length guard: E.164 max 15 digits, min 8
  if (digits.length < 8 || digits.length > 15) return null;
  return prefixed;
}

export function toE164(raw: string): string {
  const normalized = normalizeE164(raw);
  if (normalized) return normalized;
  const digits = raw.replace(/[^0-9]/g, "");
  return digits ? `+${digits}` : raw.trim();
}
