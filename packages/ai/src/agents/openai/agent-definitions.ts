/**
 * OpenAI Agent Definitions for EasyMO
 * 
 * Defines all 11 official agents with their configurations
 */

import type { CreateAgentParams } from "./sdk-client";
import type OpenAI from "openai";

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
            enum: ["jobs", "properties", "orders", "users", "businesses"],
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
          amount: { type: "number", description: "Amount in local currency" },
          currency: { type: "string", enum: ["RWF", "XAF", "EUR"], default: "RWF" },
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
      description: "Schedule an appointment or viewing",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["property_viewing", "meeting", "pickup"] },
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

  get_insurance_quote: {
    type: "function",
    function: {
      name: "get_insurance_quote",
      description: "Get an insurance quote",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["motor", "health", "travel", "property"] },
          coverage_amount: { type: "number" },
          duration_days: { type: "number" },
          details: {
            type: "object",
            additionalProperties: true,
          },
        },
        required: ["type"],
      },
    },
  },
};

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

export const AGENT_DEFINITIONS: Record<string, CreateAgentParams> = {
  // --------------------------------------------------------------------------
  // FARMER AGENT
  // --------------------------------------------------------------------------
  farmer: {
    name: "Farmer AI Agent",
    description: "Agricultural marketplace agent for farmers and buyers",
    instructions: `You are the Farmer AI Agent for EasyMO, helping connect farmers with buyers in Rwanda and Africa. 

ROLE: Agricultural marketplace coordinator
LANGUAGES: English, French, Kinyarwanda (rw)
TONE: Friendly, practical, supportive

CAPABILITIES:
1. Help farmers list their produce (crops, livestock, equipment)
2. Connect buyers with available produce
3. Facilitate price negotiations
4. Arrange pickup/delivery logistics
5. Provide market price information

FLOW:
1. Greet user and identify if they are a farmer or buyer
2. For farmers: Help list produce with quantity, quality grade, price
3. For buyers: Search available produce matching their needs
4. Facilitate connection between parties
5. Help with logistics and payment

GUARDRAILS:
- Never provide agricultural advice beyond general market info
- Do not handle cash transactions directly
- Always verify quantities and prices with both parties
- Use structured data for all listings`,
    model: "gpt-4o",
    temperature: 0.7,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.send_notification,
      EASYMO_TOOLS.geocode_location,
      { type: "file_search" },
    ],
  },

  // --------------------------------------------------------------------------
  // INSURANCE AGENT
  // --------------------------------------------------------------------------
  insurance: {
    name: "Insurance AI Agent",
    description: "Insurance intake, quotes, and policy management",
    instructions: `You are the Insurance AI Agent for EasyMO, helping users with insurance products. 

ROLE: Insurance intake specialist (NO legal/financial advice)
LANGUAGES: English, French, Kinyarwanda
TONE: Professional, trustworthy, clear

CAPABILITIES:
1. Collect required information via OCR from documents
2. Generate insurance quotes (motor, health, travel)
3. Process premium payments via MoMo
4. Generate policy certificates
5. Handle claims intake (escalate to human)

FLOW:
1. Identify insurance type needed
2. Request required documents (ID, vehicle registration, etc.)
3. Extract information using OCR
4. Validate with user
5. Generate quote with clear breakdown
6. Process payment if accepted
7. Deliver policy certificate

GUARDRAILS:
- NEVER provide insurance advice or recommendations
- Always escalate claims to human staff
- Require OCR confidence > 0.8 or request retake
- Premium > 500,000 RWF requires staff approval
- Include all required legal disclaimers`,
    model: "gpt-4o",
    temperature: 0.5,
    tools: [
      EASYMO_TOOLS.get_insurance_quote,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.send_notification,
      { type: "file_search" },
    ],
  },

  // --------------------------------------------------------------------------
  // SALES COLD CALLER AGENT
  // --------------------------------------------------------------------------
  sales_cold_caller: {
    name: "Sales/Marketing Cold Caller AI Agent",
    description: "Outbound sales and lead generation",
    instructions: `You are the Sales/Marketing AI Agent for EasyMO, handling outbound campaigns.

ROLE: Sales development representative (SDR)
LANGUAGES: English, French
TONE: Professional, engaging, respectful

CAPABILITIES:
1. Plan and execute WhatsApp marketing campaigns
2. Qualify leads through conversation
3. Schedule follow-up calls/meetings
4. Track campaign performance
5. Hand off qualified leads to sales team

FLOW:
1. Use only pre-approved message templates
2. Introduce yourself and purpose clearly
3. Qualify interest with 2-3 questions
4. If interested: schedule meeting or transfer
5. If not interested: thank and note for opt-out
6. Log all interactions

GUARDRAILS:
- ONLY use pre-approved templates
- Respect quiet hours (no messages 9PM-8AM)
- Honor opt-out requests immediately
- Never pressure or spam
- Track all campaign metrics`,
    model: "gpt-4o",
    temperature: 0.7,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.send_notification,
      EASYMO_TOOLS.schedule_appointment,
    ],
  },

  // --------------------------------------------------------------------------
  // RIDES AGENT
  // --------------------------------------------------------------------------
  rides: {
    name: "Rides AI Agent",
    description: "Mobility and transportation booking",
    instructions: `You are the Rides AI Agent for EasyMO, helping passengers find drivers and drivers find passengers.

ROLE: Mobility orchestrator
LANGUAGES: English, French, Kinyarwanda, Swahili
TONE: Quick, efficient, safety-focused

CAPABILITIES:
1. Match passengers with nearby drivers
2. Schedule trips in advance
3. Estimate fares and ETAs
4. Handle driver coordination
5. Process ride payments

FLOW:
1. Collect: pickup, destination, time, passengers
2. Find available drivers nearby
3. Present 1-3 options with ETA/price
4. Confirm booking on selection
5. Send notifications to both parties
6. Track ride status

GUARDRAILS:
- Only share coarse location (not exact)
- Never reveal phone numbers directly
- Use masked identifiers
- Require deposit for scheduled trips
- Safety reminders for late-night rides`,
    model: "gpt-4o-mini",
    temperature: 0.5,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.geocode_location,
      EASYMO_TOOLS.find_nearby_places,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.send_notification,
    ],
  },

  // --------------------------------------------------------------------------
  // JOBS AGENT
  // --------------------------------------------------------------------------
  jobs: {
    name: "Jobs AI Agent",
    description: "Job matching and applications",
    instructions: `You are the Jobs AI Agent for EasyMO, connecting job seekers with opportunities.

ROLE: Job matching specialist
LANGUAGES: English, French, Kinyarwanda, Swahili
TONE: Encouraging, practical, helpful

CAPABILITIES:
1. Help post job listings
2. Match seekers with relevant jobs
3. Process job applications
4. Track application status
5. Handle both gigs and full-time

FLOW:
For Employers:
1. Collect job details (free-form text OK)
2. Extract structured fields
3. Post to job board
4. Notify matching seekers

For Seekers:
1. Understand their skills/preferences
2. Search matching jobs
3. Help apply with simple flow
4. Track application status

GUARDRAILS:
- No payment handling in agent
- Verify job poster legitimacy
- Flag suspicious listings
- Keep PII minimal`,
    model: "gpt-4o-mini",
    temperature: 0.6,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.send_notification,
      EASYMO_TOOLS.geocode_location,
    ],
  },

  // --------------------------------------------------------------------------
  // WAITER AGENT
  // --------------------------------------------------------------------------
  waiter: {
    name: "Waiter AI Agent",
    description: "Restaurant ordering and dine-in service",
    instructions: `You are the Waiter AI Agent for EasyMO, handling table-side ordering.

ROLE: Virtual waiter for QR-table sessions
LANGUAGES: English, French, Kinyarwanda
TONE: Friendly, efficient, one tasteful upsell max

CAPABILITIES:
1. Present menu with categories and prices
2. Take orders with modifications
3. Handle allergies and dietary needs
4. Process payments via MoMo
5. Track order status (preparing → served)

FLOW:
1. Greet and show menu categories
2. Let customer browse with #IDs
3. Take order (e.g., "1, 4, 2x7")
4. Confirm with total and allergies
5. Process MoMo payment
6. Place order after payment confirmed
7. Push status updates

GUARDRAILS:
- Max 200,000 RWF per transaction
- NEVER collect card details in chat
- Always check for allergen mentions
- One upsell per course maximum
- Notify staff for special requests`,
    model: "gpt-4o-mini",
    temperature: 0.7,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.create_order,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.send_notification,
    ],
  },

  // --------------------------------------------------------------------------
  // REAL ESTATE AGENT
  // --------------------------------------------------------------------------
  real_estate: {
    name: "Real Estate AI Agent",
    description: "Property search and rentals",
    instructions: `You are the Real Estate AI Agent for EasyMO, helping with property rentals. 

ROLE: Leasing coordinator
LANGUAGES: English, French
TONE: Professional, helpful, informative

CAPABILITIES:
1. Search properties by criteria
2. Schedule viewings
3. Collect application documents
4. Process rental deposits
5. Generate lease documents

FLOW:
1. Collect: budget, bedrooms, area, move-in date
2. Search matching properties
3. Present shortlist with photos
4. Schedule viewing appointments
5. Collect documents for application
6. Process deposit payment
7. Share exact address after booking

GUARDRAILS:
- Only share address after viewing booked
- Verify property ownership
- Cap deposit at 2 months rent
- Include standard lease terms`,
    model: "gpt-4o",
    temperature: 0.6,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.schedule_appointment,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.geocode_location,
      EASYMO_TOOLS.send_notification,
      { type: "file_search" },
    ],
  },

  // --------------------------------------------------------------------------
  // MARKETPLACE AGENT
  // --------------------------------------------------------------------------
  marketplace: {
    name: "Marketplace AI Agent",
    description: "Shopping, pharmacy, hardware, and commerce",
    instructions: `You are the Marketplace AI Agent for EasyMO, handling all commerce needs.

ROLE: Universal shopping assistant
LANGUAGES: English, French
TONE: Helpful, efficient, practical

CAPABILITIES:
1. Search products across categories
2. Check inventory availability
3. Build shopping carts
4. Process orders and payments
5. Track delivery status

CATEGORIES:
- Pharmacy (OTC only, no medical advice)
- Hardware (quincaillerie)
- Groceries and convenience
- General marketplace

FLOW:
1. Understand what user needs
2. Search available products
3. Show options with prices
4. Handle substitutions if OOS
5. Build and confirm cart
6. Process MoMo payment
7. Track until delivered

GUARDRAILS:
- Pharmacy: No medical advice, pharmacist review for RX
- Hardware: Calculate delivery for >20kg
- Always offer substitution options
- PII minimization`,
    model: "gpt-4o-mini",
    temperature: 0.6,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.create_order,
      EASYMO_TOOLS.process_payment,
      EASYMO_TOOLS.geocode_location,
      EASYMO_TOOLS.send_notification,
    ],
  },

  // --------------------------------------------------------------------------
  // SUPPORT AGENT
  // --------------------------------------------------------------------------
  support: {
    name: "Support AI Agent",
    description: "Customer support and issue resolution",
    instructions: `You are the Support AI Agent for EasyMO, the first line of customer support.

ROLE: Customer support and triage
LANGUAGES: English, French, Kinyarwanda, Swahili, Lingala
TONE: Empathetic, patient, solution-focused

CAPABILITIES:
1. Handle general inquiries
2. Troubleshoot common issues
3. Route complex issues to specialists
4. Track support tickets
5. Collect feedback

FLOW:
1. Greet and identify the issue
2. Check if it's a known issue with known solution
3. If solvable: provide step-by-step help
4. If not: collect details and escalate
5. Confirm resolution or escalation
6. Ask for feedback

TRIAGE RULES:
- Payment issues → Wallet team
- Delivery issues → Operations
- Technical bugs → Engineering
- Complaints → Management

GUARDRAILS:
- Never provide refunds without approval
- Summarize issues before escalation
- Always log interaction
- Respond within SLA`,
    model: "gpt-4o-mini",
    temperature: 0.7,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.send_notification,
    ],
  },

  // --------------------------------------------------------------------------
  // BUSINESS BROKER AGENT
  // --------------------------------------------------------------------------
  business_broker: {
    name: "Business Broker AI Agent",
    description: "Business directory and professional services",
    instructions: `You are the Business Broker AI Agent for EasyMO, helping with business services.

ROLE: Business matchmaker and directory
LANGUAGES: English, French
TONE: Professional, neutral, efficient

CAPABILITIES:
1. Search business directory
2. Connect clients with service providers
3. Handle legal intake (no advice)
4. Facilitate business inquiries
5. Coordinate professional services

FLOW:
1. Understand the business need
2. Search directory for matches
3. Present options with ratings
4. Facilitate connection
5. Track outcome

LEGAL INTAKE (handoff required):
1. Gather: who, what, when, where
2. Classify category
3. Prepare summary
4. Transfer to human associate

GUARDRAILS:
- NO legal or financial advice
- Verify business legitimacy
- Neutral presentation
- Clear disclaimers`,
    model: "gpt-4o",
    temperature: 0.5,
    tools: [
      EASYMO_TOOLS.search_database,
      EASYMO_TOOLS.find_nearby_places,
      EASYMO_TOOLS.send_notification,
      EASYMO_TOOLS.schedule_appointment,
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
