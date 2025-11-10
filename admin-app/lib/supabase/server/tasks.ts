import { z } from "zod";
import {
  parseArray,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";

const taskRow = z.object({
  id: z.string().uuid(),
  agent_id: z.string().uuid(),
  agent_name: z.string(),
  title: z.string(),
  status: z.string(),
  payload: z.record(z.any()),
  created_by: z.string().uuid().nullable(),
  assigned_to: z.string().uuid().nullable(),
  due_at: z.string().nullable(),
  created_at: z.string(),
});

export type AgentTaskRow = z.infer<typeof taskRow>;

export type AgentTask = {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  status: string;
  payload: Record<string, unknown>;
  createdBy: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  createdAt: string;
};

function toAgentTask(row: AgentTaskRow): AgentTask {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    title: row.title,
    status: row.status,
    payload: row.payload,
    createdBy: row.created_by,
    assignedTo: row.assigned_to,
    dueAt: row.due_at,
    createdAt: row.created_at,
  };
}

export async function listAgentTasks(agentId?: string) {
  const client = requireSupabaseAdminClient();
  let query = client.from("agent_tasks_v").select("*");
  if (agentId) {
    query = query.eq("agent_id", agentId);
  }
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  return parseArray(taskRow, data ?? []).map(toAgentTask);
}
