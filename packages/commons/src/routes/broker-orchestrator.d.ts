declare const brokerOrchestratorBackgroundDefinitions: Readonly<{
    readonly whatsappInbound: {
        readonly kind: "kafka";
        readonly topic: "whatsapp.inbound";
        readonly role: "consumer";
        readonly description: "Consumes WhatsApp inbound events for orchestration";
    };
    readonly voiceContactEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.contact.events";
        readonly role: "consumer";
        readonly description: "Consumes real-time voice contact updates";
    };
    readonly sipEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.sip.events";
        readonly role: "consumer";
        readonly description: "Consumes SIP ingress events for orchestration hooks";
    };
    readonly brokerOutbound: {
        readonly kind: "kafka";
        readonly topic: "broker.outbound";
        readonly role: "producer";
        readonly description: "Emits downstream events for agent follow-up actions";
    };
}>;
export type BrokerOrchestratorBackgroundTriggers = typeof brokerOrchestratorBackgroundDefinitions;
export type BrokerOrchestratorBackgroundKey = keyof BrokerOrchestratorBackgroundTriggers;
export declare const brokerOrchestratorBackgroundTriggers: Readonly<{
    readonly whatsappInbound: {
        readonly kind: "kafka";
        readonly topic: "whatsapp.inbound";
        readonly role: "consumer";
        readonly description: "Consumes WhatsApp inbound events for orchestration";
    };
    readonly voiceContactEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.contact.events";
        readonly role: "consumer";
        readonly description: "Consumes real-time voice contact updates";
    };
    readonly sipEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.sip.events";
        readonly role: "consumer";
        readonly description: "Consumes SIP ingress events for orchestration hooks";
    };
    readonly brokerOutbound: {
        readonly kind: "kafka";
        readonly topic: "broker.outbound";
        readonly role: "producer";
        readonly description: "Emits downstream events for agent follow-up actions";
    };
}>;
export declare const getBrokerOrchestratorBackgroundTrigger: <Key extends BrokerOrchestratorBackgroundKey>(key: Key) => Readonly<{
    readonly whatsappInbound: {
        readonly kind: "kafka";
        readonly topic: "whatsapp.inbound";
        readonly role: "consumer";
        readonly description: "Consumes WhatsApp inbound events for orchestration";
    };
    readonly voiceContactEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.contact.events";
        readonly role: "consumer";
        readonly description: "Consumes real-time voice contact updates";
    };
    readonly sipEvents: {
        readonly kind: "kafka";
        readonly topic: "voice.sip.events";
        readonly role: "consumer";
        readonly description: "Consumes SIP ingress events for orchestration hooks";
    };
    readonly brokerOutbound: {
        readonly kind: "kafka";
        readonly topic: "broker.outbound";
        readonly role: "producer";
        readonly description: "Emits downstream events for agent follow-up actions";
    };
}>[Key];
export {};
//# sourceMappingURL=broker-orchestrator.d.ts.map