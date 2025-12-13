/**
 * Tool definitions for Buy & Sell agent
 * 
 * Provides tool configurations for:
 * - Candidate vendor management (save_candidates)
 * - Sourcing with Google Search and Maps
 */

/**
 * Function declaration for saving candidate vendors
 */
export const SAVE_CANDIDATES_TOOL = {
  name: "save_candidates",
  description: "Save a list of candidate vendors found during sourcing. Use this when you've found businesses that match the user's need.",
  parameters: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        description: "List of candidate vendors",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Business name",
            },
            phone: {
              type: "string",
              description: "Phone number (optional)",
            },
            address: {
              type: "string",
              description: "Business address",
            },
            place_id: {
              type: "string",
              description: "Google Maps Place ID (optional)",
            },
            source: {
              type: "string",
              enum: ["google_maps", "google_search", "database"],
              description: "Where this candidate was found",
            },
            score: {
              type: "number",
              description: "Relevance score (0-100)",
            },
          },
          required: ["name", "address", "source", "score"],
        },
      },
      request_id: {
        type: "string",
        description: "Sourcing request ID",
      },
    },
    required: ["candidates", "request_id"],
  },
};

/**
 * Sourcing tools configuration for Gemini
 */
export const SOURCING_TOOLS_CONFIG = [
  {
    googleSearch: {},
  },
  {
    googleMaps: {},
  },
  {
    functionDeclarations: [SAVE_CANDIDATES_TOOL],
  },
];

/**
 * Tool executor interface
 */
export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

/**
 * Execute a tool call
 */
export async function executeTool(
  toolCall: ToolCall,
  context: {
    supabase: unknown;
    correlationId?: string;
  }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  if (toolCall.name === "save_candidates") {
    return await saveCandidates(toolCall.parameters, context);
  }

  return {
    success: false,
    error: `Unknown tool: ${toolCall.name}`,
  };
}

/**
 * Save candidate vendors to database
 */
async function saveCandidates(
  params: Record<string, unknown>,
  context: { supabase: any; correlationId?: string }
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const { candidates, request_id } = params;

  if (!Array.isArray(candidates)) {
    return { success: false, error: "candidates must be an array" };
  }

  if (!request_id) {
    return { success: false, error: "request_id is required" };
  }

  try {
    const candidateRecords = candidates.map((c: any) => ({
      request_id,
      name: c.name,
      phone: c.phone || null,
      address: c.address,
      place_id: c.place_id || null,
      source: c.source,
      score: c.score || 0,
      is_onboarded: false,
    }));

    const { data, error } = await context.supabase
      .from("candidate_vendors")
      .insert(candidateRecords)
      .select();

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      result: {
        saved_count: data.length,
        candidates: data,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || "Failed to save candidates",
    };
  }
}

/**
 * Google Search tool configuration
 */
export const GOOGLE_SEARCH_TOOL = {
  googleSearch: {
    dynamicRetrievalConfig: {
      mode: "MODE_DYNAMIC",
      dynamicThreshold: 0.7,
    },
  },
};

/**
 * Google Maps tool configuration
 */
export const GOOGLE_MAPS_TOOL = {
  googleMaps: {},
};
 * Buy & Sell Agent Tool Definitions
 * 
 * Function declarations and tool configurations for Gemini AI agent:
 * - save_candidates - Save vendor candidates from search
 * - Google Search grounding
 * - Google Maps grounding
 * 
 * @see docs/GROUND_RULES.md for observability requirements
 */

// Save candidates tool definition
export const SAVE_CANDIDATES_TOOL = {
  functionDeclarations: [
    {
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
    }
  ]
};

// Sourcing tools configuration with grounding
export const SOURCING_TOOLS_CONFIG = {
  tools: [
    SAVE_CANDIDATES_TOOL,
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

// Google Search tool only (for general queries)
export const SEARCH_TOOL_CONFIG = {
  tools: [
    {
      googleSearch: {}
    }
  ]
};

// Google Maps tool only (for location-based queries)
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
 * Parse function call results from Gemini response
 */
export function parseFunctionCalls(response: any): Array<{
  name: string;
  args: Record<string, any>;
}> {
  const candidates = response.candidates || [];
  const functionCalls: Array<{ name: string; args: Record<string, any> }> = [];

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
  result: any
): any {
  return {
    functionResponse: {
      name: functionName,
      response: {
        result
      }
    }
  };
}
