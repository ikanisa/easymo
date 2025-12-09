import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { recordMetric } from "../_shared/metrics.ts";
import { validateHmacRequest } from "../_shared/auth.ts";
import { serveWithObservability } from "../_shared/observability.ts";

const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": APP_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-timestamp",
};

const SAMPLE_RETENTION_HOURS = parseInt(Deno.env.get("METRIC_SAMPLE_RETENTION_HOURS") ?? "168", 10); // 7 days
const ALERT_SUPPRESSION_MINUTES = parseInt(
  Deno.env.get("ANOMALY_ALERT_SUPPRESSION_MINUTES") ?? "60",
  10
);

interface MetricRow {
  event: string;
  total: number | null;
  last_occurred: string | null;
}

interface SampleRow {
  total: number;
  collected_at: string;
}

type Severity = "warning" | "critical";

type RateDetector = {
  signal: string;
  event: string;
  window: number;
  minBaselineSamples: number;
  zThreshold: number;
  spikeMultiplier: number;
  dropTolerance: number;
  minBaselineMean: number;
  minDelta?: number;
  zeroWindow?: number;
};

type ThresholdDetector = {
  signal: string;
  title: string;
  query: () => Promise<number>;
  threshold: number;
  severity: Severity;
};

type Anomaly = {
  signal: string;
  event: string;
  severity: Severity;
  reason: string;
  observed: number;
  baselineMean?: number;
  baselineStd?: number;
  baselineSamples?: number;
  sampleWindowMinutes?: number;
  type: "rate_spike" | "rate_drop" | "absolute_threshold" | "zero_activity";
};

const RATE_DETECTORS: RateDetector[] = [
  {
    signal: "sms_ingested_rate",
    event: "sms_ingested",
    window: 12,
    minBaselineSamples: 4,
    zThreshold: 3,
    spikeMultiplier: 3,
    dropTolerance: 0.15,
    minBaselineMean: 5,
    minDelta: 3,
    zeroWindow: 3,
  },
  {
    signal: "sms_reprocess_failure_rate",
    event: "sms_reprocess_failed",
    window: 12,
    minBaselineSamples: 4,
    zThreshold: 3,
    spikeMultiplier: 3,
    dropTolerance: 0.25,
    minBaselineMean: 1,
    minDelta: 1,
  },
  {
    signal: "payment_action_rate",
    event: "payment_action",
    window: 12,
    minBaselineSamples: 4,
    zThreshold: 3,
    spikeMultiplier: 3,
    dropTolerance: 0.2,
    minBaselineMean: 3,
    minDelta: 2,
    zeroWindow: 3,
  },
];

const buildThresholdDetectors = (
  supabase: ReturnType<typeof createClient>
): ThresholdDetector[] => [
  {
    signal: "sms_queue_backlog",
    title: "SMS backlog",
    query: async () => {
      const { count, error } = await supabase
        .from("sms_inbox")
        .select("id", { count: "exact", head: true })
        .in("status", ["NEW", "PARSED", "PENDING"]);
      if (error) {
        console.warn("metrics-anomaly-detector.sms_queue_count_failed", { error });
        return 0;
      }
      return count ?? 0;
    },
    threshold: 200,
    severity: "critical",
  },
  {
    signal: "notification_failures",
    title: "Notification failures",
    query: async () => {
      const { count, error } = await supabase
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "FAILED");
      if (error) {
        console.warn("metrics-anomaly-detector.notification_count_failed", { error });
        return 0;
      }
      return count ?? 0;
    },
    threshold: 5,
    severity: "warning",
  },
  {
    signal: "payments_pending",
    title: "Pending payments",
    query: async () => {
      const { count, error } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .in("status", ["UNALLOCATED", "PENDING"]);
      if (error) {
        console.warn("metrics-anomaly-detector.payments_count_failed", { error });
        return 0;
      }
      return count ?? 0;
    },
    threshold: 25,
    severity: "warning",
  },
];

const calculateStats = (
  samples: SampleRow[]
): {
  latestDelta: number;
  baselineMean: number;
  baselineStd: number;
  baselineSamples: number;
  zeroStreak: number;
} | null => {
  if (samples.length < 2) {
    return null;
  }

  const deltas: number[] = [];
  for (let index = 0; index < samples.length - 1; index += 1) {
    const current = samples[index];
    const previous = samples[index + 1];
    const delta = Math.max(0, (current.total ?? 0) - (previous.total ?? 0));
    deltas.push(delta);
  }

  if (deltas.length === 0) {
    return null;
  }

  const [latestDelta, ...history] = deltas;
  const baseline = history.length > 0 ? history : [];
  const baselineSamples = baseline.length;

  const baselineMean =
    baseline.length > 0 ? baseline.reduce((sum, value) => sum + value, 0) / baseline.length : 0;

  const variance =
    baseline.length > 1
      ? baseline.reduce((sum, value) => sum + (value - baselineMean) ** 2, 0) /
        (baseline.length - 1)
      : 0;

  const baselineStd = Math.sqrt(variance);

  let zeroStreak = 0;
  for (const value of deltas) {
    if (value === 0) {
      zeroStreak += 1;
    } else {
      break;
    }
  }

  return { latestDelta, baselineMean, baselineStd, baselineSamples, zeroStreak };
};

const shouldSuppressAlert = async (
  supabase: ReturnType<typeof createClient>,
  signal: string
): Promise<boolean> => {
  const cutoff = new Date(Date.now() - ALERT_SUPPRESSION_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("notification_queue")
    .select("id")
    .eq("event", "ANOMALY_DETECTED")
    .contains("payload", { signal })
    .gte("created_at", cutoff)
    .limit(1);

  if (error) {
    console.warn("metrics-anomaly-detector.alert_lookup_failed", { error });
    return false;
  }

  return Boolean(data && data.length > 0);
};

const enqueueAlert = async (supabase: ReturnType<typeof createClient>, anomaly: Anomaly) => {
  if (await shouldSuppressAlert(supabase, anomaly.signal)) {
    return;
  }

  const { error } = await supabase.from("notification_queue").insert({
    event: "ANOMALY_DETECTED",
    channel: "IN_APP",
    payload: {
      signal: anomaly.signal,
      event: anomaly.event,
      severity: anomaly.severity,
      reason: anomaly.reason,
      observed: anomaly.observed,
      baselineMean: anomaly.baselineMean ?? null,
      baselineStd: anomaly.baselineStd ?? null,
      baselineSamples: anomaly.baselineSamples ?? null,
      sampleWindowMinutes: anomaly.sampleWindowMinutes ?? null,
      type: anomaly.type,
      triggeredAt: new Date().toISOString(),
    },
    status: "PENDING",
    scheduled_for: new Date().toISOString(),
  });

  if (error) {
    console.error("metrics-anomaly-detector.enqueue_failed", { error, anomaly });
  }
};

const recordAnomalyMetric = async (supabase: ReturnType<typeof createClient>, anomaly: Anomaly) => {
  const metricEvent = `anomaly_detected.${anomaly.signal}`;
  await recordMetric(supabase, metricEvent, 1, {
    signal: anomaly.signal,
    event: anomaly.event,
    severity: anomaly.severity,
    reason: anomaly.reason,
    observed: anomaly.observed,
    baselineMean: anomaly.baselineMean ?? null,
    baselineStd: anomaly.baselineStd ?? null,
    baselineSamples: anomaly.baselineSamples ?? null,
    sampleWindowMinutes: anomaly.sampleWindowMinutes ?? null,
    type: anomaly.type,
  });
};

const collectSample = async (
  supabase: ReturnType<typeof createClient>,
  event: string,
  total: number,
  window: number
) => {
  const { error: insertError } = await supabase
    .from("system_metric_samples")
    .insert({ event, total });

  if (insertError) {
    console.error("metrics-anomaly-detector.sample_insert_failed", {
      event,
      error: insertError,
    });
    return;
  }

  const { data: samplesToTrim, error: fetchError } = await supabase
    .from("system_metric_samples")
    .select("id")
    .eq("event", event)
    .order("collected_at", { ascending: false })
    .range(window * 3, window * 3 + 1000);

  if (fetchError) {
    console.warn("metrics-anomaly-detector.sample_trim_lookup_failed", {
      event,
      error: fetchError,
    });
    return;
  }

  if (samplesToTrim && samplesToTrim.length > 0) {
    const ids = samplesToTrim.map((row) => row.id);
    const { error: trimError } = await supabase
      .from("system_metric_samples")
      .delete()
      .in("id", ids);

    if (trimError) {
      console.warn("metrics-anomaly-detector.sample_trim_failed", {
        event,
        error: trimError,
      });
    }
  }
};

const cleanupStaleSamples = async (supabase: ReturnType<typeof createClient>) => {
  if (!Number.isFinite(SAMPLE_RETENTION_HOURS) || SAMPLE_RETENTION_HOURS <= 0) {
    return;
  }

  const cutoff = new Date(Date.now() - SAMPLE_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("system_metric_samples")
    .delete()
    .lt("collected_at", cutoff);

  if (error) {
    console.warn("metrics-anomaly-detector.cleanup_failed", { error });
  }
};

const detectRateAnomalies = async (
  supabase: ReturnType<typeof createClient>,
  metricsByEvent: Map<string, MetricRow>
): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];

  for (const detector of RATE_DETECTORS) {
    const metric = metricsByEvent.get(detector.event);
    const total = Number.isFinite(metric?.total) ? Number(metric?.total) : 0;

    await collectSample(supabase, detector.event, total, detector.window);

    const { data: samples, error } = await supabase
      .from("system_metric_samples")
      .select("total, collected_at")
      .eq("event", detector.event)
      .order("collected_at", { ascending: false })
      .limit(detector.window + 1);

    if (error) {
      console.warn("metrics-anomaly-detector.samples_fetch_failed", {
        event: detector.event,
        error,
      });
      continue;
    }

    if (!samples || samples.length < detector.minBaselineSamples + 1) {
      continue;
    }

    const stats = calculateStats(samples as SampleRow[]);
    if (!stats) {
      continue;
    }

    const { latestDelta, baselineMean, baselineStd, baselineSamples, zeroStreak } = stats;

    if (baselineSamples < detector.minBaselineSamples) {
      continue;
    }

    let anomaly: Anomaly | null = null;

    if (
      detector.zeroWindow &&
      zeroStreak >= detector.zeroWindow &&
      baselineMean >= detector.minBaselineMean
    ) {
      anomaly = {
        signal: detector.signal,
        event: detector.event,
        severity: "critical",
        reason: `No activity for ${zeroStreak} intervals with baseline ${baselineMean.toFixed(2)}`,
        observed: latestDelta,
        baselineMean,
        baselineStd,
        baselineSamples,
        sampleWindowMinutes: detector.window * 5,
        type: "zero_activity",
      };
    } else {
      if (detector.minDelta && latestDelta < detector.minDelta) {
        continue;
      }

      const spikeThreshold =
        baselineStd > 0
          ? baselineMean + detector.zThreshold * baselineStd
          : baselineMean * detector.spikeMultiplier;

      if (
        baselineMean >= detector.minBaselineMean &&
        latestDelta <= baselineMean * detector.dropTolerance
      ) {
        anomaly = {
          signal: detector.signal,
          event: detector.event,
          severity: baselineMean >= detector.minBaselineMean * 2 ? "critical" : "warning",
          reason: `Activity drop: latest delta ${latestDelta.toFixed(2)} vs baseline ${baselineMean.toFixed(2)}`,
          observed: latestDelta,
          baselineMean,
          baselineStd,
          baselineSamples,
          sampleWindowMinutes: detector.window * 5,
          type: "rate_drop",
        };
      } else if (baselineStd > 0 && latestDelta >= spikeThreshold) {
        anomaly = {
          signal: detector.signal,
          event: detector.event,
          severity: latestDelta >= spikeThreshold * 1.5 ? "critical" : "warning",
          reason: `Spike detected: latest delta ${latestDelta.toFixed(2)} vs baseline ${baselineMean.toFixed(2)}`,
          observed: latestDelta,
          baselineMean,
          baselineStd,
          baselineSamples,
          sampleWindowMinutes: detector.window * 5,
          type: "rate_spike",
        };
      } else if (
        baselineStd === 0 &&
        baselineMean > 0 &&
        latestDelta >= baselineMean * detector.spikeMultiplier
      ) {
        anomaly = {
          signal: detector.signal,
          event: detector.event,
          severity: "warning",
          reason: `Spike detected without variance: latest ${latestDelta.toFixed(2)} vs baseline ${baselineMean.toFixed(2)}`,
          observed: latestDelta,
          baselineMean,
          baselineStd,
          baselineSamples,
          sampleWindowMinutes: detector.window * 5,
          type: "rate_spike",
        };
      }
    }

    if (anomaly) {
      anomalies.push(anomaly);
    }
  }

  return anomalies;
};

const detectThresholdAnomalies = async (
  supabase: ReturnType<typeof createClient>
): Promise<Anomaly[]> => {
  const anomalies: Anomaly[] = [];
  const detectors = buildThresholdDetectors(supabase);

  for (const detector of detectors) {
    const observed = await detector.query();
    if (observed >= detector.threshold) {
      anomalies.push({
        signal: detector.signal,
        event: detector.title,
        severity: detector.severity,
        reason: `${detector.title} exceeded threshold (${observed} ≥ ${detector.threshold})`,
        observed,
        type: "absolute_threshold",
      });
    }
  }

  return anomalies;
};

serveWithObservability("metrics-anomaly-detector", async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }

    const validation = await validateHmacRequest(req, { toleranceSeconds: 120 });

    if (!validation.ok) {
      console.warn("metrics-anomaly-detector.signature_invalid", { reason: validation.reason });
      const status = validation.reason === "stale_timestamp" ? 408 : 401;
      return new Response(JSON.stringify({ success: false, error: "invalid_signature" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const { data: metricRows, error: metricError } = await supabase
      .from("system_metrics")
      .select("event, total, last_occurred")
      .limit(2000);

    if (metricError) {
      throw metricError;
    }

    const metricsByEvent = new Map<string, MetricRow>();
    for (const row of metricRows as MetricRow[]) {
      metricsByEvent.set(row.event, row);
    }

    const [rateAnomalies, thresholdAnomalies] = await Promise.all([
      detectRateAnomalies(supabase, metricsByEvent),
      detectThresholdAnomalies(supabase),
    ]);

    const anomalies = [...rateAnomalies, ...thresholdAnomalies];

    await cleanupStaleSamples(supabase);

    if (anomalies.length === 0) {
      return new Response(JSON.stringify({ success: true, anomalies: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const anomaly of anomalies) {
      console.warn("metrics-anomaly-detector.anomaly", anomaly);
      await recordAnomalyMetric(supabase, anomaly);
      await enqueueAlert(supabase, anomaly);
    }

    return new Response(JSON.stringify({ success: true, anomalies: anomalies.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("metrics-anomaly-detector error", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
