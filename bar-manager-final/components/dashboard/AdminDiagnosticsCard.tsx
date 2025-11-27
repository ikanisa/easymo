"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useAdminDiagnosticsQuery } from "@/lib/queries/adminDiagnostics";

import { AdminDiagnosticsContent } from "./admin-diagnostics/AdminDiagnosticsContent";

export function AdminDiagnosticsCard() {
  const diagnosticsQuery = useAdminDiagnosticsQuery();
  const snapshot = diagnosticsQuery.data;

  return (
    <SectionCard
      title="Diagnostics snapshot"
      description="Latest config and webhook health sourced from the WhatsApp admin flow."
    >
      {diagnosticsQuery.isLoading
        ? (
          <LoadingState
            title="Loading diagnostics"
            description="Fetching flow-exchange diagnostics."
          />
        )
        : snapshot
        ? <AdminDiagnosticsContent snapshot={snapshot} />
        : (
          <EmptyState
            title="Diagnostics unavailable"
            description="Unable to load diagnostics from flow-exchange."
          />
        )}
    </SectionCard>
  );
}
