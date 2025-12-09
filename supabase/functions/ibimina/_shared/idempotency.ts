import { createHash } from "node:crypto";
import type { AnyClient } from "./mod.ts";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export const hashPayload = (payload: unknown) => {
  const json = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
  return createHash("sha256")
    .update(json ?? "")
    .digest("hex");
};

export interface IdempotencyOptions {
  ttlSeconds?: number;
}

export interface IdempotencyRecord<T = unknown> {
  response: T;
  request_hash: string;
  expires_at: string;
}

const table = "ops.idempotency";

export const getIdempotentResponse = async <T>(
  supabase: AnyClient,
  userId: string,
  key: string
) => {
  const { data, error } = await supabase
    .schema("ops")
    .from("idempotency")
    .select("response, request_hash, expires_at")
    .eq("user_id", userId)
    .eq("key", key)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as IdempotencyRecord<T> | null;
};

export const saveIdempotentResponse = async (
  supabase: AnyClient,
  userId: string,
  key: string,
  requestHash: string,
  response: unknown,
  options?: IdempotencyOptions
) => {
  const ttlSeconds = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await supabase.schema("ops").from("idempotency").upsert({
    user_id: userId,
    key,
    request_hash: requestHash,
    response,
    expires_at: expiresAt,
  });

  if (error) {
    throw error;
  }
};
