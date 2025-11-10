// Supabase Edge Function: agent-chat
//
// Stores chat transcripts in Postgres and optionally delegates to Agent-Core
// for LLM responses. Falls back to canned responses when Agent-Core is not
// configured or returns an error.

import { serve } from "$std/http/server.ts";
import { getServiceClient } from "shared/supabase.ts";
import { CONFIG } from "shared/env.ts";
import { requireAdmin } from "shared/auth.ts";
import { z } from "zod";

const ENABLE_AGENT_CHAT = ["1", "true", "yes"].includes(
  (Deno.env.get("ENABLE_AGENT_CHAT") ?? "true").toLowerCase(),
);

let supabaseClient: ReturnType<typeof getServiceClient> | null = null;

function db() {
  if (!supabaseClient) {
    supabaseClient = getServiceClient();
  }
  return supabaseClient;
}

export function setSupabaseClientForTesting(
  client: ReturnType<typeof getServiceClient> | null,
) {
  supabaseClient = client;
}

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
  retrieval_rewrite: z.boolean().nullable().optional(),
  image_generation_enabled: z.boolean().default(false),
  image_preset: z.record(z.any()).nullable().optional(),
  allowed_tools: z.array(z.record(z.any())).nullable().optional(),
  suggestions: z.array(z.string()).nullable().optional(),
  streaming_partial_images: z.number().int().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ToolkitRow = z.infer<typeof ToolkitRowSchema>;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function respond(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

const DEFAULT_SUGGESTIONS: Record<z.infer<typeof AgentKind>, string[]> = {
  broker: ["What vendor options do I have?", "Share status update", "Request human follow-up"],
  support: ["Escalate to human", "Send troubleshooting steps", "Close ticket"],
  sales: ["Draft follow-up message", "Schedule call", "Log disposition"],
  marketing: ["Share outreach outline", "Summarise performance", "Escalate to marketing lead"],
  mobility: ["Dispatch next driver", "Share rider ETA", "Escalate to dispatcher"],
};

function buildStubResponse(kind: z.infer<typeof AgentKind>, message: string) {
  const friendly = message.trim();
  const suggestions = DEFAULT_SUGGESTIONS[kind];
  switch (kind) {
    case "broker":
      return {
        text: `Thanks for the context! I'll shortlist vendors that match “${friendly}” and share the next steps shortly. (Stub response)`,
        suggestions,
      };
    case "support":
      return {
        text: `I'm the support assistant. I've logged your issue: “${friendly}”. A teammate will review and get back soon. (Stub response)`,
        suggestions,
      };
    case "sales":
      return {
        text: `Sales assistant here. I'll prep outreach material for “${friendly}” and notify the team. (Stub response)`,
        suggestions,
      };
    case "marketing":
      return {
        text: `Marketing assistant noted: “${friendly}”. I'll propose outreach ideas and metrics to track. (Stub response)`,
        suggestions,
      };
    case "mobility":
      return {
        text: `Mobility assistant acknowledged “${friendly}”. I'll coordinate drivers and send updated ETAs soon. (Stub response)`,
        suggestions,
      };
  }
}

async function lookupProfileId(profileRef?: string | null): Promise<string | null> {
  if (!profileRef) return null;
  const supabase = db();
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
  const supabase = db();
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

async function ensureSession(params: {
  sessionId?: string;
  agentKind: z.infer<typeof AgentKind>;
  profileRef?: string | null;
}) {
  const supabase = db();
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

  const supabase = db();
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
  const supabase = db();
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
          metadata?: Record<string, unknown>;
          usage?: unknown;
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

function summariseToolkit(toolkit: ToolkitRow | null): Record<string, unknown> | undefined {
  if (!toolkit) return undefined;
  const summary: Record<string, unknown> = {
    agent_kind: toolkit.agent_kind,
    model: toolkit.model,
    reasoning_effort: toolkit.reasoning_effort,
    text_verbosity: toolkit.text_verbosity,
  };

  const metadata: Record<string, unknown> = {};
  if (toolkit.web_search_enabled) {
    metadata.web_search = {
      enabled: true,
      domains: toolkit.web_search_allowed_domains ?? undefined,
      location: toolkit.web_search_user_location ?? undefined,
    };
  }
  if (toolkit.file_search_enabled) {
    metadata.file_search = {
      enabled: true,
      vector_store_id: toolkit.file_vector_store_id,
      max_results: toolkit.file_search_max_results ?? undefined,
    };
  }
  if (toolkit.retrieval_enabled) {
    metadata.retrieval = {
      enabled: true,
      vector_store_id: toolkit.retrieval_vector_store_id,
      max_results: toolkit.retrieval_max_results ?? undefined,
      rewrite: toolkit.retrieval_rewrite ?? undefined,
    };
  }
  if (toolkit.image_generation_enabled) {
    metadata.image_generation = toolkit.image_preset ?? { enabled: true };
  }
  if (toolkit.streaming_partial_images != null) {
    metadata.streaming_partial_images = toolkit.streaming_partial_images;
  }
  if (toolkit.allowed_tools) {
    metadata.allowed_tools = toolkit.allowed_tools;
  }
  if (toolkit.metadata) {
    metadata.metadata = toolkit.metadata;
  }

  if (Object.keys(metadata).length > 0) {
    summary.capabilities = metadata;
  }
  return summary;
}

export async function handler(req: Request): Promise<Response> {
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

      // Attempt Agent-Core integration, fallback to stub
      let agentText: string | null = null;
      let agentMetadata: Record<string, unknown> = {};
      const coreUrl = CONFIG.AGENT_CORE_URL?.replace(/\/$/, "");
      if (coreUrl) {
        let historyMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [];
        try {
          const history = await fetchHistory(session.id);
          if (history?.messages) {
            historyMessages = history.messages
              .map((msg) => {
                const role =
                  msg.role === "agent"
                    ? "assistant"
                    : msg.role === "user" || msg.role === "system"
                      ? msg.role
                      : null;
                if (!role) return null;
                const payload = msg.payload as Record<string, unknown> | undefined;
                const payloadText =
                  typeof payload?.["text"] === "string"
                    ? (payload["text"] as string)
                    : undefined;
                const content = payloadText ?? (typeof msg.text === "string" ? msg.text : null);
                if (!content) return null;
                return { role, content };
              })
              .filter((msg): msg is { role: "user" | "assistant" | "system"; content: string } => Boolean(msg));
          }
        } catch (err) {
          console.error("agent-chat.history_for_core_failed", err);
        }

        historyMessages.push({ role: "user", content: result.data.message });

        try {
          const resp = await fetch(`${coreUrl}/respond`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(CONFIG.AGENT_CORE_TOKEN
                ? { authorization: `Bearer ${CONFIG.AGENT_CORE_TOKEN}` }
                : {}),
            },
            body: JSON.stringify({
              session_id: session.id,
              agent_kind: result.data.agent_kind,
              profile_ref: result.data.profile_ref ?? null,
              messages: historyMessages,
            }),
          });
          const coreJson = await resp.json().catch(() => ({}));
          if (resp.ok && coreJson && typeof coreJson === "object") {
            if (typeof (coreJson as Record<string, unknown>).text === "string") {
              agentText = (coreJson as Record<string, unknown>).text as string;
            }
            agentMetadata = {
              ...(Array.isArray((coreJson as any).citations)
                ? { citations: (coreJson as any).citations }
                : {}),
              ...(Array.isArray((coreJson as any).web_search_calls)
                ? { web_search_calls: (coreJson as any).web_search_calls }
                : {}),
              ...(Array.isArray((coreJson as any).sources)
                ? { sources: (coreJson as any).sources }
                : {}),
              ...(coreJson && "usage" in (coreJson as Record<string, unknown>)
                ? { usage: (coreJson as Record<string, unknown>).usage }
                : {}),
              ...(coreJson && "raw" in (coreJson as Record<string, unknown>)
                ? { raw: (coreJson as Record<string, unknown>).raw }
                : {}),
              ...(Array.isArray((coreJson as any).suggestions)
                ? { suggestions: (coreJson as any).suggestions }
                : {}),
            };
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

      const assistantSuggestions = Array.isArray(agentMetadata.suggestions)
        ? (agentMetadata.suggestions as string[])
        : ["Thanks!", "What next?", "Escalate"];

      const assistant = agentText
        ? {
          text: agentText,
          suggestions: assistantSuggestions,
        }
        : buildStubResponse(result.data.agent_kind, result.data.message);

      const stub = buildStubResponse(result.data.agent_kind, result.data.message);
      const agentText = agentResult?.reply ?? null;
      const assistantSuggestions = agentResult?.suggestions && agentResult.suggestions.length > 0
        ? agentResult.suggestions
        : stub.suggestions;

      const toolkitSummary = summariseToolkit(toolkit);
      const agentContent: Record<string, unknown> = {
        text: agentText ?? stub.text,
        ...(agentText ? {} : { stub: true }),
      };

      if (toolkitSummary) agentContent.toolkit = toolkitSummary;
      if (agentResult?.citations) agentContent.citations = agentResult.citations;
      if (agentResult?.sources) agentContent.sources = agentResult.sources;
      if (agentResult?.tool_calls) agentContent.tool_calls = agentResult.tool_calls;
      if (agentResult?.images?.length) agentContent.images = agentResult.images;
      if (agentResult?.retrieval_context) {
        agentContent.retrieval_context = agentResult.retrieval_context;
      }
      if (agentResult?.metadata) {
        agentContent.metadata = agentResult.metadata;
      }
      if (agentResult?.usage) {
        agentContent.usage = agentResult.usage;
      }

      const inserted = await appendMessages(session.id, [
        {
          role: "user",
          content: { text: result.data.message },
        },
        {
          role: "agent",
          content: agentContent,
        },
      ]);

      const supabase = db();
      await supabase
        .from("agent_chat_sessions")
        .update({
          last_user_message: result.data.message,
          last_agent_message: agentText ?? stub.text,
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
        suggestions: assistantSuggestions,
      });
    } catch (error) {
      console.error("agent-chat.post_failed", error);
      return respond(500, { error: "Failed to process message" });
    }
  }

  return respond(405, { error: "Method not allowed" });
}

if (import.meta.main) {
  serve(handler);
}
