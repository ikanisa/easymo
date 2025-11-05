import { NextResponse } from "next/server";
import { z } from "zod";
import { listVouchers } from "@/lib/data-provider";
import { voucherSchema } from "@/lib/schemas";
import { jsonOk, jsonError, zodValidationError } from "@/lib/api/http";
import { createHandler } from "@/app/api/withObservability";

const querySchema = z.object({
  status: z.enum(["issued", "sent", "redeemed", "expired", "void"]).optional(),
  search: z.string().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const responseSchema = z.object({
  data: z.array(voucherSchema),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.vouchers.list", async (request: Request) => {
  try {
    const { searchParams } = new URL(request.url);
    const parsedQuery = querySchema.parse({
      status:
        (searchParams.get("status") as z.infer<typeof querySchema>["status"]) ??
          undefined,
      search: searchParams.get("search") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });

    const result = await listVouchers(parsedQuery);
    const payload = responseSchema.parse(result);
    return jsonOk(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError({ error: "invalid_query", details: error.flatten() }, 400);
    }
    console.error("Failed to list vouchers", error);
    return jsonError({ error: "vouchers_list_failed" }, 500);
  }
});
