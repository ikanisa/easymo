"use client";

import { MobilityNegotiationWorkbench } from "@/components/mobility/negotiation/MobilityNegotiationWorkbench";
import type { AgentSession } from "@/lib/queries/agentSessions";
import type { CandidateSummary } from "@/components/mobility/negotiation/CandidateCompare3";

function scheduleCalendarEvent(session: AgentSession) {
  const request = (session.request_data ?? {}) as Record<string, any>;
  const scheduled = (request.scheduled_at ?? request.schedule?.time ?? session.metadata?.scheduled_at ?? session.deadline_at) as string;
  if (!scheduled) return null;
  const passenger = (request.passenger?.name ?? request.passenger_name ?? request.contact?.name ?? "Passenger") as string;
  const pickup = (request.pickup?.label ?? request.pickup_name ?? request.pickup?.address ?? null) as string | null;
  const vehicle = (request.vehicle_type ?? request.vehicle ?? "") as string;
  const metaParts = [pickup, vehicle].filter(Boolean);
  return {
    id: session.id,
    title: passenger,
    scheduledAt: scheduled,
    status: session.status,
    meta: metaParts.length ? metaParts.join(" • ") : null,
  };
}

function formatScheduleTime(iso: string | null | undefined) {
  if (!iso) return "the scheduled time";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "the scheduled time";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function scheduleManualTemplate({
  session,
  candidate,
  pickupLabel,
  passengerName,
}: {
  session: AgentSession;
  candidate?: CandidateSummary | null;
  pickupLabel?: string | null;
  passengerName?: string | null;
}) {
  const request = (session.request_data ?? {}) as Record<string, any>;
  const scheduled = (request.scheduled_at ?? request.schedule?.time ?? session.metadata?.scheduled_at ?? session.deadline_at) as string;
  const windowLabel = formatScheduleTime(scheduled);
  const passenger = passengerName ?? "there";
  const pickup = pickupLabel ?? "the planned pickup";
  const driver = candidate?.name ? ` Driver ${candidate.name} will standby.` : "";
  return `Hello ${passenger}, confirming your scheduled trip at ${windowLabel} from ${pickup}.${driver} Reply 1 to confirm, 2 to adjust.`;
}

export default function ScheduleTripPage() {
  return (
    <MobilityNegotiationWorkbench
      flowType="scheduled_trip"
      headerTitle="Schedule trip"
      headerDescription="Track scheduled rides, ensure drivers reconfirm, and intervene before calendar commitments slip."
      tableTitle="Upcoming scheduled trips"
      tableDescription="Use filters to focus on breaches, specific vehicles, or passengers that need a manual confirmation."
      calendar={{
        enabled: true,
        description: "Calendar view of all upcoming scheduled trips with their pickup windows.",
        eventFactory: scheduleCalendarEvent,
      }}
      manualMessageTemplate={scheduleManualTemplate}
      emptyState={{
        title: "No scheduled trips",
        description: "Queue is empty. Direct agents to Conversations to slot new future rides.",
      }}
    />
  );
}
