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
  claimed: z.boolean().optional(),
  receivingNumbers: z.number().default(0),
  publishedMenuVersion: z.string().nullable(),
  lastUpdated: z.string().datetime(),
  createdAt: z.string().datetime(),
  momoCode: z.string().nullable(),
  directChatEnabled: z.boolean().optional(),
});

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
export type InsuranceRequestStatus = z.infer<typeof insuranceRequestStatusSchema>;
export type InsurancePolicyStatus = z.infer<typeof insurancePolicyStatusSchema>;
export type InsurancePaymentStatus = z.infer<typeof insurancePaymentStatusSchema>;
export type InsuranceTaskStatus = z.infer<typeof insuranceTaskStatusSchema>;
export type InsuranceComparisonQuote = z.infer<typeof insuranceComparisonQuoteSchema>;
export type InsuranceVehicle = z.infer<typeof insuranceVehicleSchema>;
export type InsurancePolicyBreakdown = z.infer<typeof insurancePolicyBreakdownSchema>;
export type InsurancePolicyDetail = z.infer<typeof insurancePolicyDetailSchema>;
export type InsuranceDocumentDetail = z.infer<typeof insuranceDocumentDetailSchema>;
export type InsuranceTask = z.infer<typeof insuranceTaskSchema>;
export type InsurancePaymentDetail = z.infer<typeof insurancePaymentDetailSchema>;
export type InsuranceRequestDetail = z.infer<typeof insuranceRequestDetailSchema>;
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
export type DriverRequest = z.infer<typeof driverRequestSchema>;
export type PharmacyRequest = z.infer<typeof pharmacyRequestSchema>;
export type PharmacyQuote = z.infer<typeof pharmacyQuoteSchema>;
export type Shop = z.infer<typeof shopSchema>;
export type HardwareVendor = z.infer<typeof hardwareVendorSchema>;
export type PropertyListing = z.infer<typeof propertyListingSchema>;
export type ScheduledTrip = z.infer<typeof scheduledTripSchema>;
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
