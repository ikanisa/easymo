const encoder = new TextEncoder();
const decoder = new TextDecoder();

let cachedPrivateKey: CryptoKey | null = null;

export type FlowEncryptionContext = {
  aesKey: CryptoKey;
  iv: Uint8Array;
};

export type FlowEncryptedEnvelope = {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
};

export function normalizePem(value: string): string {
  return value.replace(/\r/g, "").trim();
}

export function base64Decode(value: string): Uint8Array {
  const sanitized = value.replace(/\s+/g, "");
  const binary = atob(sanitized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function flipIv(iv: Uint8Array): Uint8Array {
  const flipped = new Uint8Array(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flipped[i] = iv[i] ^ 0xff;
  }
  return flipped;
}

export function isEncryptedEnvelope(
  body: Record<string, unknown> | undefined | null,
): body is FlowEncryptedEnvelope {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.encrypted_flow_data === "string" &&
    typeof candidate.encrypted_aes_key === "string" &&
    typeof candidate.initial_vector === "string"
  );
}

export async function importFlowPrivateKey(
  envVar = "FLOW_PRIVATE_KEY",
): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = Deno.env.get(envVar);
  if (!pem) {
    throw new Error(`${envVar} secret is not configured`);
  }
  const normalized = normalizePem(pem);
  const header = "-----BEGIN PRIVATE KEY-----";
  const footer = "-----END PRIVATE KEY-----";
  if (!normalized.includes(header) || !normalized.includes(footer)) {
    throw new Error(`${envVar} must be an unencrypted PKCS#8 key`);
  }
  const base64 = normalized.replace(header, "").replace(footer, "").replace(
    /\s+/g,
    "",
  );
  const raw = base64Decode(base64);
  cachedPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    raw,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"],
  );
  return cachedPrivateKey;
}

export async function decryptFlowEnvelope<T>(
  body: FlowEncryptedEnvelope,
  privateKey?: CryptoKey,
): Promise<{ request: T; context: FlowEncryptionContext }> {
  const rsaKey = privateKey ?? await importFlowPrivateKey();
  const aesKeyBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      rsaKey,
      base64Decode(body.encrypted_aes_key),
    ),
  );
  const aesKey = await crypto.subtle.importKey(
    "raw",
    aesKeyBytes,
    { name: "AES-GCM" },
    false,
    [
      "encrypt",
      "decrypt",
    ],
  );
  const iv = base64Decode(body.initial_vector);
  const decryptedBytes = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      aesKey,
      base64Decode(body.encrypted_flow_data),
    ),
  );
  const json = decoder.decode(decryptedBytes);
  const request = JSON.parse(json) as T;
  return { request, context: { aesKey, iv } };
}

export async function encryptFlowPayload(
  payload: unknown,
  context: FlowEncryptionContext,
): Promise<string> {
  const flippedIv = flipIv(context.iv);
  const plaintext = encoder.encode(JSON.stringify(payload));
  const encryptedBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: flippedIv, tagLength: 128 },
      context.aesKey,
      plaintext,
    ),
  );
  return base64Encode(encryptedBytes);
}

export function resetCachedFlowPrivateKey(): void {
  cachedPrivateKey = null;
}
