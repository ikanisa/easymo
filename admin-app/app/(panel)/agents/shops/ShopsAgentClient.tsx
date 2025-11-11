"use client";

import { useMemo, useState } from "react";
import { useShopsQuery } from "@/lib/queries/shops";
import { PageHeader } from "@/components/layout/PageHeader";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";

export function ShopsAgentClient() {
  const query = useShopsQuery();
  const shops = useMemo(() => query.data?.shops ?? [], [query.data?.shops]);
  const integration = query.data?.integration;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedShop = useMemo(
    () => shops.find((shop) => shop.id === selectedId) ?? null,
    [shops, selectedId],
  );

  if (query.isLoading) {
    return (
      <LoadingState
        title="Loading shops"
        description="Fetching verified shops and availability."
      />
    );
  }

  return (
    <div className="shops-agent-page">
      <PageHeader
        title="Nearby Shops"
        description="Source products from verified shops, compare availability, and escalate manual sourcing requests."
      />
      {integration?.status === "degraded" && (
        <div className="bing-alert" role="status">
          <p className="bing-alert__title">Shops data is running in fallback.</p>
          {integration.message && <p>{integration.message}</p>}
        </div>
      )}
      <div className="shops-agent">
        <section className="shops-agent__list" aria-label="Shop directory">
          {shops.length ? (
            shops.map((shop) => (
              <button
                key={shop.id}
                type="button"
                className={
                  "shops-agent__card" +
                  (selectedId === shop.id ? " shops-agent__card--active" : "")
                }
                onClick={() => setSelectedId(shop.id)}
              >
                <div>
                  <p className="shops-agent__name">{shop.name}</p>
                  <p className="shops-agent__meta">
                    {shop.location ?? "Location unknown"}
                  </p>
                </div>
                <div className="shops-agent__badges">
                  {shop.verified && <span className="bing-chip">Verified</span>}
                  {shop.rating && (
                    <span className="bing-chip">{shop.rating.toFixed(1)} ★</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <EmptyState
              title="No shops found"
              description="Once shops are onboarded they will appear here."
            />
          )}
        </section>
        <section className="shops-agent__detail" aria-label="Shop detail">
          {selectedShop ? (
            <>
              <header>
                <h2>{selectedShop.name}</h2>
                <p>{selectedShop.location ?? "Location unknown"}</p>
              </header>
              <div className="shops-agent__detail-grid">
                <div>
                  <dt>Status</dt>
                  <dd>{selectedShop.status}</dd>
                </div>
                <div>
                  <dt>Categories</dt>
                  <dd>
                    {selectedShop.categories.length
                      ? selectedShop.categories.join(", ")
                      : "Uncategorized"}
                  </dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{selectedShop.phone ?? "N/A"}</dd>
                </div>
                <div>
                  <dt>Delivery ETA</dt>
                  <dd>
                    {typeof selectedShop.deliveryEta === "number"
                      ? `${selectedShop.deliveryEta} min`
                      : "—"}
                  </dd>
                </div>
              </div>
              <div className="shops-agent__actions">
                <button className="bing-button bing-button--primary">
                  Request stock update
                </button>
                <button className="bing-button">
                  Start sourcing chat
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Select a shop"
              description="Choose a shop from the list to view details."
            />
          )}
        </section>
        <section className="shops-agent__context" aria-label="Activity">
          <h2>Activity feed</h2>
          <p>
            Recent sourcing actions and price updates for the selected shop will
            appear here. Connect to the sourcing activity stream to populate this
            section.
          </p>
        </section>
      </div>
    </div>
  );
}
