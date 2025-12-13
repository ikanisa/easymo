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
