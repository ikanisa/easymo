// agent-property-rental - Property AI Agent for conversational property search
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.24.1";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY") ?? "",
});

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
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "healthy", service: "agent-property-rental" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: PropertyRequest = await req.json();
    const { userId, mode, message, rentalType, location, criteria, userPhone, locale } = body;

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

    const systemInstruction = agentConfig?.ai_agent_system_instructions?.[0]?.instructions || 
      `You are easyMO's Property Agent. You help users find rental properties in their area.
      
      Be helpful, concise, and always provide specific property recommendations when possible.
      
      When users describe what they're looking for, search available properties and provide matches.
      If no exact matches exist, suggest alternatives.
      
      Always be friendly and professional in ${locale === 'rw' ? 'Kinyarwanda' : locale === 'fr' ? 'French' : 'English'}.`;

    // Conversational mode - chat with AI
    if (mode === "conversational" && message) {
      const chatResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
      });

      const responseMessage = chatResponse.choices[0]?.message?.content || 
        "I'm here to help you find the perfect property. What are you looking for?";

      return new Response(
        JSON.stringify({ 
          message: responseMessage,
          properties: [] 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find mode - structured property search
    if (mode === "find" || body.action === "find") {
      // Search for matching properties
      let query = supabase
        .from("property_rentals")
        .select("*")
        .eq("status", "active");

      if (rentalType) {
        query = query.eq("rental_type", rentalType);
      }

      if (criteria?.bedrooms) {
        query = query.gte("bedrooms", criteria.bedrooms - 1)
          .lte("bedrooms", criteria.bedrooms + 1);
      }

      if (criteria?.maxBudget) {
        const budget = parseInt(criteria.maxBudget);
        query = query.lte("price", budget * 1.2); // 20% variance
      }

      const { data: properties, error } = await query
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.error("Property search error:", error);
      }

      // Generate AI response about results
      const resultsPrompt = properties?.length
        ? `Found ${properties.length} properties matching the criteria. Summarize briefly for WhatsApp.`
        : "No exact matches found. Suggest user to try different criteria or check back later.";

      const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { 
            role: "user", 
            content: `User is looking for ${rentalType || 'a property'} with ${criteria?.bedrooms || 'any number of'} bedrooms, budget ${criteria?.maxBudget || 'flexible'} ${criteria?.currency || 'RWF'}. ${resultsPrompt}`
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      return new Response(
        JSON.stringify({
          message: summaryResponse.choices[0]?.message?.content || "Search complete!",
          properties: properties || [],
          count: properties?.length || 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default response
    return new Response(
      JSON.stringify({ 
        message: "Welcome to easyMO Property Agent! Tell me what you're looking for.",
        properties: []
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Property agent error:", error);
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
