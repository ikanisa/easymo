import express from "express";
import bodyParser from "body-parser";
import pinoHttp from "pino-http";
import { z } from "zod";
import { randomUUID } from "crypto";
import { KafkaFactory, KafkaProducer, IdempotencyStore } from "@easymo/messaging";
import { settings } from "./config";
import { logger } from "./logger";

const app = express();
app.use(bodyParser.json({ limit: "1mb" }));
app.use(pinoHttp({ logger: logger as any }));

const kafkaFactory = new KafkaFactory({ clientId: settings.kafka.clientId, brokers: settings.kafka.brokers, logger });
const producer = kafkaFactory.createProducer();
const store = new IdempotencyStore({ redisUrl: settings.redisUrl, namespace: "whatsapp" });

const MetaWebhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messages: z.array(z.object({
          from: z.string(),
          id: z.string(),
          timestamp: z.string(),
          text: z.object({ body: z.string() }).optional(),
          type: z.string(),
        })).optional(),
        statuses: z.array(z.any()).optional(),
      }),
      field: z.string(),
    })),
  })),
});

app.get("/webhook", (req, res) => {
  const verifyToken = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (verifyToken === settings.meta.verifyToken) {
    res.status(200).send(challenge as string);
  } else {
    res.status(403).send("Verification failed");
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const payload = MetaWebhookSchema.parse(req.body);
    const messages = payload.entry.flatMap((entry) => entry.changes.flatMap((change) => change.value.messages ?? []));
    await Promise.all(messages.map(async (message) => {
      const text = message.text?.body ?? "";
      const idempotencyKey = message.id;
      await store.execute(idempotencyKey, async () => {
        const event = {
          messageId: message.id,
          from: message.from,
          timestamp: Number(message.timestamp) * 1000,
          type: message.type,
          text,
          optOut: settings.optOutRegex.test(text),
        };
        await producer.send({
          topic: settings.kafka.inboundTopic,
          messages: [{ value: JSON.stringify(event), headers: { "x-message-id": randomUUID() } }],
        });
        if (event.optOut) {
          await producer.send({
            topic: settings.kafka.outboundTopic,
            messages: [{ value: JSON.stringify({ type: "opt_out", from: event.from, timestamp: event.timestamp }) }],
          });
        }
        return {};
      });
    }));
    res.sendStatus(200);
  } catch (error) {
    logger.error({ msg: "whatsapp.webhook.error", error });
    res.status(400).json({ error: (error as Error).message });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function bootstrap() {
  await Promise.all([producer.connect(), store.connect()]);
  const server = app.listen(settings.port, () => {
    logger.info({ msg: "whatsapp-bot.listen", port: settings.port });
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
  logger.error({ msg: "whatsapp-bot.bootstrap_failed", error });
  process.exit(1);
});
