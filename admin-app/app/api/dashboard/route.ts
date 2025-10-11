import { z } from "zod";
import {
  type DashboardSnapshot,
  getDashboardSnapshot,
} from "@/lib/dashboard/dashboard-service";
import { dashboardKpiSchema, timeseriesPointSchema } from "@/lib/schemas";
import { createHandler } from "@/app/api/withObservability";

const responseSchema = z.object({
  kpis: z.array(dashboardKpiSchema),
  timeseries: z.array(timeseriesPointSchema),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.dashboard.get", async () => {
  try {
    const snapshot: DashboardSnapshot = await getDashboardSnapshot();
    const payload = responseSchema.parse(snapshot);
    return jsonOk(payload);
  } catch (error) {
    console.error("Failed to build dashboard snapshot", error);
    return jsonError({ error: "dashboard_snapshot_failed", message: "Unable to compute dashboard snapshot." }, 500);
  }
});
import { jsonOk, jsonError } from "@/lib/api/http";
