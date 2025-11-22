"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

export interface RequestFilters {
  search: string;
  status: "all" | "searching" | "negotiating" | "completed" | "timeout" | "cancelled";
  vehicle: "all" | string;
  horizon: "all" | "breaching";
}

export interface AgentSessionSummary {
  id: string;
  agentType?: string | null;
  flowType?: string | null;
  status: string;
  startedAt: string;
  deadlineAt: string;
  extensionsCount?: number;
  requestData: Record<string, unknown>;
  quotesCount?: number;
}

interface RequestTableProps {
  title: string;
  description?: string;
  sessions: AgentSessionSummary[];
  filters: RequestFilters;
  isLoading?: boolean;
  error?: string | null;
  onFiltersChange: (filters: RequestFilters) => void;
  onSelect: (sessionId: string) => void;
  selectedSessionId?: string | null;
  onRefresh?: () => void;
}

function extractRequestValue(
  data: Record<string, unknown>,
  keys: Array<string | string[]>,
): string | null {
  for (const key of keys) {
    const parts = Array.isArray(key) ? key : key.split(".");
    let current: unknown = data;
    for (const part of parts) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (typeof current === "string" && current.trim().length > 0) {
      return current.trim();
    }
    if (typeof current === "number") {
      return current.toString();
    }
  }
  return null;
}

function formatTimeRemaining(deadlineAt: string) {
  const deadline = new Date(deadlineAt).getTime();
  if (Number.isNaN(deadline)) return "–";
  const diffMs = deadline - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / 60000);
  const seconds = Math.floor((abs % 60000) / 1000);
  const formatted = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return diffMs >= 0 ? formatted : `-${formatted}`;
}

export function RequestTable({
  title,
  description,
  sessions,
  filters,
  isLoading,
  error,
  onFiltersChange,
  onSelect,
  selectedSessionId,
  onRefresh,
}: RequestTableProps) {
  const filteredSessions = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return sessions.filter((session) => {
      if (filters.status !== "all" && session.status !== filters.status) {
        return false;
      }
      if (filters.horizon === "breaching") {
        const deadline = new Date(session.deadlineAt).getTime();
        if (!Number.isFinite(deadline) || deadline - Date.now() > 120_000) {
          return false;
        }
      }
      if (filters.vehicle !== "all") {
        const vehicle = extractRequestValue(session.requestData, [
          "vehicle",
          "vehicle_type",
          "vehicleType",
          ["ride", "vehicle_type"],
        ])?.toLowerCase();
        if (!vehicle || !vehicle.includes(filters.vehicle.toLowerCase())) {
          return false;
        }
      }
      if (!query) return true;
      const haystack = [
        session.id,
        extractRequestValue(session.requestData, ["passenger.name", "passenger_name", "contact.name"]),
        extractRequestValue(session.requestData, ["pickup.label", "pickup_name", "pickup_address", "pickup.display"]),
        extractRequestValue(session.requestData, ["dropoff.label", "dropoff_name", "dropoff_address", "dropoff.display"]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [filters, sessions]);

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            {title}
          </CardTitle>
          <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
            {description ?? "Monitor live agent queues and pick the most promising negotiations before SLA breaches."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder="Search passenger, pickup, ride ID"
            className="w-full min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
          />
          <select
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as RequestFilters["status"] })}
            className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All statuses</option>
            <option value="searching">Searching</option>
            <option value="negotiating">Negotiating</option>
            <option value="completed">Completed</option>
            <option value="timeout">Timed out</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filters.vehicle}
            onChange={(event) => onFiltersChange({ ...filters, vehicle: event.target.value })}
            className="min-w-[140px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All vehicles</option>
            <option value="moto">Moto</option>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="van">Van</option>
          </select>
          <select
            value={filters.horizon}
            onChange={(event) => onFiltersChange({ ...filters, horizon: event.target.value as RequestFilters["horizon"] })}
            className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All SLA windows</option>
            <option value="breaching">Breaching &lt; 2 min</option>
          </select>
        </div>

        {isLoading ? (
          <LoadingState title="Loading negotiation queue" description="Fetching agent sessions and quotes." />
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">Unable to load requests.</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <EmptyState
            title="No active negotiations"
            description="Queues are quiet right now. Hop into live conversations to seed more demand."
            action={(
              <Button
                asChild
                variant="ghost"
                className="px-0 text-slate-900 underline-offset-4 hover:underline dark:text-slate-100"
              >
                <Link href="/agents/conversations">Open Conversations</Link>
              </Button>
            )}
          />
        ) : (
          <div className="-mx-3 overflow-hidden rounded-xl border border-slate-200 shadow-sm dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-3">Passenger</th>
                  <th scope="col" className="px-3 py-3">Route</th>
                  <th scope="col" className="px-3 py-3">Vehicle</th>
                  <th scope="col" className="px-3 py-3">Status</th>
                  <th scope="col" className="px-3 py-3 text-right">Quotes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                {filteredSessions.map((session) => {
                  const passenger = extractRequestValue(session.requestData, [
                    "passenger.name",
                    "passenger_name",
                    "contact.name",
                    "customer.name",
                  ]) ?? "Unknown";
                  const phone = extractRequestValue(session.requestData, [
                    "passenger.phone",
                    "passenger_phone",
                    "contact.phone",
                    "customer.phone",
                  ]);
                  const pickup = extractRequestValue(session.requestData, [
                    "pickup.label",
                    "pickup_name",
                    "pickup.address",
                    "pickup_address",
                    "pickup.display",
                  ]) ?? "Pickup pending";
                  const dropoff = extractRequestValue(session.requestData, [
                    "dropoff.label",
                    "dropoff_name",
                    "dropoff.address",
                    "dropoff_address",
                    "dropoff.display",
                  ]) ?? "Drop-off TBD";
                  const vehicle = extractRequestValue(session.requestData, [
                    "vehicle",
                    "vehicle_type",
                    "vehicleType",
                    ["ride", "vehicle_type"],
                  ]) ?? "Any";
                  const timeRemaining = formatTimeRemaining(session.deadlineAt);
                  const deadline = new Date(session.deadlineAt).getTime();
                  const isLate = Number.isFinite(deadline) && deadline < Date.now();
                  const quotesLabel = session.quotesCount ?? 0;
                  return (
                    <tr
                      key={session.id}
                      onClick={() => onSelect(session.id)}
                      className={cn(
                        "cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-900/60",
                        selectedSessionId === session.id ? "bg-slate-50 dark:bg-slate-900/80" : undefined,
                      )}
                    >
                      <td className="px-3 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{passenger}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {phone ?? "No phone"}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm text-slate-700 dark:text-slate-200">{pickup}</div>
                        <div className="text-xs text-slate-400">→ {dropoff}</div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="slate" className="capitalize">
                          {vehicle}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              session.status === "negotiating"
                                ? "blue"
                                : session.status === "completed"
                                  ? "green"
                                  : session.status === "timeout" || session.status === "cancelled"
                                    ? "red"
                                    : "slate"
                            }
                            className="capitalize"
                          >
                            {session.status.replace(/_/g, " ")}
                          </Badge>
                          <span className={cn(
                            "text-xs font-mono",
                            isLate ? "text-red-600" : "text-slate-500",
                          )}
                          >
                            {timeRemaining}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-700 dark:text-slate-100">
                        {quotesLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
