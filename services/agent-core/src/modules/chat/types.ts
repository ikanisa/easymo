import { z } from "zod";

export const AgentKindSchema = z.enum(["broker", "support", "sales", "marketing", "mobility"]);

export const HistoryMessageSchema = z.object({
  role: z.enum(["user", "agent", "system"]),
  text: z.string().optional().nullable(),
  payload: z.record(z.any()).optional(),
  created_at: z.string().optional(),
});

export const ToolkitSchema = z.object({
  agent_kind: AgentKindSchema.optional(),
  model: z.string().optional(),
  reasoning_effort: z.enum(["minimal", "low", "medium", "high"]).optional(),
  text_verbosity: z.enum(["low", "medium", "high"]).optional(),
  web_search_enabled: z.boolean().optional(),
  web_search_allowed_domains: z.array(z.string()).nullable().optional(),
  web_search_user_location: z.record(z.any()).nullable().optional(),
  file_search_enabled: z.boolean().optional(),
  file_vector_store_id: z.string().nullable().optional(),
  file_search_max_results: z.number().int().nullable().optional(),
  retrieval_enabled: z.boolean().optional(),
  retrieval_vector_store_id: z.string().nullable().optional(),
  retrieval_max_results: z.number().int().nullable().optional(),
  retrieval_rewrite: z.boolean().optional(),
  image_generation_enabled: z.boolean().optional(),
  image_preset: z.record(z.any()).nullable().optional(),
  allowed_tools: z.array(z.record(z.any())).nullable().optional(),
  suggestions: z.array(z.string()).nullable().optional(),
  streaming_partial_images: z.number().int().nullable().optional(),
  metadata: z.record(z.any()).nullable().optional(),
}).partial();

export const ChatRequestSchema = z.object({
  session_id: z.string().uuid(),
  agent_kind: AgentKindSchema,
  message: z.string().min(1),
  profile_ref: z.string().nullable().optional(),
  history: z.array(HistoryMessageSchema).optional().default([]),
  toolkit: ToolkitSchema.nullable().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatHistoryMessage = z.infer<typeof HistoryMessageSchema>;
export type ToolkitConfig = z.infer<typeof ToolkitSchema>;
