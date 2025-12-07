/**
 * Voice Call Session
 * 
 * Manages a single WhatsApp voice call session:
 * - WebRTC peer connection with WhatsApp
 * - OpenAI Realtime WebSocket connection  
 * - Bidirectional audio streaming
 */

import { EventEmitter } from 'events';
import { RTCPeerConnection, RTCSessionDescription, MediaStream } from 'wrtc';
import WebSocket from 'ws';
import { SupabaseClient } from '@supabase/supabase-js';
import { Logger } from 'pino';
import { AudioProcessor } from './audio-processor';
import { AudioSinkWrapper, AudioSourceWrapper, AudioFrame } from './rtc-audio-sink';

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
  private startTime: number;
  private status: 'starting' | 'connected' | 'ended' = 'starting';
  
  private readonly fromNumber: string;
  private readonly toNumber: string;
  private readonly supabase: SupabaseClient;
  private readonly log: Logger;
  
  // Audio streaming components
  private audioSink: AudioSinkWrapper | null = null;
  private audioSource: AudioSourceWrapper | null = null;
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
    this.startTime = Date.now();
    this.sdpOffer = options.sdpOffer; // Store the SDP offer
  }

  private sdpOffer: string;

  /**
   * Start the voice call session
   * Returns SDP answer for WhatsApp
   */
  async start(): Promise<string> {
    this.log.info('Starting voice call session');

    try {
      // Step 1: Create WebRTC peer connection
      await this.setupWebRTC();

      // Step 2: Connect to OpenAI Realtime
      await this.connectToOpenAI();

      // Step 3: Set up audio bridging
      this.setupAudioBridge();

      this.status = 'connected';
      this.log.info('Voice call session started successfully');

      // Get SDP answer from peer connection
      const answer = this.peerConnection!.localDescription!.sdp;
      return answer;

    } catch (error) {
      this.log.error({ error }, 'Failed to start session');
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
        this.handleIncomingAudio(event.streams[0]);
      }
    };

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
    
    // Create audio source for sending audio to WhatsApp
    this.audioSource = new AudioSourceWrapper(this.log, 48000);

    // Add audio track to peer connection
    const audioTrack = this.audioSource.getTrack();
    const stream = new MediaStream();
    this.peerConnection!.addTrack(audioTrack, stream);

    this.log.info('Audio source track added to peer connection');
    
    // Start audio processing loop
    this.processAudioLoop();
  }

  /**
   * Handle incoming audio from WhatsApp
   */
  private handleIncomingAudio(stream: MediaStream): void {
    this.log.info('Processing incoming audio from WhatsApp');
    
    // Get audio track
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      this.log.warn('No audio track found in stream');
      return;
    }

    this.log.info({ trackId: audioTrack.id }, 'Audio track ready for processing');

    // Create audio sink to receive samples from WebRTC
    this.audioSink = new AudioSinkWrapper(audioTrack, this.log);

    // Set up callback to process incoming audio
    this.audioSink.onAudio((frame: AudioFrame) => {
      this.processIncomingAudioFrame(frame);
    });
  }

  /**
   * Process incoming audio frame from WhatsApp
   * Convert from 48kHz stereo to 24kHz mono and send to OpenAI
   */
  private processIncomingAudioFrame(frame: AudioFrame): void {
    try {
      // Convert Int16Array to Buffer
      const buffer = Buffer.from(frame.samples.buffer);

      // Resample from WebRTC's sample rate to OpenAI's 24kHz
      // Note: WebRTC typically provides 48kHz stereo, OpenAI expects 24kHz mono
      const resampled = this.audioProcessor.resample(buffer, frame.sampleRate, 24000);

      // Encode to base64 for OpenAI
      const base64Audio = this.audioProcessor.encodeToBase64(resampled);

      // Send to OpenAI
      if (this.openaiWs && this.openaiWs.readyState === WebSocket.OPEN) {
        this.openaiWs.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: base64Audio,
        }));

        this.log.debug({ 
          inputSamples: frame.samples.length,
          inputRate: frame.sampleRate,
          outputSamples: resampled.length / 2,
          outputRate: 24000,
        }, 'Sent audio to OpenAI');
      }
    } catch (error) {
      this.log.error({ error }, 'Failed to process incoming audio frame');
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
      if (this.audioBuffer.length > 0 && this.audioSource) {
        this.sendBufferedAudioToWhatsApp();
      }
    }, 10); // 10ms intervals for 48kHz = 480 samples per chunk
  }

  /**
   * Send buffered audio to WhatsApp
   */
  private sendBufferedAudioToWhatsApp(): void {
    if (!this.audioSource || this.audioBuffer.length === 0) {
      return;
    }

    try {
      // Get all buffered audio
      const combined = Buffer.concat(this.audioBuffer);
      this.audioBuffer = [];

      // Calculate chunk size (10ms at 48kHz = 480 samples = 960 bytes for 16-bit)
      const sampleRate = 48000;
      const chunkSamples = Math.floor(sampleRate * 0.01); // 480 samples
      const chunkBytes = chunkSamples * 2; // 2 bytes per sample (16-bit)

      // Process in 10ms chunks
      for (let offset = 0; offset < combined.length; offset += chunkBytes) {
        const chunk = combined.slice(offset, Math.min(offset + chunkBytes, combined.length));
        
        // Ensure chunk is the right size (pad if necessary)
        let samples: Int16Array;
        if (chunk.length === chunkBytes) {
          samples = new Int16Array(chunk.buffer, chunk.byteOffset, chunkSamples);
        } else if (chunk.length < chunkBytes) {
          // Pad with silence
          const padded = Buffer.alloc(chunkBytes);
          chunk.copy(padded);
          samples = new Int16Array(padded.buffer, padded.byteOffset, chunkSamples);
        } else {
          continue;
        }

        // Send to audio source
        this.audioSource.sendAudio(samples, sampleRate);
      }
    } catch (error) {
      this.log.error({ error }, 'Failed to send buffered audio');
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

    // Stop audio sink
    if (this.audioSink) {
      this.audioSink.stop();
      this.audioSink = null;
    }

    // Stop audio source
    if (this.audioSource) {
      this.audioSource.stop();
      this.audioSource = null;
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
