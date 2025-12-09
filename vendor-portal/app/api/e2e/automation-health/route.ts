import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getAutomationHealthStub,
  setAutomationHealthStub,
  type AutomationHealthStub,
} from "@/lib/e2e/automation-health-store";

const POLLER_SCHEMA = z.object({
  id: z.string(),
  displayName: z.string(),
  status: z.string(),
  lastPolledAt: z.string().optional().nullable(),
  lastError: z.string().optional().nullable(),
  lastLatencyMs: z.number().optional().nullable(),
});

const GATEWAY_SCHEMA = z.object({
  id: z.string(),
  displayName: z.string(),
  status: z.string(),
  lastHeartbeatAt: z.string().optional().nullable(),
  lastError: z.string().optional().nullable(),
  lastLatencyMs: z.number().optional().nullable(),
});

const STUB_SCHEMA = z.object({
  pollers: z.array(POLLER_SCHEMA).default([]),
  gateways: z.array(GATEWAY_SCHEMA).default([]),
});

function e2eEnabled() {
  // Never allow E2E stub in production, regardless of env var
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.AUTH_E2E_STUB === "1";
}

export function GET() {
  if (!e2eEnabled()) {
    return NextResponse.json({ ok: false, error: "e2e_stub_disabled" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    data: getAutomationHealthStub() ?? { pollers: [], gateways: [] },
  });
}

export async function POST(request: NextRequest) {
  if (!e2eEnabled()) {
    return NextResponse.json({ ok: false, error: "e2e_stub_disabled" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = STUB_SCHEMA.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  setAutomationHealthStub(parsed.data as AutomationHealthStub);
  return NextResponse.json({ ok: true });
}

export function DELETE() {
  if (!e2eEnabled()) {
    return NextResponse.json({ ok: false, error: "e2e_stub_disabled" }, { status: 404 });
  }
  setAutomationHealthStub(null);
  return NextResponse.json({ ok: true });
}
