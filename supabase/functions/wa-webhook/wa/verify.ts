import { crypto, TextEncoder } from "../deps.ts";
import { WA_APP_SECRET } from "../config.ts";

const encoder = new TextEncoder();

export async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const header = req.headers.get("x-hub-signature-256") ?? "";
  if (!header.startsWith("sha256=")) return false;
  const theirHex = header.slice(7);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(WA_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const ourBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const ourBytes = new Uint8Array(ourBuf);
  const theirBytes = hexToBytes(theirHex);
  if (ourBytes.length !== theirBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < ourBytes.length; i++) {
    diff |= ourBytes[i] ^ theirBytes[i];
  }
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const len = hex.length / 2;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}
