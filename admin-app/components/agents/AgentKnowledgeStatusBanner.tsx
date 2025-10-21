"use client";

import { useMemo } from "react";

type KnowledgeStats = {
  total: number;
  ready: number;
  processing: number;
  pending: number;
  failed: number;
  other: number;
};

type AgentKnowledgeStatusBannerProps = {
  stats?: KnowledgeStats;
  isPolling?: boolean;
  pendingEmbeds?: boolean;
  dataUpdatedAt?: number;
  totalDocuments: number;
};

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp).toLocaleString();
  } catch (error) {
    console.warn("Failed to format timestamp", error);
    return null;
  }
}

export function AgentKnowledgeStatusBanner({
  stats,
  isPolling = false,
  pendingEmbeds = false,
  dataUpdatedAt,
  totalDocuments,
}: AgentKnowledgeStatusBannerProps) {
  const normalized = useMemo(() => {
    if (!stats) return null;
    const total = stats.total || totalDocuments;
    if (!total) return {
      total: 0,
      ready: 0,
      processing: 0,
      pending: 0,
      failed: 0,
      other: 0,
      readyPercent: 0,
    };

    const readyPercent = Math.min(100, Math.round((stats.ready / total) * 100));

    return {
      ...stats,
      total,
      readyPercent,
    };
  }, [stats, totalDocuments]);

  if (!normalized) {
    return null;
  }

  const lastChecked = formatTimestamp(dataUpdatedAt);
  const processingCount = normalized.processing + normalized.pending;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-700">Knowledge base coverage</p>
          <p className="text-2xl font-semibold text-slate-900">
            {normalized.readyPercent}% ready
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {isPolling ? (
            <span className="font-medium text-amber-600">Refreshing embedding status…</span>
          ) : lastChecked ? (
            <span>Last updated {lastChecked}</span>
          ) : (
            <span>Waiting for first document sync</span>
          )}
        </div>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full border border-slate-200 bg-white">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-300 ease-out"
          style={{ width: `${normalized.readyPercent}%` }}
        />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded border border-emerald-200 bg-white p-3">
          <dt className="text-xs uppercase tracking-wide text-emerald-600">Ready</dt>
          <dd className="text-lg font-semibold text-emerald-700">{normalized.ready}</dd>
        </div>
        <div className="rounded border border-amber-200 bg-white p-3">
          <dt className="text-xs uppercase tracking-wide text-amber-600">Processing</dt>
          <dd className="text-lg font-semibold text-amber-700">{processingCount}</dd>
          <p className="text-[11px] text-amber-600">
            Pending {normalized.pending} · Running {normalized.processing}
          </p>
        </div>
        <div className="rounded border border-rose-200 bg-white p-3">
          <dt className="text-xs uppercase tracking-wide text-rose-600">Failed</dt>
          <dd className="text-lg font-semibold text-rose-700">{normalized.failed}</dd>
        </div>
        <div className="rounded border border-slate-200 bg-white p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-600">Tracked</dt>
          <dd className="text-lg font-semibold text-slate-700">{normalized.total}</dd>
          {pendingEmbeds && (
            <p className="text-[11px] font-medium text-amber-600">Embedding updates in progress</p>
          )}
        </div>
        {normalized.other > 0 ? (
          <div className="rounded border border-slate-200 bg-white p-3 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-600">Other statuses</dt>
            <dd className="text-lg font-semibold text-slate-700">{normalized.other}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
