import { NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSnapshot } from "@/lib/data-provider";
import { dashboardKpiSchema, timeseriesPointSchema } from "@/lib/schemas";

const responseSchema = z.object({
  kpis: z.array(dashboardKpiSchema),
  timeseries: z.array(timeseriesPointSchema),
});

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getDashboardSnapshot();
    const payload = responseSchema.parse(snapshot);
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("Failed to build dashboard snapshot", error);
    return NextResponse.json({ error: "dashboard_snapshot_failed" }, {
      status: 500,
    });
  }
}
