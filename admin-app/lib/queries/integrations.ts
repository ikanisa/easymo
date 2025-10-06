import { apiFetch } from "@/lib/api/client";
import {
  QueryKey,
  useQuery,
  UseQueryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

export type IntegrationStatusLevel = "green" | "amber" | "red";

export interface IntegrationStatusEntry {
  status: IntegrationStatusLevel;
  message: string;
  checkedAt?: string;
}

const INTEGRATION_TARGETS = [
  "voucherPreview",
  "whatsappSend",
  "campaignDispatcher",
  "storageSignedUrl",
] as const;

export type IntegrationTarget = typeof INTEGRATION_TARGETS[number];

export type IntegrationStatusMap = Record<
  IntegrationTarget,
  IntegrationStatusEntry
>;

const FALLBACK_STATUSES: IntegrationStatusMap = {
  voucherPreview: {
    status: "amber",
    message: "Preview bridge awaiting health check.",
  },
  whatsappSend: {
    status: "amber",
    message: "Send bridge uses mock acknowledgements in this environment.",
  },
  campaignDispatcher: {
    status: "amber",
    message: "Dispatcher bridge not configured for this build.",
  },
  storageSignedUrl: {
    status: "amber",
    message: "Storage signed URL probe not available yet.",
  },
};

function isIntegrationStatusEntry(
  value: unknown,
): value is IntegrationStatusEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as IntegrationStatusEntry;
  return candidate.status === "green" || candidate.status === "amber"
    || candidate.status === "red";
}

const integrationStatusKey: QueryKey = ["integration-status"];

export async function fetchIntegrationStatus(): Promise<IntegrationStatusMap> {
  const response = await apiFetch<Partial<Record<IntegrationTarget,
    IntegrationStatusEntry
  >>>("/api/integrations/status", {
    cache: "no-store",
  });

  if (!response.ok) {
    return { ...FALLBACK_STATUSES };
  }

  const data = response.data ?? {};
  const merged: Partial<IntegrationStatusMap> = {};

  for (const target of INTEGRATION_TARGETS) {
    const entry = data[target];
    if (isIntegrationStatusEntry(entry)) {
      merged[target] = entry;
    }
  }

  return { ...FALLBACK_STATUSES, ...merged } as IntegrationStatusMap;
}

export function useIntegrationStatusQuery(
  options?: UseQueryOptions<IntegrationStatusMap>,
) {
  return useQuery({
    queryKey: integrationStatusKey,
    queryFn: fetchIntegrationStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
    ...options,
  });
}

export function useIntegrationStatusUpdater() {
  const queryClient = useQueryClient();
  return useCallback(
    (
      target: IntegrationTarget,
      value: IntegrationStatusEntry,
    ) => {
      queryClient.setQueryData<IntegrationStatusMap>(
        integrationStatusKey,
        (current) => ({
          ...FALLBACK_STATUSES,
          ...(current ?? {}),
          [target]: value,
        }),
      );
    },
    [queryClient],
  );
}

export const integrationStatusQueryKeys = {
  all: () => integrationStatusKey,
} as const;
