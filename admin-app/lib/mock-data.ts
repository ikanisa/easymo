import { addDays, formatISO, subDays } from "./time-utils";
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
  InsuranceComparisonQuote,
  InsuranceDocument,
  InsurancePayment,
  InsurancePolicy,
  InsuranceQuote,
  InsuranceRequest,
  InsuranceTask,
  InsuranceVehicle,
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
  createDashboardKpi,
  createFlowMeta,
  createInsuranceQuote,
  createMenuVersion,
  createNotification,
  createOcrJob,
  createQrToken,
  createSettingEntry,
  createStaffNumber,
  createStorageObject,
  createWebhookError,
} from "@/lib/test-utils/factories";
import { mockBars, mockStations, mockUsers } from "@/lib/test-utils/mock-base";
export { mockBars, mockUsers, mockStations };

const now = new Date();
const currencyFormatter = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Math.round(value));
}

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

const insuranceVehicles: InsuranceVehicle[] = [
  {
    id: "veh-req-2024-0001",
    requestId: "req-2024-0001",
    plateNumber: "RAB 123C",
    vin: "JH4DA9350MS000001",
    make: "Toyota",
    model: "RAV4",
    bodyType: "SUV",
    year: 2019,
    usage: "PRIVATE",
    coverType: "Comprehensive",
    sumInsuredMinor: 24_000_000,
    seats: 5,
    comesaRequested: true,
    extras: { fuel: "Petrol", color: "Blue" },
  },
  {
    id: "veh-req-2024-0002",
    requestId: "req-2024-0002",
    plateNumber: "RAD 987K",
    vin: "WAUZZZ8V0JA000789",
    make: "Audi",
    model: "A3",
    bodyType: "Hatchback",
    year: 2021,
    usage: "PRIVATE",
    coverType: "Comprehensive",
    sumInsuredMinor: 32_000_000,
    seats: 5,
    comesaRequested: false,
    extras: { fuel: "Diesel", trim: "S-line" },
  },
  {
    id: "veh-req-2024-0003",
    requestId: "req-2024-0003",
    plateNumber: "RAC 441T",
    vin: "KM8JU3AG9EU000123",
    make: "Hyundai",
    model: "Tucson",
    bodyType: "SUV",
    year: 2017,
    usage: "TAXI_PSV",
    coverType: "Third party",
    sumInsuredMinor: 12_000_000,
    seats: 7,
    comesaRequested: false,
    extras: { cooperative: "CityTaxi", inspection: "due" },
  },
];

const insurancePolicies: InsurancePolicy[] = [
  {
    id: "pol-2024-0101",
    requestId: "req-2024-0002",
    policyNumber: "RAD-987K/2024",
    insurer: "Radiant",
    status: "active",
    effectiveFrom: formatISO(subDays(now, 15)),
    effectiveTo: formatISO(addDays(now, 350)),
    premiumTotalMinor: 428_000,
    feesMinor: 18_000,
    issuedAt: formatISO(subDays(now, 14)),
    issuedBy: "uw.radiant",
    breakdown: [
      {
        id: "pb-2024-0101-base",
        policyId: "pol-2024-0101",
        label: "Base premium",
        amountMinor: 360_000,
        metadata: { rate: "1.2%" },
        sortOrder: 1,
      },
      {
        id: "pb-2024-0101-taxes",
        policyId: "pol-2024-0101",
        label: "VAT",
        amountMinor: 54_000,
        metadata: { taxRate: "18%" },
        sortOrder: 2,
      },
      {
        id: "pb-2024-0101-fee",
        policyId: "pol-2024-0101",
        label: "Stamp duty",
        amountMinor: 14_000,
        metadata: { schedule: "A" },
        sortOrder: 3,
      },
    ],
  },
  {
    id: "pol-2024-0102",
    requestId: "req-2024-0003",
    policyNumber: "RAC-441T/2024",
    insurer: "Prime Life",
    status: "pending_issue",
    effectiveFrom: null,
    effectiveTo: null,
    premiumTotalMinor: 186_000,
    feesMinor: 9_000,
    issuedAt: null,
    issuedBy: null,
    breakdown: [
      {
        id: "pb-2024-0102-base",
        policyId: "pol-2024-0102",
        label: "Third party premium",
        amountMinor: 150_000,
        metadata: { seatBand: "7-10" },
        sortOrder: 1,
      },
      {
        id: "pb-2024-0102-tax",
        policyId: "pol-2024-0102",
        label: "VAT",
        amountMinor: 27_000,
        metadata: { taxRate: "18%" },
        sortOrder: 2,
      },
    ],
  },
];

const insuranceDocuments: InsuranceDocument[] = [
  {
    id: "doc-req-2024-0001-logbook",
    requestId: "req-2024-0001",
    policyId: null,
    docType: "logbook",
    storagePath: "insurance/req-2024-0001/logbook.pdf",
    source: "upload",
    ocrConfidence: 0.66,
    uploadedBy: "customer.jean",
    uploadedAt: formatISO(subDays(now, 1)),
    verified: false,
    ocrPayload: { plateNumber: "RAB 123C", make: "Toyota" },
  },
  {
    id: "doc-req-2024-0001-id",
    requestId: "req-2024-0001",
    policyId: null,
    docType: "id_card",
    storagePath: "insurance/req-2024-0001/id-card.png",
    source: "upload",
    ocrConfidence: 0.92,
    uploadedBy: "ops.linda",
    uploadedAt: formatISO(subDays(now, 1)),
    verified: true,
    ocrPayload: { idNumber: "1199770000001010" },
  },
  {
    id: "doc-req-2024-0002-quote",
    requestId: "req-2024-0002",
    policyId: "pol-2024-0101",
    docType: "quotation",
    storagePath: "insurance/req-2024-0002/quote.pdf",
    source: "upload",
    ocrConfidence: 0.88,
    uploadedBy: "ops.tuyishime",
    uploadedAt: formatISO(subDays(now, 3)),
    verified: true,
    ocrPayload: { insurer: "Radiant", premium: 428000 },
  },
  {
    id: "doc-req-2024-0003-ycard",
    requestId: "req-2024-0003",
    policyId: "pol-2024-0102",
    docType: "yellow_card",
    storagePath: "insurance/req-2024-0003/yellow-card.pdf",
    source: "ocr",
    ocrConfidence: 0.71,
    uploadedBy: "ops.nadine",
    uploadedAt: formatISO(subDays(now, 5)),
    verified: false,
    ocrPayload: { seats: 7, expiry: formatISO(addDays(now, 25)) },
  },
];

const insurancePayments: InsurancePayment[] = [
  {
    id: "pay-req-2024-0001-1",
    requestId: "req-2024-0001",
    policyId: null,
    amountMinor: 320_000,
    currency: "RWF",
    method: "momo",
    status: "in_review",
    reference: "REQ-2024-0001-DEP",
    momoReference: "*182*8*1*123456#",
    paidAt: null,
    createdAt: formatISO(subDays(now, 0.5)),
    updatedAt: formatISO(subDays(now, 0.1)),
  },
  {
    id: "pay-pol-2024-0101",
    requestId: "req-2024-0002",
    policyId: "pol-2024-0101",
    amountMinor: 428_000,
    currency: "RWF",
    method: "momo",
    status: "completed",
    reference: "RAD-987K-2024",
    momoReference: "BK428000",
    paidAt: formatISO(subDays(now, 13)),
    createdAt: formatISO(subDays(now, 14)),
    updatedAt: formatISO(subDays(now, 13)),
  },
  {
    id: "pay-pol-2024-0102",
    requestId: "req-2024-0003",
    policyId: "pol-2024-0102",
    amountMinor: 186_000,
    currency: "RWF",
    method: "cash",
    status: "pending",
    reference: "RAC-441T-2024",
    momoReference: null,
    paidAt: null,
    createdAt: formatISO(subDays(now, 2)),
    updatedAt: formatISO(subDays(now, 2)),
  },
];

const insuranceTasks: InsuranceTask[] = [
  {
    id: "task-req-2024-0001-ocr",
    requestId: "req-2024-0001",
    policyId: null,
    title: "Verify OCR discrepancies",
    taskType: "ocr_review",
    status: "in_progress",
    priority: 1,
    dueAt: formatISO(addDays(now, 1)),
    assignedTo: "ops.linda@wa",
    createdBy: "ops.linda@wa",
    createdAt: formatISO(subDays(now, 1)),
    updatedAt: formatISO(subDays(now, 0.2)),
  },
  {
    id: "task-req-2024-0001-followup",
    requestId: "req-2024-0001",
    policyId: null,
    title: "Call customer for plate confirmation",
    taskType: "follow_up",
    status: "open",
    priority: 2,
    dueAt: formatISO(addDays(now, 2)),
    assignedTo: "ops.nadine@wa",
    createdBy: "ops.linda@wa",
    createdAt: formatISO(subDays(now, 0.5)),
    updatedAt: formatISO(subDays(now, 0.5)),
  },
  {
    id: "task-pol-2024-0101-issuance",
    requestId: "req-2024-0002",
    policyId: "pol-2024-0101",
    title: "Upload signed cover note",
    taskType: "issuance",
    status: "completed",
    priority: 1,
    dueAt: formatISO(subDays(now, 12)),
    assignedTo: "ops.tuyishime@wa",
    createdBy: "ops.tuyishime@wa",
    createdAt: formatISO(subDays(now, 15)),
    updatedAt: formatISO(subDays(now, 12)),
  },
  {
    id: "task-pol-2024-0102-payment",
    requestId: "req-2024-0003",
    policyId: "pol-2024-0102",
    title: "Collect PSV endorsement payment",
    taskType: "payment",
    status: "open",
    priority: 1,
    dueAt: formatISO(addDays(now, 3)),
    assignedTo: "ops.nadine@wa",
    createdBy: "ops.nadine@wa",
    createdAt: formatISO(subDays(now, 2)),
    updatedAt: formatISO(subDays(now, 2)),
  },
];

const insuranceComparisons: Record<string, InsuranceComparisonQuote[]> = {
  "req-2024-0001": [
    {
      insurer: "BK Insurance",
      product: "Motor Comprehensive",
      grossPremiumMinor: 334_000,
      netPremiumMinor: 308_000,
      feesMinor: 12_000,
      taxesMinor: 14_000,
      turnaroundHours: 2,
      notes: ["Includes roadside assistance"],
    },
    {
      insurer: "Radiant",
      product: "Comprehensive",
      grossPremiumMinor: 352_000,
      netPremiumMinor: 320_000,
      feesMinor: 10_000,
      taxesMinor: 22_000,
      turnaroundHours: 4,
      notes: ["Requires inspection"],
    },
    {
      insurer: "Prime Life",
      product: "Comprehensive",
      grossPremiumMinor: 365_000,
      netPremiumMinor: 330_000,
      feesMinor: 15_000,
      taxesMinor: 20_000,
      turnaroundHours: 6,
      notes: ["Offers two free endorsements"],
    },
  ],
  "req-2024-0002": [
    {
      insurer: "Radiant",
      product: "Executive Comprehensive",
      grossPremiumMinor: 428_000,
      netPremiumMinor: 384_000,
      feesMinor: 18_000,
      taxesMinor: 26_000,
      turnaroundHours: 1,
      notes: ["Instant issuance available"],
    },
    {
      insurer: "BK Insurance",
      product: "Executive Comprehensive",
      grossPremiumMinor: 439_000,
      netPremiumMinor: 392_000,
      feesMinor: 16_000,
      taxesMinor: 31_000,
      turnaroundHours: 3,
      notes: ["Requires valuation"],
    },
  ],
  "req-2024-0003": [
    {
      insurer: "Prime Life",
      product: "PSV Third Party",
      grossPremiumMinor: 186_000,
      netPremiumMinor: 150_000,
      feesMinor: 9_000,
      taxesMinor: 27_000,
      turnaroundHours: 8,
      notes: ["Yellow card included"],
    },
    {
      insurer: "Radiant",
      product: "PSV Third Party",
      grossPremiumMinor: 192_000,
      netPremiumMinor: 152_000,
      feesMinor: 12_000,
      taxesMinor: 28_000,
      turnaroundHours: 10,
      notes: ["Requires drivers list"],
    },
  ],
};

export const mockInsuranceVehicles = insuranceVehicles;
export const mockInsurancePolicies = insurancePolicies;
export const mockInsuranceDocuments = insuranceDocuments;
export const mockInsurancePayments = insurancePayments;
export const mockInsuranceTasks = insuranceTasks;
export const mockInsuranceComparisons = insuranceComparisons;

export const mockInsuranceRequests: InsuranceRequest[] = [
  {
    id: "req-2024-0001",
    customerId: mockUsers[0].id,
    customerName: "Jean Bosco",
    customerWaId: "250780000101",
    customerMsisdn: "+250780000101",
    status: "under_review",
    source: "whatsapp",
    preferredInsurer: "BK Insurance",
    premiumTargetMinor: 320_000,
    ocrConfidence: 0.68,
    ocrSummary: {
      flaggedFields: ["VIN"],
      remarks: "Plate number detected at 62% confidence.",
    },
    documents: insuranceDocuments.filter((doc) => doc.requestId === "req-2024-0001"),
    assignedAgentId: "ops.linda@wa",
    createdBy: "ops.linda@wa",
    createdAt: formatISO(subDays(now, 1)),
    updatedAt: formatISO(subDays(now, 0.1)),
    archivedAt: null,
    vehicle: insuranceVehicles.find((vehicle) => vehicle.requestId === "req-2024-0001") ?? null,
    comparison: insuranceComparisons["req-2024-0001"],
    policy: null,
    payments: insurancePayments.filter((payment) => payment.requestId === "req-2024-0001"),
    tasks: insuranceTasks.filter((task) => task.requestId === "req-2024-0001"),
  },
  {
    id: "req-2024-0002",
    customerId: mockUsers[1].id,
    customerName: "Sandrine Tuyishime",
    customerWaId: "250788888888",
    customerMsisdn: "+250788888888",
    status: "issued",
    source: "web_form",
    preferredInsurer: "Radiant",
    premiumTargetMinor: 430_000,
    ocrConfidence: 0.91,
    ocrSummary: { highlights: ["Document quality excellent"] },
    documents: insuranceDocuments.filter((doc) => doc.requestId === "req-2024-0002"),
    assignedAgentId: "ops.tuyishime@wa",
    createdBy: "ops.tuyishime@wa",
    createdAt: formatISO(subDays(now, 16)),
    updatedAt: formatISO(subDays(now, 12)),
    archivedAt: null,
    vehicle: insuranceVehicles.find((vehicle) => vehicle.requestId === "req-2024-0002") ?? null,
    comparison: insuranceComparisons["req-2024-0002"],
    policy: insurancePolicies.find((policy) => policy.requestId === "req-2024-0002") ?? null,
    payments: insurancePayments.filter((payment) => payment.requestId === "req-2024-0002"),
    tasks: insuranceTasks.filter((task) => task.requestId === "req-2024-0002"),
  },
  {
    id: "req-2024-0003",
    customerId: mockUsers[2].id,
    customerName: "Aimable Habimana",
    customerWaId: "250783333333",
    customerMsisdn: "+250783333333",
    status: "awaiting_payment",
    source: "partner_portal",
    preferredInsurer: "Prime Life",
    premiumTargetMinor: 190_000,
    ocrConfidence: 0.73,
    ocrSummary: {
      flaggedFields: ["Passenger seats"],
      remarks: "PSV license expiring soon.",
    },
    documents: insuranceDocuments.filter((doc) => doc.requestId === "req-2024-0003"),
    assignedAgentId: "ops.nadine@wa",
    createdBy: "ops.nadine@wa",
    createdAt: formatISO(subDays(now, 5)),
    updatedAt: formatISO(subDays(now, 2)),
    archivedAt: null,
    vehicle: insuranceVehicles.find((vehicle) => vehicle.requestId === "req-2024-0003") ?? null,
    comparison: insuranceComparisons["req-2024-0003"],
    policy: insurancePolicies.find((policy) => policy.requestId === "req-2024-0003") ?? null,
    payments: insurancePayments.filter((payment) => payment.requestId === "req-2024-0003"),
    tasks: insuranceTasks.filter((task) => task.requestId === "req-2024-0003"),
  },
];

const insuranceCustomerMap = new Map<
  string,
  {
    id: string;
    name: string;
    msisdn: string;
    status: InsuranceRequest["status"];
    lastRequestAt: string;
    preferredInsurer: string | null;
    documents: number;
    policies: number;
    outstandingMinor: number;
  }
>();

for (const request of mockInsuranceRequests) {
  const key = request.customerId ?? request.customerWaId ?? request.id;
  const existing = insuranceCustomerMap.get(key);
  const outstandingMinor = request.payments
    .filter((payment) => payment.status !== "completed")
    .reduce((total, payment) => total + payment.amountMinor, 0);
  const policyCount = mockInsurancePolicies.filter(
    (policy) => policy.requestId === request.id,
  ).length;
  const newRecord = {
    id: key ?? request.id,
    name: request.customerName ?? "Walk-in customer",
    msisdn: request.customerMsisdn ?? "",
    status: request.status,
    lastRequestAt: request.createdAt,
    preferredInsurer: request.preferredInsurer ?? null,
    documents: request.documents.length,
    policies: policyCount,
    outstandingMinor,
  };

  if (!existing) {
    insuranceCustomerMap.set(key, newRecord);
  } else {
    insuranceCustomerMap.set(key, {
      ...existing,
      lastRequestAt: existing.lastRequestAt > request.createdAt
        ? existing.lastRequestAt
        : request.createdAt,
      documents: existing.documents + request.documents.length,
      policies: existing.policies + policyCount,
      outstandingMinor: existing.outstandingMinor + outstandingMinor,
      preferredInsurer: existing.preferredInsurer ?? request.preferredInsurer ?? null,
      status: request.status,
    });
  }
}

export const mockInsuranceCustomers = Array.from(insuranceCustomerMap.values());

export const mockWorkflowBoard = [
  {
    id: "wf-intake-1",
    title: "Verify OCR discrepancies",
    stage: "Intake",
    owner: "Linda",
    dueAt: formatISO(addDays(now, 1)),
    status: "in_progress",
    priority: "high",
    relatedRequestId: "req-2024-0001",
  },
  {
    id: "wf-quote-1",
    title: "Finalize Prime Life quote",
    stage: "Quote",
    owner: "Nadine",
    dueAt: formatISO(addDays(now, 2)),
    status: "open",
    priority: "medium",
    relatedRequestId: "req-2024-0003",
  },
  {
    id: "wf-payment-1",
    title: "Match MoMo confirmation",
    stage: "Payments",
    owner: "Eric",
    dueAt: formatISO(addDays(now, -1)),
    status: "blocked",
    priority: "high",
    relatedRequestId: "req-2024-0002",
  },
  {
    id: "wf-issuance-1",
    title: "Upload cover note",
    stage: "Issuance",
    owner: "Sandrine",
    dueAt: formatISO(addDays(now, 3)),
    status: "open",
    priority: "low",
    relatedRequestId: "req-2024-0002",
  },
];

export const mockIntegrationTools = [
  {
    id: "tool-supabase",
    name: "Supabase",
    category: "Data",
    status: "connected",
    lastSyncAt: formatISO(subDays(now, 0.1)),
    description: "Primary source for policies, payments, and RLS enforcement.",
  },
  {
    id: "tool-whatsapp",
    name: "WhatsApp Business Platform",
    category: "Channels",
    status: "warning",
    lastSyncAt: formatISO(subDays(now, 1)),
    description: "Template send rate dipped below SLA—monitor retries.",
  },
  {
    id: "tool-insurer-api",
    name: "BK Insurance API",
    category: "Partner",
    status: "connected",
    lastSyncAt: formatISO(subDays(now, 0.3)),
    description: "Live issuance for comprehensive covers.",
  },
  {
    id: "tool-flowdesk",
    name: "Flowdesk",
    category: "Automation",
    status: "disconnected",
    lastSyncAt: null,
    description: "Pending credentials refresh for automated reminders.",
  },
];

export const mockAgentOverviewMetrics = [
  {
    label: "Requests handled (7d)",
    value: "142",
    change: "+12%",
    trend: "up",
  },
  {
    label: "Average quote turnaround",
    value: "2h 14m",
    change: "-18m",
    trend: "up",
  },
  {
    label: "Policy issuance rate",
    value: "78%",
    change: "+4%",
    trend: "up",
  },
  {
    label: "Payments pending",
    value: "6",
    change: "-2",
    trend: "down",
  },
];

export const mockAgentPlaybooks = [
  {
    id: "playbook-intake",
    title: "Intake triage",
    audience: "Intake pod",
    summary: "Checklist for validating OCR, customer intent, and regulatory docs.",
    steps: [
      "Confirm OCR confidence above 70% or escalate for manual review.",
      "Capture preferred insurer and policy start date.",
      "Assign tasks for missing documents and signature collection.",
    ],
  },
  {
    id: "playbook-payment",
    title: "Payment reconciliation",
    audience: "Finance",
    summary: "Ensure MoMo confirmations match Supabase payments table before issuance.",
    steps: [
      "Check for duplicate references in `insurance_payments`.",
      "Update status to completed with confirmation screenshot.",
      "Notify issuance pod when payment clears.",
    ],
  },
  {
    id: "playbook-issuance",
    title: "Issuance QA",
    audience: "Issuance pod",
    summary: "Double-check policy documents before sending to customer.",
    steps: [
      "Validate policy number and effective dates.",
      "Attach signed cover note and yellow card (if COMESA).",
      "Log issuance event in Supabase for audit.",
    ],
  },
];

export const mockLearningModules = [
  {
    id: "learning-ocr",
    title: "OCR best practices",
    durationMinutes: 18,
    difficulty: "Beginner",
    tags: ["ocr", "intake"],
    summary: "How to interpret confidence scores, retrain prompts, and escalate low-quality scans.",
  },
  {
    id: "learning-pricing",
    title: "Rwanda motor pricing fundamentals",
    durationMinutes: 25,
    difficulty: "Intermediate",
    tags: ["pricing", "agents"],
    summary: "Compare BK, Radiant, Prime Life pricing curves and mandatory excess rules.",
  },
  {
    id: "learning-issuance",
    title: "Issuance SLAs",
    durationMinutes: 15,
    difficulty: "Beginner",
    tags: ["issuance", "finance"],
    summary: "How to coordinate cover notes, receipts, and Supabase policy records.",
  },
];

export const mockAnalyticsDashboards = [
  {
    id: "analytics-conversion",
    title: "Conversion funnel",
    timeframe: "This week",
    primary: "68% quote → issuance",
    breakdown: [
      { label: "Intake", value: "210" },
      { label: "Quoted", value: "164" },
      { label: "Paid", value: "132" },
      { label: "Issued", value: "114" },
    ],
  },
  {
    id: "analytics-sla",
    title: "SLA compliance",
    timeframe: "24h",
    primary: "92% within target",
    breakdown: [
      { label: "Intake triage", value: "15m avg" },
      { label: "Quote turnaround", value: "2h 10m" },
      { label: "Issuance", value: "6h 45m" },
    ],
  },
  {
    id: "analytics-revenue",
    title: "Premium collected",
    timeframe: "Month to date",
    primary: formatCurrency(978_000),
    breakdown: [
      { label: "BK Insurance", value: formatCurrency(420_000) },
      { label: "Radiant", value: formatCurrency(350_000) },
      { label: "Prime Life", value: formatCurrency(208_000) },
    ],
  },
];

export const mockAdminPanels = [
  {
    id: "admin-rls",
    title: "RLS policies",
    owner: "Platform team",
    description: "Review roles and access for `insurance_*` tables.",
    lastUpdated: formatISO(subDays(now, 0.6)),
    status: "healthy",
  },
  {
    id: "admin-webhooks",
    title: "Webhook routing",
    owner: "Integrations",
    description: "Monitor retries to insurer partners and WhatsApp notifications.",
    lastUpdated: formatISO(subDays(now, 1.2)),
    status: "warning",
  },
  {
    id: "admin-risk",
    title: "Risk & compliance",
    owner: "Operations",
    description: "Data retention, audit logs, and escalation guardrails.",
    lastUpdated: formatISO(subDays(now, 3)),
    status: "attention",
  },
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
    label: "Driver escalations (24h)",
    primaryValue: "3",
    secondaryValue: "1 awaiting vendor callback",
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

export const mockWebhookErrors: WebhookError[] = Array.from(
  { length: 6 },
  (_, idx) =>
    createWebhookError({
      id: `webhook-${idx + 1}`,
      endpoint: idx % 2 === 0 ? "wa-webhook/mobility" : "wa-webhook/ocr",
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
    type: idx % 3 === 0 ? "driver_ping_sent" : "trip_update_customer",
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
      action: ["dispatch_override", "settings_update", "driver_ping"][idx % 3],
      targetTable: ["dispatch_overrides", "settings", "notifications"][idx % 3],
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
    bucket: "ops-briefings",
    path: "briefings/october/hero.jpg",
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
            "Drop a compliance note into the support queue so the agent can confirm the opt-out and record the reason.",
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
      { id: "ADMIN::OPS_MARKETPLACE", title: "Marketplace" },
      { id: "ADMIN::OPS_WALLET", title: "Wallet & tokens" },
      { id: "ADMIN::OPS_MOMO", title: "MoMo QR" },
    ],
    growth: [],
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
