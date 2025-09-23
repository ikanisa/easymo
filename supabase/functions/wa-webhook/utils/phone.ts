export function toE164(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return s;
  if (s.startsWith("+")) return s;
  if (s.startsWith("250")) return `+${s}`;
  if (s.startsWith("0")) return `+250${s.slice(1)}`;
  return `+${s}`;
}

export function to07FromE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("2507")) return `0${digits.slice(3)}`;
  if (digits.startsWith("07")) return digits;
  return e164;
}
