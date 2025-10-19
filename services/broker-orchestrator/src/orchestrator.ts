import axios from "axios";
import { KafkaFactory, KafkaConsumer, KafkaProducer, RetryPolicy, IdempotencyStore } from "@easymo/messaging";
import { settings } from "./config";
import { logger } from "./logger";
import { chargeWallet } from "./wallet";

export class BrokerOrchestrator {
  private readonly consumer: KafkaConsumer;
  private readonly producer: KafkaProducer;
  private readonly retryPolicy = new RetryPolicy({ attempts: 3, backoffMs: 200 });
  private readonly idempotency: IdempotencyStore;

  constructor(factory: KafkaFactory) {
    this.consumer = factory.createConsumer({
      options: {
        groupId: `${settings.kafka.clientId}-group`,
      },
      logger,
    });
    this.producer = factory.createProducer({ logger });
    this.idempotency = new IdempotencyStore({ redisUrl: settings.redisUrl, namespace: "broker-orch", ttlSeconds: 3600, logger });
  }

  async start() {
    await Promise.all([this.consumer.connect(), this.producer.connect(), this.idempotency.connect()]);
    await this.consumer.subscribe(settings.kafka.topics.whatsapp);
    await this.consumer.subscribe(settings.kafka.topics.voiceContact);
    await this.consumer.subscribe(settings.kafka.topics.sip);

    await this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        const value = message.value.toString();
        try {
          const payload = JSON.parse(value);
          const key = `${topic}:${payload.messageId ?? payload.callId ?? payload.id}`;
          await this.idempotency.execute(key, async () => {
            if (topic === settings.kafka.topics.whatsapp) {
              await this.handleWhatsapp(payload);
            } else if (topic === settings.kafka.topics.voiceContact) {
              await this.handleVoice(payload);
            } else if (topic === settings.kafka.topics.sip) {
              await this.handleSip(payload);
            }
            return {};
          });
        } catch (error) {
          logger.error({ msg: "broker.orchestrator.message_error", topic, value, error });
        }
      },
    });
  }

  private async handleWhatsapp(payload: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    logger.info({ msg: "broker.orchestrator.whatsapp", payload });
    if (payload.optOut) {
      await this.producer.send({
        topic: settings.kafka.topics.brokerOutbound,
        messages: [{ value: JSON.stringify({ type: "opt_out", channel: "whatsapp", contact: payload.from }) }],
      });
      return;
    }

    const lead = await this.fetchLead(payload.from);
    await this.producer.send({
      topic: settings.kafka.topics.brokerOutbound,
      messages: [{
        value: JSON.stringify({
          type: "intent.captured",
          source: "whatsapp",
          messageId: payload.messageId,
          lead,
          text: payload.text,
        }),
      }],
    });
  }

  private async handleVoice(payload: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    logger.info({ msg: "broker.orchestrator.voice", payload });
    if (payload.type === "call.opt_out") {
      await this.producer.send({
        topic: settings.kafka.topics.brokerOutbound,
        messages: [{ value: JSON.stringify({ type: "opt_out", channel: "voice", contact: payload.callSid }) }],
      });
    }
  }

  private async handleSip(payload: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (payload.event === "connected") {
      await this.producer.send({
        topic: settings.kafka.topics.brokerOutbound,
        messages: [{ value: JSON.stringify({ type: "call.connected", callId: payload.callId }) }],
      });
    }
  }

  private async fetchLead(reference: string) {
    const response = await this.retryPolicy.execute(async () => {
      return await axios.post(`${settings.agentCoreUrl}/tools/fetch-lead`, {
        tenantId: "a4a8cf2d-0a4f-446c-8bf2-28509641158f",
        phone: reference.startsWith("+") ? reference : `+${reference}`,
      }, {
        headers: {
          "x-agent-jwt": "stub",
        },
      });
    });
    const lead = response.data ?? { phone: reference };

    if (lead.walletEligible) {
      await chargeWallet({ customerRef: reference, amount: 0, currency: "USD" });
    }
    return lead;
  }
}
