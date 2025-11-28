import { z } from "zod";

// Tool parameter schemas
export const GoogleMapsToolSchema = z.object({
  name: z.literal("google_maps"),
  parameters: z.object({
    action: z.enum([
      "nearby",
      "directions",
      "distance_matrix",
      "search",
      "geocode",
      "reverse_geocode",
    ]),
    location: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
    destination: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
    radius: z.number().optional(),
    type: z.string().optional(),
    query: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const SearchGroundingToolSchema = z.object({
  name: z.literal("search_grounding"),
  parameters: z.object({
    query: z.string(),
    action: z.enum(["search", "factual", "recent", "compare", "summarize"]).optional(),
    context: z.string().optional(),
  }),
});

export const DatabaseQueryToolSchema = z.object({
  name: z.literal("database_query"),
  parameters: z.object({
    table: z.string(),
    action: z.enum(["select", "count", "exists"]),
    where: z.record(z.any()).optional(),
    limit: z.number().optional(),
  }),
});

// Tool definitions for OpenAI function calling
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "google_maps",
      description: "Search for locations, get directions, or calculate distances using Google Maps",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["nearby", "directions", "distance_matrix", "search", "geocode", "reverse_geocode"],
            description: "The Maps action to perform",
          },
          location: {
            type: "object",
            properties: {
              lat: { type: "number", description: "Latitude" },
              lng: { type: "number", description: "Longitude" },
            },
            description: "Primary location (origin)",
          },
          destination: {
            type: "object",
            properties: {
              lat: { type: "number" },
              lng: { type: "number" },
            },
            description: "Destination location (for directions)",
          },
          radius: {
            type: "number",
            description: "Search radius in meters (for nearby search)",
          },
          type: {
            type: "string",
            description: "Place type (restaurant, hospital, etc.)",
          },
          query: {
            type: "string",
            description: "Search query text",
          },
          address: {
            type: "string",
            description: "Address to geocode",
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_grounding",
      description: "Search the web for current, factual information with citations",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query or question",
          },
          action: {
            type: "string",
            enum: ["search", "factual", "recent", "compare", "summarize"],
            description: "Type of grounded search to perform",
          },
          context: {
            type: "string",
            description: "Additional context for the search",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "database_query",
      description: "Query the database for driver, trip, or user information",
      parameters: {
        type: "object",
        properties: {
          table: {
            type: "string",
            enum: ["drivers", "trips", "users", "requests"],
            description: "Database table to query",
          },
          action: {
            type: "string",
            enum: ["select", "count", "exists"],
            description: "Query action",
          },
          where: {
            type: "object",
            description: "Filter conditions",
          },
          limit: {
            type: "number",
            description: "Maximum results",
          },
        },
        required: ["table", "action"],
      },
    },
  },
];

// Type inference
export type GoogleMapsTool = z.infer<typeof GoogleMapsToolSchema>;
export type SearchGroundingTool = z.infer<typeof SearchGroundingToolSchema>;
export type DatabaseQueryTool = z.infer<typeof DatabaseQueryToolSchema>;

export type Tool = GoogleMapsTool | SearchGroundingTool | DatabaseQueryTool;

// Tool registry
export class ToolRegistry {
  private tools: Map<string, z.ZodSchema> = new Map();

  constructor() {
    this.register("google_maps", GoogleMapsToolSchema);
    this.register("search_grounding", SearchGroundingToolSchema);
    this.register("database_query", DatabaseQueryToolSchema);
  }

  register(name: string, schema: z.ZodSchema) {
    this.tools.set(name, schema);
  }

  validate(toolCall: any): Tool {
    const schema = this.tools.get(toolCall.name);
    if (!schema) {
      throw new Error(`Unknown tool: ${toolCall.name}`);
    }
    return schema.parse(toolCall);
  }

  getDefinitions() {
    return TOOL_DEFINITIONS;
  }
}

export const toolRegistry = new ToolRegistry();
