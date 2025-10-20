import { encodeBase64UrlFromString, decodeBase64UrlToString } from "./base64";
import { signHmacSha256, verifyHmacSha256 } from "./hmac";

const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export const SESSION_COOKIE_NAME = "admin_session";

export type SessionClaims = {
  sub: string;
  iat: number;
  exp: number;
  ver: number;
  nonce: string;
};

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  if (secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET must be at least 16 characters long");
  }
  return secret;
}

function resolveVerificationSecrets(): string[] {
  const secrets: string[] = [];
  try {
    secrets.push(getSessionSecret());
  } catch (error) {
    console.error("session.secret_missing", error);
  }

  const fallback = process.env.ADMIN_SESSION_SECRET_FALLBACK;
  if (fallback) {
    if (fallback.length < 16) {
      console.warn("session.secret_fallback_invalid_length");
    } else if (!secrets.includes(fallback)) {
      secrets.push(fallback);
    }
  }

  return secrets;
}

function resolveTtlSeconds(): number {
  const raw = process.env.ADMIN_SESSION_TTL_SECONDS;
  if (!raw) return DEFAULT_SESSION_TTL_SECONDS;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_SESSION_TTL_SECONDS;
  }
  return parsed;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function randomNonce(): string {
  try {
    const cryptoRef = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
  } catch (_error) {
    // ignore and fall back
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createSessionToken(actorId: string): Promise<{ token: string; expiresAt: number }> {
  const iat = nowSeconds();
  const ttlSeconds = resolveTtlSeconds();
  const exp = iat + ttlSeconds;
  const claims: SessionClaims = {
    sub: actorId,
    iat,
    exp,
    ver: 1,
    nonce: randomNonce(),
  };

  const payload = JSON.stringify(claims);
  const encoded = encodeBase64UrlFromString(payload);
  const secret = getSessionSecret();
  const signature = await signHmacSha256(encoded, secret);

  return {
    token: `${encoded}.${signature}`,
    expiresAt: exp,
  };
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const secrets = resolveVerificationSecrets();
  if (secrets.length === 0) {
    return null;
  }

  let verified = false;
  for (let index = 0; index < secrets.length; index += 1) {
    const candidate = secrets[index];
    if (await verifyHmacSha256(encodedPayload, signature, candidate)) {
      if (index > 0) {
        console.info("session.secret_fallback_used");
      }
      verified = true;
      break;
    }
  }

  if (!verified) {
    return null;
  }

  try {
    const payload = decodeBase64UrlToString(encodedPayload);
    const claims = JSON.parse(payload) as SessionClaims;
    if (!claims?.sub || typeof claims.sub !== "string") return null;
    if (typeof claims.exp !== "number" || claims.exp < nowSeconds()) {
      return null;
    }
    return claims;
  } catch (error) {
    console.error("session.decode_failed", error);
    return null;
  }
}
