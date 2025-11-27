"use client";

import { useMemo, useState } from "react";

import { StorageTable } from "@/components/files/StorageTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IntegrationStatusChip } from "@/components/ui/IntegrationStatusChip";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  type StorageQueryParams,
  useStorageObjectsQuery,
} from "@/lib/queries/files";
import { useIntegrationStatusQuery } from "@/lib/queries/integrations";

const BUCKET_OPTIONS = ["operations", "qr", "docs"];

interface FilesClientProps {
  initialParams?: StorageQueryParams;
}

export function FilesClient(
  { initialParams = { limit: 200 } }: FilesClientProps,
) {
  const [params, setParams] = useState<StorageQueryParams>(initialParams);
  const storageQuery = useStorageObjectsQuery(params);
  const integrationStatus = useIntegrationStatusQuery();

  const storageObjects = useMemo(() => storageQuery.data?.data ?? [], [
    storageQuery.data?.data,
  ]);
  const hasMore = storageQuery.data?.hasMore;
  const loadingMore = storageQuery.isFetching && !storageQuery.isLoading;

  const derivedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    storageObjects.forEach((object) => {
      const bucket = object.bucket ?? "unknown";
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    });
    return counts;
  }, [storageObjects]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Files"
        description="Browse Supabase storage buckets for operations assets, QR codes, and insurance documents."
        meta={
          <IntegrationStatusChip
            label="Signed URLs"
            status={integrationStatus.data?.storageSignedUrl}
            isLoading={integrationStatus.isLoading}
          />
        }
      />

      <SectionCard
        title="Storage browser"
        description="Signed URL generation and previews will be hooked into this table soon."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-[color:var(--color-muted)]">
              Bucket
              <select
                value={params.bucket ?? ""}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    bucket: event.target.value || undefined,
                    limit: initialParams.limit ?? 200,
                    offset: 0,
                  }))}
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              >
                <option value="">All</option>
                {BUCKET_OPTIONS.map((bucket) => (
                  <option key={bucket} value={bucket}>
                    {bucket}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[color:var(--color-muted)]">
              Search
              <input
                value={params.search ?? ""}
                onChange={(event) =>
                  setParams((prev) => ({
                    ...prev,
                    search: event.target.value || undefined,
                    limit: initialParams.limit ?? 200,
                    offset: 0,
                  }))}
                placeholder="filename.png"
                className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
              />
            </label>
          </div>
        }
      >
        {storageQuery.isLoading
          ? (
            <LoadingState
              title="Loading storage objects"
              description="Fetching bucket contents."
            />
          )
          : storageObjects.length
          ? (
            <StorageTable
              data={storageObjects}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onLoadMore={() =>
                setParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? initialParams.limit ?? 200) + 100,
                }))}
            />
          )
          : (
            <EmptyState
              title="Storage empty"
              description="No files found. Connect to Supabase or load fixtures to inspect storage."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Bucket summary"
        description="Quick pulse on how many objects exist per bucket."
      >
        {storageObjects.length
          ? (
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {BUCKET_OPTIONS.map((bucket) => (
                <li
                  key={bucket}
                  className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-4 text-sm"
                >
                  <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {bucket}
                  </div>
                  <div className="text-2xl font-semibold text-[color:var(--color-foreground)]">
                    {derivedCounts.get(bucket) ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          )
          : (
            <EmptyState
              title="No data"
              description="Bucket counts will appear when files are available."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Preview & URL copy"
        description="Preview modal and copy-to-clipboard links will appear once the API bridge is implemented."
      >
        <EmptyState
          title="Preview pending"
          description="Expect lightbox previews for images and download links for other file types."
        />
      </SectionCard>
    </div>
  );
}
