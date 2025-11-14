import { normalizeNumber } from "../_lib/utils";

export const transactionSelect = "id, amount, description, created_at";

export type TransactionRow = {
  id: string;
  amount: number | null;
  description: string | null;
  created_at: string;
};

export function sanitizeTransaction(row: TransactionRow) {
  return {
    id: row.id,
    amount: normalizeNumber(row.amount) ?? 0,
    description: row.description,
    created_at: row.created_at,
  };
}
