import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { handleAPIError, jsonError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { userSchema } from "@/lib/schemas";
import { listUsers } from "@/lib/users/users-service";

const querySchema = z.object({
  search: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const responseSchema = z.object({
  data: z.array(userSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.users.list", async (request: Request) => {
  try {
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    // Use IP or a fallback token for rate limiting
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(20, ip); // 20 requests per minute

    const { searchParams } = new URL(request.url);
    const parsedQuery = querySchema.parse({
      search: searchParams.get("search") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listUsers(parsedQuery);
    const payload = responseSchema.parse(result);
    return jsonOk(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError("Validation failed", 400, "invalid_query");
    }
    return handleAPIError(error);
  }
});

export const runtime = "nodejs";
