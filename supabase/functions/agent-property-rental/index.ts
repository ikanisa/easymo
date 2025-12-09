// agent-property-rental - Property AI Agent for conversational property search
// Upgraded to use OpenAI Responses API (Agents SDK compatible) with Gemini fallback,
// DB-driven persona/system prompts, and persisted conversation memory.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { DualAIProvider } from "../wa-agent-waiter/core/providers/dual-ai-provider.ts";
import { SessionManager } from "../wa-agent-waiter/core/session-manager.ts";
import {
  AgentConfigLoader,
  type AgentConfig,
} from "../_shared/agent-config-loader.ts";

interface PropertyRequest {
  userPhone: string;
  userId?: string;
  message?: string;
  mode?: "find" | "conversational";
  action?: "find";
  rentalType?: string;
  location?: { latitude: number; longitude: number };
  criteria?: {
    bedrooms?: number;
    maxBudget?: string;
    currency?: string;
  };
  locale?: string;
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

let aiProvider: DualAIProvider | null = null;
try {
  aiProvider = new DualAIProvider();
} catch (error) {
  console.error("Property agent AI provider not configured:", error);
}
const sessionManager = new SessionManager(supabase);
const configLoader = new AgentConfigLoader(supabase);

function defaultPrompt(locale: string | undefined): string {
  const language =
    locale === "rw" ? "Kinyarwanda" : locale === "fr" ? "French" : "English";
  return `You are easyMO's Property Rental Agent. Help users find rental properties and schedule viewings.

Always:
- Ask 1 clarifying question if details are missing (budget, bedrooms, location, timing)
- Provide 2-4 concise options when you have matches
- Offer to schedule a viewing or connect with the landlord
- Keep responses WhatsApp-friendly and respond in ${language}.`;
}

function buildPromptFromConfig(config: AgentConfig, fallback: string): string {
  const parts: string[] = [];

  if (config.persona) {
    parts.push(`Role: ${config.persona.role_name}`);
    parts.push(`Tone: ${config.persona.tone_style}`);
    if (config.persona.languages?.length) {
      parts.push(`Languages: ${config.persona.languages.join(", ")}`);
    }
    parts.push("");
  }

  if (config.systemInstructions?.instructions) {
    parts.push(config.systemInstructions.instructions);
  }

  if (config.systemInstructions?.guardrails) {
    parts.push("");
    parts.push("GUARDRAILS:");
    parts.push(config.systemInstructions.guardrails);
  }

  if (config.tools.length > 0) {
    parts.push("");
    parts.push("AVAILABLE TOOLS:");
    for (const tool of config.tools) {
      parts.push(`- ${tool.name}: ${tool.description}`);
    }
  }

  if (parts.length === 0) return fallback;
  return parts.join("\n");
}

async function getSystemPrompt(locale: string | undefined): Promise<string> {
  try {
    const config = await configLoader.loadAgentConfig("real_estate");
    return buildPromptFromConfig(config, defaultPrompt(locale));
  } catch {
    return defaultPrompt(locale);
  }
}

type ConversationHistory = Array<{ role: "user" | "assistant"; content: string }>;

function buildMessages(
  systemPrompt: string,
  context: string | null,
  history: ConversationHistory,
  userMessage: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  if (context) {
    messages.push({ role: "system", content: context });
  }

  for (const entry of history.slice(-8)) {
    messages.push({ role: entry.role, content: entry.content });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

async function searchProperties(
  rentalType?: string,
  criteria?: PropertyRequest["criteria"],
) {
  let query = supabase.from("property_rentals").select("*").eq("status", "active");

  if (rentalType) {
    query = query.eq("rental_type", rentalType);
  }

  if (criteria?.bedrooms) {
    query = query
      .gte("bedrooms", criteria.bedrooms - 1)
      .lte("bedrooms", criteria.bedrooms + 1);
  }

  if (criteria?.maxBudget) {
    const budget = parseInt(criteria.maxBudget);
    if (!Number.isNaN(budget)) {
      query = query.lte("price", budget * 1.2); // allow 20% variance
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(10);
  if (error) throw error;
  return data ?? [];
}

async function saveConversation(
  sessionId: string,
  context: Record<string, unknown>,
  history: ConversationHistory,
) {
  await supabase
    .from("ai_agent_sessions")
    .update({
      context: {
        ...context,
        conversationHistory: history.slice(-10),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "healthy", service: "agent-property-rental" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: PropertyRequest = await req.json();
    const {
      userPhone,
      userId,
      message,
      mode,
      rentalType,
      location,
      criteria,
      locale,
    } = body;

    if (!userPhone) {
      return new Response(
        JSON.stringify({ error: "missing_user", message: "userPhone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const session = await sessionManager.getOrCreate(userPhone);
    const systemPrompt = await getSystemPrompt(locale);
    if (!aiProvider) {
      return new Response(
        JSON.stringify({
          error: "ai_unavailable",
          message: "AI provider not configured. Please try again later.",
          properties: [],
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optional property search (for find mode)
    let properties: any[] = [];
    if (mode === "find" || body.action === "find") {
      properties = await searchProperties(rentalType, criteria);
    }

    const contextSummary =
      mode === "find" || body.action === "find"
        ? `User is searching for rentals. Criteria: rentalType=${rentalType ?? "any"}, bedrooms=${
            criteria?.bedrooms ?? "any"
          }, maxBudget=${criteria?.maxBudget ?? "flexible"} ${criteria?.currency ?? "RWF"}.
Found ${properties.length} candidate properties.${location ? ` Location: ${location.latitude},${location.longitude}.` : ""}`
        : null;

    const history = (session.context?.conversationHistory as ConversationHistory) || [];
    const userMessage =
      message ||
      "Help me find a property. Please ask any missing questions and then show me options.";

    const messages = buildMessages(systemPrompt, contextSummary, history, userMessage);

    const aiText = await aiProvider.chat(messages, {
      temperature: 0.6,
      maxTokens: 500,
      metadata: { agent: "property_rental" },
    });

    const updatedHistory: ConversationHistory = [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: aiText },
    ];
    await saveConversation(session.id, session.context || {}, updatedHistory);

    return new Response(
      JSON.stringify({
        message: aiText,
        properties,
        count: properties.length,
        agentType: "real_estate",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Property agent error:", error);
    return new Response(
      JSON.stringify({
        error: "Property agent error",
        message: "Sorry, I encountered an issue. Please try again.",
        properties: [],
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
