import { z } from "zod";

export const waCallStatusValues = ["offer", "connect", "update", "end"] as const;
export const waCallStatusSchema = z.enum(waCallStatusValues);
export type WaCallStatus = z.infer<typeof waCallStatusSchema>;

const waCallSchema = z.object({
  call_id: z.string(),
  from: z.string(),
  to: z.string(),
  status: waCallStatusSchema,
  sdp: z.string().optional(),
  ice: z.unknown().optional(),
  timestamp: z.string(),
});

const waCallChangeSchema = z.object({
  field: z.string(),
  value: z
    .object({
      call: waCallSchema.optional(),
    })
    .passthrough(),
});

const waCallEntrySchema = z.object({
  id: z.string(),
  changes: z.array(waCallChangeSchema).default([]),
});

export const waCallEventSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(waCallEntrySchema).default([]),
});

export type WaCallEvent = z.infer<typeof waCallEventSchema>;

export const parseWaCallEvent = (input: unknown): WaCallEvent => waCallEventSchema.parse(input);
