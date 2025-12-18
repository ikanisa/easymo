/**
 * Buy & Sell Agent Tool Definitions
 * 
 * Function declarations and tool configurations for Gemini AI agent:
 * - save_candidates - Save vendor candidates from search
 * - Google Search grounding
 * - Google Maps grounding
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

// =====================================================
// TOOL DEFINITIONS
// =====================================================

/**
 * Save candidates tool - Used by AI to save found vendors
 * Enhanced version with final_response_text for atomic save+response
 */
export const SAVE_CANDIDATES_DECLARATION = {
  name: "save_candidates",
  description: "Call this function when you have gathered vendor information. It saves the candidates and returns the final response. You MUST call this if you find any vendors. Aim to find up to 30 businesses total (combine Tier 1 vendors, Google Maps, and Google Search results).",
  parameters: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: "List of valid vendors found (up to 30 total). Combine Internal Partners (priority), Google Maps results (up to 15), and Google Search results (up to 5). Prioritize Tier 1 vendors first, then best matches from Google.",
        items: {
          type: "object",
          properties: {
            name: { 
              type: "string",
              description: "Business name"
            },
            phone: { 
              type: "string", 
              description: "Phone number in international format (e.g. +250...). CRITICAL: If missing, the vendor cannot be contacted." 
            },
            address: { 
              type: "string", 
              description: "Physical address or location description." 
            },
            google_maps_uri: { 
              type: "string", 
              description: "Link to Google Maps listing if available." 
            },
            place_id: { 
              type: "string", 
              description: "Google Place ID if available." 
            },
            source: { 
              type: "string", 
              enum: ["google_maps", "google_search", "internal_db"],
              description: "Where this vendor was found. Use 'internal_db' for Partners provided in the prompt." 
            },
            is_onboarded: { 
              type: "boolean", 
              description: "Set to TRUE ONLY if the vendor matches an entry in the 'Internal Partners' list provided in the prompt." 
            },
            score: { 
              type: "number", 
              description: "Relevance score from 0.0 to 1.0." 
            }
          },
          required: ["name", "source", "is_onboarded"]
        }
      },
      final_response_text: {
        type: "string",
        description: "The final message to the user. Summarize findings (e.g. 'I found 30 businesses that might help...'). Show a preview of top 5-10 businesses with names and addresses. Then ask: 'Should I contact them on your behalf? Reply YES to proceed.'"
      }
    },
    required: ["candidates", "final_response_text"]
  }
};

// =====================================================
// TOOL CONFIGURATIONS
// =====================================================

/**
 * Full sourcing tools configuration with grounding
 * Includes: save_candidates function + Google Search + Google Maps
 * Format: Array of tool objects (matches Gemini API format)
 */
export const SOURCING_TOOLS_CONFIG = [
  { googleSearch: {} },
  { googleMaps: {} },
  { functionDeclarations: [SAVE_CANDIDATES_DECLARATION] }
];

/**
 * Tool config for function calling
 */
export const SOURCING_TOOL_CONFIG = {
  functionCallingConfig: {
    mode: "ANY",
    allowedFunctionNames: ["save_candidates"]
  }
};

/**
 * Google Search tool only (for general queries)
 */
export const SEARCH_TOOL_CONFIG = {
  tools: [
    {
      googleSearch: {}
    }
  ]
};

/**
 * Google Maps tool only (for location-based queries)
 */
export const MAPS_TOOL_CONFIG = {
  tools: [
    {
      googleMaps: {
        dataProviders: ["PLACES"]
      }
    }
  ]
};

/**
 * Combined Search + Maps (without function calling)
 */
export const GROUNDING_TOOLS_CONFIG = {
  tools: [
    {
      googleSearch: {}
    },
    {
      googleMaps: {
        dataProviders: ["PLACES"]
      }
    }
  ]
};

// =====================================================
// TOOL EXECUTION HELPERS
// =====================================================

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Gemini response structure for parsing function calls
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        functionCall?: {
          name: string;
          args?: Record<string, unknown>;
        };
      }>;
    };
  }>;
}

/**
 * Parse function call results from Gemini response
 */
export function parseFunctionCalls(response: GeminiResponse): ToolCall[] {
  const functionCalls: ToolCall[] = [];
  
  const candidates = response.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        functionCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
      }
    }
  }

  return functionCalls;
}

/**
 * Build function response for multi-turn conversation
 */
export function buildFunctionResponse(
  functionName: string,
  result: unknown
): { functionResponse: { name: string; response: { result: unknown } } } {
  return {
    functionResponse: {
      name: functionName,
      response: {
        result
      }
    }
  };
}

/**
 * Execute a tool call (for save_candidates)
 */
export async function executeTool(
  toolCall: ToolCall,
  context: {
    supabase: { from: (table: string) => { insert: (data: unknown[]) => { select: () => Promise<{ data: unknown[]; error: unknown }> } } };
    correlationId?: string;
  }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (toolCall.name === "save_candidates") {
    return await executeSaveCandidates(toolCall.args, context);
  }

  return {
    success: false,
    error: `Unknown tool: ${toolCall.name}`,
  };
}

/**
 * Execute save_candidates tool
 * Returns both the saved candidates and the final_response_text for the user
 */
async function executeSaveCandidates(
  args: Record<string, unknown>,
  context: { supabase: { from: (table: string) => { insert: (data: unknown[]) => { select: () => Promise<{ data: unknown[]; error: unknown }> } } }; correlationId?: string }
): Promise<{ success: boolean; result?: unknown; error?: string; finalResponseText?: string }> {
  const { candidates, final_response_text, request_id } = args;

  if (!Array.isArray(candidates)) {
    return { success: false, error: "candidates must be an array" };
  }

  if (!final_response_text || typeof final_response_text !== "string") {
    return { success: false, error: "final_response_text is required" };
  }

  try {
    const candidateRecords = candidates.map((c: Record<string, unknown>, index: number) => ({
      request_id: request_id || null,
      name: c.name,
      phone: c.phone || null,
      address: c.address || null,
      place_id: c.place_id || null,
      google_maps_uri: c.google_maps_uri || null,
      source: c.source || "unknown",
      score: c.score || 0,
      is_onboarded: c.is_onboarded === true, // Explicit boolean check
      display_order: index, // Store display order for list presentation
    }));

    const { data, error } = await context.supabase
      .from("candidate_vendors")
      .insert(candidateRecords)
      .select();

    if (error) {
      return { success: false, error: String(error) };
    }

    return {
      success: true,
      result: {
        saved_count: (data as unknown[]).length,
        candidates: data,
      },
      finalResponseText: final_response_text as string,
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Failed to save candidates",
    };
  }
}

