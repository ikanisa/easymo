import type { Database } from "@/src/v2/lib/supabase/database.types";

import { normalizeNumber } from "../_lib/utils";

export const transactionSelect = "id, amount, description, created_at";

export type TransactionRow = Pick<
  Database["public"]["Tables"]["transactions"]["Row"],
  "id" | "amount" | "description" | "created_at"
>;

export function sanitizeTransaction(row: TransactionRow) {
  return {
    id: row.id,
    amount: normalizeNumber(row.amount) ?? 0,
    description: row.description,
    created_at: row.created_at,
  };
}
