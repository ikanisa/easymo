type MetricSample = {
  metric: string;
  value: number;
  kind?: "count" | "gauge";
  tags?: Record<string, string>;
  timestamp?: string;
};

const METRICS_WEBHOOK_URL = Deno.env.get("INSURANCE_OCR_METRICS_WEBHOOK_URL");
const METRICS_TOKEN = Deno.env.get("INSURANCE_OCR_METRICS_TOKEN");

async function postMetric(sample: MetricSample): Promise<void> {
  if (!METRICS_WEBHOOK_URL) return;

  const payload = {
    metric: sample.metric,
    value: sample.value,
    kind: sample.kind ?? "gauge",
    tags: sample.tags ?? {},
    timestamp: sample.timestamp ?? new Date().toISOString(),
  };

  try {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (METRICS_TOKEN) {
      headers.authorization = `Bearer ${METRICS_TOKEN}`;
    }

    const response = await fetch(METRICS_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error("insurance-ocr.metrics_post_failed", {
        status: response.status,
        metric: payload.metric,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("insurance-ocr.metrics_post_error", {
      metric: sample.metric,
      message,
    });
  }
}

type RunResult = {
  status: "succeeded" | "skipped" | "failed" | "retry";
  outcome?: string;
};

export async function recordRunMetrics(
  results: RunResult[],
  remaining: number,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  tasks.push(
    postMetric({
      metric: "insurance_ocr.queue_remaining",
      value: remaining,
      kind: "gauge",
    }),
  );

  for (const result of results) {
    tasks.push(
      postMetric({
        metric: "insurance_ocr.processed",
        value: 1,
        kind: "count",
        tags: {
          status: result.status,
          outcome: result.outcome ?? "none",
        },
      }),
    );
  }

  await Promise.allSettled(tasks);
}
