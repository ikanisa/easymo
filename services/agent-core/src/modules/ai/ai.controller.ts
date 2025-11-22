import {
  getAgentCoreControllerBasePath,
  getAgentCoreRouteSegment,
  getAgentCoreRouteServiceScopes,
} from "@easymo/commons";
import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";

import { ServiceScopes } from "../../common/decorators/service-scopes.decorator.js";
import { ServiceTokenGuard } from "../../common/guards/service-token.guard.js";
import { AiService } from "./ai.service.js";
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

const FarmerBrokerSchema = z.object({
  msisdn: z.string().min(8),
  message: z.string().min(1),
  intent: z.enum(["farmer_supply", "buyer_demand"]),
  locale: z.string().min(2).max(5).optional(),
  conversationId: z.string().uuid().optional(),
  profile: z.object({
    id: z.string().uuid().optional(),
    locale: z.string().min(2).max(5).nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  }).optional(),
  farm: z.object({
    id: z.string().uuid().optional(),
    farm_name: z.string().optional(),
    district: z.string().optional().nullable(),
    sector: z.string().optional().nullable(),
    region: z.string().optional().nullable(),
    hectares: z.number().nonnegative().optional().nullable(),
    commodities: z.array(z.string()).optional().nullable(),
    certifications: z.array(z.string()).optional().nullable(),
    irrigation: z.boolean().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
    farm_synonyms: z.array(z.object({
      phrase: z.string(),
      locale: z.string().nullable().optional(),
      category: z.string().nullable().optional(),
    })).optional(),
  }).optional(),
  buyerContext: z.object({
    market: z.string().optional(),
    requestedMessage: z.string().optional(),
  }).optional(),
});

const WaiterBrokerSchema = z.object({
  msisdn: z.string().min(8),
  message: z.string().min(1),
  intent: z.enum(["order_food", "get_recommendations", "ask_question", "manage_order"]),
  locale: z.string().min(2).max(5).optional(),
  conversationId: z.string().uuid().optional(),
  profile: z.object({
    id: z.string().uuid().optional(),
    locale: z.string().min(2).max(5).nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  }).optional(),
  bar: z.object({
    id: z.string().uuid().optional(),
    name: z.string().nullable().optional(),
    slug: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    city_area: z.string().nullable().optional(),
    cuisine_types: z.array(z.string()).nullable().optional(),
    price_range: z.string().nullable().optional(),
    metadata: z.record(z.any()).nullable().optional(),
  }).optional(),
  menu: z.object({
    categories: z.array(z.object({
      id: z.string(),
      name: z.string(),
      items: z.array(z.object({
        id: z.string(),
        name: z.string(),
        price: z.number().nullable().optional(),
        currency: z.string().nullable().optional(),
        description: z.string().nullable().optional(),
        is_available: z.boolean().nullable().optional(),
      })),
    })).optional(),
    specials: z.array(z.string()).nullable().optional(),
    popular_items: z.array(z.string()).nullable().optional(),
  }).optional(),
  orderContext: z.object({
    tableNumber: z.string().optional(),
    currentOrder: z.array(z.object({
      item: z.string(),
      quantity: z.number(),
    })).optional(),
    totalAmount: z.number().optional(),
  }).nullable().optional(),
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

  @Post(getAgentCoreRouteSegment("aiFarmerBrokerRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiFarmerBrokerRun"))
  async farmerBroker(@Body() body: unknown) {
    const payload = FarmerBrokerSchema.parse(body) as Parameters<AiService["runFarmerBroker"]>[0];
    return await this.ai.runFarmerBroker(payload);
  }

  @Post(getAgentCoreRouteSegment("aiWaiterBrokerRun"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiWaiterBrokerRun"))
  async waiterBroker(@Body() body: unknown) {
    const payload = WaiterBrokerSchema.parse(body) as Parameters<AiService["runWaiterBroker"]>[0];
    return await this.ai.runWaiterBroker(payload);
  }

  @Post(getAgentCoreRouteSegment("aiSoraGenerate"))
  @ServiceScopes(...getAgentCoreRouteServiceScopes("aiSoraGenerate"))
  async soraGenerate(@Body() body: unknown) {
    const payload = SoraGenerationSchema.parse(body) as Parameters<SoraOrchestratorService["queueGeneration"]>[0];
    return await this.sora.queueGeneration(payload);
  }
}
