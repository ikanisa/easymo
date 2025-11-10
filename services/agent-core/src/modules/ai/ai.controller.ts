import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AiService } from "./ai.service.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { ServiceScopes } from "../../common/decorators/service-scopes.decorator.js";
import {
  getAgentCoreControllerBasePath,
  getAgentCoreRouteSegment,
  getAgentCoreRouteServiceScopes,
} from "@easymo/commons";
import { SoraOrchestratorService } from "./sora-orchestrator.service.js";

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

const SoraGenerationSchema = z.object({
  campaignId: z.string().uuid(),
  figureId: z.string().uuid(),
  prompt: z.string().min(1),
  country: z.string().min(2).max(2).optional(),
  region: z.string().min(2).optional(),
  locale: z.string().min(2).optional(),
  estimatedCostUsd: z.number().nonnegative(),
  expectedOutputMb: z.number().nonnegative().optional(),
  userId: z.string().uuid().optional(),
  metadata: z.record(z.any()).optional(),
});

@Controller(getAgentCoreControllerBasePath("ai"))
@UseGuards(ServiceTokenGuard)
export class AiController {
  constructor(private readonly ai: AiService, private readonly sora: SoraOrchestratorService) {}

  @Post(getAgentCoreRouteSegment("aiBrokerOrchestrate"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiBrokerOrchestrate"))
  async orchestrate(@Body() body: unknown) {
    const payload = OrchestrateSchema.parse(body) as Parameters<AiService["runBrokerOrchestrator"]>[0];
    return await this.ai.runBrokerOrchestrator(payload);
  }

  @Post(getAgentCoreRouteSegment("aiSettlementRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiSettlementRun"))
  async settlement(@Body() body: unknown) {
    const payload = SettlementSchema.parse(body) as Parameters<AiService["runSettlement"]>[0];
    return await this.ai.runSettlement(payload);
  }

  @Post(getAgentCoreRouteSegment("aiAttributionRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiAttributionRun"))
  async attribution(@Body() body: unknown) {
    const payload = AttributionSchema.parse(body) as Parameters<AiService["runAttribution"]>[0];
    return await this.ai.runAttribution(payload);
  }

  @Post(getAgentCoreRouteSegment("aiReconciliationRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiReconciliationRun"))
  async reconciliation(@Body() body: unknown) {
    const payload = ReconciliationSchema.parse(body) as Parameters<AiService["runReconciliation"]>[0];
    return await this.ai.runReconciliation(payload);
  }

  @Post(getAgentCoreRouteSegment("aiSupportRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiSupportRun"))
  async support(@Body() body: unknown) {
    const payload = SupportSchema.parse(body) as Parameters<AiService["runSupport"]>[0];
    return await this.ai.runSupport(payload);
  }

  @Post(getAgentCoreRouteSegment("aiSoraGenerate"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiSoraGenerate"))
  async soraGenerate(@Body() body: unknown) {
    const payload = SoraGenerationSchema.parse(body) as Parameters<SoraOrchestratorService["queueGeneration"]>[0];
    return await this.sora.queueGeneration(payload);
  }
}
