import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { hasSaccoReadAccess } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StatementsPage({ params }: PageProps) {
  const { id } = await params;
  const { profile } = await requireUserAndProfile();
  const supabase = await createSupabaseServerClient();

  const { data: group, error } = await supabase
    .schema("app")
    .from("ikimina")
    .select("id, sacco_id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!group) {
    notFound();
  }

  type GroupRow = Database["app"]["Tables"]["ikimina"]["Row"];
  const resolvedGroup = group as GroupRow;

  if (!hasSaccoReadAccess(profile, resolvedGroup.sacco_id)) notFound();

  return (
    <GlassCard
      title={`Statements · ${resolvedGroup.name}`}
      subtitle="Choose a period and export PDF/CSV statements."
      actions={<span className="text-xs text-neutral-2">Coming soon</span>}
    >
      <div className="flex flex-col gap-4 rounded-2xl border border-dashed border-white/20 p-6 text-sm text-neutral-2">
        <p>
          Statement generation is being redesigned to include running balances, branded headers, and
          QR-verifiable hashes.
        </p>
        <p>
          Upload a statement via the bulk wizard to populate this view, or return once the ingestion
          workflow lands.
        </p>
      </div>
    </GlassCard>
  );
}
