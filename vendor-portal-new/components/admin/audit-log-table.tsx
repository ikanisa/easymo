"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/providers/i18n-provider";
import { cn } from "@/lib/utils";

export type AuditLogEntry = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actorLabel: string;
  createdAt: string;
  diff: Record<string, unknown> | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
  timeStyle: "short",
});

function DiffViewer({ diff }: { diff: Record<string, unknown> | null }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  if (!diff || Object.keys(diff).length === 0) {
    return (
      <p className="text-[11px] text-neutral-3">{t("admin.audit.noDiff", "No diff captured.")}</p>
    );
  }

  const preview = JSON.stringify(diff, null, expanded ? 2 : 0);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-neutral-1 transition hover:border-white/40 hover:text-neutral-0"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden />
        )}
        <span className="leading-none">
          {t(
            expanded ? "admin.audit.hideDiff" : "admin.audit.showDiff",
            expanded ? "Hide diff" : "Show diff"
          )}
        </span>
      </button>
      <pre className="max-h-48 overflow-auto rounded-xl bg-black/40 p-3 text-[11px] leading-snug text-neutral-0">
        {preview}
      </pre>
    </div>
  );
}

interface AuditLogTableProps {
  rows: AuditLogEntry[];
}

export function AuditLogTable({ rows }: AuditLogTableProps) {
  const { t } = useTranslation();
  if (!rows.length) {
    return (
      <p className="text-sm text-neutral-2">{t("admin.audit.empty", "No audit records yet.")}</p>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <article
          key={row.id}
          className={cn(
            "rounded-2xl border border-white/10 bg-white/5 p-4 text-sm shadow-inner backdrop-blur transition hover:border-white/20"
          )}
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-base font-semibold text-neutral-0">
              {row.action} · {row.entity}
            </span>
            <span className="text-xs text-neutral-3">
              {dateFormatter.format(new Date(row.createdAt))}
            </span>
          </header>
          <p className="mt-2 text-xs text-neutral-2">
            {t("admin.audit.actor", "Actor:")} {row.actorLabel}
          </p>
          {row.entityId && (
            <p className="mt-1 text-[11px] text-neutral-3">
              {t("admin.audit.entityId", "Entity ID:")} {row.entityId}
            </p>
          )}
          <div className="mt-3">
            <DiffViewer diff={row.diff} />
          </div>
        </article>
      ))}
    </div>
  );
}
