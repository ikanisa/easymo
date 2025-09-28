const encoder = new TextEncoder();

export function generateStaffVerificationCode(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  const value = buffer[0] % 1_000_000;
  return value.toString().padStart(6, "0");
}

export async function hashStaffVerificationCode(
  code: string,
  barId: string,
  numberE164: string,
): Promise<string> {
  const input = `${code}:${barId}:${numberE164}`;
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
