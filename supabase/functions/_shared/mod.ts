import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AnyClient = SupabaseClient<any, any, any>;

export const requireEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const createServiceClient = () => {
  const url = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: { "X-Client-Info": "sacco-plus/edge" },
    },
  });
};

const bufferFromHex = (hex: string) => {
  const clean = hex.trim().toLowerCase();
  if (!/^[0-9a-f]+$/.test(clean)) {
    return null;
  }
  return Buffer.from(clean, "hex");
};

export const verifyHmacSignature = (
  secret: string | Uint8Array | Buffer,
  body: Uint8Array,
  signature: string | null | undefined
) => {
  if (!signature) {
    return false;
  }

  const hmac = createHmac("sha256", secret);
  hmac.update(body);
  const digest = hmac.digest("hex");

  const provided = bufferFromHex(signature);
  const expected = bufferFromHex(digest);

  if (!provided || !expected || provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(provided, expected);
};

export const getForwardedIp = (headers: Headers): string | null => {
  const forwarded = headers.get("x-forwarded-for") ?? headers.get("x-real-ip");
  if (!forwarded) {
    return null;
  }
  const first = forwarded.split(",")[0]?.trim();
  return first || null;
};

export interface JwtContext {
  rawToken: string | null;
  claims: Record<string, unknown> | null;
  userId: string | null;
  role: string | null;
}

const decodeSegment = (segment: string) => {
  const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  try {
    const json = atob(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const parseJwt = (authorizationHeader: string | null | undefined): JwtContext => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return { rawToken: null, claims: null, userId: null, role: null };
  }
  const token = authorizationHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length < 2) {
    return { rawToken: token, claims: null, userId: null, role: null };
  }

  const payload = decodeSegment(parts[1]);
  const userId = typeof payload?.sub === "string" ? payload.sub : null;
  const role =
    typeof payload?.app_metadata === "object" && payload?.app_metadata !== null
      ? (((payload.app_metadata as Record<string, unknown>)?.role as string | null) ?? null)
      : null;

  return { rawToken: token, claims: payload, userId, role };
};

export const jsonResponse = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    status: init?.status ?? 200,
  });

export const errorResponse = (message: string, status = 400) =>
  jsonResponse({ error: message }, { status });
