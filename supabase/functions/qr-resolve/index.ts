import { serve } from "../wa-webhook/deps.ts";
import { verifyQrPayload } from "../wa-webhook/utils/qr.ts";
import { ensureProfile, setState } from "../wa-webhook/state/store.ts";
import { supabase } from "../wa-webhook/config.ts";
import { logStructuredEvent } from "../wa-webhook/observe/log.ts";

const QR_TOKEN_SECRET = Deno.env.get("QR_TOKEN_SECRET") ?? "";

function normalize(label: string): string {
  return label.trim().replace(/\s+/g, " ").toUpperCase();
}

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  if (!QR_TOKEN_SECRET) {
    return new Response(
      JSON.stringify({ ok: false, error: "QR token secret missing" }),
      { status: 500 },
    );
  }
  let body: { wa_id?: string; token?: string };
  try {
    body = await req.json();
  } catch (_err) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), {
      status: 400,
    });
  }
  if (!body.token || !body.wa_id) {
    return new Response(
      JSON.stringify({ ok: false, error: "wa_id and token required" }),
      { status: 400 },
    );
  }
  try {
    const { barSlug, tableLabel } = await verifyQrPayload(
      body.token,
      QR_TOKEN_SECRET,
    );
    const { data: barRow, error: barError } = await supabase
      .from("bars")
      .select("id, slug, bar_tables(id, label, qr_payload)")
      .eq("slug", barSlug)
      .maybeSingle();
    if (barError || !barRow) throw new Error("Bar not found");
    const matchTable = (barRow.bar_tables ?? []).find((t: any) =>
      normalize(t.label) === tableLabel || t.qr_payload === body.token
    );
    if (!matchTable) throw new Error("Table not found");

    const profile = await ensureProfile(supabase, body.wa_id);
    await setState(supabase, profile.user_id, {
      key: "qr_session",
      data: { bar_id: barRow.id, table_label: matchTable.label },
    });
    await logStructuredEvent("QR_RESOLVE_OK", {
      wa_id: `***${body.wa_id.slice(-4)}`,
      bar_slug: barSlug,
      table_label: matchTable.label,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        bar_id: barRow.id,
        table_label: matchTable.label,
      }),
      {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    );
  } catch (err) {
    await logStructuredEvent("QR_RESOLVE_FAIL", { error: String(err) });
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 400,
    });
  }
});
