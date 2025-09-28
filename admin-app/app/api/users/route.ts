import { NextResponse } from "next/server";
import { z } from "zod";
import { listUsers } from "@/lib/data-provider";
import { userSchema } from "@/lib/schemas";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = querySchema.parse({
      search: searchParams.get("search") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listUsers(parsedQuery);
    const payload = responseSchema.parse(result);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_query",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to list users", error);
    return NextResponse.json({ error: "users_list_failed" }, { status: 500 });
  }
}
