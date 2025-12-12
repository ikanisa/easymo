import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import {
  createServiceRoleClient,
  handleOptions,
  json,
  logRequest,
  logResponse,
  requireAdminAuth,
} from "../_shared/admin.ts";
import { verifyQrPayload } from "../wa-webhook/utils/qr.ts";
import { getRotatingSecret } from "../_shared/env.ts";

const supabase = createServiceRoleClient();
const requestSchema = z.object({
  token: z.string().min(10),
}).strict();

Deno.serve(async (req) => {
  logRequest("qr-info", req);

  if (req.method === "OPTIONS") {
    return handleOptions();
  }

  const authResponse = requireAdminAuth(req);
  if (authResponse) return authResponse;

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parseResult = requestSchema.safeParse(payload);
  if (!parseResult.success) {
    return json({ error: "invalid_payload" }, 400);
  }

  const { token } = parseResult.data;

  const { active, previous } = getRotatingSecret("QR_TOKEN_SECRET");
  const secrets = [active, previous].filter((value): value is string =>
    Boolean(value && value.length)
  );

  if (!secrets.length) {
    await logStructuredEvent("ERROR", { data: "qr-info.secret_missing" });
    return json({ error: "qr_token_secret_missing" }, 500);
  }

  try {
    const { barSlug, tableLabel } = await verifyQrPayload(
      token,
      secrets,
    );

    const { data: barRow, error } = await supabase
      .from("bars")
      .select("id,name,slug,bar_tables(id,label,qr_payload)")
      .eq("slug", barSlug)
      .maybeSingle();
    if (error || !barRow) {
      throw new Error("bar_not_found");
    }

    const matchTable = (barRow.bar_tables ?? []).find((t: any) => {
      const normalized = String(t.label ?? "").trim().toUpperCase();
      return normalized === tableLabel || t.qr_payload === token;
    });

    if (!matchTable) {
      throw new Error("table_not_found");
    }

    const result = {
      bar: {
        id: barRow.id,
        name: barRow.name,
        slug: barRow.slug,
      },
      table: {
        id: matchTable.id,
        label: matchTable.label,
      },
    };

    logResponse("qr-info", 200, result);
    return json({ ok: true, ...result });
  } catch (error) {
    await logStructuredEvent("WARNING", { data: "qr-info.lookup_failed", error });
    const message = error instanceof Error
      ? error.message
      : String(error ?? "error");
    return json({ ok: false, error: message }, 400);
  }
});
