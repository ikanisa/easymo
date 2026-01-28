import {
  getAgentCoreEndpointMethod,
  getAgentCoreEndpointPath,
} from "@easymo/commons";
import { z } from "zod";

import { ChatRequestSchema } from "./modules/chat/types.js";

const ChatResponseSchema = z
  .object({
    reply: z.string(),
    suggestions: z.array(z.string()).optional(),
  })
  .passthrough();

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  timestamp: z.string(),
});

const AnySchema = z.unknown();

export const serviceContract = {
  name: "agent-core",
  version: "1.0.0",
  endpoints: [
    {
      id: "chat.respond",
      method: getAgentCoreEndpointMethod("chat", "respond"),
      path: getAgentCoreEndpointPath("chat", "respond"),
      auth: "service",
      requestSchema: ChatRequestSchema,
      responseSchema: ChatResponseSchema,
    },
    {
      id: "health.status",
      method: getAgentCoreEndpointMethod("health", "status"),
      path: getAgentCoreEndpointPath("health", "status"),
      auth: "public",
      responseSchema: HealthResponseSchema,
    },
    {
      id: "ai.broker.orchestrate",
      method: getAgentCoreEndpointMethod("ai", "brokerOrchestrate"),
      path: getAgentCoreEndpointPath("ai", "brokerOrchestrate"),
      auth: "service",
      requestSchema: AnySchema,
      responseSchema: AnySchema,
    },
    {
      id: "tasks.schedule",
      method: getAgentCoreEndpointMethod("tasks", "schedule"),
      path: getAgentCoreEndpointPath("tasks", "schedule"),
      auth: "service",
      requestSchema: AnySchema,
      responseSchema: AnySchema,
    },
  ],
  events: [],
  dependencies: ["db", "supabase"],
} as const;

export type AgentCoreServiceContract = typeof serviceContract;
