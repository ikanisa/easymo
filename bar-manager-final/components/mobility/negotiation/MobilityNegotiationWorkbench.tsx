"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CandidateCompare3, type CandidateSummary } from "@/components/mobility/negotiation/CandidateCompare3";
import { ManualMessageModal } from "@/components/mobility/negotiation/ManualMessageModal";
import { MapCard, type MapDriver, type MapLocation } from "@/components/mobility/negotiation/MapCard";
import { type CalendarEvent,MobilityCalendar } from "@/components/mobility/negotiation/MobilityCalendar";
import { type NegotiationMessage,NegotiationThread } from "@/components/mobility/negotiation/NegotiationThread";
import { type AgentSessionSummary, type RequestFilters,RequestTable } from "@/components/mobility/negotiation/RequestTable";
import { SLAClock } from "@/components/mobility/negotiation/SLAClock";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/lib/api/client";
import {
  AgentQuote,
  AgentSession,
  AgentSessionsQuery,
  getAgentSessionDetailKey,
  getAgentSessionsQueryKey,
  useAgentSessionDetailQuery,
  useAgentSessionsQuery,
} from "@/lib/queries/agentSessions";
import { useNearestDriversQuery } from "@/lib/queries/nearestDrivers";
import { getAdminApiPath } from "@/lib/routes/api";
import { cn } from "@/lib/utils";

interface CalendarConfig {
  enabled: boolean;
  description?: string;
  eventFactory?: (session: AgentSession) => CalendarEvent | null;
}

interface MobilityNegotiationWorkbenchProps {
  flowType: string;
  headerTitle: string;
  headerDescription: string;
  tableTitle: string;
  tableDescription?: string;
  calendar?: CalendarConfig;
  emptyState?: { title: string; description: string };
  sessionFilter?: (session: AgentSession) => boolean;
  manualMessageTemplate?: (context: {
    session: AgentSession;
    candidate?: CandidateSummary | null;
    pickupLabel?: string | null;
    passengerName?: string | null;
  }) => string;
  className?: string;
}

type GenericRecord = Record<string, unknown>;

function getNestedValue(data: GenericRecord | undefined, keys: Array<string | string[]>): unknown {
  if (!data) return undefined;
  for (const key of keys) {
    const parts = Array.isArray(key) ? key : key.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as GenericRecord)[part];
    }
    if (current !== undefined && current !== null) {
      return current;
    }
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number") return value.toString();
  return null;
}

function extractLocation(data: GenericRecord | undefined, prefixes: string[]): MapLocation | null {
  if (!data) return null;
  for (const prefix of prefixes) {
    const base = getNestedValue(data, [prefix]) as GenericRecord | undefined;
    if (base && typeof base === "object") {
      const latLngValue = base.latlng;
      const coordinatesValue = base.coordinates;
      const latLngArray = Array.isArray(latLngValue) ? latLngValue : undefined;
      const coordinatesArray = Array.isArray(coordinatesValue) ? coordinatesValue : undefined;
      const lat = toNumber(
        base.lat ?? base.latitude ?? latLngArray?.[0] ?? coordinatesArray?.[0],
      );
      const lng = toNumber(
        base.lng ?? base.longitude ?? latLngArray?.[1] ?? coordinatesArray?.[1],
      );
      if (lat != null && lng != null) {
        const label = toStringValue(base.label ?? base.address ?? base.display ?? base.name);
        return { lat, lng, label };
      }
    }
  }

  const lat = toNumber(getNestedValue(data, prefixes.map((prefix) => `${prefix}_lat`)) ?? getNestedValue(data, prefixes.map((prefix) => `${prefix}.lat`)));
  const lng = toNumber(getNestedValue(data, prefixes.map((prefix) => `${prefix}_lng`)) ?? getNestedValue(data, prefixes.map((prefix) => `${prefix}.lng`)));
  if (lat != null && lng != null) {
    const label = toStringValue(getNestedValue(data, prefixes.map((prefix) => `${prefix}_label`))) ?? null;
    return { lat, lng, label };
  }
  return null;
}

function extractPassengerName(data: GenericRecord | undefined): string | null {
  return (
    toStringValue(getNestedValue(data, ["passenger.name", "passenger_name", "contact.name", "customer.name"])) ??
    toStringValue(getNestedValue(data, ["user.name", "customer_name"])) ??
    null
  );
}

function extractPassengerPhone(data: GenericRecord | undefined): string | null {
  return (
    toStringValue(getNestedValue(data, ["passenger.phone", "passenger_phone", "contact.phone", "customer.phone", "user.phone"])) ??
    null
  );
}

function extractVehicleType(data: GenericRecord | undefined): string | null {
  return (
    toStringValue(getNestedValue(data, ["vehicle", "vehicle_type", "vehicleType", "ride.vehicle_type"])) ??
    null
  );
}

function extractRideId(session?: AgentSession | null): string | null {
  if (!session) return null;
  return (
    toStringValue(session.metadata?.ride_id) ??
    toStringValue(session.request_data?.ride_id) ??
    toStringValue(getNestedValue(session.request_data, ["ride.id"])) ??
    session.id
  );
}

function buildCandidateSummary(quote: AgentQuote): CandidateSummary {
  const offer = quote.offer_data ?? {};
  const price = toNumber(
    offer.price ?? offer.fare ?? offer.amount ?? offer.offer_price ?? offer.total ?? offer.total_price,
  );
  const eta = toNumber(
    offer.eta ?? offer.eta_minutes ?? offer.etaMinutes ?? offer.arrival_minutes ?? offer.response_time,
  );
  const currency = toStringValue(offer.currency ?? offer.price_currency ?? quote.metadata?.currency) ?? "RWF";
  const notes = toStringValue(offer.notes ?? offer.note ?? offer.message ?? quote.metadata?.notes ?? quote.metadata?.message);
  return {
    id: quote.id,
    name: quote.vendor_name ?? toStringValue(offer.driver_name) ?? toStringValue(offer.vendor_name) ?? null,
    price: price ?? null,
    currency,
    etaMinutes: eta ?? null,
    status: quote.status,
    score: quote.ranking_score ?? null,
    notes,
  };
}

function buildNegotiationMessages(session: AgentSession | undefined, quotes: AgentQuote[], manualMessages: NegotiationMessage[]): NegotiationMessage[] {
  const baseMessages: NegotiationMessage[] = [];
  if (session) {
    const passenger = extractPassengerName(session.request_data);
    const pickup = toStringValue(getNestedValue(session.request_data, ["pickup.label", "pickup_name", "pickup.address", "pickup_address", "pickup.display"])) ?? "Pickup pending";
    const dropoff = toStringValue(getNestedValue(session.request_data, ["dropoff.label", "dropoff_name", "dropoff.address", "dropoff_address", "dropoff.display"])) ?? "Drop-off TBD";
    baseMessages.push({
      id: `${session.id}-context`,
      author: "system",
      authorName: null,
      body: `Request for ${passenger ?? "anonymous rider"}. ${pickup} → ${dropoff}. Vehicle: ${extractVehicleType(session.request_data) ?? "any"}.`,
      timestamp: session.started_at,
    });
  }
  const quoteMessages = quotes.map((quote) => {
    const offer = quote.offer_data ?? {};
    const message =
      toStringValue(offer.message ?? offer.vendor_message ?? offer.driver_message ?? quote.metadata?.message) ??
      `Offered ${(offer.price ?? offer.fare ?? offer.amount) ?? "unknown"} ${offer.currency ?? ""}`;
    const price = toNumber(offer.price ?? offer.fare ?? offer.amount ?? offer.offer_price ?? offer.total ?? offer.total_price);
    return {
      id: quote.id,
      author: "vendor" as const,
      authorName: quote.vendor_name ?? toStringValue(offer.driver_name) ?? null,
      body: message,
      timestamp: quote.responded_at ?? quote.created_at,
      price: price ?? null,
      status: quote.status,
    } satisfies NegotiationMessage;
  });

  const combined = [...baseMessages, ...quoteMessages, ...manualMessages];
  return combined.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : Number.NEGATIVE_INFINITY;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : Number.NEGATIVE_INFINITY;
    return timeA - timeB;
  });
}

function defaultManualTemplate(context: {
  session: AgentSession;
  candidate?: CandidateSummary | null;
  pickupLabel?: string | null;
  passengerName?: string | null;
}): string {
  const passenger = context.passengerName ?? "there";
  const pickup = context.pickupLabel ?? "the last shared location";
  const vehicle = extractVehicleType(context.session.request_data) ?? "ride";
  const priceSuggestion = context.candidate?.price ? ` Current best offer is ${context.candidate.price} ${context.candidate.currency ?? "RWF"}.` : "";
  return `Hi ${passenger}, checking in on your ${vehicle} request near ${pickup}.${priceSuggestion} Reply 1 to confirm or let us know if plans changed.`;
}

export function MobilityNegotiationWorkbench({
  flowType,
  headerTitle,
  headerDescription,
  tableTitle,
  tableDescription,
  calendar,
  emptyState,
  sessionFilter,
  manualMessageTemplate = defaultManualTemplate,
  className,
}: MobilityNegotiationWorkbenchProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [filters, setFilters] = useState<RequestFilters>({ search: "", status: "searching", vehicle: "all", horizon: "all" });

  const sessionQueryParams: AgentSessionsQuery = useMemo(() => ({
    flowType,
    status: filters.status !== "all" ? filters.status : undefined,
    limit: 50,
    offset: 0,
  }), [filters.status, flowType]);

  const sessionsQuery = useAgentSessionsQuery(sessionQueryParams);
  const sessionsData = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const filteredSessions = useMemo(() => {
    const list = sessionFilter ? sessionsData.filter(sessionFilter) : sessionsData;
    const searchQuery = filters.search.trim().toLowerCase();
    if (!searchQuery && filters.vehicle === "all" && filters.horizon === "all") {
      return list;
    }
    return list.filter((session) => {
      const request = session.request_data ?? {};
      if (filters.vehicle !== "all") {
        const vehicle = extractVehicleType(request)?.toLowerCase();
        if (!vehicle || !vehicle.includes(filters.vehicle.toLowerCase())) return false;
      }
      if (filters.horizon === "breaching") {
        const deadline = new Date(session.deadline_at).getTime();
        if (!Number.isFinite(deadline) || deadline - Date.now() > 120_000) {
          return false;
        }
      }
      if (!searchQuery) return true;
      const passenger = extractPassengerName(request) ?? "";
      const pickup = toStringValue(getNestedValue(request, ["pickup.label", "pickup_name", "pickup.address", "pickup_address", "pickup.display"])) ?? "";
      const dropoff = toStringValue(getNestedValue(request, ["dropoff.label", "dropoff_name", "dropoff.address", "dropoff_address", "dropoff.display"])) ?? "";
      const haystack = `${session.id} ${passenger} ${pickup} ${dropoff}`.toLowerCase();
      return haystack.includes(searchQuery);
    });
  }, [filters.horizon, filters.search, filters.vehicle, sessionFilter, sessionsData]);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (filteredSessions.length === 0) {
      setSelectedSessionId(null);
      return;
    }
    if (!selectedSessionId || !filteredSessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(filteredSessions[0].id);
    }
  }, [filteredSessions, selectedSessionId]);

  const sessionSummaries: AgentSessionSummary[] = useMemo(() => (
    filteredSessions.map((session) => ({
      id: session.id,
      agentType: session.agent_type,
      flowType: session.flow_type,
      status: session.status,
      startedAt: session.started_at,
      deadlineAt: session.deadline_at,
      extensionsCount: session.extensions_count ?? 0,
      requestData: session.request_data ?? {},
      quotesCount: session.quotes_count ?? 0,
    }))
  ), [filteredSessions]);

  const detailQuery = useAgentSessionDetailQuery(selectedSessionId);
  const selectedSession = detailQuery.data?.session;
  const quotes = useMemo(() => detailQuery.data?.quotes ?? [], [detailQuery.data?.quotes]);

  const [manualMessages, setManualMessages] = useState<NegotiationMessage[]>([]);

  useEffect(() => {
    setManualMessages([]);
  }, [selectedSessionId]);

  const candidateSummaries = useMemo(() => quotes.map(buildCandidateSummary), [quotes]);

  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateSummaries.length) {
      setSelectedCandidateId(null);
      return;
    }
    if (!selectedCandidateId || !candidateSummaries.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(candidateSummaries[0].id);
    }
  }, [candidateSummaries, selectedCandidateId]);

  const selectedCandidate = candidateSummaries.find((candidate) => candidate.id === selectedCandidateId) ?? null;

  const pickupLocation = useMemo(() => extractLocation(selectedSession?.request_data, ["pickup", "origin", "start"]), [selectedSession?.request_data]);
  const dropoffLocation = useMemo(() => extractLocation(selectedSession?.request_data, ["dropoff", "destination", "end"]), [selectedSession?.request_data]);

  const nearestDriversParams = useMemo(() => {
    if (!selectedSession || !pickupLocation) return null;
    return {
      rideId: extractRideId(selectedSession) ?? undefined,
      pickup: { lat: pickupLocation.lat, lng: pickupLocation.lng },
      vehicleType: extractVehicleType(selectedSession.request_data) ?? undefined,
      limit: 6,
    };
  }, [pickupLocation, selectedSession]);

  const nearestDriversQuery = useNearestDriversQuery(nearestDriversParams);

  const mapDrivers: MapDriver[] = useMemo(() => (
    nearestDriversQuery.data?.drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      lat: driver.lat ?? null,
      lng: driver.lng ?? null,
      distanceKm: driver.distanceKm ?? null,
      etaMinutes: driver.etaMinutes ?? null,
    })) ?? []
  ), [nearestDriversQuery.data?.drivers]);

  const manualRecipients = useMemo(() => {
    const fromQuotes = quotes
      .map((quote) => (
        toStringValue(quote.vendor_id) ??
        toStringValue(quote.offer_data?.driver_id) ??
        toStringValue(quote.offer_data?.vendor_id) ??
        null
      ))
      .filter((value): value is string => Boolean(value));
    const fromNearest = nearestDriversQuery.data?.drivers
      .map((driver) => toStringValue(driver.driver_id ?? driver.raw?.driver_id ?? driver.raw?.wa_id ?? driver.id) ?? null)
      .filter((value): value is string => Boolean(value)) ?? [];
    const unique = new Set<string>([...fromQuotes, ...fromNearest]);
    return Array.from(unique);
  }, [nearestDriversQuery.data?.drivers, quotes]);

  const passengerName = useMemo(() => extractPassengerName(selectedSession?.request_data), [selectedSession?.request_data]);
  const passengerPhone = useMemo(() => extractPassengerPhone(selectedSession?.request_data), [selectedSession?.request_data]);
  const pickupLabel = pickupLocation?.label ?? toStringValue(getNestedValue(selectedSession?.request_data ?? {}, ["pickup.label", "pickup_name", "pickup.address", "pickup_address", "pickup.display"])) ?? null;

  const negotiationMessages = useMemo(
    () => buildNegotiationMessages(selectedSession, quotes, manualMessages),
    [manualMessages, quotes, selectedSession],
  );

  const calendarEvents = useMemo(() => {
    if (!calendar?.enabled) return [] as CalendarEvent[];
    const factory = calendar.eventFactory ?? ((session: AgentSession) => {
      const label = extractPassengerName(session.request_data) ?? "Passenger";
      const scheduled = toStringValue(getNestedValue(session.request_data ?? {}, ["scheduled_at", "schedule.time"])) ?? session.deadline_at;
      if (!scheduled) return null;
      const meta = toStringValue(getNestedValue(session.request_data ?? {}, ["pickup.label", "pickup_name", "pickup.address"])) ?? undefined;
      return {
        id: session.id,
        title: label,
        scheduledAt: scheduled,
        status: session.status,
        meta: meta ?? null,
      };
    });
    return filteredSessions
      .map((session) => factory(session))
      .filter((event): event is CalendarEvent => Boolean(event));
  }, [calendar?.enabled, calendar?.eventFactory, filteredSessions]);

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) throw new Error("no_session_selected");
      if (!selectedCandidateId) throw new Error("no_candidate_selected");
      const path = getAdminApiPath("agent-orchestration", "sessions", selectedSessionId);
      await apiFetch(path, {
        method: "PATCH",
        body: {
          status: "completed",
          selected_quote_id: selectedCandidateId,
        },
      });
    },
    onSuccess: async () => {
      pushToast("Approved negotiation and marked session completed", "success");
      await queryClient.invalidateQueries({ queryKey: getAgentSessionsQueryKey(sessionQueryParams) });
      await queryClient.invalidateQueries({ queryKey: getAgentSessionDetailKey(selectedSessionId ?? undefined) });
    },
    onError: (error: unknown) => {
      console.error("approve_failed", error);
      pushToast("Failed to approve negotiation", "error");
    },
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSessionId) throw new Error("no_session_selected");
      const path = getAdminApiPath("agent-orchestration", "sessions", selectedSessionId);
      await apiFetch(path, {
        method: "PATCH",
        body: { extend_deadline: true },
      });
    },
    onSuccess: async () => {
      pushToast("Extended SLA by 2 minutes", "success");
      await queryClient.invalidateQueries({ queryKey: getAgentSessionsQueryKey(sessionQueryParams) });
      await queryClient.invalidateQueries({ queryKey: getAgentSessionDetailKey(selectedSessionId ?? undefined) });
    },
    onError: (error: unknown) => {
      console.error("extend_failed", error);
      pushToast("Failed to extend SLA", "error");
    },
  });

  const manualMessageMutation = useMutation({
    mutationFn: async ({ message, delaySeconds }: { message: string; delaySeconds?: number }) => {
      if (!selectedSessionId) throw new Error("no_session_selected");
      const rideId = extractRideId(selectedSession ?? (sessionsData.find((session) => session.id === selectedSessionId) as AgentSession | undefined)) ?? selectedSessionId;
      await apiFetch(getAdminApiPath("mobility", "ping_drivers"), {
        method: "POST",
        body: {
          ride_id: rideId,
          driver_ids: manualRecipients,
          text: message,
          delaySeconds,
        },
      });
      const manualMessage: NegotiationMessage = {
        id: `${selectedSessionId}-manual-${Date.now()}`,
        author: "manual",
        authorName: "Operator",
        body: message,
        timestamp: new Date().toISOString(),
      };
      setManualMessages((prev) => [...prev, manualMessage]);
    },
    onSuccess: () => {
      pushToast("Manual message queued", "success");
    },
    onError: (error: unknown) => {
      console.error("manual_message_failed", error);
      pushToast("Failed to queue manual message", "error");
    },
  });

  const [manualModalOpen, setManualModalOpen] = useState(false);

  const openManualModal = useCallback(() => {
    if (!manualRecipients.length) {
      pushToast("No driver recipients available yet", "info");
      return;
    }
    setManualModalOpen(true);
  }, [manualRecipients.length, pushToast]);

  const closeManualModal = useCallback(() => setManualModalOpen(false), []);

  const handleManualSubmit = useCallback(
    async ({ message, delaySeconds }: { message: string; delaySeconds?: number }) => {
      await manualMessageMutation.mutateAsync({ message, delaySeconds });
      setManualModalOpen(false);
    },
    [manualMessageMutation],
  );

  const handleApprove = useCallback(() => {
    if (!selectedCandidateId) {
      pushToast("Select a candidate before approving", "info");
      return;
    }
    approveMutation.mutate();
  }, [approveMutation, pushToast, selectedCandidateId]);

  const handleExtend = useCallback(() => {
    extendMutation.mutate();
  }, [extendMutation]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.altKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "a") {
        event.preventDefault();
        handleApprove();
      } else if (key === "e") {
        event.preventDefault();
        handleExtend();
      } else if (key === "m") {
        event.preventDefault();
        openManualModal();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleApprove, handleExtend, openManualModal]);

  const defaultManual = selectedSession
    ? manualMessageTemplate({
        session: selectedSession,
        candidate: selectedCandidate,
        pickupLabel,
        passengerName,
      })
    : "";

  const requestTableError = sessionsQuery.error ? (sessionsQuery.error as Error).message : null;
  const nearestError = nearestDriversQuery.error ? (nearestDriversQuery.error as Error).message : null;

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">{headerTitle}</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{headerDescription}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleExtend} disabled={extendMutation.isPending}>
            {extendMutation.isPending ? "Extending…" : "Extend SLA (E)"}
          </Button>
          <Button variant="outline" size="sm" onClick={openManualModal} disabled={manualMessageMutation.isPending}>
            Manual message (M)
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={approveMutation.isPending || !selectedCandidateId}>
            {approveMutation.isPending ? "Approving…" : "Approve and book (A)"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <RequestTable
          title={tableTitle}
          description={tableDescription}
          sessions={sessionSummaries}
          filters={filters}
          onFiltersChange={setFilters}
          isLoading={sessionsQuery.isLoading}
          error={requestTableError}
          onSelect={setSelectedSessionId}
          selectedSessionId={selectedSessionId}
          onRefresh={() => sessionsQuery.refetch()}
        />

        <div className="space-y-6">
          <SLAClock
            status={selectedSession?.status}
            startedAt={selectedSession?.started_at}
            deadlineAt={selectedSession?.deadline_at}
          />

          {calendar?.enabled ? (
            <MobilityCalendar
              events={calendarEvents}
              selectedId={selectedSessionId}
              onSelect={(id) => setSelectedSessionId(id)}
              isLoading={sessionsQuery.isLoading}
              description={calendar.description}
            />
          ) : null}

          <MapCard
            pickup={pickupLocation ?? undefined}
            dropoff={dropoffLocation ?? undefined}
            drivers={mapDrivers}
            isLoading={nearestDriversQuery.isLoading}
            error={nearestError}
          />

          <CandidateCompare3
            candidates={candidateSummaries}
            selectedId={selectedCandidateId}
            onSelect={setSelectedCandidateId}
            isLoading={detailQuery.isLoading}
          />

          <NegotiationThread
            messages={negotiationMessages}
            isLoading={detailQuery.isLoading && !detailQuery.data}
            emptyTitle={emptyState?.title}
            emptyDescription={emptyState?.description}
          />

          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">Passenger context</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {passengerName ?? "Unknown passenger"} · {passengerPhone ?? "No phone"}
                </p>
              </div>
              <Button asChild variant="ghost" size="sm" className="px-0 text-[color:var(--color-accent)] underline-offset-4 hover:underline">
                <Link href="/agents/conversations">Open conversation history</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ManualMessageModal
        isOpen={manualModalOpen}
        onClose={closeManualModal}
        onSubmit={handleManualSubmit}
        isSubmitting={manualMessageMutation.isPending}
        defaultMessage={defaultManual}
        recipients={manualRecipients}
      />
    </div>
  );
}
