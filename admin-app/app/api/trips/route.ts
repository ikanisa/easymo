import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, jsonError } from "@/lib/api/http";
import { listTrips } from "@/lib/trips/trips-service";

const querySchema = z.object({
  search: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.trips.list", async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse({
      search: searchParams.get("search") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    const result = await listTrips(parsed);
    return jsonOk(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError({ error: "invalid_query", details: error.flatten() }, 400);
    }
    console.error("trips_list_failed", error);
    return jsonError({ error: "trips_list_failed" }, 500);
  }
});


export const runtime = "edge";
