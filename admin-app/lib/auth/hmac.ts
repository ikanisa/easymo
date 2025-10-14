import { encodeBase64UrlFromBytes } from "./base64";
import { decodeBase64UrlToBytes } from "./base64";

function getSubtleCrypto(): SubtleCrypto {
  const cryptoRef = globalThis.crypto as { subtle?: SubtleCrypto } | undefined;
  if (!cryptoRef?.subtle) {
    throw new Error("Web Crypto API unavailable: unable to compute HMAC");
  }
  return cryptoRef.subtle;
}

const encoder = new TextEncoder();

async function importKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  return subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    usages,
  );
}

export async function signHmacSha256(data: string, secret: string): Promise<string> {
  const key = await importKey(secret, ["sign"]);
  const subtle = getSubtleCrypto();
  const signature = await subtle.sign("HMAC", key, encoder.encode(data));
  return encodeBase64UrlFromBytes(new Uint8Array(signature));
}

export async function verifyHmacSha256(
  data: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const key = await importKey(secret, ["verify"]);
    const subtle = getSubtleCrypto();
    const signatureBytes = decodeBase64UrlToBytes(signature);
    return await subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
  } catch (error) {
    console.error("hmac.verify_failed", error);
    return false;
  }
}
