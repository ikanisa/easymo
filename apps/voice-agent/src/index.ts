import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import http from "http";
import { WebSocketServer } from "ws";
import { logger } from "./logger.js";
import { twilioInboundHandler, setupTwilioWebSocket } from "./twilioInbound.js";
import { mcpServer } from "./mcpServer.js";

// Configuration
const PORT = Number(process.env.PORT || 8787);
const MCP_PORT = Number(process.env.MCP_PORT || 9797);
const VOICE_AGENT_ENABLED = process.env.VOICE_AGENT_ENABLED === "true";
const MCP_ENABLED = process.env.MCP_ENABLED === "true";

// Express app setup
export const app: express.Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  (req as any).requestId = requestId;
  logger.info({
    msg: "http.request",
    requestId,
    method: req.method,
    path: req.path,
    userAgent: req.get("user-agent"),
  });
  next();
});

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "voice-agent",
    version: process.env.npm_package_version || "0.1.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    features: {
      voiceAgent: VOICE_AGENT_ENABLED,
      mcp: MCP_ENABLED,
    },
  });
});

// Readiness check endpoint
app.get("/ready", (_req: Request, res: Response) => {
  // Check if essential services are configured
  const ready =
    Boolean(process.env.OPENAI_API_KEY) &&
    Boolean(process.env.TWILIO_ACCOUNT_SID) &&
    Boolean(process.env.SUPABASE_URL);

  if (ready) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({
      ready: false,
      message: "Missing required configuration",
    });
  }
});

// Twilio TwiML answer endpoint
app.post("/twilio/answer", twilioInboundHandler);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).requestId;
  logger.error({
    msg: "http.error",
    requestId,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: "Internal server error",
    requestId,
  });
});

// Start server if not in test mode
if (process.env.NODE_ENV !== "test") {
  // Create HTTP server
  const server = http.createServer(app);

  // Setup Twilio WebSocket server
  if (VOICE_AGENT_ENABLED) {
    const wss = new WebSocketServer({
      server,
      path: "/ws/twilio",
    });

    setupTwilioWebSocket(wss);

    logger.info({
      msg: "websocket.server.ready",
      path: "/ws/twilio",
    });
  }

  // Start MCP server if enabled
  if (MCP_ENABLED) {
    mcpServer.start(MCP_PORT);
  }

  // Start HTTP server
  server.listen(PORT, () => {
    logger.info({
      msg: "voice-agent.listen",
      port: PORT,
      mcpPort: MCP_ENABLED ? MCP_PORT : null,
      features: {
        voiceAgent: VOICE_AGENT_ENABLED,
        mcp: MCP_ENABLED,
      },
    });
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    logger.info({ msg: "voice-agent.shutdown", signal });
    server.close(() => {
      logger.info({ msg: "voice-agent.stopped" });
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
