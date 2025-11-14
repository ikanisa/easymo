"use client";

import { GeoHeatmapWidget } from "@easymo/ui";
import { SectionCard } from "@/components/ui/SectionCard";
import { mockPropertyDemandZones } from "@/lib/mock-data";

export function PropertyDemandHeatmap() {
  return (
    <SectionCard
      title="Demand clusters"
      description="Micro-market coverage derived from WhatsApp intents & shortlist density."
    >
      <GeoHeatmapWidget zones={mockPropertyDemandZones} />
    </SectionCard>
  );
}
