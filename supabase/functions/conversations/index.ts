// Supabase Edge Function: conversations
//
// Provides CRUD operations for stored WhatsApp / agent conversations and
// their associated message items. The API mirrors the Conversations
// endpoints documented in the OpenAPI specification, enabling admin tools
// to fetch transcripts, append audit notes, or enrich metadata.

import { serve } from "$std/http/server.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServiceClient } from "shared/supabase.ts";
import { getAdminToken } from "shared/env.ts";

const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type,x-admin-token,x-api-key",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
};

const MetadataSchema = z.record(z.string().max(512)).superRefine((meta, ctx) => {
  const keys = Object.keys(meta);
  if (keys.length > 16) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "metadata supports up to 16 keys",
    });
  }
  for (const key of keys) {
    if (key.length > 64) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `metadata key \"${key}\" exceeds 64 characters`,
      });
    }
  }
});

const ContentPartSchema = z.object({
  type: z.string().min(1),
  text: z.string().optional(),
  image_url: z.string().url().optional(),
}).strict();

const ConversationItemSchema = z.object({
  type: z.string().min(1).default("message"),
  role: z.string().optional(),
  status: z.string().optional(),
  content: z.array(ContentPartSchema).max(50).optional(),
}).strict();

const ConversationCreateSchema = z.object({
  metadata: MetadataSchema.optional(),
  items: z.array(ConversationItemSchema).max(20).optional(),
}).strict();

const ConversationUpdateSchema = z.object({
  metadata: MetadataSchema,
}).strict();

const ItemsCreateSchema = z.object({
  items: z.array(ConversationItemSchema).min(1).max(20),
}).strict();

let supabase: SupabaseClient = getServiceClient();

export function setSupabaseClientForTesting(client: SupabaseClient | null) {
  supabase = client ?? getServiceClient();
}

function withCors(init: ResponseInit = {}): ResponseInit {
  const headers = new Headers(init.headers ?? {});
  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return { ...init, headers };
}

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), withCors({ status }));
}

function noContent(): Response {
  return new Response(null, withCors({ status: 204 }));
}

function unauthorized(): Response {
  return respond(401, { error: "unauthorized" });
}

function badRequest(message: string, extra?: Record<string, unknown>): Response {
  return respond(400, { error: message, ...(extra ?? {}) });
}

function serverError(message: string): Response {
  return respond(500, { error: message });
}

function notFound(message = "not_found"): Response {
  return respond(404, { error: message });
}

function methodNotAllowed(allowed: string[]): Response {
  return respond(405, { error: "method_not_allowed", allowed });
}

function ensureAdmin(req: Request): Response | null {
  const token = getAdminToken();
  if (!token) {
    console.warn("conversations.missing_admin_token");
    return unauthorized();
  }
  const provided = req.headers.get("x-api-key") ?? req.headers.get("x-admin-token");
  if (!provided || provided !== token) {
    return unauthorized();
  }
  return null;
}

function parseRoute(pathname: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  const index = segments.lastIndexOf("conversations");
  if (index === -1) return [];
  return segments.slice(index + 1);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type ConversationRow = {
  id: string;
  created_at: string | null;
  metadata?: Record<string, unknown> | null;
};

type MessageRow = {
  id: number;
  dir: string;
  body: Record<string, unknown> | null;
  created_at: string | null;
};

function sanitizeMetadata(meta?: Record<string, unknown> | null):
  | Record<string, string>
  | undefined {
  if (!meta || typeof meta !== "object") return undefined;
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(meta)) {
    if (!key || typeof key !== "string") continue;
    if (value === undefined || value === null) continue;
    entries.push([key, String(value)]);
  }
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries);
}

function toUnixSeconds(value: string | null): number {
  if (!value) return Math.floor(Date.now() / 1000);
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return Math.floor(Date.now() / 1000);
  return Math.floor(timestamp / 1000);
}

function mapConversation(row: ConversationRow) {
  const metadata = sanitizeMetadata(row.metadata ?? undefined);
  return {
    id: row.id,
    object: "conversation",
    created_at: toUnixSeconds(row.created_at),
    ...(metadata ? { metadata } : {}),
  };
}

type ContentPart = {
  type: string;
  text?: string;
  image_url?: string;
};

function sanitizeContentParts(parts: unknown): ContentPart[] {
  if (!Array.isArray(parts)) return [];
  const results: ContentPart[] = [];
  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const record = part as Record<string, unknown>;
    const type = typeof record.type === "string" && record.type.trim().length
      ? record.type
      : null;
    if (!type) continue;
    const content: ContentPart = { type };
    if (typeof record.text === "string") content.text = record.text;
    if (typeof record.image_url === "string") content.image_url = record.image_url;
    results.push(content);
  }
  return results;
}

function extractFallbackContent(body: Record<string, unknown> | null): ContentPart[] {
  if (!body) return [];
  const textFields = [
    typeof body.text === "string" ? body.text : null,
    typeof (body.text as Record<string, unknown> | undefined)?.body === "string"
      ? (body.text as Record<string, unknown>).body as string
      : null,
    typeof body.body === "string" ? body.body : null,
    typeof (body.message as Record<string, unknown> | undefined)?.text === "string"
      ? (body.message as Record<string, unknown>).text as string
      : null,
    typeof (body.message as Record<string, unknown> | undefined)?.body === "string"
      ? (body.message as Record<string, unknown>).body as string
      : null,
  ];
  const candidate = textFields.find((text) => typeof text === "string" && text.length > 0);
  if (candidate) {
    return [{ type: "input_text", text: candidate }];
  }
  try {
    const json = JSON.stringify(body);
    if (json && json !== "{}") {
      return [{ type: "json", text: json }];
    }
  } catch (_) {
    // ignore
  }
  return [];
}

function mapMessage(row: MessageRow) {
  const body = (row.body ?? {}) as Record<string, unknown>;
  const role = typeof body.role === "string"
    ? body.role
    : row.dir === "out"
    ? "assistant"
    : "user";
  const content = sanitizeContentParts(body.content);
  const finalContent = content.length ? content : extractFallbackContent(body);
  return {
    type: typeof body.type === "string" && body.type.length ? body.type : "message",
    id: String(row.id),
    status: typeof body.status === "string" && body.status.length
      ? body.status
      : "completed",
    role,
    content: finalContent,
  };
}

function dirFromRole(role?: string | null): "in" | "out" {
  if (!role) return "in";
  const normalized = role.toLowerCase();
  if (normalized === "assistant" || normalized === "agent" || normalized === "system") {
    return "out";
  }
  return "in";
}

async function loadConversation(conversationId: string): Promise<ConversationRow | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, created_at, metadata")
    .eq("id", conversationId)
    .maybeSingle();
  if (error) throw error;
  return data as ConversationRow | null;
}

async function insertItems(
  conversationId: string,
  items: z.infer<typeof ConversationItemSchema>[],
): Promise<MessageRow[]> {
  const payload = items.map((item) => {
    const content = sanitizeContentParts(item.content ?? []);
    return {
      conversation_id: conversationId,
      dir: dirFromRole(item.role),
      body: {
        type: item.type ?? "message",
        role: item.role ?? "user",
        status: item.status ?? "completed",
        content,
      },
    };
  });
  const { data, error } = await supabase
    .from("messages")
    .insert(payload)
    .select("id, dir, body, created_at")
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as MessageRow[];
}

async function listItems(
  conversationId: string,
  limit: number,
  after: number | null,
  order: "asc" | "desc",
): Promise<{ rows: MessageRow[]; hasMore: boolean }> {
  let query = supabase
    .from("messages")
    .select("id, dir, body, created_at")
    .eq("conversation_id", conversationId);
  if (after !== null) {
    query = order === "asc"
      ? query.gt("id", after)
      : query.lt("id", after);
  }
  query = query.order("id", { ascending: order === "asc" }).limit(limit + 1);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as MessageRow[];
  const hasMore = rows.length > limit;
  if (hasMore) {
    if (order === "asc") {
      rows.splice(0, rows.length - limit);
    } else {
      rows.splice(limit);
    }
  }
  if (order === "desc") rows.sort((a, b) => b.id - a.id);
  return { rows, hasMore };
}

function parseAfterParam(value: string | null, order: "asc" | "desc"): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error("invalid_after");
  }
  if (order === "desc" && numeric === 0) {
    throw new Error("invalid_after");
  }
  return Math.floor(numeric);
}

function buildListResponse(rows: MessageRow[], hasMore: boolean) {
  const data = rows.map(mapMessage);
  const payload: Record<string, unknown> = {
    object: "list",
    data,
    has_more: hasMore,
  };
  const first = data[0]?.id;
  const last = data[data.length - 1]?.id;
  if (first) payload.first_id = first;
  if (last) payload.last_id = last;
  return payload;
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return noContent();
  }

  const guard = ensureAdmin(req);
  if (guard) return guard;

  const url = new URL(req.url);
  const route = parseRoute(url.pathname);
  if (!url.pathname.includes("conversations")) {
    return notFound();
  }

  if (route.length === 0) {
    if (req.method !== "POST") {
      return methodNotAllowed(["POST"]);
    }
    const payload = await req.json().catch(() => ({}));
    const parsed = ConversationCreateSchema.safeParse(payload);
    if (!parsed.success) {
      return badRequest("invalid_payload", { details: parsed.error.flatten() });
    }
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          channel: "api",
          role: "agent",
          metadata: parsed.data.metadata ?? {},
        })
        .select("id, created_at, metadata")
        .single();
      if (error) throw error;
      const conversation = data as ConversationRow;
      if (parsed.data.items && parsed.data.items.length) {
        await insertItems(conversation.id, parsed.data.items);
      }
      return respond(200, mapConversation(conversation));
    } catch (error) {
      console.error("conversations.create_failed", error);
      return serverError("failed_to_create_conversation");
    }
  }

  const conversationId = route[0];
  if (!isUuid(conversationId)) {
    return badRequest("invalid_conversation_id");
  }

  if (route.length === 1) {
    if (req.method === "GET") {
      try {
        const conversation = await loadConversation(conversationId);
        if (!conversation) return notFound("conversation_not_found");
        return respond(200, mapConversation(conversation));
      } catch (error) {
        console.error("conversations.fetch_failed", error);
        return serverError("failed_to_fetch_conversation");
      }
    }
    if (req.method === "POST") {
      const payload = await req.json().catch(() => ({}));
      const parsed = ConversationUpdateSchema.safeParse(payload);
      if (!parsed.success) {
        return badRequest("invalid_payload", { details: parsed.error.flatten() });
      }
      try {
        const { data, error } = await supabase
          .from("conversations")
          .update({ metadata: parsed.data.metadata })
          .eq("id", conversationId)
          .select("id, created_at, metadata")
          .maybeSingle();
        if (error) throw error;
        if (!data) return notFound("conversation_not_found");
        return respond(200, mapConversation(data as ConversationRow));
      } catch (error) {
        console.error("conversations.update_failed", error);
        return serverError("failed_to_update_conversation");
      }
    }
    if (req.method === "DELETE") {
      try {
        const { data, error } = await supabase
          .from("conversations")
          .delete()
          .eq("id", conversationId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) return notFound("conversation_not_found");
        return respond(200, {
          id: conversationId,
          object: "conversation.deleted",
          deleted: true,
        });
      } catch (error) {
        console.error("conversations.delete_failed", error);
        return serverError("failed_to_delete_conversation");
      }
    }
    return methodNotAllowed(["GET", "POST", "DELETE"]);
  }

  if (route.length === 2 && route[1] === "items") {
    if (req.method === "GET") {
      try {
        const conversation = await loadConversation(conversationId);
        if (!conversation) return notFound("conversation_not_found");
        const orderParam = url.searchParams.get("order") === "asc" ? "asc" : "desc";
        const limitParam = url.searchParams.get("limit");
        const parsedLimit = limitParam ? Number(limitParam) : 20;
        if (!Number.isFinite(parsedLimit)) {
          return badRequest("invalid_limit");
        }
        const limit = Math.floor(parsedLimit);
        if (limit < 1 || limit > 100) {
          return badRequest("invalid_limit");
        }
        let after: number | null = null;
        try {
          after = parseAfterParam(url.searchParams.get("after"), orderParam);
        } catch (_) {
          return badRequest("invalid_after");
        }
        const { rows, hasMore } = await listItems(conversationId, limit, after, orderParam);
        return respond(200, buildListResponse(rows, hasMore));
      } catch (error) {
        console.error("conversations.list_items_failed", error);
        return serverError("failed_to_list_items");
      }
    }
    if (req.method === "POST") {
      const payload = await req.json().catch(() => ({}));
      const parsed = ItemsCreateSchema.safeParse(payload);
      if (!parsed.success) {
        return badRequest("invalid_payload", { details: parsed.error.flatten() });
      }
      try {
        const conversation = await loadConversation(conversationId);
        if (!conversation) return notFound("conversation_not_found");
        const rows = await insertItems(conversationId, parsed.data.items);
        return respond(200, buildListResponse(rows, false));
      } catch (error) {
        console.error("conversations.create_items_failed", error);
        return serverError("failed_to_create_items");
      }
    }
    return methodNotAllowed(["GET", "POST"]);
  }

  if (route.length === 3 && route[1] === "items") {
    const itemId = Number(route[2]);
    if (!Number.isFinite(itemId) || itemId < 0) {
      return badRequest("invalid_item_id");
    }
    if (req.method === "GET") {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("id, dir, body, created_at")
          .eq("conversation_id", conversationId)
          .eq("id", itemId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return notFound("item_not_found");
        return respond(200, mapMessage(data as MessageRow));
      } catch (error) {
        console.error("conversations.fetch_item_failed", error);
        return serverError("failed_to_fetch_item");
      }
    }
    if (req.method === "DELETE") {
      try {
        const { data, error } = await supabase
          .from("messages")
          .delete()
          .eq("conversation_id", conversationId)
          .eq("id", itemId)
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!data) return notFound("item_not_found");
        const conversation = await loadConversation(conversationId);
        if (!conversation) return notFound("conversation_not_found");
        return respond(200, mapConversation(conversation));
      } catch (error) {
        console.error("conversations.delete_item_failed", error);
        return serverError("failed_to_delete_item");
      }
    }
    return methodNotAllowed(["GET", "DELETE"]);
  }

  return notFound();
};

serve(handler);
