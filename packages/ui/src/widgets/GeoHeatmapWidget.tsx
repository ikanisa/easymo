"use client";

import { clsx } from "clsx";

export interface GeoHeatZone {
  label: string;
  intensity: number; // 0 - 1
  valueLabel?: string;
}

interface GeoHeatmapWidgetProps {
  zones: GeoHeatZone[];
  className?: string;
}

function intensityToColor(value: number): string {
  const clamped = Math.min(1, Math.max(0, value));
  const hue = 200 - clamped * 80;
  const saturation = 75 + clamped * 20;
  const lightness = 90 - clamped * 35;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function GeoHeatmapWidget({ zones, className }: GeoHeatmapWidgetProps) {
  return (
    <article
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-white/95 p-5 shadow-[0_30px_70px_rgba(15,23,42,0.12)]",
        className,
      )}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {zones.map((zone) => (
          <div
            key={zone.label}
            className="rounded-2xl border border-slate-100 p-4 text-center"
            style={{ background: intensityToColor(zone.intensity) }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              {zone.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{zone.valueLabel}</p>
            <p className="text-xs text-slate-500">Heat score {(zone.intensity * 100).toFixed(0)}%</p>
          </div>
        ))}
      </div>
    </article>
  );
}
