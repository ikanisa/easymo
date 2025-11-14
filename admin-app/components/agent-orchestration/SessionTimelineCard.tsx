"use client";

import { SessionTimelineWidget } from "@easymo/ui/widgets/SessionTimelineWidget";
import { SectionCard } from "@/components/ui/SectionCard";
import { mockAgentSessionTimeline } from "@/lib/mock-data";

export function SessionTimelineCard() {
  return (
    <SectionCard
      title="Session timeline"
      description="Recently orchestrated property_rental session with status ticks shared from flow-exchange."
    >
      <SessionTimelineWidget events={mockAgentSessionTimeline} />
    </SectionCard>
  );
}
