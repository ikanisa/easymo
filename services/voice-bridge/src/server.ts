import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import pinoHttp from "pino-http";
import { settings } from "./config";
import { logger } from "./logger";
import { TwilioMediaSession } from "./twilioSession";
import { KafkaFactory } from "@easymo/messaging";
import { liveCallRegistry } from "./liveCallRegistry";

const app = express();
app.use(express.json());
app.use(pinoHttp({ logger: logger as any }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/analytics/live-calls", (_req, res) => {
  res.json(liveCallRegistry.snapshot());
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/twilio-media" });

const kafkaFactory = new KafkaFactory({
  clientId: settings.kafka.clientId,
  brokers: settings.kafka.brokers,
  logger,
});

wss.on("connection", async (socket: WebSocket, request) => {
  const auth = request.headers.authorization ?? "";
  if (auth !== `Bearer ${settings.twilio.token}`) {
    logger.warn({ msg: "twilio.connection.unauthorized" });
    socket.close();
    return;
  }

  const url = new URL(request.url ?? "", `http://${request.headers.host}`);
  const callSid = url.searchParams.get("callSid") ?? `call-${Date.now()}`;
  const leadPhone = url.searchParams.get("leadPhone") ?? callSid;
  const leadName = url.searchParams.get("leadName");
  const directionParam = url.searchParams.get("direction");
  const direction = directionParam === "inbound" ? "inbound" : "outbound";
  const tenantId = url.searchParams.get("tenantId");
  const region = url.searchParams.get("region");

  const session = new TwilioMediaSession(socket, kafkaFactory, settings.redisUrl, callSid, {
    direction,
    leadPhone,
    leadName,
    tenantId,
    region,
  });
  session.bootstrap().catch((error) => {
    logger.error({ msg: "twilio.session.bootstrap_failed", error });
    socket.close();
  });

  socket.on("error", (error) => {
    logger.error({ msg: "twilio.socket.error", callSid, error });
  });
});

server.listen(settings.port, () => {
  logger.info({ msg: "voice-bridge.listen", port: settings.port });
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
