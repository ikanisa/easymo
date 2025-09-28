import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid().or(z.string()),
  msisdn: z.string(),
  displayName: z.string().optional(),
  locale: z.string().default("rw-RW"),
  roles: z.array(z.string()).default([]),
  status: z.enum(["active", "blocked", "invited"]).default("active"),
  createdAt: z.string().datetime(),
  lastSeenAt: z.string().datetime().nullable().optional(),
});

export const stationSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string(),
  engencode: z.string(),
  ownerContact: z.string().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .nullable()
    .optional(),
  updatedAt: z.string().datetime(),
});

export const barSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string(),
  slug: z.string(),
  location: z.string().nullable(),
  isActive: z.boolean().default(true),
  receivingNumbers: z.number().default(0),
  publishedMenuVersion: z.string().nullable(),
  lastUpdated: z.string().datetime(),
  createdAt: z.string().datetime(),
  momoCode: z.string().nullable(),
  serviceCharge: z.number().nullable(),
  directChatEnabled: z.boolean().optional(),
  defaultPrepMinutes: z.number().nullable(),
  paymentInstructions: z.string().nullable(),
});

export const voucherSchema = z.object({
  id: z.string().uuid().or(z.string()),
  userId: z.string(),
  userName: z.string().optional(),
  msisdn: z.string(),
  amount: z.number(),
  currency: z.string(),
  status: z.enum(["issued", "sent", "redeemed", "expired", "void"]),
  campaignId: z.string().nullable(),
  stationScope: z.string().nullable(),
  code: z.string().optional(),
  issuedAt: z.string().datetime(),
  redeemedAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});

export const campaignSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string(),
  type: z.enum(["promo", "voucher"]),
  status: z.enum(["draft", "running", "paused", "done"]),
  templateId: z.string(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  metadata: z.record(z.any()).optional(),
});

export const insuranceQuoteSchema = z.object({
  id: z.string().uuid().or(z.string()),
  userId: z.string(),
  status: z.enum(["pending", "approved", "needs_changes"]),
  premium: z.number().nullable(),
  insurer: z.string().nullable(),
  uploadedDocs: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  reviewerComment: z.string().nullable(),
});

export const orderSchema = z.object({
  id: z.string(),
  barId: z.string(),
  barName: z.string(),
  table: z.string().nullable(),
  status: z.string(),
  total: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  staffNumber: z.string().nullable(),
});

export const orderEventSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  type: z.string(),
  status: z.string().optional(),
  actor: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const webhookErrorSchema = z.object({
  id: z.string(),
  endpoint: z.string(),
  failureReason: z.string(),
  createdAt: z.string().datetime(),
  retryUrl: z.string().nullable(),
});

export const menuVersionSchema = z.object({
  id: z.string(),
  barId: z.string(),
  barName: z.string(),
  version: z.string(),
  status: z.enum(["draft", "published"]),
  source: z.enum(["ocr", "manual"]).default("ocr"),
  categories: z.number(),
  items: z.number(),
  updatedAt: z.string().datetime(),
});

export const ocrJobSchema = z.object({
  id: z.string(),
  barId: z.string(),
  barName: z.string(),
  fileName: z.string(),
  type: z.enum(["pdf", "image"]),
  status: z.enum(["queued", "processing", "success", "error"]),
  durationSeconds: z.number().nullable(),
  retries: z.number().default(0),
  submittedAt: z.string().datetime(),
});

export const staffNumberSchema = z.object({
  id: z.string(),
  barName: z.string(),
  number: z.string(),
  role: z.string(),
  active: z.boolean(),
  verified: z.boolean(),
  addedBy: z.string().nullable(),
  lastSeenAt: z.string().datetime().nullable(),
});

export const qrTokenSchema = z.object({
  id: z.string(),
  barName: z.string(),
  tableLabel: z.string(),
  token: z.string(),
  createdAt: z.string().datetime(),
  printed: z.boolean(),
  lastScanAt: z.string().datetime().nullable(),
});

export const templateMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  locales: z.array(z.string()),
  status: z.enum(["approved", "draft"]),
  variables: z.array(z.string()),
  lastUsedAt: z.string().datetime().nullable(),
  errorRate: z.number(),
});

export const flowMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  version: z.string(),
  status: z.enum(["published", "draft"]),
  linkedEndpoints: z.array(z.string()),
  lastErrorAt: z.string().datetime().nullable(),
});

export const notificationSchema = z.object({
  id: z.string(),
  toRole: z.string(),
  type: z.string(),
  status: z.enum(["queued", "sent", "failed"]),
  createdAt: z.string().datetime(),
  sentAt: z.string().datetime().nullable(),
});

export const auditEventSchema = z.object({
  id: z.string(),
  actor: z.string(),
  action: z.string(),
  targetTable: z.string(),
  targetId: z.string(),
  createdAt: z.string().datetime(),
  summary: z.string().nullable(),
});

export const settingEntrySchema = z.object({
  key: z.string(),
  description: z.string(),
  updatedAt: z.string().datetime(),
  valuePreview: z.string(),
});

export const storageObjectSchema = z.object({
  id: z.string(),
  bucket: z.string(),
  path: z.string(),
  mimeType: z.string(),
  sizeKb: z.number(),
  updatedAt: z.string().datetime(),
});

export const dashboardKpiSchema = z.object({
  label: z.string(),
  primaryValue: z.string(),
  secondaryValue: z.string().nullable(),
  trend: z.enum(["up", "down", "flat"]).nullable(),
  helpText: z.string().optional(),
});

export const timeseriesPointSchema = z.object({
  date: z.string().datetime(),
  issued: z.number(),
  redeemed: z.number(),
});

export type User = z.infer<typeof userSchema>;
export type Station = z.infer<typeof stationSchema>;
export type Bar = z.infer<typeof barSchema>;
export type Voucher = z.infer<typeof voucherSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type InsuranceQuote = z.infer<typeof insuranceQuoteSchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderEvent = z.infer<typeof orderEventSchema>;
export type WebhookError = z.infer<typeof webhookErrorSchema>;
export type MenuVersion = z.infer<typeof menuVersionSchema>;
export type OcrJob = z.infer<typeof ocrJobSchema>;
export type StaffNumber = z.infer<typeof staffNumberSchema>;
export type QrToken = z.infer<typeof qrTokenSchema>;
export type TemplateMeta = z.infer<typeof templateMetaSchema>;
export type FlowMeta = z.infer<typeof flowMetaSchema>;
export type NotificationOutbox = z.infer<typeof notificationSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type SettingEntry = z.infer<typeof settingEntrySchema>;
export type StorageObject = z.infer<typeof storageObjectSchema>;
export type DashboardKpi = z.infer<typeof dashboardKpiSchema>;
export type TimeseriesPoint = z.infer<typeof timeseriesPointSchema>;
