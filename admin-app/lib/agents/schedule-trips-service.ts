import { z } from "zod";
import { scheduledTripSchema } from "@/lib/schemas";

const responseSchema = z.object({
  trips: z.array(scheduledTripSchema),
  integration: z.object({
    status: z.enum(["ok", "degraded"]),
    target: z.string(),
    message: z.string().optional(),
    remediation: z.string().optional(),
  }),
});

export type ScheduledTripsResponse = z.infer<typeof responseSchema>;

type ListParams = {
  status?: string;
  limit?: number;
};

export async function listScheduledTrips(
  params: ListParams = {},
): Promise<ScheduledTripsResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  const url =
    "/api/agents/schedule-trips" + (search.toString() ? `?${search}` : "");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to load scheduled trips.");
  }
  const json = await response.json();
  return responseSchema.parse(json);
}

