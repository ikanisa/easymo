import { BaseAgent } from '../base/agent.base';
import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import {
  getMarketConfig,
  matchCommodity,
  matchVariety,
  type FarmerMarketConfig,
  type CommodityRule,
  type VarietyRule,
  normalize,
} from '../../../../../config/farmer-agent/markets/index.ts';

interface ListingToolParams {
  marketCode: string;
  commodity: string;
  variety?: string;
  grade?: string;
  unit?: string;
  quantity: number;
  city: string;
  pricePerUnit?: number;
  paymentPreference?: 'wallet' | 'cod';
  notes?: string;
}

interface OrderToolParams {
  marketCode: string;
  commodity: string;
  variety?: string;
  grade?: string;
  unit?: string;
  quantity: number;
  deliveryCity: string;
  buyerType?: 'merchant' | 'institution';
  paymentPreference?: 'wallet' | 'cod';
}

interface NormalizedProduceInput {
  config: FarmerMarketConfig;
  commodity: CommodityRule;
  variety: VarietyRule;
  grade: string;
  unit: string;
  quantity: number;
}

export class FarmerAgent extends BaseAgent {
  name = 'farmer_agent';
  instructions =
    'You help farmers and merchant buyers create listings or reserve produce. Always validate market rules before confirming actions.';
  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'create_listing',
        description:
          'Create a farmer listing for a commodity. Requires market code, city, commodity, quantity, and grade/unit that match local policy.',
        parameters: {
          type: 'object',
          properties: {
            marketCode: { type: 'string' },
            commodity: { type: 'string' },
            variety: { type: 'string' },
            grade: { type: 'string' },
            unit: { type: 'string' },
            quantity: { type: 'number', minimum: 1 },
            city: { type: 'string' },
            pricePerUnit: { type: 'number' },
            paymentPreference: { type: 'string', enum: ['wallet', 'cod'] },
            notes: { type: 'string' },
          },
          required: ['marketCode', 'commodity', 'quantity', 'city'],
        },
        execute: this.createListing.bind(this),
      },
      {
        name: 'create_order',
        description:
          'Create a buyer order for a commodity. Validates destination city, buyer type and COD fallback policy per market.',
        parameters: {
          type: 'object',
          properties: {
            marketCode: { type: 'string' },
            commodity: { type: 'string' },
            variety: { type: 'string' },
            grade: { type: 'string' },
            unit: { type: 'string' },
            quantity: { type: 'number', minimum: 1 },
            deliveryCity: { type: 'string' },
            buyerType: { type: 'string', enum: ['merchant', 'institution'] },
            paymentPreference: { type: 'string', enum: ['wallet', 'cod'] },
          },
          required: ['marketCode', 'commodity', 'quantity', 'deliveryCity'],
        },
        execute: this.createOrder.bind(this),
      },
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context: AgentContext = input.context ?? { userId: input.userId };
    const action = (context.metadata?.action as string) ?? 'create_listing';
    const params = (context.metadata?.params ?? {}) as ListingToolParams & OrderToolParams;
    const started = Date.now();

    if (action === 'create_order') {
      const data = await this.createOrder(params, context);
      return {
        success: true,
        finalOutput: this.renderSummary('order', data),
        data,
        toolsInvoked: ['create_order'],
        duration: Date.now() - started,
      };
    }

    const data = await this.createListing(params, context);
    return {
      success: true,
      finalOutput: this.renderSummary('listing', data),
      data,
      toolsInvoked: ['create_listing'],
      duration: Date.now() - started,
    };
  }

  private renderSummary(action: 'listing' | 'order', data: any): string {
    const codCopy = data.codFallback?.instructions ? `\nCOD fallback: ${data.codFallback.instructions}` : '';
    if (action === 'order') {
      return (
        `✅ Order scheduled for ${data.quantity} ${data.unit} of ${data.varietyLabel} (${data.grade}) in ${data.marketCode}.` +
        ` Deliver to ${data.deliveryCity}.` +
        codCopy
      );
    }

    return (
      `✅ Listing prepared for ${data.quantity} ${data.unit} of ${data.varietyLabel} (${data.grade}) in ${data.city}.` +
      ` Price hint: ${data.pricePerUnit ?? 'TBD'} ${data.currency}.` +
      codCopy
    );
  }

  private async createListing(params: ListingToolParams, context: AgentContext) {
    const normalized = this.normalizeProduceInput(params.marketCode, params.commodity, params.variety, params.grade, params.unit, params.quantity);
    this.assertCity(normalized.config, params.city, 'listing');

    const codFallback = this.resolveCodFallback(normalized.config, params.paymentPreference);

    return {
      type: 'listing',
      marketCode: normalized.config.marketCode,
      commodity: normalized.commodity.commodity,
      variety: normalized.variety.code,
      varietyLabel: normalized.variety.name,
      grade: normalized.grade,
      unit: normalized.unit,
      quantity: normalized.quantity,
      city: params.city,
      currency: normalized.config.currency,
      notes: params.notes ?? null,
      pricePerUnit: params.pricePerUnit ?? null,
      codFallback,
      createdBy: context.userId,
      allowedUnits: normalized.variety.allowedUnits,
      allowedGrades: normalized.variety.grades,
    };
  }

  private async createOrder(params: OrderToolParams, context: AgentContext) {
    const normalized = this.normalizeProduceInput(
      params.marketCode,
      params.commodity,
      params.variety,
      params.grade,
      params.unit,
      params.quantity,
    );

    this.assertCity(normalized.config, params.deliveryCity, 'order');

    const codFallback = this.resolveCodFallback(normalized.config, params.paymentPreference ?? (params.buyerType === 'merchant' ? 'cod' : 'wallet'));

    return {
      type: 'order',
      marketCode: normalized.config.marketCode,
      commodity: normalized.commodity.commodity,
      variety: normalized.variety.code,
      varietyLabel: normalized.variety.name,
      grade: normalized.grade,
      unit: normalized.unit,
      quantity: normalized.quantity,
      deliveryCity: params.deliveryCity,
      buyerType: params.buyerType ?? 'merchant',
      currency: normalized.config.currency,
      codFallback,
      createdBy: context.userId,
      allowedUnits: normalized.variety.allowedUnits,
      allowedGrades: normalized.variety.grades,
    };
  }

  private normalizeProduceInput(
    marketCode: string,
    commodityValue: string,
    varietyValue: string | undefined,
    gradeValue: string | undefined,
    unitValue: string | undefined,
    quantityValue: number,
  ): NormalizedProduceInput {
    const config = getMarketConfig(marketCode);
    if (!config) {
      throw new Error(`Unknown market: ${marketCode}`);
    }

    const commodityRule = matchCommodity(config, commodityValue);
    if (!commodityRule) {
      throw new Error(`Commodity ${commodityValue} is not supported in ${marketCode}`);
    }

    const varietyRule = matchVariety(commodityRule, varietyValue);
    if (!varietyRule) {
      throw new Error(`Variety ${varietyValue} is not recognized for ${commodityValue}`);
    }

    const grade = this.normalizeGrade(varietyRule, gradeValue);
    const unit = this.normalizeUnit(varietyRule, unitValue);
    const quantity = Math.max(quantityValue, varietyRule.minOrder);

    return { config, commodity: commodityRule, variety: varietyRule, grade, unit, quantity };
  }

  private normalizeUnit(variety: VarietyRule, value?: string): string {
    if (!value) return variety.defaultUnit;
    if (!variety.allowedUnits.some((unit) => normalize(unit) === normalize(value))) {
      throw new Error(`Unit ${value} is not allowed. Choose one of: ${variety.allowedUnits.join(', ')}`);
    }
    return variety.allowedUnits.find((unit) => normalize(unit) === normalize(value)) ?? variety.defaultUnit;
  }

  private normalizeGrade(variety: VarietyRule, value?: string): string {
    if (!value) return variety.grades[0];
    if (!variety.grades.some((grade) => normalize(grade) === normalize(value))) {
      throw new Error(`Grade ${value} is not allowed. Choose one of: ${variety.grades.join(', ')}`);
    }
    return variety.grades.find((grade) => normalize(grade) === normalize(value)) ?? variety.grades[0];
  }

  private assertCity(config: FarmerMarketConfig, city: string, type: 'listing' | 'order'): void {
    if (!city) {
      throw new Error(`A ${type} city must be provided.`);
    }

    if (!config.allowedCities.some((allowed) => normalize(allowed) === normalize(city))) {
      throw new Error(`City ${city} is not targeted for ${config.marketCode}. Allowed cities: ${config.allowedCities.join(', ')}`);
    }
  }

  private resolveCodFallback(config: FarmerMarketConfig, preference?: 'wallet' | 'cod') {
    if (!config.codFallback?.enabled) return null;
    if (preference === 'wallet') return null;

    return {
      requiresConfirmation: config.codFallback.requiresConfirmation ?? false,
      instructions: config.codFallback.instructions,
    };
  }

  protected formatSingleOption(): string {
    return '';
  }

  protected calculateScore(): number {
    return 0;
  }
}
