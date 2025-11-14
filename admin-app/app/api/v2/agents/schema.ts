import { z } from "zod";

import { coerceNullableString, normalizeNumber } from "../_lib/utils";

export const agentSelect =
  "id, name, phone, status, wallet_balance, created_at" as const;

export type AgentRow = {
  id: string;
  name: string;
  phone: string;
  status: string | null;
  wallet_balance: number | null;
  created_at: string;
};

export const agentCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone number is required"),
  status: z.string().optional().nullable(),
  wallet_balance: z.number().finite().optional().nullable(),
});

export const agentUpdateSchema = agentCreateSchema.omit({ id: true }).partial();

export function sanitizeAgent(row: AgentRow) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    status: coerceNullableString(row.status),
    wallet_balance: normalizeNumber(row.wallet_balance),
    created_at: row.created_at,
  };
}
