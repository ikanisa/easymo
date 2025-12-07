/**
 * WebRTC Audio I/O using wrtc nonstandard APIs
 * 
 * The wrtc library provides RTCAudioSink and RTCAudioSource
 * for accessing raw audio samples from MediaStreamTrack
 */

import { Logger } from 'pino';
import { MediaStreamTrack } from 'wrtc';

// Nonstandard wrtc APIs (not in TypeScript definitions)
interface RTCAudioSinkInit {
  ondata?: (data: { samples: Int16Array }) => void;
}

interface RTCAudioSourceInit {
  bitsPerSample?: number;
  channelCount?: number;
  clockRate?: number;
  sampleRate?: number;
}

interface RTCAudioSink {
  stop(): void;
}

interface RTCAudioSource {
  createTrack(): MediaStreamTrack;
  onData(data: { samples: Int16Array }): void;
}

// Import nonstandard APIs
const wrtc = require('wrtc');
const { RTCAudioSink: AudioSink, RTCAudioSource: AudioSource } = wrtc.nonstandard;

export class RTCAudioIO {
  private log: Logger;
  private audioSink: RTCAudioSink | null = null;
  private audioSource: RTCAudioSource | null = null;
  private outgoingTrack: MediaStreamTrack | null = null;

  constructor(logger: Logger) {
    this.log = logger;
  }

  /**
   * Attach audio sink to receive audio from incoming track
   */
  attachSink(track: MediaStreamTrack, onAudio: (samples: Int16Array) => void): void {
    this.log.info({ trackId: track.id }, 'Attaching RTCAudioSink');

    const sinkInit: RTCAudioSinkInit = {
      ondata: (data) => {
        // Received raw PCM samples from WebRTC track
        onAudio(data.samples);
      }
    };

    this.audioSink = new AudioSink(track, sinkInit);
    this.log.info('RTCAudioSink attached successfully');
  }

  /**
   * Create audio source for sending audio to WebRTC
   * Returns a MediaStreamTrack that can be added to peer connection
   */
  createSource(sampleRate: number = 8000): MediaStreamTrack {
    this.log.info({ sampleRate }, 'Creating RTCAudioSource');

    const sourceInit: RTCAudioSourceInit = {
      bitsPerSample: 16,
      channelCount: 1,
      sampleRate: sampleRate,
      clockRate: sampleRate,
    };

    this.audioSource = new AudioSource(sourceInit);
    
    if (!this.audioSource) {
      throw new Error('Failed to create RTCAudioSource');
    }
    
    this.outgoingTrack = this.audioSource.createTrack();

    if (!this.outgoingTrack) {
      throw new Error('Failed to create audio track');
    }

    this.log.info({ trackId: this.outgoingTrack.id }, 'RTCAudioSource created');
    return this.outgoingTrack;
  }

  /**
   * Send audio samples to WebRTC
   */
  sendAudio(samples: Int16Array): void {
    if (!this.audioSource) {
      this.log.warn('Cannot send audio: AudioSource not created');
      return;
    }

    this.audioSource.onData({ samples });
  }

  /**
   * Stop and cleanup
   */
  stop(): void {
    if (this.audioSink) {
      this.audioSink.stop();
      this.audioSink = null;
    }

    if (this.outgoingTrack) {
      this.outgoingTrack.enabled = false;
      this.outgoingTrack = null;
    }

    this.audioSource = null;
    this.log.info('RTCAudioIO stopped');
  }
}
