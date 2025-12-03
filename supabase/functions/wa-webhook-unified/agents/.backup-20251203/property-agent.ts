/**
 * Property Agent
 * 
 * Hybrid AI + structured flows for property rentals.
 * Combines conversational AI with multi-step structured processes.
 */

import { BaseAgent } from "./base-agent.ts";
import { AgentType, Tool, WhatsAppMessage, UnifiedSession, AgentResponse } from "../core/types.ts";

export class PropertyAgent extends BaseAgent {
  get type(): AgentType {
    return "property";
  }

  get keywords(): string[] {
    return [
      "property", "house", "apartment", "rent", "rental", "room", "studio",
      "estate", "landlord", "tenant", "lease", "bedroom", "flat"
    ];
  }

  get systemPrompt(): string {
    return `You are EasyMO Property Agent, helping with property rentals in Rwanda.

YOUR CAPABILITIES:
- Help tenants FIND rentals
- Help landlords LIST properties
- Manage property inquiries
- Provide rental advice

PROPERTY SEARCH FLOW:
- Ask for property type (apartment, house, studio, room)
- Ask for number of bedrooms
- Ask for budget/price range
- Ask for location preference
- Search and show matching properties

PROPERTY LISTING FLOW:
- Ask for property type
- Ask for number of bedrooms/bathrooms
- Ask for monthly rent
- Ask for location
- Ask for amenities
- Confirm and publish listing

RULES:
- Be helpful and professional
- Provide realistic price ranges
- Always confirm details before listing
- Respect privacy
- Use clear property descriptions

OUTPUT FORMAT (JSON):
{
  "response_text": "Your message",
  "intent": "find_property|list_property|inquire|view_listings|unclear",
  "extracted_entities": {
    "property_type": "string or null",
    "bedrooms": "number or null",
    "price_min": "number or null",
    "price_max": "number or null",
    "location": "string or null",
    "amenities": []
  },
  "next_action": "search_properties|list_property|send_inquiry|continue",
  "start_flow": "property_search|property_listing",
  "flow_complete": false
}`;
  }

  get tools(): Tool[] {
    return [
      {
        name: "search_properties",
        description: "Search for rental properties",
        parameters: {
          type: "object",
          properties: {
            property_type: { type: "string", description: "Type of property" },
            bedrooms: { type: "number", description: "Number of bedrooms" },
            price_max: { type: "number", description: "Maximum price" },
            location: { type: "string", description: "Location" },
          },
          required: [],
        },
      },
      {
        name: "create_property_listing",
        description: "Create a property listing",
        parameters: {
          type: "object",
          properties: {
            property_type: { type: "string", description: "Property type" },
            bedrooms: { type: "number", description: "Number of bedrooms" },
            bathrooms: { type: "number", description: "Number of bathrooms" },
            price: { type: "number", description: "Monthly rent" },
            location: { type: "string", description: "Location" },
            amenities: { type: "array", description: "Amenities" },
          },
          required: ["property_type", "bedrooms", "price", "location"],
        },
      },
    ];
  }

  protected async startFlow(flowName: string, session: UnifiedSession): Promise<AgentResponse> {
    session.flowStep = "start";
    
    switch (flowName) {
      case "property_search":
        return {
          text: "I'll help you find a place! 🏠\n\n" +
            "What type of property are you looking for?\n" +
            "• Apartment\n" +
            "• House\n" +
            "• Studio\n" +
            "• Room"
        };
      
      case "property_listing":
        return {
          text: "Let's list your property! 📝\n\n" +
            "What type of property is it?\n" +
            "(apartment, house, studio, or room)"
        };
      
      default:
        return { text: "How can I help you with property rentals?" };
    }
  }

  protected async continueFlow(
    message: WhatsAppMessage,
    session: UnifiedSession
  ): Promise<AgentResponse> {
    const flow = session.activeFlow!;
    const step = session.flowStep || "start";

    if (flow === "property_search") {
      return this.continuePropertySearch(message, session, step);
    } else if (flow === "property_listing") {
      return this.continuePropertyListing(message, session, step);
    }

    return { text: "Let me help you with that." };
  }

  private async continuePropertySearch(
    message: WhatsAppMessage,
    session: UnifiedSession,
    step: string
  ): Promise<AgentResponse> {
    const data = session.collectedData;

    if (step === "start") {
      data.property_type = message.body.toLowerCase();
      session.flowStep = "bedrooms";
      return {
        text: `Looking for ${message.body}. 👍\n\n` +
          "How many bedrooms?\n" +
          "(e.g., 1, 2, 3, or 'any')"
      };
    }

    if (step === "bedrooms") {
      const bedrooms = parseInt(message.body);
      if (!isNaN(bedrooms)) {
        data.bedrooms = bedrooms;
      }
      session.flowStep = "budget";
      return {
        text: "What's your monthly budget?\n" +
          "(e.g., '50000-100000' or just max amount)"
      };
    }

    if (step === "budget") {
      const rangeMatch = message.body.match(/(\d+)-(\d+)/);
      if (rangeMatch) {
        data.price_min = parseInt(rangeMatch[1]);
        data.price_max = parseInt(rangeMatch[2]);
      } else {
        const amount = parseInt(message.body.replace(/\D/g, ""));
        if (!isNaN(amount)) {
          data.price_max = amount;
        }
      }
      session.flowStep = "location";
      return {
        text: "Where would you like to live?\n" +
          "(e.g., Kigali, Kimironko, Remera)"
      };
    }

    if (step === "location") {
      data.location = message.body;
      
      // Search properties
      const properties = await this.searchProperties(data);

      session.activeFlow = undefined;
      session.flowStep = undefined;

      if (properties.length === 0) {
        return {
          text: "No properties found matching your criteria. 😔\n\n" +
            "Try adjusting your budget or location, or I can notify you when new properties are listed!"
        };
      }

      let text = `Found ${properties.length} properties! 🏠\n\n`;
      properties.forEach((prop: any, i: number) => {
        text += `${i + 1}. *${prop.attributes?.property_type || prop.title}*\n`;
        text += `   🛏️ ${prop.attributes?.bedrooms || 0} bed, ${prop.attributes?.bathrooms || 0} bath\n`;
        text += `   💰 ${prop.price} RWF/month\n`;
        text += `   📍 ${prop.location_text}\n`;
        text += `   ID: ${prop.id}\n\n`;
      });

      text += "Reply with property ID to inquire or ask me anything!";

      return { text };
    }

    return { text: "Let me help you with that." };
  }

  private async continuePropertyListing(
    message: WhatsAppMessage,
    session: UnifiedSession,
    step: string
  ): Promise<AgentResponse> {
    const data = session.collectedData;

    if (step === "start") {
      data.property_type = message.body.toLowerCase();
      session.flowStep = "bedrooms";
      return {
        text: `Property type: ${message.body} ✓\n\n` +
          "How many bedrooms?"
      };
    }

    if (step === "bedrooms") {
      data.bedrooms = parseInt(message.body);
      session.flowStep = "price";
      return {
        text: `${data.bedrooms} bedrooms ✓\n\n` +
          "What's the monthly rent? (in RWF)"
      };
    }

    if (step === "price") {
      data.price = parseInt(message.body.replace(/\D/g, ""));
      session.flowStep = "location";
      return {
        text: `Rent: ${data.price} RWF/month ✓\n\n` +
          "Where is the property located?"
      };
    }

    if (step === "location") {
      data.location = message.body;
      
      // Create listing
      const result = await this.createPropertyListing(session.userPhone, data);

      session.activeFlow = undefined;
      session.flowStep = undefined;
      session.collectedData = {};

      if (result.success) {
        return {
          text: "✅ *Property Listed Successfully!*\n\n" +
            `🏠 ${data.property_type}\n` +
            `🛏️ ${data.bedrooms} bedrooms\n` +
            `💰 ${data.price} RWF/month\n` +
            `📍 ${data.location}\n\n` +
            "Your property is now live and tenants can inquire!"
        };
      } else {
        return {
          text: "Sorry, there was an error listing your property. Please try again."
        };
      }
    }

    return { text: "Let me help you with that." };
  }

  protected async executeTool(toolName: string, parameters: Record<string, any>): Promise<any> {
    switch (toolName) {
      case "search_properties":
        return await this.searchProperties(parameters);
      case "create_property_listing":
        return await this.createPropertyListing(parameters.owner_phone, parameters);
      default:
        return null;
    }
  }

  private async searchProperties(params: Record<string, any>) {
    let query = this.supabase
      .from("unified_listings")
      .select("*")
      .eq("domain", "property")
      .eq("status", "active");

    if (params.property_type) {
      query = query.eq("attributes->>property_type", params.property_type);
    }
    if (params.bedrooms) {
      query = query.eq("attributes->>bedrooms", params.bedrooms.toString());
    }
    if (params.price_max) {
      query = query.lte("price", params.price_max);
    }
    if (params.location) {
      query = query.ilike("location_text", `%${params.location}%`);
    }

    const { data } = await query.limit(5);
    return data || [];
  }

  private async createPropertyListing(ownerPhone: string, data: Record<string, any>) {
    const { data: listing, error } = await this.supabase
      .from("unified_listings")
      .insert({
        owner_phone: ownerPhone,
        domain: "property",
        listing_type: "rental",
        title: `${data.bedrooms}-bedroom ${data.property_type}`,
        description: data.description,
        price: data.price,
        currency: "RWF",
        price_unit: "month",
        location_text: data.location,
        attributes: {
          property_type: data.property_type,
          bedrooms: data.bedrooms,
          bathrooms: data.bathrooms || 1,
          amenities: data.amenities || [],
        },
        status: "active",
        source_agent: "property",
      })
      .select("id")
      .single();

    return error ? { success: false } : { success: true, listingId: listing.id };
  }
}
