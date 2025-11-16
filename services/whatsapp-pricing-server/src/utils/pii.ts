export function maskMsisdn(value: string): string {
  if (!value) return "***";
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) {
    return `${digits.slice(0, 1)}***${digits.slice(-1)}`;
  }
  const prefix = digits.slice(0, 3);
  const suffix = digits.slice(-2);
  return `${prefix}****${suffix}`;
}

export function redactToken(token: string | undefined | null, visible = 4): string {
  if (!token) return "***";
  const safeVisible = Math.max(0, Math.min(visible, token.length));
  return `${token.slice(0, safeVisible)}…`;
}
