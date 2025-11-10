import { z } from "zod";
import {
  parseArray,
  parseRecord,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";
import { listCandidatesForSession, NegotiationCandidate } from "./candidates";

const negotiationThreadRow = z.object({
  session_id: z.string().uuid(),
  agent_type: z.string(),
  agent_name: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  whatsapp_e164: z.string().nullable(),
  status: z.string(),
  started_at: z.string(),
  deadline_at: z.string(),
  completed_at: z.string().nullable(),
  extensions_count: z.number(),
  metadata: z.record(z.any()),
  quotes_count: z.number(),
  sla_minutes: z.number().nullable(),
  elapsed_seconds: z.number().nullable(),
  remaining_seconds: z.number().nullable(),
  breached: z.boolean().nullable(),
  last_message_at: z.string().nullable(),
});

const negotiationMessageRow = z.object({
  session_id: z.string().uuid(),
  message_id: z.string().uuid(),
  message_type: z.string(),
  author_role: z.string().nullable(),
  body: z.string().nullable(),
  quote_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type NegotiationThreadRow = z.infer<typeof negotiationThreadRow>;
export type NegotiationMessageRow = z.infer<typeof negotiationMessageRow>;

export type NegotiationThreadSummary = {
  sessionId: string;
  agentType: string;
  agentName: string | null;
  userId: string | null;
  whatsappE164: string | null;
  status: string;
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  extensionsCount: number;
  metadata: Record<string, unknown>;
  quotesCount: number;
  slaMinutes: number | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  breached: boolean;
  lastMessageAt: string | null;
};

export type NegotiationMessage = {
  sessionId: string;
  messageId: string;
  messageType: string;
  authorRole: string | null;
  body: string | null;
  quoteId: string | null;
  createdAt: string;
};

export type NegotiationThread = {
  summary: NegotiationThreadSummary;
  messages: NegotiationMessage[];
  candidates: NegotiationCandidate[];
};

function toNegotiationThread(row: NegotiationThreadRow): NegotiationThreadSummary {
  return {
    sessionId: row.session_id,
    agentType: row.agent_type,
    agentName: row.agent_name,
    userId: row.user_id,
    whatsappE164: row.whatsapp_e164,
    status: row.status,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    completedAt: row.completed_at,
    extensionsCount: row.extensions_count,
    metadata: row.metadata,
    quotesCount: row.quotes_count,
    slaMinutes: row.sla_minutes ?? null,
    elapsedSeconds: row.elapsed_seconds ?? null,
    remainingSeconds: row.remaining_seconds ?? null,
    breached: Boolean(row.breached),
    lastMessageAt: row.last_message_at,
  };
}

function toNegotiationMessage(row: NegotiationMessageRow): NegotiationMessage {
  return {
    sessionId: row.session_id,
    messageId: row.message_id,
    messageType: row.message_type,
    authorRole: row.author_role,
    body: row.body,
    quoteId: row.quote_id,
    createdAt: row.created_at,
  };
}

export async function listNegotiationThreads(limit = 50) {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("negotiation_threads_v")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  return parseArray(negotiationThreadRow, data ?? []).map(toNegotiationThread);
}

export async function getNegotiationThread(
  sessionId: string,
): Promise<NegotiationThread | null> {
  const client = requireSupabaseAdminClient();

  const [{ data: threadRow, error: threadError }, { data: messageRows, error: messageError }] =
    await Promise.all([
      client
        .from("negotiation_threads_v")
        .select("*")
        .eq("session_id", sessionId)
        .maybeSingle(),
      client
        .from("negotiation_messages_v")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true }),
    ]);

  if (threadError) {
    throw new SupabaseQueryError(threadError.message);
  }

  if (messageError) {
    throw new SupabaseQueryError(messageError.message);
  }

  if (!threadRow) {
    return null;
  }

  const summary = toNegotiationThread(parseRecord(negotiationThreadRow, threadRow));
  const messages = parseArray(negotiationMessageRow, messageRows ?? []).map(toNegotiationMessage);
  const candidates = await listCandidatesForSession(sessionId);

  return { summary, messages, candidates };
}
