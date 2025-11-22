"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { usePropertyListingsQuery } from "@/lib/queries/property-rentals";

function formatCurrency(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatBedrooms(value: number | null | undefined) {
  if (typeof value !== "number") return "N/A";
  return `${value} bed${value > 1 ? "s" : ""}`;
}

function formatDistance(distanceKm: number | null | undefined) {
  if (typeof distanceKm !== "number") return "—";
  return `${distanceKm.toFixed(1)} km`;
}

export function PropertyRentalAgentClient() {
  const query = usePropertyListingsQuery();
  const properties = useMemo(
    () => query.data?.properties ?? [],
    [query.data?.properties],
  );
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId) ?? null,
    [properties, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading properties"
        description="Pulling nearby rentals and availability."
      />
    );
  }

  return (
    <div className="property-agent-page">
      <PageHeader
        title="Property Rentals"
        description="Match renters with verified properties, track availability, and manage negotiations."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status">
          <p className="bing-alert__title">
            Property inventory is running in fallback mode.
          </p>
          {integration.message && <p>{integration.message}</p>}
        </div>
      )}
      <div className="property-agent">
        <section className="property-agent__list" aria-label="Available properties">
          <header>
            <h2>Available listings</h2>
            <p>Within 10 km of the active search radius.</p>
          </header>
          <div className="property-agent__list-items">
            {properties.length ? (
              properties.map((property) => (
                <button
                  key={property.id}
                  type="button"
                  className={
                    "property-agent__card" +
                    (property.id === selectedId
                      ? " property-agent__card--active"
                      : "")
                  }
                  onClick={() => setSelectedId(property.id)}
                >
                  <div className="property-agent__card-header">
                    <p className="property-agent__price">
                      {formatCurrency(property.price)}
                    </p>
                    <span>{formatBedrooms(property.bedrooms)}</span>
                  </div>
                  <p className="property-agent__address">
                    {property.address ?? "Address unavailable"}
                  </p>
                  <p className="property-agent__meta">
                    {property.rentalType.replace("_", " ")} ·{" "}
                    {formatDistance(property.distanceKm)}
                  </p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No listings yet"
                description="Once properties sync from Supabase they will be listed here."
              />
            )}
          </div>
        </section>
        <section className="property-agent__detail" aria-label="Property detail">
          {selectedProperty ? (
            <>
              <header>
                <h2>{selectedProperty.address ?? "Unnamed property"}</h2>
                <p>
                  {formatBedrooms(selectedProperty.bedrooms)} ·{" "}
                  {selectedProperty.bathrooms ?? 0} bath ·{" "}
                  {selectedProperty.rentalType.replace("_", " ")}
                </p>
              </header>
              <dl className="property-agent__grid">
                <div>
                  <dt>Rent</dt>
                  <dd>{formatCurrency(selectedProperty.price)}</dd>
                </div>
                <div>
                  <dt>Available from</dt>
                  <dd>
                    {selectedProperty.availableFrom
                      ? new Date(selectedProperty.availableFrom).toLocaleDateString()
                      : "Immediately"}
                  </dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{selectedProperty.owner ?? "—"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedProperty.status ?? "available"}</dd>
                </div>
              </dl>
              <div>
                <strong>Amenities</strong>
                <ul className="property-agent__amenities">
                  {selectedProperty.amenities.length ? (
                    selectedProperty.amenities.map((amenity) => (
                      <li key={amenity}>{amenity}</li>
                    ))
                  ) : (
                    <li>No amenities listed.</li>
                  )}
                </ul>
              </div>
              <div className="property-agent__actions">
                <button type="button" className="bing-button bing-button--primary">
                  Send to renter
                </button>
                <button type="button" className="bing-button">
                  Request inspection
                </button>
                <button type="button" className="bing-button">
                  Start negotiation
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a property"
              description="Choose a listing from the left panel to review details."
            />
          )}
        </section>
        <section className="property-agent__context" aria-label="Matches">
          <h2>Matches & activity</h2>
          <p>
            Once Supabase matching tables are wired, renter intents, comparisons,
            and negotiation history will render in this space.
          </p>
        </section>
      </div>
    </div>
  );
}
