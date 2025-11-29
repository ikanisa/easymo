import { generateFactualResponse, searchRecentInfo,searchWithGrounding } from "@/lib/ai/google/search-grounding";
import { calculateDistanceMatrix, findNearbyPlaces, geocodeAddress, getDirections, reverseGeocode,searchPlaceByText } from "@/lib/integrations/google-maps";

import type { DatabaseQueryTool,GoogleMapsTool, SearchGroundingTool } from "./registry";

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class ToolHandlers {
  async executeGoogleMaps(tool: GoogleMapsTool): Promise<ToolResult> {
    try {
      const { action, ...params } = tool.parameters;

      switch (action) {
        case "nearby":
          if (!params.location || !params.radius) {
            throw new Error("location and radius required for nearby search");
          }
          const nearbyResults = await findNearbyPlaces({
            location: params.location,
            radius: params.radius,
            type: params.type,
          });
          return { success: true, data: nearbyResults };

        case "directions":
          if (!params.location || !params.destination) {
            throw new Error("location and destination required for directions");
          }
          const directions = await getDirections({
            origin: params.location,
            destination: params.destination,
          });
          return { success: true, data: directions };

        case "distance_matrix":
          if (!params.location || !params.destination) {
            throw new Error("location and destination required for distance_matrix");
          }
          const matrix = await calculateDistanceMatrix({
            origins: [params.location],
            destinations: [params.destination],
          });
          return { success: true, data: matrix };

        case "search":
          if (!params.query) {
            throw new Error("query required for search");
          }
          const searchResults = await searchPlaceByText(params.query);
          return { success: true, data: searchResults };

        case "geocode":
          if (!params.address) {
            throw new Error("address required for geocode");
          }
          const geocoded = await geocodeAddress(params.address);
          return { success: true, data: geocoded };

        case "reverse_geocode":
          if (!params.location) {
            throw new Error("location required for reverse_geocode");
          }
          const reverseGeocoded = await reverseGeocode(params.location);
          return { success: true, data: reverseGeocoded };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async executeSearchGrounding(tool: SearchGroundingTool): Promise<ToolResult> {
    try {
      const { query, action, context } = tool.parameters;

      let result;
      switch (action) {
        case "factual":
          result = await generateFactualResponse(query, context);
          break;
        case "recent":
          result = await searchRecentInfo(query);
          break;
        default:
          result = await searchWithGrounding(query);
      }

      return {
        success: true,
        data: {
          text: result.text,
          sources: result.sources,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async executeDatabaseQuery(tool: DatabaseQueryTool): Promise<ToolResult> {
    try {
      // Placeholder for database queries
      // In production, this would use Supabase or Prisma
      return {
        success: true,
        data: {
          message: "Database query executed (placeholder)",
          table: tool.parameters.table,
          action: tool.parameters.action,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async execute(tool: any): Promise<ToolResult> {
    switch (tool.name) {
      case "google_maps":
        return this.executeGoogleMaps(tool);
      case "search_grounding":
        return this.executeSearchGrounding(tool);
      case "database_query":
        return this.executeDatabaseQuery(tool);
      default:
        return {
          success: false,
          error: `Unknown tool: ${tool.name}`,
        };
    }
  }
}

export const toolHandlers = new ToolHandlers();
