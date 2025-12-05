/**
 * Voice Gateway HTTP Server
 * 
 * Provides REST API for call management and WebSocket for audio streaming.
 * Supports SIP trunk integration via Twilio Media Streams
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config, validateConfig } from './config';
import { logger } from './logger';
import { sessionManager, CallSessionConfig } from './session';
import { SIPHandler } from './sip-handler';

const app = express();
app.use(express.json());

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'voice-gateway',
    activeSessions: sessionManager.getActiveSessions().length,
  });
});

/**
 * POST /calls/start
 * 
 * Start a new call session.
 * For inbound: call from SBC webhook
 * For outbound: call initiation from cold-caller
 */
app.post('/calls/start', async (req: Request, res: Response) => {
  try {
    const {
      provider_call_id,
      from_number,
      to_number,
      agent_id = 'waiter_ai',
      direction = 'inbound',
      language = 'en-US',
      voice_style,
      system_prompt,
      metadata = {},
    } = req.body;

    if (!from_number || !to_number) {
      return res.status(400).json({ error: 'from_number and to_number required' });
    }

    const callId = uuidv4();

    const sessionConfig: CallSessionConfig = {
      callId,
      providerCallId: provider_call_id,
      fromNumber: from_number,
      toNumber: to_number,
      agentId: agent_id,
      direction,
      language,
      voiceStyle: voice_style,
      systemPrompt: system_prompt,
      metadata,
    };

    const session = await sessionManager.createSession(sessionConfig);

    // Connect to OpenAI Realtime
    await session.connectRealtime();

    logger.info({
      callId,
      agentId: agent_id,
      direction,
      msg: 'call.started',
    });

    res.status(201).json({
      call_id: callId,
      status: 'initiated',
      websocket_url: `/calls/${callId}/audio`,
      message: 'Call session created. Connect to WebSocket for audio streaming.',
    });
  } catch (error) {
    logger.error({ error, msg: 'calls.start.error' });
    res.status(500).json({ error: 'Failed to start call session' });
  }
});

/**
 * POST /calls/:id/answer
 * 
 * Mark call as answered (from SBC webhook)
 */
app.post('/calls/:id/answer', async (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionManager.getSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Call session not found' });
  }

  await session.answer();
  res.json({ call_id: id, status: 'answered' });
});

/**
 * POST /calls/:id/end
 * 
 * End a call session
 */
app.post('/calls/:id/end', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { disposition, notes } = req.body;

  const session = sessionManager.getSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Call session not found' });
  }

  await session.end(disposition);

  res.json({
    call_id: id,
    status: 'ended',
    disposition,
  });
});

/**
 * GET /calls/:id/status
 * 
 * Get call status and transcript
 */
app.get('/calls/:id/status', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = sessionManager.getSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Call session not found' });
  }

  const transcript = session.getTranscript();

  res.json({
    call_id: id,
    state: session.getState(),
    transcript: transcript.map((t) => ({
      role: t.role,
      text: t.text,
      timestamp: t.timestamp.toISOString(),
    })),
  });
});

/**
 * GET /calls/active
 * 
 * List all active call sessions
 */
app.get('/calls/active', (req: Request, res: Response) => {
  const sessions = sessionManager.getActiveSessions();

  res.json({
    count: sessions.length,
    calls: sessions.map((s) => ({
      call_id: s.callId,
      agent_id: s.config.agentId,
      direction: s.config.direction,
      state: s.getState(),
      from_number: s.config.fromNumber,
      to_number: s.config.toNumber,
    })),
  });
});

/**
 * POST /calls/outbound
 * 
 * Initiate an outbound call (for cold-caller integration)
 */
app.post('/calls/outbound', async (req: Request, res: Response) => {
  try {
    const {
      to,
      agent_id = 'sales_sdr_ai',
      topic,
      metadata = {},
    } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to phone number required' });
    }

    const callId = uuidv4();

    const sessionConfig: CallSessionConfig = {
      callId,
      fromNumber: config.DEFAULT_FROM_NUMBER,
      toNumber: to,
      agentId: agent_id,
      direction: 'outbound',
      language: metadata.language || 'en-US',
      voiceStyle: metadata.voice_style,
      systemPrompt: metadata.script_goal,
      metadata: {
        topic,
        campaign_id: metadata.campaign_id,
        ...metadata,
      },
    };

    const session = await sessionManager.createSession(sessionConfig);
    await session.connectRealtime();

    // TODO: Trigger actual SIP call to SBC
    // This would send a SIP INVITE to the SBC to dial out

    logger.info({
      callId,
      toNumber: to,
      agentId: agent_id,
      msg: 'outbound_call.initiated',
    });

    res.status(202).json({
      call_id: callId,
      status: 'initiated',
      message: 'Outbound call initiated',
    });
  } catch (error) {
    logger.error({ error, msg: 'calls.outbound.error' });
    res.status(500).json({ error: 'Failed to initiate outbound call' });
  }
});

// ============================================================================
// WEBSOCKET SERVER FOR AUDIO STREAMING
// ============================================================================

const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/audio' });
const sipHandler = new SIPHandler();

// WebSocket for Twilio Media Streams (SIP trunk)
const twilioWss = new WebSocketServer({ server, path: '/stream/:callSid' });

twilioWss.on('connection', (ws: WebSocket, req) => {
  // Extract parameters from URL or initial message
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathParts = url.pathname.split('/');
  const callSid = pathParts[pathParts.length - 1];

  logger.info({
    callSid,
    path: req.url,
    msg: 'twilio_stream.connection',
  });

  // Wait for 'start' event to get full parameters
  ws.once('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.event === 'start') {
        const params = msg.start.customParameters || {};
        
        sipHandler.handleIncomingCall({
          callSid: params.callSid || callSid,
          from: params.from || 'unknown',
          to: params.to || 'unknown',
          correlationId: params.correlationId,
        }, ws);
      }
    } catch (error) {
      logger.error({
        callSid,
        error: error instanceof Error ? error.message : String(error),
        msg: 'twilio_stream.init_error',
      });
      ws.close();
    }
  });

  ws.on('close', () => {
    logger.info({ callSid, msg: 'twilio_stream.closed' });
  });

  ws.on('error', (error) => {
    logger.error({
      callSid,
      error: error.message,
      msg: 'twilio_stream.error',
    });
  });
});

// Regular WebSocket for audio streaming (existing functionality)
wss.on('connection', (ws: WebSocket, req) => {
  // Extract call_id from URL path
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const callId = url.searchParams.get('call_id');

  if (!callId) {
    ws.close(1008, 'call_id parameter required');
    return;
  }

  const session = sessionManager.getSession(callId);

  if (!session) {
    ws.close(1008, 'Call session not found');
    return;
  }

  logger.info({ callId, msg: 'audio_websocket.connected' });

  // Forward audio from SBC to session (and Realtime API)
  ws.on('message', (data: Buffer) => {
    session.sendAudio(data);
  });

  // Forward audio from session (Realtime API) back to SBC
  session.on('audio_out', (audioBuffer: Buffer) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(audioBuffer);
    }
  });

  // Handle events
  session.on('user_speaking', () => {
    ws.send(JSON.stringify({ event: 'user_speaking' }));
  });

  session.on('ai_speaking', (text: string) => {
    ws.send(JSON.stringify({ event: 'ai_speaking', text }));
  });

  session.on('transcript', (chunk) => {
    ws.send(JSON.stringify({ event: 'transcript', ...chunk }));
  });

  session.on('ended', () => {
    ws.close(1000, 'Call ended');
  });

  ws.on('close', () => {
    logger.info({ callId, msg: 'audio_websocket.disconnected' });
  });

  ws.on('error', (error) => {
    logger.error({ callId, error, msg: 'audio_websocket.error' });
  });
});

// ============================================================================
// START SERVER
// ============================================================================

export function startServer(): void {
  validateConfig();

  server.listen(config.PORT, config.HOST, () => {
    logger.info({
      port: config.PORT,
      host: config.HOST,
      msg: 'voice-gateway.started',
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info({ msg: 'voice-gateway.shutting_down' });
  await sessionManager.endAllSessions();
  server.close();
  process.exit(0);
});
