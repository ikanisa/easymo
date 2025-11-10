import { NextResponse } from "next/server";
import { z } from "zod";
import { listAgentTools, type AgentTool } from "@/lib/supabase/server/tools";
import { SupabaseUnavailableError, SupabaseQueryError } from "@/lib/supabase/server/utils";

const querySchema = z.object({
  includeDisabled: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    includeDisabled: searchParams.get("includeDisabled") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  try {
    const tools = await listAgentTools({
      includeDisabled: parsed.data.includeDisabled ?? true,
    });
    return NextResponse.json<{ tools: AgentTool[] }>({ tools });
  } catch (error) {
    if (error instanceof SupabaseUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof SupabaseQueryError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "unknown_error" }, { status: 500 });
  }
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
