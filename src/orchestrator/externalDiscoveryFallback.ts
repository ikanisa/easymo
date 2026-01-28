import { ExternalDiscoveryFlags } from "../../config/featureFlags";
import type { CandidateVendor } from "../discovery/types";
import { webDiscoverVendors } from "../tools/webDiscoverVendors";
import { mapsDiscoverPlaces } from "../tools/mapsDiscoverPlaces";
import { enrichVendorCandidate } from "../tools/enrichVendorCandidate";
import { saveVendorLead } from "../tools/saveVendorLead";
import { formatExternalOptionsForClient } from "../tools/formatExternalOptionsForClient";

export type ExternalDiscoveryFallbackInput = {
  request_id: string;
  need: string;
  category?: string;
  location_text?: string;
  language?: "en" | "fr" | "rw";
  min_candidates?: number;
};

export type ExternalDiscoveryFallbackResult = {
  ran: boolean;
  candidates: CandidateVendor[];
  lead_ids: string[];
  message: string;
};

const DEFAULT_MIN_CANDIDATES = 2;

export async function runExternalDiscoveryFallback(
  input: ExternalDiscoveryFallbackInput,
  existingVendorCount = 0,
): Promise<ExternalDiscoveryFallbackResult> {
  if (!ExternalDiscoveryFlags.EXTERNAL_DISCOVERY_ENABLED) {
    return { ran: false, candidates: [], lead_ids: [], message: "" };
  }

  const minCandidates = input.min_candidates ?? DEFAULT_MIN_CANDIDATES;
  if (existingVendorCount >= minCandidates) {
    return { ran: false, candidates: [], lead_ids: [], message: "" };
  }

  const candidates: CandidateVendor[] = [];
  const leadIds: string[] = [];

  // Web discovery
  const web = await webDiscoverVendors({
    request_id: input.request_id,
    need: input.need,
    category: input.category,
    location_text: input.location_text,
    max_results: 10,
    engine: "auto",
  });
  candidates.push(...web.candidates);

  // Maps discovery (if enabled)
  const maps = await mapsDiscoverPlaces({
    request_id: input.request_id,
    query: input.need,
    location_text: input.location_text,
    radius_km: 5,
    max_results: 10,
  });
  candidates.push(...maps.candidates);

  const saved: CandidateVendor[] = [];
  for (const candidate of candidates) {
    const enriched = await enrichVendorCandidate({
      request_id: input.request_id,
      candidate,
    });

    if (enriched.kind === "lead") {
      const lead = await saveVendorLead({
        request_id: input.request_id,
        source: "external_discovery",
        dedupe_key: enriched.dedupe_key,
        candidate: enriched.normalized,
      });

      if (lead?.id) {
        leadIds.push(lead.id);
        saved.push(enriched.normalized);
      }
    }
  }

  const message = formatExternalOptionsForClient({
    language: input.language,
    candidates: saved,
  });

  return {
    ran: true,
    candidates: saved,
    lead_ids: leadIds,
    message,
  };
}
