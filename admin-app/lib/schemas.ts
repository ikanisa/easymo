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
  finishedAt: z.string().datetime().nullable().optional(),
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
  stationId: z.string().uuid().optional(),
  barName: z.string(),
  tableLabel: z.string(),
  token: z.string(),
  createdAt: z.string().datetime(),
  printed: z.boolean(),
  lastScanAt: z.string().datetime().nullable(),
});

export const qrPreviewRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
});

export const qrPreviewSchema = z.object({
  interactive: z.object({
    header: z.string(),
    body: z.string(),
    buttonLabel: z.string(),
    sectionTitle: z.string(),
    rows: z.array(qrPreviewRowSchema),
  }),
  fallback: z.array(z.string()),
  metadata: z.object({
    barId: z.string(),
    barName: z.string(),
    barSlug: z.string().nullable(),
    barLocation: z.string().nullable(),
    shareLink: z.string().nullable(),
    sampleTable: z
      .object({
        label: z.string(),
        qrPayload: z.string(),
      })
      .nullable()
      .optional(),
  }),
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

export const adminAlertPreferenceSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  channels: z.array(z.string()).default([]),
  severity: z.enum(["critical", "high", "medium", "low"]).default("high"),
  updatedAt: z.string().datetime().nullable().optional(),
  availableChannels: z.array(z.string()).optional(),
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

export const assistantActionSchema = z.object({
  id: z.string(),
  label: z.string(),
  summary: z.string(),
  impact: z.enum(["low", "medium", "high"]),
  recommended: z.boolean().optional(),
});

export const assistantSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  generatedAt: z.string().datetime(),
  actions: z.array(assistantActionSchema),
  references: z.array(z.string()),
  limitations: z.array(z.string()).optional(),
});

export const assistantMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["assistant", "user"]),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const assistantRunSchema = z.object({
  promptId: z.string(),
  suggestion: assistantSuggestionSchema,
  messages: z.array(assistantMessageSchema),
});

export const adminHubSectionSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const adminHubSectionsSchema = z.object({
  operations: z.array(adminHubSectionSchema).default([]),
  growth: z.array(adminHubSectionSchema).default([]),
  trust: z.array(adminHubSectionSchema).default([]),
  diagnostics: z.array(adminHubSectionSchema).default([]),
});

export const adminHubSnapshotSchema = z.object({
  sections: adminHubSectionsSchema,
  messages: z.array(z.string()).default([]),
});

export const adminVoucherListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
});

export const adminVoucherListSchema = z.object({
  vouchers: z.array(adminVoucherListItemSchema),
  messages: z.array(z.string()).default([]),
});

export const adminVoucherDetailSchema = z.object({
  id: z.string(),
  code5: z.string(),
  amountText: z.string(),
  policyNumber: z.string().nullable(),
  whatsappE164: z.string().nullable(),
  status: z.string(),
  issuedAt: z.string(),
  redeemedAt: z.string().nullable(),
  messages: z.array(z.string()).default([]),
});

const diagnosticsConfigSchema = z.object({
  admin_numbers: z.array(z.string()).nullable().optional(),
  insurance_admin_numbers: z.array(z.string()).nullable().optional(),
  admin_pin_required: z.boolean().nullable().optional(),
}).nullable();

export const adminDiagnosticsHealthSchema = z.object({
  config: diagnosticsConfigSchema,
  messages: z.array(z.string()).default([]),
});

export const adminDiagnosticsLogSchema = z.object({
  id: z.string(),
  endpoint: z.string().optional().nullable(),
  status_code: z.number().nullable().optional(),
  received_at: z.string().nullable().optional(),
});

export const adminDiagnosticsLogsSchema = z.object({
  logs: z.array(adminDiagnosticsLogSchema),
  messages: z.array(z.string()).default([]),
});

export const adminDiagnosticsSnapshotSchema = z.object({
  health: adminDiagnosticsHealthSchema,
  logs: adminDiagnosticsLogsSchema,
});

export const adminDiagnosticsMatchTripSchema = z.object({
  id: z.string(),
  role: z.string().nullable().optional(),
  vehicleType: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
});

export const adminDiagnosticsMatchSchema = z.object({
  trip: adminDiagnosticsMatchTripSchema.nullable(),
  messages: z.array(z.string()).default([]),
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
export type QrPreview = z.infer<typeof qrPreviewSchema>;
export type TemplateMeta = z.infer<typeof templateMetaSchema>;
export type FlowMeta = z.infer<typeof flowMetaSchema>;
export type NotificationOutbox = z.infer<typeof notificationSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type SettingEntry = z.infer<typeof settingEntrySchema>;
export type AdminAlertPreference = z.infer<typeof adminAlertPreferenceSchema>;
export type StorageObject = z.infer<typeof storageObjectSchema>;
export type DashboardKpi = z.infer<typeof dashboardKpiSchema>;
export type TimeseriesPoint = z.infer<typeof timeseriesPointSchema>;
export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantSuggestion = z.infer<typeof assistantSuggestionSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type AssistantRun = z.infer<typeof assistantRunSchema>;
export type AdminHubSection = z.infer<typeof adminHubSectionSchema>;
export type AdminHubSections = z.infer<typeof adminHubSectionsSchema>;
export type AdminHubSnapshot = z.infer<typeof adminHubSnapshotSchema>;
export type AdminVoucherListItem = z.infer<typeof adminVoucherListItemSchema>;
export type AdminVoucherList = z.infer<typeof adminVoucherListSchema>;
export type AdminVoucherDetail = z.infer<typeof adminVoucherDetailSchema>;
export type AdminDiagnosticsHealth = z.infer<typeof adminDiagnosticsHealthSchema>;
export type AdminDiagnosticsLogs = z.infer<typeof adminDiagnosticsLogsSchema>;
export type AdminDiagnosticsSnapshot = z.infer<typeof adminDiagnosticsSnapshotSchema>;
export type AdminDiagnosticsMatchTrip = z.infer<typeof adminDiagnosticsMatchTripSchema>;
export type AdminDiagnosticsMatch = z.infer<typeof adminDiagnosticsMatchSchema>;
