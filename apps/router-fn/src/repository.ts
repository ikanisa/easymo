import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KeywordMapping,
  RateLimitResult,
  RouteDestination,
  RouterLogPayload,
  RouterRepository,
} from "./types.ts";

const CACHE_TTL_MS = 60_000;

interface CacheState<T> {
  expiresAt: number;
  data: T;
}

function isCacheValid<T>(cache: CacheState<T> | null): cache is CacheState<T> {
  return cache !== null && cache.expiresAt > Date.now();
}

export interface SupabaseRouterRepositoryOptions {
  supabaseUrl?: string;
  serviceKey?: string;
}

export class SupabaseRouterRepository implements RouterRepository {
  private client: SupabaseClient;
  private keywordCache: CacheState<KeywordMapping[]> | null = null;
  private destinationCache: CacheState<RouteDestination[]> | null = null;

  constructor(options: SupabaseRouterRepositoryOptions = {}) {
    const supabaseUrl = options.supabaseUrl ?? Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = options.serviceKey ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    this.client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  }

  async loadKeywordMappings(): Promise<KeywordMapping[]> {
    if (isCacheValid(this.keywordCache)) {
      return this.keywordCache.data;
    }
    const { data, error } = await this.client
      .from("router_keyword_map")
      .select("keyword, route_key")
      .eq("is_active", true);
    if (error) {
      console.error(JSON.stringify({ event: "KEYWORD_FETCH_FAILED", error: error.message }));
      return [];
    }
    const mappings: KeywordMapping[] = (data ?? []).map((row) => ({
      keyword: String(row.keyword).toLowerCase(),
      routeKey: String(row.route_key),
    }));
    this.keywordCache = { data: mappings, expiresAt: Date.now() + CACHE_TTL_MS };
    return mappings;
  }

  async loadDestinations(): Promise<RouteDestination[]> {
    if (isCacheValid(this.destinationCache)) {
      return this.destinationCache.data;
    }
    const { data, error } = await this.client
      .from("router_destinations")
      .select("route_key, destination_url, priority")
      .eq("is_active", true);
    if (error) {
      console.error(JSON.stringify({ event: "DESTINATION_FETCH_FAILED", error: error.message }));
      return [];
    }
    const destinations: RouteDestination[] = (data ?? []).map((row) => ({
      routeKey: String(row.route_key),
      destinationUrl: String(row.destination_url),
      priority: Number(row.priority ?? 0) || 0,
    }));
    this.destinationCache = { data: destinations, expiresAt: Date.now() + CACHE_TTL_MS };
    return destinations;
  }

  async claimMessage(
    messageId: string,
    waFrom: string,
    routeKey: string,
    metadata: Record<string, unknown> = {},
  ): Promise<boolean> {
    const { data, error } = await this.client.rpc("router_claim_message", {
      p_message_id: messageId,
      p_wa_from: waFrom,
      p_route_key: routeKey,
      p_metadata: metadata,
    });
    if (error) {
      console.error(JSON.stringify({ event: "IDEMPOTENCY_RPC_FAILED", messageId, error: error.message }));
      return false;
    }
    if (typeof data === "boolean") {
      return data;
    }
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === "boolean") {
      return Boolean(data[0]);
    }
    if (data && typeof data === "object" && "claimed" in data) {
      return Boolean((data as { claimed: boolean }).claimed);
    }
    return Boolean(data);
  }

  async checkRateLimit(waFrom: string, windowSeconds: number, maxMessages: number): Promise<RateLimitResult> {
    const { data, error } = await this.client.rpc("router_check_rate_limit", {
      p_wa_from: waFrom,
      p_window_seconds: windowSeconds,
      p_max_messages: maxMessages,
    });
    if (error) {
      console.error(JSON.stringify({ event: "RATE_LIMIT_RPC_FAILED", waFrom, error: error.message }));
      return { allowed: true, currentCount: 0 };
    }
    if (Array.isArray(data) && data.length > 0) {
      const entry = data[0] as { allowed: boolean; current_count: number };
      return { allowed: Boolean(entry.allowed), currentCount: Number(entry.current_count ?? 0) };
    }
    if (data && typeof data === "object") {
      const obj = data as { allowed?: boolean; current_count?: number };
      return { allowed: Boolean(obj.allowed ?? true), currentCount: Number(obj.current_count ?? 0) };
    }
    if (typeof data === "boolean") {
      return { allowed: data, currentCount: data ? 1 : maxMessages };
    }
    return { allowed: true, currentCount: 0 };
  }

  async recordRouterLog(payload: RouterLogPayload): Promise<void> {
    const { error } = await this.client.from("router_logs").insert({
      message_id: payload.messageId,
      route_key: payload.routeKey ?? null,
      status_code: payload.status,
      text_snippet: payload.textSnippet?.slice(0, 500) ?? null,
      metadata: payload.metadata,
    });
    if (error) {
      console.error(JSON.stringify({ event: "ROUTER_LOG_FAILED", error: error.message }));
    }
  }
}
