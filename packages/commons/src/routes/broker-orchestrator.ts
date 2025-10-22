import { defineBackgroundTriggers } from "./utils";

export type BrokerOrchestratorInterface = {
  transport: "kafka";
  inboundTopics: {
    whatsapp: string;
    voiceContact: string;
    sip: string;
  };
  outboundTopics: {
    brokerOutbound: string;
    retry: string;
  };
  notes: string;
};

export const brokerOrchestratorInterface = Object.freeze({
  transport: "kafka" as const,
  inboundTopics: {
    whatsapp: "whatsapp.inbound" as const,
    voiceContact: "voice.contact.events" as const,
    sip: "voice.sip.events" as const,
  },
  outboundTopics: {
    brokerOutbound: "broker.outbound" as const,
    retry: "broker.retry" as const,
  },
  notes:
    "Consumes channel events and emits broker orchestration results; there is no HTTP surface area for this service.",
} satisfies BrokerOrchestratorInterface);

export const brokerOrchestratorBackgroundTriggers = defineBackgroundTriggers({
  kafkaConsumers: {
    type: "queue",
    description: "Continuous Kafka consumer pipelines for WhatsApp, voice contact, and SIP events.",
  },
} as const);
