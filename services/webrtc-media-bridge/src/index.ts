import express from 'express';
import { WebSocketServer } from 'ws';
import { createLogger } from './logger';
import { WhatsAppWebRTCSession } from './whatsapp-session';
import { OpenAIRealtimeClient } from './openai-client';
import { createClient } from '@supabase/supabase-js';

const logger = createLogger('main');

const PORT = parseInt(process.env.PORT || '8080', 10);
const WS_PORT = parseInt(process.env.WS_PORT || '8081', 10);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ActiveSession {
  callId: string;
  whatsappSession: WhatsAppWebRTCSession;
  openaiClient: OpenAIRealtimeClient;
  startTime: number;
}

const activeSessions = new Map<string, ActiveSession>();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: activeSessions.size,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.post('/bridge/start', async (req, res) => {
  const { callId, sdpOffer, from, sessionConfig } = req.body;

  logger.info({ callId, from }, 'Starting media bridge');

  try {
    const whatsappSession = new WhatsAppWebRTCSession(callId, sdpOffer);
    const sdpAnswer = await whatsappSession.createAnswer();

    const openaiClient = new OpenAIRealtimeClient({
      apiKey: process.env.OPENAI_API_KEY!,
      model: process.env.OPENAI_REALTIME_MODEL || 'gpt-5-realtime',
      ...sessionConfig,
    });

    await openaiClient.connect();

    whatsappSession.on('audioIn', (audioData) => {
      openaiClient.sendAudio(audioData);
    });

    openaiClient.on('audioOut', (audioData) => {
      whatsappSession.sendAudio(audioData);
    });

    const cleanup = () => {
      logger.info({ callId }, 'Cleaning up session');
      whatsappSession.close();
      openaiClient.close();
      activeSessions.delete(callId);
    };

    whatsappSession.on('close', cleanup);
    openaiClient.on('close', cleanup);

    activeSessions.set(callId, {
      callId,
      whatsappSession,
      openaiClient,
      startTime: Date.now(),
    });

    logger.info({ callId, activeSessions: activeSessions.size }, 'Bridge established');

    res.json({
      success: true,
      callId,
      sdpAnswer,
      bridgeUrl: `ws://localhost:${WS_PORT}/bridge/${callId}`,
    });
  } catch (error) {
    logger.error({ callId, error }, 'Failed to start bridge');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/bridge/stop', async (req, res) => {
  const { callId } = req.body;

  const session = activeSessions.get(callId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  logger.info({ callId }, 'Terminating bridge');

  session.whatsappSession.close();
  session.openaiClient.close();
  activeSessions.delete(callId);

  res.json({ success: true });
});

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  const callId = req.url?.split('/').pop();
  logger.info({ callId }, 'WebSocket control connection');

  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    logger.debug({ callId, message }, 'WebSocket message');

    const session = activeSessions.get(callId!);
    if (session) {
      switch (message.type) {
        case 'mute':
          session.whatsappSession.mute();
          break;
        case 'unmute':
          session.whatsappSession.unmute();
          break;
        case 'stats':
          ws.send(JSON.stringify({
            type: 'stats',
            data: session.whatsappSession.getStats(),
          }));
          break;
      }
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT, wsPort: WS_PORT }, 'WebRTC Media Bridge started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, closing all sessions');
  activeSessions.forEach((session) => {
    session.whatsappSession.close();
    session.openaiClient.close();
  });
  process.exit(0);
});
