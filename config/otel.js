"use strict";
/**
 * OpenTelemetry configuration for distributed tracing
 * Implements EasyMO Ground Rules observability requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOTel = startOTel;
exports.shutdownOTel = shutdownOTel;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
/**
 * Initialize OpenTelemetry tracing
 * Call this once at application startup
 */
function startOTel() {
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    // Skip if not configured (e.g., in development)
    if (!endpoint) {
        console.warn("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping telemetry initialization");
        return null;
    }
    const serviceName = process.env.OTEL_SERVICE_NAME || "ai-agents";
    const exporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: endpoint,
    });
    const sdk = new sdk_node_1.NodeSDK({
        resource: new resources_1.Resource({
            [semantic_conventions_1.SEMRESATTRS_SERVICE_NAME]: serviceName,
        }),
        traceExporter: exporter,
    });
    try {
        sdk.start();
        console.log("OpenTelemetry tracing initialized", { serviceName, endpoint });
        return sdk;
    }
    catch (error) {
        console.error("Failed to initialize OpenTelemetry", { error });
        return null;
    }
}
/**
 * Gracefully shutdown OpenTelemetry
 * Call this on application shutdown
 */
async function shutdownOTel(sdk) {
    if (sdk) {
        try {
            await sdk.shutdown();
            console.log("OpenTelemetry shut down successfully");
        }
        catch (error) {
            console.error("Error shutting down OpenTelemetry", { error });
        }
    }
}
