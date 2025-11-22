"use client";

import { SessionTimelineWidget } from "@easymo/ui/widgets/SessionTimelineWidget";

import { SectionCard } from "@/components/ui/SectionCard";

export function SessionTimelineCard() {
  return (
    <SectionCard
      title="Session timeline"
      description="Recently orchestrated property_rental session with status ticks shared from flow-exchange."
    >
      <SessionTimelineWidget events={[]} />
    </SectionCard>
  );
}
