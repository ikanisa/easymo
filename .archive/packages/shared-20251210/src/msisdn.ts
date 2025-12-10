export function maskMsisdn(input?: string | null): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "—";
  const startsWithPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  if (digits.length < 4) {
    return trimmed;
  }

  const suffixLength = digits.length >= 7 ? 3 : Math.min(2, Math.max(1, digits.length - 3));
  const prefixLength = Math.min(5, Math.max(2, digits.length - suffixLength - 1));
  const maskedCount = digits.length - prefixLength - suffixLength;

  const formatGrouped = (value: string) => value.replace(/(.{1,3})/g, "$1 ").trim();

  if (maskedCount <= 0) {
    const base = startsWithPlus ? `+${digits}` : digits;
    const grouped = formatGrouped(startsWithPlus ? base.slice(1) : base);
    return startsWithPlus ? `+${grouped}` : grouped;
  }

  const prefix = digits.slice(0, prefixLength);
  const suffix = digits.slice(-suffixLength);
  const maskedDigits = `${prefix}${"*".repeat(maskedCount)}${suffix}`;
  const withPlus = startsWithPlus ? `+${maskedDigits}` : maskedDigits;
  const body = startsWithPlus ? withPlus.slice(1) : withPlus;
  const grouped = formatGrouped(body);
  return startsWithPlus ? `+${grouped}` : grouped;
}
