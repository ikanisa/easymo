"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { useTranslation } from "@/providers/i18n-provider";
import type { AuditFiltersState } from "@/components/admin/audit/audit-filters";

interface AuditExportButtonProps {
  filters: AuditFiltersState;
  saccoId: string | null;
  includeAll: boolean;
}

export function AuditExportButton({ filters, saccoId, includeAll }: AuditExportButtonProps) {
  const { t } = useTranslation();

  const href = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim().length > 0) {
        params.set(key, value.trim());
      }
    });
    if (!includeAll && saccoId) {
      params.set("saccoId", saccoId);
    }
    return `/api/admin/audit/export?${params.toString()}`;
  }, [filters, saccoId, includeAll]);

  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-neutral-3 transition hover:border-white/40 hover:text-neutral-0"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      <span>{t("admin.audit.export", "Download CSV")}</span>
    </a>
  );
}
