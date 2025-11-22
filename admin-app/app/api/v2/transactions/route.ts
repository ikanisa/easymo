import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/src/v2/lib/supabase/client";

import { handleRouteError } from "../_lib/utils";
import {
  sanitizeTransaction,
  type TransactionRow,
  transactionSelect,
} from "./schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = querySchema.parse({ limit: searchParams.get("limit") ?? undefined });
    const limit = query.limit ?? 5;

    const supabase = await createAdminClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("transactions")
      .select(transactionSelect)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    const transactions = (data ?? []) as TransactionRow[];
    return NextResponse.json(transactions.map(sanitizeTransaction));
  } catch (error) {
    return handleRouteError(error);
  }
}
