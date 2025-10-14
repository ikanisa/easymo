const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Node.js fallback
  return Buffer.from(bytes).toString("base64");
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Node.js fallback
  return new Uint8Array(Buffer.from(base64, "base64"));
}

export function encodeBase64UrlFromString(value: string): string {
  const bytes = textEncoder.encode(value);
  return encodeBytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function encodeBase64UrlFromBytes(bytes: Uint8Array): string {
  return encodeBytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function decodeBase64UrlToString(value: string): string {
  const normalized = normalizeBase64Url(value);
  const bytes = decodeBase64ToBytes(normalized);
  return textDecoder.decode(bytes);
}

export function decodeBase64UrlToBytes(value: string): Uint8Array {
  const normalized = normalizeBase64Url(value);
  return decodeBase64ToBytes(normalized);
}

function normalizeBase64Url(value: string): string {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) {
    normalized += "=";
  }
  return normalized;
}
