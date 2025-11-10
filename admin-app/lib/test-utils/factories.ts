import type {
  AdminAlertPreference,
  AdminDiagnosticsMatch,
  AdminDiagnosticsSnapshot,
  AdminHubSnapshot,
  AssistantRun,
  AuditEvent,
  Bar,
  DashboardKpi,
  FlowMeta,
  InsuranceQuote,
  MenuVersion,
  NotificationOutbox,
  OcrJob,
  QrPreview,
  QrToken,
  SettingEntry,
  StaffNumber,
  Station,
  StorageObject,
  User,
  WebhookError,
  Lead,
  LiveCall,
  VendorRanking,
  MarketplaceIntent,
  MarketplacePurchase,
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

export function createInsuranceQuote(
  overrides: Partial<InsuranceQuote> = {},
): InsuranceQuote {
  return {
    id: "quote-id",
    userId: "user-id",
    intentId: null,
    status: "pending",
    premium: null,
    insurer: null,
    uploadedDocs: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedAt: null,
    reviewerComment: null,
    metadata: null,
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

export function createNotification(
  overrides: Partial<NotificationOutbox> = {},
): NotificationOutbox {
  return {
    id: "notif-1",
    toRole: "vendor",
    type: "driver_ping_sent",
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
    endpoint: "wa-webhook/mobility",
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

export function createQrPreview(overrides: Partial<QrPreview> = {}): QrPreview {
  return {
    interactive: {
      header: "Choose a bar",
      body: "Sunset Bar — Kigali\nTap View menu to browse live offers.",
      buttonLabel: "Select",
      sectionTitle: "Choose what to do next",
      rows: [
        { id: "MENU_VIEW", title: "View menu", description: "Browse the menu and request support." },
        { id: "back_menu", title: "🏠 Home", description: "Return to the main menu." },
      ],
    },
    fallback: ["1. View menu", "0. Main menu"],
    metadata: {
      barId: "bar-id",
      barName: "Sunset Bar",
      barSlug: "sunset-bar",
      barLocation: "Kigali",
      shareLink: "https://wa.me/250700000010?text=B:sunset-bar%20T:T1%20K:seed",
      sampleTable: {
        label: "Table 1",
        qrPayload: "B:sunset-bar T:Table 1 K:seed",
      },
    },
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
    directChatEnabled: false,
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
    matches: {
      matchesLastHour: 0,
      matchesLast24h: 0,
      openTrips: 0,
      errorCountLastHour: 0,
      recentErrors: [],
      messages: [],
    },
    queues: {
      notificationsQueued: 0,
      ocrPending: 0,
      mobilityOpenTrips: 0,
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

export function createLiveCall(overrides: Partial<LiveCall> = {}): LiveCall {
  return {
    callSid: "CA123",
    tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
    leadName: "Fixture Rider One",
    leadPhone: "+250780010001",
    agentRegion: "rw-kigali",
    startedAt: new Date().toISOString(),
    lastMediaAt: new Date().toISOString(),
    status: "active",
    direction: "outbound",
    warmTransferQueue: null,
    optOutDetected: false,
    transcriptPreview: null,
    durationSeconds: 45,
    ...overrides,
  };
}

export function createLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-id",
    tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
    phoneE164: "+250780010000",
    name: "Fixture Lead",
    tags: [],
    optIn: true,
    locale: "rw",
    lastContactAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    lastCallAt: null,
    ...overrides,
  };
}

export function createVendorRanking(
  overrides: Partial<VendorRanking> = {},
): VendorRanking {
  return {
    vendorId: "vendor-id",
    name: "Vendor Name",
    region: "rw-kigali",
    categories: ["mobility"],
    score: 0.75,
    rating: 4.5,
    fulfilmentRate: 0.9,
    avgResponseMs: 1500,
    totalTrips: 120,
    recentTrips: 12,
    balance: 320,
    ...overrides,
  };
}

export function createMarketplaceIntent(
  overrides: Partial<MarketplaceIntent> = {},
): MarketplaceIntent {
  return {
    id: "intent-id",
    buyerName: "Buyer",
    channel: "whatsapp",
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: null,
    recentQuotes: 0,
    ...overrides,
  };
}

export function createMarketplacePurchase(
  overrides: Partial<MarketplacePurchase> = {},
): MarketplacePurchase {
  return {
    id: "purchase-id",
    quoteId: "quote-id",
    vendorName: "Vendor",
    buyerName: "Buyer",
    status: "completed",
    createdAt: new Date().toISOString(),
    fulfilledAt: new Date().toISOString(),
    amount: 25,
    currency: "USD",
    ...overrides,
  };
}
