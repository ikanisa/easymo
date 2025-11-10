"use client";

import { MobilityNegotiationWorkbench } from "@/components/mobility/negotiation/MobilityNegotiationWorkbench";

export default function NearbyDriversPage() {
  return (
    <MobilityNegotiationWorkbench
      flowType="nearby_drivers"
      headerTitle="Nearby drivers"
      headerDescription="Blend Supabase geo queries with Atlas-inspired negotiation tooling to lock in the best driver before the SLA breaches."
      tableTitle="Driver negotiation queue"
      tableDescription="Filter by vehicle class, SLA window, or passenger search to find the rides that need human override."
      emptyState={{
        title: "No active driver negotiations",
        description: "Queues are quiet for now—open live conversations to seed fresh demand or monitor automation in the meantime.",
      }}
    />
  );
}
