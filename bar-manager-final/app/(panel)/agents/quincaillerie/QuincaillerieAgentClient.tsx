"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useQuincaillerieVendors } from "@/lib/queries/quincaillerie";

function formatDistance(distanceKm: number | null | undefined) {
  if (typeof distanceKm !== "number") return "—";
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
}

export function QuincaillerieAgentClient() {
  const query = useQuincaillerieVendors();
  const vendors = useMemo(
    () => query.data?.vendors ?? [],
    [query.data?.vendors],
  );
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedId) ?? null,
    [vendors, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading quincailleries"
        description="Fetching hardware vendors within a 10 km radius."
      />
    );
  }

  return (
    <div className="quinca-agent-page">
      <PageHeader
        title="Nearby Quincailleries"
        description="Source hardware, track availability, and brief agents on vendor performance."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status">
          <p className="bing-alert__title">
            Hardware data is running in fallback mode.
          </p>
          {integration.message && <p>{integration.message}</p>}
          {integration.remediation && (
            <p className="bing-alert__action">{integration.remediation}</p>
          )}
        </div>
      )}
      <div className="quinca-agent">
        <section className="quinca-agent__list" aria-label="Vendor list">
          <header>
            <h2>Vendors within 10 km</h2>
            <p>Sorted by proximity and verification.</p>
          </header>
          <div className="quinca-agent__list-items">
            {vendors.length ? (
              vendors.map((vendor) => (
                <button
                  key={vendor.id}
                  type="button"
                  className={
                    "quinca-agent__card" +
                    (vendor.id === selectedId ? " quinca-agent__card--active" : "")
                  }
                  onClick={() => setSelectedId(vendor.id)}
                >
                  <div className="quinca-agent__card-header">
                    <p className="quinca-agent__name">{vendor.name}</p>
                    <span className="quinca-agent__distance">
                      {formatDistance(vendor.distanceKm)}
                    </span>
                  </div>
                  <p className="quinca-agent__description">
                    {vendor.description ?? "No description yet."}
                  </p>
                  <div className="quinca-agent__tags">
                    {vendor.verified && <span className="bing-chip">Verified</span>}
                    {typeof vendor.rating === "number" && (
                      <span className="bing-chip">
                        {vendor.rating.toFixed(1)} ★
                      </span>
                    )}
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                title="No active vendors"
                description="Once vendors sync from Supabase they will appear here."
              />
            )}
          </div>
        </section>
        <section className="quinca-agent__detail" aria-label="Vendor detail">
          {selectedVendor ? (
            <>
              <header>
                <h2>{selectedVendor.name}</h2>
                <p>{selectedVendor.description ?? "No profile added yet."}</p>
              </header>
              <dl className="quinca-agent__grid">
                <div>
                  <dt>Distance</dt>
                  <dd>{formatDistance(selectedVendor.distanceKm)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedVendor.status ?? "active"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedVendor.phone ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Rating</dt>
                  <dd>
                    {typeof selectedVendor.rating === "number"
                      ? `${selectedVendor.rating.toFixed(1)} ★`
                      : "Not rated"}
                  </dd>
                </div>
              </dl>
              <div className="quinca-agent__actions">
                <button type="button" className="bing-button bing-button--primary">
                  Request quote
                </button>
                <button type="button" className="bing-button">
                  Share BOM
                </button>
                <button type="button" className="bing-button">
                  Assign to agent
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a vendor"
              description="Choose a quincaillerie from the list to review details."
            />
          )}
        </section>
        <section className="quinca-agent__context" aria-label="Negotiation log">
          <h2>Negotiation log</h2>
          <p>
            WhatsApp threads, purchase orders, and SLA timers will appear here
            once the integrations are wired up.
          </p>
        </section>
      </div>
    </div>
  );
}
