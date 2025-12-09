import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateHmacRequest } from "../_shared/auth.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const sanitizeLabel = (value: string) => value.replace(/[^a-zA-Z0-9_:/.-]/g, "_");

const respond = (metrics: string[]) =>
  new Response(metrics.join("\n") + "\n", {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

type MetricRow = {
  event: string;
  total: number | null;
  meta: Record<string, unknown> | null;
};

serveWithObservability("metrics-exporter", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const validation = await validateHmacRequest(req, { toleranceSeconds: 60 });

    if (!validation.ok) {
      console.warn("metrics-exporter.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return new Response("ibimina_health_up 0\n", {
        status,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const metrics: string[] = [];

    metrics.push(`# HELP ibimina_health_up Reports exporter availability`);
    metrics.push("# TYPE ibimina_health_up gauge");
    metrics.push("ibimina_health_up 1");

    const { data: systemMetrics, error: systemMetricsError } = await supabase
      .from("system_metrics")
      .select("event, total, meta")
      .limit(200);

    if (systemMetricsError) {
      throw systemMetricsError;
    }

    if (systemMetrics && systemMetrics.length > 0) {
      metrics.push(`# HELP ibimina_system_metric_total Counter derived from system_metrics table`);
      metrics.push("# TYPE ibimina_system_metric_total counter");
      (systemMetrics as MetricRow[]).forEach((row) => {
        const event = sanitizeLabel(row.event ?? "unknown");
        const total = Number.isFinite(row.total) ? Number(row.total) : 0;
        metrics.push(`ibimina_system_metric_total{event="${event}"} ${total}`);
      });
    }

    const [
      { count: smsPending },
      { count: smsFailed },
      { count: notificationPending },
      { count: notificationErrored },
      { count: reconJobsPending },
    ] = await Promise.all([
      supabase
        .from("sms_inbox")
        .select("id", { count: "exact", head: true })
        .in("status", ["NEW", "PARSED", "PENDING"]),
      supabase
        .from("sms_inbox")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED"),
      supabase
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED"),
      supabase
        .schema("app")
        .from("reconciliation_jobs")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDING"),
    ]);

    metrics.push(`# HELP ibimina_sms_queue_pending Pending SMS rows awaiting processing`);
    metrics.push("# TYPE ibimina_sms_queue_pending gauge");
    metrics.push(`ibimina_sms_queue_pending ${smsPending ?? 0}`);

    metrics.push(`# HELP ibimina_sms_queue_failed Failed SMS rows awaiting retry`);
    metrics.push("# TYPE ibimina_sms_queue_failed gauge");
    metrics.push(`ibimina_sms_queue_failed ${smsFailed ?? 0}`);

    metrics.push(`# HELP ibimina_notification_queue_pending Pending notification events`);
    metrics.push("# TYPE ibimina_notification_queue_pending gauge");
    metrics.push(`ibimina_notification_queue_pending ${notificationPending ?? 0}`);

    metrics.push(`# HELP ibimina_notification_queue_failed Failed notification events`);
    metrics.push("# TYPE ibimina_notification_queue_failed gauge");
    metrics.push(`ibimina_notification_queue_failed ${notificationErrored ?? 0}`);

    metrics.push(
      `# HELP ibimina_reconciliation_jobs_pending Pending reconciliation automation jobs`
    );
    metrics.push("# TYPE ibimina_reconciliation_jobs_pending gauge");
    metrics.push(`ibimina_reconciliation_jobs_pending ${reconJobsPending ?? 0}`);

    const { count: paymentsPending } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .in("status", ["UNALLOCATED", "PENDING"]);

    metrics.push(`# HELP ibimina_payments_pending Pending or unallocated payments`);
    metrics.push("# TYPE ibimina_payments_pending gauge");
    metrics.push(`ibimina_payments_pending ${paymentsPending ?? 0}`);

    const { data: pollers } = await supabase
      .schema("app")
      .from("momo_statement_pollers")
      .select("id, provider, display_name, last_polled_at, last_latency_ms, last_error, status");

    if (pollers?.length) {
      metrics.push(
        `# HELP ibimina_momo_poller_latency_seconds Average latency of last MoMo polling batch`
      );
      metrics.push("# TYPE ibimina_momo_poller_latency_seconds gauge");
      metrics.push(`# HELP ibimina_momo_poller_up Health indicator for MoMo polling workers`);
      metrics.push("# TYPE ibimina_momo_poller_up gauge");
      const now = Date.now();
      for (const poller of pollers as Array<{
        id: string;
        provider: string | null;
        display_name: string | null;
        last_polled_at: string | null;
        last_latency_ms: number | null;
        last_error: string | null;
        status: string;
      }>) {
        const pollerLabel = sanitizeLabel(poller.display_name ?? poller.provider ?? poller.id);
        const providerLabel = sanitizeLabel(poller.provider ?? "unknown");
        const lastPolled = poller.last_polled_at ? Date.parse(poller.last_polled_at) : null;
        const isFresh = lastPolled ? now - lastPolled < 1000 * 60 * 30 : false;
        const up = poller.status === "ACTIVE" && !poller.last_error && isFresh ? 1 : 0;
        const latencySeconds = poller.last_latency_ms ? poller.last_latency_ms / 1000 : 0;
        metrics.push(
          `ibimina_momo_poller_latency_seconds{poller="${pollerLabel}",provider="${providerLabel}"} ${latencySeconds}`
        );
        metrics.push(
          `ibimina_momo_poller_up{poller="${pollerLabel}",provider="${providerLabel}"} ${up}`
        );
      }
    }

    const { data: gateways } = await supabase
      .schema("app")
      .from("sms_gateway_endpoints")
      .select(
        "gateway, display_name, last_status, last_latency_ms, last_heartbeat_at, last_error, status"
      );

    if (gateways?.length) {
      metrics.push(
        `# HELP ibimina_sms_gateway_latency_ms Latest latency recorded by GSM heartbeats`
      );
      metrics.push("# TYPE ibimina_sms_gateway_latency_ms gauge");
      metrics.push(`# HELP ibimina_sms_gateway_up Health indicator for configured GSM gateways`);
      metrics.push("# TYPE ibimina_sms_gateway_up gauge");
      const now = Date.now();
      for (const gateway of gateways as Array<{
        gateway: string;
        display_name: string | null;
        last_status: string | null;
        last_latency_ms: number | null;
        last_heartbeat_at: string | null;
        last_error: string | null;
        status: string;
      }>) {
        const gatewayLabel = sanitizeLabel(gateway.display_name ?? gateway.gateway);
        const lastHeartbeat = gateway.last_heartbeat_at
          ? Date.parse(gateway.last_heartbeat_at)
          : null;
        const alive = lastHeartbeat ? now - lastHeartbeat < 1000 * 60 * 15 : false;
        const up =
          gateway.status === "ACTIVE" &&
          gateway.last_status === "UP" &&
          !gateway.last_error &&
          alive
            ? 1
            : 0;
        const latencyMs = gateway.last_latency_ms ?? 0;
        metrics.push(`ibimina_sms_gateway_latency_ms{gateway="${gatewayLabel}"} ${latencyMs}`);
        metrics.push(`ibimina_sms_gateway_up{gateway="${gatewayLabel}"} ${up}`);
      }
    }

    return respond(metrics);
  } catch (error) {
    console.error("metrics-exporter failure", error);
    return new Response("ibimina_health_up 0\n", {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      },
    });
  }
});
