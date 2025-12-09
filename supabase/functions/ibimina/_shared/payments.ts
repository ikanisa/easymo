import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type AnyClient = SupabaseClient<any, any, any>;

export type ReferenceResolution = {
  saccoId: string | null;
  ikiminaId: string | null;
  memberId: string | null;
  status: "PENDING" | "UNALLOCATED" | "POSTED";
};

export const resolveReference = async (
  supabase: AnyClient,
  reference: string | undefined | null,
  fallbackSaccoId: string | null
): Promise<ReferenceResolution> => {
  if (!reference) {
    return { saccoId: fallbackSaccoId, ikiminaId: null, memberId: null, status: "PENDING" };
  }

  const parts = reference.split(".");
  if (parts.length < 3) {
    return { saccoId: fallbackSaccoId, ikiminaId: null, memberId: null, status: "UNALLOCATED" };
  }

  const groupCode = parts[2];
  const { data: ikimina, error: ikiminaError } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id")
    .eq("code", groupCode)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (ikiminaError) {
    throw ikiminaError;
  }

  if (!ikimina?.id) {
    return { saccoId: fallbackSaccoId, ikiminaId: null, memberId: null, status: "UNALLOCATED" };
  }

  const resolvedSaccoId = ikimina.sacco_id as string;

  if (parts.length < 4) {
    return {
      saccoId: resolvedSaccoId,
      ikiminaId: ikimina.id as string,
      memberId: null,
      status: "UNALLOCATED",
    };
  }

  const memberCode = parts[3];
  const { data: member, error: memberError } = await supabase
    .schema("app")
    .from("members")
    .select("id")
    .eq("ikimina_id", ikimina.id)
    .eq("member_code", memberCode)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (memberError) {
    throw memberError;
  }

  if (!member?.id) {
    return {
      saccoId: resolvedSaccoId,
      ikiminaId: ikimina.id as string,
      memberId: null,
      status: "UNALLOCATED",
    };
  }

  return {
    saccoId: resolvedSaccoId,
    ikiminaId: ikimina.id as string,
    memberId: member.id as string,
    status: "POSTED",
  };
};
