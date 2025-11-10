import { z } from "zod";
import { createHandler } from "@/app/api/withObservability";
import { jsonOk, zodValidationError } from "@/lib/api/http";
import { logStructured } from "@/lib/server/logger";

const Body = z.object({
  channel: z.string(),
  event: z.string(),
  table: z.string().optional(),
  status: z.string().optional(),
  receivedAt: z.string().optional(),
  requestedAt: z.string().optional(),
  latencyMs: z.number().optional(),
  recordId: z.string().optional(),
});

export const POST = createHandler("api.monitoring.realtime", async (req) => {
  const payload = await req.json().catch(() => ({}));
  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return zodValidationError(parsed.error);
  }

  const { channel, event, table, status, receivedAt, requestedAt, latencyMs, recordId } = parsed.data;

  logStructured({
    event: "supabase_realtime_event",
    target: channel,
    status: status === "error" ? "error" : "ok",
    details: {
      channel,
      event,
      table,
      status,
      receivedAt,
      requestedAt,
      latencyMs,
      recordId,
    },
  });

  return jsonOk({ ok: true });
});

export const runtime = "nodejs";
