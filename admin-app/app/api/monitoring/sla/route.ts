import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { logStructured } from "@/lib/server/logger";

const Body = z.object({
  channel: z.string(),
  deadline: z.string(),
  breachedAt: z.string(),
  recordId: z.string().optional(),
  status: z.string().optional(),
});

export const POST = createHandler("api.monitoring.sla", async (req) => {
  const payload = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  const { channel, deadline, breachedAt, recordId, status } = parsed.data;

  logStructured({
    event: "sla_breach_detected",
    target: channel,
    status: "error",
    details: {
      deadline,
      breachedAt,
      recordId,
      status,
    },
  });

  return jsonOk({ ok: true });
});

export const runtime = "nodejs";
