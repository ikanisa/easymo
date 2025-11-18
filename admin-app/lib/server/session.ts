import { cookies } from "next/headers";
import crypto from "crypto";

export const SESSION_COOKIE_NAME = "admin_session" as const;

type SessionInit = {
  actorId: string;
  label?: string;
  ttlMs?: number;
};

export type SessionPayload = {
  actorId: string;
  label?: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("ADMIN_SESSION_SECRET must be set (>=16 chars)");
  }
  return secret;
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(data: string): string {
  return base64url(crypto.createHmac("sha256", getSecret()).update(data).digest());
}

export function createSessionCookie(init: SessionInit) {
  const now = Date.now();
  const ttl = Math.max(30_000, init.ttlMs ?? 60 * 60 * 1000); // default 1h
  const payload: SessionPayload = {
    actorId: init.actorId,
    label: init.label,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + ttl) / 1000),
  };
  const body = base64url(JSON.stringify(payload));
  const sig = sign(body);
  const value = `${body}.${sig}`;
  return {
    name: SESSION_COOKIE_NAME,
    value,
  } as const;
}

export function parseSessionCookie(value?: string | null): SessionPayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = sign(body);
  if (signature !== expected) return null;
  try {
    const json = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const payload = JSON.parse(json) as SessionPayload;
    if (!payload.actorId || !payload.exp) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp < nowSec) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getCurrentSession(): SessionPayload | null {
  try {
    const jar = cookies();
    const raw = jar.get(SESSION_COOKIE_NAME)?.value;
    return parseSessionCookie(raw);
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  const jar = cookies();
  try {
    jar.set(SESSION_COOKIE_NAME, "", { maxAge: 0, httpOnly: true, path: "/" });
  } catch {
    // ignore
  }
}

