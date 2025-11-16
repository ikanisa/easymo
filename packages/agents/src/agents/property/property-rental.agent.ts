/**
 * Property Rental Agent
 * 
 * Handles property rental searches and listings for both short-term and long-term rentals.
 * Supports property matching based on user preferences, price negotiation, and vendor communication.
 * 
 * Features:
 * - Short-term (1 day - 3 months) and long-term (3+ months) rental support
 * - Property search based on location, bedrooms, budget
 * - Image analysis for property photos
 * - Price negotiation (target 10% discount)
 * - Property listing creation
 * - 5-minute SLA for search operations
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
import { requireFirstMessageContent } from '../../../../shared/src/openaiGuard';

/**
 * Property search parameters
 */
interface PropertySearchParams {
  rentalType: 'short_term' | 'long_term';
  bedrooms: number;
  minBudget?: number;
  maxBudget?: number;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  amenities?: string[];
  duration?: number; // months
}

/**
 * Property listing parameters
 */
interface PropertyListingParams {
  rentalType: 'short_term' | 'long_term';
  bedrooms: number;
  bathrooms: number;
  price: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  description: string;
  amenities: string[];
  images?: string[];
  availableFrom?: Date;
}

/**
 * Property details from vendor
 */
interface PropertyDetails {
  id: string;
  ownerId: string;
  rentalType: 'short_term' | 'long_term';
  bedrooms: number;
  bathrooms: number;
  price: number;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  description: string;
  amenities: string[];
  images: string[];
  availableFrom: Date;
  rating?: number;
  reviews?: number;
  distance?: number; // km from search location
}

export class PropertyRentalAgent extends BaseAgent {
  private openai: OpenAI;

  constructor() {
    super('property_rental', 300); // 5-minute SLA
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Define property rental tools
   */
  protected defineTools(): Tool[] {
    return [
      {
        name: 'search_properties',
        description: 'Search for rental properties based on criteria',
        parameters: {
          type: 'object',
          properties: {
            rentalType: {
              type: 'string',
              enum: ['short_term', 'long_term'],
              description: 'Type of rental',
            },
            bedrooms: {
              type: 'number',
              description: 'Number of bedrooms required',
            },
            minBudget: {
              type: 'number',
              description: 'Minimum budget per month',
            },
            maxBudget: {
              type: 'number',
              description: 'Maximum budget per month',
            },
            latitude: { type: 'number' },
            longitude: { type: 'number' },
            amenities: {
              type: 'array',
              items: { type: 'string' },
              description: 'Desired amenities',
            },
          },
          required: ['rentalType', 'bedrooms', 'latitude', 'longitude'],
        },
        execute: this.searchProperties.bind(this),
      },
      {
        name: 'analyze_property_images',
        description: 'Analyze property images to extract details and assess quality',
        parameters: {
          type: 'object',
          properties: {
            imageUrls: {
              type: 'array',
              items: { type: 'string' },
              description: 'URLs of property images',
            },
          },
          required: ['imageUrls'],
        },
        execute: this.analyzePropertyImages.bind(this),
      },
      {
        name: 'negotiate_rental_price',
        description: 'Negotiate rental price with property owner',
        parameters: {
          type: 'object',
          properties: {
            propertyId: { type: 'string' },
            currentPrice: { type: 'number' },
            targetPrice: { type: 'number' },
            duration: {
              type: 'number',
              description: 'Rental duration in months',
            },
          },
          required: ['propertyId', 'currentPrice', 'targetPrice'],
        },
        execute: this.negotiatePrice.bind(this),
      },
      {
        name: 'create_property_listing',
        description: 'Create a new property listing',
        parameters: {
          type: 'object',
          properties: {
            rentalType: {
              type: 'string',
              enum: ['short_term', 'long_term'],
            },
            bedrooms: { type: 'number' },
            bathrooms: { type: 'number' },
            price: { type: 'number' },
            location: { type: 'object' },
            description: { type: 'string' },
            amenities: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: [
            'rentalType',
            'bedrooms',
            'price',
            'location',
            'description',
          ],
        },
        execute: this.createListing.bind(this),
      },
    ];
  }

  /**
   * Process property rental request
   */
  async process(input: AgentInput, context: AgentContext): Promise<AgentResult> {
    const { message, intent, metadata } = input;

    // Check if this is a listing creation request
    if (intent === 'add_property' || message.toLowerCase().includes('add property')) {
      return this.handleAddProperty(input, context);
    }

    // Otherwise, handle property search
    return this.handleFindProperty(input, context);
  }

  /**
   * Handle property search request
   */
  private async handleFindProperty(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    const session = this.createSession(context.userId, context);

    try {
      // Extract search parameters from input
      const searchParams = await this.extractSearchParams(input);

      // Search for properties
      const properties = await this.searchProperties(searchParams, context);

      if (properties.length === 0) {
        return this.formatResult(
          session,
          [],
          '❌ No properties found matching your criteria.\n\n' +
            'Would you like to:\n' +
            '1. Adjust your budget\n' +
            '2. Expand search area\n' +
            '3. Change number of bedrooms'
        );
      }

      // Score and rank properties
      const rankedProperties = this.scoreProperties(properties, searchParams);

      // Convert to vendor quotes
      const quotes: VendorQuote[] = rankedProperties.slice(0, 3).map((property) => ({
        vendorId: property.ownerId,
        vendorType: 'property_owner',
        offerData: {
          propertyId: property.id,
          price: property.price,
          currency: 'RWF',
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          location: property.location,
          amenities: property.amenities,
          distance: property.distance,
          rating: property.rating,
        },
        status: 'pending',
        score: this.calculatePropertyScore(property, searchParams),
      }));

      // Aggregate results
      this.aggregateResults(session, quotes);

      // Format property options message
      const message = this.formatPropertyOptions(rankedProperties.slice(0, 3), searchParams);

      return this.formatResult(session, quotes, message);
    } catch (error) {
      return this.handleError(session, error as Error);
    }
  }

  /**
   * Handle add property request
   */
  private async handleAddProperty(
    input: AgentInput,
    context: AgentContext
  ): Promise<AgentResult> {
    try {
      // Extract listing parameters from input
      const listingParams = await this.extractListingParams(input);

      // Create the listing
      const listing = await this.createListing(listingParams, context);

      return {
        success: true,
        sessionId: `property_listing_${Date.now()}`,
        message:
          '✅ *Property Listed Successfully!*\n\n' +
          `📍 Location: ${listingParams.location.address}\n` +
          `🛏️ Bedrooms: ${listingParams.bedrooms}\n` +
          `🚿 Bathrooms: ${listingParams.bathrooms}\n` +
          `💰 Price: ${listingParams.price} RWF/month\n` +
          `🏠 Type: ${listingParams.rentalType === 'short_term' ? 'Short-term' : 'Long-term'}\n\n` +
          `Your property is now visible to potential tenants. We'll notify you when someone shows interest! 🎉`,
        data: listing,
        status: 'completed',
      };
    } catch (error) {
      return {
        success: false,
        message: '❌ Failed to create property listing. Please check your information and try again.',
        error: (error as Error).message,
        status: 'error',
      };
    }
  }

  /**
   * Search for properties based on criteria
   */
  private async searchProperties(
    params: PropertySearchParams,
    context: AgentContext
  ): Promise<PropertyDetails[]> {
    // TODO: Replace with actual database query
    // This is a mock implementation for demonstration
    console.log('Searching properties with params:', params);

    // Simulate database query
    const mockProperties: PropertyDetails[] = [
      {
        id: 'prop_1',
        ownerId: 'owner_1',
        rentalType: params.rentalType,
        bedrooms: params.bedrooms,
        bathrooms: 1,
        price: params.maxBudget ? params.maxBudget * 0.9 : 50000,
        location: {
          latitude: params.location.latitude + 0.01,
          longitude: params.location.longitude + 0.01,
          address: 'Kimihurura, Kigali',
        },
        description: 'Modern apartment with great amenities',
        amenities: ['WiFi', 'Parking', 'Security', 'Water'],
        images: [],
        availableFrom: new Date(),
        rating: 4.5,
        reviews: 23,
        distance: 1.2,
      },
      {
        id: 'prop_2',
        ownerId: 'owner_2',
        rentalType: params.rentalType,
        bedrooms: params.bedrooms,
        bathrooms: 2,
        price: params.maxBudget ? params.maxBudget * 0.85 : 45000,
        location: {
          latitude: params.location.latitude + 0.02,
          longitude: params.location.longitude - 0.01,
          address: 'Remera, Kigali',
        },
        description: 'Spacious house with garden',
        amenities: ['WiFi', 'Parking', 'Garden', 'Generator'],
        images: [],
        availableFrom: new Date(),
        rating: 4.7,
        reviews: 15,
        distance: 2.3,
      },
      {
        id: 'prop_3',
        ownerId: 'owner_3',
        rentalType: params.rentalType,
        bedrooms: params.bedrooms + 1,
        bathrooms: 2,
        price: params.maxBudget || 55000,
        location: {
          latitude: params.location.latitude - 0.01,
          longitude: params.location.longitude + 0.02,
          address: 'Kacyiru, Kigali',
        },
        description: 'Luxury apartment with city view',
        amenities: ['WiFi', 'Parking', 'Pool', 'Gym', 'Security'],
        images: [],
        availableFrom: new Date(),
        rating: 4.8,
        reviews: 31,
        distance: 3.1,
      },
    ];

    // Filter by budget if specified
    let filtered = mockProperties;
    if (params.maxBudget) {
      filtered = filtered.filter((p) => p.price <= params.maxBudget!);
    }
    if (params.minBudget) {
      filtered = filtered.filter((p) => p.price >= params.minBudget!);
    }

    return filtered;
  }

  /**
   * Analyze property images using OpenAI Vision
   */
  private async analyzePropertyImages(
    params: { imageUrls: string[] },
    context: AgentContext
  ): Promise<any> {
    try {
      const analyses = await Promise.all(
        params.imageUrls.map(async (imageUrl) => {
          const response = await this.openai.chat.completions.create({
            model: 'gpt-4o-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text:
                      'Analyze this property image. Describe the room type, condition, ' +
                      'visible amenities, and overall quality. Be concise.',
                  },
                  {
                    type: 'image_url',
                    image_url: { url: imageUrl },
                  },
                ],
              },
            ],
            max_tokens: 300,
          });

          return {
            imageUrl,
            analysis: requireFirstMessageContent(
              response,
              'Property rental image analysis',
            ),
          };
        })
      );

      return { analyses };
    } catch (error) {
      console.error('Image analysis error:', error);
      return { analyses: [], error: 'Failed to analyze images' };
    }
  }

  /**
   * Negotiate rental price with owner
   */
  private async negotiatePrice(
    params: {
      propertyId: string;
      currentPrice: number;
      targetPrice: number;
      duration?: number;
    },
    context: AgentContext
  ): Promise<any> {
    // Calculate discount percentage
    const discountPercent = ((params.currentPrice - params.targetPrice) / params.currentPrice) * 100;

    // Target 10% discount
    if (discountPercent > 15) {
      return {
        success: false,
        message: 'Requested discount too high',
        counterOffer: params.currentPrice * 0.9, // 10% discount
      };
    }

    // Simulate negotiation (in real app, this would communicate with owner)
    const accepted = Math.random() > 0.3; // 70% acceptance rate

    if (accepted) {
      const finalPrice = Math.max(params.targetPrice, params.currentPrice * 0.9);
      return {
        success: true,
        negotiatedPrice: finalPrice,
        message: `Owner accepted ${discountPercent.toFixed(1)}% discount`,
        savings: params.currentPrice - finalPrice,
      };
    } else {
      return {
        success: false,
        message: 'Owner declined negotiation',
        counterOffer: params.currentPrice * 0.95, // 5% discount offer
      };
    }
  }

  /**
   * Create property listing
   */
  private async createListing(
    params: PropertyListingParams,
    context: AgentContext
  ): Promise<any> {
    // TODO: Replace with actual database insert
    console.log('Creating property listing:', params);

    return {
      id: `prop_${Date.now()}`,
      ...params,
      ownerId: context.userId,
      createdAt: new Date(),
      status: 'active',
    };
  }

  /**
   * Score properties based on search criteria
   */
  private scoreProperties(
    properties: PropertyDetails[],
    searchParams: PropertySearchParams
  ): PropertyDetails[] {
    return properties
      .map((property) => ({
        ...property,
        score: this.calculatePropertyScore(property, searchParams),
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Calculate property match score
   * Scoring weights:
   * - Price fit: 30%
   * - Location (distance): 25%
   * - Amenities match: 20%
   * - Rating: 15%
   * - Bedrooms match: 10%
   */
  private calculatePropertyScore(
    property: PropertyDetails,
    searchParams: PropertySearchParams
  ): number {
    let score = 0;

    // Price fit (30%)
    if (searchParams.maxBudget) {
      const priceRatio = property.price / searchParams.maxBudget;
      if (priceRatio <= 1) {
        score += (1 - priceRatio) * 30;
      } else {
        score += Math.max(0, (2 - priceRatio) * 15); // Penalty for over budget
      }
    } else {
      score += 15; // Neutral if no budget specified
    }

    // Distance (25%)
    if (property.distance) {
      if (property.distance < 2) score += 25;
      else if (property.distance < 5) score += 20;
      else if (property.distance < 10) score += 15;
      else score += 5;
    }

    // Amenities match (20%)
    if (searchParams.amenities && searchParams.amenities.length > 0) {
      const matchedAmenities = searchParams.amenities.filter((amenity) =>
        property.amenities.some((pa) => pa.toLowerCase().includes(amenity.toLowerCase()))
      );
      score += (matchedAmenities.length / searchParams.amenities.length) * 20;
    } else {
      score += 10; // Neutral if no amenities specified
    }

    // Rating (15%)
    if (property.rating) {
      score += (property.rating / 5) * 15;
    }

    // Bedrooms match (10%)
    if (property.bedrooms === searchParams.bedrooms) {
      score += 10;
    } else if (property.bedrooms > searchParams.bedrooms) {
      score += 7; // Bonus rooms
    }

    return score;
  }

  /**
   * Format property options for user
   */
  private formatPropertyOptions(
    properties: PropertyDetails[],
    searchParams: PropertySearchParams
  ): string {
    const rentalTypeText =
      searchParams.rentalType === 'short_term' ? 'Short-term Rental' : 'Long-term Rental';

    let message = `🏠 *${rentalTypeText} Properties Found*\n\n`;

    properties.forEach((property, index) => {
      message += `*Option ${index + 1}*\n`;
      message += `📍 ${property.location.address}\n`;
      message += `🛏️ ${property.bedrooms} bedroom${property.bedrooms > 1 ? 's' : ''}, `;
      message += `🚿 ${property.bathrooms} bathroom${property.bathrooms > 1 ? 's' : ''}\n`;
      message += `💰 ${property.price.toLocaleString()} RWF/month\n`;

      if (property.distance) {
        message += `📏 ${property.distance.toFixed(1)}km away\n`;
      }

      if (property.rating) {
        message += `⭐ ${property.rating}/5 (${property.reviews} reviews)\n`;
      }

      message += `\n✨ *Amenities:* ${property.amenities.slice(0, 4).join(', ')}`;
      if (property.amenities.length > 4) {
        message += ` +${property.amenities.length - 4} more`;
      }
      message += '\n';

      message += `📝 ${property.description}\n`;
      message += `─────────────\n\n`;
    });

    message += '_Reply with option number (1, 2, or 3) for more details and owner contact_';

    return message;
  }

  /**
   * Extract search parameters from user input
   */
  private async extractSearchParams(input: AgentInput): Promise<PropertySearchParams> {
    const { message, metadata } = input;

    // Extract from metadata if available
    if (metadata?.searchParams) {
      return metadata.searchParams as PropertySearchParams;
    }

    // TODO: Use LLM to extract parameters from natural language
    // For now, return defaults that should be passed via metadata
    return {
      rentalType: 'long_term',
      bedrooms: 2,
      location: {
        latitude: metadata?.location?.latitude || -1.9536,
        longitude: metadata?.location?.longitude || 30.0606,
      },
    };
  }

  /**
   * Extract listing parameters from user input
   */
  private async extractListingParams(input: AgentInput): Promise<PropertyListingParams> {
    const { metadata } = input;

    if (!metadata?.listingParams) {
      throw new Error('Property listing parameters are required');
    }

    return metadata.listingParams as PropertyListingParams;
  }
}
