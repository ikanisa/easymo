"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase-client";

type SessionStatus = "searching" | "negotiating" | "completed" | "timeout" | "cancelled" | string;

interface SessionRow {
  id: string;
  status: SessionStatus;
  deadline_at: string | null;
  agent_type?: string | null;
}

interface AlertCounts {
  breaches: number;
  negotiations: number;
  total: number;
}

interface RealtimeState {
  counts: AlertCounts;
  isLoading: boolean;
  error: string | null;
}

function shouldTrackStatus(status: SessionStatus): boolean {
  return status === "searching" || status === "negotiating" || status === "timeout";
}

function computeCounts(entries: Map<string, SessionRow>): AlertCounts {
  const now = Date.now();
  let breaches = 0;
  let negotiations = 0;

  entries.forEach((entry) => {
    const deadline = entry.deadline_at ? Date.parse(entry.deadline_at) : null;
    const remaining = deadline != null ? deadline - now : null;

    if (entry.status === "timeout" || (remaining != null && remaining <= 0)) {
      breaches += 1;
      return;
    }

    if (entry.status === "negotiating") {
      negotiations += 1;
      return;
    }

    if (remaining != null && remaining > 0 && remaining <= 120_000) {
      negotiations += 1;
    }
  });

  return { breaches, negotiations, total: breaches + negotiations };
}

export function useRealtimeSlaAlerts(): RealtimeState {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const entriesRef = useRef<Map<string, SessionRow>>(new Map());
  const [state, setState] = useState<RealtimeState>({
    counts: { breaches: 0, negotiations: 0, total: 0 },
    isLoading: Boolean(supabase),
    error: null,
  });

  useEffect(() => {
    if (!supabase) {
      setState({ counts: { breaches: 0, negotiations: 0, total: 0 }, isLoading: false, error: null });
      return undefined;
    }

    let cancelled = false;

    const refreshCounts = () => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, counts: computeCounts(entriesRef.current) }));
    };

    const loadInitial = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      const response: PostgrestSingleResponse<SessionRow[]> = await supabase
        .from("agent_sessions")
        .select("id, status, deadline_at, agent_type")
        .in("status", ["searching", "negotiating", "timeout"])
        .limit(100);

      if (cancelled) return;

      if (response.error) {
        setState({
          counts: { breaches: 0, negotiations: 0, total: 0 },
          isLoading: false,
          error: response.error.message ?? "Unable to load SLA alerts",
        });
        return;
      }

      const snapshot = new Map<string, SessionRow>();
      for (const row of response.data ?? []) {
        if (shouldTrackStatus(row.status)) {
          snapshot.set(row.id, row);
        }
      }
      entriesRef.current = snapshot;
      setState({ counts: computeCounts(snapshot), isLoading: false, error: null });
    };

    loadInitial().catch((error) => {
      if (!cancelled) {
        setState({
          counts: { breaches: 0, negotiations: 0, total: 0 },
          isLoading: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    const channel = supabase
      .channel("admin-sla-alerts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_sessions" },
        (payload) => {
          if (cancelled) return;
          const next = new Map(entriesRef.current);

          if (payload.eventType === "DELETE" && payload.old) {
            next.delete((payload.old as SessionRow).id);
          } else if (payload.new) {
            const row = payload.new as SessionRow;
            if (shouldTrackStatus(row.status)) {
              next.set(row.id, row);
            } else {
              next.delete(row.id);
            }
          }

          entriesRef.current = next;
          refreshCounts();
        },
      )
      .subscribe();

    const interval = window.setInterval(refreshCounts, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      channel.unsubscribe();
    };
  }, [supabase]);

  return state;
}
