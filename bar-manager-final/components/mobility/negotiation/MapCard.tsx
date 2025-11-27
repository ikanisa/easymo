"use client";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";

export interface MapLocation {
  lat: number;
  lng: number;
  label?: string | null;
}

export interface MapDriver {
  id: string;
  name?: string | null;
  lat?: number | null;
  lng?: number | null;
  distanceKm?: number | null;
  etaMinutes?: number | null;
}

interface MapCardProps {
  pickup?: MapLocation | null;
  dropoff?: MapLocation | null;
  drivers: MapDriver[];
  isLoading?: boolean;
  error?: string | null;
}

function projectPoint(
  point: { lat: number; lng: number },
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const latRange = Math.max(0.0001, bounds.maxLat - bounds.minLat);
  const lngRange = Math.max(0.0001, bounds.maxLng - bounds.minLng);
  const x = (point.lng - bounds.minLng) / lngRange;
  const y = 1 - (point.lat - bounds.minLat) / latRange;
  return {
    left: `${Math.min(95, Math.max(5, x * 100))}%`,
    top: `${Math.min(92, Math.max(8, y * 100))}%`,
  };
}

function formatDistance(distanceKm?: number | null) {
  if (distanceKm == null || Number.isNaN(distanceKm)) return "–";
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

export function MapCard({ pickup, dropoff, drivers, isLoading, error }: MapCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nearby drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingState title="Fetching live driver locations" description="Querying Supabase geospatial index." />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nearby drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">Unable to load driver map.</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const plottedDrivers = drivers.filter((driver) => typeof driver.lat === "number" && typeof driver.lng === "number");
  const hasMapPoints = Boolean(pickup) || Boolean(dropoff) || plottedDrivers.length > 0;

  const bounds = hasMapPoints
    ? (() => {
        const allLats: number[] = [];
        const allLngs: number[] = [];
        if (pickup) {
          allLats.push(pickup.lat);
          allLngs.push(pickup.lng);
        }
        if (dropoff) {
          allLats.push(dropoff.lat);
          allLngs.push(dropoff.lng);
        }
        plottedDrivers.forEach((driver) => {
          allLats.push(driver.lat!);
          allLngs.push(driver.lng!);
        });
        return {
          minLat: Math.min(...allLats),
          maxLat: Math.max(...allLats),
          minLng: Math.min(...allLngs),
          maxLng: Math.max(...allLngs),
        };
      })()
    : { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-50">Nearby drivers</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner dark:border-slate-800 dark:bg-slate-900">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_60%)]" aria-hidden="true" />
          {pickup ? (
            <div
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white shadow-lg"
              style={projectPoint(pickup, bounds)}
              title={`Pickup: ${pickup.label ?? `${pickup.lat}, ${pickup.lng}`}`}
            >
              P
            </div>
          ) : null}
          {dropoff ? (
            <div
              className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white shadow-lg"
              style={projectPoint(dropoff, bounds)}
              title={`Drop-off: ${dropoff.label ?? `${dropoff.lat}, ${dropoff.lng}`}`}
            >
              D
            </div>
          ) : null}
          {plottedDrivers.map((driver) => (
            <div
              key={driver.id}
              className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900 shadow-md ring-2 ring-blue-500"
              style={projectPoint({ lat: driver.lat!, lng: driver.lng! }, bounds)}
              title={driver.name ?? "Driver"}
            >
              🚗
            </div>
          ))}
          {!hasMapPoints ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              No map data yet
            </div>
          ) : null}
        </div>
        {drivers.length === 0 ? (
          <EmptyState
            title="Waiting for driver pings"
            description="We’ll visualise live driver candidates once the match RPC returns results."
          />
        ) : (
          <div className="space-y-3">
            {drivers.map((driver) => (
              <div key={driver.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{driver.name ?? "Unnamed driver"}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDistance(driver.distanceKm)} away
                  </div>
                </div>
                <Badge variant="blue">ETA {driver.etaMinutes != null ? `${driver.etaMinutes} min` : "–"}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
