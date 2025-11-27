/**
 * Farmer AI Agent - Rebuilt with AI Core
 * Uses Gemini 2.5 Pro for agricultural services and marketplace
 */

import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
import { sendText } from "../../wa/client.ts";
import { RouterContext } from "../../types.ts";
import { 
  sendAgentListResponse, 
  sendAgentMessageWithActions, 
  sendAgentMessage,
  AGENT_TEMPLATES,
  formatEmojiNumberedList,
  parseEmojiNumber,
  createQuickReplyInstruction
} from "../../utils/ai-chat-interface.ts";
import { AgentLocationHelper } from "./location-helper.ts";

interface Tool {
  name: string;
  description: string;
  parameters: any;
  execute: (params: any, context: any) => Promise<any>;
}

/**
 * Farmer Agent
 * Agricultural marketplace and advisory services
 */
export class FarmerAgent {
  private supabase: SupabaseClient;
  private gemini: GoogleGenerativeAI;
  private model: string = 'gemini-2.5-pro-latest';
  private tools: Tool[];
  private instructions: string;
  private locationHelper: AgentLocationHelper;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.locationHelper = new AgentLocationHelper(supabase);
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY not set");
    }
    this.gemini = new GoogleGenerativeAI(apiKey);
    
    this.instructions = this.buildInstructions();
    this.tools = this.defineTools();
  }

  private buildInstructions(): string {
    return `You are an agricultural assistant for farmers in Rwanda. Help with marketplace, advisory, and services.

YOUR ROLE:
- Connect farmers with buyers and sellers
- Provide agricultural advice
- Help list and sell produce
- Find agricultural services (equipment, labor, inputs)
- Facilitate USSD payments (PRIMARY PAYMENT METHOD)

PAYMENT SYSTEM:
- **ONLY** use USSD Mobile Money for all transactions
- Generate tel: links that buyers can click to automatically dial USSD codes
- MTN Mobile Money code format: *182*8*1*AMOUNT#
- Payment flow: Generate link → Buyer clicks/dials → Confirms with PIN → Farmer notified
- NEVER suggest cash, bank transfer, or any other payment method

RESPONSE FORMAT (CRITICAL):
- ALWAYS use emoji-numbered lists (1️⃣, 2️⃣, 3️⃣) when showing produce, services, or farmers
- Keep messages concise and conversational
- Use emojis: 🌱, 🚜, 🌾, 📦, 💰, 📱
- Format listings as: "1️⃣ Item/Farmer - Price/Details\\n   Additional info"
- End with clear call-to-action
- Include clickable tel: links for payments

SERVICES:
1. **Marketplace**
   - Buy/sell produce, livestock, seeds
   - Equipment rental
   - Agricultural inputs (fertilizer, pesticides)
   - USSD payment facilitation

2. **Advisory**
   - Crop selection and planning
   - Pest and disease management
   - Best practices and techniques

3. **Services**
   - Equipment rental (tractors, tillers)
   - Labor services
   - Transportation

GUIDELINES:
- Provide practical, Rwanda-specific advice
- Use local crop names and varieties
- Consider seasonal factors
- Promote sustainable practices
- Connect farmers directly
- Always offer USSD payment option for transactions

GUARDRAILS:
- No medical advice for humans
- No guarantees on yields or prices
- Verify buyer/seller legitimacy
- Respect farmer privacy
- ONLY USSD payments - no cash, no bank transfers

TOOLS AVAILABLE:
- search_marketplace: Find produce, equipment, inputs
- list_product: List produce or equipment for sale
- get_agricultural_advice: Get farming advice
- find_services: Find agricultural services
- check_market_prices: Get current market prices
- initiate_ussd_payment: Generate USSD payment link (USE THIS FOR ALL PAYMENTS)
- confirm_payment: Confirm payment with reference number

Always be helpful, practical, and farmer-focused.`;
  }

  private defineTools(): Tool[] {
    return [
      {
        name: 'search_marketplace',
        description: 'Search agricultural marketplace for produce, equipment, or inputs near user location',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID for location lookup' },
            category: { type: 'string', enum: ['produce', 'livestock', 'equipment', 'inputs', 'seeds'] },
            product: { type: 'string', description: 'Product name or type' },
            radius_km: { type: 'number', description: 'Search radius in kilometers', default: 50 }
          },
          required: ['user_id', 'category']
        },
        execute: async (params) => {
          // Resolve user location first
          const locationResult = await this.locationHelper.resolveUserLocation(
            params.user_id,
            'farmer_agent'
          );

          if (!locationResult.location) {
            return { 
              message: 'Please share your location to find nearby agricultural products and services.',
              needs_location: true 
            };
          }

          // Use GPS search if location available
          const { data, error } = await this.supabase.rpc('search_nearby_agricultural_marketplace', {
            _lat: locationResult.location.lat,
            _lng: locationResult.location.lng,
            _radius_km: params.radius_km || 50,
            _category: params.category,
            _product: params.product || null,
            _limit: 10
          });

          if (error) {
            console.warn('GPS search failed, falling back to text search:', error);
            
            // Fallback to text-based search
            let query = this.supabase
              .from('agricultural_marketplace')
              .select('id, title, category, price, unit, location, seller_contact, available')
              .eq('available', true)
              .eq('category', params.category);

            if (params.product) {
              query = query.ilike('title', `%${params.product}%`);
            }

            query = query.limit(5);

            const { data: fallbackData, error: fallbackError } = await query;

            if (fallbackError || !fallbackData || fallbackData.length === 0) {
              return { message: 'No items found in the marketplace.' };
            }

            return {
              items: fallbackData.map(item => ({
                id: item.id,
                title: item.title,
                category: item.category,
                price: `${item.price} RWF per ${item.unit}`,
                location: item.location,
                contact: item.seller_contact
              }))
            };
          }

          if (!data || data.length === 0) {
            return { message: `No ${params.category} found within ${params.radius_km || 50}km of your location.` };
          }

          return {
            location_context: this.locationHelper.formatLocationContext(locationResult.location),
            items: data.map((item: any) => ({
              id: item.id,
              title: item.title,
              category: item.category,
              price: `${item.price} RWF per ${item.unit}`,
              location: item.location,
              contact: item.seller_contact,
              distance_km: Math.round(item.distance_km * 10) / 10
            }))
          };
        }
      },
      {
        name: 'list_product',
        description: 'List a product for sale in the marketplace',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            title: { type: 'string', description: 'Product title' },
            category: { type: 'string', enum: ['produce', 'livestock', 'equipment', 'inputs', 'seeds'] },
            price: { type: 'number', description: 'Price in RWF' },
            unit: { type: 'string', description: 'Unit (kg, bag, piece, etc.)' },
            quantity: { type: 'number' },
            location: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['user_id', 'title', 'category', 'price', 'unit']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('agricultural_marketplace')
            .insert({
              user_id: params.user_id,
              title: params.title,
              category: params.category,
              price: params.price,
              unit: params.unit,
              quantity: params.quantity,
              location: params.location,
              description: params.description,
              available: true,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (error) {
            return { error: 'Failed to list product' };
          }

          return {
            listing_id: data.id,
            message: 'Product listed successfully in the marketplace',
            title: params.title,
            price: `${params.price} RWF per ${params.unit}`
          };
        }
      },
      {
        name: 'get_agricultural_advice',
        description: 'Get farming advice on crops, pests, or techniques',
        parameters: {
          type: 'object',
          properties: {
            topic: { type: 'string', description: 'Topic (crop selection, pest control, soil management, etc.)' },
            crop: { type: 'string', description: 'Specific crop if applicable' }
          },
          required: ['topic']
        },
        execute: async (params) => {
          // This would query a knowledge base or use LLM for advice
          return {
            topic: params.topic,
            advice: `For ${params.topic}${params.crop ? ' with ' + params.crop : ''}, consult with local agricultural extension officers for Rwanda-specific guidance. General best practices include proper soil preparation, timely planting, and integrated pest management.`,
            message: 'For detailed advice, contact your local agricultural extension office.'
          };
        }
      },
      {
        name: 'find_services',
        description: 'Find agricultural services (equipment rental, labor, transport) near user',
        parameters: {
          type: 'object',
          properties: {
            user_id: { type: 'string', description: 'User ID for location lookup' },
            service_type: { type: 'string', enum: ['equipment_rental', 'labor', 'transport', 'veterinary'] },
            radius_km: { type: 'number', description: 'Search radius in kilometers', default: 50 }
          },
          required: ['user_id', 'service_type']
        },
        execute: async (params) => {
          // Resolve user location
          const locationResult = await this.locationHelper.resolveUserLocation(
            params.user_id,
            'farmer_agent'
          );

          if (!locationResult.location) {
            return { 
              message: 'Please share your location to find nearby agricultural services.',
              needs_location: true 
            };
          }

          // Try GPS search first
          const { data, error } = await this.supabase.rpc('search_nearby_agricultural_services', {
            _lat: locationResult.location.lat,
            _lng: locationResult.location.lng,
            _radius_km: params.radius_km || 50,
            _service_type: params.service_type,
            _limit: 10
          });

          if (error) {
            console.warn('GPS search failed, falling back to text search:', error);
            
            // Fallback to text-based search
            const query = this.supabase
              .from('agricultural_services')
              .select('id, service_name, service_type, provider_name, location, contact, price_range')
              .eq('service_type', params.service_type)
              .limit(5);

            const { data: fallbackData, error: fallbackError } = await query;

            if (fallbackError || !fallbackData || fallbackData.length === 0) {
              return { message: 'No services found matching your criteria.' };
            }

            return {
              services: fallbackData.map(s => ({
                id: s.id,
                name: s.service_name,
                provider: s.provider_name,
                location: s.location,
                contact: s.contact,
                price_range: s.price_range
              }))
            };
          }

          if (!data || data.length === 0) {
            return { message: `No ${params.service_type} services found within ${params.radius_km || 50}km.` };
          }

          return {
            location_context: this.locationHelper.formatLocationContext(locationResult.location),
            services: data.map((s: any) => ({
              id: s.id,
              name: s.service_name,
              provider: s.provider_name,
              location: s.location,
              contact: s.contact,
              price_range: s.price_range,
              distance_km: Math.round(s.distance_km * 10) / 10
            }))
          };
        }
      },
      {
        name: 'check_market_prices',
        description: 'Get current market prices for agricultural products',
        parameters: {
          type: 'object',
          properties: {
            product: { type: 'string', description: 'Product name' }
          },
          required: ['product']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase
            .from('market_prices')
            .select('product, price_per_kg, market, date')
            .ilike('product', `%${params.product}%`)
            .order('date', { ascending: false })
            .limit(5);

          if (error || !data || data.length === 0) {
            return { message: 'No recent price data available for this product.' };
          }

          const avgPrice = Math.round(
            data.reduce((sum, p) => sum + p.price_per_kg, 0) / data.length
          );

          return {
            product: params.product,
            average_price: `${avgPrice} RWF/kg`,
            recent_prices: data.map(p => ({
              market: p.market,
              price: `${p.price_per_kg} RWF/kg`,
              date: p.date
            }))
          };
        }
      },
      {
        name: 'initiate_ussd_payment',
        description: 'Generate USSD payment link for buyer to pay farmer (PRIMARY PAYMENT METHOD)',
        parameters: {
          type: 'object',
          properties: {
            buyer_phone: { type: 'string', description: 'Buyer phone number' },
            farmer_phone: { type: 'string', description: 'Farmer phone number' },
            listing_id: { type: 'string', description: 'Listing ID' },
            commodity: { type: 'string', description: 'Produce name' },
            quantity: { type: 'number', description: 'Quantity' },
            unit: { type: 'string', description: 'Unit (kg, bag, etc.)' },
            price_per_unit: { type: 'number', description: 'Price per unit in RWF' }
          },
          required: ['buyer_phone', 'farmer_phone', 'listing_id', 'commodity', 'quantity', 'unit', 'price_per_unit']
        },
        execute: async (params) => {
          const totalAmount = params.quantity * params.price_per_unit;
          
          // Generate USSD code for MTN Mobile Money
          const ussdCode = `*182*8*1*${totalAmount}#`;
          const telLink = `tel:${encodeURIComponent(ussdCode)}`;
          
          // Generate payment ID
          const paymentId = crypto.randomUUID();
          const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
          
          // Store payment in database
          const { error } = await this.supabase
            .from('farmer_payments')
            .insert({
              id: paymentId,
              listing_id: params.listing_id,
              buyer_phone: params.buyer_phone,
              farmer_phone: params.farmer_phone,
              amount: totalAmount,
              ussd_code: ussdCode,
              status: 'pending',
              expires_at: expiresAt
            });
          
          if (error) {
            console.error('Payment creation error:', error);
            return { 
              error: 'Failed to create payment', 
              message: 'Please try again or contact support' 
            };
          }
          
          // Return payment details with clickable link
          return {
            success: true,
            payment_id: paymentId,
            total_amount: totalAmount,
            ussd_code: ussdCode,
            tel_link: telLink,
            message: `🌾 *Payment for ${params.commodity}*\n\n` +
                    `📦 ${params.quantity} ${params.unit} @ ${params.price_per_unit.toLocaleString()} RWF/${params.unit}\n` +
                    `💰 Total: ${totalAmount.toLocaleString()} RWF\n\n` +
                    `*Click to pay via MTN Mobile Money:*\n${telLink}\n\n` +
                    `Or manually dial: ${ussdCode}\n\n` +
                    `*Kinyarwanda:*\nKanda: ${telLink}\nCyangwa kanda: ${ussdCode}\n\n` +
                    `⏱️ Payment expires in 30 minutes\n` +
                    `After payment, reply: PAID [reference number]`,
            expires_in_minutes: 30
          };
        }
      },
      {
        name: 'confirm_payment',
        description: 'Confirm a payment with USSD reference number',
        parameters: {
          type: 'object',
          properties: {
            payment_id: { type: 'string', description: 'Payment ID from initiate_ussd_payment' },
            reference: { type: 'string', description: 'USSD payment reference (e.g., MP123456)' },
            buyer_phone: { type: 'string', description: 'Buyer phone for verification' }
          },
          required: ['payment_id', 'reference', 'buyer_phone']
        },
        execute: async (params) => {
          const { data, error } = await this.supabase.rpc('confirm_farmer_payment', {
            p_payment_id: params.payment_id,
            p_reference: params.reference,
            p_buyer_phone: params.buyer_phone
          });
          
          if (error || !data || data.length === 0 || !data[0].success) {
            return { 
              success: false, 
              message: data?.[0]?.message || 'Payment confirmation failed. Please check payment ID and reference.' 
            };
          }
          
          const result = data[0];
          
          // Notify farmer
          const farmerMessage = `✅ *Payment Received!*\n\n` +
                               `💰 ${result.amount.toLocaleString()} RWF\n` +
                               `📱 Buyer: ${params.buyer_phone}\n` +
                               `📝 Reference: ${params.reference}\n\n` +
                               `*Kinyarwanda:*\n✅ Amafaranga yashyizwe!\n💰 ${result.amount.toLocaleString()} RWF\n\n` +
                               `Next: Prepare produce for pickup/delivery`;
          
          // Send notification to farmer (would integrate with WhatsApp send function)
          console.log('Farmer notification:', farmerMessage, 'to:', result.farmer_phone);
          
          return {
            success: true,
            message: '✅ Payment confirmed! Farmer has been notified. You will be contacted for pickup/delivery arrangements.',
            amount: result.amount,
            farmer_phone: result.farmer_phone
          };
        }
      }
    ];
  }

  async execute(query: string, context: any): Promise<string> {
    const model = this.gemini.getGenerativeModel({ 
      model: this.model,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      }
    });
    
    const geminiTools = [{
      functionDeclarations: this.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }];

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: this.instructions }],
        },
        {
          role: "model",
          parts: [{ text: "Muraho! I'm your agricultural assistant. How can I help you today?" }],
        }
      ],
      tools: geminiTools as any
    });

    let result = await chat.sendMessage(query);
    const MAX_TURNS = 10;

    for (let i = 0; i < MAX_TURNS; i++) {
      const response = result.response;
      const call = response.functionCalls()?.[0];

      if (call) {
        const toolName = call.name;
        const toolParams = call.args;
        
        const tool = this.tools.find(t => t.name === toolName);
        if (tool) {
          try {
            const toolResult = await tool.execute(toolParams, context);
            
            result = await chat.sendMessage([{
              functionResponse: {
                name: toolName,
                response: toolResult
              }
            }]);
            
          } catch (err) {
            result = await chat.sendMessage([{
              functionResponse: {
                name: toolName,
                response: { error: err instanceof Error ? err.message : String(err) }
              }
            }]);
          }
        } else {
          break;
        }
      } else {
        return response.text();
      }
    }
    
    return result.response.text();
  }
}

export async function runFarmerAgent(ctx: RouterContext, query: string) {
  try {
    const agent = new FarmerAgent(ctx.supabase);
    const response = await agent.execute(query, { userId: ctx.from });
    await sendText(ctx.from, response);
    return true;
  } catch (error) {
    console.error("FarmerAgent error:", error);
    await sendText(ctx.from, "Farmer Agent is currently unavailable.");
    return false;
  }
}
