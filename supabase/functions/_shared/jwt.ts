import { requireEnv } from "./mod.ts";

const encoder = new TextEncoder();

export const base64UrlEncode = (input: Uint8Array): string => {
  let binary = "";
  for (const byte of input) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const signPayload = async (payload: Record<string, unknown>, secret: string): Promise<string> => {
  const header = { alg: "HS256", typ: "JWT" };
  const headerBytes = encoder.encode(JSON.stringify(header));
  const payloadBytes = encoder.encode(JSON.stringify(payload));
  const base = `${base64UrlEncode(headerBytes)}.${base64UrlEncode(payloadBytes)}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(base));
  const signatureSegment = base64UrlEncode(new Uint8Array(signature));
  return `${base}.${signatureSegment}`;
};

export const signJwt = async (
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number
): Promise<string> => {
  if (!Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    throw new Error("JWT expiration must be a positive number of seconds");
  }
  const issuedAt = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: issuedAt, exp: issuedAt + Math.floor(expiresInSeconds) };
  return signPayload(body, secret);
};

export interface AuthJwtClaims {
  sub: string;
  auth: string;
  exp: number;
  phone?: string;
  factor?: string;
  device_id?: string;
  device_fingerprint?: string;
  [key: string]: unknown;
}

export const signAuthJwt = async (claims: AuthJwtClaims): Promise<string> => {
  const secret = Deno.env.get("AUTH_JWT_SECRET") ?? requireEnv("JWT_SECRET");
  const issuedAt = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= issuedAt) {
    throw new Error("Auth JWT expiration must be in the future");
  }
  const { exp, ...rest } = claims;
  const payload = { ...rest, exp: Math.floor(exp), iat: issuedAt };
  return signPayload(payload, secret);
};
