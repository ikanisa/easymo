import { GradientHeader } from "@/components/ui/gradient-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusChip } from "@/components/common/status-chip";
import { OcrReviewQueue, type OcrReviewItem } from "@/components/admin/ocr/ocr-review-queue";
import { Trans } from "@/components/common/trans";
import { requireUserAndProfile } from "@/lib/auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { supabaseSrv } from "@/lib/supabase/server";
import { isMissingRelationError } from "@/lib/supabase/errors";
import {
  resolveTenantScope,
  resolveTenantScopeSearchParams,
  type TenantScopeSearchParamsInput,
} from "@/lib/admin/scope";

interface OcrPageProps {
  searchParams?: TenantScopeSearchParamsInput;
}

type ProfileRow = {
  user_id: string;
  momo_msisdn: string | null;
  whatsapp_msisdn: string | null;
  id_type: string | null;
  id_number: string | null;
  id_files: Record<string, unknown> | null;
  ocr_json: Record<string, unknown> | null;
  updated_at: string | null;
  is_verified: boolean | null;
};

type MemberRow = {
  user_id: string;
  sacco_id: string | null;
  status: string | null;
};

export default async function OcrPage({ searchParams }: OcrPageProps) {
  const { profile } = await requireUserAndProfile();
  const resolvedSearchParams = await resolveTenantScopeSearchParams(searchParams);
  const scope = resolveTenantScope(profile, resolvedSearchParams);
  const supabase = createSupabaseServiceRoleClient("admin/panel/ocr");

  const { data: profileRows, error: profileError } = await supabase
    .from("members_app_profiles")
    .select(
      "user_id, momo_msisdn, whatsapp_msisdn, id_type, id_number, id_files, ocr_json, updated_at, is_verified"
    )
    .order("updated_at", { ascending: false })
    .limit(60);

  if (profileError && !isMissingRelationError(profileError)) {
    throw profileError;
  }

  const pendingProfiles = (profileRows ?? ([] as ProfileRow[]))
    .map((row) => row as ProfileRow)
    .filter(
      (row) =>
        row.ocr_json &&
        (row.is_verified === false ||
          (row.ocr_json as Record<string, unknown>).status !== "accepted")
    );

  const userIds = pendingProfiles.map((row) => row.user_id);
  const { data: memberRows, error: memberError } = userIds.length
    ? await supabase.from("members").select("user_id, ikimina_id, status").in("user_id", userIds)
    : { data: [], error: null };

  if (memberError && !isMissingRelationError(memberError)) {
    throw memberError;
  }

  const memberRecords = (memberRows ?? []) as Array<{
    user_id: string | null;
    ikimina_id: string | null;
    status: string | null;
  }>;

  const ikiminaIds = new Set<string>(
    memberRecords
      .map((row) => (typeof row.ikimina_id === "string" ? row.ikimina_id : null))
      .filter((id): id is string => Boolean(id))
  );

  const { data: ikiminaRows, error: ikiminaError } = ikiminaIds.size
    ? await supabase.from("ibimina").select("id, sacco_id").in("id", Array.from(ikiminaIds))
    : { data: [], error: null };

  if (ikiminaError && !isMissingRelationError(ikiminaError)) {
    throw ikiminaError;
  }

  const ikiminaMap = new Map<string, string | null>(
    ((ikiminaRows ?? []) as Array<{ id: string | null; sacco_id: string | null }>)
      .filter((row) => typeof row.id === "string")
      .map((row) => [row.id as string, row.sacco_id ?? null])
  );

  const membershipMap = new Map<string, MemberRow>();
  for (const row of memberRecords) {
    if (!row.user_id) {
      continue;
    }
    const saccoId = row.ikimina_id ? (ikiminaMap.get(row.ikimina_id) ?? null) : null;
    if (!membershipMap.has(row.user_id)) {
      membershipMap.set(row.user_id, {
        user_id: row.user_id,
        sacco_id: saccoId,
        status: row.status ?? null,
      });
    }
  }

  const saccoIds = new Set<string>();
  const filteredProfiles = pendingProfiles.filter((row) => {
    const membership = membershipMap.get(row.user_id);
    if (!membership) {
      return scope.includeAll;
    }
    if (!membership.sacco_id) {
      return scope.includeAll;
    }
    saccoIds.add(membership.sacco_id);
    return scope.includeAll || membership.sacco_id === scope.saccoId;
  });

  const { data: saccoRows, error: saccoError } = saccoIds.size
    ? await supabase.schema("app").from("saccos").select("id, name").in("id", Array.from(saccoIds))
    : { data: [], error: null };

  if (saccoError && !isMissingRelationError(saccoError)) {
    throw saccoError;
  }

  const saccoLookup = new Map<string, string>(
    (saccoRows ?? []).map((row) => [String(row.id), row.name ?? ""])
  );

  const service = supabaseSrv();
  const reviewItems: OcrReviewItem[] = [];

  for (const row of filteredProfiles) {
    const membership = membershipMap.get(row.user_id);
    const idFiles = (row.id_files as Record<string, unknown> | null) ?? null;
    const docPath = typeof idFiles?.front_url === "string" ? (idFiles.front_url as string) : null;
    let documentUrl: string | null = null;
    if (docPath) {
      const { data: signed, error: signedError } = await service.storage
        .from("private")
        .createSignedUrl(docPath, 60 * 10);
      if (!signedError) {
        documentUrl = signed?.signedUrl ?? null;
      }
    }
    const ocrPayload = (row.ocr_json ?? {}) as Record<string, unknown>;
    const item: OcrReviewItem = {
      userId: row.user_id,
      saccoId: membership?.sacco_id ?? null,
      saccoName: membership?.sacco_id ? (saccoLookup.get(membership.sacco_id) ?? null) : null,
      msisdn: row.momo_msisdn ?? row.whatsapp_msisdn ?? null,
      idType: row.id_type,
      idNumber: row.id_number,
      confidence:
        typeof ocrPayload.confidence === "number" ? (ocrPayload.confidence as number) : null,
      ocrFields: ocrPayload,
      documentUrl,
      updatedAt: row.updated_at,
    };
    reviewItems.push(item);
  }

  return (
    <div className="space-y-8">
      <GradientHeader
        title={<Trans i18nKey="admin.ocr.title" fallback="OCR review" />}
        subtitle={
          <Trans
            i18nKey="admin.ocr.subtitle"
            fallback="Validate extracted identity documents before onboarding members."
            className="text-xs text-neutral-3"
          />
        }
        badge={<StatusChip tone="warning">{reviewItems.length} pending</StatusChip>}
      />

      <GlassCard
        title={<Trans i18nKey="admin.ocr.queue" fallback="Review queue" />}
        subtitle={
          <Trans
            i18nKey="admin.ocr.queueSubtitle"
            fallback="Approve accurate captures or request rescans when clarity is low."
            className="text-xs text-neutral-3"
          />
        }
      >
        <OcrReviewQueue items={reviewItems} />
      </GlassCard>

      <GlassCard
        title={<Trans i18nKey="admin.ocr.guidance" fallback="Reviewer guidance" />}
        subtitle={
          <Trans
            i18nKey="admin.ocr.guidanceSubtitle"
            fallback="Maintain high confidence by validating each field and logging reasons for rescans."
            className="text-xs text-neutral-3"
          />
        }
      >
        <ul className="list-disc space-y-2 pl-6 text-sm text-neutral-2">
          <li>
            <Trans
              i18nKey="admin.ocr.guidance.confidence"
              fallback="Trigger a manual rescan when confidence drops below 82%."
            />
          </li>
          <li>
            <Trans
              i18nKey="admin.ocr.guidance.compare"
              fallback="Cross-check member declarations against the extracted fields before approving."
            />
          </li>
          <li>
            <Trans
              i18nKey="admin.ocr.guidance.audit"
              fallback="Approval and rescan decisions are written to the audit log for traceability."
            />
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
