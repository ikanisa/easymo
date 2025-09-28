import { addDays, formatISO, subDays } from "./time-utils";
import type {
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
} from "./schemas";

const now = new Date();

export const mockUsers: User[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    msisdn: "+250780000001",
    displayName: "Fixture User One",
    locale: "rw-RW",
    roles: ["customer"],
    status: "active",
    createdAt: formatISO(subDays(now, 120)),
    lastSeenAt: formatISO(subDays(now, 1)),
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    msisdn: "+35699000002",
    displayName: "Fixture User Two",
    locale: "en-MT",
    roles: ["customer", "station_operator"],
    status: "active",
    createdAt: formatISO(subDays(now, 45)),
    lastSeenAt: formatISO(subDays(now, 3)),
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    msisdn: "+250780000003",
    displayName: "Fixture User Three",
    locale: "rw-RW",
    roles: ["customer"],
    status: "blocked",
    createdAt: formatISO(subDays(now, 200)),
    lastSeenAt: null,
  },
];

export const mockStations: Station[] = [
  {
    id: "station-1",
    name: "Engen Kigali Downtown",
    engencode: "ENG-001",
    ownerContact: "+250780000010",
    status: "active",
    location: { lat: -1.9441, lng: 30.0619 },
    updatedAt: formatISO(subDays(now, 5)),
  },
  {
    id: "station-2",
    name: "Engen Remera",
    engencode: "ENG-002",
    ownerContact: "+250780000011",
    status: "active",
    location: { lat: -1.9638, lng: 30.1202 },
    updatedAt: formatISO(subDays(now, 2)),
  },
  {
    id: "station-3",
    name: "Engen Bugesera",
    engencode: "ENG-005",
    ownerContact: "+250780000012",
    status: "inactive",
    location: null,
    updatedAt: formatISO(subDays(now, 20)),
  },
];

export const mockBars: Bar[] = [
  {
    id: "bar-1",
    name: "Chez Lando Rooftop",
    slug: "chez-lando-rooftop",
    location: "Remera, Kigali",
    isActive: true,
    receivingNumbers: 3,
    publishedMenuVersion: "v23",
    lastUpdated: formatISO(subDays(now, 1)),
    createdAt: formatISO(subDays(now, 120)),
    momoCode: "*182*8*1*123456#",
    serviceCharge: 0.1,
    directChatEnabled: true,
    defaultPrepMinutes: 18,
    paymentInstructions:
      "Dial the MoMo code and confirm table number on ticket.",
  },
  {
    id: "bar-2",
    name: "Kigali Jazz Lounge",
    slug: "kigali-jazz-lounge",
    location: "CBD, Kigali",
    isActive: true,
    receivingNumbers: 2,
    publishedMenuVersion: "v11",
    lastUpdated: formatISO(subDays(now, 3)),
    createdAt: formatISO(subDays(now, 90)),
    momoCode: "*182*8*1*654321#",
    serviceCharge: 0.08,
    directChatEnabled: false,
    defaultPrepMinutes: 20,
    paymentInstructions: "Customer pays after order confirmation.",
  },
  {
    id: "bar-3",
    name: "Bugesera Lakeside",
    slug: "bugesera-lakeside",
    location: "Bugesera",
    isActive: false,
    receivingNumbers: 1,
    publishedMenuVersion: null,
    lastUpdated: formatISO(subDays(now, 15)),
    createdAt: formatISO(subDays(now, 160)),
    momoCode: null,
    serviceCharge: null,
    directChatEnabled: false,
    defaultPrepMinutes: null,
    paymentInstructions: null,
  },
];

export const mockVouchers: Voucher[] = Array.from(
  { length: 25 },
  (_, index) => {
    const statusCycle: Voucher["status"][] = [
      "issued",
      "sent",
      "redeemed",
      "expired",
      "void",
    ];
    const status = statusCycle[index % statusCycle.length];
    const issuedAt = subDays(now, Math.floor(Math.random() * 30));
    const redeemedAt = status === "redeemed" ? addDays(issuedAt, 1) : null;
    return {
      id: `voucher-${index + 1}`,
      userId: mockUsers[index % mockUsers.length].id,
      userName: mockUsers[index % mockUsers.length].displayName,
      msisdn: mockUsers[index % mockUsers.length].msisdn,
      code: `K${(10000 + index).toString().slice(-5)}`,
      amount: 2000,
      currency: "RWF",
      status,
      campaignId: index % 2 === 0 ? "campaign-1" : null,
      stationScope: index % 3 === 0 ? mockStations[0].id : null,
      issuedAt: formatISO(issuedAt),
      redeemedAt: redeemedAt ? formatISO(redeemedAt) : null,
      expiresAt: formatISO(addDays(issuedAt, 30)),
    };
  },
);

export const mockCampaigns: Campaign[] = [
  {
    id: "campaign-1",
    name: "October Fuel Promo",
    type: "voucher",
    status: "running",
    templateId: "voucher_october_promo",
    createdAt: formatISO(subDays(now, 14)),
    startedAt: formatISO(subDays(now, 10)),
    metadata: { dailyTarget: 100 },
  },
  {
    id: "campaign-2",
    name: "Welcome Broadcast",
    type: "promo",
    status: "draft",
    templateId: "welcome_messaging_v1",
    createdAt: formatISO(subDays(now, 4)),
    startedAt: null,
    metadata: { note: "Pending compliance review" },
  },
];

export const mockInsuranceQuotes: InsuranceQuote[] = [
  {
    id: "quote-1",
    userId: mockUsers[0].id,
    status: "pending",
    premium: 15000,
    insurer: "Allied Assurance",
    uploadedDocs: ["docs/insurance/quote-1.pdf"],
    createdAt: formatISO(subDays(now, 2)),
    updatedAt: null,
    reviewerComment: null,
  },
  {
    id: "quote-2",
    userId: mockUsers[1].id,
    status: "approved",
    premium: 18000,
    insurer: "Allied Assurance",
    uploadedDocs: ["docs/insurance/quote-2.pdf"],
    createdAt: formatISO(subDays(now, 5)),
    updatedAt: formatISO(subDays(now, 1)),
    reviewerComment: "Clear scans; approved for issuance.",
  },
  {
    id: "quote-3",
    userId: mockUsers[2].id,
    status: "needs_changes",
    premium: null,
    insurer: null,
    uploadedDocs: ["docs/insurance/quote-3.pdf"],
    createdAt: formatISO(subDays(now, 7)),
    updatedAt: formatISO(subDays(now, 2)),
    reviewerComment: "Need higher-resolution invoice photo.",
  },
];

export const mockDashboardKpis: DashboardKpi[] = [
  {
    label: "Active users (7d / 30d)",
    primaryValue: "1,240",
    secondaryValue: "+3.2% vs last week",
    trend: "up",
    helpText: "Unique users who interacted with WhatsApp flows.",
  },
  {
    label: "Vouchers issued / sent / redeemed",
    primaryValue: "92 / 88 / 74",
    secondaryValue: "80% redemption rate",
    trend: "up",
    helpText: "Rolling 7-day totals.",
  },
  {
    label: "WhatsApp delivery rate",
    primaryValue: "97.4%",
    secondaryValue: "-0.6% vs last week",
    trend: "down",
    helpText: "Successful sends divided by total attempts.",
  },
  {
    label: "Pending orders > 15m",
    primaryValue: "4",
    secondaryValue: "2 flagged for follow-up",
    trend: "flat",
  },
];

export const mockTimeseries: TimeseriesPoint[] = Array.from(
  { length: 14 },
  (_, index) => {
    const day = subDays(now, 13 - index);
    return {
      date: formatISO(day),
      issued: Math.round(40 + Math.random() * 20),
      redeemed: Math.round(30 + Math.random() * 18),
    };
  },
);

export const mockMenuVersions: MenuVersion[] = mockBars.flatMap((
  bar,
  index,
) => [
  {
    id: `menu-${bar.id}-draft`,
    barId: bar.id,
    barName: bar.name,
    version: `v${20 - index}`,
    status: "draft",
    source: "ocr",
    categories: 8,
    items: 42,
    updatedAt: formatISO(subDays(now, index + 1)),
  },
  {
    id: `menu-${bar.id}-published`,
    barId: bar.id,
    barName: bar.name,
    version: bar.publishedMenuVersion ?? "v1",
    status: "published",
    source: "manual",
    categories: 7,
    items: 35,
    updatedAt: formatISO(subDays(now, index + 6)),
  },
]);

export const mockOcrJobs: OcrJob[] = Array.from({ length: 6 }, (_, idx) => {
  const statusCycle: OcrJob["status"][] = [
    "queued",
    "processing",
    "success",
    "error",
  ];
  return {
    id: `ocr-${idx + 1}`,
    barId: mockBars[idx % mockBars.length].id,
    barName: mockBars[idx % mockBars.length].name,
    fileName: `menu-${idx + 1}.pdf`,
    type: idx % 2 === 0 ? "pdf" : "image",
    status: statusCycle[idx % statusCycle.length],
    durationSeconds: idx % 4 >= 2 ? 85 + idx * 5 : null,
    retries: idx % 3,
    submittedAt: formatISO(subDays(now, idx)),
  };
});

export const mockOrders: Order[] = Array.from({ length: 18 }, (_, index) => {
  const bar = mockBars[index % mockBars.length];
  const createdAt = subDays(now, Math.floor(index / 4));
  return {
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
  };
});

export const mockOrderEvents: OrderEvent[] = mockOrders.slice(0, 10).map((
  order,
  index,
) => ({
  id: `event-${order.id}`,
  orderId: order.id,
  type:
    ["created", "vendor_ack", "preparing", "completed", "cancelled"][index % 5],
  status: order.status,
  actor: index % 2 === 0 ? "vendor" : "system",
  note: index % 5 === 4 ? "Admin cancelled after vendor timeout." : null,
  createdAt: formatISO(subDays(now, index / 5)),
}));

export const mockWebhookErrors: WebhookError[] = Array.from(
  { length: 6 },
  (_, idx) => ({
    id: `webhook-${idx + 1}`,
    endpoint: idx % 2 === 0 ? "wa-webhook/orders" : "wa-webhook/ocr",
    failureReason: idx % 3 === 0 ? "Timeout" : "HTTP 500 from downstream",
    createdAt: formatISO(subDays(now, idx / 3)),
    retryUrl: "#",
  }),
);

export const mockStaffNumbers: StaffNumber[] = mockBars.flatMap((bar, idx) => [
  {
    id: `${bar.id}-num-1`,
    barName: bar.name,
    number: `+2507800001${idx}`,
    role: "owner",
    active: true,
    verified: true,
    addedBy: "Admin Ops",
    lastSeenAt: formatISO(subDays(now, idx)),
  },
  {
    id: `${bar.id}-num-2`,
    barName: bar.name,
    number: `+2507800002${idx}`,
    role: "manager",
    active: idx % 2 === 0,
    verified: idx % 3 !== 0,
    addedBy: "Support Agent",
    lastSeenAt: idx % 2 === 0 ? formatISO(subDays(now, idx + 1)) : null,
  },
]);

export const mockQrTokens: QrToken[] = Array.from({ length: 10 }, (_, idx) => ({
  id: `qr-${idx + 1}`,
  barName: mockBars[idx % mockBars.length].name,
  tableLabel: `Table ${(idx % 6) + 1}`,
  token: `TOKEN-${idx + 100}`,
  createdAt: formatISO(subDays(now, idx)),
  printed: idx % 3 === 0,
  lastScanAt: idx % 2 === 0 ? formatISO(subDays(now, idx / 2)) : null,
}));

export const mockTemplates: TemplateMeta[] = [
  {
    id: "promo_generic",
    name: "Promo Generic",
    purpose: "Broadcast promo",
    locales: ["rw", "en"],
    status: "approved",
    variables: ["customer_name", "cta_link"],
    lastUsedAt: formatISO(subDays(now, 1)),
    errorRate: 0.8,
  },
  {
    id: "voucher_issue",
    name: "Voucher Issued",
    purpose: "Send voucher ticket",
    locales: ["rw"],
    status: "approved",
    variables: ["amount", "voucher_code"],
    lastUsedAt: formatISO(subDays(now, 0.5)),
    errorRate: 0.2,
  },
  {
    id: "feedback_request",
    name: "Feedback Request",
    purpose: "Collect feedback",
    locales: ["en"],
    status: "draft",
    variables: ["customer_name"],
    lastUsedAt: null,
    errorRate: 0,
  },
];

export const mockFlows: FlowMeta[] = [
  {
    id: "flow-onboarding",
    title: "Vendor Onboarding",
    version: "1.2.0",
    status: "published",
    linkedEndpoints: ["edge:vendor-onboarding", "rest:/vendors/{id}"],
    lastErrorAt: null,
  },
  {
    id: "flow-ocr-review",
    title: "OCR Review Helper",
    version: "0.9.1",
    status: "draft",
    linkedEndpoints: ["edge:ocr-review"],
    lastErrorAt: formatISO(subDays(now, 3)),
  },
];

export const mockNotifications: NotificationOutbox[] = Array.from({
  length: 15,
}, (_, idx) => ({
  id: `notif-${idx + 1}`,
  toRole: idx % 2 === 0 ? "vendor" : "customer",
  type: idx % 3 === 0 ? "order_created_vendor" : "order_paid_customer",
  status: (["queued", "sent", "failed"] as const)[idx % 3],
  createdAt: formatISO(subDays(now, idx / 4)),
  sentAt: idx % 3 === 0 ? null : formatISO(subDays(now, idx / 6)),
}));

export const mockAuditEvents: AuditEvent[] = Array.from(
  { length: 12 },
  (_, idx) => ({
    id: `audit-${idx + 1}`,
    actor: idx % 2 === 0 ? "admin:ops" : "system",
    action: ["voucher_issue", "settings_update", "campaign_start"][idx % 3],
    targetTable: ["vouchers", "settings", "campaigns"][idx % 3],
    targetId: `target-${idx + 1}`,
    createdAt: formatISO(subDays(now, idx / 5)),
    summary: idx % 3 === 1 ? "Quiet hours updated for Rwanda" : null,
  }),
);

export const mockSettingsEntries: SettingEntry[] = [
  {
    key: "quiet_hours.rw",
    description: "Quiet hours window for Rwanda (local time).",
    updatedAt: formatISO(subDays(now, 1)),
    valuePreview: "22:00 – 06:00",
  },
  {
    key: "send_throttle.whatsapp.per_minute",
    description: "Per-minute WhatsApp send cap.",
    updatedAt: formatISO(subDays(now, 2)),
    valuePreview: "60",
  },
  {
    key: "templates",
    description: "Registered WhatsApp templates metadata.",
    updatedAt: formatISO(subDays(now, 0.5)),
    valuePreview: "3 templates",
  },
  {
    key: "opt_out.list",
    description: "List of opted-out MSISDN hashes (mock).",
    updatedAt: formatISO(subDays(now, 3)),
    valuePreview: JSON.stringify(["+250780000099"]),
  },
];

export const mockStorageObjects: StorageObject[] = [
  {
    id: "storage-1",
    bucket: "vouchers",
    path: "voucher-123.png",
    mimeType: "image/png",
    sizeKb: 240,
    updatedAt: formatISO(subDays(now, 1)),
  },
  {
    id: "storage-2",
    bucket: "qr",
    path: "bars/bar-1/table-5.png",
    mimeType: "image/png",
    sizeKb: 120,
    updatedAt: formatISO(subDays(now, 0.3)),
  },
  {
    id: "storage-3",
    bucket: "campaign-media",
    path: "campaigns/october/hero.jpg",
    mimeType: "image/jpeg",
    sizeKb: 540,
    updatedAt: formatISO(subDays(now, 2)),
  },
  {
    id: "storage-4",
    bucket: "docs",
    path: "insurance/quote-2.pdf",
    mimeType: "application/pdf",
    sizeKb: 880,
    updatedAt: formatISO(subDays(now, 4)),
  },
];
