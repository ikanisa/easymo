import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import pino from 'pino';
import dotenv from 'dotenv';

dotenv.config();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
const port = parseInt(process.env.PORT || '8080', 10);

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'voice-media-bridge' });
});

const wss = new WebSocketServer({ noServer: true });

interface CallSession {
  callId: string;
  sdpOffer: string;
  sdpAnswer: string | null;
  openaiWs: WebSocket | null;
  createdAt: number;
}

const activeSessions = new Map<string, CallSession>();

app.post('/api/sessions', async (req, res) => {
  const { callId, sdpOffer } = req.body;

  if (!callId || !sdpOffer) {
    return res.status(400).json({ error: 'Missing callId or sdpOffer' });
  }

  try {
    logger.info({ callId }, 'Creating new media bridge session');

    // Generate SDP answer based on offer
    const sdpAnswer = generateSDPAnswer(sdpOffer);

    const session: CallSession = {
      callId,
      sdpOffer,
      sdpAnswer,
      openaiWs: null,
      createdAt: Date.now(),
    };

    activeSessions.set(callId, session);
    connectToOpenAI(session);

    logger.info({ callId, sessionsCount: activeSessions.size }, 'Session created');

    res.json({
      success: true,
      callId,
      sdpAnswer,
    });
  } catch (error) {
    logger.error({ callId, error }, 'Failed to create session');
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.delete('/api/sessions/:callId', (req, res) => {
  const { callId } = req.params;
  const session = activeSessions.get(callId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  cleanupSession(callId);
  logger.info({ callId }, 'Session terminated');
  res.json({ success: true });
});

function connectToOpenAI(session: CallSession): void {
  const { callId } = session;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';

  if (!apiKey) {
    logger.error('OPENAI_API_KEY not set');
    return;
  }

  const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

  const ws = new WebSocket(wsUrl, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', () => {
    logger.info({ callId }, 'Connected to OpenAI Realtime API');

    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: 'You are EasyMO Call Center AI. Keep responses SHORT (1-2 sentences max). Be helpful and friendly.',
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    }));
  });

  ws.on('message', (data: Buffer) => {
    handleOpenAIMessage(session, data);
  });

  ws.on('error', (error) => {
    logger.error({ callId, error }, 'OpenAI WebSocket error');
  });

  ws.on('close', () => {
    logger.info({ callId }, 'OpenAI WebSocket closed');
    cleanupSession(callId);
  });

  session.openaiWs = ws;
}

function handleOpenAIMessage(session: CallSession, data: Buffer): void {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'response.audio.delta':
        if (message.delta) {
          sendAudioToWhatsApp(session, Buffer.from(message.delta, 'base64'));
        }
        break;

      case 'response.done':
        logger.info({ callId: session.callId }, 'OpenAI response complete');
        break;

      case 'error':
        logger.error({ callId: session.callId, error: message.error }, 'OpenAI error');
        break;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse OpenAI message');
  }
}

function generateSDPAnswer(offer: string): string {
  // Parse offer to extract media info
  const lines = offer.split('\r\n');
  const audioCodec = lines.find(l => l.includes('a=rtpmap') && (l.includes('opus') || l.includes('PCMU')));
  
  // Generate minimal valid SDP answer
  return [
    'v=0',
    'o=- 0 0 IN IP4 0.0.0.0',
    's=EasyMO Voice Bridge',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 0.0.0.0',
    'a=rtcp:9 IN IP4 0.0.0.0',
    'a=ice-ufrag:easymo',
    'a=ice-pwd:easymovoicebridge123456789012',
    'a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
    'a=setup:active',
    'a=mid:0',
    'a=sendrecv',
    'a=rtcp-mux',
    'a=rtpmap:111 opus/48000/2',
    'a=fmtp:111 minptime=10;useinbandfec=1',
  ].join('\r\n') + '\r\n';
}

function sendAudioToWhatsApp(session: CallSession, audioData: Buffer): void {
  // TODO: Implement RTP packetization and send to WhatsApp
  logger.debug({ callId: session.callId, size: audioData.length }, 'Audio from OpenAI (not yet sent to WhatsApp)');
}

function cleanupSession(callId: string): void {
  const session = activeSessions.get(callId);
  if (!session) return;

  if (session.openaiWs) {
    session.openaiWs.close();
  }

  activeSessions.delete(callId);

  logger.info({ callId, remainingSessions: activeSessions.size }, 'Session cleaned up');
}

setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000;

  for (const [callId, session] of activeSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      logger.warn({ callId }, 'Cleaning up stale session');
      cleanupSession(callId);
    }
  }
}, 5 * 60 * 1000);

const server = app.listen(port, () => {
  logger.info({ port }, 'Voice Media Bridge started');
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
