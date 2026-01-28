/**
 * Metrics Emission Helpers
 *
 * High-level functions for emitting Moltbot metrics.
 * Use these instead of directly calling the registry.
 */

import { registry, METRIC_DEFINITIONS } from "./registry";
import { createLogger } from "../audit/logger";

const log = createLogger({ service: "metrics" });

// ============================================================================
// Request Metrics
// ============================================================================

export function recordRequestCreated(channel = "whatsapp", language = "en"): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.requests_created_total.name,
        { channel, language },
    );
}

export function recordRequestCompleted(finalState: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.requests_completed_total.name,
        { final_state: finalState },
    );
}

export function recordTimeToShortlist(
    seconds: number,
    hasOcr: boolean,
    vendorCount: number,
): void {
    const vendorBucket = vendorCount <= 5 ? "0-5" : vendorCount <= 10 ? "6-10" : "11+";
    registry.observeHistogram(
        METRIC_DEFINITIONS.time_to_shortlist_seconds.name,
        { has_ocr: hasOcr ? "true" : "false", vendor_count_bucket: vendorBucket },
        seconds,
    );
}

// ============================================================================
// Vendor Metrics
// ============================================================================

export function recordVendorMessageSent(batchNumber: number): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.vendor_messages_sent_total.name,
        { batch_number: String(batchNumber) },
    );
}

export function recordVendorReply(replyType: "positive" | "negative" | "unclear"): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.vendor_replies_total.name,
        { reply_type: replyType },
    );
}

export function setVendorReplyRate(rate: number): void {
    registry.setGauge(
        METRIC_DEFINITIONS.vendor_reply_rate.name,
        {},
        rate,
    );
}

// ============================================================================
// OCR Metrics
// ============================================================================

export function recordOcrJobCreated(provider = "gemini", mediaType = "image"): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.ocr_jobs_total.name,
        { provider, media_type: mediaType },
    );
}

export function recordOcrFailure(provider = "gemini", errorType: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.ocr_failures_total.name,
        { provider, error_type: errorType },
    );
}

export function recordOcrConfidence(provider = "gemini", confidence: number): void {
    registry.observeHistogram(
        METRIC_DEFINITIONS.ocr_confidence.name,
        { provider },
        confidence,
    );
}

// ============================================================================
// Moltbot AI Metrics
// ============================================================================

export function recordMoltbotCall(toolInvoked?: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.moltbot_calls_total.name,
        { tool_invoked: toolInvoked ?? "none" },
    );
}

export function recordMoltbotRejection(rejectionReason: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.moltbot_output_rejected_total.name,
        { rejection_reason: rejectionReason },
    );

    log.warn({
        msg: "moltbot_output_rejected",
        rejection_reason: rejectionReason,
    });
}

export function recordMoltbotLatency(seconds: number): void {
    registry.observeHistogram(
        METRIC_DEFINITIONS.moltbot_latency_seconds.name,
        {},
        seconds,
    );
}

// ============================================================================
// Calling Metrics
// ============================================================================

export function recordCallStarted(consentType = "concierge"): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.calls_started_total.name,
        { consent_type: consentType },
    );
}

export function recordCallFailed(failureReason: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.calls_failed_total.name,
        { failure_reason: failureReason },
    );
}

// ============================================================================
// Budget Metrics
// ============================================================================

export function recordBudgetExceeded(budgetType: string): void {
    registry.incrementCounter(
        METRIC_DEFINITIONS.budget_exceeded_total.name,
        { budget_type: budgetType },
    );

    log.warn({
        msg: "budget_exceeded",
        budget_type: budgetType,
    });
}

// ============================================================================
// Export
// ============================================================================

export { registry } from "./registry";

/**
 * Get all metrics in Prometheus text format
 */
export function getPrometheusMetrics(): string {
    return registry.exportPrometheus();
}

/**
 * Get all metrics as JSON (for debugging)
 */
export function getMetricsJson(): Record<string, unknown> {
    return registry.toJSON();
}
