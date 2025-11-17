"use client";

import { GeoHeatmapWidget } from "@easymo/ui/widgets/GeoHeatmapWidget";
import { SectionCard } from "@/components/ui/SectionCard";

export function PropertyDemandHeatmap() {
  return (
    <SectionCard
      title="Demand clusters"
      description="Micro-market coverage derived from WhatsApp intents & shortlist density."
    >
      <GeoHeatmapWidget zones={[]} />
    </SectionCard>
  );
}
