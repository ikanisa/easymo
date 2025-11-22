"use client";

import { PlaceWidget } from "@easymo/ui";
import { useEffect, useState } from "react";

import type { FeaturedProperty } from "@/lib/properties/mock-data";
import { fetchFeaturedProperties } from "@/lib/properties/service";

export function FeaturedProperties() {
  const [properties, setProperties] = useState<FeaturedProperty[]>([]);
  const [isSample, setIsSample] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchFeaturedProperties()
      .then(({ properties: list, isSample: sample }) => {
        if (!active) return;
        setProperties(list);
        setIsSample(sample);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setProperties([]);
        setIsSample(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-4" aria-label="Featured rentals">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Shortlist-ready</p>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-semibold text-slate-900">Curated rentals</h2>
          {isSample && !loading && (
            <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700">
              Sample data
            </span>
          )}
        </div>
        <p className="text-sm text-slate-600">
          Properties with verified media, pricing guidance, and AI-powered demand scores.
        </p>
      </div>
      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600">
          Loading featured properties…
        </div>
      ) : properties.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {properties.map((property) => (
            <PlaceWidget
              key={property.id}
              name={property.name}
              location={property.location}
              priceRange={property.priceRange}
              rating={property.rating}
              reviewCount={property.reviews}
              statusLabel={property.status}
              etaLabel={property.etaLabel}
              photoUrl={property.photoUrl}
              badges={property.badges}
              highlights={property.highlights}
              footer="Synced from Supabase listings + WhatsApp shortlist telemetry."
            />
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600">
          {error ? `Unable to load properties: ${error}` : "No featured properties available yet."}
        </div>
      )}
    </section>
  );
}
