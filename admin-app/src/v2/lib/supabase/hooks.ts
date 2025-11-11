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
import type { AgentRow, TransactionRow, Database } from "./database.types";

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
    UseQueryOptions<
      (Database["public"]["Tables"]["drivers"]["Row"] & { vehicles: Database["public"]["Tables"]["vehicles"]["Row"] | null })[],
      Error,
      (Database["public"]["Tables"]["drivers"]["Row"] & { vehicles: Database["public"]["Tables"]["vehicles"]["Row"] | null })[],
      QueryKey
    >,
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
      return data ?? [];
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
