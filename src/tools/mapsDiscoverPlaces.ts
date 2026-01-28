import { ExternalDiscoveryBudgets, ExternalDiscoveryFlags } from "../../config/featureFlags";
import { checkDiscoveryBudget } from "../audit/discoveryBudget";
import { writeAuditEvent } from "../audit/writeAuditEvent";
import { normalizeSearchResults } from "../discovery/normalizeCandidates";
import { searchWithGoogleMaps } from "../discovery/googleMapsAdapter";
import type { CandidateVendor } from "../discovery/types";

export type MapsDiscoverInput = {
  request_id: string;
  query: string;
  location_text?: string;
  radius_km?: number;
  max_results?: number;
};

export type MapsDiscoverResult = {
  candidates: CandidateVendor[];
  raw_results: Array<{ title?: string; url?: string; snippet?: string }>;
  disabled?: boolean;
  reason?: string;
};

const MAX_RESULTS_CAP = 10;
const MAX_RADIUS_KM = 15;

function clampResults(value: number): number {
  const budget = Math.min(ExternalDiscoveryBudgets.DISCOVERY_MAX_RESULTS, MAX_RESULTS_CAP);
  return Math.min(Math.max(value, 1), budget);
}

function clampRadius(value?: number): number | undefined {
  if (!value) return undefined;
  return Math.min(Math.max(value, 1), MAX_RADIUS_KM);
}

export async function mapsDiscoverPlaces(input: MapsDiscoverInput): Promise<MapsDiscoverResult> {
  if (!ExternalDiscoveryFlags.MAPS_ENRICHMENT_ENABLED) {
    return {
      candidates: [],
      raw_results: [],
      disabled: true,
      reason: "maps_enrichment_disabled",
    };
  }

  const budgetCheck = await checkDiscoveryBudget(
    input.request_id,
    "discovery.maps_done",
    ExternalDiscoveryBudgets.MAPS_MAX_CALLS_PER_REQUEST,
  );
  if (!budgetCheck.allowed) {
    await writeAuditEvent({
      request_id: input.request_id,
      event_type: "discovery.blocked_budget",
      actor: "system",
      input: { event_type: "discovery.maps_done" },
      output: { reason: budgetCheck.reason, count: budgetCheck.count },
    });
    return {
      candidates: [],
      raw_results: [],
      disabled: true,
      reason: "budget_exceeded",
    };
  }

  const maxResults = clampResults(input.max_results ?? ExternalDiscoveryBudgets.DISCOVERY_MAX_RESULTS);
  const radius = clampRadius(input.radius_km);
  const startedAt = Date.now();

  const rawResults = await searchWithGoogleMaps({
    query: input.query,
    location: input.location_text,
    radiusKm: radius,
    maxResults,
  });

  const candidates = normalizeSearchResults(rawResults);

  await writeAuditEvent({
    request_id: input.request_id,
    event_type: "discovery.maps_done",
    actor: "system",
    input: {
      query: input.query,
      location_text: input.location_text,
      radius_km: radius,
      max_results: maxResults,
    },
    output: {
      raw_count: rawResults.length,
      candidate_count: candidates.length,
    },
    duration_ms: Date.now() - startedAt,
  });

  return {
    candidates,
    raw_results: rawResults,
  };
}
