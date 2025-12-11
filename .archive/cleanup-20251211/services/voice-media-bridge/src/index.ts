import express from 'express';
import { WebSocket } from 'ws';
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

interface CallSession {
  callId: string;
  sdpOffer: string;
  sdpAnswer: string | null;
  openaiWs: WebSocket | null;
  config: any;
  createdAt: number;
}

const activeSessions = new Map<string, CallSession>();

app.post('/api/sessions', async (req, res) => {
  const { callId, sdpOffer, config } = req.body;

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
      config: config || {},
      createdAt: Date.now(),
    };

    activeSessions.set(callId, session);

    // Connect to OpenAI Realtime
    await connectToOpenAI(session);

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

async function connectToOpenAI(session: CallSession): Promise<void> {
  const { callId, config } = session;
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-5-realtime';

  if (!apiKey) {
    logger.error('OPENAI_API_KEY not set');
    throw new Error('OPENAI_API_KEY not configured');
  }

  const wsUrl = `wss://api.openai.com/v1/realtime?model=${model}`;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    ws.on('open', () => {
      logger.info({ callId }, 'Connected to OpenAI Realtime API');

      // Configure session
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: config.instructions || 'You are a helpful assistant.',
          voice: config.voice || 'alloy',
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

      session.openaiWs = ws;
      resolve();
    });

    ws.on('message', (data: Buffer) => {
      handleOpenAIMessage(session, data);
    });

    ws.on('error', (error) => {
      logger.error({ callId, error }, 'OpenAI WebSocket error');
      reject(error);
    });

    ws.on('close', () => {
      logger.info({ callId }, 'OpenAI WebSocket closed');
      cleanupSession(callId);
    });
  });
}

function handleOpenAIMessage(session: CallSession, data: Buffer): void {
  try {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case 'session.updated':
        logger.info({ callId: session.callId }, 'OpenAI session configured');
        break;

      case 'response.audio.delta':
        // Audio from OpenAI - would send to WhatsApp via WebRTC
        logger.debug({ 
          callId: session.callId, 
          size: message.delta?.length || 0 
        }, 'Received audio from OpenAI');
        break;

      case 'response.audio_transcript.delta':
        logger.debug({ 
          callId: session.callId, 
          transcript: message.delta 
        }, 'AI transcript');
        break;

      case 'response.done':
        logger.info({ callId: session.callId }, 'OpenAI response complete');
        break;

      case 'error':
        logger.error({ 
          callId: session.callId, 
          error: message.error 
        }, 'OpenAI error');
        break;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to parse OpenAI message');
  }
}

function generateSDPAnswer(offer: string): string {
  // Parse the offer to extract necessary information
  const lines = offer.split('\r\n');
  
  // Extract media info
  const audioLine = lines.find(l => l.startsWith('m=audio'));
  const iceUfragLine = lines.find(l => l.startsWith('a=ice-ufrag:'));
  const icePwdLine = lines.find(l => l.startsWith('a=ice-pwd:'));
  const fingerprintLine = lines.find(l => l.startsWith('a=fingerprint:'));
  
  // Find codec info
  const rtpmapLines = lines.filter(l => l.startsWith('a=rtpmap:'));
  const opusLine = rtpmapLines.find(l => l.includes('opus')) || rtpmapLines[0];
  const codecId = opusLine?.split(':')[1]?.split(' ')[0] || '111';
  
  // Generate SDP answer matching the offer
  const answer = [
    'v=0',
    'o=- 0 0 IN IP4 127.0.0.1',
    's=EasyMO Voice Bridge',
    't=0 0',
    'a=group:BUNDLE 0',
    'a=msid-semantic: WMS',
    audioLine || 'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'c=IN IP4 127.0.0.1',
    'a=rtcp:9 IN IP4 127.0.0.1',
    iceUfragLine || 'a=ice-ufrag:easymo',
    icePwdLine || 'a=ice-pwd:easymovoicebridge123456',
    fingerprintLine || 'a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00',
    'a=setup:active',
    'a=mid:0',
    'a=sendrecv',
    'a=rtcp-mux',
    `a=rtpmap:${codecId} opus/48000/2`,
    `a=fmtp:${codecId} minptime=10;useinbandfec=1`,
  ].join('\r\n') + '\r\n';

  logger.debug({ offerLength: offer.length, answerLength: answer.length }, 'Generated SDP answer');
  
  return answer;
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

// Cleanup stale sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes

  for (const [callId, session] of activeSessions.entries()) {
    if (now - session.createdAt > maxAge) {
      logger.warn({ callId }, 'Cleaning up stale session');
      cleanupSession(callId);
    }
  }
}, 5 * 60 * 1000);

const server = app.listen(port, () => {
  logger.info({ port, service: 'voice-media-bridge' }, 'Service started');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
