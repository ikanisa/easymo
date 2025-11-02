import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { DestinationRecord, TelemetryRecord } from "./types.ts";
import { truncate } from "./utils.ts";

export type AnySupabaseClient = SupabaseClient<any, "public", any>;

interface DestinationCacheEntry {
  expiresAt: number;
  records: DestinationRecord[];
}

export interface RouterRepositoryPort {
  loadDestinations(allowlist: Set<string>): Promise<DestinationRecord[]>;
  persistRouterLog(
    messageId: string,
    textSnippet: string | undefined,
    routeKey: string | undefined,
    statusCode: string,
    metadata: Record<string, unknown>,
  ): Promise<void>;
  recordTelemetry(record: TelemetryRecord): Promise<void>;
  upsertIdempotency(messageId: string, from: string): Promise<{ inserted: boolean } | null>;
  enforceRateLimit(
    sender: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; count: number } | null>;
}

export class RouterRepository implements RouterRepositoryPort {
  #client: AnySupabaseClient | null;
  #cache: DestinationCacheEntry | null = null;
  #cacheTtl: number;

  constructor(client: AnySupabaseClient | null, cacheTtl: number) {
    this.#client = client;
    this.#cacheTtl = cacheTtl;
  }

  static fromEnv(
    supabaseUrl: string | undefined,
    supabaseServiceRoleKey: string | undefined,
    cacheTtl: number,
  ): RouterRepository {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new RouterRepository(null, cacheTtl);
    }
    const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });
    return new RouterRepository(client, cacheTtl);
  }

  async loadDestinations(allowlist: Set<string>): Promise<DestinationRecord[]> {
    if (!this.#client) return [];
    const now = Date.now();
    if (this.#cache && this.#cache.expiresAt > now) {
      return this.filterAllowlist(this.#cache.records, allowlist);
    }

    const { data, error } = await this.#client
      .from("router_keyword_destinations")
      .select("keyword, destination_slug, destination_url");

    if (error) {
      console.error(JSON.stringify({ event: "DESTINATION_FETCH_FAILED", error: String(error) }));
      return [];
    }
    const mapped: DestinationRecord[] = (data ?? []).map((row: any) => ({
      keyword: String(row.keyword).toLowerCase(),
      destinationSlug: String(row.destination_slug),
      destinationUrl: String(row.destination_url),
    }));

    this.#cache = { records: mapped, expiresAt: now + this.#cacheTtl };
    return this.filterAllowlist(mapped, allowlist);
  }

  private filterAllowlist(records: DestinationRecord[], allowlist: Set<string>): DestinationRecord[] {
    if (allowlist.size === 0) return records;
    const normalized = Array.from(allowlist).map((value) => value.toLowerCase());
    const allowedHosts = new Set(
      normalized
        .map((value) => {
          try {
            const url = new URL(value.includes("://") ? value : `https://${value}`);
            return url.host;
          } catch {
            return undefined;
          }
        })
        .filter((value): value is string => Boolean(value)),
    );
    return records.filter((record) => {
      const slugMatch = normalized.includes(record.destinationSlug.toLowerCase());
      if (slugMatch) return true;
      try {
        const { host } = new URL(record.destinationUrl);
        return allowedHosts.size === 0 ? false : allowedHosts.has(host.toLowerCase());
      } catch {
        return false;
      }
    });
  }

  async persistRouterLog(
    messageId: string,
    textSnippet: string | undefined,
    routeKey: string | undefined,
    statusCode: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    if (!this.#client) return;
    const snippet = truncate(textSnippet, 500) ?? null;
    const safeMetadata = metadata ?? {};
    try {
      const { error } = await this.#client.from("router_logs").insert({
        message_id: messageId,
        text_snippet: snippet,
        route_key: routeKey,
        status_code: statusCode,
        metadata: safeMetadata,
      });
      if (error) {
        console.error(JSON.stringify({ event: "ROUTER_LOG_PERSIST_FAILED", messageId, error: String(error) }));
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "ROUTER_LOG_PERSIST_ERROR", messageId, error: String(err) }));
    }
  }

  async recordTelemetry(record: TelemetryRecord): Promise<void> {
    if (!this.#client) return;
    try {
      const { error } = await this.#client.from("router_telemetry").insert({
        event: record.event,
        message_id: record.messageId ?? null,
        keyword: record.keyword ?? null,
        metadata: record.metadata ?? {},
      });
      if (error) {
        console.error(JSON.stringify({ event: "TELEMETRY_PERSIST_FAILED", error: String(error) }));
      }
    } catch (err) {
      console.error(JSON.stringify({ event: "TELEMETRY_PERSIST_ERROR", error: String(err) }));
    }
  }

  async upsertIdempotency(messageId: string, from: string): Promise<{ inserted: boolean } | null> {
    if (!this.#client) return null;
    try {
      const { data, error } = await this.#client
        .from("router_idempotency")
        .upsert({ message_id: messageId, from_number: from }, { onConflict: "message_id", ignoreDuplicates: true })
        .select("message_id");
      if (error) {
        console.error(JSON.stringify({ event: "IDEMPOTENCY_WRITE_FAILED", messageId, error: String(error) }));
        return null;
      }
      const inserted = Array.isArray(data) && data.length > 0;
      return { inserted };
    } catch (err) {
      console.error(JSON.stringify({ event: "IDEMPOTENCY_WRITE_ERROR", messageId, error: String(err) }));
      return null;
    }
  }

  async enforceRateLimit(
    sender: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; count: number } | null> {
    if (!this.#client) return null;
    try {
      const { data, error } = await this.#client.rpc("router_enforce_rate_limit", {
        p_sender: sender,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) {
        console.error(JSON.stringify({ event: "RATE_LIMIT_RPC_FAILED", sender, error: String(error) }));
        return null;
      }
      if (!data || typeof data.allowed !== "boolean" || typeof data.current_count !== "number") {
        console.error(JSON.stringify({ event: "RATE_LIMIT_RPC_MALFORMED", sender, data }));
        return null;
      }
      return { allowed: data.allowed, count: data.current_count };
    } catch (err) {
      console.error(JSON.stringify({ event: "RATE_LIMIT_RPC_ERROR", sender, error: String(err) }));
      return null;
    }
  }
}
