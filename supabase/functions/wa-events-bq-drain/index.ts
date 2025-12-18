import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { logStructuredEvent } from "../_shared/observability.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js";
import { streamRowsToBigQuery } from "../_shared/bigquery.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const BQ_DATASET = Deno.env.get("BQ_DATASET") ?? "";
const BQ_TABLE = Deno.env.get("BQ_TABLE") ?? "";
const BQ_PROJECT_ID = Deno.env.get("BQ_PROJECT_ID") ?? undefined;

const BATCH_SIZE = Number(Deno.env.get("BQ_QUEUE_BATCH_SIZE") ?? "200");
const BASE_DELAY_MS = Number(Deno.env.get("BQ_QUEUE_BASE_DELAY_MS") ?? "60000");
const MAX_DELAY_MS = Number(Deno.env.get("BQ_QUEUE_MAX_DELAY_MS") ?? "900000");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Worker-Id",
};

type QueueRow = {
  id: string;
  wa_event_id: string | null;
  wa_message_id: string | null;
  payload: Record<string, unknown>;
  attempts: number;
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!BQ_DATASET || !BQ_TABLE) {
    return respond({ success: false, error: "bigquery_not_configured" }, 500);
  }

  const workerId = req.headers.get("x-worker-id") ?? crypto.randomUUID();

  const { data: leased, error: leaseError } = await supabase.rpc("lease_wa_events_bq_queue", {
    batch_size: BATCH_SIZE,
    locker: workerId,
  });

  if (leaseError) {
    await logStructuredEvent("ERROR", { data: "wa-events-bq-drain.lease_failed", leaseError });
    return respond({ success: false, error: "lease_failed" }, 500);
  }

  const rows: QueueRow[] = (leased ?? []) as QueueRow[];
  if (!rows.length) {
    return respond({ success: true, processed: 0 });
  }

  const insertRows = rows.map((row) => ({
    insertId: row.wa_message_id ?? row.id,
    json: {
      ...row.payload,
      queue_id: row.id,
      wa_event_id: row.wa_event_id,
      wa_message_id: row.wa_message_id,
    },
  }));

  const result = await streamRowsToBigQuery(insertRows, {
    dataset: BQ_DATASET,
    table: BQ_TABLE,
    projectId: BQ_PROJECT_ID,
  });

  if (result.success) {
    const ids = rows.map((row) => row.id);
    const { error: deleteError } = await supabase
      .from("wa_events_bq_queue")
      .delete()
      .in("id", ids);
    if (deleteError) {
      await logStructuredEvent("ERROR", { data: "wa-events-bq-drain.delete_failed", deleteError });
      return respond({ success: false, error: "delete_failed" }, 500);
    }
    return respond({ success: true, processed: rows.length });
  }

  const errorMessage = result.error ?? "bq_insert_failed";
  console.error("wa-events-bq-drain.bigquery_failed", {
    error: errorMessage,
    details: result.insertErrors,
  });

  const now = Date.now();
  await Promise.all(rows.map((row) => {
    const attempt = row.attempts + 1;
    const backoffMs = Math.min(
      BASE_DELAY_MS * Math.pow(2, Math.max(attempt - 1, 0)),
      MAX_DELAY_MS,
    );
    return supabase
      .from("wa_events_bq_queue")
      .update({
        attempts: attempt,
        last_error: errorMessage,
        next_attempt_at: new Date(now + backoffMs).toISOString(),
        locked_at: null,
        locked_by: null,
      })
      .eq("id", row.id);
  }));

  return respond(
    {
      success: false,
      processed: 0,
      error: errorMessage,
      retried: rows.length,
    },
    200,
  );
});
