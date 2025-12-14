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
 */
export const SAVE_CANDIDATES_DECLARATION = {
  name: "save_candidates",
  description: "Save a list of candidate vendors for a sourcing request. Use this when you've found relevant businesses through search or maps.",
  parameters: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: "List of candidate vendors to save",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Business name"
            },
            phone: {
              type: "string",
              description: "Contact phone number (if available)"
            },
            address: {
              type: "string",
              description: "Physical address"
            },
            place_id: {
              type: "string",
              description: "Google Maps Place ID (if from maps search)"
            },
            source: {
              type: "string",
              description: "Source of the candidate (google_search, google_maps, or existing_vendor)"
            },
            score: {
              type: "number",
              description: "Relevance score (0-1)"
            }
          },
          required: ["name", "source"]
        }
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of why these candidates were selected"
      }
    },
    required: ["candidates"]
  }
};

// =====================================================
// TOOL CONFIGURATIONS
// =====================================================

/**
 * Full sourcing tools configuration with grounding
 * Includes: save_candidates function + Google Search + Google Maps
 */
export const SOURCING_TOOLS_CONFIG = {
  tools: [
    {
      functionDeclarations: [SAVE_CANDIDATES_DECLARATION]
    },
    {
      googleSearch: {}
    },
    {
      googleMaps: {
        dataProviders: ["PLACES"]
      }
    }
  ],
  toolConfig: {
    functionCallingConfig: {
      mode: "ANY",
      allowedFunctionNames: ["save_candidates"]
    }
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
 * Parse function call results from Gemini response
 */
export function parseFunctionCalls(response: unknown): ToolCall[] {
  const functionCalls: ToolCall[] = [];
  
  // Handle the response structure
  const resp = response as { candidates?: Array<{ content?: { parts?: Array<{ functionCall?: { name: string; args?: Record<string, unknown> } }> } }> };
  const candidates = resp.candidates || [];

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
 */
async function executeSaveCandidates(
  args: Record<string, unknown>,
  context: { supabase: { from: (table: string) => { insert: (data: unknown[]) => { select: () => Promise<{ data: unknown[]; error: unknown }> } } }; correlationId?: string }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { candidates, request_id } = args;

  if (!Array.isArray(candidates)) {
    return { success: false, error: "candidates must be an array" };
  }

  try {
    const candidateRecords = candidates.map((c: Record<string, unknown>) => ({
      request_id: request_id || null,
      name: c.name,
      phone: c.phone || null,
      address: c.address || null,
      place_id: c.place_id || null,
      source: c.source || "unknown",
      score: c.score || 0,
      is_onboarded: false,
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
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message || "Failed to save candidates",
    };
  }
}

// =====================================================
// LEGACY EXPORTS (for backward compatibility)
// =====================================================

/** @deprecated Use SOURCING_TOOLS_CONFIG instead */
export const SAVE_CANDIDATES_TOOL = {
  functionDeclarations: [SAVE_CANDIDATES_DECLARATION]
};

/** @deprecated Use SEARCH_TOOL_CONFIG instead */
export const GOOGLE_SEARCH_TOOL = {
  googleSearch: {
    dynamicRetrievalConfig: {
      mode: "MODE_DYNAMIC",
      dynamicThreshold: 0.7,
    },
  },
};

/** @deprecated Use MAPS_TOOL_CONFIG instead */
export const GOOGLE_MAPS_TOOL = {
  googleMaps: {},
};
