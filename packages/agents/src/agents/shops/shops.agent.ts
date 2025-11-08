/**
 * Shops Agent
 * 
 * Handles general product search across various shop types.
 * Supports WhatsApp catalog integration, image-based product search,
 * and multi-store price comparison.
 * 
 * Features:
 * - General product search (any type of shop)
 * - WhatsApp catalog integration
 * - Image-based product identification
 * - Multi-store price comparison
 * - Shop listing creation
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
 * Product search parameters
 */
interface ProductSearchParams {
  query: string;
  category?: string;
  priceRange?: { min?: number; max?: number };
  location: {
    latitude: number;
    longitude: number;
  };
  radius?: number;
}

/**
 * Shop details
 */
interface Shop {
  id: string;
  name: string;
  type: string; // 'saloon', 'supermarket', 'spareparts', 'cosmetics', 'electronics', etc.
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  phone: string;
  whatsappCatalog?: string; // WhatsApp catalog URL
  description: string;
  topProducts?: string[];
  rating?: number;
  distance?: number;
}

/**
 * Product details
 */
interface Product {
  name: string;
  price: number;
  available: boolean;
  shopId: string;
  shopName: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  inStock: boolean;
  quantity?: number;
}

/**
 * Shop listing parameters
 */
interface ShopListingParams {
  name: string;
  type: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  description: string;
  phone: string;
  whatsappCatalog?: string;
  topProducts?: string[];
}

/**
 * Shop search result
 */
interface ShopSearchResult {
  shop: Shop;
  products: Product[];
  totalPrice: number;
  availabilityScore: number;
  matchedProducts: number;
}

export class ShopsAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('shops', 300); // 5-minute SLA
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Define shops tools
   */
  protected defineTools(): Tool[] {
    return [
      {
        name: 'identify_product_from_image',
        description: 'Identify product from image',
        parameters: {
          type: 'object',
          properties: {
            imageUrl: {
              type: 'string',
              description: 'URL of product image',
            },
          },
          required: ['imageUrl'],
        },
        execute: this.identifyProductFromImage.bind(this),
      },
      {
        name: 'search_shops',
        description: 'Search for shops near a location',
        parameters: {
          type: 'object',
          properties: {
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            shopType: {
              type: 'string',
              description: 'Type of shop (optional)',
            },
            radius: {
              type: 'number',
              default: 5,
              description: 'Search radius in km',
            },
          },
          required: ['latitude', 'longitude'],
        },
        execute: this.searchShops.bind(this),
      },
      {
        name: 'search_products',
        description: 'Search for products across multiple shops',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Product search query',
            },
            shopIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Shop IDs to search in',
            },
          },
          required: ['query', 'shopIds'],
        },
        execute: this.searchProducts.bind(this),
      },
      {
        name: 'get_whatsapp_catalog',
        description: 'Get products from WhatsApp catalog',
        parameters: {
          type: 'object',
          properties: {
            catalogUrl: {
              type: 'string',
              description: 'WhatsApp catalog URL',
            },
          },
          required: ['catalogUrl'],
        },
        execute: this.getWhatsAppCatalog.bind(this),
      },
      {
        name: 'compare_shop_prices',
        description: 'Compare prices for a product across shops',
        parameters: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            shopIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['productName', 'shopIds'],
        },
        execute: this.compareShopPrices.bind(this),
      },
      {
        name: 'create_shop_listing',
        description: 'Create a new shop listing',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            location: { type: 'object' },
            description: { type: 'string' },
            phone: { type: 'string' },
            whatsappCatalog: { type: 'string' },
            topProducts: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['name', 'type', 'location', 'description', 'phone'],
        },
        execute: this.createShopListing.bind(this),
      },
    ];
  }

  /**
   * Process shops request
   */
  async process(input: AgentInput, context: AgentContext): Promise<AgentResult> {
    const { message, intent } = input;

    // Check if this is a shop listing request
    if (intent === 'add_shop' || message.toLowerCase().includes('add shop')) {
      return this.handleAddShop(input, context);
    }

    // Otherwise, handle product search
    return this.handleFindProducts(input, context);
  }

  /**
   * Handle product search request
   */
  private async handleFindProducts(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    const session = this.createSession(context.userId, context);

    try {
      // Extract search parameters
      const searchParams = await this.extractSearchParams(input);

      // If image provided, identify product first
      if (input.metadata?.imageUrl) {
        const identifiedProduct = await this.identifyProductFromImage(
          { imageUrl: input.metadata.imageUrl },
          context
        );
        searchParams.query = identifiedProduct.productName || searchParams.query;
      }

      // Search for shops
      const shops = await this.searchShops(
        {
          latitude: searchParams.location.latitude,
          longitude: searchParams.location.longitude,
          radius: searchParams.radius || 5,
        },
        context
      );

      if (shops.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ No shops found in your area.\n\n' +
            'Would you like to expand the search radius?'
        );
      }

      // Search for products in shops
      const shopResults = await Promise.all(
        shops.map((shop) => this.searchProductsInShop(shop, searchParams, context))
      );

      // Filter shops with matching products
      const shopsWithProducts = shopResults.filter(
        (result) => result.matchedProducts > 0
      );

      if (shopsWithProducts.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ No shops have the product you\'re looking for.\n\n' +
            'Would you like me to:\n' +
            '1. Search in a wider area\n' +
            '2. Suggest similar products'
        );
      }

      // Score and rank shops
      const rankedShops = this.scoreShops(shopsWithProducts, searchParams);

      // Convert to vendor quotes
      const quotes: VendorQuote[] = rankedShops.slice(0, 3).map((result) => ({
        vendorId: result.shop.id,
        vendorType: 'shop',
        offerData: {
          shopName: result.shop.name,
          shopType: result.shop.type,
          products: result.products,
          totalPrice: result.totalPrice,
          currency: 'RWF',
          distance: result.shop.distance,
          matchedProducts: result.matchedProducts,
        },
        status: 'pending',
        score: result.availabilityScore,
      }));

      // Aggregate results
      this.aggregateResults(session, quotes);

      // Format options message
      const message = this.formatShopOptions(rankedShops.slice(0, 3), searchParams);

      return this.formatResult(session, quotes, message);
    } catch (error) {
      return this.handleError(session, error as Error);
    }
  }

  /**
   * Handle add shop request
   */
  private async handleAddShop(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      // Extract listing parameters
      const listingParams = await this.extractListingParams(input);

      // Create shop listing
      const shop = await this.createShopListing(listingParams, context);

      return {
        success: true,
        sessionId: `shop_${Date.now()}`,
        message:
          '✅ *Shop Added Successfully!*\n\n' +
          `🏪 ${listingParams.name}\n` +
          `📍 ${listingParams.location.address}\n` +
          `📱 ${listingParams.phone}\n` +
          `🏷️ Type: ${listingParams.type}\n\n` +
          `Your shop is now visible to customers in your area! 🎉`,
        data: shop,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to add shop. Please check your information and try again.',
        error: (error as Error).message,
        status: 'error',
      };
    }
  }

  /**
   * Identify product from image using OpenAI Vision
   */
  private async identifyProductFromImage(
    params: { imageUrl: string },
    context: AgentContext
  ): Promise<any> {
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
                  'Identify this product. Provide: product name, category, brand (if visible), ' +
                  'and a brief description. Return as JSON: ' +
                  '{"productName": "...", "category": "...", "brand": "...", "description": "..."}',
              },
              {
                type: 'image_url',
                image_url: { url: params.imageUrl },
              },
            ],
          },
        ],
        max_tokens: 300,
      });

      const content = response.choices[0].message.content || '{}';
      
      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return { productName: 'Unknown product' };
    } catch (error) {
      console.error('Product identification error:', error);
      return { productName: 'Unknown product' };
    }
  }

  /**
   * Search for shops near location
   */
  private async searchShops(
    params: { latitude: number; longitude: number; shopType?: string; radius: number },
    context: AgentContext
  ): Promise<Shop[]> {
    // TODO: Replace with actual database query
    console.log('Searching shops:', params);

    const mockShops: Shop[] = [
      {
        id: 'shop_1',
        name: 'City Supermarket',
        type: 'supermarket',
        location: {
          latitude: params.latitude + 0.01,
          longitude: params.longitude + 0.01,
          address: 'Kimihurura, Kigali',
        },
        phone: '+250788111222',
        description: 'Full-service supermarket with groceries and household items',
        topProducts: ['Rice', 'Sugar', 'Oil', 'Soap', 'Bread'],
        rating: 4.5,
        distance: 1.1,
      },
      {
        id: 'shop_2',
        name: 'Beauty Corner',
        type: 'cosmetics',
        location: {
          latitude: params.latitude + 0.02,
          longitude: params.longitude - 0.01,
          address: 'Remera, Kigali',
        },
        phone: '+250788222333',
        description: 'Cosmetics and beauty products',
        whatsappCatalog: 'https://wa.me/c/250788222333',
        topProducts: ['Makeup', 'Skincare', 'Hair products', 'Perfume'],
        rating: 4.7,
        distance: 1.8,
      },
      {
        id: 'shop_3',
        name: 'Tech Plaza',
        type: 'electronics',
        location: {
          latitude: params.latitude - 0.01,
          longitude: params.longitude + 0.02,
          address: 'Kacyiru, Kigali',
        },
        phone: '+250788333444',
        description: 'Electronics and mobile accessories',
        topProducts: ['Phones', 'Laptops', 'Accessories', 'Chargers'],
        rating: 4.3,
        distance: 2.3,
      },
      {
        id: 'shop_4',
        name: 'Fashion Hub',
        type: 'clothing',
        location: {
          latitude: params.latitude + 0.015,
          longitude: params.longitude + 0.015,
          address: 'Nyarutarama, Kigali',
        },
        phone: '+250788444555',
        description: 'Latest fashion and accessories',
        topProducts: ['Dresses', 'Shoes', 'Bags', 'Watches'],
        rating: 4.6,
        distance: 1.5,
      },
    ];

    let filtered = mockShops.filter((shop) => shop.distance! <= params.radius);

    if (params.shopType) {
      filtered = filtered.filter((shop) => shop.type === params.shopType);
    }

    return filtered;
  }

  /**
   * Search products in a specific shop
   */
  private async searchProducts(
    params: { query: string; shopIds: string[] },
    context: AgentContext
  ): Promise<Product[]> {
    // TODO: Replace with actual database query
    console.log('Searching products:', params);

    // Simulate product search
    const mockProducts: Product[] = params.shopIds.flatMap((shopId) => [
      {
        name: params.query,
        price: Math.floor(Math.random() * 50000) + 5000,
        available: Math.random() > 0.3,
        shopId,
        shopName: `Shop ${shopId}`,
        inStock: Math.random() > 0.2,
        quantity: Math.floor(Math.random() * 20) + 1,
      },
    ]);

    return mockProducts.filter((p) => p.available);
  }

  /**
   * Search products in a specific shop with full details
   */
  private async searchProductsInShop(
    shop: Shop,
    searchParams: ProductSearchParams,
    context: AgentContext
  ): Promise<ShopSearchResult> {
    const products = await this.searchProducts(
      { query: searchParams.query, shopIds: [shop.id] },
      context
    );

    const availableProducts = products.filter((p) => p.available);
    const totalPrice = availableProducts.reduce((sum, p) => sum + p.price, 0);
    const matchedProducts = availableProducts.length;

    const availabilityScore = matchedProducts > 0 ? 100 : 0;

    return {
      shop,
      products: availableProducts,
      totalPrice,
      availabilityScore,
      matchedProducts,
    };
  }

  /**
   * Get products from WhatsApp catalog
   */
  private async getWhatsAppCatalog(
    params: { catalogUrl: string },
    context: AgentContext
  ): Promise<any> {
    // TODO: Implement WhatsApp catalog API integration
    console.log('Fetching WhatsApp catalog:', params.catalogUrl);

    return {
      catalogUrl: params.catalogUrl,
      products: [],
      message: 'WhatsApp catalog integration coming soon',
    };
  }

  /**
   * Compare prices across shops
   */
  private async compareShopPrices(
    params: { productName: string; shopIds: string[] },
    context: AgentContext
  ): Promise<any> {
    const products = await this.searchProducts(
      { query: params.productName, shopIds: params.shopIds },
      context
    );

    const comparison = products.map((product) => ({
      shopId: product.shopId,
      shopName: product.shopName,
      price: product.price,
      available: product.available,
      inStock: product.inStock,
    }));

    return { comparison };
  }

  /**
   * Create shop listing
   */
  private async createShopListing(
    params: ShopListingParams,
    context: AgentContext
  ): Promise<Shop> {
    // TODO: Replace with actual database insert
    console.log('Creating shop listing:', params);

    const shop: Shop = {
      id: `shop_${Date.now()}`,
      name: params.name,
      type: params.type,
      location: params.location,
      phone: params.phone,
      whatsappCatalog: params.whatsappCatalog,
      description: params.description,
      topProducts: params.topProducts,
    };

    return shop;
  }

  /**
   * Score and rank shops
   * Scoring weights:
   * - Product availability: 40%
   * - Price: 30%
   * - Distance: 20%
   * - Rating: 10%
   */
  private scoreShops(
    results: ShopSearchResult[],
    searchParams: ProductSearchParams
  ): ShopSearchResult[] {
    const scored = results.map((result) => {
      let score = 0;

      // Availability (40%)
      score += result.matchedProducts > 0 ? 40 : 0;

      // Price (30%) - lower is better
      if (results.length > 1) {
        const prices = results.map((r) => r.totalPrice);
        const minPrice = Math.min(...prices.filter((p) => p > 0));
        const maxPrice = Math.max(...prices);
        const priceRange = maxPrice - minPrice;

        if (priceRange > 0 && result.totalPrice > 0) {
          const priceScore = ((maxPrice - result.totalPrice) / priceRange) * 30;
          score += priceScore;
        } else {
          score += 15; // Neutral
        }
      } else {
        score += 15; // Neutral if only one shop
      }

      // Distance (20%)
      if (result.shop.distance) {
        if (result.shop.distance < 2) score += 20;
        else if (result.shop.distance < 5) score += 15;
        else if (result.shop.distance < 10) score += 10;
        else score += 5;
      }

      // Rating (10%)
      if (result.shop.rating) {
        score += (result.shop.rating / 5) * 10;
      }

      return { ...result, availabilityScore: score };
    });

    return scored.sort((a, b) => b.availabilityScore - a.availabilityScore);
  }

  /**
   * Format shop options message
   */
  private formatShopOptions(
    results: ShopSearchResult[],
    searchParams: ProductSearchParams
  ): string {
    let message = '🛍️ *Shops with Your Product*\n\n';

    results.forEach((result, index) => {
      message += `*Option ${index + 1}: ${result.shop.name}*\n`;
      message += `🏷️ ${result.shop.type.charAt(0).toUpperCase() + result.shop.type.slice(1)}\n`;
      message += `📍 ${result.shop.location.address}\n`;

      if (result.shop.distance) {
        message += `📏 ${result.shop.distance.toFixed(1)}km away\n`;
      }

      if (result.shop.rating) {
        message += `⭐ ${result.shop.rating}/5\n`;
      }

      message += `\n📦 *Available Products:*\n`;
      result.products.slice(0, 3).forEach((product) => {
        message += `  • ${product.name}: ${product.price.toLocaleString()} RWF`;
        if (product.quantity) {
          message += ` (${product.quantity} available)`;
        }
        message += '\n';
      });

      if (result.products.length > 3) {
        message += `  _+${result.products.length - 3} more products_\n`;
      }

      if (result.shop.whatsappCatalog) {
        message += `\n📱 WhatsApp Catalog Available\n`;
      }

      message += `\n💰 *Total: ${result.totalPrice.toLocaleString()} RWF*\n`;
      message += `─────────────\n\n`;
    });

    message += '_Reply with option number (1, 2, or 3) for shop contact details_';

    return message;
  }

  /**
   * Extract search parameters from input
   */
  private async extractSearchParams(input: AgentInput): Promise<ProductSearchParams> {
    const { message, metadata } = input;

    // Get location
    const location = metadata?.location || {
      latitude: -1.9536,
      longitude: 30.0606,
    };

    // Extract query from message or metadata
    const query = metadata?.query || this.extractQueryFromMessage(message);

    return {
      query,
      location,
      radius: metadata?.radius || 5,
      category: metadata?.category,
    };
  }

  /**
   * Extract product query from message
   */
  private extractQueryFromMessage(message: string): string {
    // Simple extraction - remove common words
    const stopWords = [
      'find',
      'looking for',
      'search',
      'need',
      'want',
      'buy',
      'get',
      'where can i',
    ];

    let query = message.toLowerCase();
    stopWords.forEach((word) => {
      query = query.replace(word, '');
    });

    return query.trim();
  }

  /**
   * Extract shop listing parameters from input
   */
  private async extractListingParams(input: AgentInput): Promise<ShopListingParams> {
    const { metadata } = input;

    if (!metadata?.listingParams) {
      throw new Error('Shop listing parameters are required');
    }

    return metadata.listingParams as ShopListingParams;
  }
}
