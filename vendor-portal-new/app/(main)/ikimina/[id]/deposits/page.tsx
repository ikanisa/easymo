import { notFound } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { StatementImportWizard } from "@/components/ikimina/statement-import-wizard";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { IkiminaDepositsTable } from "@/components/ikimina/ikimina-deposits-table";
import type { Database } from "@/lib/supabase/types";
import { canImportStatements, hasSaccoReadAccess } from "@/lib/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function DepositsPage({ params }: PageProps) {
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

  const { data: deposits, error: depositsError } = await supabase
    .schema("app")
    .from("payments")
    .select("id, amount, currency, status, occurred_at, reference, msisdn")
    .eq("ikimina_id", id)
    .order("occurred_at", { ascending: false })
    .limit(500);

  if (depositsError) {
    throw depositsError;
  }

  type DepositRow = {
    id: string;
    amount: number;
    currency: string;
    status: string;
    occurred_at: string;
    reference: string | null;
    msisdn: string | null;
  };

  const depositRows = (deposits ?? []) as DepositRow[];

  const allowImport = canImportStatements(profile, resolvedGroup.sacco_id);

  return (
    <GlassCard
      title={`Deposits · ${resolvedGroup.name}`}
      subtitle={`${deposits?.length ?? 0} recent payments`}
      actions={
        allowImport ? (
          <StatementImportWizard
            saccoId={resolvedGroup.sacco_id}
            ikiminaId={resolvedGroup.id}
            canImport
          />
        ) : (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-3">Read only</span>
        )
      }
    >
      <IkiminaDepositsTable
        data={depositRows.map((row) => ({
          id: row.id,
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          occurred_at: row.occurred_at,
          reference: row.reference,
          msisdn: row.msisdn,
        }))}
      />
    </GlassCard>
  );
}
