export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { z } from "zod";
import { leadSchema } from "@/lib/schemas";
import { mockLeads } from "@/lib/mock-data";
import { getAgentCoreUrl, shouldUseMocks } from "@/lib/runtime-config";

const leadListResponseSchema = z.object({
  leads: z.array(leadSchema),
});

const leadUpdateSchema = z.object({
  tenantId: z.string().uuid(),
  phone: z.string(),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  optIn: z.boolean().optional(),
});

const leadQuerySchema = z.object({
  tenantId: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
});

function filterMockLeads(search?: string, limit = 50) {
  if (!search) {
    return mockLeads.slice(0, limit);
  }
  const normalized = search.toLowerCase();
  return mockLeads.filter((lead) =>
    `${lead.name ?? ""} ${lead.phoneE164}`.toLowerCase().includes(normalized)
  ).slice(0, limit);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = leadQuerySchema.parse({
    tenantId: searchParams.get("tenantId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (shouldUseMocks()) {
    return NextResponse.json({ leads: filterMockLeads(query.search, query.limit) });
  }

  const agentUrl = getAgentCoreUrl();
  const agentToken = process.env.AGENT_CORE_INTERNAL_TOKEN;
  const tenantId = query.tenantId ?? process.env.AGENT_INTERNAL_TENANT_ID;

  if (!agentUrl || !agentToken || !tenantId) {
    return NextResponse.json({
      leads: filterMockLeads(query.search, query.limit),
      integration: {
        status: "degraded",
        message: "Agent Core URL or token missing; returning fixture data.",
      },
    });
  }

  try {
    const url = new URL("tools/leads", agentUrl);
    url.searchParams.set("tenantId", tenantId);
    url.searchParams.set("limit", String(query.limit));
    if (query.search) url.searchParams.set("search", query.search);

    const response = await fetch(url, {
      headers: {
        "x-agent-jwt": agentToken,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`Agent core responded with ${response.status}`);
    }
    const parsed = leadListResponseSchema.parse(await response.json());
    return NextResponse.json({ leads: parsed.leads });
  } catch (error) {
    console.error("leads.fetch_failed", error);
    return NextResponse.json({
      leads: filterMockLeads(query.search, query.limit),
      integration: {
        status: "degraded",
        message: "Agent Core lead fetch failed; returning fixture data.",
      },
    });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const payload = leadUpdateSchema.parse(body);

  if (shouldUseMocks()) {
    return NextResponse.json({
      lead: {
        ...payload,
        id: "mock-lead",
        tags: payload.tags ?? [],
        optIn: payload.optIn ?? true,
        createdAt: new Date().toISOString(),
        lastContactAt: new Date().toISOString(),
      },
      integration: {
        status: "mock",
        message: "Lead update mocked in preview mode.",
      },
    });
  }

  const agentUrl = getAgentCoreUrl();
  const agentToken = process.env.AGENT_CORE_INTERNAL_TOKEN;

  if (!agentUrl || !agentToken) {
    return NextResponse.json({
      lead: null,
      integration: {
        status: "degraded",
        message: "Agent Core URL or token missing; update skipped.",
      },
    }, { status: 503 });
  }

  try {
    const response = await fetch(`${agentUrl.replace(/\/$/, "")}/tools/log-lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-jwt": agentToken,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`Agent core responded with ${response.status}`);
    }
    const lead = leadSchema.parse(await response.json());
    return NextResponse.json({ lead });
  } catch (error) {
    console.error("leads.update_failed", error);
    return NextResponse.json({
      lead: null,
      integration: {
        status: "degraded",
        message: "Agent Core lead update failed.",
      },
    }, { status: 500 });
  }
}
