import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const mockTools = [
  {
    id: "mock-web-search",
    name: "WebSearch",
    description: "Search the public web for insurance policy answers.",
    enabled: true,
    parameters: { query: "string", maxResults: 5 },
    metadata: { category: "search" },
    created_at: new Date(2024, 0, 1).toISOString(),
    updated_at: new Date(2024, 0, 1).toISOString(),
  },
  {
    id: "mock-policy-lookup",
    name: "PolicyLookup",
    description: "Lookup a customer's existing policy information.",
    enabled: false,
    parameters: { policyNumber: "string" },
    metadata: { category: "internal" },
    created_at: new Date(2024, 0, 1).toISOString(),
    updated_at: new Date(2024, 0, 1).toISOString(),
  },
] as const;

export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({
      tools: mockTools,
      integration: {
        status: "degraded" as const,
        target: "agent_tools",
        message: "Supabase admin client unavailable. Showing mock tool registry.",
      },
    });
  }

  const { data, error } = await admin
    .from("agent_tools")
    .select("id, name, description, enabled, parameters, metadata, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({
      tools: mockTools,
      integration: {
        status: "degraded" as const,
        target: "agent_tools",
        message: error.message || "Failed to load agent tools from Supabase.",
      },
    }, { status: 200 });
  }

  return NextResponse.json({ tools: data ?? [] });
}

export const runtime = "nodejs";
