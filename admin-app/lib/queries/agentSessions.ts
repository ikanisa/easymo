import { useQuery, UseQueryOptions, QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import { apiFetch } from "@/lib/api/client";
import { getAdminApiPath } from "@/lib/routes/api";

const jsonRecord = z.record(z.unknown());

const agentQuoteSchema = z
  .object({
    id: z.string(),
    session_id: z.string(),
    vendor_id: z.string().nullable().optional(),
    vendor_type: z.string(),
    vendor_name: z.string().nullable().optional(),
    offer_data: jsonRecord.nullable().optional().transform((value) => (value && typeof value === "object" ? value : {})),
    status: z.string(),
    responded_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    ranking_score: z.coerce.number().nullable().optional(),
    metadata: jsonRecord.nullable().optional().transform((value) => (value && typeof value === "object" ? value : {})),
    created_at: z.string(),
    updated_at: z.string().nullable().optional(),
  })
  .transform((quote) => ({
    ...quote,
    offer_data: quote.offer_data ?? {},
    metadata: quote.metadata ?? {},
  }));

type AgentQuoteSchema = z.infer<typeof agentQuoteSchema>;

const agentSessionSchema = z
  .object({
    id: z.string(),
    agent_type: z.string().nullable().optional(),
    flow_type: z.string().nullable().optional(),
    status: z.string(),
    request_data: jsonRecord.nullable().optional().transform((value) => (value && typeof value === "object" ? value : {})),
    started_at: z.string(),
    deadline_at: z.string(),
    completed_at: z.string().nullable().optional(),
    extensions_count: z.coerce.number().nullable().optional(),
    metadata: jsonRecord.nullable().optional().transform((value) => (value && typeof value === "object" ? value : {})),
    agent_quotes: z
      .array(
        z.object({
          count: z.coerce.number().optional(),
        }),
      )
      .nullable()
      .optional(),
  })
  .transform((session) => ({
    ...session,
    request_data: session.request_data ?? {},
    metadata: session.metadata ?? {},
    quotes_count: session.agent_quotes?.[0]?.count ?? 0,
  }));

type AgentSessionSchema = z.infer<typeof agentSessionSchema> & { quotes_count: number };

const agentSessionsResponseSchema = z.object({
  sessions: z.array(agentSessionSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
});

type AgentSessionsResponseSchema = z.infer<typeof agentSessionsResponseSchema>;

const agentSessionDetailSchema = z.object({
  session: agentSessionSchema,
  quotes: z.array(agentQuoteSchema),
});

type AgentSessionDetailSchema = z.infer<typeof agentSessionDetailSchema>;

export type AgentSession = AgentSessionDetailSchema["session"];
export type AgentQuote = AgentQuoteSchema;

export interface AgentSessionsQuery {
  status?: string;
  flowType?: string;
  agentType?: string;
  limit?: number;
  offset?: number;
}

function buildQueryString(params: AgentSessionsQuery) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.flowType) search.set("flow_type", params.flowType);
  if (params.agentType) search.set("agent_type", params.agentType);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  const raw = search.toString();
  return raw.length > 0 ? `?${raw}` : "";
}

export async function fetchAgentSessions(params: AgentSessionsQuery = {}): Promise<AgentSessionsResponseSchema> {
  const path = `${getAdminApiPath("agent-orchestration", "sessions")}${buildQueryString(params)}`;
  const json = await apiFetch(path, { method: "GET", cache: "no-store" });
  const parsed = agentSessionsResponseSchema.parse(json);
  return {
    ...parsed,
    sessions: parsed.sessions.map((session) => ({
      ...session,
      extensions_count: session.extensions_count ?? 0,
    })),
  };
}

export async function fetchAgentSessionDetail(id: string): Promise<AgentSessionDetailSchema> {
  const path = getAdminApiPath("agent-orchestration", "sessions", id);
  const json = await apiFetch(path, { method: "GET", cache: "no-store" });
  return agentSessionDetailSchema.parse(json);
}

export function getAgentSessionsQueryKey(params: AgentSessionsQuery = {}): QueryKey {
  return [
    "agent-sessions",
    params.status ?? "all",
    params.flowType ?? "all",
    params.agentType ?? "all",
    params.limit ?? "default",
    params.offset ?? 0,
  ];
}

export function getAgentSessionDetailKey(id?: string | null): QueryKey {
  return ["agent-session", id ?? "unknown"];
}

export function useAgentSessionsQuery(
  params: AgentSessionsQuery = {},
  options?: UseQueryOptions<AgentSessionsResponseSchema, Error>,
) {
  return useQuery({
    queryKey: getAgentSessionsQueryKey(params),
    queryFn: () => fetchAgentSessions(params),
    staleTime: 10_000,
    refetchInterval: 20_000,
    ...options,
  });
}

export function useAgentSessionDetailQuery(
  id: string | null | undefined,
  options?: UseQueryOptions<AgentSessionDetailSchema, Error>,
) {
  return useQuery({
    queryKey: getAgentSessionDetailKey(id ?? undefined),
    queryFn: () => {
      if (!id) throw new Error("session_not_selected");
      return fetchAgentSessionDetail(id);
    },
    enabled: Boolean(id),
    staleTime: 5_000,
    refetchInterval: 15_000,
    ...options,
  });
}

export type AgentSessionsResponse = AgentSessionsResponseSchema;
export type AgentSessionDetail = AgentSessionDetailSchema;
