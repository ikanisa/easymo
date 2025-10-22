import { z } from "zod";

export const voiceDirectionSchema = z.enum(["inbound", "outbound"]);

export const voiceCallSchema = z.object({
  id: z.string().min(1),
  direction: voiceDirectionSchema,
  fromE164: z.string().min(1).nullable().optional().default(null),
  toE164: z.string().min(1).nullable().optional().default(null),
  locale: z.string().min(1).nullable().optional().default(null),
  startedAt: z.string().min(1),
  endedAt: z.string().min(1).nullable().optional().default(null),
  durationSeconds: z.number().int().nonnegative().nullable().optional().default(null),
  consentObtained: z.boolean().nullable().optional().default(null),
  outcome: z.string().min(1).nullable().optional().default(null),
  handoff: z.boolean().nullable().optional().default(null),
  handoffTarget: z.string().min(1).nullable().optional().default(null),
  projectId: z.string().min(1).nullable().optional().default(null),
  sipSessionId: z.string().min(1).nullable().optional().default(null),
  twilioCallSid: z.string().min(1).nullable().optional().default(null),
  country: z.string().min(1).nullable().optional().default(null),
  metadata: z.record(z.unknown()).nullable().optional().default(null),
  agentProfile: z.string().min(1).nullable().optional().default(null),
  agentProfileConfidence: z.string().min(1).nullable().optional().default(null),
  channel: z.string().min(1).nullable().optional().default(null),
  campaignTags: z.array(z.string().min(1)).nullable().optional().default(null),
});

export const voiceTranscriptSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string().min(1),
  lang: z.string().min(1).nullable().optional().default(null),
});

export const voiceEventSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1).nullable().optional().default(null),
  payload: z.unknown().nullable().optional().default(null),
  timestamp: z.string().min(1),
});

export const voiceToolCallSchema = z.object({
  id: z.string().min(1),
  server: z.string().min(1).nullable().optional().default(null),
  tool: z.string().min(1).nullable().optional().default(null),
  args: z.record(z.unknown()).nullable().optional().default(null),
  result: z.record(z.unknown()).nullable().optional().default(null),
  timestamp: z.string().min(1),
  success: z.boolean().nullable().optional().default(false),
});

export const voiceConsentSchema = z.object({
  id: z.string().min(1),
  consentText: z.string().min(1).nullable().optional().default(null),
  consentResult: z.boolean().nullable().optional().default(null),
  audioUrl: z.string().min(1).nullable().optional().default(null),
  timestamp: z.string().min(1),
});

export const voiceCallDetailsSchema = z.object({
  call: voiceCallSchema,
  transcripts: z.array(voiceTranscriptSchema),
  events: z.array(voiceEventSchema),
  toolCalls: z.array(voiceToolCallSchema),
  consents: z.array(voiceConsentSchema),
});

export const voiceDialerTargetSchema = z.object({
  msisdn: z.string().min(5),
  country: z.string().min(2),
  metadata: z.record(z.unknown()).optional(),
});

export const voiceDialerRequestSchema = z.object({
  tenantId: z.string().min(1),
  campaignId: z.string().min(1),
  scheduleAt: z.string().datetime().optional(),
  dryRun: z.boolean().optional(),
  targets: z.array(voiceDialerTargetSchema).min(1),
});

export const voiceWarmHandoffRequestSchema = z.object({
  callId: z.string().min(1),
  targetQueue: z.string().min(1).nullable().optional(),
  notes: z.string().min(1).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const voicePaymentEvidenceSchema = z.object({
  channel: z.enum(["sms", "whatsapp"]),
  reference: z.string().min(1).nullable().optional(),
  mediaUrl: z.string().url().nullable().optional(),
  amount: z.number().positive().nullable().optional(),
  currency: z.string().length(3).nullable().optional(),
  capturedAt: z.string().datetime().nullable().optional(),
});

export const voicePaymentConfirmationSchema = z.object({
  callId: z.string().min(1),
  evidence: voicePaymentEvidenceSchema,
  metadata: z.record(z.unknown()).optional(),
});

export const voiceWhatsappWebhookSchema = z.object({
  event: z.string().min(1),
  payload: z.unknown(),
});

export type VoiceDirection = z.infer<typeof voiceDirectionSchema>;
export type VoiceCallDto = z.infer<typeof voiceCallSchema>;
export type VoiceTranscriptDto = z.infer<typeof voiceTranscriptSchema>;
export type VoiceEventDto = z.infer<typeof voiceEventSchema>;
export type VoiceToolCallDto = z.infer<typeof voiceToolCallSchema>;
export type VoiceConsentDto = z.infer<typeof voiceConsentSchema>;
export type VoiceCallDetailsDto = z.infer<typeof voiceCallDetailsSchema>;
export type VoiceDialerRequestDto = z.infer<typeof voiceDialerRequestSchema>;
export type VoiceWarmHandoffRequestDto = z.infer<typeof voiceWarmHandoffRequestSchema>;
export type VoicePaymentConfirmationDto = z.infer<typeof voicePaymentConfirmationSchema>;
export type VoiceWhatsappWebhookDto = z.infer<typeof voiceWhatsappWebhookSchema>;
