import { GradientHeader } from "@/components/ui/gradient-header";
import { StatusChip } from "@/components/common/status-chip";
import { LoansPipelineBoard } from "@/components/admin/loans/pipeline-board";
import { requireUserAndProfile } from "@/lib/auth";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { isMissingRelationError } from "@/lib/supabase/errors";

const STAGE_ORDER = [
  "DRAFT",
  "SUBMITTED",
  "RECEIVED",
  "UNDER_REVIEW",
  "APPROVED",
  "DISBURSED",
  "DECLINED",
  "CANCELLED",
] as const;

type LoanStage = (typeof STAGE_ORDER)[number];

interface LoansPipelinePageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

interface PipelineLoanRow {
  id: string;
  status: string;
  requested_amount: number | string | null;
  tenor_months: number | null;
  applicant_name: string | null;
  applicant_phone: string | null;
  created_at: string | null;
  status_updated_at: string | null;
  partner_reference: string | null;
  product: { name: string | null; partner_name: string | null } | null;
  org_id: string | null;
}

export default async function LoansPipelinePage({ searchParams }: LoansPipelinePageProps) {
  const { profile } = await requireUserAndProfile();
  const resolved = await resolveTenantScopeSearchParams(searchParams);
  resolveTenantScope(profile, resolved);
  createSupabaseServiceRoleClient("admin/panel/loans");

  // Feature disabled: loan_applications table does not exist
  // Return empty state until feature is enabled
  const data: PipelineLoanRow[] = [];
  const error = null;

  // Commented out - loan feature is disabled
  // let query = supabase
  //   .from("loan_applications")
  //   .select(
  //     "id, status, requested_amount, tenor_months, applicant_name, applicant_phone, created_at, status_updated_at, partner_reference, product:loan_products(name, partner_name), org_id"
  //   )
  //   .order("created_at", { ascending: false })
  //   .limit(500);

  // if (!scope.includeAll && scope.saccoId) {
  //   query = query.eq("org_id", scope.saccoId);
  // }

  // const { data, error } = await query;

  if (error) {
    if (isMissingRelationError(error)) {
      return renderEmptyState();
    }
    throw error;
  }

  const rows = (data ?? []) as PipelineLoanRow[];
  const total = rows.length;
  const stageCounts = computeStageCounts(rows);

  return (
    <div className="space-y-8">
      <GradientHeader
        title="Loans pipeline"
        subtitle="Track applications from origination through collections, with inline bulk actions and filterable stages."
        badge={<StatusChip tone="info">{total} records</StatusChip>}
      />

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
        <h2 className="text-xs uppercase tracking-[0.3em] text-white/50">Stage summary</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="rounded-2xl border border-white/10 bg-white/8 p-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                {stage.replace(/_/g, " ")}
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">
                {stageCounts.get(stage) ?? 0}
              </p>
            </div>
          ))}
        </div>
      </section>

      <LoansPipelineBoard
        loans={rows.map((row) => ({
          id: row.id,
          status: row.status,
          requested_amount: row.requested_amount,
          tenor_months: row.tenor_months,
          applicant_name: row.applicant_name,
          applicant_phone: row.applicant_phone,
          created_at: row.created_at,
          status_updated_at: row.status_updated_at,
          partner_reference: row.partner_reference,
          product: row.product,
        }))}
      />
    </div>
  );
}

function computeStageCounts(rows: PipelineLoanRow[]) {
  const map = new Map<LoanStage, number>();
  for (const stage of STAGE_ORDER) {
    map.set(stage, 0);
  }
  for (const row of rows) {
    const stage = stageFromRow(row.status);
    map.set(stage, (map.get(stage) ?? 0) + 1);
  }
  return map;
}

function stageFromRow(status: string): LoanStage {
  const upper = status.toUpperCase() as LoanStage;
  return (STAGE_ORDER.includes(upper) ? upper : "SUBMITTED") as LoanStage;
}

function renderEmptyState() {
  return (
    <div className="space-y-6">
      <GradientHeader
        title="Loans pipeline"
        subtitle="Track applications from origination through collections, with inline bulk actions and filterable stages."
        badge={<StatusChip tone="info">0 records</StatusChip>}
      />
      <p className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
        Loan applications are not enabled for this tenant yet.
      </p>
    </div>
  );
}
