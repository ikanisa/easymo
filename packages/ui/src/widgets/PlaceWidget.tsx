"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export type PlaceWidgetBadgeTone = "default" | "success" | "warning";

export interface PlaceWidgetBadge {
  label: string;
  tone?: PlaceWidgetBadgeTone;
}

export interface PlaceWidgetHighlight {
  label: string;
  value: string;
  icon?: ReactNode;
}

export interface PlaceWidgetProps {
  name: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  statusLabel?: string;
  priceRange?: string;
  etaLabel?: string;
  photoUrl?: string;
  badges?: PlaceWidgetBadge[];
  highlights?: PlaceWidgetHighlight[];
  cta?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

const badgeToneClass: Record<PlaceWidgetBadgeTone, string> = {
  default: "bg-slate-100 text-slate-800",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
};

export function PlaceWidget({
  name,
  location,
  rating,
  reviewCount,
  statusLabel,
  priceRange,
  etaLabel,
  photoUrl,
  badges = [],
  highlights = [],
  cta,
  footer,
  className,
}: PlaceWidgetProps) {
  return (
    <article
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-white/90 p-5 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur",
        className,
      )}
      aria-label={`${name} details`}
    >
      {photoUrl ? (
        <div className="relative mb-4 overflow-hidden rounded-2xl">
          {/* Using img keeps the component framework agnostic */}
          <img
            src={photoUrl}
            alt={`${name} cover`}
            className="h-48 w-full object-cover"
            loading="lazy"
          />
          {statusLabel ? (
            <span className="absolute left-4 top-4 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
              {statusLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Featured location
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            {name}
          </h3>
          {location ? <p className="text-sm text-slate-500">{location}</p> : null}
        </div>
        {cta ? <div className="md:pl-4">{cta}</div> : null}
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-700">
        {rating ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-900 shadow-sm">
            ⭐ {rating.toFixed(1)}
            {reviewCount ? <span className="text-xs text-slate-500">({reviewCount})</span> : null}
          </span>
        ) : null}
        {priceRange ? <span>{priceRange}</span> : null}
        {etaLabel ? <span className="inline-flex items-center gap-1 text-slate-500">⏱ {etaLabel}</span> : null}
      </div>

      {badges.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.map((badge, index) => (
            <span
              key={`${badge.label}-${index}`}
              className={clsx(
                "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
                badgeToneClass[badge.tone ?? "default"],
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}

      {highlights.length ? (
        <dl className="mt-5 grid gap-3 md:grid-cols-3">
          {highlights.map((highlight) => (
            <div
              key={`${highlight.label}-${highlight.value}`}
              className="rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {highlight.label}
              </dt>
              <dd className="mt-1 text-xl font-semibold text-slate-900 flex items-center gap-2">
                {highlight.icon ? <span aria-hidden>{highlight.icon}</span> : null}
                {highlight.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {footer ? <div className="mt-5 text-sm text-slate-500">{footer}</div> : null}
    </article>
  );
}
