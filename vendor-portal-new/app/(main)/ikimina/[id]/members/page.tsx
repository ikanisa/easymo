import { notFound } from "next/navigation";
import { MemberDirectoryCard } from "@/components/ikimina/member-directory-card";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { canManageMembers, hasSaccoReadAccess } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MembersPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireUserAndProfile();
  const supabase = await createSupabaseServerClient();

  const { data: group, error: groupError } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id, name")
    .eq("id", id)
    .maybeSingle();

  if (groupError) {
    throw groupError;
  }

  if (!group) {
    notFound();
  }

  type GroupRow = Database["app"]["Tables"]["ikimina"]["Row"];
  const resolvedGroup = group as GroupRow;

  if (!hasSaccoReadAccess(profile, resolvedGroup.sacco_id)) notFound();

  const { data: members, error: membersError } = await supabase
    .from("ikimina_members_public")
    .select("id, full_name, member_code, msisdn, status, joined_at")
    .eq("ikimina_id", id)
    .order("joined_at", { ascending: false });

  if (membersError) {
    throw membersError;
  }

  type MemberRow = Database["public"]["Views"]["ikimina_members_public"]["Row"];
  const memberRows = (members ?? []) as MemberRow[];

  const allowImports = canManageMembers(profile, resolvedGroup.sacco_id);

  return (
    <MemberDirectoryCard
      groupName={resolvedGroup.name}
      members={memberRows}
      allowImports={allowImports}
      ikiminaId={id}
      saccoId={resolvedGroup.sacco_id}
    />
  );
}
