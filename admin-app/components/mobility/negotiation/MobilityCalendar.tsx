"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  title: string;
  scheduledAt: string;
  status?: string | null;
  meta?: string | null;
}

interface MobilityCalendarProps {
  events: CalendarEvent[];
  selectedId?: string | null;
  onSelect?: (eventId: string) => void;
  isLoading?: boolean;
  description?: string;
}

function formatDateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit" }).format(date);
}

export function MobilityCalendar({ events, selectedId, onSelect, isLoading, description }: MobilityCalendarProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState title="Loading calendar" description="Compiling upcoming dispatch work." />
        </CardContent>
      </Card>
    );
  }

  if (!events.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            title="No upcoming trips"
            description={description ?? "Schedule a trip or follow up with passengers to populate the calendar."}
          />
        </CardContent>
      </Card>
    );
  }

  const grouped = events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = new Date(event.scheduledAt).toDateString();
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});

  const orderedKeys = Object.keys(grouped).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">Calendar</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {orderedKeys.map((key) => (
          <section key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatDateLabel(key)}</h3>
            <div className="space-y-2">
              {grouped[key]
                .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                .map((event) => {
                  const isSelected = selectedId === event.id;
                  const status = event.status?.replace(/_/g, " ");
                  return (
                    <button
                      type="button"
                      key={event.id}
                      onClick={() => onSelect?.(event.id)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition",
                        isSelected
                          ? "border-blue-500 bg-blue-50 shadow-sm dark:border-blue-400/70 dark:bg-blue-500/10"
                          : "border-slate-200 bg-white hover:border-blue-200 dark:border-slate-800 dark:bg-slate-950",
                      )}
                    >
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{event.title}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTime(event.scheduledAt)}
                          {event.meta ? ` · ${event.meta}` : ""}
                        </div>
                      </div>
                      {status ? <Badge variant="slate" className="capitalize">{status}</Badge> : null}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
