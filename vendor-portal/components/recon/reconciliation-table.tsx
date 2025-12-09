"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  useDeferredValue,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { logError } from "@/lib/observability/logger";
import { StatusChip } from "@/components/common/status-chip";
import { Input } from "@/components/ui/input";
import { Drawer } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useToast } from "@/providers/toast-provider";
import { useTranslation } from "@/providers/i18n-provider";
import { useOfflineQueue } from "@/providers/offline-queue-provider";
import { markFilterLatency, startFilterLatency, trackTaskFunnel } from "@/src/instrumentation/ux";

const supabase = getSupabaseBrowserClient();

export type ReconciliationRow = Database["app"]["Tables"]["payments"]["Row"] & {
  source: Pick<
    Database["app"]["Tables"]["sms_inbox"]["Row"],
    "raw_text" | "parsed_json" | "msisdn" | "received_at"
  > | null;
};

interface ReconciliationTableProps {
  rows: ReconciliationRow[];
  saccoId: string | null;
  canWrite: boolean;
}

const STATUS_OPTIONS: Database["app"]["Tables"]["payments"]["Row"]["status"][] = [
  "UNALLOCATED",
  "PENDING",
  "POSTED",
  "SETTLED",
  "REJECTED",
];

const CONFIDENCE_THRESHOLD = 0.8;

type ReasonChip = {
  id: string;
  label: { primary: string; secondary: string };
  tone: "warning" | "critical" | "info";
};

const STATUS_BILINGUAL: Record<string, { primary: string; secondary: string }> = {
  UNALLOCATED: { primary: "unallocated", secondary: "bitaragabanywa" },
  PENDING: { primary: "pending", secondary: "birategereje" },
  POSTED: { primary: "posted", secondary: "byemejwe" },
  SETTLED: { primary: "settled", secondary: "byarangije" },
  REJECTED: { primary: "rejected", secondary: "byanzwe" },
};

const getStatusLabel = (status: Database["app"]["Tables"]["payments"]["Row"]["status"]) =>
  STATUS_BILINGUAL[status] ?? { primary: status.toLowerCase(), secondary: status.toLowerCase() };

type MemberResult = {
  id: string;
  full_name: string;
  member_code: string | null;
  msisdn: string | null;
  ikimina_id: string;
  ikimina_name: string | null;
};

const reasonRules = {
  missingReference: {
    id: "missing-reference",
    label: { primary: "Missing reference", secondary: "Indango ibura" },
    tone: "warning" as const,
  },
  unallocated: {
    id: "needs-member",
    label: { primary: "Member not matched", secondary: "Umunyamuryango ntabonekanye" },
    tone: "critical" as const,
  },
  duplicate: {
    id: "duplicate",
    label: { primary: "Duplicate txn", secondary: "Ubutumwa bwisubiyemo" },
    tone: "warning" as const,
  },
  pendingReview: {
    id: "manual-review",
    label: { primary: "Manual review", secondary: "Gusuzumwa n'intoki" },
    tone: "info" as const,
  },
  parserFailure: {
    id: "parser-failure",
    label: { primary: "Parser missing fields", secondary: "Ibyatanzwe ntibyuzuye" },
    tone: "warning" as const,
  },
  msisdnMismatch: {
    id: "msisdn-mismatch",
    label: { primary: "Masked MSISDN", secondary: "Numero yihishwe" },
    tone: "warning" as const,
  },
  lowConfidence: {
    id: "low-confidence",
    label: { primary: "Low confidence", secondary: "Icyizere gito" },
    tone: "warning" as const,
  },
} satisfies Record<string, ReasonChip>;

const reasonEntries = Object.values(reasonRules);

const reasonGuidance: Record<ReasonChip["id"], { primary: string; secondary: string }> = {
  "missing-reference": {
    primary: "Add a SACCO.IKIMINA(.MEMBER) reference before posting.",
    secondary: "Shyiraho indango SACCO.IKIMINA(.MEMER) mbere yo kubyemeza.",
  },
  "needs-member": {
    primary: "Link to a member to clear unallocated funds.",
    secondary: "Huza n'umunyamuryango kugirango ukureho amafaranga ataraboneka.",
  },
  duplicate: {
    primary: "Compare with existing transactions sharing this reference.",
    secondary: "Gereranya n'ubundi butumwa bufite iyi ndango.",
  },
  "manual-review": {
    primary: "Review supporting documents before updating status.",
    secondary: "Suzuma ibimenyetso mbere yo guhindura imiterere.",
  },
  "parser-failure": {
    primary: "Fix the SMS format and retry the parser or assign manually.",
    secondary: "Hindura imiterere ya SMS wongere ubishakishe cyangwa ubihuze intoki.",
  },
  "msisdn-mismatch": {
    primary: "Capture the sender MSISDN from statements for future auto-matching.",
    secondary: "Andika nimero ya telefoni ku nyandiko kugirango bizafashe guhuza ku buryo bwikora.",
  },
  "low-confidence": {
    primary: "Double-check amount and reference before marking posted.",
    secondary: "Ongera wemeze amafaranga n'indango mbere yo kubyemeza.",
  },
};
const REASON_GUIDANCE_KEYS: Record<ReasonChip["id"], string> = {
  "missing-reference": "recon.guidance.missingReference",
  "needs-member": "recon.guidance.needsMember",
  duplicate: "recon.guidance.duplicate",
  "manual-review": "recon.guidance.manualReview",
  "parser-failure": "recon.guidance.parserFailure",
  "msisdn-mismatch": "recon.guidance.msisdnMismatch",
  "low-confidence": "recon.guidance.lowConfidence",
};

export function ReconciliationTable({ rows, saccoId, canWrite }: ReconciliationTableProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<ReconciliationRow | null>(null);
  const [newStatus, setNewStatus] = useState<string>("POSTED");
  const [_actionMessage, setActionMessage] = useState<string | null>(null);
  const [_actionError, setActionError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkIkiminaId, setBulkIkiminaId] = useState("");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [_memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [_memberLoading, setMemberLoading] = useState(false);
  const [_aiSuggestion, setAiSuggestion] = useState<{
    member_id: string;
    ikimina_id: string | null;
    confidence: number;
    reason: string;
    member_code?: string | null;
  } | null>(null);
  const [_aiAlternatives, setAiAlternatives] = useState<
    Array<{
      member_id: string;
      ikimina_id: string | null;
      confidence: number;
      reason: string;
      member_code?: string | null;
    }>
  >([]);
  const [_aiStatus, setAiStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [_aiError, setAiError] = useState<string | null>(null);
  const [aiRefreshToken, setAiRefreshToken] = useState(0);
  const [pending, startTransition] = useTransition();
  const { success: toastSuccess, error: toastError } = useToast();
  const offlineQueue = useOfflineQueue();

  const filterSequence = useRef(0);
  const pendingFilterRef = useRef<{
    key: string;
    metadata: Record<string, unknown>;
  } | null>(null);

  const beginFilterMeasurement = useCallback(
    (filterId: string, metadata: Record<string, unknown>) => {
      filterSequence.current += 1;
      const key = `${filterId}:${filterSequence.current}`;
      const enriched = { filterId, ...metadata } satisfies Record<string, unknown>;
      pendingFilterRef.current = { key, metadata: enriched };
      startFilterLatency(key, enriched);
    },
    []
  );

  useEffect(() => {
    if (!pendingFilterRef.current) {
      return;
    }
    const current = pendingFilterRef.current;
    markFilterLatency(current.key, { ...current.metadata, resultCount: filteredRows.length });
    pendingFilterRef.current = null;
  }, [filteredRows.length]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showLowConfidence, setShowLowConfidence] = useState(false);

  const performStatusUpdate = useCallback(
    async (ids: string[], status: string) => {
      const response = await fetch("/api/admin/payments/update-status", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          status,
          saccoId: saccoId ?? null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ?? t("recon.errors.statusUpdateFailed", "Failed to update status")
        );
      }
      return payload as { updated?: number };
    },
    [saccoId, t]
  );

  const performAssignUpdate = useCallback(
    async (ids: string[], ikiminaId: string, memberId?: string | null) => {
      const body: Record<string, unknown> = {
        ids,
        ikiminaId,
        saccoId: saccoId ?? null,
      };
      if (memberId !== undefined) {
        body.memberId = memberId;
      }
      const response = await fetch("/api/admin/payments/assign", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload.error ?? t("recon.errors.bulkAssignFailed", "Failed to assign group")
        );
      }
      return payload as { updated?: number };
    },
    [saccoId, t]
  );
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [reasonFilters, setReasonFilters] = useState<string[]>([]);

  const deferredSearch = useDeferredValue(searchTerm);
  const suggestionCache = useRef(
    new Map<
      string,
      {
        suggestion: {
          member_id: string;
          ikimina_id: string | null;
          confidence: number;
          reason: string;
          member_code?: string | null;
        } | null;
        alternatives: Array<{
          member_id: string;
          ikimina_id: string | null;
          confidence: number;
          reason: string;
          member_code?: string | null;
        }>;
      }
    >()
  );

  const duplicateTxnIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.txn_id) continue;
      counts.set(row.txn_id, (counts.get(row.txn_id) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([txnId]) => txnId)
    );
  }, [rows]);

  const deriveReasons = useCallback(
    (row: ReconciliationRow): ReasonChip[] => {
      const reasons: ReasonChip[] = [];

      if (!row.reference) {
        reasons.push(reasonRules.missingReference);
      }

      if (row.status === "UNALLOCATED") {
        reasons.push(reasonRules.unallocated);
      }

      if (duplicateTxnIds.has(row.txn_id)) {
        reasons.push(reasonRules.duplicate);
      }

      if (row.status === "PENDING") {
        reasons.push(reasonRules.pendingReview);
      }

      if (!row.source?.parsed_json) {
        reasons.push(reasonRules.parserFailure);
      }

      if (!row.msisdn || row.msisdn.includes("✱") || row.msisdn.includes("****")) {
        reasons.push(reasonRules.msisdnMismatch);
      }

      if ((row.confidence ?? 1) < CONFIDENCE_THRESHOLD) {
        reasons.push(reasonRules.lowConfidence);
      }

      return reasons;
    },
    [duplicateTxnIds]
  );

  const rowMap = useMemo(() => {
    const map = new Map<string, ReconciliationRow>();
    rows.forEach((row) => {
      map.set(row.id, row);
    });
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const reasonSet = new Set(reasonFilters);
    const query = deferredSearch.trim().toLowerCase();

    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) {
        return false;
      }

      if (showDuplicatesOnly && !duplicateTxnIds.has(row.txn_id)) {
        return false;
      }

      if (showLowConfidence && (row.confidence ?? 1) >= CONFIDENCE_THRESHOLD) {
        return false;
      }

      if (reasonSet.size > 0) {
        const reasons = deriveReasons(row);
        if (!reasons.some((reason) => reasonSet.has(reason.id))) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack =
        `${row.reference ?? ""} ${row.msisdn ?? ""} ${row.txn_id ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [
    rows,
    statusFilter,
    showDuplicatesOnly,
    showLowConfidence,
    reasonFilters,
    duplicateTxnIds,
    deriveReasons,
    deferredSearch,
  ]);

  const displayRows = useMemo(
    () => [...filteredRows].sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)),
    [filteredRows]
  );

  const _selectedReasons = useMemo(
    () => (selected ? deriveReasons(selected) : []),
    [selected, deriveReasons]
  );

  const allSelected = selectedIds.length > 0 && selectedIds.length === displayRows.length;

  const toggleSelect = (id: string) => {
    if (!canWrite) return;
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  const toggleSelectAll = () => {
    if (!canWrite) return;
    if (allSelected) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(displayRows.map((row) => row.id));
  };

  const handleBulkStatus = (status: Database["app"]["Tables"]["payments"]["Row"]["status"]) => {
    if (!canWrite || !selectedIds.length) return;

    if (!offlineQueue.isOnline) {
      const statusLabel = getStatusLabel(status);
      void offlineQueue.queueAction({
        type: "payments:update-status",
        payload: { ids: selectedIds, status, saccoId: saccoId ?? null },
        summary: {
          primary: `Sync ${selectedIds.length} → ${statusLabel.primary}`,
          secondary: `${selectedIds.length} ku ${statusLabel.secondary}`,
        },
      });
      setBulkMessage(t("recon.bulk.queuedOffline", "Queued for sync when you're back online."));
      setBulkError(null);
      setSelectedIds([]);
      return;
    }

    startTransition(async () => {
      setBulkMessage(null);
      setBulkError(null);
      try {
        await performStatusUpdate(selectedIds, status);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("recon.errors.statusUpdateFailed", "Failed to update status");
        setBulkError(message);
        toastError(message);
        return;
      }
      const statusLabel = getStatusLabel(status);
      const count = selectedIds.length;
      const messageEn = `Updated ${count} payment(s) to ${statusLabel.primary}. Refresh to verify.`;
      setBulkMessage(messageEn);
      toastSuccess(`Marked ${count} payment(s) as ${statusLabel.primary}`);
      trackTaskFunnel("recon.bulk_status.updated", {
        status,
        count,
        saccoId: saccoId ?? null,
      });
      setSelectedIds([]);
    });
  };

  const handleBulkAssign = () => {
    const trimmed = bulkIkiminaId.trim();
    if (!canWrite || !trimmed || !selectedIds.length) {
      return;
    }
    if (!offlineQueue.isOnline) {
      void offlineQueue.queueAction({
        type: "payments:assign",
        payload: { ids: selectedIds, ikiminaId: trimmed, saccoId: saccoId ?? null },
        summary: {
          primary: `Sync ${selectedIds.length} → ${trimmed}`,
          secondary: `${selectedIds.length} kuri ${trimmed}`,
        },
      });
      setBulkMessage(t("recon.bulk.queuedOnline", "Queued for sync when you're online."));
      setBulkError(null);
      setSelectedIds([]);
      setBulkIkiminaId("");
      return;
    }
    startTransition(async () => {
      setBulkMessage(null);
      setBulkError(null);
      try {
        await performAssignUpdate(selectedIds, trimmed, null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("recon.errors.bulkAssignFailed", "Failed to assign group");
        setBulkError(message);
        toastError(message);
        return;
      }
      const count = selectedIds.length;
      const assignedEn = `Assigned ${count} payment(s) to ikimina.`;
      setBulkMessage(assignedEn);
      toastSuccess(`Assigned ${count} payment(s).`);
      trackTaskFunnel("recon.bulk_assign.completed", {
        count,
        ikiminaId: trimmed,
        saccoId: saccoId ?? null,
      });
      setSelectedIds([]);
      setBulkIkiminaId("");
    });
  };

  const handleBulkAssignByReference = () => {
    if (!canWrite || selectedIds.length === 0) return;
    if (!offlineQueue.isOnline) {
      setBulkError(t("recon.errors.autoAssignOffline", "Auto assignment requires a connection."));
      return;
    }
    const references = selectedIds
      .map((id) => rowMap.get(id)?.reference ?? null)
      .filter((value): value is string => Boolean(value));
    if (references.length !== selectedIds.length) {
      setBulkError(
        t(
          "recon.errors.sameReferenceRequired",
          "All selected rows must share a reference to auto-assign."
        )
      );
      return;
    }
    const uniqueReferences = Array.from(new Set(references));
    if (uniqueReferences.length !== 1) {
      setBulkError(
        t("recon.errors.noSharedReference", "Selected rows do not share the same reference.")
      );
      return;
    }

    const sharedReference = uniqueReferences[0];
    const parts = sharedReference.split(".");
    if (parts.length < 3) {
      setBulkError(t("recon.errors.noIkiminaCode", "Reference does not include an ikimina code."));
      return;
    }

    const groupCode = parts[2];
    startTransition(async () => {
      setBulkMessage(null);
      setBulkError(null);
      try {
        let queryBuilder = supabase
          .from("ibimina")
          .select("id")
          .eq("code", groupCode)
          .eq("status", "ACTIVE");
        if (saccoId) {
          queryBuilder = queryBuilder.eq("sacco_id", saccoId);
        }
        const { data: group, error: groupError } = await queryBuilder.maybeSingle();
        type GroupRow = { id: string };
        const resolvedGroup = (group ?? null) as GroupRow | null;
        if (groupError || !resolvedGroup) {
          throw new Error(groupError?.message ?? "No matching ikimina found for reference");
        }

        await performAssignUpdate(selectedIds, resolvedGroup.id, null);

        const count = selectedIds.length;
        const assignedEn = `Assigned ${count} payment(s) to ${groupCode}.`;
        setBulkMessage(t("recon.bulk.assignedTo", assignedEn));
        toastSuccess(t("recon.bulk.assigned", `Assigned ${count} payment(s).`));
        setSelectedIds([]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to auto-assign";
        const local = t("recon.errors.autoAssignFailed", message);
        setBulkError(local);
        toastError(local);
      }
    });
  };

  const handleClose = () => {
    setSelected(null);
    setActionMessage(null);
    setActionError(null);
    setNewStatus("POSTED");
  };

  const _handleUpdateStatus = () => {
    if (!selected || !canWrite) return;
    if (!offlineQueue.isOnline) {
      const statusLabel = getStatusLabel(newStatus);
      void offlineQueue.queueAction({
        type: "payments:update-status",
        payload: { ids: [selected.id], status: newStatus, saccoId: saccoId ?? null },
        summary: {
          primary: `Sync → ${statusLabel.primary}`,
          secondary: `Bizahuzwa kuri ${statusLabel.secondary}`,
        },
      });
      setActionError(null);
      setActionMessage(t("recon.action.queuedOffline", "Queued for sync when you're back online."));
      return;
    }
    startTransition(async () => {
      setActionMessage(null);
      setActionError(null);
      try {
        await performStatusUpdate([selected.id], newStatus);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("recon.errors.statusUpdateFailed", "Failed to update status");
        setActionError(message);
        return;
      }
      const statusLabel = getStatusLabel(newStatus);
      setActionMessage(
        t("recon.action.statusUpdated", "Status updated. Refresh the page to see latest data.")
      );
      toastSuccess(`Status updated to ${statusLabel.primary}`);
    });
  };

  const handleAssignToIkimina = async (ikiminaId: string, memberId: string | null = null) => {
    if (!selected || !canWrite) return;
    if (!offlineQueue.isOnline) {
      void offlineQueue.queueAction({
        type: "payments:assign",
        payload: { ids: [selected.id], ikiminaId, memberId, saccoId: saccoId ?? null },
        summary: {
          primary: `Sync assignment → ${ikiminaId}`,
          secondary: `Byashyizwe kuri ${ikiminaId}`,
        },
      });
      setActionError(null);
      setActionMessage(t("recon.action.queuedOffline", "Queued for sync when you're back online."));
      return;
    }
    startTransition(async () => {
      setActionMessage(null);
      setActionError(null);
      try {
        await performAssignUpdate([selected.id], ikiminaId, memberId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("recon.errors.assignFailed", "Failed to assign");
        setActionError(message);
        return;
      }
      setActionMessage(t("recon.action.assigned", "Assigned to ikimina. Refresh to verify."));
      toastSuccess(t("recon.action.paymentUpdated", "Payment updated"));
    });
  };

  const _handleLinkMember = (member: MemberResult) => {
    if (!canWrite) return;
    handleAssignToIkimina(member.ikimina_id, member.id);
    setMemberQuery("");
    setMemberResults([]);
  };

  const _applyAiSuggestion = (suggestion: {
    member_id: string;
    ikimina_id: string | null;
    confidence: number;
    reason: string;
    member_code?: string | null;
  }) => {
    if (!selected) return;
    const targetIkiminaId = suggestion.ikimina_id ?? selected.ikimina_id;
    if (!targetIkiminaId) {
      const msg = t(
        "recon.ai.missingIkimina",
        "Suggestion missing ikimina. Assign a group manually."
      );
      setActionError(msg);
      toastError(msg);
      return;
    }
    if (!canWrite) {
      toastError(t("recon.ai.upgradeRequired", "Upgrade access to apply AI suggestions."));
      return;
    }
    handleAssignToIkimina(targetIkiminaId, suggestion.member_id);
  };

  const _refreshAiSuggestion = () => {
    if (!selected) return;
    suggestionCache.current.delete(selected.id);
    setAiStatus("idle");
    setAiError(null);
    setAiRefreshToken((token) => token + 1);
  };

  useEffect(() => {
    if (selected && !rowMap.has(selected.id)) {
      setSelected(null);
    }
  }, [rowMap, selected]);

  useEffect(() => {
    setMemberResults([]);
    setMemberLoading(false);

    if (!selected) {
      setMemberQuery("");
      return;
    }

    const cleanMsisdn =
      selected.msisdn && !selected.msisdn.includes("✱")
        ? selected.msisdn.replace(/[^0-9+]/g, "")
        : "";
    if (cleanMsisdn && cleanMsisdn.length >= 6) {
      setMemberQuery(cleanMsisdn);
      return;
    }

    const memberCode = selected.reference?.split(".")[3];
    setMemberQuery(memberCode ?? "");
  }, [selected, aiRefreshToken]);

  useEffect(() => {
    const term = memberQuery.trim();
    if (!canWrite) {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }

    if (!selected || term.length < 2) {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }

    let cancelled = false;
    setMemberLoading(true);
    const timeout = window.setTimeout(async () => {
      const sanitized = term.replace(/%/g, "");
      let query = supabase
        .from("ikimina_members_public")
        .select("id, full_name, member_code, msisdn, ikimina_id, ikimina_name, sacco_id")
        .order("full_name", { ascending: true })
        .limit(8);

      if (selected.ikimina_id) {
        query = query.eq("ikimina_id", selected.ikimina_id);
      } else if (saccoId) {
        query = query.eq("sacco_id", saccoId);
      }

      const like = `%${sanitized}%`;
      query = query.or(`full_name.ilike.${like},msisdn.ilike.${like},member_code.ilike.${like}`);

      const { data, error } = await query;

      if (cancelled) {
        return;
      }

      if (error) {
        const message = error.message ?? t("recon.search.memberFailed", "Member search failed");
        toastError(message);
        setMemberResults([]);
      } else {
        type RawMember = {
          id: string;
          full_name: string;
          member_code: string | null;
          msisdn: string | null;
          ikimina_id: string;
          ikimina_name: string | null;
        };
        setMemberResults(
          (data as RawMember[] | null | undefined)?.map((member) => ({
            id: member.id,
            full_name: member.full_name,
            member_code: member.member_code,
            msisdn: member.msisdn,
            ikimina_id: member.ikimina_id,
            ikimina_name: member.ikimina_name ?? null,
          })) ?? []
        );
      }

      setMemberLoading(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [memberQuery, selected, saccoId, toastError, canWrite, t]);

  useEffect(() => {
    if (!selected) {
      setAiSuggestion(null);
      setAiAlternatives([]);
      setAiStatus("idle");
      setAiError(null);
      return;
    }

    const cached = suggestionCache.current.get(selected.id);
    if (cached) {
      setAiSuggestion(cached.suggestion ?? null);
      setAiAlternatives(cached.alternatives ?? []);
      setAiStatus("ready");
      setAiError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setAiStatus("loading");
    setAiError(null);

    (async () => {
      try {
        const response = await fetch("/api/reconciliation/suggest", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ paymentId: selected.id }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? `Suggestion request failed (${response.status})`);
        }

        const payload = (await response.json()) as {
          suggestion: {
            member_id: string;
            ikimina_id: string | null;
            confidence: number;
            reason: string;
            member_code?: string | null;
          } | null;
          alternatives: Array<{
            member_id: string;
            ikimina_id: string | null;
            confidence: number;
            reason: string;
            member_code?: string | null;
          }>;
        };

        if (cancelled) return;
        suggestionCache.current.set(selected.id, {
          suggestion: payload.suggestion ?? null,
          alternatives: payload.alternatives ?? [],
        });
        setAiSuggestion(payload.suggestion ?? null);
        setAiAlternatives(payload.alternatives ?? []);
        setAiStatus("ready");
      } catch (err) {
        if (cancelled) return;
        logError("recon.ai_suggestion_failed", { error: err });
        const msg = err instanceof Error ? err.message : "Suggestion lookup failed";
        setAiError(t("recon.errors.suggestionFailed", msg));
        setAiStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [selected, t]);

  const sharedReference = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const references = selectedIds
      .map((id) => rowMap.get(id)?.reference ?? null)
      .filter((value): value is string => Boolean(value));
    if (references.length !== selectedIds.length) return null;
    const unique = new Set(references);
    return unique.size === 1 ? references[0] : null;
  }, [selectedIds, rowMap]);

  const _recommendedQueries = useMemo(() => {
    if (!selected) return [] as Array<{ value: string; primary: string; secondary: string }>;
    const suggestions = new Map<string, { primary: string; secondary: string }>();

    const msisdn = selected.msisdn?.replace(/[^0-9+]/g, "");
    if (msisdn && !selected.msisdn?.includes("✱") && msisdn.length >= 6) {
      suggestions.set(msisdn, {
        primary: `Use MSISDN ${msisdn}`,
        secondary: `Koresha numero ${msisdn}`,
      });
    }

    const referenceParts = selected.reference?.split(".") ?? [];
    if (referenceParts.length >= 4) {
      const memberCode = referenceParts[3];
      if (memberCode) {
        suggestions.set(memberCode, {
          primary: `Member code ${memberCode}`,
          secondary: `Kode y'umunyamuryango ${memberCode}`,
        });
      }
    }

    if (selected.txn_id) {
      const shortTxn = selected.txn_id.slice(-8);
      suggestions.set(shortTxn, {
        primary: `Search txn ${shortTxn}`,
        secondary: `Shakisha ubwishyu ${shortTxn}`,
      });
    }

    return Array.from(suggestions.entries()).map(([value, label]) => ({ value, ...label }));
  }, [selected]);

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="w-full sm:w-64">
          <Input
            label={t("common.search", "Search")}
            placeholder={t("recon.search.placeholder", "Reference, MSISDN, txn id")}
            value={searchTerm}
            onChange={(event) => {
              const value = event.target.value;
              beginFilterMeasurement("recon.search", { queryLength: value.length });
              setSearchTerm(value);
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-2">
          <label htmlFor="status-filter" className="items-center gap-1">
            {t("table.status", "Status")}
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => {
              const next = event.target.value;
              beginFilterMeasurement("recon.status", { status: next });
              setStatusFilter(next);
            }}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          >
            <option value="ALL">{t("common.all", "All")}</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            const next = !showDuplicatesOnly;
            beginFilterMeasurement("recon.duplicates", { enabled: next });
            setShowDuplicatesOnly(next);
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]",
            showDuplicatesOnly ? "bg-white/15 text-neutral-0" : "bg-white/5 text-neutral-2"
          )}
        >
          {t("recon.filters.duplicatesOnly", "Duplicates only")}
        </button>
        <button
          type="button"
          onClick={() => {
            const next = !showLowConfidence;
            beginFilterMeasurement("recon.lowConfidence", { enabled: next });
            setShowLowConfidence(next);
          }}
          className={cn(
            "rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]",
            showLowConfidence ? "bg-white/15 text-neutral-0" : "bg-white/5 text-neutral-2"
          )}
        >
          {t("recon.filters.lowConfidence", "Low confidence")}
        </button>
        <div className="flex flex-wrap gap-2">
          {reasonEntries.map((reason) => {
            const isActive = reasonFilters.includes(reason.id);
            return (
              <button
                key={reason.id}
                type="button"
                onClick={() => {
                  setReasonFilters((current) => {
                    const next = current.includes(reason.id)
                      ? current.filter((item) => item !== reason.id)
                      : [...current, reason.id];
                    beginFilterMeasurement("recon.reason", {
                      reason: reason.id,
                      activeCount: next.length,
                    });
                    return next;
                  });
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-xs uppercase tracking-[0.3em]",
                  isActive ? "bg-white/15 text-neutral-0" : "bg-white/5 text-neutral-2"
                )}
              >
                <span className="items-center gap-2">{reason.label.primary}</span>
              </button>
            );
          })}
        </div>
      </div>

      {canWrite && selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-xs text-neutral-0">
          <span>{`${selectedIds.length} ${t("recon.bulk.selectedSuffix", "selected")}`}</span>
          <button
            type="button"
            onClick={() => handleBulkStatus("POSTED")}
            disabled={pending || !canWrite}
            className="interactive-scale rounded-full bg-kigali px-3 py-1 text-ink shadow-glass disabled:opacity-60"
          >
            {t("recon.actions.markPosted", "Mark posted")}
          </button>
          <button
            type="button"
            onClick={() => handleBulkStatus("REJECTED")}
            disabled={pending || !canWrite}
            className="interactive-scale rounded-full border border-white/15 px-3 py-1 text-neutral-0 disabled:opacity-60"
          >
            {t("recon.actions.reject", "Reject")}
          </button>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t("recon.bulk.ikiminaPlaceholder", "Ikimina UUID")}
              value={bulkIkiminaId}
              onChange={(event) => setBulkIkiminaId(event.target.value)}
              className="w-40 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-neutral-0 placeholder:text-neutral-3 focus:outline-none focus:ring-2 focus:ring-rw-blue"
              disabled={pending || !canWrite}
            />
            <button
              type="button"
              onClick={handleBulkAssign}
              disabled={pending || !bulkIkiminaId.trim() || !canWrite}
              className="interactive-scale rounded-full bg-white/15 px-3 py-1 text-neutral-0 disabled:opacity-60"
            >
              {t("recon.actions.assignGroup", "Assign group")}
            </button>
          </div>
          {sharedReference && (
            <button
              type="button"
              onClick={handleBulkAssignByReference}
              disabled={pending}
              className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-[0.3em] text-neutral-0"
            >
              {t("recon.actions.assignViaReference", "Assign via reference")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={!canWrite}
            className="text-neutral-2 hover:text-neutral-0 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("common.clear", "Clear")}
          </button>
          {bulkMessage && <span className="text-[11px] text-emerald-200">{bulkMessage}</span>}
          {bulkError && <span className="text-[11px] text-amber-200">{bulkError}</span>}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-white/5 text-left text-xs uppercase tracking-[0.2em] text-neutral-2">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  aria-label={t("common.selectAll", "Select all")}
                  onChange={toggleSelectAll}
                  disabled={!canWrite}
                  className="h-4 w-4 rounded border-white/30 bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                />
              </th>
              <th className="px-4 py-3">{t("table.occurred", "Occurred")}</th>
              <th className="px-4 py-3">{t("table.amount", "Amount")}</th>
              <th className="px-4 py-3">{t("table.reference", "Reference")}</th>
              <th className="px-4 py-3">{t("table.msisdn", "MSISDN")}</th>
              <th className="px-4 py-3">{t("table.reasons", "Reasons")}</th>
              <th className="px-4 py-3">{t("table.status", "Status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-neutral-2">
                  {t("recon.empty", "No exceptions match your filters.")}
                </td>
              </tr>
            )}
            {displayRows.map((row) => {
              const isRowSelected = selectedIds.includes(row.id);
              const reasons = deriveReasons(row);
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "cursor-pointer transition hover:bg-white/5",
                    isRowSelected ? "bg-white/10" : undefined
                  )}
                  onClick={() => setSelected(row)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      aria-label={t("recon.selectException", "Select exception")}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleSelect(row.id)}
                      disabled={!canWrite}
                      className="h-4 w-4 rounded border-white/30 bg-transparent disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </td>
                  <td className="px-4 py-3 text-neutral-2">
                    {new Date(row.occurred_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {new Intl.NumberFormat("en-RW", {
                      style: "currency",
                      currency: row.currency ?? "RWF",
                      maximumFractionDigits: 0,
                    }).format(row.amount)}
                  </td>
                  <td className="px-4 py-3 text-neutral-2">{row.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-neutral-2">{row.msisdn ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {reasons.length === 0 && (
                        <span className="text-[11px] text-neutral-2">—</span>
                      )}
                      {reasons.map((reason) => {
                        const guidance = reasonGuidance[reason.id];
                        const key = REASON_GUIDANCE_KEYS[reason.id];
                        const title = key ? t(key, guidance?.primary ?? "") : guidance?.primary;
                        return (
                          <span
                            key={reason.id}
                            className={cn(
                              "rounded-full px-2 py-1 text-[11px] uppercase tracking-[0.2em]",
                              reason.tone === "critical" && "bg-red-500/20 text-red-200",
                              reason.tone === "warning" && "bg-amber-500/20 text-amber-200",
                              reason.tone === "info" && "bg-white/10 text-neutral-0"
                            )}
                            title={title}
                          >
                            <span className="items-center gap-1">{reason.label.primary}</span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const label = getStatusLabel(row.status);
                      return (
                        <StatusChip
                          tone={
                            row.status === "UNALLOCATED"
                              ? "critical"
                              : row.status === "POSTED" || row.status === "SETTLED"
                                ? "success"
                                : "warning"
                          }
                        >
                          <span>{label.primary.toUpperCase()}</span>
                        </StatusChip>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Drawer
        open={Boolean(selected)}
        onClose={handleClose}
        size="md"
        title={t("recon.detail.title", "Transaction Details")}
      >
        {selected && (
          <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">
            <div className="space-y-3 text-sm text-neutral-0">
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("table.occurred", "Occurred")}
                </dt>
                <dd>{new Date(selected.occurred_at).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("table.amount", "Amount")}
                </dt>
                <dd>
                  {new Intl.NumberFormat("en-RW", {
                    style: "currency",
                    currency: selected.currency ?? "RWF",
                    maximumFractionDigits: 0,
                  }).format(selected.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("table.reference", "Reference")}
                </dt>
                <dd>{selected.reference ?? "—"}</dd>
              </div>
            </div>

            <div className="space-y-4 text-sm text-neutral-0">
              <div>
                <h4 className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("recon.detail.member", "Member")}
                </h4>
                <p className="mt-1">
                  {selected.member_name ?? t("recon.detail.noMember", "Not linked")}
                </p>
              </div>
              <div>
                <h4 className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                  {t("recon.detail.ikimina", "Ikimina")}
                </h4>
                <p className="mt-1">
                  {selected.ikimina_name ?? t("recon.detail.noIkimina", "Not linked")}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-2">
              <h4 className="text-xs uppercase tracking-[0.3em] text-neutral-2">
                {t("recon.detail.rawSms", "Raw SMS")}
              </h4>
              <p className="mt-2 whitespace-pre-wrap text-neutral-0">
                {selected.source?.raw_text ?? t("recon.detail.noSms", "No SMS captured")}
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
