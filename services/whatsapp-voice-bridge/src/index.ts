/**
 * WhatsApp Voice Bridge Service
 * 
 * WebRTC media server that bridges WhatsApp voice calls to OpenAI Realtime API
 * 
 * Architecture:
 * 1. Receives WebRTC connection details from wa-webhook-voice-calls
 * 2. Establishes WebRTC peer connection with WhatsApp
 * 3. Receives RTP audio packets from WhatsApp
 * 4. Connects to OpenAI Realtime WebSocket
 * 5. Converts RTP audio ↔ Base64 PCM for OpenAI
 * 6. Forwards AI responses back to WhatsApp via RTP
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import pino from 'pino';
import { createClient } from '@supabase/supabase-js';
import { VoiceCallSession } from './voice-call-session';
import dotenv from 'dotenv';

dotenv.config();

const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
    },
  },
});

const app = express();
const PORT = process.env.PORT || 3100;

// Supabase client for database operations
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track active call sessions
const activeSessions = new Map<string, VoiceCallSession>();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'whatsapp-voice-bridge',
    activeCalls: activeSessions.size,
    uptime: process.uptime(),
  });
});

/**
 * Start a new voice call session
 * Called by wa-webhook-voice-calls Edge Function
 */
app.post('/sessions/start', async (req, res) => {
  const { callId, sdpOffer, fromNumber, toNumber } = req.body;

  if (!callId || !sdpOffer) {
    return res.status(400).json({ error: 'Missing callId or sdpOffer' });
  }

  try {
    log.info({ callId, from: fromNumber }, 'Starting new voice call session');

    // Create new session
    const session = new VoiceCallSession({
      callId,
      sdpOffer,
      fromNumber,
      toNumber,
      supabase,
      logger: log.child({ callId }),
    });

    // Start the session
    const sdpAnswer = await session.start();

    // Store session
    activeSessions.set(callId, session);

    // Clean up when session ends
    session.on('ended', () => {
      log.info({ callId }, 'Session ended, cleaning up');
      activeSessions.delete(callId);
    });

    res.json({
      success: true,
      callId,
      sdpAnswer,
      sessionId: session.id,
    });
  } catch (error) {
    log.error({ error, callId }, 'Failed to start session');
    res.status(500).json({
      error: 'Failed to start session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Stop a voice call session
 */
app.post('/sessions/:callId/stop', async (req, res) => {
  const { callId } = req.params;

  const session = activeSessions.get(callId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    await session.stop();
    activeSessions.delete(callId);

    res.json({ success: true, callId });
  } catch (error) {
    log.error({ error, callId }, 'Failed to stop session');
    res.status(500).json({
      error: 'Failed to stop session',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * Get session status
 */
app.get('/sessions/:callId', (req, res) => {
  const { callId } = req.params;

  const session = activeSessions.get(callId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    callId,
    sessionId: session.id,
    status: session.getStatus(),
    duration: session.getDuration(),
  });
});

/**
 * List all active sessions
 */
app.get('/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.values()).map((session) => ({
    callId: session.callId,
    sessionId: session.id,
    status: session.getStatus(),
    duration: session.getDuration(),
  }));

  res.json({
    count: sessions.length,
    sessions,
  });
});

// Start server
const server = app.listen(PORT, () => {
  log.info({ port: PORT }, 'WhatsApp Voice Bridge started');
  log.info('Ready to handle voice calls');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  log.info('SIGTERM received, shutting down gracefully');

  // Stop all active sessions
  for (const session of activeSessions.values()) {
    try {
      await session.stop();
    } catch (error) {
      log.error({ error }, 'Error stopping session during shutdown');
    }
  }

  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  log.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});
