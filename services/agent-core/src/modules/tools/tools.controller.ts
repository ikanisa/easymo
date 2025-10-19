import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { ToolsService } from "./tools.service.js";
import { ServiceAuthGuard } from "../../common/guards/service-auth.guard.js";
import { AgentCtx } from "../../common/decorators/agent.decorator.js";
import { RequirePermissions } from "../../common/decorators/permissions.decorator.js";
import { RequireFeatureFlag } from "../../common/decorators/feature-flag.decorator.js";
import { FeatureFlagGuard } from "../../common/guards/feature-flag.guard.js";
import type { AgentContext } from "@easymo/commons";
import { CallDirection, CallPlatform } from "@prisma/client";

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

@Controller("tools")
@UseGuards(ServiceAuthGuard, FeatureFlagGuard)
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  private assertTenant(agent: AgentContext, tenantId: string) {
    if (tenantId !== agent.tenantId) {
      throw new ForbiddenException("Tenant mismatch");
    }
  }

  @Get("leads")
  @RequirePermissions("lead.read")
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

  @Post("fetch-lead")
  @RequirePermissions("lead.read")
  async fetchLead(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = fetchLeadSchema.parse(body);
    this.assertTenant(agent, payload.tenantId);
    return await this.service.fetchLead(agent, { phone: payload.phone });
  }

  @Post("log-lead")
  @RequirePermissions("lead.write")
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

  @Post("create-call")
  @RequirePermissions("call.write")
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

  @Post("set-disposition")
  @RequirePermissions("disposition.write")
  async setDisposition(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = setDispositionSchema.parse(body);
    return await this.service.setDisposition(agent, {
      callId: payload.callId,
      code: payload.code,
      notes: payload.notes,
    });
  }

  @Post("register-opt-out")
  @RequirePermissions("lead.optOut")
  async registerOptOut(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = registerOptOutSchema.parse(body);
    return await this.service.registerOptOut(agent, {
      phone: payload.phone,
      reason: payload.reason,
    });
  }

  @Post("collect-payment")
  @RequirePermissions("payment.collect")
  @RequireFeatureFlag("agent.collectPayment")
  async collectPayment(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = collectPaymentSchema.parse(body);
    return this.service.collectPayment(agent, {
      region: payload.region,
      amount: payload.amount,
      currency: payload.currency,
    });
  }

  @Post("warm-transfer")
  @RequirePermissions("call.transfer")
  @RequireFeatureFlag("agent.warmTransfer")
  async warmTransfer(@AgentCtx() agent: AgentContext, @Body() body: unknown) {
    const payload = warmTransferSchema.parse(body);
    return this.service.warmTransfer(agent, { queue: payload.queue });
  }
}
