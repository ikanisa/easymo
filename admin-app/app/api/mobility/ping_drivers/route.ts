import { NextRequest, NextResponse } from "next/server";
import { logStructured } from "@/lib/server/logger";

type FailureDetail = {
  to: string;
  error: string;
  status?: number;
  body?: string | null;
  duration_ms?: number;
};

async function readErrorSnippet(res: Response): Promise<string | undefined> {
  try {
    const text = await res.text();
    if (!text) return undefined;
    if (text.length > 512) {
      return `${text.slice(0, 512)}…`;
    }
    return text;
  } catch {
    return undefined;
  }
}

// Fan-out via internal WA sender route
export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, driver_ids = [], template, text } = await req.json();
  const driverTargets = (Array.isArray(driver_ids) ? driver_ids : driver_ids ? [driver_ids] : [])
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;

  const startedAt = Date.now();
  let queued = 0;
  const failures: FailureDetail[] = [];

  await Promise.all(
    driverTargets.map(async (to) => {
      const fanOutStartedAt = Date.now();
      try {
        const res = await fetch(`${baseUrl}/api/wa/outbound/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, template, text, type: "mobility_invite" }),
        });

        if (res.ok) {
          queued++;
          return;
        }

        const failure: FailureDetail = {
          to,
          error: `http_${res.status}`,
          status: res.status,
          body: await readErrorSnippet(res),
          duration_ms: Date.now() - fanOutStartedAt,
        };
        failures.push(failure);
        logStructured({
          event: "mobility.ping_drivers.forward_failed",
          status: "error",
          ride_id,
          reqId,
          target: to,
          details: failure,
        });
      } catch (error) {
        console.error("Failed to queue driver ping", { to, error });
        const failure: FailureDetail = {
          to,
          error: "network_error",
          body: error instanceof Error ? error.message : String(error),
          duration_ms: Date.now() - fanOutStartedAt,
        };
        failures.push(failure);
        logStructured({
          event: "mobility.ping_drivers.forward_failed",
          status: "error",
          ride_id,
          reqId,
          target: to,
          details: failure,
        });
      }
    })
  );

  const total = driverTargets.length;
  const duration_ms = Date.now() - startedAt;
  const payload: {
    ride_id: typeof ride_id;
    total: number;
    queued: number;
    failed: number;
    reqId: string | undefined;
    duration_ms: number;
    failures?: FailureDetail[];
  } = { ride_id, total, queued, failed: failures.length, reqId, duration_ms };

  if (failures.length) {
    payload.failures = failures;
  }

  logStructured({
    event: "mobility.ping_drivers.fanout_complete",
    status: failures.length ? "degraded" : "ok",
    ride_id,
    reqId,
    details: {
      total,
      queued,
      failed: failures.length,
      duration_ms,
    },
  });

  return NextResponse.json(payload, { status: failures.length ? 207 : 202 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "mobility.ping_drivers", status: "ok", reqId }, { status: 200 });
}
