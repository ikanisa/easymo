import type {
  AdminAlertPreference,
  AdminDiagnosticsMatch,
  AdminDiagnosticsSnapshot,
  AdminHubSnapshot,
  AdminVoucherDetail,
  AdminVoucherList,
  AssistantRun,
  AuditEvent,
  Bar,
  Campaign,
  DashboardKpi,
  FlowMeta,
  InsuranceQuote,
  MenuVersion,
  NotificationOutbox,
  OcrJob,
  Order,
  OrderEvent,
  QrToken,
  SettingEntry,
  StaffNumber,
  Station,
  StorageObject,
  TemplateMeta,
  TimeseriesPoint,
  User,
  Voucher,
  WebhookError,
} from "@/lib/schemas";

export function createDashboardKpi(
  overrides: Partial<DashboardKpi> = {},
): DashboardKpi {
  return {
    label: "Metric label",
    primaryValue: "0",
    secondaryValue: null,
    trend: "flat",
    ...overrides,
  };
}

export function createTimeseriesPoint(
  overrides: Partial<TimeseriesPoint> = {},
): TimeseriesPoint {
  return {
    date: new Date().toISOString(),
    issued: 0,
    redeemed: 0,
    ...overrides,
  };
}

export function createInsuranceQuote(
  overrides: Partial<InsuranceQuote> = {},
): InsuranceQuote {
  return {
    id: "quote-id",
    userId: "user-id",
    status: "pending",
    premium: null,
    insurer: null,
    uploadedDocs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewerComment: null,
    ...overrides,
  };
}

export function createMenuVersion(
  overrides: Partial<MenuVersion> = {},
): MenuVersion {
  return {
    id: "menu-id",
    barId: "bar-id",
    barName: "Bar name",
    version: "v1",
    status: "draft",
    source: "manual",
    categories: 0,
    items: 0,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createOcrJob(overrides: Partial<OcrJob> = {}): OcrJob {
  return {
    id: "ocr-id",
    barId: "bar-id",
    barName: "Bar name",
    fileName: "document.pdf",
    type: "pdf",
    status: "queued",
    durationSeconds: null,
    retries: 0,
    submittedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ORD-1",
    barId: "bar-id",
    barName: "Bar name",
    table: null,
    status: "pending",
    total: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    staffNumber: null,
    ...overrides,
  };
}

export function createOrderEvent(
  overrides: Partial<OrderEvent> = {},
): OrderEvent {
  return {
    id: "event-1",
    orderId: "ORD-1",
    type: "created",
    status: "pending",
    actor: "system",
    note: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createNotification(
  overrides: Partial<NotificationOutbox> = {},
): NotificationOutbox {
  return {
    id: "notif-1",
    toRole: "vendor",
    type: "order_created_vendor",
    status: "queued",
    createdAt: new Date().toISOString(),
    sentAt: null,
    ...overrides,
  };
}

export function createWebhookError(
  overrides: Partial<WebhookError> = {},
): WebhookError {
  return {
    id: "webhook-1",
    endpoint: "wa-webhook/orders",
    failureReason: "Timeout",
    createdAt: new Date().toISOString(),
    retryUrl: "#",
    ...overrides,
  };
}

export function createStaffNumber(
  overrides: Partial<StaffNumber> = {},
): StaffNumber {
  return {
    id: "staff-1",
    barName: "Bar name",
    number: "+250780000000",
    role: "owner",
    active: true,
    verified: true,
    addedBy: "System",
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createQrToken(overrides: Partial<QrToken> = {}): QrToken {
  return {
    id: "qr-1",
    stationId: "station-1",
    barName: "Bar name",
    tableLabel: "Table 1",
    token: "TOKEN-1",
    createdAt: new Date().toISOString(),
    printed: false,
    lastScanAt: null,
    ...overrides,
  };
}

export function createTemplateMeta(
  overrides: Partial<TemplateMeta> = {},
): TemplateMeta {
  return {
    id: "template-1",
    name: "Template",
    purpose: "General",
    locales: ["en"],
    status: "draft",
    variables: [],
    lastUsedAt: null,
    errorRate: 0,
    ...overrides,
  };
}

export function createFlowMeta(
  overrides: Partial<FlowMeta> = {},
): FlowMeta {
  return {
    id: "flow-1",
    title: "Flow title",
    version: "1.0.0",
    status: "draft",
    linkedEndpoints: [],
    lastErrorAt: null,
    ...overrides,
  };
}

export function createAuditEvent(
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: "audit-1",
    actor: "actor-1",
    action: "update",
    targetTable: "table",
    targetId: "id",
    createdAt: new Date().toISOString(),
    summary: null,
    ...overrides,
  };
}

export function createSettingEntry(
  overrides: Partial<SettingEntry> = {},
): SettingEntry {
  return {
    key: "settings.key",
    description: "Setting description",
    updatedAt: new Date().toISOString(),
    valuePreview: "value",
    ...overrides,
  };
}

export function createStorageObject(
  overrides: Partial<StorageObject> = {},
): StorageObject {
  return {
    id: "storage-1",
    bucket: "bucket",
    path: "path/file.txt",
    mimeType: "text/plain",
    sizeKb: 1,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: "campaign-1",
    name: "Campaign",
    type: "promo",
    status: "draft",
    templateId: "template-1",
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    metadata: {},
    ...overrides,
  };
}

export function createUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    msisdn: "+250780000000",
    displayName: "Fixture User",
    locale: "en-GB",
    roles: ["customer"],
    status: "active",
    createdAt: new Date().toISOString(),
    lastSeenAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createBar(overrides: Partial<Bar> = {}): Bar {
  return {
    id: "bar-1",
    name: "Fixture Bar",
    slug: "fixture-bar",
    location: "Kigali",
    isActive: true,
    receivingNumbers: 1,
    publishedMenuVersion: "v1",
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    momoCode: null,
    serviceCharge: null,
    directChatEnabled: false,
    defaultPrepMinutes: null,
    paymentInstructions: null,
    ...overrides,
  };
}

export function createStation(overrides: Partial<Station> = {}): Station {
  return {
    id: "station-1",
    name: "Station One",
    engencode: "ENG-001",
    ownerContact: "+250780000000",
    status: "active",
    location: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createVoucher(overrides: Partial<Voucher> = {}): Voucher {
  return {
    id: "voucher-1",
    userId: "user-1",
    stationScope: null,
    campaignId: null,
    amount: 0,
    currency: "RWF",
    code: "ABCDE",
    qrUrl: null,
    pngUrl: null,
    status: "issued",
    issuedAt: new Date().toISOString(),
    redeemedAt: null,
    ...overrides,
  };
}

export function createAdminAlertPreference(
  overrides: Partial<AdminAlertPreference> = {},
): AdminAlertPreference {
  return {
    key: "ALERT_KEY",
    label: "Alert label",
    description: "Alert description",
    enabled: true,
    channels: ["email"],
    severity: "high",
    updatedAt: new Date().toISOString(),
    availableChannels: ["email"],
    ...overrides,
  };
}

export function createAdminHubSnapshot(
  overrides: Partial<AdminHubSnapshot> = {},
): AdminHubSnapshot {
  return {
    sections: {
      operations: [],
      growth: [],
      trust: [],
      diagnostics: [],
    },
    messages: [],
    ...overrides,
  };
}

export function createAdminVoucherList(
  overrides: Partial<AdminVoucherList> = {},
): AdminVoucherList {
  return {
    vouchers: [],
    messages: [],
    ...overrides,
  };
}

export function createAdminVoucherDetail(
  overrides: Partial<AdminVoucherDetail> = {},
): AdminVoucherDetail {
  return {
    id: "voucher-1",
    code5: "12345",
    amountText: "RWF 0",
    policyNumber: "POLICY",
    whatsappE164: "+250780000000",
    status: "issued",
    issuedAt: new Date().toISOString(),
    redeemedAt: null,
    messages: [],
    ...overrides,
  };
}

export function createAdminDiagnosticsSnapshot(
  overrides: Partial<AdminDiagnosticsSnapshot> = {},
): AdminDiagnosticsSnapshot {
  return {
    health: {
      config: {},
      messages: [],
    },
    logs: {
      logs: [],
      messages: [],
    },
    ...overrides,
  };
}

export function createAdminDiagnosticsMatch(
  overrides: Partial<AdminDiagnosticsMatch> = {},
): AdminDiagnosticsMatch {
  return {
    trip: null,
    messages: [],
    ...overrides,
  };
}

export function createAssistantRun(
  overrides: Partial<AssistantRun> = {},
): AssistantRun {
  return {
    promptId: "prompt-id",
    suggestion: {
      id: "suggestion-1",
      title: "Suggestion",
      summary: "Placeholder summary.",
      generatedAt: new Date().toISOString(),
      actions: [],
      references: [],
      limitations: [],
    },
    messages: [],
    ...overrides,
  };
}
