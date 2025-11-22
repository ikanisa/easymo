"use client";

import { PlaceWidget } from "@easymo/ui/widgets/PlaceWidget";

import { SectionCard } from "@/components/ui/SectionCard";

interface PropertyHighlight {
  id: string;
  name: string;
  location: string;
  rating: number;
  reviews: number;
  priceRange: string;
  eta: string;
  status: string;
  hero: string;
  badges: string[];
  highlights: Array<{ label: string; value: string }>;
}

export function PropertyHighlights() {
  const properties: PropertyHighlight[] = [];

  return (
    <SectionCard
      title="Featured properties"
      description="Surface verified rentals the agent can pitch immediately, inspired by Google Places cards."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {properties.map((property) => (
          <PlaceWidget
            key={property.id}
            name={property.name}
            location={property.location}
            rating={property.rating}
            reviewCount={property.reviews}
            statusLabel={property.status}
            priceRange={property.priceRange}
            etaLabel={property.eta}
            photoUrl={property.hero}
            badges={property.badges.map((label) => ({ label }))}
            highlights={property.highlights}
            footer="Synced from Supabase listings and shortlist engagement."
          />
        ))}
        {!properties.length && (
          <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-4 text-sm text-[color:var(--color-muted)]">
            No featured properties.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
