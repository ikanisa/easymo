"use client";

import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  SupabaseClient,
} from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";

import { getSupabaseClient } from "@/lib/supabase-client";

export type RealtimeDomain = "drivers" | "negotiations" | "tasks" | "sla";

type SubscriptionConfig = {
  schema: string;
  table: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  filter?: string;
};

const DOMAIN_CONFIG: Record<RealtimeDomain, SubscriptionConfig[]> = {
  drivers: [
    { schema: "public", table: "driver_presence", event: "*" },
  ],
  negotiations: [
    { schema: "public", table: "agent_sessions", event: "*" },
    { schema: "public", table: "agent_quotes", event: "*" },
    { schema: "public", table: "vendor_quote_responses", event: "*" },
  ],
  tasks: [{ schema: "public", table: "agent_tasks", event: "*" }],
  sla: [{ schema: "public", table: "agent_sessions", event: "UPDATE" }],
};

export type RealtimeHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  payload: RealtimePostgresChangesPayload<T>,
  domain: RealtimeDomain,
) => void;

export class SupabaseRealtimeManager {
  private readonly client: SupabaseClient;
  private readonly channels = new Set<RealtimeChannel>();

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  subscribe(domain: RealtimeDomain, handler: RealtimeHandler, channelName?: string) {
    const configs = DOMAIN_CONFIG[domain];
    if (!configs?.length) {
      throw new Error(`Unknown realtime domain: ${domain}`);
    }

    const channel = this.client.channel(
      channelName ?? `admin-${domain}-${Math.random().toString(36).slice(2)}`,
    );

    configs.forEach((config) => {
      (channel as any).on(
        "postgres_changes",
        {
          event: config.event ?? "*",
          schema: config.schema,
          table: config.table,
          filter: config.filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) =>
          handler(payload, domain),
      );
    });

    channel.subscribe();
    this.channels.add(channel);

    return () => {
      channel.unsubscribe();
      this.channels.delete(channel);
    };
  }

  dispose() {
    this.channels.forEach((channel) => channel.unsubscribe());
    this.channels.clear();
  }
}

type UseRealtimeOptions = {
  enabled?: boolean;
  channelName?: string;
};

export function useSupabaseRealtime(
  domains: RealtimeDomain | RealtimeDomain[],
  handler: RealtimeHandler,
  options: UseRealtimeOptions = {},
) {
  const supabase = getSupabaseClient();
  const domainList = useMemo(
    () => (Array.isArray(domains) ? domains : [domains]),
    [domains],
  );
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const { enabled = true, channelName } = options;

  useEffect(() => {
    if (!supabase || !enabled) {
      return;
    }

    const manager = new SupabaseRealtimeManager(supabase);
    const unsubs = domainList.map((domain) =>
      manager.subscribe(domain, (payload, currentDomain) => {
        handlerRef.current(payload, currentDomain);
      }, channelName),
    );

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
      manager.dispose();
    };
  }, [supabase, domainList, enabled, channelName]);
}
