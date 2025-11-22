import { KafkaFactory } from "@easymo/messaging";

import { settings } from "./config";
import { logger } from "./logger";
import { BrokerOrchestrator } from "./orchestrator";

async function bootstrap() {
  const factory = new KafkaFactory({ clientId: settings.kafka.clientId, brokers: settings.kafka.brokers, logger });
  const orchestrator = new BrokerOrchestrator(factory);
  await orchestrator.start();
  logger.info({ msg: "broker-orchestrator.running" });
}

bootstrap().catch((error) => {
  logger.error({ msg: "broker-orchestrator.bootstrap_failed", error });
  process.exit(1);
});
