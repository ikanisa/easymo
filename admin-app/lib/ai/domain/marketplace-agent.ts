/**
 * Buy & Sell Agent - EasyMO unified commerce and business discovery
 * Handles marketplace transactions, business brokerage, and legal intake
 * 
 * @deprecated MarketplaceAgent has been merged into BuyAndSellAgent.
 * This file provides backward compatibility for existing code.
 */

import { AgentExecutor } from '../agent-executor';

const BUY_AND_SELL_SYSTEM_PROMPT = `You are EasyMO's unified Buy & Sell assistant, helping users with marketplace transactions and business opportunities.

MARKETPLACE CAPABILITIES:
- Help users buy and sell products across all retail categories (pharmacy, hardware, grocery)
- Find shops and stores nearby
- Create and manage product listings
- Search for specific items
- Handle OTC pharmacy products; for RX items, request photo and escalate to pharmacist
- No medical advice, dosing, or contraindication information

BUSINESS DISCOVERY:
- Map user needs → business categories → specific nearby businesses
- Use maps_geocode for location-based search
- Return ranked list with reasons (open now, distance, rating)
- Only recommend businesses from the database; respect opening hours

BUSINESS BROKERAGE:
- For sellers: Collect business details, financials (sanitized), asking price, terms
- For buyers: Understand acquisition criteria, budget, industry preferences
- Match parties; facilitate introductions; schedule meetings

Available tools:
- database_query: Search inventory, check prices and availability
- google_maps: Find nearby stores and calculate delivery distances
- search_grounding: Get current product information, reviews, or comparisons

GUARDRAILS:
- No medical advice beyond finding a pharmacy
- No legal, tax, or financial advice—only logistics and intake
- Protect user privacy and confidentiality
- Sensitive topics require handoff to staff

Be helpful, accurate, and recommend quality products. Verify product availability before confirming orders.`;

export class BuyAndSellAgent extends AgentExecutor {
  constructor() {
    super({
      model: 'gpt-4o-mini',
      systemPrompt: BUY_AND_SELL_SYSTEM_PROMPT,
      tools: ['database_query', 'google_maps', 'search_grounding'],
      maxIterations: 5,
    });
  }

  /**
   * Search for products across all stores
   */
  async searchProducts(query: string, category?: string) {
    const searchQuery = category
      ? `Search for "${query}" in category "${category}". List available products with prices and store locations.`
      : `Search for "${query}". Show available products, prices, and which stores have them in stock.`;
    return this.execute(searchQuery);
  }

  /**
   * Find pharmacy products (medicines, health items)
   */
  async findPharmacyProducts(productName: string, location?: { lat: number; lng: number }) {
    const locationInfo = location ? ` near coordinates [${location.lat}, ${location.lng}]` : '';
    const query = `Find "${productName}" at pharmacies${locationInfo}. Include prices, availability, and pharmacy locations.`;
    return this.execute(query);
  }

  /**
   * Find hardware/quincaillerie products
   */
  async findHardwareProducts(productName: string, location?: { lat: number; lng: number }) {
    const locationInfo = location ? ` near coordinates [${location.lat}, ${location.lng}]` : '';
    const query = `Find "${productName}" at hardware stores${locationInfo}. Include prices, quantities available, and store locations.`;
    return this.execute(query);
  }

  /**
   * Search for businesses
   */
  async searchBusinesses(category: string, location?: { lat: number; lng: number }) {
    const locationInfo = location ? ` near coordinates [${location.lat}, ${location.lng}]` : '';
    const query = `Find "${category}" businesses${locationInfo}. Include distance, rating, and contact information.`;
    return this.execute(query);
  }

  /**
   * Get product recommendations
   */
  async getProductRecommendations(params: {
    category: string;
    budget?: number;
    preferences?: string[];
  }) {
    const budgetInfo = params.budget ? ` under ${params.budget} RWF` : '';
    const prefInfo = params.preferences?.length ? ` with preferences: ${params.preferences.join(', ')}` : '';
    const query = `Recommend ${params.category} products${budgetInfo}${prefInfo}. List top 5 options with reasons.`;
    return this.execute(query);
  }

  /**
   * Compare products
   */
  async compareProducts(productIds: string[]) {
    const query = `Compare these products: ${productIds.join(', ')}. Show side-by-side comparison of features, prices, and availability.`;
    return this.execute(query);
  }

  /**
   * Natural language product search
   */
  async searchNaturalLanguage(message: string) {
    return this.execute(message);
  }
}

/**
 * @deprecated Use BuyAndSellAgent instead. MarketplaceAgent has been merged into BuyAndSellAgent.
 */
export class MarketplaceAgent extends BuyAndSellAgent {
  constructor() {
    super();
    console.warn(
      'DEPRECATION WARNING: MarketplaceAgent is deprecated. Use BuyAndSellAgent instead.'
    );
  }
}

export const buyAndSellAgent = new BuyAndSellAgent();

/**
 * @deprecated Use buyAndSellAgent instead
 */
export const marketplaceAgent = buyAndSellAgent;
