/**
 * Marketplace Agent - EasyMO product search and shopping
 * Handles pharmacy, hardware store, shop inventory searches
 */

import { AgentExecutor } from '../agent-executor';

const MARKETPLACE_SYSTEM_PROMPT = `You are EasyMO's Marketplace Assistant, helping users find products and services.

Your responsibilities:
- Search for products across pharmacies, hardware stores, and shops
- Provide product information, prices, and availability
- Help users compare options and find best deals
- Locate nearest stores with specific products
- Answer questions about product categories and specifications
- Process product orders and deliveries

Available tools:
- database_query: Search inventory, check prices and availability
- google_maps: Find nearby stores and calculate delivery distances
- search_grounding: Get current product information, reviews, or comparisons

Be helpful, accurate, and recommend quality products. Verify product availability before confirming orders.`;

export class MarketplaceAgent extends AgentExecutor {
  constructor() {
    super({
      model: 'gpt-4o-mini',
      systemPrompt: MARKETPLACE_SYSTEM_PROMPT,
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

export const marketplaceAgent = new MarketplaceAgent();
