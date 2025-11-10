import { z } from "zod";
import {
  parseArray,
  parseRecord,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";

const agentRequestRow = z.object({
  session_id: z.string().uuid(),
  agent_type: z.string(),
  agent_name: z.string().nullable(),
  user_id: z.string().uuid().nullable(),
  whatsapp_e164: z.string().nullable(),
  status: z.string(),
  request_data: z.record(z.any()),
  started_at: z.string(),
  deadline_at: z.string(),
  completed_at: z.string().nullable(),
  extensions_count: z.number(),
  metadata: z.record(z.any()),
  quotes_count: z.number(),
});

export type AgentRequestRow = z.infer<typeof agentRequestRow>;

export type AgentRequest = {
  sessionId: string;
  agentType: string;
  agentName: string | null;
  userId: string | null;
  whatsappE164: string | null;
  status: string;
  requestData: Record<string, unknown>;
  startedAt: string;
  deadlineAt: string;
  completedAt: string | null;
  extensionsCount: number;
  metadata: Record<string, unknown>;
  quotesCount: number;
};

export type ListAgentRequestsParams = {
  agentType?: string;
  status?: string;
  limit?: number;
};

function toAgentRequest(row: AgentRequestRow): AgentRequest {
  return {
    sessionId: row.session_id,
    agentType: row.agent_type,
    agentName: row.agent_name,
    userId: row.user_id,
    whatsappE164: row.whatsapp_e164,
    status: row.status,
    requestData: row.request_data,
    startedAt: row.started_at,
    deadlineAt: row.deadline_at,
    completedAt: row.completed_at,
    extensionsCount: row.extensions_count,
    metadata: row.metadata,
    quotesCount: row.quotes_count,
  };
}

export async function listAgentRequests(
  params: ListAgentRequestsParams = {},
): Promise<AgentRequest[]> {
  const client = requireSupabaseAdminClient();
  let query = client.from("agent_requests_v").select("*");

  if (params.agentType) {
    query = query.eq("agent_type", params.agentType);
  }
  if (params.status) {
    query = query.eq("status", params.status);
  }

  const limit = params.limit ?? 50;
  if (limit > 0) {
    query = query.limit(limit);
  }

  query = query.order("started_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  const parsed = parseArray(agentRequestRow, data ?? []);
  return parsed.map(toAgentRequest);
}

export async function getAgentRequest(sessionId: string): Promise<AgentRequest | null> {
  const client = requireSupabaseAdminClient();
  const { data, error } = await client
    .from("agent_requests_v")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  if (!data) {
    return null;
  }

  const parsed = parseRecord(agentRequestRow, data);
  return toAgentRequest(parsed);
}
