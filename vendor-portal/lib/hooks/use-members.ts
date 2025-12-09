// ═══════════════════════════════════════════════════════════════════════════
// useMembers - React Query hooks for members
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchMembers, fetchMemberById, searchMembers } from "@/lib/api/members";
import type { MemberStatus } from "@/types/payment";

interface UseMembersParams {
  sacco_id: string;
  search?: string;
  ikimina_id?: string;
  status?: MemberStatus | "all";
  limit?: number;
  offset?: number;
}

export function useMembers(params: UseMembersParams) {
  return useQuery({
    queryKey: ["members", params],
    queryFn: () => fetchMembers(params),
    enabled: !!params.sacco_id,
  });
}

export function useMember(id: string | null) {
  return useQuery({
    queryKey: ["member", id],
    queryFn: () => fetchMemberById(id!),
    enabled: !!id,
  });
}

export function useMemberSearch(sacco_id: string, query: string, enabled = true) {
  return useQuery({
    queryKey: ["member-search", sacco_id, query],
    queryFn: () => searchMembers(sacco_id, query),
    enabled: enabled && !!sacco_id && query.length >= 2,
    staleTime: 5000, // Cache for 5 seconds
  });
}
