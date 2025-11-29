/**
 * OpenAI Realtime API Implementation
 * WebSocket-based voice and real-time text interactions
 */

import WebSocket from 'ws';

import { AI_CONFIG } from '../config';
import type { RealtimeConfig } from '../types';

export interface RealtimeSession {
  id: string;
  ws: WebSocket;
  isConnected: boolean;
  config: RealtimeConfig;
}

export interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

export type RealtimeEventHandler = (event: RealtimeEvent) => void;

/**
 * Create Realtime API session
 */
export const createRealtimeSession = async (
  config: RealtimeConfig = {}
): Promise<RealtimeSession> => {
  const apiKey = AI_CONFIG.apiKeys.openai;
  
  if (apiKey === 'PLACEHOLDER_OPENAI_KEY') {
    throw new Error('OpenAI API key not configured');
  }

  if (!AI_CONFIG.features.openaiRealtime) {
    throw new Error('OpenAI Realtime API is disabled. Set ENABLE_OPENAI_REALTIME=true');
  }

  const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  const sessionId = `rt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Realtime session connection timeout'));
    }, 10000);

    ws.on('open', () => {
      clearTimeout(timeout);
      
      // Send session configuration
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          modalities: config.modalities || ['text', 'audio'],
          voice: config.voice || 'alloy',
          instructions: config.instructions || 'You are a helpful AI assistant.',
          turn_detection: config.turn_detection,
        },
      }));

      resolve({
        id: sessionId,
        ws,
        isConnected: true,
        config,
      });
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};

/**
 * Send audio to realtime session
 */
export const sendRealtimeAudio = (
  session: RealtimeSession,
  audioData: string // base64 encoded PCM16 audio
): void => {
  if (!session.isConnected) {
    throw new Error('Session not connected');
  }

  session.ws.send(JSON.stringify({
    type: 'input_audio_buffer.append',
    audio: audioData,
  }));
};

/**
 * Send text to realtime session
 */
export const sendRealtimeText = (
  session: RealtimeSession,
  text: string
): void => {
  if (!session.isConnected) {
    throw new Error('Session not connected');
  }

  session.ws.send(JSON.stringify({
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text,
      }],
    },
  }));

  // Trigger response generation
  session.ws.send(JSON.stringify({
    type: 'response.create',
  }));
};

/**
 * Subscribe to realtime events
 */
export const subscribeRealtimeEvents = (
  session: RealtimeSession,
  eventType: string | 'all',
  handler: RealtimeEventHandler
): () => void => {
  const listener = (data: WebSocket.Data) => {
    try {
      const event = JSON.parse(data.toString()) as RealtimeEvent;
      
      if (eventType === 'all' || event.type === eventType) {
        handler(event);
      }
    } catch (error) {
      console.error('Failed to parse realtime event:', error);
    }
  };

  session.ws.on('message', listener);

  // Return unsubscribe function
  return () => {
    session.ws.off('message', listener);
  };
};

/**
 * Close realtime session
 */
export const closeRealtimeSession = (session: RealtimeSession): void => {
  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }
  session.isConnected = false;
};

/**
 * Example: Create voice agent
 */
export const createVoiceAgent = async (
  instructions: string,
  voice: 'alloy' | 'echo' | 'shimmer' = 'alloy'
): Promise<RealtimeSession> => {
  return createRealtimeSession({
    modalities: ['text', 'audio'],
    voice,
    instructions,
    turn_detection: {
      type: 'server_vad',
      threshold: 0.5,
      silence_duration_ms: 500,
    },
  });
};
