import { z } from "zod";
import {
  parseArray,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";

const toolRow = z.object({
  id: z.string().uuid(),
  tool_name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  json_schema: z.record(z.any()),
  rate_limit_per_minute: z.number().nullable(),
  enabled: z.boolean(),
  metadata: z.record(z.any()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type AgentToolRow = z.infer<typeof toolRow>;

export type AgentTool = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  jsonSchema: Record<string, unknown>;
  rateLimitPerMinute: number | null;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

function toAgentTool(row: AgentToolRow): AgentTool {
  return {
    id: row.id,
    name: row.tool_name,
    category: row.category,
    description: row.description,
    jsonSchema: row.json_schema,
    rateLimitPerMinute: row.rate_limit_per_minute,
    enabled: row.enabled,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAgentTools({
  includeDisabled = true,
}: { includeDisabled?: boolean } = {}) {
  const client = requireSupabaseAdminClient();
  let query = client.from("agent_tools_v").select("*");
  if (!includeDisabled) {
    query = query.eq("enabled", true);
  }
  query = query.order("tool_name", { ascending: true });

  const { data, error } = await query;
  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  return parseArray(toolRow, data ?? []).map(toAgentTool);
}
