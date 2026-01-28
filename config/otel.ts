/**
 * OpenTelemetry configuration for distributed tracing
 * Implements EasyMO Ground Rules observability requirements
 */

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

/**
 * Initialize OpenTelemetry tracing
 * Call this once at application startup
 */
export function startOTel(): NodeSDK | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  
  // Skip if not configured (e.g., in development)
  if (!endpoint) {
    console.warn("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping telemetry initialization");
    return null;
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || "ai-agents";

  const exporter = new OTLPTraceExporter({
    url: endpoint,
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
    traceExporter: exporter,
  });

  try {
    sdk.start();
    console.log("OpenTelemetry tracing initialized", { serviceName, endpoint });
    return sdk;
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry", { error });
    return null;
  }
}

/**
 * Gracefully shutdown OpenTelemetry
 * Call this on application shutdown
 */
export async function shutdownOTel(sdk: NodeSDK | null): Promise<void> {
  if (sdk) {
    try {
      await sdk.shutdown();
      console.log("OpenTelemetry shut down successfully");
    } catch (error) {
      console.error("Error shutting down OpenTelemetry", { error });
    }
  }
}
