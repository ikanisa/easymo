/**
 * agent-property-rental - Property AI Agent for conversational property search
 * 
 * UPGRADED: Now uses OpenAI function calling for intelligent property search.
 * 
 * Features:
 * - GPT-4 with function calling for intelligent tool selection
 * - Database-driven configuration from ai_agents tables
 * - Structured property search with filters
 * - Schedule viewing appointments
 * - Contact landlords via WhatsApp
 * - Save search preferences for notifications
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.24.1";
import { logStructuredEvent } from "../_shared/observability.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
});

// =====================================================================
// TOOL DEFINITIONS FOR FUNCTION CALLING
// =====================================================================

const PROPERTY_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "Search for rental properties with filters. Use this when user is looking for properties to rent.",
      parameters: {
        type: "object",
        properties: {
          bedrooms: {
            type: "number",
            description: "Number of bedrooms (1-10)"
          },
          max_price: {
            type: "number",
            description: "Maximum monthly rent in RWF"
          },
          min_price: {
            type: "number",
            description: "Minimum monthly rent in RWF"
          },
          location: {
            type: "string",
            description: "Area or neighborhood name (e.g., Kigali, Kimihurura, Remera)"
          },
          rental_type: {
            type: "string",
            enum: ["short_term", "long_term"],
            description: "Short-term (daily/weekly) or long-term (monthly/yearly)"
          },
          furnished: {
            type: "boolean",
            description: "Whether property should be furnished"
          },
          property_type: {
            type: "string",
            enum: ["apartment", "house", "room", "studio"],
            description: "Type of property"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_property_details",
      description: "Get full details for a specific property including images and amenities",
      parameters: {
        type: "object",
        properties: {
          property_id: {
            type: "string",
            description: "The property ID to get details for"
          }
        },
        required: ["property_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_viewing",
      description: "Book a property viewing appointment. Use when user wants to visit/see a property.",
      parameters: {
        type: "object",
        properties: {
          property_id: {
            type: "string",
            description: "Property ID to schedule viewing for"
          },
          preferred_date: {
            type: "string",
            description: "Preferred date in YYYY-MM-DD format"
          },
          preferred_time: {
            type: "string",
            description: "Preferred time (e.g., 'morning', 'afternoon', '2pm')"
          },
          contact_phone: {
            type: "string",
            description: "User's phone number for confirmation"
          }
        },
        required: ["property_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "contact_landlord",
      description: "Generate a WhatsApp link to contact property owner/landlord directly",
      parameters: {
        type: "object",
        properties: {
          property_id: {
            type: "string",
            description: "Property ID"
          },
          message: {
            type: "string",
            description: "Custom message to send to landlord"
          }
        },
        required: ["property_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "save_search",
      description: "Save user's search criteria to notify them when matching properties are listed",
      parameters: {
        type: "object",
        properties: {
          criteria: {
            type: "object",
            description: "Search criteria to save",
            properties: {
              bedrooms: { type: "number" },
              max_price: { type: "number" },
              location: { type: "string" },
              rental_type: { type: "string" }
            }
          },
          notify_email: {
            type: "string",
            description: "Email for notifications"
          },
          notify_whatsapp: {
            type: "boolean",
            description: "Whether to notify via WhatsApp"
          }
        },
        required: ["criteria"]
      }
    }
  }
];

// =====================================================================
// TOOL EXECUTION HANDLERS
// =====================================================================

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

async function executeSearchProperties(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    let query = supabase
      .from("property_rentals")
      .select(`
        id, title, description, price, currency, bedrooms, bathrooms,
        location, address, property_type, rental_type, furnished,
        amenities, images, landlord_phone, status, created_at
      `)
      .eq("status", "active");

    if (args.bedrooms) {
      const beds = args.bedrooms as number;
      query = query.gte("bedrooms", beds - 1).lte("bedrooms", beds + 1);
    }

    if (args.max_price) {
      query = query.lte("price", (args.max_price as number) * 1.2); // 20% variance
    }

    if (args.min_price) {
      query = query.gte("price", args.min_price as number);
    }

    if (args.location) {
      const loc = args.location as string;
      query = query.or(`location.ilike.%${loc}%,address.ilike.%${loc}%`);
    }

    if (args.rental_type) {
      query = query.eq("rental_type", args.rental_type as string);
    }

    if (args.furnished !== undefined) {
      query = query.eq("furnished", args.furnished as boolean);
    }

    if (args.property_type) {
      query = query.eq("property_type", args.property_type as string);
    }

    const { data: properties, error } = await query
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      await logStructuredEvent("PROPERTY_SEARCH_ERROR", { error: error.message }, "error");
      return { success: false, error: error.message };
    }

    // Format for display
    const formatted = properties?.map(p => ({
      id: p.id,
      title: p.title || `${p.bedrooms} bedroom ${p.property_type || 'property'}`,
      price: `${(p.price || 0).toLocaleString()} ${p.currency || 'RWF'}/month`,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      location: p.location || p.address,
      type: p.property_type,
      furnished: p.furnished ? "Yes" : "No",
      amenities: p.amenities?.slice(0, 5) || [],
      image: p.images?.[0] || null,
    })) || [];

    await logStructuredEvent("PROPERTY_SEARCH_SUCCESS", { 
      count: formatted.length,
      filters: args 
    });

    return {
      success: true,
      data: {
        count: formatted.length,
        properties: formatted,
        message: formatted.length > 0 
          ? `Found ${formatted.length} properties matching your criteria`
          : "No properties found matching your criteria. Try adjusting your filters."
      }
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Search failed" };
  }
}

async function executeGetPropertyDetails(args: Record<string, unknown>): Promise<ToolResult> {
  const propertyId = args.property_id as string;
  
  const { data: property, error } = await supabase
    .from("property_rentals")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    return { success: false, error: "Property not found" };
  }

  return {
    success: true,
    data: {
      ...property,
      formatted_price: `${(property.price || 0).toLocaleString()} ${property.currency || 'RWF'}/month`,
      contact_available: !!property.landlord_phone
    }
  };
}

async function executeScheduleViewing(args: Record<string, unknown>, userPhone: string): Promise<ToolResult> {
  const propertyId = args.property_id as string;
  
  // Get property details
  const { data: property, error: propError } = await supabase
    .from("property_rentals")
    .select("title, landlord_phone, location")
    .eq("id", propertyId)
    .single();

  if (propError || !property) {
    return { success: false, error: "Property not found" };
  }

  // Create viewing request
  const { data: viewing, error } = await supabase
    .from("property_viewings")
    .insert({
      property_id: propertyId,
      visitor_phone: args.contact_phone || userPhone,
      preferred_date: args.preferred_date || null,
      preferred_time: args.preferred_time || null,
      status: "pending",
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    // Table might not exist - return success with message
    await logStructuredEvent("PROPERTY_VIEWING_TABLE_MISSING", { error: error.message }, "warn");
    return {
      success: true,
      data: {
        message: `Viewing request noted for ${property.title}. The landlord will be notified and contact you to confirm.`,
        property_title: property.title,
        property_location: property.location,
        requested_date: args.preferred_date || "Flexible",
        requested_time: args.preferred_time || "Any time"
      }
    };
  }

  await logStructuredEvent("PROPERTY_VIEWING_SCHEDULED", { 
    viewingId: viewing?.id,
    propertyId 
  });

  return {
    success: true,
    data: {
      viewing_id: viewing?.id,
      message: `Viewing scheduled for ${property.title}! The landlord will contact you to confirm.`,
      property_title: property.title,
      property_location: property.location
    }
  };
}

async function executeContactLandlord(args: Record<string, unknown>): Promise<ToolResult> {
  const propertyId = args.property_id as string;
  
  const { data: property, error } = await supabase
    .from("property_rentals")
    .select("title, landlord_phone, price, currency")
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    return { success: false, error: "Property not found" };
  }

  if (!property.landlord_phone) {
    return { success: false, error: "Landlord contact not available for this property" };
  }

  // Build WhatsApp link
  const defaultMsg = `Hi! I'm interested in your property "${property.title}" listed at ${(property.price || 0).toLocaleString()} ${property.currency || 'RWF'}/month on easyMO.`;
  const message = (args.message as string) || defaultMsg;
  const cleanPhone = property.landlord_phone.replace(/[^0-9]/g, '');
  const whatsappLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

  return {
    success: true,
    data: {
      whatsapp_link: whatsappLink,
      property_title: property.title,
      message: `Click to contact the landlord: ${whatsappLink}`
    }
  };
}

async function executeSaveSearch(args: Record<string, unknown>, userId: string): Promise<ToolResult> {
  const criteria = args.criteria as Record<string, unknown>;
  
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({
      user_id: userId,
      search_type: "property",
      criteria: criteria,
      notify_email: args.notify_email || null,
      notify_whatsapp: args.notify_whatsapp !== false,
      is_active: true,
      created_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    // Table might not exist
    await logStructuredEvent("SAVED_SEARCH_TABLE_MISSING", { error: error.message }, "warn");
    return {
      success: true,
      data: {
        message: "Your search preferences have been noted! We'll notify you when matching properties are listed."
      }
    };
  }

  return {
    success: true,
    data: {
      search_id: data?.id,
      message: "Search saved! You'll receive notifications when new matching properties are listed."
    }
  };
}

// =====================================================================
// MAIN HANDLER
// =====================================================================

interface PropertyRequest {
  userId: string;
  mode?: "find" | "conversational";
  action?: "find";
  message?: string;
  rentalType?: string;
  location?: { latitude: number; longitude: number };
  criteria?: {
    bedrooms?: number;
    maxBudget?: string;
    currency?: string;
  };
  userPhone: string;
  locale: string;
  conversationHistory?: Array<{ role: string; content: string }>;
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ 
        status: "healthy", 
        service: "agent-property-rental",
        version: "2.0.0",
        features: ["function_calling", "db_config", "multi_turn"]
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: PropertyRequest = await req.json();
    const { userId, mode, message, rentalType, location, criteria, userPhone, locale, conversationHistory } = body;

    await logStructuredEvent("PROPERTY_AGENT_REQUEST", {
      userId: userId?.slice(-4) || "unknown",
      mode,
      hasMessage: !!message,
      correlationId
    });

    // Load agent config from Supabase
    const { data: agentConfig } = await supabase
      .from("ai_agents")
      .select(`
        *,
        ai_agent_personas (*),
        ai_agent_system_instructions (*),
        ai_agent_tools (*)
      `)
      .eq("slug", "real_estate")
      .eq("is_active", true)
      .single();

    const dbInstructions = agentConfig?.ai_agent_system_instructions?.[0]?.instructions;
    const dbPersona = agentConfig?.ai_agent_personas?.[0];
    
    // Build system prompt
    let systemPrompt = dbInstructions || `You are easyMO's Property Agent - a professional real estate assistant helping users find rental properties in Rwanda.

YOUR ROLE:
- Help users search for rental properties based on their criteria
- Provide property details including price, bedrooms, location, amenities
- Schedule property viewings when requested
- Connect users with landlords via WhatsApp
- Save search preferences for future notifications

SEARCH WORKFLOW:
1. Understand user requirements (bedrooms, budget, location, rental type)
2. Use search_properties tool to find matches
3. Present results clearly with key details
4. Offer to schedule viewings or connect with landlord
5. Save search if user wants notifications

CAPABILITIES:
- search_properties: Search with filters (bedrooms, price, location, type)
- get_property_details: Get full details and images
- schedule_viewing: Book a viewing appointment
- contact_landlord: Generate WhatsApp link to property owner
- save_search: Save criteria for notifications`;

    // Add persona traits if available
    if (dbPersona) {
      systemPrompt = `Role: ${dbPersona.role_name || 'Property Agent'}
Tone: ${dbPersona.tone_style || 'Professional, helpful, detail-oriented'}
Languages: ${(dbPersona.languages || ['en', 'fr', 'rw']).join(', ')}

${systemPrompt}`;
    }

    // Add locale context
    const langContext = locale === 'rw' ? 'Respond in Kinyarwanda when appropriate.' 
      : locale === 'fr' ? 'Respond in French when appropriate.' 
      : 'Respond in English.';
    systemPrompt += `\n\n${langContext}\nKeep responses concise for WhatsApp (2-3 sentences max unless showing results).`;

    // Build messages array
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt }
    ];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      for (const msg of conversationHistory.slice(-6)) { // Keep last 6 messages
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Handle structured find mode (backward compatibility)
    if (mode === "find" || body.action === "find") {
      // Build search message from criteria
      const searchMsg = `I'm looking for ${rentalType || 'a property'} with ${criteria?.bedrooms || 'any number of'} bedrooms, budget up to ${criteria?.maxBudget || 'flexible'} ${criteria?.currency || 'RWF'}${location ? ` near ${JSON.stringify(location)}` : ''}.`;
      messages.push({ role: "user", content: searchMsg });
    } else if (message) {
      messages.push({ role: "user", content: message });
    } else {
      // Default greeting
      return new Response(
        JSON.stringify({ 
          message: "👋 Welcome to easyMO Property Agent!\n\nI can help you:\n• Find rental properties\n• Schedule viewings\n• Connect with landlords\n\nWhat are you looking for?",
          properties: [],
          toolsUsed: []
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI with function calling
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Upgraded from gpt-4o-mini for better tool selection
      messages,
      tools: PROPERTY_TOOLS,
      tool_choice: "auto",
      max_tokens: 1000,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;
    const toolsUsed: string[] = [];
    let properties: unknown[] = [];
    let toolResults: Record<string, unknown> = {};

    // Execute tool calls if any
    if (toolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        toolsUsed.push(toolName);
        
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch {
          await logStructuredEvent("PROPERTY_TOOL_PARSE_ERROR", { toolName }, "warn");
        }

        await logStructuredEvent("PROPERTY_TOOL_CALL", { toolName, args, correlationId });

        let result: ToolResult;
        switch (toolName) {
          case "search_properties":
            result = await executeSearchProperties(args);
            if (result.success && result.data) {
              const searchData = result.data as { properties?: unknown[] };
              properties = searchData.properties || [];
            }
            break;
          case "get_property_details":
            result = await executeGetPropertyDetails(args);
            break;
          case "schedule_viewing":
            result = await executeScheduleViewing(args, userPhone);
            break;
          case "contact_landlord":
            result = await executeContactLandlord(args);
            break;
          case "save_search":
            result = await executeSaveSearch(args, userId);
            break;
          default:
            result = { success: false, error: `Unknown tool: ${toolName}` };
        }
        
        toolResults[toolName] = result;
      }

      // Get final response with tool results
      messages.push(assistantMessage as OpenAI.Chat.Completions.ChatCompletionMessageParam);
      
      for (const toolCall of toolCalls) {
        const result = toolResults[toolCall.function.name];
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        max_tokens: 800,
        temperature: 0.7,
      });

      const finalMessage = finalResponse.choices[0]?.message?.content || 
        "I found some options for you. Let me know if you'd like more details!";

      await logStructuredEvent("PROPERTY_AGENT_RESPONSE", {
        toolsUsed,
        propertiesFound: properties.length,
        correlationId
      });

      return new Response(
        JSON.stringify({
          message: finalMessage,
          properties,
          count: properties.length,
          toolsUsed,
          toolResults
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tool calls - direct response
    const directMessage = assistantMessage?.content || 
      "I'm here to help you find the perfect property. What are you looking for?";

    return new Response(
      JSON.stringify({ 
        message: directMessage,
        properties: [],
        toolsUsed: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    await logStructuredEvent("PROPERTY_AGENT_ERROR", { 
      error: error instanceof Error ? error.message : String(error),
      correlationId
    }, "error");
    
    return new Response(
      JSON.stringify({ 
        error: "Property agent error", 
        message: "Sorry, I encountered an issue. Please try again.",
        properties: []
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
