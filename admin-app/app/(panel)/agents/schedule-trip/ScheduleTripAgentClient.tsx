"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { useScheduledTripsQuery } from "@/lib/queries/schedule-trips";

function formatDateTime(value: string) {
  const date = new Date(value);
  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatStatus(value: string) {
  return value.replace("_", " ");
}

export function ScheduleTripAgentClient() {
  const query = useScheduledTripsQuery();
  const trips = useMemo(() => query.data?.trips ?? [], [query.data?.trips]);
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedId) ?? null,
    [trips, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading scheduled trips"
        description="Pulling recurring journeys and SLA timers."
      />
    );
  }

  return (
    <div className="schedule-agent-page">
      <PageHeader
        title="Schedule Trip"
        description="Monitor calendarized trips, recurring routes, and driver assignments."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status">
          <p className="bing-alert__title">
            Schedule sync is degraded, showing fallback data.
          </p>
          {integration.message && <p>{integration.message}</p>}
        </div>
      )}
      <div className="schedule-agent">
        <section className="schedule-agent__queue" aria-label="Upcoming trips">
          <header>
            <h2>Upcoming departures</h2>
            <p>Sorted soonest first.</p>
          </header>
          <div className="schedule-agent__list">
            {trips.length ? (
              trips.map((trip) => (
                <button
                  key={trip.id}
                  type="button"
                  className={
                    "schedule-agent__card" +
                    (trip.id === selectedId ? " schedule-agent__card--active" : "")
                  }
                  onClick={() => setSelectedId(trip.id)}
                >
                  <div className="schedule-agent__card-header">
                    <p>{trip.pickup ?? "Pickup TBD"}</p>
                    <span className="schedule-agent__status">
                      {formatStatus(trip.status)}
                    </span>
                  </div>
                  <p className="schedule-agent__route">
                    <span>{trip.pickup ?? "Pickup"}</span>
                    <span>→</span>
                    <span>{trip.dropoff ?? "Drop-off"}</span>
                  </p>
                  <p className="schedule-agent__meta">
                    {formatDateTime(trip.scheduledTime)} · {trip.vehiclePreference}
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No scheduled trips"
                description="As soon as riders schedule journeys they will appear here."
              />
            )}
          </div>
        </section>
        <section className="schedule-agent__detail" aria-label="Trip detail">
          {selectedTrip ? (
            <>
              <header>
                <h2>Trip detail</h2>
                <p>{selectedTrip.passengerRef ?? "Unknown passenger"}</p>
              </header>
              <dl className="schedule-agent__grid">
                <div>
                  <dt>Pickup</dt>
                  <dd>{selectedTrip.pickup ?? "Pickup TBD"}</dd>
                </div>
                <div>
                  <dt>Drop-off</dt>
                  <dd>{selectedTrip.dropoff ?? "Drop-off TBD"}</dd>
                </div>
                <div>
                  <dt>Scheduled time</dt>
                  <dd>{formatDateTime(selectedTrip.scheduledTime)}</dd>
                </div>
                <div>
                  <dt>Recurrence</dt>
                  <dd>{selectedTrip.recurrence}</dd>
                </div>
                <div>
                  <dt>Vehicle</dt>
                  <dd>{selectedTrip.vehiclePreference}</dd>
                </div>
                <div>
                  <dt>Budget cap</dt>
                  <dd>
                    {typeof selectedTrip.maxPrice === "number"
                      ? `${selectedTrip.maxPrice.toLocaleString()} RWF`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="schedule-agent__actions">
                <button type="button" className="bing-button bing-button--primary">
                  Confirm driver
                </button>
                <button type="button" className="bing-button">
                  Message passenger
                </button>
                <button type="button" className="bing-button">
                  Pause recurrence
                </button>
              </div>
              <div className="schedule-agent__timeline">
                <h3>Timeline</h3>
                <ul>
                  <li>
                    <span>Next run</span>
                    <span>
                      {selectedTrip.nextRunAt
                        ? formatDateTime(selectedTrip.nextRunAt)
                        : "Not scheduled"}
                    </span>
                  </li>
                  <li>
                    <span>Status</span>
                    <span>{formatStatus(selectedTrip.status)}</span>
                  </li>
                  <li>
                    <span>SLA</span>
                    <span>5 min to assign driver</span>
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a trip"
              description="Click on a scheduled journey to view the details."
            />
          )}
        </section>
        <section className="schedule-agent__calendar" aria-label="Calendar">
          <h2>Calendar preview</h2>
          <p>
            Weekly calendar and WhatsApp event sync will appear here. Plug into
            Supabase real-time channels to light up the calendar heat map.
          </p>
        </section>
      </div>
    </div>
  );
}
