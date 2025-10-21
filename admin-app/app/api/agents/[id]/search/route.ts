import OpenAI from "openai";
import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const RequestSchema = z.object({
  query: z.string().min(1, "query_required"),
  limit: z.coerce.number().int().min(1).max(20).optional(),
  minSimilarity: z.coerce.number().min(0).max(1).optional(),
});

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

const openaiClient = (() => {
  const apiKey =
    process.env.OPENAI_API_KEY ??
    process.env.ADMIN_OPENAI_API_KEY ??
    process.env.NEXT_PUBLIC_OPENAI_API_KEY ??
    null;
  if (!apiKey) return null;
  const baseURL = process.env.OPENAI_BASE_URL || process.env.ADMIN_OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, baseURL });
})();

export const dynamic = "force-dynamic";

function extractAgentIdFromUrl(url: string) {
  const segments = new URL(url).pathname.split("/").filter(Boolean);
  const idx = segments.findIndex((segment) => segment === "agents");
  if (idx === -1 || idx + 1 >= segments.length) return null;
  return segments[idx + 1];
}

export const POST = createHandler("api.agent_documents.search", async (request, _context, { recordMetric }) => {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    recordMetric("agent_document_search.supabase_unavailable", 1);
    return jsonError({ error: "supabase_unavailable", message: "Supabase credentials missing." }, 503);
  }
  if (!openaiClient) {
    recordMetric("agent_document_search.openai_unconfigured", 1);
    return jsonError({ error: "openai_unconfigured", message: "Set OPENAI_API_KEY to enable semantic search." }, 503);
  }

  const agentId = extractAgentIdFromUrl(request.url);
  if (!agentId) {
    recordMetric("agent_document_search.agent_id_missing", 1);
    return jsonError({ error: "agent_id_required", message: "Agent identifier is required in the route." }, 400);
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    recordMetric("agent_document_search.invalid_body", 1);
    return zodValidationError(parsed.error);
  }

  const { query, limit = 8, minSimilarity = 0.15 } = parsed.data;

  try {
    const embeddingResponse = await openaiClient.embeddings.create({
      model: embeddingModel,
      input: query,
    });
    const vector = embeddingResponse.data[0]?.embedding;
    if (!vector) {
      recordMetric("agent_document_search.embedding_empty", 1);
      return jsonError({ error: "embedding_failed", message: "Embedding response did not include a vector." }, 502);
    }

    const { data, error } = await supabase.rpc("match_agent_document_chunks", {
      query_embedding: vector,
      match_count: limit,
      agent_id: agentId,
      min_similarity: minSimilarity,
    });

    if (error) {
      recordMetric("agent_document_search.supabase_error", 1, { message: error.message });
      return jsonError({ error: "match_failed", message: error.message }, 502);
    }

    recordMetric("agent_document_search.success", (data ?? []).length, {
      agent_id: agentId,
    });
    if (embeddingResponse.usage?.total_tokens) {
      recordMetric("agent_document_search.token_usage", embeddingResponse.usage.total_tokens, {
        model: embeddingModel,
      });
    }

    return jsonOk({
      matches: data ?? [],
      embeddingModel,
      usage: embeddingResponse.usage ?? null,
    });
  } catch (error) {
    recordMetric("agent_document_search.unexpected_error", 1, {
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError({ error: "search_failed", message: "Unable to execute semantic search." }, 500);
  }
});
