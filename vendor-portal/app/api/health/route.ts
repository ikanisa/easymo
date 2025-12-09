import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET() {
  try {
    const supabase = await createClient();

    // Test database connection
    const { error } = await supabase
      .from("saccos")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "disconnected",
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
