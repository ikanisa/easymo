import { z } from "zod";

import { shopSchema } from "@/lib/schemas";

const responseSchema = z.object({
  shops: z.array(shopSchema),
  total: z.number(),
  hasMore: z.boolean(),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type AgentShopsResponse = z.infer<typeof responseSchema>;
export const agentShopsQueryKey = ["agent-shops"] as const;

export async function listShops(): Promise<AgentShopsResponse> {
  const response = await fetch("/api/agents/shops", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load shops.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}

export function fetchAgentShops() {
  return listShops();
}
