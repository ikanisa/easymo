"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
} from "@tanstack/react-query";

import type { Database } from "./database.types";

const API_BASE = "/api/v2";

type AgentsTable = Database["public"]["Tables"]["agents"];
type DriversTable = Database["public"]["Tables"]["drivers"];
type StationsTable = Database["public"]["Tables"]["stations"];
type VehiclesTable = Database["public"]["Tables"]["vehicles"];
type TransactionsTable = Database["public"]["Tables"]["transactions"];

export type Agent = Pick<
  AgentsTable["Row"],
  "id" | "name" | "phone" | "status" | "wallet_balance" | "created_at"
>;

export type Vehicle = Pick<
  VehiclesTable["Row"],
  "id" | "make" | "model" | "license_plate"
>;

export type Driver =
  Pick<
    DriversTable["Row"],
    "id" | "name" | "phone" | "status" | "vehicle_id" | "created_at"
  > & {
    vehicles: Vehicle | null;
  };

export type Station = Pick<
  StationsTable["Row"],
  "id" | "name" | "location" | "created_at"
>;

export type Transaction = Pick<
  TransactionsTable["Row"],
  "id" | "description" | "created_at"
> & {
  amount: number;
};

export interface DashboardMetrics {
  totalAgents: number;
  totalDrivers: number;
  totalStations: number;
  monthlyRevenue: number;
}

type AgentCreateInput = {
  id?: string;
  name: string;
  phone: string;
  status?: string | null;
  wallet_balance?: number | null;
};

type AgentUpdateInput = { id: string } & Partial<Omit<AgentCreateInput, "id">>;

type DriverCreateInput = {
  id?: string;
  name: string;
  phone: string;
  status?: string | null;
  vehicle_id?: string | null;
};

type DriverUpdateInput = { id: string } & Partial<Omit<DriverCreateInput, "id">>;

type StationCreateInput = {
  id?: string;
  name: string;
  location?: string | null;
};

type StationUpdateInput = { id: string } & Partial<Omit<StationCreateInput, "id">>;

async function request<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    credentials: init.credentials ?? "same-origin",
  });

  const text = await response.text();
  let data: unknown = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as { error: unknown }).error)
        : response.statusText;

    throw new Error(message || "Request failed");
  }

  return data as T;
}

function buildUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function useSupabaseQuery<TData, TError = Error>(
  queryKey: QueryKey,
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData, QueryKey>, "queryKey" | "queryFn">,
): UseQueryResult<TData, TError> {
  return useQuery({
    queryKey,
    queryFn,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}

export function useAgents(
  options?: Omit<UseQueryOptions<Agent[], Error, Agent[], QueryKey>, "queryKey" | "queryFn">,
) {
  return useSupabaseQuery<Agent[]>(
    ["agents"],
    () => request<Agent[]>(buildUrl("/agents")),
    options,
  );
}

type AgentUpdateMutation = UseMutationResult<Agent, Error, AgentUpdateInput>;

type AgentCreateMutation = UseMutationResult<Agent, Error, AgentCreateInput>;

export function useUpdateAgent(): AgentUpdateMutation {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: AgentUpdateInput) =>
      request<Agent>(buildUrl(`/agents/${encodeURIComponent(id)}`), {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useCreateAgent(): AgentCreateMutation {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AgentCreateInput) =>
      request<Agent>(buildUrl("/agents"), {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation<Agent, Error, { id: string }>({
    mutationFn: async ({ id }) =>
      request<Agent>(buildUrl(`/agents/${encodeURIComponent(id)}`), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDrivers(
  options?: Omit<UseQueryOptions<Driver[], Error, Driver[], QueryKey>, "queryKey" | "queryFn">,
) {
  return useSupabaseQuery(
    ["drivers"],
    () => request<Driver[]>(buildUrl("/drivers")),
    options,
  );
}

export function useUpdateDriver() {
  const queryClient = useQueryClient();

  return useMutation<Driver, Error, DriverUpdateInput>({
    mutationFn: async ({ id, ...updates }) =>
      request<Driver>(buildUrl(`/drivers/${encodeURIComponent(id)}`), {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();

  return useMutation<Driver, Error, DriverCreateInput>({
    mutationFn: async (payload) =>
      request<Driver>(buildUrl("/drivers"), {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();

  return useMutation<Driver, Error, { id: string }>({
    mutationFn: async ({ id }) =>
      request<Driver>(buildUrl(`/drivers/${encodeURIComponent(id)}`), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useStations(
  options?: Omit<UseQueryOptions<Station[], Error, Station[], QueryKey>, "queryKey" | "queryFn">,
) {
  return useSupabaseQuery(
    ["stations"],
    () => request<Station[]>(buildUrl("/stations")),
    options,
  );
}

export function useUpdateStation() {
  const queryClient = useQueryClient();

  return useMutation<Station, Error, StationUpdateInput>({
    mutationFn: async ({ id, ...updates }) =>
      request<Station>(buildUrl(`/stations/${encodeURIComponent(id)}`), {
        method: "PATCH",
        body: JSON.stringify(updates),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

export function useCreateStation() {
  const queryClient = useQueryClient();

  return useMutation<Station, Error, StationCreateInput>({
    mutationFn: async (payload) =>
      request<Station>(buildUrl("/stations"), {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

export function useDeleteStation() {
  const queryClient = useQueryClient();

  return useMutation<Station, Error, { id: string }>({
    mutationFn: async ({ id }) =>
      request<Station>(buildUrl(`/stations/${encodeURIComponent(id)}`), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

export function useVehicles() {
  return useSupabaseQuery<Vehicle[]>(["vehicles"], () =>
    request<Vehicle[]>(buildUrl("/vehicles")),
  );
}

export function useRecentTransactions(limit = 5) {
  return useSupabaseQuery<Transaction[]>(
    ["transactions", limit],
    () => request<Transaction[]>(buildUrl(`/transactions?limit=${limit}`)),
  );
}

export function useDashboardMetrics() {
  return useSupabaseQuery<DashboardMetrics>(["dashboard-metrics"], () =>
    request<DashboardMetrics>(buildUrl("/dashboard/metrics")),
  );
}
