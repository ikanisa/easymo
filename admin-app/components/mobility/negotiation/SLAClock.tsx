"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface SLAClockProps {
  startedAt?: string | null;
  deadlineAt?: string | null;
  status?: string;
  className?: string;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function SLAClock({ startedAt, deadlineAt, status, className }: SLAClockProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const { label, remainingMs, totalMs } = useMemo(() => {
    if (!startedAt || !deadlineAt) {
      return { label: "No SLA clock", remainingMs: 0, totalMs: 0 };
    }
    const started = new Date(startedAt).getTime();
    const deadline = new Date(deadlineAt).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(deadline)) {
      return { label: "Invalid timestamps", remainingMs: 0, totalMs: 0 };
    }
    const total = Math.max(0, deadline - started);
    const remaining = deadline - now;
    return { label: remaining >= 0 ? "Time remaining" : "Breached by", remainingMs: Math.abs(remaining), totalMs: total };
  }, [deadlineAt, now, startedAt]);

  const progress = totalMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) : 0;
  const timeDisplay = formatDuration(remainingMs);
  const isBreached = Boolean(deadlineAt) && new Date(deadlineAt).getTime() < now;

  return (
    <Card className={className}>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">SLA Clock</CardTitle>
        {status ? (
          <Badge
            variant={
              status === "negotiating"
                ? "blue"
                : status === "completed"
                  ? "green"
                  : status === "timeout" || status === "cancelled"
                    ? "red"
                    : "slate"
            }
            className="capitalize"
          >
            {status.replace(/_/g, " ")}
          </Badge>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>{label}</span>
            <span className={cn("font-mono text-lg", isBreached ? "text-red-600" : "text-slate-900 dark:text-slate-100")}>{timeDisplay}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div
              className={cn("h-full rounded-full transition-all", isBreached ? "bg-red-500" : "bg-emerald-500")}
              style={{ width: `${Math.max(2, progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Negotiations auto-escalate when the SLA breaches. Use keyboard shortcuts: <kbd className="rounded border px-1 text-[10px] uppercase">A</kbd> approve, <kbd className="rounded border px-1 text-[10px] uppercase">E</kbd> extend, <kbd className="rounded border px-1 text-[10px] uppercase">M</kbd> manual message.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
