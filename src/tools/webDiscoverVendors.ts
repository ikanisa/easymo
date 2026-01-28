import { ExternalDiscoveryBudgets, ExternalDiscoveryFlags } from "../../config/featureFlags";
import { checkDiscoveryBudget } from "../audit/discoveryBudget";
import { writeAuditEvent } from "../audit/writeAuditEvent";
import { normalizeSearchResults } from "../discovery/normalizeCandidates";
import { searchWithGemini } from "../discovery/geminiSearchAdapter";
import { searchWithOpenAI } from "../discovery/openaiSearchAdapter";
import type { WebDiscoveryInput, WebDiscoveryResult } from "../discovery/types";

const MAX_RESULTS_CAP = 10;

function clampResults(value: number): number {
  const budget = Math.min(ExternalDiscoveryBudgets.DISCOVERY_MAX_RESULTS, MAX_RESULTS_CAP);
  return Math.min(Math.max(value, 1), budget);
}

function buildQuery(input: WebDiscoveryInput): string {
  const parts = [
    input.need,
    input.category ? `category: ${input.category}` : null,
    input.location_text ? `location: ${input.location_text}` : null,
  ].filter(Boolean);

  return `Find vendors or businesses for: ${parts.join(" ")}. Provide names and any contact info.`;
}

function resolveEngine(input: WebDiscoveryInput): { engine: "openai" | "gemini" | "none"; reason?: string } {
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

export async function webDiscoverVendors(input: WebDiscoveryInput): Promise<WebDiscoveryResult> {
  if (!ExternalDiscoveryFlags.EXTERNAL_DISCOVERY_ENABLED) {
    return {
      engine: "none",
      candidates: [],
      raw_results: [],
      disabled: true,
      reason: "external_discovery_disabled",
    };
  }

  const budgetCheck = await checkDiscoveryBudget(
    input.request_id,
    "discovery.web_search_done",
    ExternalDiscoveryBudgets.DISCOVERY_MAX_CALLS_PER_REQUEST,
  );
  if (!budgetCheck.allowed) {
    await writeAuditEvent({
      request_id: input.request_id,
      event_type: "discovery.blocked_budget",
      actor: "system",
      input: { event_type: "discovery.web_search_done" },
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

  const candidates = normalizeSearchResults(rawResults);

  await writeAuditEvent({
    request_id: input.request_id,
    event_type: "discovery.web_search_done",
    actor: "system",
    input: {
      engine,
      query,
      max_results: maxResults,
    },
    output: {
      raw_count: rawResults.length,
      candidate_count: candidates.length,
    },
    duration_ms: Date.now() - startedAt,
  });

  return {
    engine,
    candidates,
    raw_results: rawResults,
  };
}
