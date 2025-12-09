// ═══════════════════════════════════════════════════════════════════════════
// Members API Client
// ═══════════════════════════════════════════════════════════════════════════

import type { PaginatedResponse } from "@/types/api";
import type { Member, MemberStatus } from "@/types/payment";

interface FetchMembersParams {
  sacco_id: string;
  search?: string;
  ikimina_id?: string;
  status?: MemberStatus | "all";
  limit?: number;
  offset?: number;
}

export async function fetchMembers(
  params: FetchMembersParams
): Promise<PaginatedResponse<Member>> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, String(value));
    }
  });

  const response = await fetch(`/api/members?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch members");
  }

  return response.json();
}

export async function fetchMemberById(id: string): Promise<Member> {
  const response = await fetch(`/api/members/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch member");
  }

  const result = await response.json();
  return result.data;
}

export async function searchMembers(
  sacco_id: string,
  query: string,
  limit = 10
): Promise<Member[]> {
  const result = await fetchMembers({
    sacco_id,
    search: query,
    status: "ACTIVE",
    limit,
    offset: 0,
  });

  return result.data;
}
