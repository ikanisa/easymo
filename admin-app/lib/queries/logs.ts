import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

export interface LogsPayload {
  audit: Array<{
    id: string;
    actor: string;
    action: string;
    target_table: string;
    target_id: string;
    created_at: string;
    diff?: unknown;
  }>;
  events: Array<
    {
      id: string;
      orderId: string;
      type: string;
      createdAt: string;
      actorId?: string | null;
      stationId?: string | null;
      context?: unknown;
    }
  >;
  totals?: {
    audit: number;
    voucher: number;
  };
  integration?: {
    target: string;
    status: "ok" | "degraded";
    reason?: string;
    message?: string;
  };
}

const LOGS_KEY: QueryKey = ["logs"];

export async function fetchLogs(): Promise<LogsPayload> {
  const response = await apiFetch<LogsPayload>(getAdminApiPath("logs"), {
    method: "GET",
    revalidate: 30,
  });
  if (!response.ok) {
    throw response.error ?? new Error("Failed to load logs");
  }
  return response.data;
}

export function useLogsQuery(
  options?: UseQueryOptions<LogsPayload, unknown, LogsPayload>,
) {
  return useQuery({
    queryKey: LOGS_KEY,
    queryFn: fetchLogs,
    refetchInterval: 30_000,
    ...options,
  });
}

export const logsQueryKeys = {
  root: () => LOGS_KEY,
} as const;
