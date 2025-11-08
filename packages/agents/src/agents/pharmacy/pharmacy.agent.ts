/**
 * Pharmacy Agent
 * Finds nearby pharmacies and sources medications
 * Features: OCR for prescriptions, inventory checking, price comparison
 * SLA: 5 minutes, presents 3 options
 */

import { BaseAgent } from '../base/agent.base';
import type { AgentInput, AgentResult, AgentContext, Tool, VendorQuote } from '../../types/agent.types';
import OpenAI from 'openai';

interface PharmacyQuote extends VendorQuote {
  pharmacyId: string;
  pharmacyName: string;
  address: string;
  distance: number;
  medications: Array<{
    name: string;
    price: number;
    available: boolean;
    quantity?: number;
  }>;
  totalPrice: number;
  availabilityScore: number;
}

export class PharmacyAgent extends BaseAgent {
  name = 'pharmacy';
  
  instructions = `You are a pharmaceutical assistant for EasyMO.
Your role is to:
1. Process prescription images using OCR to extract medication names
2. Find nearby pharmacies with the requested medications
3. Check availability and prices at multiple pharmacies
4. Negotiate fair prices on behalf of customers
5. Present the top 3 pharmacy options within 5 minutes

IMPORTANT:
- Never provide medical advice
- Only provide availability and pricing information
- Ask for prescription images when needed
- Verify medication names carefully
- Warn about potential issues (e.g., out of stock, high prices)`;

  tools: Tool[] = [
    {
      name: 'extract_medications_from_image',
      description: 'Use OCR to extract medication names from prescription image',
      parameters: {
        type: 'object',
        properties: {
          image_url: { type: 'string' }
        },
        required: ['image_url']
      },
      execute: async (params, context) => {
        return await this.extractMedicationsFromImage(params.image_url);
      }
    },
    {
      name: 'find_nearby_pharmacies',
      description: 'Find pharmacies near a location',
      parameters: {
        type: 'object',
        properties: {
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          radius_km: { type: 'number', default: 5 }
        },
        required: ['latitude', 'longitude']
      },
      execute: async (params, context) => {
        return await this.findNearbyPharmacies(params);
      }
    },
    {
      name: 'check_medication_availability',
      description: 'Check if pharmacy has specific medications',
      parameters: {
        type: 'object',
        properties: {
          pharmacy_id: { type: 'string' },
          medications: { 
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['pharmacy_id', 'medications']
      },
      execute: async (params, context) => {
        return await this.checkMedicationAvailability(params);
      }
    },
    {
      name: 'negotiate_pharmacy_price',
      description: 'Negotiate price with pharmacy',
      parameters: {
        type: 'object',
        properties: {
          pharmacy_id: { type: 'string' },
          medications: { type: 'array' },
          total_price: { type: 'number' }
        },
        required: ['pharmacy_id', 'total_price']
      },
      execute: async (params, context) => {
        return await this.negotiatePrice(params);
      }
    }
  ];

  async execute(input: AgentInput): Promise<AgentResult> {
    const startTime = Date.now();
    
    // Create session with 5-minute deadline
    const session = this.createSession(input.userId, this.name, 5 * 60 * 1000);

    try {
      let medications: string[] = [];

      // Extract medications from image if provided
      if (input.image) {
        this.emit('message', {
          userId: input.userId,
          message: "📸 Analyzing your prescription image..."
        });

        medications = await this.extractMedicationsFromImage(input.image);
        
        if (medications.length === 0) {
          return {
            success: false,
            finalOutput: "I couldn't extract any medication names from the image. Could you please type the medication names or provide a clearer image?",
            toolsInvoked: ['extract_medications_from_image'],
            duration: Date.now() - startTime,
          };
        }

        // Confirm extracted medications with user
        this.emit('message', {
          userId: input.userId,
          message: `I found these medications:\n${medications.map((m, i) => `${i + 1}. ${m}`).join('\n')}\n\nIs this correct? Reply "yes" to continue or correct the list.`,
          requiresConfirmation: true
        });
      } else {
        // Parse medications from text query
        medications = await this.parseMedicationsFromText(input.query);
      }

      if (medications.length === 0) {
        return {
          success: false,
          finalOutput: "I need the names of the medications you're looking for. Could you please provide them?",
          toolsInvoked: [],
          duration: Date.now() - startTime,
        };
      }

      // Find nearby pharmacies
      const pharmacies = await this.findNearbyPharmacies({
        latitude: input.location?.latitude || 0,
        longitude: input.location?.longitude || 0,
        radius_km: 5
      });

      if (pharmacies.length === 0) {
        return {
          success: false,
          finalOutput: "No pharmacies found in your area. Would you like me to search with a wider radius?",
          toolsInvoked: ['find_nearby_pharmacies'],
          duration: Date.now() - startTime,
        };
      }

      // Check availability and get prices from each pharmacy
      const quotes: PharmacyQuote[] = [];
      
      for (const pharmacy of pharmacies.slice(0, 10)) {
        const availability = await this.checkMedicationAvailability({
          pharmacy_id: pharmacy.id,
          medications
        });

        if (availability.available_count > 0) {
          const totalPrice = availability.medications.reduce(
            (sum: number, med: any) => sum + (med.available ? med.price : 0),
            0
          );

          // Try to negotiate
          const negotiation = await this.negotiatePrice({
            pharmacy_id: pharmacy.id,
            medications: availability.medications,
            total_price: totalPrice
          });

          const quote: PharmacyQuote = {
            vendorId: pharmacy.id,
            vendorName: pharmacy.name,
            vendorType: 'pharmacy',
            pharmacyId: pharmacy.id,
            pharmacyName: pharmacy.name,
            address: pharmacy.address,
            distance: pharmacy.distance,
            medications: availability.medications,
            totalPrice: negotiation.final_price || totalPrice,
            availabilityScore: (availability.available_count / medications.length) * 100,
            offer: {
              price: negotiation.final_price || totalPrice,
              currency: 'RWF',
              notes: negotiation.notes
            },
            score: 0,
            timestamp: Date.now()
          };

          // Calculate score
          quote.score = this.calculateScore(quote, { medications });
          
          quotes.push(quote);
          this.addResult(session, quote);

          // Stop if we have 3 full matches
          if (quotes.length >= 3 && quote.availabilityScore === 100) {
            break;
          }
        }
      }

      // Sort by score
      quotes.sort((a, b) => b.score - a.score);

      if (quotes.length === 0) {
        return {
          success: false,
          finalOutput: "Unfortunately, none of the nearby pharmacies have the medications you're looking for. Would you like me to search in a wider area?",
          toolsInvoked: ['find_nearby_pharmacies', 'check_medication_availability'],
          duration: Date.now() - startTime,
        };
      }

      // Complete session
      this.completeSession(session);

      return {
        success: true,
        finalOutput: this.formatOptions(quotes.slice(0, 3)),
        data: {
          quotes,
          medications,
          sessionId: session.id
        },
        toolsInvoked: [
          input.image ? 'extract_medications_from_image' : null,
          'find_nearby_pharmacies',
          'check_medication_availability',
          'negotiate_pharmacy_price'
        ].filter(Boolean) as string[],
        duration: Date.now() - startTime,
        options: quotes,
        requiresConfirmation: true
      };

    } catch (error) {
      console.error('PharmacyAgent error:', error);
      return {
        success: false,
        finalOutput: "I encountered an error while searching for medications. Please try again.",
        toolsInvoked: [],
        duration: Date.now() - startTime,
      };
    }
  }

  private async extractMedicationsFromImage(imageUrl: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all medication names from this prescription image. Return ONLY a JSON array of medication names, nothing else. Example: ["Paracetamol", "Amoxicillin"]'
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const content = response.choices[0].message.content || '[]';
      const medications = JSON.parse(content);
      return Array.isArray(medications) ? medications : [];
      
    } catch (error) {
      console.error('OCR error:', error);
      return [];
    }
  }

  private async parseMedicationsFromText(query: string): Promise<string[]> {
    // Simple parsing - extract words that look like medication names
    const words = query.split(/[\s,;]+/);
    const medications = words.filter(word => 
      word.length > 3 && /^[A-Za-z]+$/.test(word)
    );
    return medications;
  }

  private async findNearbyPharmacies(params: any): Promise<any[]> {
    // TODO: Query Supabase for nearby pharmacies
    // Mock data for now
    return [
      {
        id: 'pharmacy-1',
        name: 'Pharmacie de la Paix',
        address: 'KN 5 Ave, Kigali',
        distance: 1.2,
        rating: 4.7,
        opening_hours: '08:00-20:00'
      },
      {
        id: 'pharmacy-2',
        name: 'Pharmacie du Centre',
        address: 'KG 7 Ave, Kigali',
        distance: 2.5,
        rating: 4.5,
        opening_hours: '08:00-22:00'
      },
      {
        id: 'pharmacy-3',
        name: 'Pharmacie Moderne',
        address: 'KN 10 St, Kigali',
        distance: 3.1,
        rating: 4.8,
        opening_hours: '24/7'
      }
    ];
  }

  private async checkMedicationAvailability(params: any): Promise<any> {
    // TODO: Query pharmacy inventory
    // Mock data for now
    const medications = params.medications.map((med: string) => ({
      name: med,
      available: Math.random() > 0.3,
      price: Math.round(Math.random() * 5000 + 1000),
      quantity: Math.floor(Math.random() * 50 + 10)
    }));

    return {
      pharmacy_id: params.pharmacy_id,
      medications,
      available_count: medications.filter((m: any) => m.available).length,
      total_count: medications.length
    };
  }

  private async negotiatePrice(params: any): Promise<any> {
    // TODO: Implement actual negotiation via WhatsApp
    // For now, simulate negotiation
    const discount = Math.random() * 0.1; // 0-10% discount
    
    return {
      accepted: true,
      final_price: Math.round(params.total_price * (1 - discount)),
      notes: discount > 0.05 ? `${Math.round(discount * 100)}% discount applied` : 'Standard price'
    };
  }

  protected formatSingleOption(option: PharmacyQuote): string {
    let formatted = `🏥 Pharmacy: ${option.pharmacyName}\n`;
    formatted += `📍 Address: ${option.address}\n`;
    formatted += `📏 Distance: ${option.distance.toFixed(1)}km\n`;
    formatted += `📊 Availability: ${Math.round(option.availabilityScore)}%\n\n`;
    
    formatted += `💊 *Medications:*\n`;
    option.medications.forEach(med => {
      if (med.available) {
        formatted += `  ✅ ${med.name} - ${med.price} RWF\n`;
      } else {
        formatted += `  ❌ ${med.name} - Out of stock\n`;
      }
    });
    
    formatted += `\n💰 *Total: ${option.totalPrice} RWF*\n`;
    if (option.offer.notes) {
      formatted += `📝 ${option.offer.notes}\n`;
    }
    
    return formatted;
  }

  protected calculateScore(option: PharmacyQuote, criteria: any): number {
    let score = 0;

    // Availability (50%) - most important
    score += option.availabilityScore * 0.5;

    // Price (30%) - lower is better
    const avgPrice = 10000; // Assume average medication cost
    const priceScore = Math.max(0, 30 - ((option.totalPrice - avgPrice) / avgPrice) * 30);
    score += priceScore;

    // Distance (20%) - closer is better
    const distanceScore = Math.max(0, 20 - (option.distance / 5) * 20);
    score += distanceScore;

    return Math.round(score);
  }
}
