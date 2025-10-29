import { Request, Response } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { logger, logStructuredEvent } from "./logger.js";
import { createRealtimeSession } from "./realtimeSession.js";
import { handleTwilioMediaStream } from "./twilioMediaHandler.js";

/**
 * Twilio TwiML answer endpoint.
 * Returns TwiML that connects the call to our WebSocket media stream.
 */
export function twilioInboundHandler(req: Request, res: Response): void {
  const { CallSid, From, To, Direction } = req.body;
  const requestId = (req as any).requestId;

  // Get public WebSocket URL from environment
  const publicWsUrl = process.env.PUBLIC_WS_URL || "wss://localhost/ws/twilio";

  // Build stream URL with call metadata as query parameters
  const streamUrl = new URL(publicWsUrl);
  streamUrl.searchParams.set("callSid", CallSid || "unknown");
  streamUrl.searchParams.set("from", From || "");
  streamUrl.searchParams.set("to", To || "");
  streamUrl.searchParams.set("direction", Direction || "inbound");

  logStructuredEvent("twilio.call.answer", {
    requestId,
    callSid: CallSid,
    from: From,
    to: To,
    direction: Direction,
  });

  // Generate TwiML response
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you to our AI assistant.</Say>
  <Connect>
    <Stream url="${streamUrl.toString()}">
      <Parameter name="callSid" value="${CallSid || ''}" />
      <Parameter name="from" value="${From || ''}" />
      <Parameter name="to" value="${To || ''}" />
    </Stream>
  </Connect>
</Response>`;

  res.type("text/xml");
  res.send(twiml);
}

/**
 * Setup WebSocket server for Twilio media streams.
 */
export function setupTwilioWebSocket(wss: WebSocketServer): void {
  wss.on("connection", async (socket: WebSocket, request) => {
    const url = new URL(request.url || "", `http://${request.headers.host}`);
    const callSid = url.searchParams.get("callSid") || `call_${Date.now()}`;
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const direction = url.searchParams.get("direction") || "inbound";

    // Generate correlation ID for this connection
    const correlationId = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    logger.info({
      msg: "twilio.ws.connected",
      correlationId,
      callSid,
      from,
      to,
      direction,
    });

    // Verify webhook auth if configured
    const webhookAuth = process.env.TWILIO_WEBHOOK_AUTH;
    if (webhookAuth) {
      const authHeader = request.headers.authorization;
      if (authHeader !== `Bearer ${webhookAuth}`) {
        logger.warn({
          msg: "twilio.ws.unauthorized",
          correlationId,
          callSid,
        });
        socket.close(4001, "Unauthorized");
        return;
      }
    }

    try {
      // Create OpenAI Realtime session
      const realtimeSession = await createRealtimeSession({
        callSid,
        correlationId,
      });

      // Handle media stream
      await handleTwilioMediaStream(socket, realtimeSession, {
        callSid,
        from,
        to,
        direction,
        correlationId,
      });

      logStructuredEvent("twilio.session.started", {
        correlationId,
        callSid,
        from,
        to,
        direction,
      });
    } catch (error) {
      logger.error({
        msg: "twilio.session.failed",
        correlationId,
        callSid,
        error: (error as Error).message,
      });
      socket.close(1011, "Session creation failed");
    }

    socket.on("error", (error) => {
      logger.error({
        msg: "twilio.ws.error",
        correlationId,
        callSid,
        error: error.message,
      });
    });

    socket.on("close", (code, reason) => {
      logger.info({
        msg: "twilio.ws.closed",
        correlationId,
        callSid,
        code,
        reason: reason.toString(),
      });
    });
  });
}
