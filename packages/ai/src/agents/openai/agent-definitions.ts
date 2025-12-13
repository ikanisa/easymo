/**
 * OpenAI Agent Definitions for EasyMO
 * 
 * Defines active agent configuration (Buy & Sell only)
 */

import type OpenAI from "openai";

import type { CreateAgentParams } from "./sdk-client";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const EASYMO_TOOLS: Record<string, OpenAI.Beta.FunctionTool> = {
  search_database: {
    type: "function",
    function: {
      name: "search_database",
      description: "Search the EasyMO database for records",
      parameters: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: ["businesses", "users", "orders"],
            description: "The table to search",
          },
          query: { type: "string", description: "Search query" },
          filters: {
            type: "object",
            description: "Optional filters",
            additionalProperties: true,
          },
          limit: { type: "number", description: "Max results", default: 10 },
        },
        required: ["table", "query"],
      },
    },
  },

  create_order: {
    type: "function",
    function: {
      name: "create_order",
      description: "Create a new order",
      parameters: {
        type: "object",
        properties: {
          customer_id: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                quantity: { type: "number" },
                price: { type: "number" },
              },
              required: ["product_id", "quantity"],
            },
          },
          delivery_address: { type: "string" },
          notes: { type: "string" },
        },
        required: ["customer_id", "items"],
      },
    },
  },

  process_payment: {
    type: "function",
    function: {
      name: "process_payment",
      description: "Process a MoMo payment",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", description: "Amount in RWF" },
          currency: { type: "string", enum: ["RWF"], default: "RWF" },
          phone: { type: "string", description: "Phone number in E.164 format" },
          reference: { type: "string", description: "Order or transaction reference" },
          description: { type: "string" },
        },
        required: ["amount", "phone", "reference"],
      },
    },
  },

  geocode_location: {
    type: "function",
    function: {
      name: "geocode_location",
      description: "Get coordinates for an address or place name",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Address or place name" },
          city: { type: "string", description: "City name" },
          country: { type: "string", default: "Rwanda" },
        },
        required: ["address"],
      },
    },
  },

  find_nearby_places: {
    type: "function",
    function: {
      name: "find_nearby_places",
      description: "Find nearby places using Google Maps",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Type of place (e.g., pharmacy, restaurant)" },
          latitude: { type: "number" },
          longitude: { type: "number" },
          radius: { type: "number", description: "Search radius in meters", default: 5000 },
        },
        required: ["query", "latitude", "longitude"],
      },
    },
  },

  send_notification: {
    type: "function",
    function: {
      name: "send_notification",
      description: "Send a WhatsApp notification",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Phone number" },
          template: { type: "string", description: "Template name" },
          variables: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
        required: ["to", "template"],
      },
    },
  },

  schedule_appointment: {
    type: "function",
    function: {
      name: "schedule_appointment",
      description: "Schedule an appointment or meeting",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["meeting", "pickup"] },
          datetime: { type: "string", format: "date-time" },
          location: { type: "string" },
          participants: {
            type: "array",
            items: { type: "string" },
          },
          notes: { type: "string" },
        },
        required: ["type", "datetime"],
      },
    },
  },

};

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

export const AGENT_DEFINITIONS: Record<string, CreateAgentParams> = {
  // --------------------------------------------------------------------------
  // BUY & SELL AGENT (THE ONLY AGENT)
  // --------------------------------------------------------------------------
  buy_and_sell: {
    name: "Buy & Sell AI Agent",
    description: "Marketplace and business discovery agent",
    instructions: `You are the Buy & Sell AI Agent for EasyMO, handling all marketplace and business services in Rwanda.

ROLE: Universal shopping and business assistant
LANGUAGES: English, French, Kinyarwanda
TONE: Helpful, efficient, practical

CAPABILITIES:
1. Search products across categories
2. Check inventory availability
3. Build shopping carts
4. Process orders and payments
5. Track delivery status
6. Connect with businesses and services
7. Facilitate business inquiries

CATEGORIES:
- Pharmacy (OTC only, no medical advice)
- Hardware (quincaillerie)
- Groceries and convenience
- General marketplace
- Business services and directory

FLOW:
1. Understand what user needs
2. Search available products or businesses
3. Show options with prices
4. Handle substitutions if OOS
5. Build and confirm cart
6. Process MoMo payment (RWF only)
7. Track until delivered or connected

GUARDRAILS:
- Pharmacy: No medical advice
- Hardware: Calculate delivery for >20kg
- Always offer substitution options
- Currency: RWF only
- NO legal or financial advice
- Verify business legitimacy
- PII minimization`,
    model: "gpt-4o",
    temperature: 0.6,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.create_order,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.geocode_location,
      EASYMO_TOOLS.find_nearby_places,
      EASYMO_TOOLS.send_notification,
      EASYMO_TOOLS.schedule_appointment,
      { type: "file_search" },
    ],
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getAgentDefinition(slug: string): CreateAgentParams | null {
  return AGENT_DEFINITIONS[slug] ?? null;
}

export function getAllAgentSlugs(): string[] {
  return Object.keys(AGENT_DEFINITIONS);
}

export function getToolsForAgent(slug: string): OpenAI.Beta.AssistantTool[] {
  const definition = AGENT_DEFINITIONS[slug];
  return definition?.tools ?? [];
}
