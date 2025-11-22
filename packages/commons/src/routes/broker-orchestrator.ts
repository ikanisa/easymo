// Broker orchestrator operates solely via Kafka topics; no HTTP endpoints are exposed.
import { type BackgroundTriggerDefinition,defineBackgroundTriggers } from "./utils";

const brokerOrchestratorBackgroundDefinitions = defineBackgroundTriggers({
  whatsappInbound: {
    kind: "kafka" as const,
    topic: "whatsapp.inbound" as const,
    role: "consumer" as const,
    description: "Consumes WhatsApp inbound events for orchestration",
  },
  voiceContactEvents: {
    kind: "kafka" as const,
    topic: "voice.contact.events" as const,
    role: "consumer" as const,
    description: "Consumes real-time voice contact updates",
  },
  sipEvents: {
    kind: "kafka" as const,
    topic: "voice.sip.events" as const,
    role: "consumer" as const,
    description: "Consumes SIP ingress events for orchestration hooks",
  },
  brokerOutbound: {
    kind: "kafka" as const,
    topic: "broker.outbound" as const,
    role: "producer" as const,
    description: "Emits downstream events for agent follow-up actions",
  },
} as const satisfies Record<string, BackgroundTriggerDefinition>);

export type BrokerOrchestratorBackgroundTriggers = typeof brokerOrchestratorBackgroundDefinitions;
export type BrokerOrchestratorBackgroundKey = keyof BrokerOrchestratorBackgroundTriggers;

export const brokerOrchestratorBackgroundTriggers = brokerOrchestratorBackgroundDefinitions;

export const getBrokerOrchestratorBackgroundTrigger = <Key extends BrokerOrchestratorBackgroundKey>(key: Key) =>
  brokerOrchestratorBackgroundTriggers[key];
