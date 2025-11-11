import { z } from "zod";
import {
  pharmacyRequestSchema,
  type PharmacyRequest,
} from "@/lib/schemas";

const responseSchema = z.object({
  requests: z.array(pharmacyRequestSchema),
  total: z.number(),
  hasMore: z.boolean(),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type PharmacyRequestsResponse = {
  requests: PharmacyRequest[];
  total: number;
  hasMore: boolean;
  integration: {
    status: "ok" | "degraded";
    target: string;
    message?: string;
    remediation?: string;
  };
};

export async function listPharmacyRequests(): Promise<PharmacyRequestsResponse> {
  const response = await fetch("/api/agents/pharmacy-requests", {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Unable to load pharmacy requests.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}
