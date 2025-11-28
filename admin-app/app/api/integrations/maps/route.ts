import { NextRequest, NextResponse } from "next/server";
import {
  findNearbyPlaces,
  getDirections,
  calculateDistanceMatrix,
  searchPlaceByText,
  getPlaceDetails,
  geocodeAddress,
  reverseGeocode,
  type Location,
} from "@/lib/integrations/google-maps";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case "nearby":
        result = await findNearbyPlaces(params);
        break;

      case "directions":
        result = await getDirections(params);
        break;

      case "distance_matrix":
        result = await calculateDistanceMatrix(params);
        break;

      case "search":
        if (!params.query) {
          return NextResponse.json(
            { error: "query is required for search action" },
            { status: 400 }
          );
        }
        result = await searchPlaceByText(params.query);
        break;

      case "place_details":
        if (!params.placeId) {
          return NextResponse.json(
            { error: "placeId is required for place_details action" },
            { status: 400 }
          );
        }
        result = await getPlaceDetails(params.placeId);
        break;

      case "geocode":
        if (!params.address) {
          return NextResponse.json(
            { error: "address is required for geocode action" },
            { status: 400 }
          );
        }
        result = await geocodeAddress(params.address);
        break;

      case "reverse_geocode":
        if (!params.location) {
          return NextResponse.json(
            { error: "location is required for reverse_geocode action" },
            { status: 400 }
          );
        }
        result = await reverseGeocode(params.location as Location);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      action,
      data: result,
    });
  } catch (error) {
    console.error("Google Maps API error:", error);
    const err = error as Error;

    if (err.message.includes("not configured")) {
      return NextResponse.json(
        {
          error: "Google Maps API key not configured",
          details: "Please set GOOGLE_MAPS_API_KEY environment variable",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Google Maps API request failed",
        details: err.message,
      },
      { status: 500 }
    );
  }
}
