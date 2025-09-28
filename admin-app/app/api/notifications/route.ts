import { NextResponse } from "next/server";
import { z } from "zod";
import { listNotifications } from "@/lib/data-provider";
import { notificationSchema } from "@/lib/schemas";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { limit } = querySchema.parse({
    limit: searchParams.get("limit") ?? undefined,
  });
  const { data, total, hasMore } = await listNotifications({
    limit: limit ?? 200,
  });
  return NextResponse.json({
    data: z.array(notificationSchema).parse(data),
    total,
    hasMore,
    integration: {
      target: "notifications",
      status: "degraded",
      reason: "mock_data",
      message:
        "Notifications list using mock fixtures until Supabase is configured.",
    },
  });
}
