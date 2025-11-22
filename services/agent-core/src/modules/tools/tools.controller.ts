import {
  type AgentContext,
  getAgentCoreControllerBasePath,
  getAgentCoreRoutePermissions,
  getAgentCoreRouteSegment,
} from "@easymo/commons";
import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CallDirection, CallPlatform } from "@prisma/client";
import { z } from "zod";

import { AgentCtx } from "../../common/decorators/agent.decorator.js";
import { RequireFeatureFlag } from "../../common/decorators/feature-flag.decorator.js";
import { RequirePermissions } from "../../common/decorators/permissions.decorator.js";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard.js";
import { ServiceAuthGuard } from "../../common/guards/service-auth.guard.js";
import { ToolsService } from "./tools.service.js";

const fetchLeadSchema = z.object({
  tenantId: z.string().uuid(),
  phone: z.string(),
});

const logLeadSchema = z.object({
  tenantId: z.string().uuid(),
  phone: z.string(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  optIn: z.boolean().optional(),
});

const createCallSchema = z.object({
  tenantId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  direction: z.nativeEnum(CallDirection),
  platform: z.nativeEnum(CallPlatform),
  region: z.string().optional(),
});

const setDispositionSchema = z.object({
  callId: z.string().uuid(),
  code: z.string(),
  notes: z.string().optional(),
});

const registerOptOutSchema = z.object({
  phone: z.string(),
  reason: z.string().optional(),
});

const collectPaymentSchema = z.object({
  region: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
});

const warmTransferSchema = z.object({
  queue: z.string(),
});

const listLeadsQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

const attributionSchema = z
  .object({
    traceId: z.string().min(1).optional(),
    orgId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
    convoId: z.string().min(1).optional(),
  })
  .optional();

const searchSupabaseSchema = z.object({
  tenantId: z.string().uuid(),
  table: z.string().min(1),
  filters: z.record(z.any()).default({}),
  limit: z.number().int().min(1).max(200).optional(),
  order: z
    .object({
      column: z.string().min(1),
      ascending: z.boolean().optional(),
    })
    .optional(),
  attribution: attributionSchema,
});

const createListingSchema = z.object({
  tenantId: z.string().uuid(),
  farmId: z.string().uuid(),
  produceId: z.string().uuid(),
  quantity: z.number().positive(),
  unitType: z.string().min(1),
  pricePerUnit: z.number().nonnegative(),
  currency: z.string().default("RWF"),
  harvestDate: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  attribution: attributionSchema,
});

const createOrderSchema = z.object({
  tenantId: z.string().uuid(),
  buyerProfileId: z.string().uuid(),
  listingId: z.string().uuid().optional(),
  produceId: z.string().uuid().optional(),
  quantity: z.number().positive(),
  unitType: z.string().min(1),
  currency: z.string().default("RWF"),
  ceilingTotal: z.number().nonnegative().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  attribution: attributionSchema,
});

const createMatchSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  listingId: z.string().uuid(),
  score: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
  attribution: attributionSchema,
});

const recordPaymentSchema = z.object({
  tenantId: z.string().uuid(),
  orderId: z.string().uuid(),
  payerProfileId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("RWF"),
  provider: z.string().optional(),
  providerRef: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  attribution: attributionSchema,
});

@Controller(getAgentCoreControllerBasePath("tools"))
@UseGuards(ServiceAuthGuard, FeatureFlagGuard)
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  private assertTenant(agent: AgentContext, tenantId: string) {
    if (tenantId !== agent.tenantId) {
      throw new ForbiddenException("Tenant mismatch");
    }
  }

  @Get(getAgentCoreRouteSegment("toolsListLeads"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsListLeads"))
  async listLeads(
    @AgentCtx() agent: AgentContext,
    @Query() rawQuery: Record<string, string>,
  ) {
    const query = listLeadsQuerySchema.parse({
      tenantId: rawQuery.tenantId,
      search: rawQuery.search,
      limit: rawQuery.limit,
    });
    const tenantId = query.tenantId ?? agent.tenantId;
    this.assertTenant(agent, tenantId);
    return await this.service.listLeads(agent, {
      limit: query.limit,
      search: query.search,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsFetchLead"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsFetchLead"))
  async fetchLead(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = fetchLeadSchema.parse(body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.fetchLead(agent, { phone: payload.phone });
  }

  @Post(getAgentCoreRouteSegment("toolsLogLead"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsLogLead"))
  async logLead(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = logLeadSchema.parse(body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.logLead(agent, {
      phone: payload.phone,
      name: payload.name,
      tags: payload.tags,
      optIn: payload.optIn,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsCreateCall"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsCreateCall"))
  async createCall(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = createCallSchema.parse(body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.createCall(agent, {
      leadId: payload.leadId,
      direction: payload.direction,
      platform: payload.platform,
      region: payload.region,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsSetDisposition"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsSetDisposition"))
  async setDisposition(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = setDispositionSchema.parse(body);
    return await this.service.setDisposition(agent, {
      callId: payload.callId,
      code: payload.code,
      notes: payload.notes,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsRegisterOptOut"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsRegisterOptOut"))
  async registerOptOut(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = registerOptOutSchema.parse(body);
    return await this.service.registerOptOut(agent, {
      phone: payload.phone,
      reason: payload.reason,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsCollectPayment"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsCollectPayment"))
  @RequireFeatureFlag("agent.collectPayment")
  async collectPayment(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = collectPaymentSchema.parse(body);
    return this.service.collectPayment(agent, {
      region: payload.region,
      amount: payload.amount,
      currency: payload.currency,
    });
  }

  @Post(getAgentCoreRouteSegment("toolsWarmTransfer"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsWarmTransfer"))
  @RequireFeatureFlag("agent.warmTransfer")
  async warmTransfer(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = warmTransferSchema.parse(body);
    return this.service.warmTransfer(agent, { queue: payload.queue });
  }

  @Post(getAgentCoreRouteSegment("toolsSearchSupabase"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsSearchSupabase"))
  @RequireFeatureFlag("agent.marketplace")
  async searchSupabase(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = parseMarketplacePayload(searchSupabaseSchema, body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.searchSupabase(agent, payload);
  }

  @Post(getAgentCoreRouteSegment("toolsCreateListing"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsCreateListing"))
  @RequireFeatureFlag("agent.marketplace")
  async createListing(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = parseMarketplacePayload(createListingSchema, body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.createListing(agent, payload);
  }

  @Post(getAgentCoreRouteSegment("toolsCreateOrder"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsCreateOrder"))
  @RequireFeatureFlag("agent.marketplace")
  async createOrder(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = parseMarketplacePayload(createOrderSchema, body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.createOrder(agent, payload);
  }

  @Post(getAgentCoreRouteSegment("toolsCreateMatch"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsCreateMatch"))
  @RequireFeatureFlag("agent.marketplace")
  async createMatch(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = parseMarketplacePayload(createMatchSchema, body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.createMatch(agent, payload);
  }

  @Post(getAgentCoreRouteSegment("toolsRecordPayment"))
  @RequirePermissions(...getAgentCoreRoutePermissions("toolsRecordPayment"))
  @RequireFeatureFlag("agent.marketplace")
  async recordPayment(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = parseMarketplacePayload(recordPaymentSchema, body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.recordPayment(agent, payload);
  }
}

const SNAKE_KEY_SEGMENT = /[_-]+([a-zA-Z0-9])/g;

function parseMarketplacePayload<T>(schema: z.ZodType<T>, body: unknown): T {
  if (!isRecord(body)) {
    return schema.parse(body);
  }
  return schema.parse(camelCaseTopLevelKeys(body));
}

function camelCaseTopLevelKeys(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.entries(payload).reduce<Record<string, unknown>>((acc, [key, value]) => {
    const camelKey = key.includes("_") || key.includes("-") ? snakeToCamel(key) : key;
    acc[camelKey] = value;
    return acc;
  }, {});
}

function snakeToCamel(value: string): string {
  return value.toLowerCase().replace(SNAKE_KEY_SEGMENT, (_match, segment: string) => segment.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
