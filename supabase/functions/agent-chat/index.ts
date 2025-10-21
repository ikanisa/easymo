// Supabase Edge Function: agent-chat
//
// Temporary stub that stores chat transcripts in Postgres and returns
// canned responses until the OpenAI agent-core service is ready.

import { serve } from "$std/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_URL = Deno.env.get("SERVICE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ?? "";
const ADMIN_TOKEN = Deno.env.get("EASYMO_ADMIN_TOKEN") ?? "";
const ENABLE_AGENT_CHAT = (Deno.env.get("ENABLE_AGENT_CHAT") ?? "true")
  .toLowerCase() in ["1", "true", "yes"];

const SB_URL = SUPABASE_URL || SERVICE_URL;
if (!SB_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase credentials are not configured");
}

const supabase = createClient(SB_URL, SERVICE_ROLE_KEY);

const AgentKind = z.enum(["broker", "support", "sales", "marketing"]);

const PostPayload = z.object({
  agent_kind: AgentKind,
  message: z.string().min(1),
  session_id: z.string().uuid().optional(),
  profile_ref: z.string().min(1).optional(),
});

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

async function fetchHistory(sessionId: string) {
  const { data: session, error } = await supabase
    .from("agent_chat_sessions")
    .select("id, agent_kind, status, metadata, created_at, updated_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!session) return null;

  const { data: rows, error: msgErr } = await supabase
    .from("agent_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (msgErr) {
    throw new Error(msgErr.message);
  }

  const messages = (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role,
    text: typeof row.content?.text === "string" ? row.content.text : "",
    created_at: row.created_at,
    payload: row.content ?? {},
  }));

  return { session, messages };
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

  const apiKey = req.headers.get("x-admin-token");
  if (!apiKey || apiKey !== ADMIN_TOKEN) {
    return respond(403, { error: "Forbidden" });
  }

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

      const stub = buildStubResponse(
        result.data.agent_kind,
        result.data.message,
      );
      const inserted = await appendMessages(session.id, [
        {
          role: "user",
          content: { text: result.data.message },
        },
        {
          role: "agent",
          content: { text: stub.text, stub: true },
        },
      ]);

      await supabase
        .from("agent_chat_sessions")
        .update({
          last_user_message: result.data.message,
          last_agent_message: stub.text,
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
        suggestions: stub.suggestions,
      });
    } catch (error) {
      console.error("agent-chat.post_failed", error);
      return respond(500, { error: "Failed to process message" });
    }
  }

  return respond(405, { error: "Method not allowed" });
});
