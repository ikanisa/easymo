import WebSocket from "ws";
import { fetch } from "undici";
import { OpenAIRealtimeClient } from "./openaiRealtime";
import { settings } from "./config";
import { logger } from "./logger";
import { KafkaFactory, KafkaProducer, IdempotencyStore } from "@easymo/messaging";
import { liveCallRegistry } from "./liveCallRegistry";

type SessionBootstrapResponse = {
  config: Record<string, unknown>;
  callId?: string;
  agentProfile?: string;
  agentDisplayName?: string;
};

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
  private readonly fromNumber?: string | null;
  private readonly toNumber?: string | null;
  private readonly locale?: string | null;
  private readonly country?: string | null;
  private agentProfile: string;
  private callId: string | null = null;
  private streamSid?: string;

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
      profile?: string | null;
      fromNumber?: string | null;
      toNumber?: string | null;
      locale?: string | null;
      country?: string | null;
    },
  ) {
    this.callSid = callSid;
    this.direction = metadata.direction;
    this.leadPhone = metadata.leadPhone;
    this.leadName = metadata.leadName ?? null;
    this.tenantId = metadata.tenantId ?? undefined;
    this.agentRegion = metadata.region ?? null;
    this.fromNumber = metadata.fromNumber ?? null;
    this.toNumber = metadata.toNumber ?? null;
    this.locale = metadata.locale ?? null;
    this.country = metadata.country ?? null;
    this.agentProfile = (metadata.profile ?? settings.agent.defaultProfile).toString();

    this.openai = new OpenAIRealtimeClient(callSid);
    this.producer = kafkaFactory.createProducer();
    this.idempotency = new IdempotencyStore({ redisUrl, ttlSeconds: 60 * 60, namespace: "twilio-media" });
  }

  async bootstrap() {
    await Promise.all([this.openai.connect(), this.producer.connect(), this.idempotency.connect()]);
    this.openai.onOutputAudioDelta((audioB64) => {
      this.sendAudioToTwilio(audioB64);
    });

    const session = await this.fetchSessionConfig();
    if (session) {
      this.callId = session.callId ?? null;
      if (session.agentProfile) {
        this.agentProfile = session.agentProfile;
      }
      this.openai.initializeSession(session.config);
    }

    liveCallRegistry.startSession(
      this.callSid,
      this.direction,
      this.leadPhone,
      this.leadName,
      this.agentRegion,
      this.tenantId,
      this.callId,
      this.agentProfile,
    );

    this.openai.sendText(settings.compliancePrompt);
    this.connection.on("message", (raw) => this.handleMessage(raw.toString()));
    this.connection.on("close", () => this.teardown());
  }

  private buildSessionRequest(): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      lead_phone: this.leadPhone,
    };
    if (this.leadName) metadata.lead_name = this.leadName;
    if (this.tenantId) metadata.tenant_id = this.tenantId;
    if (this.agentRegion) metadata.region = this.agentRegion;
    metadata.direction = this.direction;

    const payload: Record<string, unknown> = {
      from: this.fromNumber ?? (this.direction === "inbound" ? this.leadPhone : undefined),
      to: this.toNumber ?? (this.direction === "outbound" ? this.leadPhone : undefined),
      locale: this.locale ?? undefined,
      country: this.country ?? undefined,
      project_id: this.tenantId ?? undefined,
      agent_profile: this.agentProfile,
      direction: this.direction,
      twilio_call_sid: this.callSid,
      metadata,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });

    return payload;
  }

  private async fetchSessionConfig(): Promise<SessionBootstrapResponse | null> {
    try {
      const response = await fetch(settings.backend.sessionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${settings.backend.sharedSecret}`,
        },
        body: JSON.stringify(this.buildSessionRequest()),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({
          msg: "realtime.session_config.failed",
          status: response.status,
          error: errorText,
          callSid: this.callSid,
        });
        return null;
      }

      const parsed = (await response.json()) as SessionBootstrapResponse;
      return parsed;
    } catch (error) {
      logger.error({ msg: "realtime.session_config.error", error, callSid: this.callSid });
      return null;
    }
  }

  private async handleMessage(payload: string) {
    try {
      const message = JSON.parse(payload) as {
        event: string;
        sequenceNumber?: number;
        media?: { payload: string };
        start?: { callSid: string; streamSid?: string };
        stop?: unknown;
        mark?: { name?: string; queue?: string };
        transcription?: { text: string };
      };
      switch (message.event) {
        case "start":
          this.streamSid = message.start?.streamSid ?? this.streamSid;
          await this.producer.send({
            topic: settings.kafka.contactTopic,
            messages: [{
              value: JSON.stringify({
                type: "call.start",
                callSid: this.callSid,
                callId: this.callId,
                timestamp: Date.now(),
              }),
            }],
          });
          break;
        case "media": {
          if (!message.media?.payload) return;
          const buffer = Buffer.from(message.media.payload, "base64");
          this.openai.sendAudio(buffer);
          this.openai.commitAudioAndRequestResponse();
          liveCallRegistry.updateMedia(this.callSid, buffer.length);
          await this.producer.send({
            topic: settings.kafka.mediaTopic,
            messages: [{
              value: JSON.stringify({
                type: "media.sample",
                callSid: this.callSid,
                callId: this.callId,
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
            messages: [{
              value: JSON.stringify({
                type: "call.stop",
                callSid: this.callSid,
                callId: this.callId,
                timestamp: Date.now(),
              }),
            }],
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

  private sendAudioToTwilio(audioBase64: string) {
    if (!this.streamSid) return;
    const frame = {
      event: "media",
      streamSid: this.streamSid,
      media: { payload: audioBase64 },
    };
    try {
      this.connection.send(JSON.stringify(frame));
    } catch (error) {
      logger.warn({ msg: "twilio.send_audio.failed", error });
    }
  }

  async handleTranscription(text: string) {
    if (settings.twilio.optOutRegex.test(text)) {
      logger.warn({ msg: "twilio.optout.detected", callSid: this.callSid });
      await this.idempotency.execute(`${this.callSid}:optout`, async () => {
        await this.producer.send({
          topic: settings.kafka.contactTopic,
          messages: [{
            value: JSON.stringify({
              type: "call.opt_out",
              callSid: this.callSid,
              callId: this.callId,
              text,
              timestamp: Date.now(),
            }),
          }],
        });
        liveCallRegistry.registerOptOut(this.callSid, text);
        return {};
      });
    }
    this.openai.sendText(text);
  }

  private async teardown() {
    logger.info({ msg: "twilio.session.teardown", callSid: this.callSid, callId: this.callId });
    this.openai.close();
    liveCallRegistry.endSession(this.callSid);
    setTimeout(() => liveCallRegistry.remove(this.callSid), 5 * 60 * 1000);
    await Promise.all([this.producer.disconnect(), this.idempotency.disconnect()]).catch(() => undefined);
  }
}
