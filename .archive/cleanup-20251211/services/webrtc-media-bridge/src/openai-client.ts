import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { createLogger } from './logger';

const logger = createLogger('openai-client');

interface OpenAIConfig {
  apiKey: string;
  model: string;
  voice?: string;
  instructions?: string;
  temperature?: number;
}

export class OpenAIRealtimeClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: OpenAIConfig;
  private sessionId: string | null = null;

  constructor(config: OpenAIConfig) {
    super();
    this.config = config;
  }

  async connect() {
    const url = `wss://api.openai.com/v1/realtime?model=${this.config.model}`;
    
    logger.info({ model: this.config.model }, 'Connecting to OpenAI');

    this.ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    return new Promise<void>((resolve, reject) => {
      this.ws!.on('open', () => {
        logger.info('Connected to OpenAI Realtime');

        this.send({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: this.config.instructions,
            voice: this.config.voice || 'alloy',
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
            },
            temperature: this.config.temperature || 0.8,
          },
        });

        resolve();
      });

      this.ws!.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws!.on('error', (error) => {
        logger.error({ error }, 'OpenAI error');
        reject(error);
      });

      this.ws!.on('close', () => {
        this.emit('close');
      });
    });
  }

  private handleMessage(message: any) {
    switch (message.type) {
      case 'session.created':
        this.sessionId = message.session.id;
        logger.info({ sessionId: this.sessionId }, 'Session created');
        break;

      case 'response.audio.delta':
        const audioBuffer = Buffer.from(message.delta, 'base64');
        this.emit('audioOut', audioBuffer);
        break;

      case 'conversation.item.input_audio_transcription.completed':
        logger.info({ transcript: message.transcript }, 'User said');
        break;

      case 'error':
        logger.error({ error: message.error }, 'OpenAI error');
        break;
    }
  }

  sendAudio(audioBuffer: Buffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'input_audio_buffer.append',
        audio: audioBuffer.toString('base64'),
      });
    }
  }

  private send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  close() {
    this.ws?.close();
  }
}
