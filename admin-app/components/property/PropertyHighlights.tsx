"use client";

import { PlaceWidget } from "@easymo/ui/widgets/PlaceWidget";
import { SectionCard } from "@/components/ui/SectionCard";
import { mockPropertyHighlights } from "@/lib/mock-data";

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
  const properties = mockPropertyHighlights as PropertyHighlight[];

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
      </div>
    </SectionCard>
  );
}
