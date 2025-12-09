// Broker orchestrator operates solely via Kafka topics; no HTTP endpoints are exposed.
import { defineBackgroundTriggers } from "./utils";
const brokerOrchestratorBackgroundDefinitions = defineBackgroundTriggers({
    whatsappInbound: {
        kind: "kafka",
        topic: "whatsapp.inbound",
        role: "consumer",
        description: "Consumes WhatsApp inbound events for orchestration",
    },
    voiceContactEvents: {
        kind: "kafka",
        topic: "voice.contact.events",
        role: "consumer",
        description: "Consumes real-time voice contact updates",
    },
    sipEvents: {
        kind: "kafka",
        topic: "voice.sip.events",
        role: "consumer",
        description: "Consumes SIP ingress events for orchestration hooks",
    },
    brokerOutbound: {
        kind: "kafka",
        topic: "broker.outbound",
        role: "producer",
        description: "Emits downstream events for agent follow-up actions",
    },
});
export const brokerOrchestratorBackgroundTriggers = brokerOrchestratorBackgroundDefinitions;
export const getBrokerOrchestratorBackgroundTrigger = (key) => brokerOrchestratorBackgroundTriggers[key];
