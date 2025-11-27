import { WebSocket } from 'ws';

import { childLogger } from '@easymo/commons';

const log = childLogger({ service: 'ai-core' });

export interface RealtimeConfig {
  apiKey: string;
  model?: string;
  instructions?: string;
  voice?: 'alloy' | 'echo' | 'shimmer';
  temperature?: number;
}

export interface VoiceCapability {
  enabled: boolean;
  provider: 'openai_realtime' | 'none';
  config?: RealtimeConfig;
}

/**
 * OpenAI Realtime API Client
 * Handles voice interactions via WebSocket
 */
export class OpenAIRealtimeClient {
  private ws: WebSocket | null = null;
  private config: RealtimeConfig;
  private url = 'wss://api.openai.com/v1/realtime';
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(config: RealtimeConfig) {
    this.config = config;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect(): Promise<void> {
    const model = this.config.model || 'gpt-4o-realtime-preview-2024-10-01';
    const url = `${this.url}?model=${model}`;

    this.ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    return new Promise((resolve, reject) => {
      if (!this.ws) return reject('WebSocket not initialized');

      this.ws.on('open', () => {
        log.info('Connected to OpenAI Realtime API');
        this.initializeSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on('error', (error) => {
        log.error('Realtime API Error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        log.info('Disconnected from OpenAI Realtime API');
      });
    });
  }

  /**
   * Initialize session with configuration
   */
  private initializeSession(): void {
    if (!this.ws) return;

    const event = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: this.config.instructions || 'You are a helpful assistant.',
        voice: this.config.voice || 'alloy',
        temperature: this.config.temperature || 0.7,
      },
    };

    this.ws.send(JSON.stringify(event));
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: any): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => handler(event));

    // Default handling
    switch (event.type) {
      case 'response.audio.delta':
        // Audio chunk received
        break;
      case 'response.text.delta':
        // Text chunk received
        break;
      case 'response.done':
        log.info('Response complete');
        break;
      case 'error':
        log.error('Realtime API error:', event.error);
        break;
    }
  }

  /**
   * Register event handler
   */
  on(eventType: string, handler: Function): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Send audio chunk
   */
  sendAudio(audioChunk: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const event = {
      type: 'input_audio_buffer.append',
      audio: audioChunk,
    };
    this.ws.send(JSON.stringify(event));
  }

  /**
   * Send text message
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const event = {
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }]
      }
    };
    this.ws.send(JSON.stringify(event));

    // Trigger response
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  /**
   * Disconnect from Realtime API
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
