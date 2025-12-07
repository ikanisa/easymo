/**
 * RTC Audio Sink/Source Wrapper
 * 
 * Wraps wrtc nonstandard APIs (RTCAudioSink, RTCAudioSource) for bidirectional audio streaming
 * - RTCAudioSink: Receives audio from WebRTC tracks
 * - RTCAudioSource: Sends audio to WebRTC tracks
 */

import { Logger } from 'pino';
import { MediaStreamTrack } from 'wrtc';
// Import nonstandard module
import { nonstandard } from 'wrtc';

// Extract the actual classes from nonstandard
const { RTCAudioSink: AudioSink, RTCAudioSource: AudioSource } = nonstandard;

export interface AudioFrame {
  samples: Int16Array;
  sampleRate: number;
}

/**
 * Wrapper for RTCAudioSink
 * Receives audio from a WebRTC MediaStreamTrack
 */
export class AudioSinkWrapper {
  private sink: InstanceType<typeof AudioSink>;
  private log: Logger;
  private onAudioCallback?: (frame: AudioFrame) => void;

  constructor(track: MediaStreamTrack, logger: Logger) {
    this.log = logger;
    this.sink = new AudioSink(track);

    this.sink.ondata = (data: AudioFrame) => {
      if (this.onAudioCallback) {
        this.onAudioCallback(data);
      }
    };

    this.log.info({ 
      trackId: track.id, 
      trackKind: track.kind 
    }, 'Audio sink created');
  }

  /**
   * Set callback for incoming audio
   */
  onAudio(callback: (frame: AudioFrame) => void): void {
    this.onAudioCallback = callback;
  }

  /**
   * Stop receiving audio
   */
  stop(): void {
    if (this.sink) {
      this.sink.stop();
      this.log.info('Audio sink stopped');
    }
  }
}

/**
 * Wrapper for RTCAudioSource
 * Sends audio to a WebRTC MediaStreamTrack
 */
export class AudioSourceWrapper {
  private source: InstanceType<typeof AudioSource>;
  private track: MediaStreamTrack | null = null;
  private log: Logger;
  private sampleRate: number;

  constructor(logger: Logger, sampleRate: number = 48000) {
    this.log = logger;
    this.sampleRate = sampleRate;
    this.source = new AudioSource();
    this.track = this.source.createTrack();

    this.log.info({ sampleRate }, 'Audio source created');
  }

  /**
   * Get the MediaStreamTrack for adding to peer connection
   */
  getTrack(): MediaStreamTrack {
    if (!this.track) {
      throw new Error('Track not available');
    }
    return this.track;
  }

  /**
   * Send audio samples
   * @param samples - Int16Array of PCM samples
   * @param sampleRate - Sample rate (default: 48000)
   */
  sendAudio(samples: Int16Array, sampleRate?: number): void {
    if (!this.source) {
      this.log.warn('Audio source not available');
      return;
    }

    const rate = sampleRate || this.sampleRate;

    try {
      this.source.onData({
        samples,
        sampleRate: rate,
      });
    } catch (error) {
      this.log.error({ 
        error,
        samplesLength: samples.length,
        sampleRate: rate,
        expectedLength: this.getExpectedChunkSize(rate)
      }, 'Failed to send audio');
    }
  }

  /**
   * Get expected chunk size for sample rate (10ms chunks)
   */
  private getExpectedChunkSize(sampleRate: number): number {
    return Math.floor(sampleRate * 0.01); // 10ms chunks
  }

  /**
   * Stop sending audio
   */
  stop(): void {
    if (this.track) {
      this.track.stop();
      this.log.info('Audio source stopped');
    }
  }
}
