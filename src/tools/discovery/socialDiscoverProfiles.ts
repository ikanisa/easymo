import { ExternalDiscoveryBudgets, ExternalDiscoveryFlags } from "../../config/featureFlags";
import { checkDiscoveryBudget } from "../audit/discoveryBudget";
import { writeAuditEvent } from "../audit/writeAuditEvent";
import { normalizeSearchResults } from "../discovery/normalizeCandidates";
import { searchWithGemini } from "../discovery/geminiSearchAdapter";
import { searchWithOpenAI } from "../discovery/openaiSearchAdapter";
import type { DiscoveryEngine, SearchResult, CandidateVendor } from "../discovery/types";

const MAX_RESULTS_CAP = 8;

function clampResults(value: number): number {
  const budget = Math.min(ExternalDiscoveryBudgets.DISCOVERY_MAX_RESULTS, MAX_RESULTS_CAP);
  return Math.max(1, Math.min(value, budget));
}

function buildQuery(input: SocialDiscoveryInput): string {
  const scope = [
    input.need,
    input.category ? `category: ${input.category}` : null,
    input.location_text ? `location: ${input.location_text}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return `Find active social media profiles (LinkedIn, Facebook, Instagram, X/Twitter, YouTube) related to: ${scope}. Provide profile URLs, handles, and any public contact details in the snippet.`;
}

function resolveEngine(input: SocialDiscoveryInput): { engine: "openai" | "gemini" | "none"; reason?: string } {
  const requested = input.engine ?? "auto";
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY);

  if (requested === "openai") {
    return hasOpenAI ? { engine: "openai" } : { engine: "none", reason: "openai_key_missing" };
  }
  if (requested === "gemini") {
    return hasGemini ? { engine: "gemini" } : { engine: "none", reason: "gemini_key_missing" };
  }

  if (hasOpenAI) return { engine: "openai" };
  if (hasGemini) return { engine: "gemini" };
  return { engine: "none", reason: "no_provider_keys" };
}

export type SocialDiscoveryInput = {
  request_id: string;
  need: string;
  category?: string;
  location_text?: string;
  engine?: DiscoveryEngine;
  max_results?: number;
};

export type SocialDiscoveryResult = {
  engine: Exclude<DiscoveryEngine, "auto"> | "none";
  candidates: CandidateVendor[];
  raw_results: Array<SearchResult>;
  disabled?: boolean;
  reason?: string;
};

export async function socialDiscoverProfiles(input: SocialDiscoveryInput): Promise<SocialDiscoveryResult> {
  if (!ExternalDiscoveryFlags.EXTERNAL_DISCOVERY_ENABLED || !ExternalDiscoveryFlags.SOCIAL_DISCOVERY_ENABLED) {
    return {
      engine: "none",
      candidates: [],
      raw_results: [],
      disabled: true,
      reason: "social_discovery_disabled",
    };
  }

  const budgetCheck = await checkDiscoveryBudget(
    input.request_id,
    "discovery.social_done",
    ExternalDiscoveryBudgets.DISCOVERY_MAX_CALLS_PER_REQUEST,
  );

  if (!budgetCheck.allowed) {
    await writeAuditEvent({
      request_id: input.request_id,
      event_type: "discovery.blocked_budget",
      actor: "system",
      input: { event_type: "discovery.social_done" },
      output: { reason: budgetCheck.reason, count: budgetCheck.count },
    });
    return {
      engine: "none",
      candidates: [],
      raw_results: [],
      disabled: true,
      reason: "budget_exceeded",
    };
  }

  const maxResults = clampResults(input.max_results ?? ExternalDiscoveryBudgets.DISCOVERY_MAX_RESULTS);
  const query = buildQuery(input);
  const { engine, reason } = resolveEngine(input);

  if (engine === "none") {
    return {
      engine,
      candidates: [],
      raw_results: [],
      reason,
    };
  }

  const startedAt = Date.now();
  const rawResults = engine === "openai"
    ? await searchWithOpenAI({ query, maxResults })
    : await searchWithGemini({ query, maxResults });

  await writeAuditEvent({
    request_id: input.request_id,
    event_type: "discovery.social_done",
    actor: "system",
    input: { query, engine, max_results: maxResults },
    output: { raw_count: rawResults.length },
    duration_ms: Date.now() - startedAt,
  });

  const candidates = normalizeSearchResults(rawResults);

  return {
    engine,
    candidates,
    raw_results: rawResults,
  };
}
