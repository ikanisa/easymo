"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MenuTable } from "@/components/menus/MenuTable";
import { OcrJobsTable } from "@/components/menus/OcrJobsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type MenuQueryParams,
  type OcrJobQueryParams,
  useMenuVersionsQuery,
  useOcrJobsQuery,
} from "@/lib/queries/menus";

const MENU_STATUS_FILTERS = ["draft", "published"] as const;
const OCR_STATUS_FILTERS = [
  "queued",
  "processing",
  "success",
  "error",
] as const;

interface MenusClientProps {
  initialMenuParams?: MenuQueryParams;
  initialOcrParams?: OcrJobQueryParams;
}

export function MenusClient({
  initialMenuParams = { limit: 100 },
  initialOcrParams = { limit: 50 },
}: MenusClientProps) {
  const [menuParams, setMenuParams] = useState<MenuQueryParams>(
    initialMenuParams,
  );
  const [ocrParams, setOcrParams] = useState<OcrJobQueryParams>(
    initialOcrParams,
  );

  const menusQuery = useMenuVersionsQuery(menuParams);
  const ocrQuery = useOcrJobsQuery(ocrParams);

  const menus = menusQuery.data?.data ?? [];
  const ocrJobs = ocrQuery.data?.data ?? [];
  const menusHasMore = menusQuery.data?.hasMore;
  const ocrHasMore = ocrQuery.data?.hasMore;
  const menusLoadingMore = menusQuery.isFetching && !menusQuery.isLoading;
  const ocrLoadingMore = ocrQuery.isFetching && !ocrQuery.isLoading;

  return (
    <div className="admin-page">
      <PageHeader
        title="Menus & OCR"
        description="Track menu drafts, published versions, and OCR pipelines. Support can review extracted content before it reaches vendors."
      />

      <SectionCard
        title="Menu versions"
        description="Drafts and published versions per bar. Actions to view, publish, duplicate, and archive will appear in subsequent phases."
        actions={
          <label className="text-sm text-[color:var(--color-muted)]">
            Status
            <select
              value={menuParams.status ?? ""}
              onChange={(event) => {
                const v = event.target.value as '' | typeof MENU_STATUS_FILTERS[number];
                setMenuParams((prev) => ({
                  ...prev,
                  status: v || undefined,
                  limit: initialMenuParams.limit ?? 100,
                }));
              }}
              className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
            >
              <option value="">All</option>
              {MENU_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {menusQuery.isLoading
          ? (
            <LoadingState
              title="Loading menus"
              description="Fetching menu versions."
            />
          )
          : menus.length
          ? (
            <MenuTable
              data={menus}
              hasMore={menusHasMore}
              loadingMore={menusLoadingMore}
              onLoadMore={() =>
                setMenuParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? 100) + 50,
                }))}
            />
          )
          : (
            <EmptyState
              title="No menus yet"
              description="Load fixtures or connect Supabase to view menu records."
            />
          )}
      </SectionCard>

      <SectionCard
        title="OCR job queue"
        description="Monitor OCR ingestion, retry failures, and map text to drafts."
        actions={
          <label className="text-sm text-[color:var(--color-muted)]">
            Status
            <select
              value={ocrParams.status ?? ""}
              onChange={(event) => {
                const v = event.target.value as '' | typeof OCR_STATUS_FILTERS[number];
                setOcrParams((prev) => ({
                  ...prev,
                  status: v || undefined,
                  limit: initialOcrParams.limit ?? 50,
                }));
              }}
              className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
            >
              <option value="">All</option>
              {OCR_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {ocrQuery.isLoading
          ? (
            <LoadingState
              title="Loading OCR jobs"
              description="Fetching OCR pipeline activity."
            />
          )
          : ocrJobs.length
          ? (
            <OcrJobsTable
              data={ocrJobs}
              hasMore={ocrHasMore}
              loadingMore={ocrLoadingMore}
              onLoadMore={() =>
                setOcrParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? 50) + 25,
                }))}
            />
          )
          : (
            <EmptyState
              title="Queue is empty"
              description="Once vendors upload menus, they will appear here for review."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Draft helper"
        description="Read-only view of the vendor WhatsApp experience will be embedded here in future iterations."
      >
        <EmptyState
          title="Preview coming soon"
          description="Support will soon be able to preview the vendor-side flow and trigger review reminders."
        />
      </SectionCard>
    </div>
  );
}
