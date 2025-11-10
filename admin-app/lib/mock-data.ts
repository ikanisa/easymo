import { addDays, formatISO, subDays } from "./time-utils";
import type {
  AdminAlertPreference,
  AdminDiagnosticsMatch,
  AdminDiagnosticsSnapshot,
  AdminHubSnapshot,
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
  QrPreview,
  QrToken,
  SettingEntry,
  StaffNumber,
  Station,
  StorageObject,
  TemplateMeta,
  User,
  WebhookError,
  LiveCall,
  Lead,
  VendorRanking,
  MarketplaceIntent,
  MarketplacePurchase,
} from "./schemas";
import {
  ALERT_DEFINITIONS,
  DEFAULT_ALERT_CHANNELS,
} from "./settings/alert-definitions";
import {
  createAuditEvent,
  createAdminAlertPreference,
  createAdminDiagnosticsMatch,
  createAdminDiagnosticsSnapshot,
  createAdminHubSnapshot,
  createAssistantRun,
  createCampaign,
  createDashboardKpi,
  createFlowMeta,
  createInsuranceQuote,
  createMenuVersion,
  createNotification,
  createOcrJob,
  createOrder,
  createOrderEvent,
  createQrToken,
  createSettingEntry,
  createStaffNumber,
  createStorageObject,
  createTemplateMeta,
  createWebhookError,
} from "@/lib/test-utils/factories";
import { mockBars, mockStations, mockUsers } from "@/lib/test-utils/mock-base";
export { mockBars, mockUsers, mockStations };

const now = new Date();

export const mockCampaigns: Campaign[] = [
  createCampaign({
    id: "campaign-1",
    name: "October Momentum Promo",
    type: "promo",
    status: "running",
    templateId: "promo_october_momentum",
    createdAt: formatISO(subDays(now, 14)),
    startedAt: formatISO(subDays(now, 10)),
    finishedAt: null,
    metadata: { dailyTarget: 100 },
  }),
  createCampaign({
    id: "campaign-2",
    name: "Welcome Broadcast",
    type: "notification",
    status: "draft",
    templateId: "welcome_messaging_v1",
    createdAt: formatISO(subDays(now, 4)),
    startedAt: null,
    finishedAt: null,
    metadata: { note: "Pending compliance review" },
  }),
];

export const mockInsuranceQuotes: InsuranceQuote[] = [
  createInsuranceQuote({
    id: "quote-1",
    userId: mockUsers[0].id,
    status: "pending",
    premium: 15000,
    insurer: "Allied Assurance",
    uploadedDocs: ["docs/insurance/quote-1.pdf"],
    createdAt: formatISO(subDays(now, 2)),
    updatedAt: null,
  }),
  createInsuranceQuote({
    id: "quote-2",
    userId: mockUsers[1].id,
    status: "approved",
    premium: 18000,
    insurer: "Allied Assurance",
    uploadedDocs: ["docs/insurance/quote-2.pdf"],
    createdAt: formatISO(subDays(now, 5)),
    updatedAt: formatISO(subDays(now, 1)),
    reviewerComment: "Clear scans; approved for issuance.",
  }),
  createInsuranceQuote({
    id: "quote-3",
    userId: mockUsers[2].id,
    status: "needs_changes",
    uploadedDocs: ["docs/insurance/quote-3.pdf"],
    createdAt: formatISO(subDays(now, 7)),
    updatedAt: formatISO(subDays(now, 2)),
    reviewerComment: "Need higher-resolution invoice photo.",
  }),
];

export const mockDashboardKpis: DashboardKpi[] = [
  createDashboardKpi({
    label: "Active users (7d / 30d)",
    primaryValue: "1,240",
    secondaryValue: "+3.2% vs last week",
    trend: "up",
    helpText: "Unique users who interacted with WhatsApp flows.",
  }),
  createDashboardKpi({
    label: "Driver dispatch SLA",
    primaryValue: "88% < 3 min",
    secondaryValue: "+5% vs last week",
    trend: "up",
    helpText: "Rolling 7-day average for trip dispatch confirmations.",
  }),
  createDashboardKpi({
    label: "WhatsApp delivery rate",
    primaryValue: "97.4%",
    secondaryValue: "-0.6% vs last week",
    trend: "down",
    helpText: "Successful sends divided by total attempts.",
  }),
  createDashboardKpi({
    label: "Pending orders > 15m",
    primaryValue: "4",
    secondaryValue: "2 flagged for follow-up",
    trend: "flat",
  }),
];

// Simplified mocks - factory functions not available during build
export const mockLiveCalls: LiveCall[] = [];
export const mockLeads: Lead[] = [];
export const mockVendorRankings: VendorRanking[] = [];
export const mockMarketplaceIntents: MarketplaceIntent[] = [];
export const mockMarketplacePurchases: MarketplacePurchase[] = [];

export const mockMenuVersions: MenuVersion[] = mockBars.flatMap((
  bar,
  index,
) => [
  createMenuVersion({
    id: `menu-${bar.id}-draft`,
    barId: bar.id,
    barName: bar.name,
    version: `v${20 - index}`,
    status: "draft",
    source: "ocr",
    categories: 8,
    items: 42,
    updatedAt: formatISO(subDays(now, index + 1)),
  }),
  createMenuVersion({
    id: `menu-${bar.id}-published`,
    barId: bar.id,
    barName: bar.name,
    version: bar.publishedMenuVersion ?? "v1",
    status: "published",
    source: "manual",
    categories: 7,
    items: 35,
    updatedAt: formatISO(subDays(now, index + 6)),
  }),
]);

export const mockOcrJobs: OcrJob[] = Array.from({ length: 6 }, (_, idx) => {
  const statusCycle: OcrJob["status"][] = [
    "queued",
    "processing",
    "success",
    "error",
  ];
  return createOcrJob({
    id: `ocr-${idx + 1}`,
    barId: mockBars[idx % mockBars.length].id,
    barName: mockBars[idx % mockBars.length].name,
    fileName: `menu-${idx + 1}.pdf`,
    type: idx % 2 === 0 ? "pdf" : "image",
    status: statusCycle[idx % statusCycle.length],
    durationSeconds: idx % 4 >= 2 ? 85 + idx * 5 : null,
    retries: idx % 3,
    submittedAt: formatISO(subDays(now, idx)),
  });
});

export const mockOrders: Order[] = Array.from({ length: 18 }, (_, index) => {
  const bar = mockBars[index % mockBars.length];
  const createdAt = subDays(now, Math.floor(index / 4));
  return createOrder({
    id: `ORD-${1000 + index}`,
    barId: bar.id,
    barName: bar.name,
    table: index % 2 === 0 ? `T${(index % 5) + 1}` : null,
    status:
      ["pending", "confirmed", "ready", "completed", "cancelled"][index % 5],
    total: 18000 + index * 1200,
    createdAt: formatISO(createdAt),
    updatedAt: formatISO(addDays(createdAt, 0.1 * (index % 4))),
    staffNumber: index % 3 === 0 ? "+25078000009" : null,
  });
});

export const mockOrderEvents: OrderEvent[] = mockOrders.slice(0, 10).map((
  order,
  index,
) =>
  createOrderEvent({
    id: `event-${order.id}`,
    orderId: order.id,
    type: [
      "created",
      "vendor_ack",
      "preparing",
      "completed",
      "cancelled",
    ][index % 5],
    status: order.status,
    actor: index % 2 === 0 ? "vendor" : "system",
    note: index % 5 === 4 ? "Admin cancelled after vendor timeout." : null,
    createdAt: formatISO(subDays(now, index / 5)),
  })
);

export const mockWebhookErrors: WebhookError[] = Array.from(
  { length: 6 },
  (_, idx) =>
    createWebhookError({
      id: `webhook-${idx + 1}`,
      endpoint: idx % 2 === 0 ? "wa-webhook/orders" : "wa-webhook/ocr",
      failureReason: idx % 3 === 0 ? "Timeout" : "HTTP 500 from downstream",
      createdAt: formatISO(subDays(now, idx / 3)),
    }),
);

export const mockStaffNumbers: StaffNumber[] = mockBars.flatMap((bar, idx) => [
  createStaffNumber({
    id: `${bar.id}-num-1`,
    barName: bar.name,
    number: `+2507800001${idx}`,
    role: "owner",
    active: true,
    verified: true,
    addedBy: "Admin Ops",
    lastSeenAt: formatISO(subDays(now, idx)),
  }),
  createStaffNumber({
    id: `${bar.id}-num-2`,
    barName: bar.name,
    number: `+2507800002${idx}`,
    role: "manager",
    active: idx % 2 === 0,
    verified: idx % 3 !== 0,
    addedBy: "Support Agent",
    lastSeenAt: idx % 2 === 0 ? formatISO(subDays(now, idx + 1)) : null,
  }),
]);

export const mockQrTokens: QrToken[] = Array.from(
  { length: 10 },
  (_, idx) =>
    createQrToken({
      id: `qr-${idx + 1}`,
      stationId: mockBars[idx % mockBars.length].id,
      barName: mockBars[idx % mockBars.length].name,
      tableLabel: `Table ${(idx % 6) + 1}`,
      token: `TOKEN-${idx + 100}`,
      createdAt: formatISO(subDays(now, idx)),
      printed: idx % 3 === 0,
      lastScanAt: idx % 2 === 0 ? formatISO(subDays(now, idx / 2)) : null,
    }),
);

export const mockQrPreview: QrPreview = {
  id: "preview-1",
  barId: mockBars[0]?.id ?? "mock-bar",
  barName: mockBars[0]?.name ?? "Sunset Bar",
  imageUrl: "https://example.com/qr-preview.png",
  metadata: {
    barId: mockBars[0]?.id ?? "mock-bar",
    barName: mockBars[0]?.name ?? "Sunset Bar",
    barSlug: mockBars[0]?.slug ?? "sunset-bar",
    barLocation: mockBars[0]?.location ?? "Kigali",
    shareLink: "https://wa.me/250700000010?text=B%3Asunset-bar%20T%3ATable%201%20K%3Amock",
    sampleTable: {
      label: "Table 1",
      qrPayload: "B:sunset-bar T:Table 1 K:mock",
    },
  },
};

export const mockTemplates: TemplateMeta[] = [
  createTemplateMeta({
    id: "promo_generic",
    name: "Promo Generic",
    purpose: "Broadcast promo",
    locales: ["rw", "en"],
    status: "approved",
    variables: ["customer_name", "cta_link"],
    lastUsedAt: formatISO(subDays(now, 1)),
    errorRate: 0.8,
  }),
  createTemplateMeta({
    id: "dispatch_followup",
    name: "Dispatch Follow-up",
    purpose: "Send dispatch updates",
    locales: ["rw"],
    status: "approved",
    variables: ["customer_name", "trip_id"],
    lastUsedAt: formatISO(subDays(now, 0.5)),
    errorRate: 0.2,
  }),
  createTemplateMeta({
    id: "feedback_request",
    name: "Feedback Request",
    purpose: "Collect feedback",
    locales: ["en"],
    status: "draft",
    variables: ["customer_name"],
    lastUsedAt: null,
    errorRate: 0,
  }),
];

export const mockFlows: FlowMeta[] = [
  createFlowMeta({
    id: "flow-onboarding",
    title: "Vendor Onboarding",
    version: "1.2.0",
    status: "published",
    linkedEndpoints: ["edge:vendor-onboarding", "rest:/vendors/{id}"],
    lastErrorAt: null,
  }),
  createFlowMeta({
    id: "flow-ocr-review",
    title: "OCR Review Helper",
    version: "0.9.1",
    status: "draft",
    linkedEndpoints: ["edge:ocr-review"],
    lastErrorAt: formatISO(subDays(now, 3)),
  }),
];

export const mockNotifications: NotificationOutbox[] = Array.from({
  length: 15,
}, (_, idx) =>
  createNotification({
    id: `notif-${idx + 1}`,
    toRole: idx % 2 === 0 ? "vendor" : "customer",
    type: idx % 3 === 0 ? "order_created_vendor" : "order_paid_customer",
    status: (["queued", "sent", "failed"] as const)[idx % 3],
    createdAt: formatISO(subDays(now, idx / 4)),
    sentAt: idx % 3 === 0 ? null : formatISO(subDays(now, idx / 6)),
  }));

export const mockAuditEvents: AuditEvent[] = Array.from(
  { length: 12 },
  (_, idx) =>
    createAuditEvent({
      id: `audit-${idx + 1}`,
      actor: idx % 2 === 0 ? "admin:ops" : "system",
      action: ["dispatch_override", "settings_update", "campaign_start"][idx % 3],
      targetTable: ["dispatch_overrides", "settings", "campaigns"][idx % 3],
      targetId: `target-${idx + 1}`,
      createdAt: formatISO(subDays(now, idx / 5)),
      summary: idx % 3 === 1 ? "Quiet hours updated for Rwanda" : null,
    }),
);

export const mockSettingsEntries: SettingEntry[] = [
  createSettingEntry({
    key: "quiet_hours.rw",
    description: "Quiet hours window for Rwanda (local time).",
    updatedAt: formatISO(subDays(now, 1)),
    valuePreview: "22:00 – 06:00",
  }),
  createSettingEntry({
    key: "send_throttle.whatsapp.per_minute",
    description: "Per-minute WhatsApp send cap.",
    updatedAt: formatISO(subDays(now, 2)),
    valuePreview: "60",
  }),
  createSettingEntry({
    key: "templates",
    description: "Registered WhatsApp templates metadata.",
    updatedAt: formatISO(subDays(now, 0.5)),
    valuePreview: "3 templates",
  }),
  createSettingEntry({
    key: "opt_out.list",
    description: "List of opted-out MSISDN hashes (mock).",
    updatedAt: formatISO(subDays(now, 3)),
    valuePreview: JSON.stringify(["+250780000099"]),
  }),
];

export const mockAdminAlertPreferences: AdminAlertPreference[] =
  ALERT_DEFINITIONS.map((definition, index) =>
    createAdminAlertPreference({
      key: definition.key,
      label: definition.label,
      description: definition.description,
      severity: definition.severity,
      channels: definition.defaultChannels,
      enabled: index % 4 !== 1,
      updatedAt: formatISO(subDays(now, index % 5)),
      availableChannels: DEFAULT_ALERT_CHANNELS,
    })
  );

export const mockStorageObjects: StorageObject[] = [
  createStorageObject({
    id: "storage-1",
    bucket: "operations",
    path: "dispatch-123.png",
    mimeType: "image/png",
    sizeKb: 240,
    updatedAt: formatISO(subDays(now, 1)),
  }),
  createStorageObject({
    id: "storage-2",
    bucket: "qr",
    path: "bars/bar-1/table-5.png",
    mimeType: "image/png",
    sizeKb: 120,
    updatedAt: formatISO(subDays(now, 0.3)),
  }),
  createStorageObject({
    id: "storage-3",
    bucket: "campaign-media",
    path: "campaigns/october/hero.jpg",
    mimeType: "image/jpeg",
    sizeKb: 540,
    updatedAt: formatISO(subDays(now, 2)),
  }),
  createStorageObject({
    id: "storage-4",
    bucket: "docs",
    path: "insurance/quote-2.pdf",
    mimeType: "application/pdf",
    sizeKb: 880,
    updatedAt: formatISO(subDays(now, 4)),
  }),
];

export const mockAssistantRuns: AssistantRun[] = [
  createAssistantRun({
    promptId: "summary.last24h",
    suggestion: {
      id: "assistant-summary-24h",
      title: "Last 24 hours — notifications + dispatch",
      summary:
        "Notification throughput held steady (62 triggered, 58 delivered). Two numbers hit the opt-out list and five sends were delayed during quiet hours. Matching RPC latency dipped at 03:00 but recovered after the cache warm-up run.",
      generatedAt: formatISO(now),
      actions: [
        {
          id: "action-retry-quiet",
          label: "Schedule quiet-hour retries",
          summary:
            "Queue the five blocked sends for 07:05 with a compliance note in the incident channel.",
          impact: "medium",
          recommended: true,
        },
        {
          id: "action-followup-optout",
          label: "Flag opt-out contacts",
          summary:
            "Append the two numbers to the suppression matrix and confirm marketing has the latest export.",
          impact: "low",
        },
      ],
      references: [
        "Notifications → Outbox (filtered: failed)",
        "Dispatch → Events (last 24h)",
        "Logs → matching_latency_warn",
      ],
      limitations: [
        "Data sampled from staging fixtures. Validate in Supabase before running follow-up.",
      ],
    },
    messages: [
      {
        id: "assistant-summary-24h-msg",
        role: "assistant",
        content:
          "Here's what happened in the last 24 hours. Dispatch throughput held, but quiet hours blocked five sends and two new opt-outs appeared in Rwanda. Matching RPCs spiked for 6 minutes around 03:00 UTC before the cache run restored performance.",
        createdAt: formatISO(now),
      },
    ],
  }),
  createAssistantRun({
    promptId: "policy.explainBlock",
    suggestion: {
      id: "assistant-policy-explain",
      title: "Why was the send blocked?",
      summary:
        "The contact +250780000099 is in the opt-out list (`opt_out.list`). Policy enforcement returned `policy_blocked` with reason `opt_out`. No retries were attempted because the last consent refresh was under 24 hours old.",
      generatedAt: formatISO(addDays(now, -1)),
      actions: [
        {
          id: "action-notify-support",
          label: "Notify support queue",
          summary:
            "Drop a template response into the support queue so the agent can confirm the opt-out and record the reason.",
          impact: "low",
          recommended: true,
        },
        {
          id: "action-defer",
          label: "Defer to compliance",
          summary:
            "Hold any manual overrides until compliance confirms the customer's consent state.",
          impact: "low",
        },
      ],
      references: ["opt_out.list"],
      limitations: [
        "Mock data only; hook this up to ADMIN policies once the backend ships.",
      ],
    },
    messages: [
      {
        id: "assistant-policy-explain-msg",
        role: "assistant",
        content:
          "Policy enforcement blocked the send because +250780000099 appears in the opt-out list. No retry scheduled.",
        createdAt: formatISO(addDays(now, -1)),
      },
    ],
  }),
  createAssistantRun({
    promptId: "freeform.query",
    messages: [
      {
        id: "assistant-freeform-msg",
        role: "assistant",
        content:
          "This is a placeholder response. Swap in the API client when the assistant endpoint ships.",
        createdAt: formatISO(now),
      },
    ],
    suggestion: {
      id: "assistant-freeform",
      title: "Freeform mock",
      summary:
        "I used the mock dataset to answer the custom query. Replace me with the live bridge once the endpoint is available.",
      generatedAt: formatISO(now),
      actions: [
        {
          id: "action-document-followup",
          label: "Document request",
          summary:
            "Capture this freeform ask so we can wire a real workflow later.",
          impact: "low",
        },
      ],
      references: ["Mock data only"],
      limitations: ["Freeform prompts rely on fixtures right now."],
    },
  }),
];

export const mockAdminHubSnapshot: AdminHubSnapshot = createAdminHubSnapshot({
  sections: {
    operations: [
      { id: "ADMIN::OPS_TRIPS", title: "Trips (live)" },
      { id: "ADMIN::OPS_MARKETPLACE", title: "Marketplace" },
      { id: "ADMIN::OPS_WALLET", title: "Wallet & tokens" },
      { id: "ADMIN::OPS_MOMO", title: "MoMo QR" },
    ],
    growth: [
      { id: "ADMIN::GROW_PROMOTERS", title: "Promoters" },
      { id: "ADMIN::GROW_BROADCAST", title: "Broadcast" },
      { id: "ADMIN::GROW_TEMPLATES", title: "Templates" },
    ],
    trust: [
      { id: "ADMIN::TRUST_REFERRALS", title: "Referrals" },
      { id: "ADMIN::TRUST_FREEZE", title: "Freeze account" },
    ],
    diagnostics: [
      { id: "ADMIN::DIAG_MATCH", title: "Match diagnostics" },
      { id: "ADMIN::DIAG_INSURANCE", title: "Insurance diagnostics" },
      { id: "ADMIN::DIAG_HEALTH", title: "System health" },
      { id: "ADMIN::DIAG_LOGS", title: "Logs" },
    ],
  },
  messages: [
    "Mock admin hub data. Configure Supabase credentials to load live sections.",
  ],
});

export const mockAdminDiagnostics: AdminDiagnosticsSnapshot =
  createAdminDiagnosticsSnapshot({
    health: {
      config: {
        admin_numbers: ["+250700000001", "+250700000002"],
        insurance_admin_numbers: ["+250780000123"],
        admin_pin_required: true,
      },
      messages: [
        "Mock diagnostics health. Flow-exchange bridge not connected.",
      ],
    },
    logs: {
      logs: Array.from({ length: 4 }, (_, index) => ({
        id: `log-${index + 1}`,
        endpoint: index % 2 === 0 ? "wa-webhook" : "flow-exchange",
        status_code: index % 2 === 0 ? 500 : 200,
        received_at: formatISO(subDays(now, index / 4)),
      })),
      messages: ["Mock webhook logs. Configure Supabase for live data."],
    },
    matches: {
      matchesLastHour: 6,
      matchesLast24h: 42,
      openTrips: 3,
      errorCountLastHour: 1,
      recentErrors: [
        {
          id: "error-1",
          endpoint: "MOBILITY_MATCH",
          status_code: 500,
          received_at: formatISO(subDays(now, 0.05)),
        },
      ],
      messages: [
        "Mock mobility diagnostics. Configure Supabase for live telemetry.",
      ],
    },
    queues: {
      notificationsQueued: 18,
      ocrPending: 5,
      mobilityOpenTrips: 7,
    },
  });

export const mockAdminDiagnosticsMatch: AdminDiagnosticsMatch =
  createAdminDiagnosticsMatch({
    trip: {
      id: "trip-123",
      role: "driver",
      vehicleType: "car",
      status: "matched",
    },
    messages: [
      "Mock diagnostics trip data. Configure Supabase for live lookup.",
    ],
  });
