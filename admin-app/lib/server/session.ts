import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server/client";
import { logStructured } from "./logger";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export interface AdminSession {
  actorId: string;
  label: string | null;
  expiresAt: string;
}

const SESSION_COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function isAdminSupabaseUser(user: SupabaseUser | null): boolean {
  return isAdminUser(user);
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
    throw new Error("ADMIN_SESSION_SECRET must be set and >= 16 characters");
  }
  return secret;
}

function buildHmacKey(): Buffer {
  const secret = getSessionSecret();
  return Buffer.from(secret, "utf8");
}

function encodePayload(data: AdminSession): string {
  const json = JSON.stringify(data);
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodePayload(encoded: string): AdminSession | null {
  try {
    const json = Buffer.from(encoded, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as AdminSession;
    if (!parsed.actorId || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function signPayload(payload: string): string {
  const key = buildHmacKey();
  const hmac = createHmac("sha256", key);
  hmac.update(payload, "utf8");
  return hmac.digest().toString("base64url");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = signPayload(payload);
  if (expected.length !== signature.length) return false;
  try {
    const expectedBuf = Buffer.from(expected, "base64url");
    const signatureBuf = Buffer.from(signature, "base64url");
    return timingSafeEqual(expectedBuf, signatureBuf);
  } catch {
    return false;
  }
}

export function writeSessionCookie(session: AdminSession) {
  const payload = encodePayload(session);
  const signature = signPayload(payload);
  const value = `${payload}.${signature}`;

  return {
    name: SESSION_COOKIE_NAME,
    value,
    attributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
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
      maxAge: 0,
    },
  };
}

interface CookieStore {
  get: (name: string) => { value: string } | undefined;
  delete?: (name: string) => void;
}

function getCookieValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    const val = (value as { value: unknown }).value;
    if (typeof val === "string") return val;
  }
  return null;
}

async function readSupabaseAdminSession(): Promise<AdminSession | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      logStructured({
        event: "SESSION_READ_FAILED",
        target: "admin-session",
        status: "error",
        message: error.message,
        details: { source: "supabase" },
      });
      return null;
    }
    return mapSupabaseSessionToAdmin(data.session);
  } catch (error) {
    logStructured({
      event: "SUPABASE_SESSION_ERROR",
      target: "admin-session",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
      details: { source: "supabase" },
    });
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
