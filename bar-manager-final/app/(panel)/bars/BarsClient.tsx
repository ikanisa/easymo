"use client";

import { useMemo, useState } from "react";

import { BarFloorView } from "@/components/bars/BarFloorView";
import { BarKitchenFeed } from "@/components/bars/BarKitchenFeed";
import { BarsTable } from "@/components/bars/BarsTable";
import { BarThreadFeed } from "@/components/bars/BarThreadFeed";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useBarDashboardQuery } from "@/lib/queries/barDashboard";
import { type BarsQueryParams, useBarsQuery } from "@/lib/queries/bars";
import { useMenuVersionsQuery } from "@/lib/queries/menus";
import {
  type StaffNumbersQueryParams,
  useStaffNumbersQuery,
} from "@/lib/queries/staffNumbers";

const BAR_STATUS_FILTERS = ["active", "inactive"] as const;

interface BarsClientProps {
  initialBarParams?: BarsQueryParams;
  staffNumbersParams?: StaffNumbersQueryParams;
}

export function BarsClient({
  initialBarParams = { limit: 100 },
  staffNumbersParams = { limit: 6 },
}: BarsClientProps) {
  const [barParams, setBarParams] = useState<BarsQueryParams>(initialBarParams);
  const barsQuery = useBarsQuery(barParams);
  const bars = useMemo(() => barsQuery.data?.data ?? [], [barsQuery.data?.data]);
  const [activeBarId, setActiveBarId] = useState<string | undefined>(() => bars[0]?.id);

  const dashboardQuery = useBarDashboardQuery(
    { barId: activeBarId, limit: 15 },
    {
      enabled: Boolean(activeBarId),
      refetchInterval: 5000,
    },
  );
  const menuQuery = useMenuVersionsQuery(
    { limit: 5, barId: activeBarId, status: "published" },
    { enabled: Boolean(activeBarId) },
  );

  const staffNumbersQuery = useStaffNumbersQuery(staffNumbersParams);
  const hasMoreBars = barsQuery.data?.hasMore;
  const isLoadingMoreBars = barsQuery.isFetching && !barsQuery.isLoading;
  const staffNumbers = useMemo(() => staffNumbersQuery.data?.data ?? [], [
    staffNumbersQuery.data?.data,
  ]);

  const dashboard = dashboardQuery.data;
  const menus = menuQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Bars"
        description="Admin override surface for bar profiles, contact numbers, settings, and audit trails."
      />

      <SectionCard
        title="Bars overview"
        description="Filter by status/claim or search by name."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[color:var(--color-muted)]">
              Status
              <select
                value={barParams.status ?? ""}
                onChange={(event) => {
                  const v = event.target.value as '' | typeof BAR_STATUS_FILTERS[number];
                  setBarParams((prev) => ({
                    ...prev,
                    status: v || undefined,
                    limit: initialBarParams.limit ?? 100,
                  }));
                }}
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              >
                <option value="">All</option>
                {BAR_STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[color:var(--color-muted)]">
              Claimed
              <select
                value={barParams.claimed == null ? "" : (barParams.claimed ? "true" : "false")}
                onChange={(event) => {
                  const v = event.target.value;
                  setBarParams((prev) => ({
                    ...prev,
                    claimed: v === "" ? undefined : v === "true",
                    limit: initialBarParams.limit ?? 100,
                  }));
                }}
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              >
                <option value="">All</option>
                <option value="true">Claimed</option>
                <option value="false">Unclaimed</option>
              </select>
            </label>
            <label className="text-sm text-[color:var(--color-muted)]">
              Search
              <input
                value={barParams.search ?? ""}
                onChange={(event) =>
                  setBarParams((prev) => ({
                    ...prev,
                    search: event.target.value || undefined,
                    limit: initialBarParams.limit ?? 100,
                  }))}
                placeholder="Chez Lando"
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              />
            </label>
            {bars.length ? (
              <label className="text-sm text-[color:var(--color-muted)]">
                Active bar
                <select
                  value={activeBarId ?? bars[0]?.id ?? ""}
                  onChange={(event) => setActiveBarId(event.target.value || undefined)}
                  className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
                >
                  {bars.map((bar) => (
                    <option key={bar.id} value={bar.id}>
                      {bar.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        }
      >
        {barsQuery.isLoading ? (
          <LoadingState
            title="Loading bars"
            description="Fetching bar directory."
          />
        ) : bars.length ? (
          <BarsTable
            data={bars}
            hasMore={hasMoreBars}
            onLoadMore={() =>
              setBarParams((prev) => ({
                ...prev,
                limit: (prev.limit ?? 100) + 50,
              }))}
            loadingMore={isLoadingMoreBars}
          />
        ) : (
          <EmptyState
            title="No bars available"
            description="Fixtures not loaded yet. Configure Supabase or load staging fixtures to view records."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Common follow-up"
        description="Recent staff numbers give quick context while the detail drawer is under construction."
      >
        {staffNumbersQuery.isLoading ? (
          <LoadingState
            title="Loading staff numbers"
            description="Fetching recent receiving numbers."
          />
        ) : staffNumbers.length ? (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {staffNumbers.map((number) => (
              <li
                key={number.id}
                className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4"
              >
                <strong className="text-[color:var(--color-foreground)]">
                  {number.barName}
                </strong>
                <p className="text-sm text-[color:var(--color-muted)]">
                  {number.number} • {number.role}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No staff numbers yet"
            description="Once fixtures are loaded, the latest receiving numbers will appear here."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Floor view"
        description="Realtime occupancy signals pulled from Supabase orders."
      >
        {dashboardQuery.isLoading ? (
          <LoadingState title="Loading floor data" description="Fetching latest orders." />
        ) : dashboard?.floor?.length ? (
          <BarFloorView tables={dashboard.floor} />
        ) : (
          <EmptyState
            title="No floor activity"
            description="Create an order to visualise table status."
          />
        )}
      </SectionCard>

      <SectionCard
        title="Menu manager"
        description="Latest published menu versions for the active bar."
      >
        {menuQuery.isLoading ? (
          <LoadingState title="Loading menus" description="Fetching menu versions." />
        ) : menus.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {menus.map((menu) => (
              <li
                key={menu.id}
                className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3"
              >
                <div className="flex items-center justify-between text-sm text-[color:var(--color-muted)]">
                  <span>{menu.barName}</span>
                  <span>{menu.updatedAt ? new Date(menu.updatedAt).toLocaleDateString() : ""}</span>
                </div>
                <p className="mt-1 text-base font-semibold text-[color:var(--color-foreground)]">{menu.version}</p>
                <p className="text-sm text-[color:var(--color-muted)]">
                  {menu.items} items · {menu.categories} categories · {menu.status}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No menus" description="Publish a menu to populate this section." />
        )}
      </SectionCard>

      <SectionCard
        title="Kitchen feed"
        description="Realtime tickets sourced from WhatsApp orders."
      >
        {dashboardQuery.isLoading ? (
          <LoadingState title="Loading kitchen feed" description="Fetching order tickets." />
        ) : dashboard?.kitchen?.length ? (
          <BarKitchenFeed tickets={dashboard.kitchen} />
        ) : (
          <EmptyState title="No tickets" description="Kitchen queue is empty." />
        )}
      </SectionCard>

      <SectionCard
        title="WhatsApp threads"
        description="Latest guest and agent interactions from wa_messages."
      >
        {dashboardQuery.isLoading ? (
          <LoadingState title="Loading messages" description="Polling Supabase wa_messages." />
        ) : dashboard?.threads?.length ? (
          <BarThreadFeed events={dashboard.threads} />
        ) : (
          <EmptyState
            title="No chat events"
            description="AI waiter has not engaged guests yet."
          />
        )}
      </SectionCard>
    </div>
  );
}
