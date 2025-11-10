export const dynamic = "force-dynamic";

import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { logStructured } from "@/lib/server/logger";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  agentType: z.string().min(1),
  flowType: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

type SessionRow = {
  id: string;
  agent_type: string;
  flow_type: string | null;
  status: string;
  started_at: string;
  completed_at: string | null;
  request_data: Record<string, unknown> | null;
  wa_thread_id: string | null;
  user_id: string | null;
};

type QuoteRow = {
  id: string;
  session_id: string;
  vendor_id: string | null;
  vendor_type: string;
  vendor_name: string | null;
  offer_data: Record<string, unknown> | null;
  status: string;
  responded_at: string | null;
  ranking_score: number | null;
  metadata: Record<string, unknown> | null;
};

type ResponseRow = {
  id: string;
  session_id: string;
  quote_id: string | null;
  vendor_id: string | null;
  vendor_type: string;
  request_message: string | null;
  response_message: string | null;
  response_parsed: Record<string, unknown> | null;
  channel: string;
  sent_at: string | null;
  received_at: string | null;
  metadata: Record<string, unknown> | null;
};

type ThreadRow = {
  id: string;
  wa_conversation_id: string | null;
  customer_msisdn: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  direction: "user" | "assistant";
  content: string | null;
  agent_display_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function normaliseCoordinates(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const coords = value as { type?: string; coordinates?: [number, number] };
  if (!Array.isArray(coords.coordinates)) return null;
  const [lng, lat] = coords.coordinates;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { lat, lng };
}

export const GET = createHandler(
  "admin_api.marketplace.agent_sessions.list",
  async (request, _context, { recordMetric }) => {
    const adminClient = getSupabaseAdminClient();
    if (!adminClient) {
      recordMetric("marketplace.agent_sessions.supabase_unavailable", 1);
      return jsonError(
        {
          error: "supabase_unavailable",
          message: "Supabase credentials missing. Unable to fetch marketplace sessions.",
        },
        503,
      );
    }

    let query: z.infer<typeof querySchema>;
    try {
      query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    } catch (error) {
      recordMetric("marketplace.agent_sessions.invalid_query", 1);
      return zodValidationError(error);
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 25;

    const baseQuery = adminClient
      .from("agent_sessions")
      .select(
        "id, agent_type, flow_type, status, started_at, completed_at, request_data, wa_thread_id, user_id",
        { count: "exact" },
      )
      .eq("agent_type", query.agentType)
      .order("started_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.flowType) {
      baseQuery.eq("flow_type", query.flowType);
    }

    const { data: sessions, error: sessionError, count } = await baseQuery;
    if (sessionError) {
      logStructured({
        event: "marketplace_agent_sessions_fetch_failed",
        target: "agent_sessions",
        status: "error",
        message: sessionError.message,
      });
      recordMetric("marketplace.agent_sessions.supabase_error", 1, { message: sessionError.message });
      return jsonError(
        { error: "agent_sessions_fetch_failed", message: "Unable to load marketplace sessions." },
        500,
      );
    }

    const sessionRows = (sessions ?? []) as SessionRow[];
    const sessionIds = sessionRows.map((row) => row.id);

    let quotesBySession: Record<string, QuoteRow[]> = {};
    if (sessionIds.length) {
      const { data: quotes, error: quotesError } = await adminClient
        .from("agent_quotes")
        .select(
          "id, session_id, vendor_id, vendor_type, vendor_name, offer_data, status, responded_at, ranking_score, metadata",
        )
        .in("session_id", sessionIds);

      if (quotesError) {
        recordMetric("marketplace.agent_sessions.quotes_error", 1, { message: quotesError.message });
        logStructured({
          event: "marketplace_agent_quotes_fetch_failed",
          target: "agent_quotes",
          status: "error",
          message: quotesError.message,
        });
      } else if (quotes) {
        quotesBySession = quotes.reduce<Record<string, QuoteRow[]>>((acc, row) => {
          if (!acc[row.session_id]) acc[row.session_id] = [];
          acc[row.session_id].push(row as QuoteRow);
          return acc;
        }, {});
      }
    }

    let responsesBySession: Record<string, ResponseRow[]> = {};
    if (sessionIds.length) {
      const { data: responses, error: responseError } = await adminClient
        .from("vendor_quote_responses")
        .select(
          "id, session_id, quote_id, vendor_id, vendor_type, request_message, response_message, response_parsed, channel, sent_at, received_at, metadata",
        )
        .in("session_id", sessionIds)
        .order("received_at", { ascending: false });

      if (responseError) {
        recordMetric("marketplace.agent_sessions.responses_error", 1, { message: responseError.message });
        logStructured({
          event: "marketplace_vendor_responses_fetch_failed",
          target: "vendor_quote_responses",
          status: "error",
          message: responseError.message,
        });
      } else if (responses) {
        responsesBySession = responses.reduce<Record<string, ResponseRow[]>>((acc, row) => {
          if (!acc[row.session_id]) acc[row.session_id] = [];
          acc[row.session_id].push(row as ResponseRow);
          return acc;
        }, {});
      }
    }

    const conversationKeys = sessionRows
      .map((row) => row.wa_thread_id)
      .filter((value): value is string => Boolean(value));

    let threadsByConversation: Map<string, ThreadRow> = new Map();
    let messagesByThread: Record<string, MessageRow[]> = {};

    if (conversationKeys.length) {
      const { data: threads, error: threadError } = await adminClient
        .from("wa_threads")
        .select("id, wa_conversation_id, customer_msisdn, last_message_at")
        .in("wa_conversation_id", conversationKeys);

      if (threadError) {
        recordMetric("marketplace.agent_sessions.threads_error", 1, { message: threadError.message });
        logStructured({
          event: "marketplace_wa_threads_fetch_failed",
          target: "wa_threads",
          status: "error",
          message: threadError.message,
        });
      } else if (threads) {
        threadsByConversation = new Map(
          (threads as ThreadRow[]).map((thread) => [thread.wa_conversation_id ?? "", thread]),
        );

        const threadIds = (threads as ThreadRow[])
          .map((thread) => thread.id)
          .filter((value): value is string => Boolean(value));

        if (threadIds.length) {
          const { data: messages, error: messageError } = await adminClient
            .from("wa_messages")
            .select("id, thread_id, direction, content, agent_display_name, metadata, created_at")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: true });

          if (messageError) {
            recordMetric("marketplace.agent_sessions.messages_error", 1, { message: messageError.message });
            logStructured({
              event: "marketplace_wa_messages_fetch_failed",
              target: "wa_messages",
              status: "error",
              message: messageError.message,
            });
          } else if (messages) {
            messagesByThread = (messages as MessageRow[]).reduce<Record<string, MessageRow[]>>((acc, row) => {
              if (!acc[row.thread_id]) acc[row.thread_id] = [];
              acc[row.thread_id].push(row);
              return acc;
            }, {});
          }
        }
      }
    }

    const enriched = sessionRows.map((session) => {
      const quotes = quotesBySession[session.id] ?? [];
      const responses = responsesBySession[session.id] ?? [];
      const thread = session.wa_thread_id ? threadsByConversation.get(session.wa_thread_id) : undefined;
      const threadMessages = thread ? messagesByThread[thread.id] ?? [] : [];

      return {
        id: session.id,
        agentType: session.agent_type,
        flowType: session.flow_type,
        status: session.status,
        startedAt: session.started_at,
        completedAt: session.completed_at,
        requestData: session.request_data ?? {},
        customer: {
          msisdn: thread?.customer_msisdn ?? (session.request_data as any)?.customer_msisdn ?? null,
          location: normaliseCoordinates((session.request_data as any)?.location),
        },
        waThreadId: session.wa_thread_id,
        quotes: quotes.map((quote) => ({
          id: quote.id,
          vendorId: quote.vendor_id,
          vendorType: quote.vendor_type,
          vendorName: quote.vendor_name,
          offerData: quote.offer_data ?? {},
          status: quote.status,
          respondedAt: quote.responded_at,
          rankingScore: quote.ranking_score,
          metadata: quote.metadata ?? {},
        })),
        vendorResponses: responses.map((response) => ({
          id: response.id,
          quoteId: response.quote_id,
          vendorId: response.vendor_id,
          vendorType: response.vendor_type,
          channel: response.channel,
          requestMessage: response.request_message,
          responseMessage: response.response_message,
          parsed: response.response_parsed ?? {},
          sentAt: response.sent_at,
          receivedAt: response.received_at,
          metadata: response.metadata ?? {},
        })),
        conversation: thread
          ? {
              threadId: thread.id,
              conversationId: thread.wa_conversation_id,
              customerMsisdn: thread.customer_msisdn,
              lastMessageAt: thread.last_message_at,
              messages: threadMessages.map((message) => ({
                id: message.id,
                direction: message.direction,
                content: message.content ?? "",
                agentDisplayName: message.agent_display_name,
                metadata: message.metadata ?? {},
                createdAt: message.created_at,
              })),
            }
          : null,
      };
    });

    const total = count ?? enriched.length;
    const hasMore = offset + enriched.length < total;

    recordMetric("marketplace.agent_sessions.success", 1, {
      agentType: query.agentType,
      count: enriched.length,
    });

    return jsonOk({ data: enriched, total, hasMore });
  },
);

export const runtime = "nodejs";
