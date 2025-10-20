import express from "express";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import pinoHttp from "pino-http";
import twilio from "twilio";
import type { CallListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/call";
import { settings } from "./config";
import { logger } from "./logger";
import { TwilioMediaSession } from "./twilioSession";
import { KafkaFactory } from "@easymo/messaging";
import { liveCallRegistry } from "./liveCallRegistry";
import { createRateLimiter, expressRequestContext, expressServiceAuth } from "@easymo/commons";

export const app = express();
app.use(express.json());
app.use(expressRequestContext({ generateIfMissing: true }));
app.use(pinoHttp({ logger: logger as any }));

if (settings.rateLimit.redisUrl) {
  app.use(
    createRateLimiter({
      redisUrl: settings.rateLimit.redisUrl,
      points: settings.rateLimit.points,
      durationSeconds: settings.rateLimit.windowSeconds,
      keyPrefix: "voice-bridge",
      logger,
    }),
  );
}

const requireAuth = (scopes: string[]) =>
  expressServiceAuth({ audience: settings.auth.audience, requiredScopes: scopes });

const twilioClient = twilio(settings.twilio.accountSid, settings.twilio.authToken);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/analytics/live-calls", requireAuth(["voice:read"]), (_req, res) => {
  res.json(liveCallRegistry.snapshot());
});

app.post("/calls/outbound", requireAuth(["voice:outbound.write"]), async (req, res) => {
  const { to, tenantId, contactName, region, profile } = req.body ?? {};
  if (!to) {
    return res.status(400).json({ error: "Missing 'to' number" });
  }

  try {
    const streamUrl = new URL(settings.twilio.mediaStreamWss);
    streamUrl.searchParams.set("callSid", "{{CallSid}}");
    streamUrl.searchParams.set("leadPhone", String(to));
    streamUrl.searchParams.set("direction", "outbound");
    if (tenantId) streamUrl.searchParams.set("tenantId", String(tenantId));
    if (contactName) streamUrl.searchParams.set("leadName", String(contactName));
    if (region) streamUrl.searchParams.set("region", String(region));
    if (profile) streamUrl.searchParams.set("profile", String(profile));

    const parameterLines = [
      tenantId ? `      <Parameter name="tenantId" value="${tenantId}"/>` : null,
      region ? `      <Parameter name="region" value="${region}"/>` : null,
      profile ? `      <Parameter name="profile" value="${profile}"/>` : null,
    ]
      .filter((line): line is string => Boolean(line));

    const twiml = [
      "<Response>",
      "  <Start>",
      `    <Stream url="${streamUrl.toString()}">`,
      ...parameterLines,
      "    </Stream>",
      "  </Start>",
      "  <Pause length=\"3600\"/>",
      "</Response>",
    ].join("\n");

    const payload: CallListInstanceCreateOptions = {
      to,
      from: settings.twilio.outboundCallerId,
      twiml,
    };

    if (settings.twilio.statusCallbackUrl) {
      payload.statusCallback = settings.twilio.statusCallbackUrl;
      payload.statusCallbackEvent = ["initiated", "ringing", "answered", "completed"];
      payload.statusCallbackMethod = "POST";
    }

    logger.info({
      msg: "voice.outbound.initiating",
      to,
      tenantId,
      contactName,
      region,
      profile,
    });

    const call = await twilioClient.calls.create(payload);

    return res.status(202).json({
      status: "queued",
      to,
      tenantId: tenantId ?? null,
      contactName: contactName ?? null,
      region: region ?? null,
      profile: profile ?? null,
      sid: call.sid,
    });
  } catch (error) {
    const message =
      (error as { message?: string })?.message ?? (typeof error === "string" ? error : "Unknown Twilio error");
    logger.error({ msg: "voice.outbound.failed", error: message, to, tenantId, region, profile });
    return res.status(502).json({ error: "Failed to initiate outbound call", message });
  }
});

if (process.env.NODE_ENV !== "test") {
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
    const profile = url.searchParams.get("profile");
    const fromNumber = url.searchParams.get("from");
    const toNumber = url.searchParams.get("to");
    const locale = url.searchParams.get("locale");
    const country = url.searchParams.get("country");

    const session = new TwilioMediaSession(socket, kafkaFactory, settings.redisUrl, callSid, {
      direction,
      leadPhone,
      leadName,
      tenantId,
      region,
      profile,
      fromNumber,
      toNumber,
      locale,
      country,
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
}
