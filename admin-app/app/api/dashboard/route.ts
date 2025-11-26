import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { handleAPIError, jsonOk } from "@/lib/api/error-handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { getDashboardSnapshot } from "@/lib/dashboard/dashboard-service";
import { dashboardKpiSchema, timeseriesPointSchema } from "@/lib/schemas";

const responseSchema = z.object({
  kpis: z.array(dashboardKpiSchema),
  timeseries: z.array(timeseriesPointSchema),
});

export const dynamic = "force-dynamic";

export const GET = createHandler("admin_api.dashboard.get", async (request: Request) => {
  try {
    const limiter = rateLimit({ interval: 60 * 1000, uniqueTokenPerInterval: 500 });
    const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
    await limiter.check(20, ip); // 20 requests per minute

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
    return handleAPIError(error);
  }
});

export const runtime = "nodejs";
