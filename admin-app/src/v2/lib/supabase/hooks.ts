"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationResult,
  type UseQueryResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { createClient } from "./client";
import type {
  AgentRow,
  DriverRow,
  StationRow,
  TransactionRow,
  VehicleRow,
  Database,
} from "./database.types";

type DriverWithVehicle = DriverRow & { vehicles: VehicleRow | null };

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
  options?: Omit<UseQueryOptions<AgentRow[], Error, AgentRow[], QueryKey>, "queryKey" | "queryFn">,
) {
  const supabase = createClient();

  return useSupabaseQuery<AgentRow[]>(
    ["agents"],
    async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    options,
  );
}

export function useDrivers(
  options?: Omit<
    UseQueryOptions<DriverWithVehicle[], Error, DriverWithVehicle[], QueryKey>,
    "queryKey" | "queryFn"
  >,
) {
  const supabase = createClient();

  return useSupabaseQuery(
    ["drivers"],
    async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*, vehicles(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as DriverWithVehicle[];
    },
    options,
  );
}

type UpdateAgentInput = Partial<Omit<AgentRow, "id">> & Pick<AgentRow, "id">;

type UpdateAgentMutation = UseMutationResult<AgentRow, Error, UpdateAgentInput>;

export function useUpdateAgent(): UpdateAgentMutation {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAgentInput) => {
      const { data, error } = await supabase
        .from("agents")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

type CreateAgentInput = Database["public"]["Tables"]["agents"]["Insert"];

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<AgentRow, Error, CreateAgentInput>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from("agents")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<AgentRow, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase
        .from("agents")
        .delete()
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

type UpdateDriverInput = Partial<Omit<DriverRow, "id">> & Pick<DriverRow, "id">;

export function useUpdateDriver() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<DriverWithVehicle, Error, UpdateDriverInput>({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from("drivers")
        .update(updates)
        .eq("id", id)
        .select("*, vehicles(*)")
        .single();

      if (error) throw error;
      return data as DriverWithVehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

type CreateDriverInput = Database["public"]["Tables"]["drivers"]["Insert"];

export function useCreateDriver() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<DriverWithVehicle, Error, CreateDriverInput>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from("drivers")
        .insert(payload)
        .select("*, vehicles(*)")
        .single();

      if (error) throw error;
      return data as DriverWithVehicle;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useDeleteDriver() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<DriverRow, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase
        .from("drivers")
        .delete()
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

type UpdateStationInput = Partial<Omit<StationRow, "id">> & Pick<StationRow, "id">;

export function useUpdateStation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<StationRow, Error, UpdateStationInput>({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from("stations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

type CreateStationInput = Database["public"]["Tables"]["stations"]["Insert"];

export function useCreateStation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<StationRow, Error, CreateStationInput>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from("stations")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

export function useDeleteStation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation<StationRow, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const { data, error } = await supabase
        .from("stations")
        .delete()
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stations"] });
    },
  });
}

export function useVehicles() {
  const supabase = createClient();

  return useSupabaseQuery<VehicleRow[]>(
    ["vehicles"],
    async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .order("make", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  );
}

export function useRecentTransactions(limit = 5) {
  const supabase = createClient();

  return useSupabaseQuery<TransactionRow[]>(
    ["transactions", limit],
    async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data ?? [];
    },
  );
}
