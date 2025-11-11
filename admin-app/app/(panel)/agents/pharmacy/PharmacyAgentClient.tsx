"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePharmacyRequestsQuery } from "@/lib/queries/pharmacy";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

function formatCurrency(value: number | null | undefined): string {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PharmacyAgentClient() {
  const query = usePharmacyRequestsQuery();
  const requests = useMemo(
    () => query.data?.requests ?? [],
    [query.data?.requests],
  );
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => requests.find((req) => req.id === selectedId) ?? null,
    [requests, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading pharmacy requests"
        description="Gathering patient scripts and live vendor quotes."
      />
    );
  }

  return (
    <div className="pharmacy-agent-page">
      <PageHeader
        title="Nearby Pharmacies"
        description="Review scripts, compare quotes, and approve the best vendor within SLA."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status" aria-live="polite">
          <p className="bing-alert__title">
            Pharmacy agent is using fallback data.
          </p>
          {integration.message && <p>{integration.message}</p>}
          {integration.remediation && (
            <p className="bing-alert__action">{integration.remediation}</p>
          )}
        </div>
      )}
      <div className="pharmacy-agent">
        <section className="pharmacy-agent__queue" aria-label="Requests queue">
          <header>
            <h2>Request queue</h2>
            <p>Patient prescriptions awaiting vendor quotes.</p>
          </header>
          <div className="pharmacy-agent__list">
            {requests.length ? (
              requests.map((request) => (
                <button
                  key={request.id}
                  type="button"
                  className={
                    "pharmacy-agent__card" +
                    (selectedId === request.id
                      ? " pharmacy-agent__card--active"
                      : "")
                  }
                  onClick={() => setSelectedId(request.id)}
                >
                  <div className="pharmacy-agent__card-header">
                    <span>{request.patient}</span>
                    <span className="pharmacy-agent__status">
                      {request.status}
                    </span>
                  </div>
                  <ul>
                    {request.medications.slice(0, 2).map((med) => (
                      <li key={med}>{med}</li>
                    ))}
                    {request.medications.length > 2 && (
                      <li>+{request.medications.length - 2} more</li>
                    )}
                  </ul>
                  <p className="pharmacy-agent__meta">
                    {request.deliveryMode} · {request.urgency.replace("_", " ")}
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No active prescriptions"
                description="Patients will appear here as soon as they send scripts."
              />
            )}
          </div>
        </section>
        <section className="pharmacy-agent__detail" aria-label="Quote compare">
          {selected ? (
            <>
              <header>
                <h2>Compare options</h2>
                <p>Prescription for {selected.patient}.</p>
              </header>
              <div className="pharmacy-agent__medications">
                <strong>Requested medicines</strong>
                <ul>
                  {selected.medications.map((med) => (
                    <li key={med}>{med}</li>
                  ))}
                </ul>
              </div>
              <div className="pharmacy-agent__quotes">
                {selected.quotes.length ? (
                  selected.quotes.map((quote) => (
                    <article key={quote.vendor} className="pharmacy-agent__quote-card">
                      <header>
                        <h3>{quote.vendor}</h3>
                        <span className="pharmacy-agent__price">
                          {formatCurrency(quote.price)}
                        </span>
                      </header>
                      <p>{quote.stockStatus ?? "Stock unknown"}</p>
                      <p className="pharmacy-agent__eta">
                        ETA {quote.etaMinutes ?? "—"} min
                      </p>
                      <div className="pharmacy-agent__quote-actions">
                        <button type="button" className="bing-button bing-button--primary">
                          Approve
                        </button>
                        <button type="button" className="bing-button">
                          Ask follow-up
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState
                    title="Waiting for quotes"
                    description="Suppliers will appear here once they respond."
                  />
                )}
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a request"
              description="Choose a patient from the list to compare pharmacy quotes."
            />
          )}
        </section>
        <section className="pharmacy-agent__context" aria-label="Chat">
          <h2>Chat</h2>
          <p>
            Vendor conversations and automation macros will appear here. Wire to 
            the pharmacy negotiations stream to drive actions.
          </p>
        </section>
      </div>
    </div>
  );
}
