import { childLogger } from '@easymo/commons';
import { CallDirection, CallPlatform, Prisma, PrismaClient } from "@prisma/client";

const log = childLogger({ service: 'db' });

const prisma = new PrismaClient();

const TENANT_ID = "a4a8cf2d-0a4f-446c-8bf2-28509641158f";
const CONFIG_ID = "26db67d6-e0dd-49aa-bf19-31d3de42b5ca";
const LEAD_ONE_ID = "3da34d03-9106-4a5d-97b3-16008d15ac31";
const LEAD_TWO_ID = "bfe8bb20-6574-4805-a129-aabb6f2f9164";
const CALL_ID = "59f4e60f-cee7-4a52-9ab8-550466e21003";
const DISPOSITION_ID = "04d2fa3f-c2f2-428b-af84-4a78c240891c";
const PLATFORM_ACCOUNT_ID = "5c8c42d7-9b5a-4f2a-a730-1b15219a0b3b";
const COMMISSION_ACCOUNT_ID = "c6e2c9b9-0b32-46e8-90d6-1b3edc1820f8";
const VENDOR_ACCOUNT_ID = "3a7f03dd-a7ce-4a9d-a099-287153b7c6eb";
const BUYER_ACCOUNT_ID = "b2f0a6cb-e738-4bd3-b0bd-2c5c0ce40fa3";
const VENDOR_ID = "8642ad75-0a58-4a61-88bf-3a4700aefd52";
const BUYER_ID = "7cb54d0f-3b3e-4928-82c0-4fa2cfcecac9";
const INTENT_ID = "8e63df7a-5e42-454a-8261-13b6e7266320";
const QUOTE_ID = "91fca9a3-14dc-4ba8-982c-6a90f6f2b12c";
const PURCHASE_ID = "3c93cf15-87ab-4f66-bba2-631dcc3b48fa";

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      name: "Seed Tenant",
      countries: ["rw"],
    },
  });

  await prisma.agentConfig.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: {
      id: CONFIG_ID,
      tenantId: tenant.id,
      product: "mobility",
      languages: ["en", "rw"],
      voice: "Cedar",
      objective: "Autonomous support for EasyMO mobility flows.",
      systemPrompt: "You are a helpful assistant for EasyMO mobility agents.",
      tools: [
        { name: "fetchLead", permissions: ["lead.read"] },
        { name: "logLead", permissions: ["lead.write"] },
        { name: "createCall", permissions: ["call.write"] },
        { name: "setDisposition", permissions: ["disposition.write"] },
        { name: "registerOptOut", permissions: ["lead.optOut"] },
        { name: "collectPayment", permissions: ["payment.collect"] },
        { name: "warmTransfer", permissions: ["call.transfer"] },
      ],
      policy: [{ rule: "Disclose recording" }],
    },
  });

  await prisma.lead.createMany({
    data: [
      {
        id: LEAD_ONE_ID,
        tenantId: tenant.id,
        phoneE164: "+250780010001",
        name: "Fixture Rider One",
        optIn: true,
        tags: ["pilot"],
      },
      {
        id: LEAD_TWO_ID,
        tenantId: tenant.id,
        phoneE164: "+250780020002",
        name: "Fixture Driver One",
        optIn: true,
        tags: ["driver"],
      },
    ],
    skipDuplicates: true,
  });

  const call = await prisma.call.upsert({
    where: { id: CALL_ID },
    update: {},
    create: {
      id: CALL_ID,
      tenantId: tenant.id,
      leadId: LEAD_ONE_ID,
      direction: CallDirection.outbound,
      platform: CallPlatform.pstn,
      status: "completed",
      recordingUrl: "https://example.com/seed-call-001.mp3",
      region: "rw",
    },
  });

  await prisma.disposition.upsert({
    where: { id: DISPOSITION_ID },
    update: {},
    create: {
      id: DISPOSITION_ID,
      callId: call.id,
      code: "CONNECTED",
      notes: "Initial pilot outreach completed.",
    },
  });

  await prisma.optOut.upsert({
    where: { phoneE164: "+250780099999" },
    update: {},
    create: {
      phoneE164: "+250780099999",
      reason: "Requested do-not-call during onboarding",
    },
  });

  await prisma.walletAccount.upsert({
    where: { id: PLATFORM_ACCOUNT_ID },
    update: {},
    create: {
      id: PLATFORM_ACCOUNT_ID,
      tenantId: tenant.id,
      ownerType: "platform",
      ownerId: "platform",
      currency: "USD",
      balance: new Prisma.Decimal(0),
    },
  });

  await prisma.walletAccount.upsert({
    where: { id: COMMISSION_ACCOUNT_ID },
    update: {},
    create: {
      id: COMMISSION_ACCOUNT_ID,
      tenantId: tenant.id,
      ownerType: "commission",
      ownerId: "rev-share",
      currency: "USD",
      balance: new Prisma.Decimal(0),
    },
  });

  await prisma.walletAccount.upsert({
    where: { id: VENDOR_ACCOUNT_ID },
    update: {},
    create: {
      id: VENDOR_ACCOUNT_ID,
      tenantId: tenant.id,
      ownerType: "vendor",
      ownerId: VENDOR_ID,
      currency: "USD",
      balance: new Prisma.Decimal(0),
    },
  });

  await prisma.walletAccount.upsert({
    where: { id: BUYER_ACCOUNT_ID },
    update: {},
    create: {
      id: BUYER_ACCOUNT_ID,
      tenantId: tenant.id,
      ownerType: "buyer",
      ownerId: BUYER_ID,
      currency: "USD",
      balance: new Prisma.Decimal(0),
    },
  });

  await prisma.commissionSchedule.upsert({
    where: { id: "commission-default" },
    update: {},
    create: {
      id: "commission-default",
      tenantId: tenant.id,
      product: "mobility",
      rate: new Prisma.Decimal(0.05),
      flatFee: new Prisma.Decimal(0),
      active: true,
    },
  });

  await prisma.vendorProfile.upsert({
    where: { id: VENDOR_ID },
    update: {},
    create: {
      id: VENDOR_ID,
      tenantId: tenant.id,
      name: "Kigali Premier Rides",
      region: "rw-kigali",
      categories: ["mobility", "premium"],
      rating: new Prisma.Decimal(4.8),
      fulfilmentRate: new Prisma.Decimal(0.92),
      avgResponseMs: 1800,
      totalTrips: 245,
      walletAccountId: VENDOR_ACCOUNT_ID,
    },
  });

  await prisma.buyerProfile.upsert({
    where: { id: BUYER_ID },
    update: {},
    create: {
      id: BUYER_ID,
      tenantId: tenant.id,
      name: "Diane Umutesi",
      segment: "enterprise",
      walletAccountId: BUYER_ACCOUNT_ID,
    },
  });

  await prisma.intent.upsert({
    where: { id: INTENT_ID },
    update: {},
    create: {
      id: INTENT_ID,
      tenantId: tenant.id,
      buyerId: BUYER_ID,
      channel: "whatsapp",
      payload: {
        pickup: "Kigali Heights",
        dropoff: "Kanombe Airport",
        passengers: 1,
      },
      status: "pending",
    },
  });

  await prisma.quote.upsert({
    where: { id: QUOTE_ID },
    update: {},
    create: {
      id: QUOTE_ID,
      intentId: INTENT_ID,
      vendorId: VENDOR_ID,
      price: new Prisma.Decimal(28.5),
      currency: "USD",
      etaMinutes: 12,
      status: "accepted",
      acceptedAt: new Date(),
    },
  });

  await prisma.purchase.upsert({
    where: { id: PURCHASE_ID },
    update: {},
    create: {
      id: PURCHASE_ID,
      quoteId: QUOTE_ID,
      status: "completed",
      fulfilledAt: new Date(),
    },
  });

  const transaction = await prisma.walletTransaction.upsert({
    where: { id: "wallet-seed-tx" },
    update: {},
    create: {
      id: "wallet-seed-tx",
      tenantId: tenant.id,
      type: "purchase",
      reference: QUOTE_ID,
      metadata: { seed: true },
    },
  });

  const entries = [
    {
      id: "wallet-entry-1",
      transactionId: transaction.id,
      accountId: BUYER_ACCOUNT_ID,
      amount: new Prisma.Decimal(28.5),
      direction: "debit" as const,
    },
    {
      id: "wallet-entry-2",
      transactionId: transaction.id,
      accountId: VENDOR_ACCOUNT_ID,
      amount: new Prisma.Decimal(27.075),
      direction: "credit" as const,
    },
    {
      id: "wallet-entry-3",
      transactionId: transaction.id,
      accountId: COMMISSION_ACCOUNT_ID,
      amount: new Prisma.Decimal(1.425),
      direction: "credit" as const,
    },
  ];

  await prisma.walletEntry.createMany({ data: entries, skipDuplicates: true });

  await prisma.walletAccount.update({
    where: { id: BUYER_ACCOUNT_ID },
    data: { balance: new Prisma.Decimal(-28.5) },
  });
  await prisma.walletAccount.update({
    where: { id: VENDOR_ACCOUNT_ID },
    data: { balance: new Prisma.Decimal(27.075) },
  });
  await prisma.walletAccount.update({
    where: { id: COMMISSION_ACCOUNT_ID },
    data: { balance: new Prisma.Decimal(1.425) },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    log.error("Seed failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });
