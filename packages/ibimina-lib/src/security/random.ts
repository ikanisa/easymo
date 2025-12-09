function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(binary, "binary").toString("base64");
}

function sanitizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "");
}

export function createNonce(size = 16): string {
  const cryptoImpl = globalThis.crypto;

  if (typeof cryptoImpl?.getRandomValues === "function") {
    const buffer = new Uint8Array(size);
    cryptoImpl.getRandomValues(buffer);
    return encodeBase64(buffer);
  }

  if (typeof cryptoImpl?.randomUUID === "function") {
    return sanitizeUuid(cryptoImpl.randomUUID());
  }

  throw new Error("Secure random number generation is unavailable in this runtime");
}

export function createRequestId(): string {
  const cryptoImpl = globalThis.crypto;

  if (typeof cryptoImpl?.randomUUID === "function") {
    return cryptoImpl.randomUUID();
  }

  if (typeof cryptoImpl?.getRandomValues === "function") {
    const buffer = new Uint8Array(16);
    cryptoImpl.getRandomValues(buffer);
    return Array.from(buffer)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  throw new Error("Secure random number generation is unavailable in this runtime");
}
