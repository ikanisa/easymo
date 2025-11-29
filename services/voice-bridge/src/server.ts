import express, { type Request, type Response } from "express";
import http from "http";
import { type RawData,type WebSocket, WebSocketServer } from "ws";
import { z } from "zod";

import { config } from "./config";
import { fetchLiveCalls, insertSegments, insertVoiceCall, type TranscriptSegment,updateConsent } from "./db";
import { httpLogger, logger } from "./logger";
import { resolveRoute } from "./routing";

import { childLogger, rateLimit, strictRateLimit } from '@easymo/commons';

const log = childLogger({ service: 'voice-bridge' });

const app = express();
app.use(express.json());
app.use(httpLogger);

// Global rate limiting: 100 requests per 15 minutes per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later"
}));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "voice-bridge", uptime: process.uptime() });
});

app.get("/analytics/live-calls", async (_req: Request, res: Response) => {
  try {
    const calls = await fetchLiveCalls();
    res.json({ calls });
  } catch (error) {
    res.status(500).json({ error: "analytics_unavailable" });
  }
});

const outboundSchema = z.object({
  to: z.string().min(3),
  from: z.string().default("sip:bridge@sip.easymo"),
  topic: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Strict rate limiting for outbound calls: 10 calls per minute per IP
app.post("/calls/outbound", 
  strictRateLimit({ windowMs: 60 * 1000, max: 10 }),
  async (req: Request, res: Response) => {
    const parsed = outboundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
    }

    const route = resolveRoute({ to: parsed.data.to, topic: parsed.data.topic });
    const record = await insertVoiceCall({
      to: parsed.data.to,
      from: parsed.data.from,
      agentProfile: route.agentProfile,
      route: route.sipTarget,
      metadata: parsed.data.metadata,
      consentRequired: route.consentRequired,
      topic: parsed.data.topic,
    });

    if ("message" in record) {
      return res.status(502).json({ error: "voice_call_create_failed", details: record.message });
    }

    res.json({
      callId: record.id,
      route,
      consent: { required: route.consentRequired },
    });
  }
);

const consentSchema = z.object({
  recordedAt: z.string().datetime().optional(),
  channel: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

app.post("/calls/:id/consent", async (req: Request, res: Response) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  const ok = await updateConsent(req.params.id, parsed.data);
  if (!ok) {
    return res.status(500).json({ error: "consent_persist_failed" });
  }
  res.json({ status: "stored" });
});

const segmentsSchema = z.object({
  locale: z.enum(["en", "sw"]).optional(),
  segments: z
    .array(
      z.object({
        sequence: z.number().int().nonnegative(),
        speaker: z.enum(["caller", "assistant", "system"]),
        text: z.string().min(1),
        confidence: z.number().optional(),
        startedAt: z.string().datetime().optional(),
        endedAt: z.string().datetime().optional(),
      }),
    )
    .min(1),
});

app.post("/calls/:id/segments", async (req: Request, res: Response) => {
  const parsed = segmentsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
  }
  const ok = await insertSegments(
    req.params.id,
    parsed.data.segments as TranscriptSegment[],
    parsed.data.locale,
  );
  if (!ok) {
    return res.status(500).json({ error: "segments_persist_failed" });
  }
  res.json({
    status: "captured",
    count: parsed.data.segments.length,
    locale: parsed.data.locale ?? null,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/mtn-media" });

wss.on("connection", (socket: WebSocket) => {
  logger.info({ msg: "voice_bridge.ws_connected" });
  socket.on("message", (data: RawData) => {
    try {
      const payload = JSON.parse(data.toString());
      if (payload.event === "media" && payload.track === "inbound") {
        logger.debug({ msg: "voice_bridge.media_frame", amplitude: payload.media?.amplitude });
      }
    } catch (error) {
      logger.warn({ err: error, msg: "voice_bridge.ws_parse_failed" });
    }
  });
  socket.on("close", () => logger.info({ msg: "voice_bridge.ws_disconnected" }));
  socket.send(JSON.stringify({ status: "ready" }));
});

server.listen(config.PORT, () => {
  logger.info({ msg: "voice_bridge.started", port: config.PORT });
});

export { server };
