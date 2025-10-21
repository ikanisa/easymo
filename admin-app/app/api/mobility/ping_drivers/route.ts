import { NextRequest, NextResponse } from "next/server";

// Fan-out via internal WA sender route
export async function POST(req: NextRequest) {
  const reqId = req.headers.get("x-request-id") || undefined;
  const { ride_id, driver_ids = [], template, text } = await req.json();
  let queued = 0;
  await Promise.all(
    (driver_ids as string[]).map(async (to) => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/wa/outbound/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, template, text, type: "mobility_invite" }),
        });
        if (res.ok) queued++;
      } catch (error) {
        console.error("Failed to queue driver ping", { to, error });
      }
    })
  );
  return NextResponse.json({ ride_id, queued, reqId }, { status: 202 });
}

export async function GET(req: NextRequest) {
  const enabled = (process.env.API_HEALTH_PROBES_ENABLED ?? "false").toLowerCase() === "true";
  if (!enabled) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const reqId = req.headers.get("x-request-id") || crypto.randomUUID();
  return NextResponse.json({ route: "mobility.ping_drivers", status: "ok", reqId }, { status: 200 });
}
