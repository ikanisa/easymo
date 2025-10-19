import express from "express";
import pinoHttp from "pino-http";
import { z } from "zod";
import { randomUUID } from "crypto";
import { KafkaFactory, KafkaProducer, IdempotencyStore } from "@easymo/messaging";
import { settings } from "./config";
import { logger } from "./logger";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger: logger as any }));

const kafkaFactory = new KafkaFactory({ clientId: settings.kafka.clientId, brokers: settings.kafka.brokers, logger });
const producer = kafkaFactory.createProducer();
const store = new IdempotencyStore({ redisUrl: settings.redisUrl, namespace: "sip" });

const SipEventSchema = z.object({
  callId: z.string().min(1),
  event: z.enum(["ringing", "connected", "audio", "ended", "dtmf"]),
  timestamp: z.coerce.number().default(() => Date.now()),
  payload: z.record(z.any()).optional(),
  idempotencyKey: z.string().optional(),
});

app.post("/sip/events", async (req, res) => {
  try {
    const body = SipEventSchema.parse(req.body);
    const idempotencyKey = body.idempotencyKey ?? `${body.callId}:${body.event}:${body.timestamp}`;
    await store.execute(idempotencyKey, async () => {
      await producer.send({
        topic: settings.kafka.eventTopic,
        messages: [{
          value: JSON.stringify({
            event: body.event,
            callId: body.callId,
            timestamp: body.timestamp,
            payload: body.payload ?? {},
            idempotencyKey,
          }),
          headers: {
            "x-message-id": randomUUID(),
          },
        }],
      });
      if (body.event === "ended") {
        await producer.send({
          topic: settings.kafka.contactTopic,
          messages: [{
            value: JSON.stringify({ type: "call.stop", callId: body.callId, timestamp: body.timestamp }),
          }],
        });
      }
      return {};
    });
    res.status(202).json({ status: "accepted" });
  } catch (error) {
    logger.error({ msg: "sip.ingress.error", error });
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function bootstrap() {
  await Promise.all([producer.connect(), store.connect()]);
  const server = app.listen(settings.port, () => {
    logger.info({ msg: "sip-ingress.listen", port: settings.port });
  });

  const shutdown = () => {
    server.close(async () => {
      await Promise.all([producer.disconnect(), store.disconnect()]);
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((error) => {
  logger.error({ msg: "sip-ingress.bootstrap_failed", error });
  process.exit(1);
});
