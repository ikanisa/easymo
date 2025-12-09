import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnyClient = SupabaseClient<any, any, any>;

const defaultWindow = parseInt(Deno.env.get("RATE_LIMIT_WINDOW_SECONDS") ?? "60", 10);
const defaultMax = parseInt(Deno.env.get("RATE_LIMIT_MAX") ?? "120", 10);

export interface RateLimitOptions {
  maxHits?: number;
  windowSeconds?: number;
  route?: string;
}

const fallbackBucket = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "anonymous";
};

export const enforceRateLimit = async (
  supabase: AnyClient,
  bucketKey: string,
  options?: RateLimitOptions
) => {
  const maxHits = options?.maxHits ?? defaultMax;
  const windowSeconds = options?.windowSeconds ?? defaultWindow;
  const route = options?.route ?? bucketKey;

  const { data, error } = await supabase.rpc("consume_route_rate_limit", {
    bucket_key: fallbackBucket(bucketKey),
    route,
    max_hits: maxHits,
    window_seconds: windowSeconds,
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
};

export const enforceIpRateLimit = async (
  supabase: AnyClient,
  ipAddress: string | null | undefined,
  route: string,
  options?: RateLimitOptions
) => {
  return enforceRateLimit(supabase, `ip:${fallbackBucket(ipAddress)}`, {
    ...options,
    route,
  });
};

export const enforceIdentityRateLimit = async (
  supabase: AnyClient,
  userId: string | null | undefined,
  route: string,
  options?: RateLimitOptions
) => {
  return enforceRateLimit(supabase, `user:${fallbackBucket(userId)}`, {
    ...options,
    route,
  });
};
