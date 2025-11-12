import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

export interface AdminSession {
  actorId: string;
  label: string | null;
  expiresAt: string;
}

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function getSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET_FALLBACK;
  if (!secret || secret.length < 16) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be configured with at least 16 characters to read sessions.",
    );
  }
  return secret;
}

function signPayload(payload: Omit<AdminSession, "expiresAt"> & { expiresAt: string }): string {
  const secret = getSessionSecret();
  const json = JSON.stringify(payload);
  const signature = createHmac("sha256", secret).update(json).digest("base64url");
  const encoded = Buffer.from(json, "utf-8").toString("base64url");
  return `${signature}.${encoded}`;
}

function decodePayload(token: string): AdminSession | null {
  const [signature, encoded] = token.split(".");
  if (!signature || !encoded) return null;

  const secret = getSessionSecret();
  const json = Buffer.from(encoded, "base64url").toString("utf-8");
  const expected = createHmac("sha256", secret).update(json).digest("base64url");

  const provided = Buffer.from(signature);
  const comparison = Buffer.from(expected);
  if (provided.length !== comparison.length) {
    return null;
  }

  const match = timingSafeEqual(provided, comparison);
  if (!match) return null;

  const parsed = JSON.parse(json) as AdminSession;
  if (!parsed.actorId || typeof parsed.actorId !== "string") return null;
  if (typeof parsed.label !== "string" && parsed.label !== null) return null;
  if (!parsed.expiresAt || Number.isNaN(Date.parse(parsed.expiresAt))) return null;

  return parsed;
}

export function createSessionCookie(payload: {
  actorId: string;
  label: string | null;
  ttlMs?: number;
}) {
  const now = Date.now();
  const expiresAt = new Date(now + (payload.ttlMs ?? SESSION_TTL_MS)).toISOString();
  const token = signPayload({ actorId: payload.actorId, label: payload.label, expiresAt });
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      expires: new Date(expiresAt),
    },
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      expires: new Date(0),
    },
  };
}

type CookieStore = {
  get: (name: string) => unknown;
  delete?: (name: string) => void;
};

function getCookieValue(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof (value as { value?: unknown }).value === 'string') {
    return (value as { value?: string }).value ?? null;
  }
  if (typeof (value as { name?: string; value?: unknown }).value === 'string') {
    return (value as { name?: string; value?: string }).value ?? null;
  }
  return null;
}

export async function readSessionFromCookies(store?: CookieStore): Promise<AdminSession | null> {
  const cookieStore = (store ?? cookies()) as CookieStore;
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const value = getCookieValue(rawCookie);
  if (!value) {
    return null;
  }

  const payload = decodePayload(value);
  if (!payload) {
    cookieStore.delete?.(SESSION_COOKIE_NAME);
    return null;
  }

  if (Date.parse(payload.expiresAt) <= Date.now()) {
    cookieStore.delete?.(SESSION_COOKIE_NAME);
    return null;
  }

  return payload;
}

export function writeSessionToCookies(payload: { actorId: string; label: string | null; ttlMs?: number }) {
  const store = cookies();
  const sessionCookie = createSessionCookie(payload);
  store.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
}

export function removeSessionFromCookies() {
  const store = cookies();
  const cookie = clearSessionCookie();
  store.set(cookie.name, cookie.value, cookie.attributes);
}
