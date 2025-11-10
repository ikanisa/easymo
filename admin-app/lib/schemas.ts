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
  directChatEnabled: z.boolean().optional(),
});

export const insuranceQuoteSchema = z.object({
  id: z.string().uuid().or(z.string()),
  userId: z.string().uuid().or(z.string()).nullable(),
  intentId: z.string().uuid().or(z.string()).nullable().optional(),
  status: z.string(),
  premium: z.number().nullable(),
  insurer: z.string().nullable(),
  uploadedDocs: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  approvedAt: z.string().datetime().nullable().optional(),
  reviewerComment: z.string().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const insuranceRequestSchema = z.object({
  id: z.string().uuid().or(z.string()),
  contactId: z.string().uuid().or(z.string()).nullable(),
  status: z.string(),
  vehicleType: z.string().nullable(),
  vehiclePlate: z.string().nullable(),
  insurerPreference: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
});

export const insuranceDocumentSchema = z.object({
  id: z.string().uuid().or(z.string()),
  intentId: z.string().uuid().or(z.string()).nullable(),
  contactId: z.string().uuid().or(z.string()).nullable(),
  kind: z.string(),
  storagePath: z.string(),
  checksum: z.string().nullable(),
  ocrState: z.string(),
  ocrJson: z.unknown().nullable(),
  ocrConfidence: z.number().nullable(),
  createdAt: z.string().datetime(),
});

export const insurancePolicySchema = z.object({
  id: z.string().uuid().or(z.string()),
  quoteId: z.string().uuid().or(z.string()).nullable(),
  policyNumber: z.string(),
  status: z.string(),
  insurer: z.string().nullable(),
  premium: z.number().nullable(),
  currency: z.string().nullable(),
  effectiveAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const insurancePaymentSchema = z.object({
  id: z.string().uuid().or(z.string()),
  quoteId: z.string().uuid().or(z.string()).nullable(),
  intentId: z.string().uuid().or(z.string()).nullable().optional(),
  amount: z.number(),
  currency: z.string(),
  status: z.string(),
  channel: z.string().nullable(),
  reference: z.string().nullable(),
  recordedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().nullable(),
  metadata: z.record(z.any()).nullable().optional(),
});

export const insurerProfileSchema = z.object({
  providerName: z.string(),
  slug: z.string(),
  legalName: z.string(),
  momoMerchantCode: z.string(),
  momoReferencePrefix: z.string(),
  momoChannelDescription: z.string(),
  supportPhone: z.string(),
  supportEmail: z.string(),
  claimsEmail: z.string(),
  headOfficeAddress: z.string(),
  notes: z.array(z.string()).optional(),
});

export const insuranceInstallmentTrancheSchema = z.object({
  atMonth: z.number(),
  percent: z.number(),
});

export const insuranceInstallmentPlanSchema = z.object({
  name: z.string(),
  tranches: z.array(insuranceInstallmentTrancheSchema),
});

export const insuranceBreakdownItemSchema = z.object({
  label: z.string(),
  amount: z.number(),
  meta: z.record(z.any()).optional(),
});

export const insuranceMandatoryExcessSchema = z.object({
  md_percent_of_claim: z.number(),
  theft_fire_percent_total_loss: z.number(),
  minimum_rwf: z.number(),
});

export const insuranceMomoInstructionSchema = z.object({
  ussd: z.string(),
  tel: z.string(),
  amount: z.number(),
  reference: z.string(),
});

export const ocrVehicleDocSchema = z.object({
  plateNumber: z.string().nullable().optional(),
  vin: z.string().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  bodyType: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  usageHint: z.string().nullable().optional(),
  seats: z.number().nullable().optional(),
  passengersAboveDriver: z.number().nullable().optional(),
  engineCapacityCC: z.number().nullable().optional(),
  grossWeightKg: z.number().nullable().optional(),
  tonnage: z.number().nullable().optional(),
  previousInsurer: z.string().nullable().optional(),
  previousPolicyNumber: z.string().nullable().optional(),
  sumInsuredHint: z.number().nullable().optional(),
  ownerType: z.string().nullable().optional(),
});

export const insuranceSimulationInputsSchema = z.object({
  sumInsured: z.number(),
  vehicleCategory: z.string(),
  usageType: z.string(),
  seats: z.number(),
  passengerSeatsAboveDriver: z.number(),
  ownerType: z.string(),
  vehicleAgeYears: z.number(),
  coverSelection: z.string(),
  wantsComesa: z.boolean(),
  comesaPassengers: z.number(),
  theftTerritorialExtension: z.boolean(),
  periodDays: z.number(),
  goodsAreFlammable: z.boolean(),
  governmentExcessWaiver: z.boolean(),
  occupantCover: z.object({
    enabled: z.boolean(),
    plan: z.number(),
    occupants: z.number(),
    vehicleIsMotorcycle: z.boolean(),
    usageType: z.string(),
  }).optional(),
});

export const insuranceSimulationQuoteSchema = z.object({
  providerName: z.string(),
  grossPremium: z.number(),
  currency: z.string(),
  breakdown: z.array(insuranceBreakdownItemSchema),
  mandatoryExcessApplicable: insuranceMandatoryExcessSchema,
  warnings: z.array(z.string()).optional(),
  installmentOptions: z.array(insuranceInstallmentPlanSchema),
  insurerProfile: insurerProfileSchema.optional(),
  momo: insuranceMomoInstructionSchema.optional(),
});

export const insuranceSimulationResultSchema = z.object({
  inputs: insuranceSimulationInputsSchema,
  doc: ocrVehicleDocSchema,
  result: z.object({
    currency: z.string(),
    quotes: z.array(insuranceSimulationQuoteSchema),
  }),
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
  timestamp: z.string().datetime(),
  value: z.number(),
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

export const liveCallSchema = z.object({
  callSid: z.string(),
  tenantId: z.string().uuid().optional(),
  leadName: z.string().nullable(),
  leadPhone: z.string(),
  agentRegion: z.string().nullable(),
  startedAt: z.string().datetime(),
  lastMediaAt: z.string().datetime().nullable(),
  status: z.enum(["active", "handoff", "ended"]),
  direction: z.enum(["inbound", "outbound"]),
  warmTransferQueue: z.string().nullable(),
  optOutDetected: z.boolean().default(false),
  transcriptPreview: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});

export const leadSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  phoneE164: z.string(),
  name: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  optIn: z.boolean(),
  locale: z.string(),
  lastContactAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  lastCallAt: z.string().datetime().nullable().optional(),
});

export const vendorRankingSchema = z.object({
  vendorId: z.string().uuid(),
  name: z.string(),
  region: z.string(),
  categories: z.array(z.string()),
  score: z.number(),
  rating: z.number().nullable(),
  fulfilmentRate: z.number().nullable(),
  avgResponseMs: z.number().nullable(),
  totalTrips: z.number(),
  recentTrips: z.number(),
  balance: z.number().nullable(),
});

export const marketplaceIntentSchema = z.object({
  id: z.string().uuid(),
  buyerName: z.string(),
  channel: z.string(),
  status: z.enum(["pending", "matched", "expired", "cancelled"]),
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  recentQuotes: z.number().default(0),
});

export const marketplacePurchaseSchema = z.object({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  vendorName: z.string(),
  buyerName: z.string(),
  status: z.enum(["pending", "completed", "cancelled", "failed"]),
  createdAt: z.string().datetime(),
  fulfilledAt: z.string().datetime().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
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

export const adminDiagnosticsMatchSummarySchema = z.object({
  matchesLastHour: z.number().min(0).default(0),
  matchesLast24h: z.number().min(0).default(0),
  openTrips: z.number().min(0).default(0),
  errorCountLastHour: z.number().min(0).default(0),
  recentErrors: z.array(adminDiagnosticsLogSchema).default([]),
  messages: z.array(z.string()).default([]),
});

export const adminDiagnosticsQueueSchema = z.object({
  notificationsQueued: z.number().min(0).default(0),
  ocrPending: z.number().min(0).default(0),
  mobilityOpenTrips: z.number().min(0).default(0),
});

export const adminDiagnosticsSnapshotSchema = z.object({
  health: adminDiagnosticsHealthSchema,
  logs: adminDiagnosticsLogsSchema,
  matches: adminDiagnosticsMatchSummarySchema,
  queues: adminDiagnosticsQueueSchema,
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
export type InsuranceQuote = z.infer<typeof insuranceQuoteSchema>;
export type InsuranceRequest = z.infer<typeof insuranceRequestSchema>;
export type InsuranceDocument = z.infer<typeof insuranceDocumentSchema>;
export type InsurancePolicy = z.infer<typeof insurancePolicySchema>;
export type InsurancePayment = z.infer<typeof insurancePaymentSchema>;
export type InsuranceProviderProfile = z.infer<typeof insurerProfileSchema>;
export type InsuranceInstallmentPlan = z.infer<typeof insuranceInstallmentPlanSchema>;
export type InsuranceBreakdownItem = z.infer<typeof insuranceBreakdownItemSchema>;
export type InsuranceMandatoryExcess = z.infer<typeof insuranceMandatoryExcessSchema>;
export type InsuranceMomoInstruction = z.infer<typeof insuranceMomoInstructionSchema>;
export type OcrVehicleDoc = z.infer<typeof ocrVehicleDocSchema>;
export type InsuranceSimulationInputs = z.infer<typeof insuranceSimulationInputsSchema>;
export type InsuranceSimulationQuote = z.infer<typeof insuranceSimulationQuoteSchema>;
export type InsuranceSimulationResult = z.infer<typeof insuranceSimulationResultSchema>;
export type WebhookError = z.infer<typeof webhookErrorSchema>;
export type MenuVersion = z.infer<typeof menuVersionSchema>;
export type OcrJob = z.infer<typeof ocrJobSchema>;
export type StaffNumber = z.infer<typeof staffNumberSchema>;
export type QrToken = z.infer<typeof qrTokenSchema>;
export type QrPreview = z.infer<typeof qrPreviewSchema>;
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
export type AdminDiagnosticsHealth = z.infer<typeof adminDiagnosticsHealthSchema>;
export type AdminDiagnosticsLogs = z.infer<typeof adminDiagnosticsLogsSchema>;
export type AdminDiagnosticsMatchSummary = z.infer<
  typeof adminDiagnosticsMatchSummarySchema
>;
export type AdminDiagnosticsSnapshot = z.infer<typeof adminDiagnosticsSnapshotSchema>;
export type AdminDiagnosticsQueues = z.infer<typeof adminDiagnosticsQueueSchema>;
export type AdminDiagnosticsMatchTrip = z.infer<typeof adminDiagnosticsMatchTripSchema>;
export type AdminDiagnosticsMatch = z.infer<typeof adminDiagnosticsMatchSchema>;
export type LiveCall = z.infer<typeof liveCallSchema>;
export type Lead = z.infer<typeof leadSchema>;
export type VendorRanking = z.infer<typeof vendorRankingSchema>;
export type MarketplaceIntent = z.infer<typeof marketplaceIntentSchema>;
export type MarketplacePurchase = z.infer<typeof marketplacePurchaseSchema>;
