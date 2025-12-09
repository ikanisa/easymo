import { z } from "zod";

export const E164 = z.string().regex(/^\+?\d{7,15}$/, "Invalid phone format");

export const OnboardReq = z.object({
  whatsapp_msisdn: E164,
  momo_msisdn: E164,
});

export const OCRUploadReq = z.object({
  id_type: z.enum(["NID", "DL", "PASSPORT"]),
  id_number: z.string().min(3),
});

export const AddSaccoReq = z.object({
  sacco_id: z.string().uuid(),
});

export const JoinRequestReq = z.object({
  note: z.string().max(280).optional(),
});

export const InviteAcceptReq = z.object({
  token: z.string().min(8),
});
