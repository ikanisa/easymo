import { z } from "zod";

import {
  parseArray,
  requireSupabaseAdminClient,
  SupabaseQueryError,
} from "./utils";

const knowledgeAssetRow = z.object({
  id: z.string().uuid(),
  agent_id: z.string().uuid(),
  agent_name: z.string(),
  title: z.string(),
  source_url: z.string().nullable(),
  storage_path: z.string().nullable(),
  embedding_status: z.string(),
  metadata: z.record(z.any()),
  created_at: z.string(),
});

export type KnowledgeAssetRow = z.infer<typeof knowledgeAssetRow>;

export type KnowledgeAsset = {
  id: string;
  agentId: string;
  agentName: string;
  title: string;
  sourceUrl: string | null;
  storagePath: string | null;
  embeddingStatus: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function toKnowledgeAsset(row: KnowledgeAssetRow): KnowledgeAsset {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    title: row.title,
    sourceUrl: row.source_url,
    storagePath: row.storage_path,
    embeddingStatus: row.embedding_status,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export async function listKnowledgeAssets(agentId?: string) {
  const client = requireSupabaseAdminClient();
  let query = client.from("agent_knowledge_assets_v").select("*");
  if (agentId) {
    query = query.eq("agent_id", agentId);
  }
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new SupabaseQueryError(error.message);
  }

  return parseArray(knowledgeAssetRow, data ?? []).map(toKnowledgeAsset);
}
