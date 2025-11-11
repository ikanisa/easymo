"use client";

import type { Shop } from "@/lib/shops/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

interface ShopMapProps {
  shops: Shop[];
}

function computeBounds(shops: Shop[]) {
  const points = shops
    .map((shop) => shop.coordinates)
    .filter((loc): loc is { lat: number; lng: number } => Boolean(loc));
  if (!points.length) {
    return { minLat: -1.95, maxLat: -1.9, minLng: 30.0, maxLng: 30.1 };
  }
  return {
    minLat: Math.min(...points.map((p) => p.lat)),
    maxLat: Math.max(...points.map((p) => p.lat)),
    minLng: Math.min(...points.map((p) => p.lng)),
    maxLng: Math.max(...points.map((p) => p.lng)),
  };
}

function project(location: { lat: number; lng: number }, bounds: ReturnType<typeof computeBounds>) {
  const latRange = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.0001, bounds.maxLng - bounds.minLng);
  const x = (location.lng - bounds.minLng) / lngRange;
  const y = 1 - (location.lat - bounds.minLat) / latRange;
  return {
    left: `${Math.min(92, Math.max(8, x * 100))}%`,
    top: `${Math.min(90, Math.max(10, y * 100))}%`,
  };
}

export function ShopMap({ shops }: ShopMapProps) {
  const withLocation = shops.filter((shop) => shop.coordinates);
  const bounds = computeBounds(withLocation);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-[color:var(--color-foreground)]">
          Shops & services heatmap
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_60%)]" />
          {withLocation.length ? (
            withLocation.map((shop) => (
              <div
                key={shop.id}
                className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-[color:var(--color-foreground)] shadow-md ring-2 ring-[color:var(--color-accent)]"
                style={project(shop.coordinates!, bounds)}
                title={`${shop.name}${shop.businessLocation ? ` · ${shop.businessLocation}` : ""}`}
              >
                🛍️
              </div>
            ))
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[color:var(--color-muted)]">
              No coordinates captured yet.
            </div>
          )}
        </div>
        {shops.length ? (
          <ul className="space-y-2 text-sm">
            {shops.slice(0, 6).map((shop) => (
              <li key={shop.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)]/50 px-3 py-2">
                <div>
                  <p className="font-medium text-[color:var(--color-foreground)]">{shop.name}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{shop.tags.join(", ")}</p>
                </div>
                <span className="text-xs text-[color:var(--color-muted)]">
                  {shop.coordinates ? `${shop.coordinates.lat.toFixed(2)}, ${shop.coordinates.lng.toFixed(2)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No shops or services yet"
            description="Add an entry to visualise distribution across Kigali."
          />
        )}
      </CardContent>
    </Card>
  );
}
