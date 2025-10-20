import WebSocket from "ws";
import { OpenAIRealtimeClient } from "./openaiRealtime";
import { settings } from "./config";
import { logger } from "./logger";
import { KafkaFactory, KafkaProducer, IdempotencyStore } from "@easymo/messaging";
import { liveCallRegistry } from "./liveCallRegistry";

export class TwilioMediaSession {
  private readonly openai: OpenAIRealtimeClient;
  private readonly producer: KafkaProducer;
  private readonly idempotency: IdempotencyStore;
  private readonly callSid: string;
  private readonly direction: "inbound" | "outbound";
  private readonly leadPhone: string;
  private readonly leadName: string | null;
  private readonly tenantId?: string;
  private readonly agentRegion?: string | null;

  constructor(
    private readonly connection: WebSocket,
    kafkaFactory: KafkaFactory,
    redisUrl: string,
    callSid: string,
    metadata: {
      direction: "inbound" | "outbound";
      leadPhone: string;
      leadName?: string | null;
      tenantId?: string | null;
      region?: string | null;
    },
  ) {
    this.callSid = callSid;
    this.direction = metadata.direction;
    this.leadPhone = metadata.leadPhone;
    this.leadName = metadata.leadName ?? null;
    this.tenantId = metadata.tenantId ?? undefined;
    this.agentRegion = metadata.region ?? null;

    this.openai = new OpenAIRealtimeClient(callSid);
    this.producer = kafkaFactory.createProducer();
    this.idempotency = new IdempotencyStore({ redisUrl, ttlSeconds: 60 * 60, namespace: "twilio-media" });
  }

  async bootstrap() {
    await Promise.all([this.openai.connect(), this.producer.connect(), this.idempotency.connect()]);
    this.openai.sendText(settings.compliancePrompt);
    liveCallRegistry.startSession(
      this.callSid,
      this.direction,
      this.leadPhone,
      this.leadName,
      this.agentRegion,
      this.tenantId,
    );
    this.connection.on("message", (raw) => this.handleMessage(raw.toString()));
    this.connection.on("close", () => this.teardown());
  }

  private async handleMessage(payload: string) {
    try {
      const message = JSON.parse(payload) as {
        event: string;
        sequenceNumber?: number;
        media?: { payload: string };
        start?: { callSid: string };
        stop?: unknown;
        mark?: { name?: string; queue?: string };
        transcription?: { text: string };
      };
      switch (message.event) {
        case "start":
          await this.producer.send({
            topic: settings.kafka.contactTopic,
            messages: [{
              value: JSON.stringify({
                type: "call.start",
                callSid: this.callSid,
                timestamp: Date.now(),
              }),
            }],
          });
          break;
        case "media": {
          if (!message.media?.payload) return;
          const buffer = Buffer.from(message.media.payload, "base64");
          this.openai.sendAudio(buffer);
          liveCallRegistry.updateMedia(this.callSid, buffer.length);
          await this.producer.send({
            topic: settings.kafka.mediaTopic,
            messages: [{
              value: JSON.stringify({
                type: "media.sample",
                callSid: this.callSid,
                sequence: message.sequenceNumber,
                size: buffer.length,
              }),
            }],
          });
          break;
        }
        case "mark":
          if (message.mark?.name === "warm_transfer" && message.mark?.queue) {
            liveCallRegistry.markWarmTransfer(this.callSid, message.mark.queue);
          }
          break;
        case "transcription":
          if (message.transcription?.text) {
            await this.handleTranscription(message.transcription.text);
          }
          break;
        case "stop":
          await this.producer.send({
            topic: settings.kafka.contactTopic,
            messages: [{ value: JSON.stringify({ type: "call.stop", callSid: this.callSid, timestamp: Date.now() }) }],
          });
          this.teardown();
          break;
        default:
          logger.debug({ msg: "twilio.event.ignored", event: message.event });
      }
    } catch (error) {
      logger.error({ msg: "twilio.message.error", error });
    }
  }

  async handleTranscription(text: string) {
    if (settings.twilio.optOutRegex.test(text)) {
      logger.warn({ msg: "twilio.optout.detected", callSid: this.callSid });
      await this.idempotency.execute(`${this.callSid}:optout`, async () => {
        await this.producer.send({
          topic: settings.kafka.contactTopic,
          messages: [{ value: JSON.stringify({ type: "call.opt_out", callSid: this.callSid, text, timestamp: Date.now() }) }],
        });
        liveCallRegistry.registerOptOut(this.callSid, text);
        return {};
      });
    }
    this.openai.sendText(text);
  }

  private async teardown() {
    logger.info({ msg: "twilio.session.teardown", callSid: this.callSid });
    this.openai.close();
    liveCallRegistry.endSession(this.callSid);
    setTimeout(() => liveCallRegistry.remove(this.callSid), 5 * 60 * 1000);
    await Promise.all([this.producer.disconnect(), this.idempotency.disconnect()]).catch(() => undefined);
  }
}
