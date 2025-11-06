import { z } from "zod";
import { jsonOk, jsonError } from "@/lib/api/http";
import { getDashboardSnapshot } from "@/lib/dashboard/dashboard-service";
import { dashboardKpiSchema, timeseriesPointSchema } from "@/lib/schemas";
import { createHandler } from "@/app/api/withObservability";

const responseSchema = z.object({
  kpis: z.array(dashboardKpiSchema),
  timeseries: z.array(timeseriesPointSchema),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.dashboard.get", async () => {
  try {
    const { data, integration } = await getDashboardSnapshot();
    const payload = responseSchema.parse(data);

    const headers = new Headers();
    headers.set("x-dashboard-integration-status", integration.status);
    headers.set("x-dashboard-integration-target", integration.target);
    if (integration.message) {
      headers.set("x-dashboard-integration-message", integration.message);
    }
    if (integration.remediation) {
      headers.set("x-dashboard-integration-remediation", integration.remediation);
    }

    return jsonOk(payload, { headers });
  } catch (error) {
    console.error("Failed to build dashboard snapshot", error);
    return jsonError({ error: "dashboard_snapshot_failed", message: "Unable to compute dashboard snapshot." }, 500);
  }
});

export const runtime = "edge";
