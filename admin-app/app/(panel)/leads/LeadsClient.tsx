"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { LeadTable } from "@/components/leads/LeadTable";
import { LeadDetailPanel } from "@/components/leads/LeadDetailPanel";
import { useLeadsQuery } from "@/lib/queries/leads";

export function LeadsClient() {
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);
  const leadsQuery = useLeadsQuery(deferredSearch);

  const leads = useMemo(
    () => leadsQuery.data?.leads ?? [],
    [leadsQuery.data?.leads],
  );
  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) ?? null,
    [leads, selectedLeadId],
  );

  return (
    <div className="admin-page">
      <PageHeader
        title="Leads"
        description="Search, tag, and manage opt-in preferences across tenants."
      />

      <SectionCard
        title="Lead roster"
        description="Use the search to find leads by phone or name."
      >
        <label className="mb-4 block text-sm">
          <span className="text-[color:var(--color-muted)]">Search</span>
          <input
            className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
            placeholder="Search leads by phone or name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        {leadsQuery.isLoading
          ? (
            <LoadingState
              title="Loading leads"
              description="Fetching leads from Agent Core"
            />
          )
          : leads.length
          ? (
            <LeadTable
              data={leads}
              onSelect={(lead) => setSelectedLeadId(lead.id)}
            />
          )
          : (
            <EmptyState
              title="No leads found"
              description="Try adjusting your search or ensure agent-core is connected."
            />
          )}
      </SectionCard>

      <LeadDetailPanel lead={selectedLead} />
    </div>
  );
}
