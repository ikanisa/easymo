/**
 * Quincaillerie Agent
 * 
 * Handles hardware store item sourcing with image recognition and price comparison.
 * Supports both image-based and text-based item requests.
 * 
 * Features:
 * - OCR for item lists from images
 * - Text-based item search
 * - Multi-store availability checking
 * - Price comparison and negotiation
 * - 5-minute SLA enforcement
 * - 3-option presentation standard
 */

import { BaseAgent } from '../base/agent.base';
import {
  AgentContext,
  AgentInput,
  AgentResult,
  VendorQuote,
  Tool,
} from '../../types/agent.types';
import OpenAI from 'openai';

/**
 * Hardware item details
 */
interface HardwareItem {
  name: string;
  quantity?: number;
  specifications?: string;
  category?: 'tools' | 'materials' | 'electrical' | 'plumbing' | 'paint' | 'other';
}

/**
 * Store inventory item
 */
interface StoreInventoryItem {
  itemName: string;
  available: boolean;
  quantity: number;
  price: number;
  brand?: string;
  specifications?: string;
}

/**
 * Store details
 */
interface QuincaillerieStore {
  id: string;
  name: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  phone: string;
  rating?: number;
  distance?: number;
}

/**
 * Store availability result
 */
interface StoreAvailability {
  store: QuincaillerieStore;
  items: StoreInventoryItem[];
  totalPrice: number;
  availabilityScore: number;
  availableCount: number;
  missingItems: string[];
}

export class QuincaillerieAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('quincaillerie', 300); // 5-minute SLA
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Define quincaillerie tools
   */
  protected defineTools(): Tool[] {
    return [
      {
        name: 'extract_items_from_image',
        description: 'Extract hardware items from an image (shopping list, receipt, etc.)',
        parameters: {
          type: 'object',
          properties: {
            imageUrl: {
              type: 'string',
              description: 'URL of the image containing items',
            },
          },
          required: ['imageUrl'],
        },
        execute: this.extractItemsFromImage.bind(this),
      },
      {
        name: 'search_hardware_stores',
        description: 'Search for hardware stores near a location',
        parameters: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            radius: {
              type: 'number',
              default: 5,
              description: 'Search radius in kilometers',
            },
          },
          required: ['latitude', 'longitude'],
        },
        execute: this.searchHardwareStores.bind(this),
      },
      {
        name: 'check_item_availability',
        description: 'Check if a store has specific items in stock',
        parameters: {
          type: 'object',
          properties: {
            storeId: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                },
              },
            },
          },
          required: ['storeId', 'items'],
        },
        execute: this.checkItemAvailability.bind(this),
      },
      {
        name: 'compare_prices',
        description: 'Compare prices for items across multiple stores',
        parameters: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { type: 'object' },
            },
            storeIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['items', 'storeIds'],
        },
        execute: this.comparePrices.bind(this),
      },
      {
        name: 'negotiate_bulk_discount',
        description: 'Negotiate bulk discount with store',
        parameters: {
          type: 'object',
          properties: {
            storeId: { type: 'string' },
            totalPrice: { type: 'number' },
            itemCount: { type: 'number' },
          },
          required: ['storeId', 'totalPrice'],
        },
        execute: this.negotiateBulkDiscount.bind(this),
      },
    ];
  }

  /**
   * Process quincaillerie request
   */
  async process(input: AgentInput, context: AgentContext): Promise<AgentResult> {
    const session = this.createSession(context.userId, context);

    try {
      // Extract items from input (image or text)
      const items = await this.extractItems(input);

      if (items.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ Could not understand your items request.\n\n' +
            'Please either:\n' +
            '• Send an image of your shopping list\n' +
            '• Type the items you need (e.g., "cement, paint, screws")'
        );
      }

      // Confirm items with user if extracted from image
      if (input.metadata?.imageUrl) {
        const confirmationMessage = this.formatItemConfirmation(items);
        // In real implementation, wait for user confirmation
        // For now, proceed automatically
      }

      // Get user location
      const location = input.metadata?.location || context.metadata?.location;
      if (!location) {
        throw new Error('Location is required to search nearby stores');
      }

      // Search nearby stores
      const stores = await this.searchHardwareStores(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          radius: 5,
        },
        context
      );

      if (stores.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ No hardware stores found in your area.\n\n' +
            'Would you like to expand the search radius?'
        );
      }

      // Check availability at each store
      const availabilityResults = await Promise.all(
        stores.map((store) => this.checkStoreAvailability(store, items, context))
      );

      // Filter stores with available items
      const storesWithItems = availabilityResults.filter(
        (result) => result.availableCount > 0
      );

      if (storesWithItems.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ None of the nearby stores have these items in stock.\n\n' +
            'Would you like me to:\n' +
            '1. Search in a wider area\n' +
            '2. Suggest alternative items'
        );
      }

      // Score and rank stores
      const rankedStores = this.scoreStores(storesWithItems, items);

      // Negotiate bulk discounts for top stores
      const negotiatedResults = await Promise.all(
        rankedStores.slice(0, 3).map((result) => this.applyNegotiation(result, context))
      );

      // Convert to vendor quotes
      const quotes: VendorQuote[] = negotiatedResults.map((result) => ({
        vendorId: result.store.id,
        vendorType: 'quincaillerie',
        offerData: {
          storeName: result.store.name,
          items: result.items,
          totalPrice: result.totalPrice,
          currency: 'RWF',
          availabilityScore: result.availabilityScore,
          distance: result.store.distance,
          availableCount: result.availableCount,
          missingItems: result.missingItems,
        },
        status: 'pending',
        score: result.availabilityScore,
      }));

      // Aggregate results
      this.aggregateResults(session, quotes);

      // Format options message
      const message = this.formatStoreOptions(negotiatedResults, items);

      return this.formatResult(session, quotes, message);
    } catch (error) {
      return this.handleError(session, error as Error);
    }
  }

  /**
   * Extract items from user input (image or text)
   */
  private async extractItems(input: AgentInput): Promise<HardwareItem[]> {
    // If image provided, use OCR
    if (input.metadata?.imageUrl) {
      return this.extractItemsFromImage({ imageUrl: input.metadata.imageUrl }, {} as AgentContext);
    }

    // Otherwise, parse from text
    return this.parseItemsFromText(input.message);
  }

  /**
   * Extract items from image using OpenAI Vision
   */
  private async extractItemsFromImage(
    params: { imageUrl: string },
    context: AgentContext
  ): Promise<HardwareItem[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Extract all hardware/construction items from this image. ' +
                  'For each item, provide: name, quantity (if visible), and any specifications. ' +
                  'Return as a JSON array: [{"name": "...", "quantity": 1, "specifications": "..."}]',
              },
              {
                type: 'image_url',
                image_url: { url: params.imageUrl },
              },
            ],
          },
        ],
        max_tokens: 500,
      });

      const content = response.choices[0].message.content || '[]';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('OCR extraction error:', error);
      return [];
    }
  }

  /**
   * Parse items from text message
   */
  private parseItemsFromText(message: string): HardwareItem[] {
    // Simple parsing - split by common delimiters
    const itemTexts = message
      .split(/,|;|\n|and/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    return itemTexts.map((text) => {
      // Try to extract quantity
      const quantityMatch = text.match(/^(\d+)\s+(.+)$/);
      if (quantityMatch) {
        return {
          name: quantityMatch[2],
          quantity: parseInt(quantityMatch[1]),
        };
      }

      return { name: text, quantity: 1 };
    });
  }

  /**
   * Search for hardware stores near location
   */
  private async searchHardwareStores(
    params: { latitude: number; longitude: number; radius: number },
    context: AgentContext
  ): Promise<QuincaillerieStore[]> {
    // TODO: Replace with actual database query
    // This is a mock implementation
    console.log('Searching hardware stores:', params);

    const mockStores: QuincaillerieStore[] = [
      {
        id: 'store_1',
        name: 'Kigali Hardware Center',
        location: {
          latitude: params.latitude + 0.01,
          longitude: params.longitude + 0.01,
          address: 'Kimihurura, Kigali',
        },
        phone: '+250788123456',
        rating: 4.5,
        distance: 1.2,
      },
      {
        id: 'store_2',
        name: 'Remera Building Supplies',
        location: {
          latitude: params.latitude + 0.02,
          longitude: params.longitude - 0.01,
          address: 'Remera, Kigali',
        },
        phone: '+250788234567',
        rating: 4.3,
        distance: 2.1,
      },
      {
        id: 'store_3',
        name: 'City Construction Materials',
        location: {
          latitude: params.latitude - 0.01,
          longitude: params.longitude + 0.02,
          address: 'Kacyiru, Kigali',
        },
        phone: '+250788345678',
        rating: 4.7,
        distance: 2.8,
      },
    ];

    return mockStores.filter((store) => store.distance! <= params.radius);
  }

  /**
   * Check item availability at a specific store
   */
  private async checkItemAvailability(
    params: { storeId: string; items: HardwareItem[] },
    context: AgentContext
  ): Promise<StoreInventoryItem[]> {
    // TODO: Replace with actual database query
    console.log('Checking availability:', params);

    // Simulate inventory check
    return params.items.map((item) => {
      const available = Math.random() > 0.3; // 70% availability rate
      const basePrice = this.estimateItemPrice(item);

      return {
        itemName: item.name,
        available,
        quantity: available ? Math.floor(Math.random() * 50) + 10 : 0,
        price: available ? basePrice * (1 + Math.random() * 0.2 - 0.1) : 0, // ±10% variation
        specifications: item.specifications,
      };
    });
  }

  /**
   * Check store availability for all items
   */
  private async checkStoreAvailability(
    store: QuincaillerieStore,
    items: HardwareItem[],
    context: AgentContext
  ): Promise<StoreAvailability> {
    const inventoryItems = await this.checkItemAvailability(
      { storeId: store.id, items },
      context
    );

    const availableItems = inventoryItems.filter((item) => item.available);
    const missingItems = inventoryItems
      .filter((item) => !item.available)
      .map((item) => item.itemName);

    const totalPrice = availableItems.reduce((sum, item) => sum + item.price, 0);

    const availabilityScore = (availableItems.length / items.length) * 100;

    return {
      store,
      items: inventoryItems,
      totalPrice,
      availabilityScore,
      availableCount: availableItems.length,
      missingItems,
    };
  }

  /**
   * Compare prices across stores
   */
  private async comparePrices(
    params: { items: HardwareItem[]; storeIds: string[] },
    context: AgentContext
  ): Promise<any> {
    const comparisons = await Promise.all(
      params.storeIds.map(async (storeId) => {
        const inventory = await this.checkItemAvailability(
          { storeId, items: params.items },
          context
        );
        return { storeId, inventory };
      })
    );

    return { comparisons };
  }

  /**
   * Negotiate bulk discount
   */
  private async negotiateBulkDiscount(
    params: { storeId: string; totalPrice: number; itemCount?: number },
    context: AgentContext
  ): Promise<any> {
    // Calculate potential discount based on total
    let discountPercent = 0;

    if (params.totalPrice > 100000) {
      discountPercent = 10; // 10% for orders over 100k
    } else if (params.totalPrice > 50000) {
      discountPercent = 5; // 5% for orders over 50k
    } else if (params.totalPrice > 20000) {
      discountPercent = 3; // 3% for orders over 20k
    }

    // Simulate negotiation success (80% success rate for bulk orders)
    const accepted = discountPercent > 0 && Math.random() > 0.2;

    if (accepted) {
      const discountAmount = params.totalPrice * (discountPercent / 100);
      return {
        success: true,
        discountPercent,
        discountAmount,
        finalPrice: params.totalPrice - discountAmount,
      };
    }

    return {
      success: false,
      discountPercent: 0,
      finalPrice: params.totalPrice,
    };
  }

  /**
   * Apply negotiation to store result
   */
  private async applyNegotiation(
    result: StoreAvailability,
    context: AgentContext
  ): Promise<StoreAvailability> {
    const negotiation = await this.negotiateBulkDiscount(
      {
        storeId: result.store.id,
        totalPrice: result.totalPrice,
        itemCount: result.availableCount,
      },
      context
    );

    if (negotiation.success) {
      return {
        ...result,
        totalPrice: negotiation.finalPrice,
      };
    }

    return result;
  }

  /**
   * Score and rank stores
   * Scoring weights:
   * - Availability: 50%
   * - Price: 30%
   * - Distance: 15%
   * - Rating: 5%
   */
  private scoreStores(
    results: StoreAvailability[],
    requestedItems: HardwareItem[]
  ): StoreAvailability[] {
    const scored = results.map((result) => {
      let score = 0;

      // Availability (50%)
      score += result.availabilityScore * 0.5;

      // Price (30%) - lower is better
      const prices = results.map((r) => r.totalPrice);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;

      if (priceRange > 0) {
        const priceScore = ((maxPrice - result.totalPrice) / priceRange) * 30;
        score += priceScore;
      } else {
        score += 15; // Neutral if all same price
      }

      // Distance (15%)
      if (result.store.distance) {
        if (result.store.distance < 2) score += 15;
        else if (result.store.distance < 5) score += 10;
        else if (result.store.distance < 10) score += 5;
      }

      // Rating (5%)
      if (result.store.rating) {
        score += (result.store.rating / 5) * 5;
      }

      return { ...result, availabilityScore: score };
    });

    return scored.sort((a, b) => b.availabilityScore - a.availabilityScore);
  }

  /**
   * Estimate item price (fallback for mock data)
   */
  private estimateItemPrice(item: HardwareItem): number {
    const basePrices: Record<string, number> = {
      cement: 8000,
      paint: 15000,
      nails: 2000,
      screws: 3000,
      wood: 5000,
      wire: 4000,
      pipe: 3500,
      tile: 6000,
      default: 5000,
    };

    const itemName = item.name.toLowerCase();
    for (const [key, price] of Object.entries(basePrices)) {
      if (itemName.includes(key)) {
        return price * (item.quantity || 1);
      }
    }

    return basePrices.default * (item.quantity || 1);
  }

  /**
   * Format item confirmation message
   */
  private formatItemConfirmation(items: HardwareItem[]): string {
    let message = '📋 *Items Extracted from Image:*\n\n';

    items.forEach((item, index) => {
      message += `${index + 1}. ${item.name}`;
      if (item.quantity && item.quantity > 1) {
        message += ` (${item.quantity})`;
      }
      if (item.specifications) {
        message += ` - ${item.specifications}`;
      }
      message += '\n';
    });

    message += '\n_Reply "confirm" to search for these items, or tell me which items to change._';

    return message;
  }

  /**
   * Format store options message
   */
  private formatStoreOptions(results: StoreAvailability[], requestedItems: HardwareItem[]): string {
    let message = '🔨 *Hardware Store Options Found*\n\n';

    results.slice(0, 3).forEach((result, index) => {
      message += `*Option ${index + 1}: ${result.store.name}*\n`;
      message += `📍 ${result.store.location.address}\n`;

      if (result.store.distance) {
        message += `📏 ${result.store.distance.toFixed(1)}km away\n`;
      }

      if (result.store.rating) {
        message += `⭐ ${result.store.rating}/5\n`;
      }

      message += `\n📦 *Available Items:* ${result.availableCount}/${requestedItems.length}\n`;

      result.items
        .filter((item) => item.available)
        .forEach((item) => {
          message += `  ✓ ${item.itemName}: ${item.price.toLocaleString()} RWF`;
          if (item.quantity) {
            message += ` (${item.quantity} in stock)`;
          }
          message += '\n';
        });

      if (result.missingItems.length > 0) {
        message += `\n❌ *Not available:* ${result.missingItems.join(', ')}\n`;
      }

      message += `\n💰 *Total: ${result.totalPrice.toLocaleString()} RWF*\n`;
      message += `─────────────\n\n`;
    });

    message += '_Reply with option number (1, 2, or 3) to get store contact details_';

    return message;
  }
}
