import { NextResponse } from "next/server";
import { z } from "zod";
import { listUsers } from "@/lib/users/users-service";
import { userSchema } from "@/lib/schemas";
import { jsonOk, jsonError, zodValidationError } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";

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
      return jsonError({ error: "invalid_query", details: error.flatten() }, 400);
    }
    console.error("Failed to list users", error);
    return jsonError({ error: "users_list_failed" }, 500);
  }
});

export const runtime = "edge";
