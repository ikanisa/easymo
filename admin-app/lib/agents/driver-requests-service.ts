import { z } from "zod";
import { driverRequestSchema } from "@/lib/schemas";

const responseSchema = z.object({
  requests: z.array(driverRequestSchema),
  total: z.number(),
  hasMore: z.boolean(),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type DriverRequestsResponse = z.infer<typeof responseSchema>;

type ListParams = {
  limit?: number;
  offset?: number;
  status?: string;
};

export async function listDriverRequests(
  params: ListParams = {},
): Promise<DriverRequestsResponse> {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  if (params.status) search.set("status", params.status);

  const response = await fetch(
    `/api/agents/driver-requests${search.toString() ? `?${search}` : ""}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error("Unable to load driver requests.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}
