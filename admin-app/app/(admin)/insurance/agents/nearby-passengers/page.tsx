"use client";

import { MobilityNegotiationWorkbench } from "@/components/mobility/negotiation/MobilityNegotiationWorkbench";
import type { AgentSession } from "@/lib/queries/agentSessions";

function passengerCalendarEvent(session: AgentSession) {
  const request = (session.request_data ?? {}) as Record<string, any>;
  const scheduled = (request.scheduled_at ?? request.schedule?.time ?? request.intent?.scheduled_at ?? session.deadline_at) as string;
  if (!scheduled) return null;
  const passenger = (request.passenger?.name ?? request.passenger_name ?? request.contact?.name ?? "Passenger") as string;
  const pickup = (request.pickup?.label ?? request.pickup_name ?? request.pickup?.address ?? null) as string | null;
  return {
    id: session.id,
    title: passenger,
    scheduledAt: scheduled,
    status: session.status,
    meta: pickup,
  };
}

export default function NearbyPassengersPage() {
  return (
    <MobilityNegotiationWorkbench
      flowType="nearby_drivers"
      headerTitle="Nearby passengers"
      headerDescription="Route live passenger leads to the right driver pods. Track intent quality, SLA health, and human override history without leaving the dispatch console."
      tableTitle="Passenger requests"
      tableDescription="Scan inbound riders searching for vehicles near your fleet. Prioritise breaches, high-value accounts, or manual overrides."
      calendar={{
        enabled: true,
        description: "Upcoming rider follow-ups and scheduled pickups synced from agent sessions.",
        eventFactory: passengerCalendarEvent,
      }}
      emptyState={{
        title: "No passenger leads in queue",
        description: "Leverage Conversations or proactive campaigns to capture fresh rider demand.",
      }}
    />
  );
}
