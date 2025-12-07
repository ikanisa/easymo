/**
 * Voice Call Session
 * 
 * Manages a single WhatsApp voice call session:
 * - WebRTC peer connection with WhatsApp
 * - OpenAI Realtime WebSocket connection  
 * - Bidirectional audio streaming
 */

import { EventEmitter } from 'events';
import { RTCPeerConnection, RTCSessionDescription, MediaStream, MediaStreamTrack } from 'wrtc';
import WebSocket from 'ws';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'pino';
import { AudioProcessor } from './audio-processor';
import { RTCAudioIO } from './rtc-audio-io';

interface SessionOptions {
  callId: string;
  sdpOffer: string;
  fromNumber: string;
  toNumber: string;
  supabase: SupabaseClient;
  logger: Logger;
}

export class VoiceCallSession extends EventEmitter {
  public readonly id: string;
  public readonly callId: string;
  private peerConnection: RTCPeerConnection | null = null;
  private openaiWs: WebSocket | null = null;
  private audioProcessor: AudioProcessor;
  private audioIO: RTCAudioIO;
  private startTime: number;
  private status: 'starting' | 'connected' | 'ended' = 'starting';
  private incomingPayloadType: number = 0; // Track codec used by WhatsApp
  
  private readonly fromNumber: string;
  private readonly toNumber: string;
  private readonly supabase: SupabaseClient;
  private readonly log: Logger;
  
  // Audio streaming components
  private audioBuffer: Buffer[] = [];
  private audioInterval: NodeJS.Timeout | null = null;

  constructor(options: SessionOptions) {
    super();
    
    this.id = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.callId = options.callId;
    this.fromNumber = options.fromNumber;
    this.toNumber = options.toNumber;
    this.supabase = options.supabase;
    this.log = options.logger;
    this.audioProcessor = new AudioProcessor(this.log);
    this.audioIO = new RTCAudioIO(this.log);
    this.startTime = Date.now();
    this.sdpOffer = options.sdpOffer; // Store the SDP offer
  }

  private sdpOffer: string;

  /**
   * Start the voice call session
   * Returns SDP answer for WhatsApp
   */
  async start(): Promise<string> {
    this.log.info({ callId: this.callId, from: this.fromNumber }, '=== STARTING VOICE CALL SESSION ===');

    try {
      // Step 1: Create WebRTC peer connection
      this.log.info('STEP 1: Setting up WebRTC peer connection...');
      await this.setupWebRTC();
      this.log.info('✓ WebRTC setup complete');

      // Step 2: Connect to OpenAI Realtime
      this.log.info('STEP 2: Connecting to OpenAI Realtime API...');
      await this.connectToOpenAI();
      this.log.info('✓ OpenAI connection established');

      // Step 3: Set up audio bridging
      this.log.info('STEP 3: Setting up audio bridging...');
      this.setupAudioBridge();
      this.log.info('✓ Audio bridge configured');

      this.status = 'connected';
      this.log.info('=== VOICE CALL SESSION READY ===');

      // Get SDP answer from peer connection
      const answer = this.peerConnection!.localDescription!.sdp;
      this.log.info({ answerLength: answer.length }, 'Returning SDP answer');
      return answer;

    } catch (error) {
      this.log.error({ error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, '✗ FAILED TO START SESSION');
      await this.stop();
      throw error;
    }
  }

  /**
   * Set up WebRTC peer connection with WhatsApp
   */
  private async setupWebRTC(): Promise<void> {
    this.log.info('Setting up WebRTC peer connection');

    // Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.log.debug({ candidate: event.candidate }, 'ICE candidate');
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.log.info({ state }, 'WebRTC connection state changed');

      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.log.warn('WebRTC connection lost, ending session');
        this.stop();
      }
    };

    // Handle incoming media track (audio from WhatsApp)
    this.peerConnection.ontrack = (event) => {
      this.log.info({ track: event.track.kind }, 'Received media track from WhatsApp');
      
      if (event.track.kind === 'audio') {
        this.handleIncomingAudio(event.track);
      }
    };

    // Add outgoing audio track for sending to WhatsApp
    const outgoingTrack = this.audioIO.createSource(8000); // 8kHz for WhatsApp
    const stream = new MediaStream();
    stream.addTrack(outgoingTrack);
    this.peerConnection.addTrack(outgoingTrack, stream);
    this.log.info('Added outgoing audio track to peer connection');

    // Set remote description (WhatsApp's SDP offer)
    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: this.sdpOffer })
    );

    // Create answer
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.log.info('WebRTC peer connection established');
  }

  /**
   * Connect to OpenAI Realtime API
   */
  private async connectToOpenAI(): Promise<void> {
    this.log.info('Connecting to OpenAI Realtime API');

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
    const OPENAI_ORG_ID = process.env.OPENAI_ORG_ID!;
    const model = process.env.OPENAI_REALTIME_MODEL || 'gpt-5-realtime';

    return new Promise((resolve, reject) => {
      const url = `wss://api.openai.com/v1/realtime?model=${model}`;
      
      this.openaiWs = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1',
          'OpenAI-Organization': OPENAI_ORG_ID,
        },
      });

      this.openaiWs.on('open', () => {
        this.log.info('Connected to OpenAI Realtime API');
        
        // Configure session
        this.openaiWs!.send(JSON.stringify({
          type: 'session.update',
          session: {
            modalities: ['text', 'audio'],
            instructions: 'You are EasyMO Call Center AI. Keep responses SHORT (1-2 sentences for voice). Help with: Rides, Real Estate, Jobs, Business, Insurance, Legal, Pharmacy, Farming, Wallet.',
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

        resolve();
      });

      this.openaiWs.on('message', (data) => {
        this.handleOpenAIMessage(data.toString());
      });

      this.openaiWs.on('error', (error) => {
        this.log.error({ error }, 'OpenAI WebSocket error');
        reject(error);
      });

      this.openaiWs.on('close', () => {
        this.log.info('OpenAI WebSocket closed');
        this.stop();
      });
    });
  }

  /**
   * Set up bidirectional audio bridging
   */
  private setupAudioBridge(): void {
    this.log.info('Setting up audio bridge');
    
    // Start audio processing loop
    this.processAudioLoop();
    this.log.info('Audio bridge ready - incoming/outgoing tracks configured');
  }

  /**
   * Handle incoming audio from WhatsApp
   */
  private handleIncomingAudio(track: MediaStreamTrack): void {
    this.log.info({ trackId: track.id }, 'Processing incoming audio from WhatsApp');
    
    // Attach audio sink to receive raw PCM samples
    this.audioIO.attachSink(track, (samples) => {
      this.processIncomingAudioSamples(samples);
    // Audio track is already provided
    if (!track) {
      this.log.warn('No audio track provided');
      return;
    }

    this.log.info({ trackId: track.id }, 'Audio track ready for processing');

    // Create audio sink to receive samples from WebRTC
    this.audioSink = new AudioSinkWrapper(track, this.log);

    // Set up callback to process incoming audio
    this.audioSink.onAudio((frame: AudioFrame) => {
      this.processIncomingAudioFrame(frame);
    });
  }

  /**
   * Process incoming audio samples from WhatsApp (via RTCAudioSink)
   * Samples are raw PCM16 at 8kHz mono
   */
  private processIncomingAudioSamples(samples: Int16Array): void {
    try {
      // Convert Int16Array to Buffer
      const pcm8k = Buffer.from(samples.buffer);

      // Resample from 8kHz to 24kHz for OpenAI
      const pcm24k = this.audioProcessor.resample(pcm8k, 8000, 24000);

      // Encode to base64
      const base64Audio = this.audioProcessor.encodeToBase64(pcm24k);

      // Send to OpenAI Realtime API
      if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
        this.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        }));

        this.log.debug({ 
          inputSamples: samples.length,
          inputRate: 8000,
          outputBytes: pcm24k.length,
          outputRate: 24000,
        }, 'Sent audio to OpenAI');
      }
    } catch (error) {
      this.log.error({ error }, 'Failed to process incoming audio samples');
    }
  }

  /**
   * Process audio in a continuous loop
   * This manages buffering and sends audio chunks to WhatsApp at regular intervals
   */
  private processAudioLoop(): void {
    this.log.info('Audio processing loop started');
    
    // Send buffered audio to WhatsApp every 10ms (matching WebRTC's chunk size)
    this.audioInterval = setInterval(() => {
      if (this.audioBuffer.length > 0) {
        this.sendBufferedAudioToWhatsApp();
      }
    }, 10); // 10ms intervals for 48kHz = 480 samples per chunk
  }

  /**
   * Send buffered audio to WhatsApp
   */
  private sendBufferedAudioToWhatsApp(): void {
    if (this.audioBuffer.length === 0) {
      return;
    }

    try {
      // Get all buffered audio
      const combined = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // Convert Buffer to Int16Array for audioIO
      const samples = new Int16Array(combined.buffer, combined.byteOffset, combined.length / 2);

      // Send via RTCAudioIO
      this.audioIO.sendAudio(samples);

      this.log.debug({ 
        sampleCount: samples.length,
      }, 'Sent buffered audio to WhatsApp');
    } catch (error) {
      this.log.error({ error }, 'Failed to send buffered audio');
    }
  }

  /**
   * Process incoming audio samples from WhatsApp (via RTCAudioSink)
   * Samples are raw PCM16 at 8kHz mono
   */
  private processIncomingAudio(samples: Int16Array): void {
    // Convert Int16Array to Buffer
    const pcm8k = Buffer.from(samples.buffer);

    // Resample from 8kHz to 24kHz for OpenAI
    const pcm24k = this.audioProcessor.resample(pcm8k, 8000, 24000);

    // Encode to base64
    const base64Audio = this.audioProcessor.encodeToBase64(pcm24k);

    // Send to OpenAI Realtime API
    if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
      this.openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio,
      }));
    }
  }

  /**
   * Handle messages from OpenAI Realtime API
   */
  private handleOpenAIMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      switch (message.type) {
        case 'session.created':
          this.log.info({ sessionId: message.session.id }, 'OpenAI session created');
          break;

        case 'response.audio.delta':
          // Received audio from OpenAI
          this.sendAudioToWhatsApp(message.delta);
          break;

        case 'response.done':
          this.log.info('OpenAI response completed');
          break;

        case 'error':
          this.log.error({ error: message.error }, 'OpenAI error');
          break;

        default:
          this.log.debug({ type: message.type }, 'OpenAI message');
      }
    } catch (error) {
      this.log.error({ error }, 'Failed to parse OpenAI message');
    }
  }

  /**
   * Send audio to WhatsApp via WebRTC
   * Converts base64 PCM from OpenAI (24kHz) to format for WebRTC (48kHz)
   * audioBase64 is PCM16 at 24kHz from OpenAI
   */
  private sendAudioToWhatsApp(audioBase64: string): void {
    try {
      // Decode base64 to PCM
      const pcm24k = Buffer.from(audioBase64, 'base64');

      // Resample from 24kHz (OpenAI) to 48kHz (WebRTC)
      const pcm48k = this.audioProcessor.resample(pcm24k, 24000, 48000);

      // Buffer the audio for sending in 10ms chunks
      this.audioBuffer.push(pcm48k);

      this.log.debug({ 
        inputBytes: pcm24k.length,
        outputBytes: pcm48k.length,
        bufferedChunks: this.audioBuffer.length,
      }, 'Buffered audio for WhatsApp');

      // Convert Buffer to Int16Array
      const samples = new Int16Array(pcm48k.buffer, pcm48k.byteOffset, pcm48k.length / 2);

      // Send via RTCAudioSource
      this.audioIO.sendAudio(samples);

      this.log.debug({ sampleCount: samples.length }, 'Sent audio to WhatsApp');
    } catch (error) {
      this.log.error({ error }, 'Failed to send audio to WhatsApp');
    }
  }

  /**
   * Stop the session
   */
  async stop(): Promise<void> {
    if (this.status === 'ended') {
      return;
    }

    this.log.info('Stopping voice call session');
    this.status = 'ended';

    // Stop audio processing loop
    if (this.audioInterval) {
      clearInterval(this.audioInterval);
      this.audioInterval = null;
    }

    // Clear audio buffer
    this.audioBuffer = [];

    // Close WebRTC
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Close OpenAI WebSocket
    if (this.openaiWs) {
      this.openaiWs.close();
      this.openaiWs = null;
    }

    // Stop audio I/O
    this.audioIO.stop();

    // Update database
    await this.supabase
      .from('call_summaries')
      .update({
        status: 'completed',
        duration: this.getDuration(),
      })
      .eq('call_id', this.callId);

    this.emit('ended');
    this.log.info('Voice call session stopped');
  }

  /**
   * Get session status
   */
  getStatus(): string {
    return this.status;
  }

  /**
   * Get call duration in seconds
   */
  getDuration(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}
