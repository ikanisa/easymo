import { z } from "zod";

import {
  adminHubSectionsSchema,
  type AdminHubSnapshot,
  adminHubSnapshotSchema,
} from "@/lib/schemas";

const flowExchangeMessageSchema = z.object({
  type: z.enum(["info", "warning", "error"]),
  text: z.string(),
});

const flowExchangeResponseSchema = z.object({
  next_screen_id: z.string(),
  data: z.unknown().optional(),
  page_token_next: z.string().nullable().optional(),
  messages: z.array(flowExchangeMessageSchema).optional(),
  field_errors: z.record(z.string()).optional(),
});

const adminHubDataSchema = z.object({
  sections: adminHubSectionsSchema,
});

const flowExchangeAdminHubSchema = flowExchangeResponseSchema.extend({
  data: adminHubDataSchema.optional(),
});

export function parseAdminHubSnapshotFromFlowExchange(
  payload: unknown,
): AdminHubSnapshot {
  const parsed = flowExchangeAdminHubSchema.parse(payload);
  const sections = adminHubSectionsSchema.parse(parsed.data?.sections ?? {});
  const messages = (parsed.messages ?? []).map((msg) => msg.text);
  return adminHubSnapshotSchema.parse({
    sections,
    messages,
  });
}

export type FlowExchangeAdminHubResponse = z.infer<
  typeof flowExchangeAdminHubSchema
>;
