"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlaceWidget } from "@easymo/ui";
import { fetchVenueSpotlight, type VenueSpotlight } from "@/lib/venues/spotlight";

export function FeaturedVenueWidget() {
  const [spotlight, setSpotlight] = useState<VenueSpotlight | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchVenueSpotlight()
      .then(({ venue, isSample: sample }) => {
        if (!active) return;
        setSpotlight(venue);
        setIsSample(sample);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setSpotlight(null);
        setIsSample(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mt-6 rounded-3xl border border-emerald-100 bg-white/80 p-6 text-sm text-emerald-700">
        Loading venue spotlight…
      </div>
    );
  }

  if (!spotlight) {
    return (
      <div className="mt-6 rounded-3xl border border-rose-100 bg-white/80 p-6 text-sm text-rose-700">
        {error ?? "No venue spotlight available yet."}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <PlaceWidget
        name={spotlight.name}
        location={spotlight.location}
        rating={spotlight.rating}
        reviewCount={spotlight.reviewCount}
        statusLabel={spotlight.status}
        priceRange={spotlight.priceRange}
        etaLabel={spotlight.etaLabel}
        photoUrl={spotlight.photoUrl ?? undefined}
        badges={spotlight.badges}
        highlights={[
          { label: "Top dish", value: spotlight.topDish },
          { label: "Live tables", value: spotlight.liveTables },
          { label: "Agent sessions", value: spotlight.sessionsToday },
        ]}
        cta={
          <Link
            href="/chat"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-emerald-600"
          >
            Chat with host →
          </Link>
        }
        footer={
          isSample
            ? "Sample telemetry — connect Supabase venue_spotlights for live data."
            : "Widget powered by Waiter AI venue telemetry."
        }
      />
    </div>
  );
}
