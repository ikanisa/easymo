import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type FetchLike = typeof fetch;

export interface ChannelMonitorOptions<TRecord extends Record<string, unknown> = Record<string, unknown>> {
  channel: string;
  schema?: string;
  table?: string;
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<TRecord>) => void;
  onStatusChange?: (status: string) => void;
  monitorFetch?: FetchLike | null;
  sla?: {
    deadlineField: keyof TRecord & string;
    statusField?: keyof TRecord & string;
    completedStatuses?: Array<string>;
    channel?: string;
  };
}

interface SupabaseRealtimeClient {
  channel(name: string): RealtimeChannel;
}

function resolveFetch(customFetch?: FetchLike | null): FetchLike | null {
  if (customFetch) return customFetch;
  if (typeof fetch === "function") return fetch;
  return null;
}

function computeLatency(payload: RealtimePostgresChangesPayload<any>): number | null {
  const timestamp = payload.commit_timestamp;
  if (!timestamp) return null;
  const commitTime = new Date(timestamp).getTime();
  if (Number.isNaN(commitTime)) return null;
  return Date.now() - commitTime;
}

function maybeNotifyRealtime(
  fetcher: FetchLike | null,
  body: Record<string, unknown>,
) {
  if (!fetcher) return;
  void fetcher("/api/monitoring/realtime", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

function maybeNotifySla(
  fetcher: FetchLike | null,
  details: Record<string, unknown>,
) {
  if (!fetcher) return;
  void fetcher("/api/monitoring/sla", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details),
    keepalive: true,
  }).catch(() => undefined);
}

export function subscribeWithMonitoring<TRecord extends Record<string, unknown> = Record<string, unknown>>(
  client: SupabaseRealtimeClient | null,
  options: ChannelMonitorOptions<TRecord>,
): RealtimeChannel | null {
  if (!client) return null;

  const fetcher = resolveFetch(options.monitorFetch ?? null);
  const channel = client.channel(options.channel);
  const schema = options.schema ?? "public";

  const handler = (payload: RealtimePostgresChangesPayload<TRecord>) => {
    const latencyMs = computeLatency(payload);
    const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;

    maybeNotifyRealtime(fetcher, {
      channel: options.channel,
      event: "postgres_changes",
      table: options.table,
      status: "message",
      latencyMs: typeof latencyMs === "number" ? latencyMs : undefined,
      recordId: typeof record.id === "string" ? record.id : undefined,
      receivedAt: new Date().toISOString(),
    });

    if (options.sla) {
      const { deadlineField, statusField, completedStatuses = ["completed"], channel: slaChannel } =
        options.sla;
      const deadlineRaw = record[deadlineField];
      if (typeof deadlineRaw === "string") {
        const deadline = new Date(deadlineRaw);
        if (!Number.isNaN(deadline.getTime())) {
          const statusValue = statusField ? record[statusField] : undefined;
          const isComplete =
            typeof statusValue === "string" &&
            completedStatuses.map((s) => s.toLowerCase()).includes(statusValue.toLowerCase());
          if (!isComplete && deadline.getTime() < Date.now()) {
            maybeNotifySla(fetcher, {
              channel: slaChannel ?? options.channel,
              deadline: deadline.toISOString(),
              breachedAt: new Date().toISOString(),
              recordId: typeof record.id === "string" ? record.id : undefined,
              status: typeof statusValue === "string" ? statusValue : undefined,
            });
          }
        }
      }
    }

    options.onEvent(payload);
  };

  channel.on("postgres_changes", {
    event: "*",
    schema,
    table: options.table,
    filter: options.filter,
  }, handler);

  maybeNotifyRealtime(fetcher, {
    channel: options.channel,
    event: "postgres_changes",
    status: "subscribing",
    table: options.table,
    requestedAt: new Date().toISOString(),
  });

  const subscription = channel.subscribe((status) => {
    options.onStatusChange?.(status);
    maybeNotifyRealtime(fetcher, {
      channel: options.channel,
      event: "postgres_changes",
      status,
      table: options.table,
      receivedAt: new Date().toISOString(),
    });
  });

  const originalUnsubscribe = channel.unsubscribe.bind(channel);
  channel.unsubscribe = () => {
    maybeNotifyRealtime(fetcher, {
      channel: options.channel,
      event: "postgres_changes",
      status: "unsubscribed",
      table: options.table,
      receivedAt: new Date().toISOString(),
    });
    return originalUnsubscribe();
  };

  return subscription;
}
