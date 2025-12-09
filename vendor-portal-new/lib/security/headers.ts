// Temporarily inlining to avoid build dependency issues
const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  {
    key: "Permissions-Policy",
    value:
      "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), display-capture=(), fullscreen=(self), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), usb=(), xr-spatial-tracking=()",
  },
];

const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
} as const;

export { HSTS_HEADER, SECURITY_HEADERS };

export function createSecureHeaders(): Array<{ key: string; value: string }> {
  return [...SECURITY_HEADERS];
}

// Stub exports for compatibility - implement if needed
export function createContentSecurityPolicy() {
  throw new Error("Not implemented - inline from @ibimina/lib if needed");
}

const DEFAULT_NONCE_BYTES = 32;
const REQUEST_ID_BYTES = 16;

function normaliseLength(value: number | undefined, fallback: number) {
  if (Number.isFinite(value) && value! > 0) {
    return Math.ceil(value!);
  }
  return fallback;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    output += alphabet[(chunk >> 18) & 0x3f];
    output += alphabet[(chunk >> 12) & 0x3f];
    output += i + 1 < bytes.length ? alphabet[(chunk >> 6) & 0x3f] : "=";
    output += i + 2 < bytes.length ? alphabet[chunk & 0x3f] : "=";
  }
  return output;
}

function toHex(bytes: Uint8Array): string {
  let result = "";
  bytes.forEach((byte) => {
    result += byte.toString(16).padStart(2, "0");
  });
  return result;
}

function fillWithMathRandom(bytes: Uint8Array) {
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

export function createNonce(byteLength?: number) {
  const resolvedLength = normaliseLength(byteLength, DEFAULT_NONCE_BYTES);
  const cryptoApi = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(resolvedLength);
    cryptoApi.getRandomValues(bytes);
    return toBase64(bytes);
  }

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID().replace(/-/g, "");
  }

  const bytes = fillWithMathRandom(new Uint8Array(resolvedLength));
  return toBase64(bytes);
}

export function createRequestId() {
  const cryptoApi = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(REQUEST_ID_BYTES);
    cryptoApi.getRandomValues(bytes);
    return toHex(bytes);
  }

  const bytes = fillWithMathRandom(new Uint8Array(REQUEST_ID_BYTES));
  return toHex(bytes);
}
