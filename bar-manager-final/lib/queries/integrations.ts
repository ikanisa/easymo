import {
  QueryKey,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes";

export type IntegrationStatusLevel = "green" | "amber" | "red";

export interface IntegrationStatusEntry {
  status: IntegrationStatusLevel;
  message: string;
  checkedAt?: string;
}

const INTEGRATION_TARGETS = [
  "whatsappSend",
  "storageSignedUrl",
] as const;

export type IntegrationTarget = typeof INTEGRATION_TARGETS[number];

export type IntegrationStatusMap = Record<
  IntegrationTarget,
  IntegrationStatusEntry
>;

const FALLBACK_STATUSES: IntegrationStatusMap = {
  whatsappSend: {
    status: "amber",
    message: "Set NEXT_PUBLIC_WHATSAPP_SEND_ENDPOINT for live sends.",
  },
  storageSignedUrl: {
    status: "amber",
    message: "Provide Supabase credentials to sign storage URLs.",
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
  try {
    const response = await apiFetch<Partial<Record<IntegrationTarget, IntegrationStatusEntry>>>(
      getAdminApiPath("integrations", "status"), 
      { cache: "no-store" }
    );

    const merged: Partial<IntegrationStatusMap> = {};

    for (const target of INTEGRATION_TARGETS) {
      const entry = response[target];
      if (isIntegrationStatusEntry(entry)) {
        merged[target] = entry;
      }
    }

    return { ...FALLBACK_STATUSES, ...merged } as IntegrationStatusMap;
  } catch {
    return { ...FALLBACK_STATUSES };
  }
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
