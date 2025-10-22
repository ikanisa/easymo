// Supabase Edge Function: agent-chat
//
// Temporary stub that stores chat transcripts in Postgres and returns
// canned responses until the OpenAI agent-core service is ready.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { CONFIG } from "shared/env.ts";
import { requireAdmin } from "shared/auth.ts";
import { z } from "zod";

const ADMIN_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";
const ENABLE_AGENT_CHAT = (Deno.env.get("ENABLE_AGENT_CHAT") ?? "true")
  .toLowerCase() in ["1", "true", "yes"];

const supabase = getServiceClient();

const AgentKind = z.enum(["broker", "support", "sales", "marketing", "mobility"]);

const PostPayload = z.object({
  agent_kind: AgentKind,
  message: z.string().min(1),
  session_id: z.string().uuid().optional(),
  profile_ref: z.string().min(1).optional(),
});

const ToolkitRowSchema = z.object({
  agent_kind: AgentKind,
  model: z.string().default("gpt-5"),
  reasoning_effort: z.enum(["minimal", "low", "medium", "high"]).default("medium"),
  text_verbosity: z.enum(["low", "medium", "high"]).default("medium"),
  web_search_enabled: z.boolean().default(false),
  web_search_allowed_domains: z.array(z.string()).nullable().optional(),
  web_search_user_location: z.record(z.any()).nullable().optional(),
  file_search_enabled: z.boolean().default(false),
  file_vector_store_id: z.string().nullable().optional(),
  file_search_max_results: z.number().int().nullable().optional(),
  retrieval_enabled: z.boolean().default(false),
  retrieval_vector_store_id: z.string().nullable().optional(),
  retrieval_max_results: z.number().int().nullable().optional(),
  retrieval_rewrite: z.boolean().optional(),
  image_generation_enabled: z.boolean().default(false),
  image_preset: z.record(z.any()).nullable().optional(),
  allowed_tools: z.array(z.record(z.any())).nullable().optional(),
  suggestions: z.array(z.string()).nullable().optional(),
  streaming_partial_images: z.number().int().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

type ToolkitRow = z.infer<typeof ToolkitRowSchema>;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

function buildStubResponse(kind: z.infer<typeof AgentKind>, message: string) {
  const friendly = message.trim();
  switch (kind) {
    case "broker":
      return {
        text:
          `Thanks for the context! I'll shortlist vendors that match “${friendly}” and share the next steps shortly. (Stub response)`,
        suggestions: [
          "What vendor options do I have?",
          "Share status update",
          "Request human follow-up",
        ],
      };
    case "support":
      return {
        text:
          `I'm the support assistant. I've logged your issue: “${friendly}”. A teammate will review and get back soon. (Stub response)`,
        suggestions: [
          "Escalate to human",
          "Send troubleshooting steps",
          "Close ticket",
        ],
      };
    case "sales":
      return {
        text:
          `Sales assistant here. I'll prep outreach material for “${friendly}” and notify the team. (Stub response)`,
        suggestions: [
          "Draft follow-up message",
          "Schedule call",
          "Log disposition",
        ],
      };
    case "marketing":
      return {
        text:
          `Marketing assistant noted: “${friendly}”. I'll propose campaign ideas and metrics to track. (Stub response)`,
        suggestions: [
          "Share campaign outline",
          "Summarise performance",
          "Escalate to marketing lead",
        ],
      };
    case "mobility":
      return {
        text:
          `Mobility assistant acknowledged “${friendly}”. I'll coordinate drivers and send updated ETAs soon. (Stub response)`,
        suggestions: [
          "Dispatch next driver",
          "Share rider ETA",
          "Escalate to dispatcher",
        ],
      };
  }
}

async function lookupProfileId(
  profileRef?: string | null,
): Promise<string | null> {
  if (!profileRef) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("ref_code", profileRef)
    .maybeSingle();
  if (error) {
    console.error("agent-chat.lookup_profile_failed", error);
    return null;
  }
  return data?.user_id ?? null;
}

async function fetchToolkit(agentKind: z.infer<typeof AgentKind>): Promise<ToolkitRow | null> {
  const { data, error } = await supabase
    .from("agent_toolkits")
    .select("*")
    .eq("agent_kind", agentKind)
    .maybeSingle();

  if (error) {
    console.error("agent-chat.toolkit_fetch_failed", error);
    return null;
  }

  if (!data) return null;

  const parsed = ToolkitRowSchema.safeParse(data);
  if (!parsed.success) {
    console.warn("agent-chat.toolkit_parse_failed", parsed.error.flatten());
    return null;
  }
  return parsed.data;
}

async function ensureSession(params: {
  sessionId?: string;
  agentKind: z.infer<typeof AgentKind>;
  profileRef?: string | null;
}) {
  if (params.sessionId) {
    const { data } = await supabase
      .from("agent_chat_sessions")
      .select("id, agent_kind, status, metadata, created_at, updated_at")
      .eq("id", params.sessionId)
      .maybeSingle();
    if (data) {
      return data;
    }
  }

  const profileId = await lookupProfileId(params.profileRef);
  const metadata: Record<string, unknown> = {
    source: "admin-panel",
    profile_ref: params.profileRef ?? null,
  };

  const { data, error } = await supabase
    .from("agent_chat_sessions")
    .insert({
      profile_id: profileId,
      agent_kind: params.agentKind,
      metadata,
    })
    .select("id, agent_kind, status, metadata, created_at, updated_at")
    .single();

  if (error) {
    console.error("agent-chat.create_session_failed", error);
    throw new Error(error.message);
  }

  return data;
}

async function appendMessages(
  sessionId: string,
  messages: Array<{
    role: "user" | "agent" | "system";
    content: Record<string, unknown>;
  }>,
) {
  const inserts = messages.map((msg) => ({
    session_id: sessionId,
    role: msg.role,
    content: msg.content,
  }));

  const { data, error } = await supabase
    .from("agent_chat_messages")
    .insert(inserts)
    .select("id, role, content, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("agent-chat.insert_messages_failed", error);
    throw new Error(error.message);
  }

  return data ?? [];
}

async function fetchHistory(sessionId: string, limit = 200) {
  const { data: session, error } = await supabase
    .from("agent_chat_sessions")
    .select("id, agent_kind, status, metadata, created_at, updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!session) return null;

  const { data: rowsDesc, error: msgErr } = await supabase
    .from("agent_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (msgErr) {
    throw new Error(msgErr.message);
  }

  const rows = rowsDesc ? [...rowsDesc].reverse() : [];

  const messages = rows.map((row) => ({
    id: row.id,
    role: row.role,
    text: typeof row.content?.text === "string" ? row.content.text : "",
    created_at: row.created_at,
    payload: row.content ?? {},
  }));

  return { session, messages };
}

type StoredMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  created_at: string;
  payload?: Record<string, unknown>;
};

function mapHistoryForAgent(messages: StoredMessage[]) {
  return messages.map((msg) => ({
    role: msg.role,
    text: msg.text,
    payload: msg.payload ?? {},
    created_at: msg.created_at,
  }));
}

async function callAgentCore(params: {
  sessionId: string;
  agentKind: z.infer<typeof AgentKind>;
  message: string;
  profileRef?: string | null;
  history: StoredMessage[];
  toolkit: ToolkitRow | null;
}) {
  const coreUrl = CONFIG.AGENT_CORE_URL?.replace(/\/$/, "");
  if (!coreUrl) return null;

  try {
    const response = await fetch(`${coreUrl}/respond`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(CONFIG.AGENT_CORE_TOKEN
          ? { authorization: `Bearer ${CONFIG.AGENT_CORE_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        session_id: params.sessionId,
        agent_kind: params.agentKind,
        message: params.message,
        profile_ref: params.profileRef ?? null,
        history: mapHistoryForAgent(params.history),
        toolkit: params.toolkit,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("agent-chat.core_failed", {
        status: response.status,
        body: text,
      });
      return null;
    }

    if (!text) return null;

    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.reply === "string") {
        return parsed as {
          reply: string;
          suggestions?: string[];
          citations?: unknown;
          sources?: unknown;
          tool_calls?: unknown;
          images?: Array<{ data: string; format?: string; alt?: string }>;
          retrieval_context?: string;
        };
      }
    } catch (parseError) {
      console.error("agent-chat.core_parse_failed", parseError);
    }
  } catch (error) {
    console.error("agent-chat.core_request_failed", error);
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...headers,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,x-admin-token",
      },
    });
  }

  const guard = requireAdmin(req);
  if (guard) return guard;

  if (!ENABLE_AGENT_CHAT) {
    return respond(503, {
      error: "Agent chat disabled",
      message: "Set ENABLE_AGENT_CHAT=1 to enable this endpoint.",
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id") ?? undefined;
    if (!sessionId) {
      return respond(400, { error: "session_id query parameter required" });
    }

    try {
      const history = await fetchHistory(sessionId);
      if (!history) {
        return respond(404, { error: "Session not found" });
      }
      return respond(200, history);
    } catch (error) {
      console.error("agent-chat.history_failed", error);
      return respond(500, { error: "Failed to load history" });
    }
  }

  if (req.method === "POST") {
    const payload = await req.json().catch(() => null);
    const result = PostPayload.safeParse(payload);
    if (!result.success) {
      return respond(400, {
        error: "Invalid payload",
        details: result.error.flatten(),
      });
    }

    try {
      const session = await ensureSession({
        sessionId: result.data.session_id,
        agentKind: result.data.agent_kind,
        profileRef: result.data.profile_ref,
      });

      const toolkit = await fetchToolkit(result.data.agent_kind);
      const historyForAgent = await fetchHistory(session.id, 50);
      const historyMessages = (historyForAgent?.messages ?? []) as StoredMessage[];

      const agentResult = await callAgentCore({
        sessionId: session.id,
        agentKind: result.data.agent_kind,
        message: result.data.message,
        profileRef: result.data.profile_ref ?? null,
        history: historyMessages,
        toolkit,
      });

      const fallback = buildStubResponse(result.data.agent_kind, result.data.message);
      const replyText = agentResult?.reply && agentResult.reply.trim().length > 0
        ? agentResult.reply.trim()
        : fallback.text;

      const candidateSuggestions = (agentResult?.suggestions ?? [])
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter((item): item is string => item.length > 0);

      const defaultSuggestions = toolkit?.suggestions?.length
        ? toolkit.suggestions
        : fallback.suggestions;

      const suggestions = candidateSuggestions.length > 0
        ? candidateSuggestions
        : defaultSuggestions;

      const agentPayload: Record<string, unknown> = {
        text: replyText,
        stub: !agentResult,
      };
      if (toolkit) {
        const metadataSummary: Record<string, unknown> = {};
        const rawMeta = (toolkit.metadata ?? {}) as Record<string, unknown>;
        if (typeof rawMeta.system_prompt === "string" && rawMeta.system_prompt.trim().length > 0) {
          metadataSummary.system_prompt = rawMeta.system_prompt;
        }
        if (Array.isArray(rawMeta.instructions)) {
          const instructions = rawMeta.instructions
            .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
            .map((item) => item.trim());
          if (instructions.length > 0) {
            metadataSummary.instructions = instructions;
          }
        }
        const summary: Record<string, unknown> = {
          agent_kind: toolkit.agent_kind,
          model: toolkit.model,
          reasoning_effort: toolkit.reasoning_effort,
          text_verbosity: toolkit.text_verbosity,
        };
        if (Object.keys(metadataSummary).length > 0) {
          summary.metadata = metadataSummary;
        }
        agentPayload.toolkit = summary;
      }
      if (agentResult?.citations) agentPayload.citations = agentResult.citations;
      if (agentResult?.sources) agentPayload.sources = agentResult.sources;
      if (agentResult?.tool_calls) agentPayload.tool_calls = agentResult.tool_calls;
      if (agentResult?.images?.length) agentPayload.images = agentResult.images;
      if (agentResult?.retrieval_context) agentPayload.retrieval_context = agentResult.retrieval_context;

      const inserted = await appendMessages(session.id, [
        {
          role: "user",
          content: { text: result.data.message },
        },
        {
          role: "agent",
          content: agentPayload,
        },
      ]);

      await supabase
        .from("agent_chat_sessions")
        .update({
          last_user_message: result.data.message,
          last_agent_message: replyText,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      const messages = inserted.map((row) => ({
        id: row.id,
        role: row.role,
        text: typeof row.content?.text === "string" ? row.content.text : "",
        created_at: row.created_at,
        payload: row.content ?? {},
      }));

      return respond(200, {
        session,
        messages,
        suggestions,
      });
    } catch (error) {
      console.error("agent-chat.post_failed", error);
      return respond(500, { error: "Failed to process message" });
    }
  }

  return respond(405, { error: "Method not allowed" });
});
