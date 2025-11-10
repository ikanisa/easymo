"use client";

import clsx from "clsx";

export interface AtlasMapPoint {
  id: string;
  label: string;
  status?: "online" | "offline" | "pending" | string;
  x: number;
  y: number;
}

export interface MapCardProps {
  title?: string;
  subtitle?: string;
  points: AtlasMapPoint[];
  className?: string;
}

const statusColor: Record<string, string> = {
  online: "bg-emerald-400 border-emerald-500 shadow-emerald-500/50",
  offline: "bg-rose-400 border-rose-500 shadow-rose-500/40",
  pending: "bg-amber-400 border-amber-500 shadow-amber-500/40",
};

export function MapCard({ title = "Coverage", subtitle, points, className }: MapCardProps) {
  return (
    <section
      className={clsx(
        "flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900",
        className,
      )}
    >
      <header>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </header>
      <div
        className="relative flex-1 rounded-xl border border-slate-200/60 bg-white/70 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/50"
        role="img"
        aria-label="Service coverage map"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(37,99,235,0.08),_transparent_70%)]" />
        {points.map((point) => (
          <div
            key={point.id}
            className={clsx(
              "absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-lg transition",
              statusColor[point.status ?? "online"] ?? statusColor.online,
            )}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
          >
            <span className="sr-only">{point.label}</span>
          </div>
        ))}
        <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-slate-500">
          {Object.entries(statusColor).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <span className={clsx("h-2 w-2 rounded-full border", color)} aria-hidden />
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

