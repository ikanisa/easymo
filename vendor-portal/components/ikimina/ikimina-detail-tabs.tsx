"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { VirtualTable } from "@/components/datagrid/virtual-table";
import { EmptyState } from "@/components/ui/empty-state";
import type { Database } from "@/lib/supabase/types";
import { StatusChip } from "@/components/common/status-chip";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/providers/i18n-provider";
import { IkiminaSettingsEditor } from "@/components/ikimina/ikimina-settings-editor";
import { SegmentedControl } from "@/components/ui/segmented-control";

const MEMBER_TABS = ["Overview", "Members", "Deposits", "Statements", "Settings"] as const;

type TabKey = (typeof MEMBER_TABS)[number];

type MemberRow = Pick<
  Database["public"]["Views"]["ikimina_members_public"]["Row"],
  "id" | "ikimina_id" | "full_name" | "member_code" | "msisdn" | "status" | "joined_at"
>;
type PaymentRow = Database["app"]["Tables"]["payments"]["Row"];

type StatementSummary = {
  label: string;
  postedTotal: number;
  unallocatedTotal: number;
  transactionCount: number;
};

interface IkiminaDetailTabsProps {
  detail: {
    id: string;
    name: string;
    code: string;
    status: string;
    type: string;
    saccoName?: string | null;
    saccoDistrict?: string | null;
    settings: Record<string, unknown> | null;
    membersCount: number;
    recentTotal: number;
    analytics: {
      monthTotal: number;
      onTimeRate: number;
      unallocatedCount: number;
      lastDepositAt: string | null;
      activeMembers: number;
      totalMembers: number;
    };
    saccoId: string | null;
  };
  members: MemberRow[];
  payments: PaymentRow[];
  statements: StatementSummary[];
  history?: Array<{
    id: string;
    action: string;
    actorLabel: string;
    createdAt: string;
    diff: Record<string, unknown> | null;
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

const relativeDate = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const paymentStatuses = ["ALL", "POSTED", "SETTLED", "UNALLOCATED", "PENDING"] as const;

type PaymentFilter = (typeof paymentStatuses)[number];

const TAB_KEYS: Record<TabKey, string> = {
  Overview: "ikimina.tabs.overview",
  Members: "ikimina.tabs.members",
  Deposits: "ikimina.tabs.deposits",
  Statements: "ikimina.tabs.statements",
  Settings: "ikimina.tabs.settings",
};

const PAYMENT_STATUS_LABELS: Record<PaymentFilter, { primary: string; secondary: string }> = {
  ALL: { primary: "All", secondary: "Byose" },
  POSTED: { primary: "Posted", secondary: "Byemejwe" },
  SETTLED: { primary: "Settled", secondary: "Byarangije" },
  UNALLOCATED: { primary: "Unallocated", secondary: "Bitaragabanywa" },
  PENDING: { primary: "Pending", secondary: "Birategereje" },
};

export function IkiminaDetailTabs({
  detail,
  members,
  payments,
  statements,
  history,
}: IkiminaDetailTabsProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>("Overview");
  const [memberSearch, setMemberSearch] = useState("");
  const [depositFilter, setDepositFilter] = useState<PaymentFilter>("ALL");

  const deferredMemberSearch = useDeferredValue(memberSearch);

  const membersSignature = useMemo(() => {
    if (members.length === 0) {
      return "empty";
    }
    const first = members[0]?.id ?? members[0]?.member_code ?? members[0]?.msisdn ?? "none";
    const lastMember = members[members.length - 1];
    const last = lastMember?.id ?? lastMember?.member_code ?? lastMember?.msisdn ?? "none";
    return `${first}:${members.length}:${last}`;
  }, [members]);

  const paymentsSignature = useMemo(() => {
    if (payments.length === 0) {
      return "empty";
    }
    const first =
      payments[0]?.id ?? (payments[0] as { reference?: string | null }).reference ?? "none";
    const lastPayment = payments[payments.length - 1];
    const last =
      lastPayment?.id ?? (lastPayment as { reference?: string | null }).reference ?? "none";
    return `${first}:${payments.length}:${last}`;
  }, [payments]);

  const statementsSignature = useMemo(() => {
    if (statements.length === 0) {
      return "empty";
    }
    const first = statements[0]?.label ?? "none";
    const last = statements[statements.length - 1]?.label ?? "none";
    return `${first}:${statements.length}:${last}`;
  }, [statements]);

  const memberTableRequestToken = useMemo(
    () => [membersSignature, deferredMemberSearch.trim().toLowerCase() || "all"].join("|"),
    [deferredMemberSearch, membersSignature]
  );

  const depositTableRequestToken = useMemo(
    () => [paymentsSignature, depositFilter].join("|"),
    [depositFilter, paymentsSignature]
  );

  const statementsRequestToken = useMemo(() => statementsSignature, [statementsSignature]);

  const memberColumns = useMemo<ColumnDef<MemberRow, unknown>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.name", "Name")}
          </span>
        ),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-neutral-0">{row.original.full_name}</p>
            <p className="text-xs text-neutral-2">
              {t("reports.table.code", "Code")} · {row.original.member_code ?? "—"}
            </p>
          </div>
        ),
        meta: { template: "minmax(220px, 2fr)" },
      },
      {
        accessorKey: "msisdn",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("ikimina.members.msisdn", "MSISDN")}
          </span>
        ),
        meta: { template: "minmax(180px, 1fr)" },
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.status", "Status")}
          </span>
        ),
        cell: ({ getValue }) => <StatusChip tone="neutral">{getValue() as string}</StatusChip>,
        meta: { template: "minmax(140px, 0.8fr)" },
      },
      {
        accessorKey: "joined_at",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("ikimina.members.joined", "Joined")}
          </span>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          return value ? new Date(value).toLocaleDateString() : "—";
        },
        meta: { template: "minmax(140px, 0.9fr)" },
      },
    ],
    [t]
  );

  const paymentColumns = useMemo<ColumnDef<PaymentRow, unknown>[]>(
    () => [
      {
        accessorKey: "occurred_at",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("payments.occurred", "Occurred")}
          </span>
        ),
        cell: ({ getValue }) => dateFormatter.format(new Date(getValue() as string)),
        meta: { template: "minmax(180px, 1.2fr)" },
      },
      {
        accessorKey: "amount",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.table.amount", "Amount")}
          </span>
        ),
        cell: ({ row }) => currencyFormatter.format(row.original.amount),
        meta: { align: "right", template: "minmax(150px, 0.8fr)", cellClassName: "font-semibold" },
      },
      {
        accessorKey: "reference",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("payments.reference", "Reference")}
          </span>
        ),
        cell: ({ getValue }) => (getValue() as string | null) ?? "—",
        meta: { template: "minmax(180px, 1.2fr)" },
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.status", "Status")}
          </span>
        ),
        cell: ({ getValue }) => <StatusChip tone="neutral">{getValue() as string}</StatusChip>,
        meta: { template: "minmax(140px, 0.8fr)" },
      },
    ],
    [t]
  );

  const statementColumns = useMemo<ColumnDef<StatementSummary, unknown>[]>(
    () => [
      {
        accessorKey: "label",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("reports.table.month", "Month")}
          </span>
        ),
        meta: { template: "minmax(160px, 1fr)" },
      },
      {
        accessorKey: "postedTotal",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.posted", "Posted")}
          </span>
        ),
        cell: ({ getValue }) => currencyFormatter.format(Number(getValue() ?? 0)),
        meta: { align: "right", template: "minmax(150px, 0.8fr)", cellClassName: "font-semibold" },
      },
      {
        accessorKey: "unallocatedTotal",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.unallocated", "Unallocated")}
          </span>
        ),
        cell: ({ getValue }) => currencyFormatter.format(Number(getValue() ?? 0)),
        meta: { align: "right", template: "minmax(150px, 0.8fr)" },
      },
      {
        accessorKey: "transactionCount",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
            {t("table.transactions", "Transactions")}
          </span>
        ),
        meta: { align: "right", template: "minmax(130px, 0.7fr)" },
      },
    ],
    [t]
  );

  const filteredMembers = useMemo(() => {
    const query = deferredMemberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => {
      const target =
        `${member.full_name} ${member.member_code ?? ""} ${member.msisdn ?? ""}`.toLowerCase();
      return target.includes(query);
    });
  }, [members, deferredMemberSearch]);

  const filteredPayments = useMemo(() => {
    if (depositFilter === "ALL") return payments;
    return payments.filter((payment) => payment.status === depositFilter);
  }, [payments, depositFilter]);

  return (
    <div className="space-y-6">
      <SegmentedControl
        value={tab}
        onValueChange={(next) => {
          if (typeof next !== "string") return;
          setTab(next as TabKey);
        }}
        options={MEMBER_TABS.map((item) => ({
          value: item,
          label: t(TAB_KEYS[item], TAB_KEYS[item].split(".").pop() ?? item),
        }))}
        columns={3}
        className="md:grid-cols-5"
        aria-label={t("ikimina.tabs.label", "Ikimina sections")}
      />

      {tab === "Overview" && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OverviewCard
            title={t("ikimina.overview.activeMembers", "Active members")}
            primary={`${detail.analytics.activeMembers}/${detail.analytics.totalMembers}`}
            subtitle={t("ikimina.overview.activeVsTotal", "Active / total")}
          />
          <OverviewCard
            title={t("ikimina.overview.thisMonth", "This month")}
            primary={currencyFormatter.format(detail.analytics.monthTotal)}
            subtitle={t("ikimina.overview.postedVolume", "Posted volume")}
          />
          <OverviewCard
            title={t("ikimina.overview.onTimeRate", "On-time rate")}
            primary={`${detail.analytics.onTimeRate}%`}
            subtitle={t("ikimina.overview.postedVsTotal", "Posted vs total")}
          />
          <OverviewCard
            title={t("ikimina.overview.lastDeposit", "Last deposit")}
            primary={relativeDate(detail.analytics.lastDepositAt)}
            subtitle={
              detail.analytics.lastDepositAt
                ? dateFormatter.format(new Date(detail.analytics.lastDepositAt))
                : t("ikimina.overview.noDeposits", "No deposits recorded")
            }
          />
        </div>
      )}

      {tab === "Members" && (
        <div className="space-y-4">
          <div className="max-w-sm">
            <Input
              label={t("ikimina.members.searchLabel", "Search members")}
              placeholder={t(
                "ikimina.members.searchPlaceholder",
                "Search by name, MSISDN, or code"
              )}
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
          </div>
          <VirtualTable
            data={filteredMembers}
            columns={memberColumns}
            emptyState={
              <EmptyState
                title={t("ikimina.members.emptyTitle", "No members")}
                description={t(
                  "ikimina.members.emptyDescription",
                  "Import members to get started."
                )}
              />
            }
            ux={{
              tableId: "ikimina.detail.members",
              requestToken: memberTableRequestToken,
              context: {
                ikiminaId: detail.id,
                filteredCount: filteredMembers.length,
                totalMembers: members.length,
                queryLength: deferredMemberSearch.length,
              },
            }}
          />
        </div>
      )}

      {tab === "Deposits" && (
        <div className="space-y-4">
          <SegmentedControl
            value={depositFilter}
            onValueChange={(next) => {
              if (typeof next !== "string") return;
              setDepositFilter(next as PaymentFilter);
            }}
            options={paymentStatuses.map((option) => ({
              value: option,
              label: t(
                `payments.filter.${option.toLowerCase()}`,
                PAYMENT_STATUS_LABELS[option as keyof typeof PAYMENT_STATUS_LABELS]?.primary ??
                  option
              ),
            }))}
            aria-label={t("ikimina.deposits.filter", "Filter deposits")}
          />
          <VirtualTable
            data={filteredPayments}
            columns={paymentColumns}
            emptyState={
              <EmptyState
                title={t("ikimina.deposits.emptyTitle", "No deposits")}
                description={t(
                  "ikimina.deposits.emptyDescription",
                  "Recent transactions will appear here."
                )}
              />
            }
            ux={{
              tableId: "ikimina.detail.deposits",
              requestToken: depositTableRequestToken,
              context: {
                ikiminaId: detail.id,
                filter: depositFilter,
                filteredCount: filteredPayments.length,
                totalPayments: payments.length,
              },
            }}
          />
        </div>
      )}

      {tab === "Statements" && (
        <VirtualTable
          data={statements}
          columns={statementColumns}
          emptyState={
            <EmptyState
              title={t("ikimina.statements.emptyTitle", "No statements")}
              description={t(
                "ikimina.statements.emptyDescription",
                "Statements will appear as transactions post."
              )}
            />
          }
          ux={{
            tableId: "ikimina.detail.statements",
            requestToken: statementsRequestToken,
            context: {
              ikiminaId: detail.id,
              statementCount: statements.length,
            },
          }}
        />
      )}

      {tab === "Settings" && (
        <IkiminaSettingsEditor
          ikiminaId={detail.id}
          ikiminaName={detail.name}
          saccoId={detail.saccoId ?? null}
          initialSettings={detail.settings as Record<string, unknown> | null}
          history={history}
        />
      )}
    </div>
  );
}

function OverviewCard({
  title,
  primary,
  subtitle,
}: {
  title: string;
  primary: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glass">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-0">{primary}</p>
      <p className="text-xs text-neutral-2">{subtitle}</p>
    </div>
  );
}
