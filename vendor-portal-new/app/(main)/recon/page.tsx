import { AppShellHero } from "@/components/layout/app-shell";
import {
  WorkspaceAside,
  WorkspaceLayout,
  WorkspaceMain,
} from "@/components/layout/workspace-layout";
import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { StatementImportWizard } from "@/components/ikimina/statement-import-wizard";
import { ReconciliationTable } from "@/components/recon/reconciliation-table";
import { SmsInboxPanel } from "@/components/recon/sms-inbox-panel";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { canImportStatements, canReconcilePayments, isSystemAdmin } from "@/lib/permissions";
import { Trans } from "@/components/common/trans";
import { logWarn } from "@/lib/observability/logger";
import { QueuedSyncSummary } from "@/components/system/queued-sync-summary";

const EXCEPTION_STATUSES = ["UNALLOCATED", "PENDING", "REJECTED"] as const;
const AUTH_GUEST_MODE = process.env.AUTH_GUEST_MODE === "1";

const parseSmsJson = (
  value: Database["app"]["Tables"]["sms_inbox"]["Row"]["parsed_json"]
): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch (error) {
      logWarn("recon.sms_parse_failed", { error });
    }
  }
  return null;
};

type ExceptionRow = Database["app"]["Tables"]["payments"]["Row"] & {
  source: Pick<
    Database["app"]["Tables"]["sms_inbox"]["Row"],
    "raw_text" | "parsed_json" | "msisdn" | "received_at"
  > | null;
};

type SmsRow = Pick<
  Database["app"]["Tables"]["sms_inbox"]["Row"],
  "id" | "raw_text" | "parsed_json" | "msisdn" | "received_at" | "status" | "confidence" | "error"
>;

const GUEST_EXCEPTIONS: ExceptionRow[] = [
  {
    id: "exc-1",
    sacco_id: "stub-sacco",
    ikimina_id: "ikimina-1",
    member_id: "member-1",
    msisdn: "+250788123456",
    reference: "FT12345",
    amount: 50000,
    occurred_at: new Date().toISOString(),
    status: "UNALLOCATED",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    source: {
      raw_text: "MoMoPay FT12345 RWF 50,000",
      parsed_json: { amount: 50000, reference: "FT12345" },
      msisdn: "+250788123456",
      received_at: new Date().toISOString(),
    },
  } as ExceptionRow,
];

const GUEST_SMS: SmsRow[] = [
  {
    id: "sms-1",
    raw_text: "Payment of RWF 12,000 from 0788 321 654",
    parsed_json: { amount: 12000, payer: "0788321654" },
    msisdn: "+250788321654",
    received_at: new Date().toISOString(),
    status: "PARSED",
    confidence: 0.92,
    error: null,
  },
];

export default async function ReconciliationPage() {
  const { profile } = await requireUserAndProfile();

  if (AUTH_GUEST_MODE) {
    return renderReconciliation({
      profile,
      exceptions: GUEST_EXCEPTIONS,
      smsEntries: GUEST_SMS,
      summaryCount: GUEST_EXCEPTIONS.length,
      canImport: true,
      canReconcile: true,
    });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .schema("app")
    .from("payments")
    .select(
      "id, sacco_id, ikimina_id, member_id, msisdn, reference, amount, occurred_at, status, source:sms_inbox(raw_text, parsed_json, msisdn, received_at)"
    )
    .in("status", EXCEPTION_STATUSES)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id) {
    query = query.eq("sacco_id", profile.sacco_id);
  }

  const { data, error } = await query.returns<ExceptionRow[]>();

  if (error) {
    throw error;
  }

  let smsQuery = supabase
    .schema("app")
    .from("sms_inbox")
    .select("id, raw_text, parsed_json, msisdn, received_at, status, confidence, error")
    .order("received_at", { ascending: false })
    .limit(60);

  if (profile.role !== "SYSTEM_ADMIN" && profile.sacco_id) {
    smsQuery = smsQuery.eq("sacco_id", profile.sacco_id);
  }

  const { data: smsEntries, error: smsError } = await smsQuery.returns<SmsRow[]>();

  if (smsError) {
    throw smsError;
  }

  return renderReconciliation({
    profile,
    exceptions: data ?? [],
    smsEntries: smsEntries ?? [],
    summaryCount: (data ?? []).length,
    canImport: profile.sacco_id
      ? canImportStatements(profile, profile.sacco_id)
      : isSystemAdmin(profile),
    canReconcile: profile.sacco_id
      ? canReconcilePayments(profile, profile.sacco_id)
      : isSystemAdmin(profile),
  });
}

function renderReconciliation({
  profile,
  exceptions,
  smsEntries,
  summaryCount,
  canImport,
  canReconcile,
}: {
  profile: Awaited<ReturnType<typeof requireUserAndProfile>>["profile"];
  exceptions: ExceptionRow[];
  smsEntries: SmsRow[];
  summaryCount: number;
  canImport: boolean;
  canReconcile: boolean;
}) {
  const allowStatementImport = canImport;
  const allowReconciliationUpdates = canReconcile;

  const smsPanelItems = (smsEntries ?? []).map((item) => ({
    id: item.id,
    raw_text: item.raw_text,
    parsed_json: parseSmsJson(item.parsed_json),
    msisdn: item.msisdn,
    received_at: item.received_at,
    status: item.status ?? "UNPARSED",
    confidence: item.confidence,
    error: item.error ?? null,
  }));

  return (
    <>
      <AppShellHero>
        <GradientHeader
          title={<Trans i18nKey="recon.title" fallback="Reconciliation" />}
          subtitle={
            <Trans
              i18nKey="recon.subtitle"
              fallback="Resolve unknown references, duplicates, and mismatched deposits to keep ledgers clean."
              className="text-xs text-ink/70"
            />
          }
          badge={<StatusChip tone="warning">{summaryCount} pending</StatusChip>}
        />
      </AppShellHero>

      <WorkspaceLayout>
        <WorkspaceMain className="space-y-8">
          <GlassCard
            title={<Trans i18nKey="recon.momo.title" fallback="MoMo statement ingest" />}
            subtitle={
              <Trans
                i18nKey="recon.momo.subtitle"
                fallback="Apply validation masks, review parser feedback, and ingest clean deposits."
                className="text-xs text-neutral-3"
              />
            }
            actions={
              profile.sacco_id ? (
                <StatementImportWizard
                  saccoId={profile.sacco_id}
                  variant="momo"
                  canImport={allowStatementImport}
                  disabledReason="Read-only access"
                />
              ) : undefined
            }
          >
            {profile.sacco_id ? (
              <div className="space-y-2 text-sm text-neutral-2">
                <p className="text-xs text-neutral-3">
                  <Trans
                    i18nKey="recon.momo.note1"
                    fallback="Drag-and-drop MTN CSV exports. The wizard normalises Kigali timestamps, phone numbers, and amounts automatically."
                  />
                </p>
                <p className="text-xs text-neutral-3">
                  <Trans
                    i18nKey="recon.momo.note2"
                    fallback="Parser feedback highlights duplicates, missing references, and invalid rows before anything is posted."
                  />
                </p>
                <p className="text-xs text-neutral-3">
                  <Trans
                    i18nKey="recon.momo.note3"
                    fallback="Only validated rows reach Supabase; duplicates and bad records are held back for manual follow-up."
                  />
                </p>
              </div>
            ) : (
              <p className="text-sm text-neutral-2">
                <Trans
                  i18nKey="recon.momo.assignSacco"
                  fallback="Assign yourself to a SACCO to enable statement ingestion."
                  className="text-xs text-neutral-3"
                />
              </p>
            )}
          </GlassCard>

          <GlassCard
            title={<Trans i18nKey="recon.sms.title" fallback="SMS inbox" />}
            subtitle={
              <Trans
                i18nKey="recon.sms.subtitle"
                fallback="Latest MoMo SMS messages captured by the gateway and ready for parsing."
                className="text-xs text-neutral-3"
              />
            }
          >
            <SmsInboxPanel items={smsPanelItems} />
          </GlassCard>

          <GlassCard
            title={<Trans i18nKey="recon.exceptions.title" fallback="Exceptions" />}
            subtitle={
              <Trans
                i18nKey="recon.exceptions.subtitle"
                fallback="Recent issues surfaced by the parser."
                className="text-xs text-neutral-3"
              />
            }
          >
            <ReconciliationTable
              rows={exceptions ?? []}
              saccoId={profile.sacco_id}
              canWrite={allowReconciliationUpdates}
            />
          </GlassCard>
        </WorkspaceMain>

        <WorkspaceAside>
          <QueuedSyncSummary />
        </WorkspaceAside>
      </WorkspaceLayout>
    </>
  );
}
