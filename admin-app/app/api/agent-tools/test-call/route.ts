import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type ToolRow = {
  id: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
};

export async function POST(req: Request) {
  const admin = getSupabaseAdminClient();
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const { toolId, payload } = body as {
    toolId?: string;
    payload?: Record<string, unknown>;
  };

  if (!toolId) {
    return NextResponse.json({ error: "tool_required" }, { status: 400 });
  }

  const inputPayload = payload && typeof payload === "object" ? payload : {};

  if (!admin) {
    return NextResponse.json({
      result: {
        status: "mock",
        toolId,
        echo: inputPayload,
        message: "Supabase unavailable – returning mock test result.",
      },
    });
  }

  const { data: tool, error } = await admin
    .from("agent_tools")
    .select("id, name, description, metadata")
    .eq("id", toolId)
    .maybeSingle<ToolRow>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!tool) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const metadataRecord =
    tool.metadata && typeof tool.metadata === "object"
      ? (tool.metadata as Record<string, unknown>)
      : {};
  const endpointValue = metadataRecord["endpoint"];
  const endpoint = typeof endpointValue === "string" ? endpointValue : null;
  const methodValue = metadataRecord["method"];
  const method = typeof methodValue === "string" ? methodValue : "POST";

  const baseUrl = process.env.AGENT_CORE_URL ?? process.env.NEXT_PUBLIC_AGENT_CORE_URL ?? null;

  if (endpoint && baseUrl) {
    try {
      const url = `${baseUrl.replace(/\/$/, "")}/${endpoint.replace(/^\//, "")}`;
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(process.env.AGENT_CORE_INTERNAL_TOKEN
            ? { Authorization: `Bearer ${process.env.AGENT_CORE_INTERNAL_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({ tool: tool.name, payload: inputPayload }),
      });

      const text = await response.text();
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      return NextResponse.json({
        result: {
          status: response.ok ? "ok" : "error",
          httpStatus: response.status,
          tool: tool.name,
          response: json,
        },
      }, { status: response.ok ? 200 : response.status });
    } catch (err) {
      return NextResponse.json({
        result: {
          status: "error",
          tool: tool.name,
          message: err instanceof Error ? err.message : "Tool request failed",
        },
      }, { status: 502 });
    }
  }

  return NextResponse.json({
    result: {
      status: "ok",
      tool: tool.name,
      echo: inputPayload,
      message: endpoint
        ? "Agent Core URL not configured. Returning dry-run payload."
        : "Tool metadata missing endpoint. Returning dry-run payload.",
    },
  });
}

export const runtime = "nodejs";
