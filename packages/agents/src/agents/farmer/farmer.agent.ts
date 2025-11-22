import {
  type CommodityRule,
  type FarmerMarketConfig,
  getMarketConfig,
  matchCommodity,
  matchVariety,
  normalize,
  type VarietyRule,
} from '../../../../../config/farmer-agent/markets/index';
import type { AgentContext, AgentInput, AgentResult, Tool } from '../../types/agent.types';
import { BaseAgent } from '../base/agent.base';

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
    `You help farmers and merchant buyers create listings or reserve produce. Always convert free text into structured listings. Assume low smartphone literacy: use simple language and few steps. Protect farmer margin; prefer multiple buyers over dependence on one middleman.

Guardrails & Policies:
- No financial advice beyond simple price math.
- No health/medical claims about produce.
- No arrangement of illegal transport.
- Respect buyer/farmer privacy.
- Never share one farmer’s contact with others without consent.`;

  tools: Tool[];

  constructor() {
    super();
    this.tools = this.defineTools();
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'create_or_update_produce_listing',
        description:
          'Save structured listing: farmer_id, crop, quantity, unit, min_price, location, harvest date, quality, photos.',
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
        name: 'search_buyers',
        description: 'Match farmers to buyers (shops, restaurants, households) based on crop, location, volumes.',
        parameters: {
          type: 'object',
          properties: {
            commodity: { type: 'string' },
            location: { type: 'string' },
            volume: { type: 'number' }
          },
          required: ['commodity', 'location']
        },
        execute: async (params, context) => {
           // Mock implementation
           return { buyers: [{ id: 'b1', name: 'Local Shop', distance: '2km' }] };
        }
      },
      {
        name: 'price_estimator',
        description: 'Suggest price ranges based on past deals and market data; returns min/avg/max; clearly “estimate only”.',
        parameters: {
          type: 'object',
          properties: {
            commodity: { type: 'string' },
            market: { type: 'string' }
          },
          required: ['commodity']
        },
        execute: async (params, context) => {
           // Mock implementation
           return { min: 100, avg: 150, max: 200, currency: 'RWF' };
        }
      },
      {
        name: 'matchmaker_job',
        description: 'Create “match task” that pings buyers who opted into notifications for that crop.',
        parameters: {
          type: 'object',
          properties: {
            listing_id: { type: 'string' }
          },
          required: ['listing_id']
        },
        execute: async (params, context) => {
           return { status: 'queued', potential_matches: 5 };
        }
      },
      {
        name: 'log_deal',
        description: 'Confirmed deal: buyer, farmer, quantity, price, date; used for analytics and future price hints.',
        parameters: {
          type: 'object',
          properties: {
            buyer_id: { type: 'string' },
            farmer_id: { type: 'string' },
            commodity: { type: 'string' },
            quantity: { type: 'number' },
            price: { type: 'number' }
          },
          required: ['buyer_id', 'farmer_id', 'commodity', 'quantity', 'price']
        },
        execute: async (params, context) => {
           return { deal_id: 'deal_123', status: 'logged' };
        }
      }
    ];
  }

  async execute(input: AgentInput): Promise<AgentResult> {
    const context: AgentContext = input.context ?? { userId: input.userId };
    const action = (context.metadata?.action as string) ?? 'create_or_update_produce_listing';
    const params = (context.metadata?.params ?? {}) as ListingToolParams & OrderToolParams;
    const started = Date.now();

    // Logic to dispatch to tools based on action or LLM decision
    // For now, keeping the existing direct call logic if action is set, otherwise defaulting
    
    if (action === 'create_or_update_produce_listing') {
        const data = await this.createListing(params, context);
        return {
            success: true,
            finalOutput: this.renderSummary('listing', data),
            data,
            toolsInvoked: ['create_or_update_produce_listing'],
            duration: Date.now() - started,
        };
    }

    return {
        success: true,
        finalOutput: "I am the Farmer Agent. How can I help you?",
        data: {},
        toolsInvoked: [],
        duration: Date.now() - started
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

  protected formatSingleOption(option: any): string {
    return '';
  }

  protected calculateScore(option: any, criteria: any): number {
    return 0;
  }
}
