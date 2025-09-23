import { supabase, assertRuntimeReady } from "./config.ts";

export async function health(): Promise<Response> {
  try {
    assertRuntimeReady();
    const { data, error } = await supabase
      .from("app_config")
      .select("id")
      .limit(1);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, config: data?.[0]?.id ?? null }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
