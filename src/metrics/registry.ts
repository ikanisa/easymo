/**
 * Metrics Registry
 *
 * Prometheus-compatible metrics for Moltbot observability.
 * Designed to work with OpenTelemetry or direct Prometheus scraping.
 */

import { createLogger } from "../audit/logger";

const log = createLogger({ service: "metrics" });

// ============================================================================
// Types
// ============================================================================

type MetricType = "counter" | "gauge" | "histogram";

interface MetricDefinition {
    name: string;
    type: MetricType;
    help: string;
    labels?: string[];
}

interface MetricValue {
    value: number;
    labels: Record<string, string>;
    timestamp: number;
}

// ============================================================================
// Metric Definitions
// ============================================================================

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
    // Request metrics
    requests_created_total: {
        name: "moltbot_requests_created_total",
        type: "counter",
        help: "Total number of marketplace requests created",
        labels: ["channel", "language"],
    },
    requests_completed_total: {
        name: "moltbot_requests_completed_total",
        type: "counter",
        help: "Total number of marketplace requests completed",
        labels: ["final_state"],
    },

    // Time metrics
    time_to_shortlist_seconds: {
        name: "moltbot_time_to_shortlist_seconds",
        type: "histogram",
        help: "Time from request creation to shortlist ready",
        labels: ["has_ocr", "vendor_count_bucket"],
    },

    // Vendor metrics
    vendor_messages_sent_total: {
        name: "moltbot_vendor_messages_sent_total",
        type: "counter",
        help: "Total vendor outreach messages sent",
        labels: ["batch_number"],
    },
    vendor_replies_total: {
        name: "moltbot_vendor_replies_total",
        type: "counter",
        help: "Total vendor replies received",
        labels: ["reply_type"],
    },
    vendor_reply_rate: {
        name: "moltbot_vendor_reply_rate",
        type: "gauge",
        help: "Current vendor reply rate (rolling 24h)",
        labels: [],
    },

    // OCR metrics
    ocr_jobs_total: {
        name: "moltbot_ocr_jobs_total",
        type: "counter",
        help: "Total OCR jobs created",
        labels: ["provider", "media_type"],
    },
    ocr_failures_total: {
        name: "moltbot_ocr_failures_total",
        type: "counter",
        help: "Total OCR job failures",
        labels: ["provider", "error_type"],
    },
    ocr_confidence: {
        name: "moltbot_ocr_confidence",
        type: "histogram",
        help: "OCR extraction confidence scores",
        labels: ["provider"],
    },

    // Moltbot AI metrics
    moltbot_calls_total: {
        name: "moltbot_calls_total",
        type: "counter",
        help: "Total Moltbot AI calls",
        labels: ["tool_invoked"],
    },
    moltbot_output_rejected_total: {
        name: "moltbot_output_rejected_total",
        type: "counter",
        help: "Total Moltbot outputs rejected by safety gate",
        labels: ["rejection_reason"],
    },
    moltbot_latency_seconds: {
        name: "moltbot_latency_seconds",
        type: "histogram",
        help: "Moltbot call latency",
        labels: [],
    },

    // Calling metrics
    calls_started_total: {
        name: "moltbot_calls_started_total",
        type: "counter",
        help: "Total WhatsApp calls started",
        labels: ["consent_type"],
    },
    calls_failed_total: {
        name: "moltbot_calls_failed_total",
        type: "counter",
        help: "Total WhatsApp call failures",
        labels: ["failure_reason"],
    },

    // Budget metrics
    budget_exceeded_total: {
        name: "moltbot_budget_exceeded_total",
        type: "counter",
        help: "Total budget exceeded events",
        labels: ["budget_type"],
    },
};

// ============================================================================
// In-Memory Metric Storage (for development/export)
// ============================================================================

class MetricsRegistry {
    private counters: Map<string, number> = new Map();
    private gauges: Map<string, number> = new Map();
    private histograms: Map<string, number[]> = new Map();

    private makeKey(name: string, labels: Record<string, string>): string {
        const labelStr = Object.entries(labels)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}="${v}"`)
            .join(",");
        return labelStr ? `${name}{${labelStr}}` : name;
    }

    incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
        const key = this.makeKey(name, labels);
        const current = this.counters.get(key) ?? 0;
        this.counters.set(key, current + value);

        log.debug({
            msg: "metric_counter_inc",
            metric: name,
            labels,
            value,
            total: current + value,
        });
    }

    setGauge(name: string, labels: Record<string, string> = {}, value: number): void {
        const key = this.makeKey(name, labels);
        this.gauges.set(key, value);

        log.debug({
            msg: "metric_gauge_set",
            metric: name,
            labels,
            value,
        });
    }

    observeHistogram(name: string, labels: Record<string, string> = {}, value: number): void {
        const key = this.makeKey(name, labels);
        const values = this.histograms.get(key) ?? [];
        values.push(value);
        this.histograms.set(key, values);

        log.debug({
            msg: "metric_histogram_observe",
            metric: name,
            labels,
            value,
        });
    }

    /**
     * Export all metrics in Prometheus text format
     */
    exportPrometheus(): string {
        const lines: string[] = [];

        // Export counters
        for (const [key, value] of this.counters) {
            lines.push(`${key} ${value}`);
        }

        // Export gauges
        for (const [key, value] of this.gauges) {
            lines.push(`${key} ${value}`);
        }

        // Export histogram summaries (simplified)
        for (const [key, values] of this.histograms) {
            if (values.length === 0) continue;
            const sum = values.reduce((a, b) => a + b, 0);
            const count = values.length;
            lines.push(`${key}_sum ${sum}`);
            lines.push(`${key}_count ${count}`);
        }

        return lines.join("\n");
    }

    /**
     * Get all metrics as JSON for debugging
     */
    toJSON(): Record<string, unknown> {
        return {
            counters: Object.fromEntries(this.counters),
            gauges: Object.fromEntries(this.gauges),
            histograms: Object.fromEntries(
                Array.from(this.histograms.entries()).map(([k, v]) => [
                    k,
                    {
                        count: v.length,
                        sum: v.reduce((a, b) => a + b, 0),
                        min: Math.min(...v),
                        max: Math.max(...v),
                        avg: v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0,
                    },
                ]),
            ),
        };
    }

    /**
     * Reset all metrics (for testing)
     */
    reset(): void {
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
    }
}

// Global registry instance
export const registry = new MetricsRegistry();
