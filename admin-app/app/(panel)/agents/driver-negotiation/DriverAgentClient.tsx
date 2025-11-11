"use client";

import { useEffect, useMemo, useState } from "react";
import { useDriverRequestsQuery } from "@/lib/queries/agents";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function DriverAgentClient() {
  const query = useDriverRequestsQuery();
  const requests = useMemo(
    () => query.data?.requests ?? [],
    [query.data?.requests],
  );
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && requests.length) {
      setSelectedId(requests[0].id);
    }
  }, [requests, selectedId]);

  const selected = useMemo(
    () => requests.find((req) => req.id === selectedId) ?? null,
    [requests, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading driver requests"
        description="Fetching live passenger requests within 10 km."
      />
    );
  }

  return (
    <div className="driver-agent-page">
      <PageHeader
        title="Nearby Drivers"
        description="Monitor live passenger requests within 10 km, supervise agent negotiations, and keep SLAs under control."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status" aria-live="polite">
          <p className="bing-alert__title">
            Driver requests are running in fallback mode.
          </p>
          {integration.message && <p>{integration.message}</p>}
          {integration.remediation && (
            <p className="bing-alert__action">{integration.remediation}</p>
          )}
        </div>
      )}
      <div className="driver-agent">
        <section className="driver-agent__queue" aria-label="Requests queue">
          <header>
            <h2>Request queue</h2>
            <p>Live passenger requests waiting for driver matches.</p>
          </header>
        <div className="driver-agent__queue-list">
          {requests.length ? (
            requests.map((request) => (
              <button
                key={request.id}
                type="button"
                className={
                  "driver-agent__card" +
                  (selectedId === request.id ? " driver-agent__card--active" : "")
                }
                onClick={() => setSelectedId(request.id)}
              >
                <div className="driver-agent__card-header">
                  <span className="driver-agent__chip">
                    {request.vehicleType ?? "any"}
                  </span>
                  <span className="driver-agent__timestamp">
                    {formatRelativeTime(request.createdAt)}
                  </span>
                </div>
                <p className="driver-agent__route">
                  {request.pickup ?? "Unknown pickup"}
                  <span>→</span>
                  {request.dropoff ?? "TBD"}
                </p>
                <p className="driver-agent__meta">
                  {request.status ?? "open"} ·{" "}
                  {request.passengerRef ?? "anonymous"}
                </p>
              </button>
            ))
          ) : (
            <EmptyState
              title="No open requests"
              description="Passengers within 10 km will appear here in real time."
            />
          )}
        </div>
        </section>
        <section className="driver-agent__detail" aria-label="Request detail">
          {selected ? (
          <>
            <header>
              <h2>Negotiation room</h2>
              <p>
                Passenger {selected.passengerRef ?? "ref unknown"} requesting a{" "}
                {selected.vehicleType ?? "vehicle"}.
              </p>
            </header>
            <dl className="driver-agent__detail-grid">
              <div>
                <dt>Pickup</dt>
                <dd>{selected.pickup ?? "Not provided"}</dd>
              </div>
              <div>
                <dt>Drop-off</dt>
                <dd>{selected.dropoff ?? "Not provided"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd className="driver-agent__status">{selected.status ?? "open"}</dd>
              </div>
              <div>
                <dt>Requested</dt>
                <dd>{new Date(selected.createdAt).toLocaleString()}</dd>
              </div>
            </dl>
            <div className="driver-agent__actions">
              <button type="button" className="bing-button bing-button--primary">
                Approve candidate
              </button>
              <button type="button" className="bing-button">
                Extend SLA +2 min
              </button>
              <button type="button" className="bing-button">
                Manual message
              </button>
            </div>
            <div className="driver-agent__messages">
              <p>
                Live negotiation threads will appear here. Wire up the
                negotiations view to stream WhatsApp + agent events.
              </p>
            </div>
          </>
        ) : (
          <EmptyState
            title="Select a request"
            description="Choose a passenger from the queue to view details."
          />
        )}
        </section>
        <section className="driver-agent__map" aria-label="Map">
          <h2>Live map</h2>
          <p>
            Driver pins and route preview will render here once the mapping
            service is connected.
          </p>
        </section>
      </div>
    </div>
  );
}
