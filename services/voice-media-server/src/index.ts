/**
 * Voice Media Server
 * Bridges WhatsApp WebRTC calls with OpenAI Realtime API
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';
import { createClient } from '@supabase/supabase-js';
import pino from 'pino';

const logger = pino({ level: 'info' });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-5-realtime';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CallSession {
  callId: string;
  peerConnection: RTCPeerConnection;
  openaiWs?: WebSocket;
  audioTrack?: MediaStreamTrack;
  createdAt: Date;
}

const activeSessions = new Map<string, CallSession>();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    activeSessions: activeSessions.size,
    uptime: process.uptime(),
  });
});

// Create WebRTC session for WhatsApp call
app.post('/sessions/:callId/webrtc', async (req, res) => {
  const { callId } = req.params;
  const { sdpOffer } = req.body;

  if (!sdpOffer) {
    return res.status(400).json({ error: 'Missing sdpOffer' });
  }

  try {
    logger.info({ callId }, 'Creating WebRTC session');

    // Create peer connection
    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // Handle incoming audio track
    peerConnection.ontrack = (event) => {
      logger.info({ callId }, 'Received audio track from WhatsApp');
      const audioTrack = event.track;
      
      const session = activeSessions.get(callId);
      if (session) {
        session.audioTrack = audioTrack;
        
        // Stream audio to OpenAI
        streamToOpenAI(callId, audioTrack);
      }
    };

    // Set remote description (WhatsApp's SDP offer)
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: sdpOffer })
    );

    // Create answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Store session
    activeSessions.set(callId, {
      callId,
      peerConnection,
      createdAt: new Date(),
    });

    logger.info({ callId }, 'WebRTC session created');

    res.json({
      success: true,
      sdpAnswer: peerConnection.localDescription?.sdp,
    });
  } catch (error) {
    logger.error({ callId, error }, 'Failed to create WebRTC session');
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Stream audio from WhatsApp to OpenAI Realtime API
async function streamToOpenAI(callId: string, audioTrack: MediaStreamTrack) {
  const session = activeSessions.get(callId);
  if (!session) return;

  try {
    logger.info({ callId }, 'Connecting to OpenAI Realtime API');

    // Connect to OpenAI Realtime API via WebSocket
    const openaiWs = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      }
    );

    session.openaiWs = openaiWs as any;

    openaiWs.on('open', () => {
      logger.info({ callId }, 'Connected to OpenAI Realtime');

      // Send session configuration
      openaiWs.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: ['text', 'audio'],
          instructions: 'You are EasyMO Call Center AI. Keep responses SHORT (1-2 sentences for voice). Be helpful and friendly.',
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
        },
      }));
    });

    openaiWs.on('message', (data: Buffer) => {
      const message = JSON.parse(data.toString());

      // Handle audio responses from OpenAI
      if (message.type === 'response.audio.delta') {
        // Send audio back to WhatsApp via WebRTC
        sendAudioToWhatsApp(callId, message.delta);
      }

      logger.debug({ callId, type: message.type }, 'OpenAI message');
    });

    openaiWs.on('error', (error) => {
      logger.error({ callId, error }, 'OpenAI WebSocket error');
    });

    openaiWs.on('close', () => {
      logger.info({ callId }, 'OpenAI connection closed');
    });

    // Stream audio from WhatsApp to OpenAI
    // Note: This is a simplified version. In production, you'd need proper audio buffering
    // and conversion from WebRTC format to PCM16
    
  } catch (error) {
    logger.error({ callId, error }, 'Failed to connect to OpenAI');
  }
}

// Send audio from OpenAI back to WhatsApp
function sendAudioToWhatsApp(callId: string, audioData: string) {
  const session = activeSessions.get(callId);
  if (!session?.peerConnection) return;

  // Convert base64 audio to WebRTC format and send via data channel or audio track
  // This requires proper audio encoding/decoding
  logger.debug({ callId }, 'Sending audio to WhatsApp');
}

// Terminate session
app.delete('/sessions/:callId', async (req, res) => {
  const { callId } = req.params;
  
  const session = activeSessions.get(callId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    // Close connections
    session.openaiWs?.close();
    session.peerConnection.close();
    
    activeSessions.delete(callId);

    logger.info({ callId }, 'Session terminated');

    res.json({ success: true });
  } catch (error) {
    logger.error({ callId, error }, 'Failed to terminate session');
    res.status(500).json({ error: 'Failed to terminate session' });
  }
});

// Cleanup old sessions (every 5 minutes)
setInterval(() => {
  const now = new Date();
  for (const [callId, session] of activeSessions.entries()) {
    const age = now.getTime() - session.createdAt.getTime();
    if (age > 30 * 60 * 1000) { // 30 minutes
      logger.info({ callId }, 'Cleaning up old session');
      session.openaiWs?.close();
      session.peerConnection.close();
      activeSessions.delete(callId);
    }
  }
}, 5 * 60 * 1000);

server.listen(PORT, () => {
  logger.info({ port: PORT }, 'Voice Media Server started');
});
