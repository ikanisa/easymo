import { NextResponse } from "next/server";
import { z } from "zod";
import { listVouchers } from "@/lib/data-provider";
import { voucherSchema } from "@/lib/schemas";

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

export async function GET(request: Request) {
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
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: "invalid_query",
        details: error.flatten(),
      }, { status: 400 });
    }
    console.error("Failed to list vouchers", error);
    return NextResponse.json({ error: "vouchers_list_failed" }, {
      status: 500,
    });
  }
}
