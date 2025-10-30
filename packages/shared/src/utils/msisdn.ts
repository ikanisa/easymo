export function maskMsisdn(input: string | null | undefined): string {
  // Em dash for empty/blank
  if (input == null) return "—";
  const raw = String(input).trim();
  if (raw === "") return "—";

  // Normalize: keep digits, keep a leading '+'
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  let normalized = digitsOnly;

  // Convert common RW formats to +250#########
  // - 0781234012        -> +250781234012
  // - 250781234012      -> +250781234012
  // - +250781234012     -> +250781234012
  if (/^0\d{9}$/.test(digitsOnly)) {
    // Local 10-digit starting with 0
    normalized = "+250" + digitsOnly.slice(1);
  } else if (/^250\d{9}$/.test(digitsOnly)) {
    normalized = "+" + digitsOnly;
  } else if (!/^\+\d+$/.test(digitsOnly) && /^\d+$/.test(digitsOnly)) {
    // Bare digits, try to detect +250#########
    if (/^\d{12}$/.test(digitsOnly) && digitsOnly.startsWith("250")) {
      normalized = "+" + digitsOnly;
    }
  }

  // If normalized is a Rwandan MSISDN, format as '+250 78* *** 012'
  if (/^\+250\d{9}$/.test(normalized)) {
    const local = normalized.slice(4); // 9 digits
    const first2 = local.slice(0, 2);
    const last3 = local.slice(-3);
    return `+250 ${first2}* *** ${last3}`;
  }

  // Fallback: mask all but last 4
  const onlyDigits = raw.replace(/\D/g, "");
  if (onlyDigits.length <= 4) return onlyDigits;
  return `${"*".repeat(onlyDigits.length - 4)}${onlyDigits.slice(-4)}`;
}
