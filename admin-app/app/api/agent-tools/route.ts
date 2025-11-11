import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const querySchema = z.object({
  includeDisabled: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

const fallbackTools = [
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    includeDisabled: searchParams.get("includeDisabled") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_query" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({
      tools: fallbackTools,
      integration: {
        status: "degraded" as const,
        target: "agent_tools",
        message: "Supabase admin client unavailable. Showing mock tool registry.",
      },
    });
  }

  const includeDisabled = parsed.data.includeDisabled ?? true;
  let query = admin
    .from("agent_tools")
    .select(
      "id, name, description, enabled, parameters, metadata, created_at, updated_at",
    )
    .order("name", { ascending: true });

  if (!includeDisabled) {
    query = query.eq("enabled", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({
      tools: fallbackTools,
      integration: {
        status: "degraded" as const,
        target: "agent_tools",
        message: error.message || "Failed to load agent tools from Supabase.",
      },
    });
  }

  return NextResponse.json({
    tools: data ?? [],
    integration: { status: "ok" as const, target: "agent_tools" },
  });
}

export const runtime = "nodejs";

