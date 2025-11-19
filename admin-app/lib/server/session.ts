import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server/client";

export interface AdminSession {
  actorId: string;
  label: string | null;
  expiresAt: string;
}

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function isAdminSupabaseUser(user: SupabaseUser | null): boolean {
  if (!user) return false;
  const appRole = (user.app_metadata as Record<string, unknown> | undefined)?.role;
  const userRole = (user.user_metadata as Record<string, unknown> | undefined)?.role;
  const appRoles = (user.app_metadata as Record<string, unknown> | undefined)?.roles;
  const userRoles = (user.user_metadata as Record<string, unknown> | undefined)?.roles;

  const normalize = (value: unknown) =>
    typeof value === "string"
      ? [value]
      : Array.isArray(value)
        ? (value as unknown[]).filter((entry): entry is string => typeof entry === "string")
        : [];

  const roles = [
    ...normalize(appRole),
    ...normalize(userRole),
    ...normalize(appRoles),
    ...normalize(userRoles),
  ];

  return roles.some((role) => role.toLowerCase() === "admin");
}

export function mapSupabaseSessionToAdmin(
  session: SupabaseSession | null,
): AdminSession | null {
  if (!session || !session.user) return null;
  if (!isAdminSupabaseUser(session.user)) return null;

  const label =
    (session.user.user_metadata as Record<string, unknown> | undefined)?.full_name &&
    typeof (session.user.user_metadata as Record<string, unknown>).full_name === "string"
      ? ((session.user.user_metadata as Record<string, string>).full_name ?? null)
      : session.user.email ?? null;

  const expiresAt = session.expires_at
    ? new Date(session.expires_at * 1000).toISOString()
    : new Date(Date.now() + SESSION_TTL_MS).toISOString();

  return {
    actorId: session.user.id,
    label,
    expiresAt,
  };
}

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

async function readSupabaseAdminSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('supabase.session.read_failed', error.message);
      return null;
    }
    return mapSupabaseSessionToAdmin(data.session);
  } catch (error) {
    console.warn('supabase.session.error', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function readSessionFromCookies(store?: CookieStore): Promise<AdminSession | null> {
  const cookieStore = (store ?? cookies()) as CookieStore;
  const rawCookie = cookieStore.get(SESSION_COOKIE_NAME);
  const value = getCookieValue(rawCookie);
  if (!value) {
    // Always attempt Supabase fallback when no legacy session exists
    return readSupabaseAdminSession();
  }

  const payload = decodePayload(value);
  if (!payload) {
    cookieStore.delete?.(SESSION_COOKIE_NAME);
    return readSupabaseAdminSession();
  }

  if (Date.parse(payload.expiresAt) <= Date.now()) {
    cookieStore.delete?.(SESSION_COOKIE_NAME);
    return readSupabaseAdminSession();
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
