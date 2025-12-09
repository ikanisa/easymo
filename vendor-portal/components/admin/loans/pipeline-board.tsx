"use client";

import { useEffect, useMemo, useState } from "react";
import { KanbanSquare, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/common/status-chip";
import { useToast } from "@/providers/toast-provider";
import { useAtlasAssistant } from "@/providers/atlas-assistant-provider";

const STAGES = [
  {
    key: "DRAFT",
    label: "Draft",
    description: "Applicants preparing documents",
    tone: "neutral" as const,
  },
  {
    key: "SUBMITTED",
    label: "Submitted",
    description: "Waiting for SACCO intake",
    tone: "info" as const,
  },
  { key: "RECEIVED", label: "Received", description: "Intake acknowledged", tone: "info" as const },
  {
    key: "UNDER_REVIEW",
    label: "Under review",
    description: "Credit analysis in progress",
    tone: "info" as const,
  },
  {
    key: "APPROVED",
    label: "Approved",
    description: "Ready for disbursement",
    tone: "success" as const,
  },
  {
    key: "DISBURSED",
    label: "Disbursed",
    description: "Funded applications",
    tone: "success" as const,
  },
  {
    key: "DECLINED",
    label: "Declined",
    description: "Rejected applications",
    tone: "warning" as const,
  },
  {
    key: "CANCELLED",
    label: "Cancelled",
    description: "Withdrawn or expired",
    tone: "neutral" as const,
  },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

type DpdFilter = "all" | "0-14" | "15-30" | "30+";

const DPD_FILTERS: Array<{ id: DpdFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "0-14", label: "0-14 DPD" },
  { id: "15-30", label: "15-30 DPD" },
  { id: "30+", label: "30+ DPD" },
];

interface PipelineLoanRow {
  id: string;
  status: StageKey | string;
  amount: number;
  tenorMonths: number | null;
  applicantName: string;
  applicantPhone: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  partnerReference: string | null;
  productName: string | null;
  partnerName: string | null;
  dpd: number;
  dpdFilter: DpdFilter;
}

interface LoansPipelineBoardProps {
  loans: Array<{
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
  }>;
}

const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function LoansPipelineBoard({ loans }: LoansPipelineBoardProps) {
  const normalized = useMemo<PipelineLoanRow[]>(() => loans.map(normalizeLoan), [loans]);
  const [view, setView] = useState<"board" | "table">("board");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<StageKey[]>([]);
  const [productFilter, setProductFilter] = useState<string[]>([]);
  const [dpdFilter, setDpdFilter] = useState<DpdFilter>("all");
  const { success } = useToast();
  const { setContext } = useAtlasAssistant();

  const products = useMemo(() => {
    const counts = new Map<string, number>();
    for (const loan of normalized) {
      if (!loan.productName) continue;
      counts.set(loan.productName, (counts.get(loan.productName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
  }, [normalized]);

  const dpdCounts = useMemo(() => {
    const counts: Record<DpdFilter, number> = {
      all: normalized.length,
      "0-14": 0,
      "15-30": 0,
      "30+": 0,
    };
    for (const loan of normalized) {
      if (loan.dpdFilter !== "all") {
        counts[loan.dpdFilter] += 1;
      }
    }
    return counts;
  }, [normalized]);

  const filtered = useMemo(() => {
    return normalized.filter((loan) => {
      if (stageFilter.length > 0 && !stageFilter.includes(loan.status as StageKey)) {
        return false;
      }
      if (
        productFilter.length > 0 &&
        loan.productName &&
        !productFilter.includes(loan.productName)
      ) {
        return false;
      }
      if (dpdFilter !== "all" && loan.dpdFilter !== dpdFilter) {
        return false;
      }
      return true;
    });
  }, [normalized, stageFilter, productFilter, dpdFilter]);

  const buckets = useMemo(() => {
    const bucketMap = new Map<StageKey, PipelineLoanRow[]>();
    for (const { key } of STAGES) {
      bucketMap.set(key, []);
    }
    for (const loan of filtered) {
      const key = loan.status as StageKey;
      if (!bucketMap.has(key)) {
        bucketMap.set(key, []);
      }
      bucketMap.get(key)!.push(loan);
    }
    for (const [, value] of bucketMap) {
      value.sort((a, b) => {
        const first = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const second = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return second - first;
      });
    }
    return bucketMap;
  }, [filtered]);

  useEffect(() => {
    const activeStages = stageFilter.length === 0 ? "All" : `${stageFilter.length} selected`;
    const activeProducts = productFilter.length === 0 ? "All" : `${productFilter.length} selected`;
    setContext({
      title: "Loans pipeline",
      subtitle: `${filtered.length} of ${normalized.length} applications visible`,
      metadata: {
        View: view === "board" ? "Kanban" : "Table",
        Stages: activeStages,
        Products: activeProducts,
        "DPD filter": dpdFilter === "all" ? "All" : dpdFilter,
      },
    });
  }, [filtered.length, normalized.length, view, stageFilter, productFilter, dpdFilter, setContext]);

  useEffect(() => () => setContext(null), [setContext]);

  const toggleSelection = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleStage = (stage: StageKey) => {
    setStageFilter((current) =>
      current.includes(stage) ? current.filter((value) => value !== stage) : [...current, stage]
    );
  };

  const toggleProduct = (product: string) => {
    setProductFilter((current) =>
      current.includes(product)
        ? current.filter((value) => value !== product)
        : [...current, product]
    );
  };

  const clearFilters = () => {
    setStageFilter([]);
    setProductFilter([]);
    setDpdFilter("all");
  };

  const applyBulkAction = (label: string) => {
    success(`${label} scheduled for ${selected.size} application${selected.size === 1 ? "" : "s"}`);
    setSelected(new Set());
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView("board")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                view === "board"
                  ? "bg-atlas-blue text-white shadow-atlas"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              <KanbanSquare className="h-4 w-4" /> Board
            </button>
            <button
              type="button"
              onClick={() => setView("table")}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
                view === "table"
                  ? "bg-atlas-blue text-white shadow-atlas"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              <List className="h-4 w-4" /> Table
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
            <span>
              {filtered.length} visible · {selected.size} selected
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/70 hover:bg-white/10"
            >
              Clear filters
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <FilterGroup
            title="Stages"
            chips={STAGES.map((stage) => ({
              id: stage.key,
              label: `${stage.label} (${buckets.get(stage.key)?.length ?? 0})`,
              active: stageFilter.includes(stage.key),
              tone: stage.tone,
            }))}
            onToggle={(id) => toggleStage(id as StageKey)}
          />
          {products.length > 0 && (
            <FilterGroup
              title="Products"
              chips={products.slice(0, 8).map((product) => ({
                id: product,
                label: product,
                active: productFilter.includes(product),
                tone: "neutral" as const,
              }))}
              onToggle={(id) => toggleProduct(id)}
            />
          )}
          <FilterGroup
            title="DPD"
            chips={DPD_FILTERS.map((range) => ({
              id: range.id,
              label: `${range.label}${range.id === "all" ? `` : ` (${dpdCounts[range.id] ?? 0})`}`,
              active: dpdFilter === range.id,
              tone: range.id === "30+" ? "warning" : range.id === "15-30" ? "info" : "neutral",
            }))}
            onToggle={(id) => setDpdFilter(id as DpdFilter)}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="rounded-3xl border border-atlas-blue/40 bg-atlas-blue/20 p-4 text-sm text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {selected.size} application{selected.size === 1 ? "" : "s"} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <BulkActionButton
                label="Assign reviewer"
                onClick={() => applyBulkAction("Reviewer assignment")}
              >
                Assign reviewer
              </BulkActionButton>
              <BulkActionButton
                label="Advance stage"
                onClick={() => applyBulkAction("Stage update")}
              >
                Advance stage
              </BulkActionButton>
              <BulkActionButton
                label="Send reminder"
                onClick={() => applyBulkAction("Reminder dispatch")}
              >
                Send reminder
              </BulkActionButton>
            </div>
          </div>
        </div>
      )}

      {view === "board" ? (
        <BoardView buckets={buckets} selected={selected} onToggle={toggleSelection} />
      ) : (
        <TableView loans={filtered} selected={selected} onToggle={toggleSelection} />
      )}
    </div>
  );
}

function FilterGroup({
  title,
  chips,
  onToggle,
}: {
  title: string;
  chips: Array<{
    id: string;
    label: string;
    active: boolean;
    tone: "info" | "success" | "warning" | "neutral";
  }>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.3em] text-white/50">{title}</span>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => onToggle(chip.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
              chip.active
                ? chip.tone === "success"
                  ? "bg-emerald-500/25 text-emerald-100"
                  : chip.tone === "warning"
                    ? "bg-amber-500/25 text-amber-100"
                    : chip.tone === "info"
                      ? "bg-sky-500/25 text-sky-100"
                      : "bg-atlas-blue text-white"
                : "bg-white/10 text-white/60 hover:bg-white/20"
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function BoardView({
  buckets,
  selected,
  onToggle,
}: {
  buckets: Map<StageKey, PipelineLoanRow[]>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {STAGES.map((stage) => {
        const items = buckets.get(stage.key) ?? [];
        return (
          <section key={stage.key} className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                <p className="text-xs text-white/50">{stage.description}</p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                {items.length}
              </span>
            </header>
            <div className="mt-3 space-y-3">
              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-center text-xs text-white/50">
                  No applications in this stage.
                </div>
              ) : (
                items.map((loan) => (
                  <article
                    key={loan.id}
                    className="rounded-2xl border border-white/10 bg-white/8 p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{loan.applicantName}</p>
                        <p className="text-xs text-white/60">
                          {loan.productName ?? "Unassigned product"}
                        </p>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-white/60">
                        <input
                          type="checkbox"
                          checked={selected.has(loan.id)}
                          onChange={() => onToggle(loan.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10"
                        />
                        Select
                      </label>
                    </div>
                    <dl className="mt-2 grid gap-2 text-xs text-white/70">
                      <div className="flex justify-between">
                        <dt>Amount</dt>
                        <dd>{currencyFormatter.format(loan.amount)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Tenor</dt>
                        <dd>{loan.tenorMonths ? `${loan.tenorMonths} months` : "—"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>DPD</dt>
                        <dd>{loan.dpd} days</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt>Updated</dt>
                        <dd>{loan.updatedAt ? relativeDate(loan.updatedAt) : "—"}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/70">
                      {loan.partnerReference && (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          Ref: {loan.partnerReference}
                        </span>
                      )}
                      {loan.applicantPhone && (
                        <span className="rounded-full bg-white/10 px-2 py-1">
                          {loan.applicantPhone}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TableView({
  loans,
  selected,
  onToggle,
}: {
  loans: PipelineLoanRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-3xl border border-white/10">
      <table className="min-w-full divide-y divide-white/10 text-sm text-white/80">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.3em] text-white/50">
          <tr>
            <th scope="col" className="px-3 py-3 text-left">
              Select
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Applicant
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Product
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Amount
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Tenor
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Stage
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              Updated
            </th>
            <th scope="col" className="px-3 py-3 text-left">
              DPD
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {loans.map((loan) => (
            <tr key={loan.id} className="bg-white/[0.03]">
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={selected.has(loan.id)}
                  onChange={() => onToggle(loan.id)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col">
                  <span className="font-semibold text-white">{loan.applicantName}</span>
                  <span className="text-xs text-white/50">{loan.applicantPhone ?? "—"}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <span>{loan.productName ?? "—"}</span>
              </td>
              <td className="px-3 py-2">{currencyFormatter.format(loan.amount)}</td>
              <td className="px-3 py-2">{loan.tenorMonths ? `${loan.tenorMonths} m` : "—"}</td>
              <td className="px-3 py-2">
                <StatusChip tone={resolveTone(loan.status as StageKey)}>{loan.status}</StatusChip>
              </td>
              <td className="px-3 py-2">{loan.updatedAt ? relativeDate(loan.updatedAt) : "—"}</td>
              <td className="px-3 py-2">{loan.dpd} days</td>
            </tr>
          ))}
        </tbody>
      </table>
      {loans.length === 0 && (
        <div className="p-6 text-center text-sm text-white/60">
          No applications match the selected filters.
        </div>
      )}
    </div>
  );
}

function BulkActionButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/25"
    >
      {children}
    </button>
  );
}

function normalizeLoan(row: LoansPipelineBoardProps["loans"][number]): PipelineLoanRow {
  const amount =
    typeof row.requested_amount === "string"
      ? Number(row.requested_amount)
      : (row.requested_amount ?? 0);
  const updatedAt = row.status_updated_at ?? row.created_at ?? null;
  const dpd = updatedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  return {
    id: row.id,
    status: (row.status as StageKey) ?? "SUBMITTED",
    amount,
    tenorMonths: row.tenor_months,
    applicantName: row.applicant_name ?? "Unknown applicant",
    applicantPhone: row.applicant_phone,
    createdAt: row.created_at,
    updatedAt,
    partnerReference: row.partner_reference,
    productName: row.product?.name ?? null,
    partnerName: row.product?.partner_name ?? null,
    dpd,
    dpdFilter: resolveDpd(dpd),
  };
}

function resolveDpd(dpd: number): DpdFilter {
  if (dpd <= 14) return "0-14";
  if (dpd <= 30) return "15-30";
  return "30+";
}

function resolveTone(stage: StageKey): "neutral" | "info" | "warning" | "success" {
  const meta = STAGES.find((item) => item.key === stage);
  return meta?.tone ?? "neutral";
}

function relativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return dateFormatter.format(date);
}
