import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'agent-core' });

let sdk: NodeSDK | null = null;

export const initialiseTelemetry = () => {
  if (sdk) return sdk;
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "agent-core",
      [SemanticResourceAttributes.SERVICE_NAMESPACE]: "easymo",
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-express": {
          enabled: true,
        },
        "@opentelemetry/instrumentation-pino": {
          enabled: true,
        },
      }),
    ],
  });
  const startResult = sdk.start() as unknown;
  if (startResult && typeof (startResult as Promise<void>).catch === "function") {
    (startResult as Promise<void>).catch((error) => {
      log.warn("opentelemetry init failed", error);
    });
  }
  process.once("SIGTERM", () => {
    sdk?.shutdown().catch(() => undefined);
  });
  process.once("SIGINT", () => {
    sdk?.shutdown().catch(() => undefined);
  });
  return sdk;
};
