export const dynamic = 'force-dynamic';
import { z } from "zod";

import { createHandler } from "@/app/api/withObservability";
import { jsonError, jsonOk, zodValidationError } from "@/lib/api/http";
import { buildQrPreview, buildShareLink } from "@/lib/qr/qr-preview-helpers";
import { logStructured } from "@/lib/server/logger";
import { requireActorId, UnauthorizedError } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { sendWhatsAppMessage } from "@/lib/server/whatsapp";

const requestSchema = z.object({
  barId: z.string().uuid(),
  phone: z.string().min(5).optional(),
  sendTest: z.boolean().optional(),
});

function appendMessage(messages: string[], text: string) {
  if (text && !messages.includes(text)) {
    messages.push(text);
  }
}

export const POST = createHandler("admin_api.qr.preview", async (request, _context, { recordMetric }) => {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    recordMetric("qr_preview.supabase_unavailable", 1);
    return jsonError({
      error: "supabase_unavailable",
      message: "Supabase credentials missing. Unable to build QR preview.",
    }, 503);
  }

  let payload: z.infer<typeof requestSchema>;
  try {
    const json = await request.json();
    payload = requestSchema.parse(json);
  } catch (error) {
    recordMetric("qr_preview.invalid_payload", 1);
    return zodValidationError(error);
  }

  try {
    requireActorId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return jsonError({ error: "unauthorized", message: error.message }, 401);
    }
    throw error;
  }

  const { barId, sendTest = false, phone } = payload;

  const { data: barRow, error: barError } = await adminClient
    .from("bars")
    .select("id, name, slug, location_text, city_area, bar_tables(label, qr_payload)")
    .eq("id", barId)
    .maybeSingle();

  if (barError) {
    recordMetric("qr_preview.supabase_error", 1, { message: barError.message });
    logStructured({
      event: "qr_preview_bar_lookup_failed",
      target: "qr_preview",
      status: "error",
      message: barError.message,
      details: { bar_id: barId },
    });
    return jsonError({ error: "bar_lookup_failed", message: "Unable to load bar details." }, 500);
  }

  if (!barRow) {
    recordMetric("qr_preview.bar_missing", 1);
    return jsonError({ error: "bar_not_found", message: "Bar not found." }, 404);
  }

  const tableRow = Array.isArray((barRow as any).bar_tables)
    ? (barRow as any).bar_tables.find((entry: any) => Boolean(entry?.qr_payload))
    : null;

  const shareLink = buildShareLink(
    tableRow?.qr_payload ?? null,
    process.env.WA_BOT_NUMBER_E164 ?? process.env.NEXT_PUBLIC_WA_BOT_NUMBER_E164 ?? null,
  );

  const preview = buildQrPreview({
    bar: {
      id: barRow.id,
      name: barRow.name ?? "Bar",
      slug: barRow.slug ?? null,
      location: barRow.location_text ?? barRow.city_area ?? null,
    },
    table: tableRow
      ? {
        label: tableRow.label ?? "Table",
        qrPayload: tableRow.qr_payload,
      }
      : null,
    shareLink,
  });

  const integrationMessages: string[] = [];
  let integrationStatus: "ok" | "degraded" = tableRow ? "ok" : "degraded";

  if (!tableRow) {
    appendMessage(
      integrationMessages,
      "No QR tables found for this bar. Using default preview without sample payload.",
    );
  }

  if (!shareLink) {
    appendMessage(
      integrationMessages,
      "WhatsApp share link unavailable. Configure WA_BOT_NUMBER_E164 to surface the link.",
    );
  }

  if (sendTest) {
    if (!phone) {
      return jsonError({ error: "phone_required", message: "Phone is required to send a test message." }, 400);
    }

    const listPayload = {
      to: phone,
      type: "interactive" as const,
      interactive: {
        type: "list" as const,
        header: { type: "text", text: preview.interactive.header },
        body: { text: preview.interactive.body },
        action: {
          button: preview.interactive.buttonLabel,
          sections: [
            {
              title: preview.interactive.sectionTitle,
              rows: preview.interactive.rows.map((row) => ({
                id: row.id,
                title: row.title,
                ...(row.description ? { description: row.description } : {}),
              })),
            },
          ],
        },
      },
    } satisfies Record<string, unknown>;

    try {
      const response = await sendWhatsAppMessage(listPayload);
      if (response === null) {
        integrationStatus = "degraded";
        appendMessage(
          integrationMessages,
          "WhatsApp send endpoint not configured. Preview generated without dispatching a test.",
        );
        recordMetric("qr_preview.test_send_skipped", 1);
      } else {
        recordMetric("qr_preview.test_send_ok", 1);
        logStructured({
          event: "qr_preview_test_dispatched",
          target: "qr_preview",
          status: "ok",
          details: { bar_id: barRow.id },
        });
      }
    } catch (error) {
      integrationStatus = "degraded";
      const message = error instanceof Error ? error.message : "unknown_error";
      appendMessage(
        integrationMessages,
        "Test message send failed. Check WhatsApp bridge logs.",
      );
      recordMetric("qr_preview.test_send_failed", 1, { message });
      logStructured({
        event: "qr_preview_test_failed",
        target: "qr_preview",
        status: "error",
        message,
        details: { bar_id: barRow.id },
      });
    }
  }

  const integration = {
    status: integrationStatus,
    target: "qr_preview",
    ...(integrationMessages.length ? { message: integrationMessages.join(" ") } : {}),
  } as const;

  recordMetric("qr_preview.success", 1, { bar_id: barRow.id, send_test: sendTest ? 1 : 0 });
  logStructured({
    event: "qr_preview_generated",
    target: "qr_preview",
    status: integrationStatus === "ok" ? "ok" : "degraded",
    details: {
      bar_id: barRow.id,
      send_test: sendTest,
    },
  });

  return jsonOk({ preview, integration });
});

export const runtime = "nodejs";
