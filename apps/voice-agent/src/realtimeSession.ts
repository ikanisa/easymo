import { WebSocket } from "ws";
import { logger } from "./logger.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-4o-realtime-preview";
const REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || "verse";

export interface RealtimeSessionConfig {
  callSid: string;
  correlationId: string;
  extra?: Record<string, any>;
}

export interface RealtimeSession {
  ws: WebSocket;
  sessionId: string;
  config: RealtimeSessionConfig;
}

/**
 * Exponential backoff helper for retries.
 */
async function backoff(attempt: number): Promise<void> {
  const delay = Math.min(5000, 100 * Math.pow(2, attempt));
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Create an ephemeral OpenAI Realtime session.
 * 
 * This function:
 * 1. POSTs to /v1/realtime/sessions to get an ephemeral token
 * 2. Connects WebSocket to wss://api.openai.com/v1/realtime
 * 3. Configures the session with model, voice, and modalities
 * 
 * @param config Session configuration
 * @returns Promise resolving to RealtimeSession
 */
export async function createRealtimeSession(
  config: RealtimeSessionConfig,
  maxRetries = 3,
): Promise<RealtimeSession> {
  const { callSid, correlationId, extra = {} } = config;

  logger.info({
    msg: "realtime.session.creating",
    correlationId,
    callSid,
    model: REALTIME_MODEL,
    voice: REALTIME_VOICE,
  });

  let lastError: Error | null = null;

  // Retry loop
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Step 1: Create ephemeral session token (if using session endpoint)
      // For now, we'll connect directly with API key
      // TODO: Implement ephemeral token creation via POST /v1/realtime/sessions

      // Step 2: Connect WebSocket
      const ws = await connectRealtimeWebSocket(correlationId);

      // Step 3: Configure session
      await configureRealtimeSession(ws, correlationId, extra);

      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      logger.info({
        msg: "realtime.session.created",
        correlationId,
        callSid,
        sessionId,
        attempt,
      });

      return {
        ws,
        sessionId,
        config,
      };
    } catch (error) {
      lastError = error as Error;
      logger.warn({
        msg: "realtime.session.retry",
        correlationId,
        callSid,
        attempt,
        error: lastError.message,
      });

      if (attempt < maxRetries - 1) {
        await backoff(attempt);
      }
    }
  }

  // All retries failed
  logger.error({
    msg: "realtime.session.failed",
    correlationId,
    callSid,
    error: lastError?.message,
  });

  throw new Error(`Failed to create Realtime session after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Connect WebSocket to OpenAI Realtime API.
 */
function connectRealtimeWebSocket(correlationId: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const url = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
    const headers = {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    };

    const ws = new WebSocket(url, { headers });

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket connection timeout"));
    }, 10000);

    ws.on("open", () => {
      clearTimeout(timeout);
      logger.info({
        msg: "realtime.ws.connected",
        correlationId,
      });
      resolve(ws);
    });

    ws.on("error", (error) => {
      clearTimeout(timeout);
      logger.error({
        msg: "realtime.ws.error",
        correlationId,
        error: error.message,
      });
      reject(error);
    });
  });
}

/**
 * Configure the Realtime session with model parameters.
 */
async function configureRealtimeSession(
  ws: WebSocket,
  correlationId: string,
  extra: Record<string, any>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Send session.update to configure the session
    const sessionConfig = {
      type: "session.update",
      session: {
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
        modalities: ["text", "audio"],
        instructions: extra.instructions || "You are a helpful AI assistant.",
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: {
          model: "whisper-1",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        ...extra,
      },
    };

    // Send configuration
    ws.send(JSON.stringify(sessionConfig));

    logger.info({
      msg: "realtime.session.configured",
      correlationId,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
    });

    // Wait a bit for configuration to be acknowledged
    // In production, we should wait for session.updated event
    setTimeout(() => resolve(), 500);
  });
}

/**
 * Close a Realtime session gracefully.
 */
export function closeRealtimeSession(session: RealtimeSession): void {
  const { sessionId, config } = session;
  
  logger.info({
    msg: "realtime.session.closing",
    correlationId: config.correlationId,
    sessionId,
  });

  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }
}
