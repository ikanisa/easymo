import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AiService } from "./ai.service.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { ServiceScopes } from "../../common/decorators/service-scopes.decorator.js";

const OrchestrateSchema = z.object({
  tenantId: z.string().uuid(),
  buyerId: z.string().uuid(),
  msisdn: z.string(),
  categories: z.array(z.string()).optional(),
  region: z.string().optional(),
  intentPayload: z.record(z.any()).default({}),
  expiresAt: z.string().datetime().optional(),
});

const SettlementSchema = z.object({
  purchaseId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3),
});

const AttributionSchema = z.object({
  quoteId: z.string().uuid(),
  events: z.array(z.any()).optional(),
  persist: z.boolean().default(true),
  evidence: z.array(z.object({ kind: z.string(), ref: z.string().optional(), data: z.any().optional() })).optional(),
  dispute: z.object({ reason: z.string(), actor: z.string() }).optional(),
});

const ReconciliationSchema = z.object({
  fileBase64: z.string().min(10), // CSV as base64
});

const SupportSchema = z.object({
  msisdn: z.string().min(5),
  message: z.string().min(1),
  messageId: z.string().min(1).optional(),
  timestamp: z.number().optional(),
});

@Controller("ai")
@UseGuards(ServiceTokenGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post("broker/orchestrate")
  @ServiceScopes("ai:broker.orchestrate")
  async orchestrate(@Body() body: unknown) {
    const payload = OrchestrateSchema.parse(body) as Parameters<AiService["runBrokerOrchestrator"]>[0];
    return await this.ai.runBrokerOrchestrator(payload);
  }

  @Post("settlement/run")
  @ServiceScopes("ai:settlement")
  async settlement(@Body() body: unknown) {
    const payload = SettlementSchema.parse(body) as Parameters<AiService["runSettlement"]>[0];
    return await this.ai.runSettlement(payload);
  }

  @Post("attribution/run")
  @ServiceScopes("ai:attribution")
  async attribution(@Body() body: unknown) {
    const payload = AttributionSchema.parse(body) as Parameters<AiService["runAttribution"]>[0];
    return await this.ai.runAttribution(payload);
  }

  @Post("reconciliation/run")
  @ServiceScopes("ai:reconciliation")
  async reconciliation(@Body() body: unknown) {
    const payload = ReconciliationSchema.parse(body) as Parameters<AiService["runReconciliation"]>[0];
    return await this.ai.runReconciliation(payload);
  }

  @Post("support/run")
  @ServiceScopes("ai:support")
  async support(@Body() body: unknown) {
    const payload = SupportSchema.parse(body) as Parameters<AiService["runSupport"]>[0];
    return await this.ai.runSupport(payload);
  }
}
