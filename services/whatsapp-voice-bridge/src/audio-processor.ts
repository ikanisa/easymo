/**
 * Audio Processor
 * 
 * Handles audio format conversion:
 * - RTP packets → PCM
 * - PCM resampling (8kHz ↔ 24kHz)
 * - PCM → Base64 for OpenAI
 * - Base64 → PCM from OpenAI
 */

import { Logger } from 'pino';
import { RTPHandler, RTPPacket } from './rtp-handler';
import { G711Codec } from './g711-codec';

export class AudioProcessor {
  private log: Logger;
  private rtpHandler: RTPHandler;
  private g711Codec: G711Codec;
  private audioBuffer: Buffer[] = [];

  constructor(logger: Logger) {
    this.log = logger;
    this.rtpHandler = new RTPHandler(logger);
    this.g711Codec = new G711Codec(logger);
  }

  /**
   * Process incoming RTP packet
   * Returns PCM audio ready for OpenAI (24kHz)
   */
  processIncomingRTP(rtpPacket: Buffer): Buffer | null {
    // Parse RTP packet
    const packet = this.rtpHandler.parsePacket(rtpPacket);
    if (!packet) {
      return null;
    }

    const codecName = this.rtpHandler.getCodecName(packet.payloadType);
    this.log.debug({ 
      payloadType: packet.payloadType,
      codec: codecName,
      payloadSize: packet.payload.length,
      sequenceNumber: packet.sequenceNumber,
    }, 'Processing RTP packet');

    // Decode based on codec
    let pcm: Buffer;
    
    switch (packet.payloadType) {
      case 0: // PCMU (G.711 μ-law)
        pcm = this.g711Codec.decodeMuLaw(packet.payload);
        break;
      
      case 8: // PCMA (G.711 A-law)
        pcm = this.g711Codec.decodeALaw(packet.payload);
        break;
      
      default:
        this.log.warn({ payloadType: packet.payloadType }, 'Unsupported codec');
        return null;
    }

    // Resample from 8kHz to 24kHz for OpenAI
    const resampled = this.resample(pcm, 8000, 24000);
    
    return resampled;
  }

  /**
   * Process outgoing audio from OpenAI
   * Returns RTP packet ready for WhatsApp
   */
  processOutgoingAudio(base64Audio: string, payloadType: number = 0): Buffer {
    // Decode base64 to PCM
    const pcm24k = Buffer.from(base64Audio, 'base64');

    // Resample from 24kHz to 8kHz
    const pcm8k = this.resample(pcm24k, 24000, 8000);

    // Encode to G.711
    let encoded: Buffer;
    if (payloadType === 0) {
      encoded = this.g711Codec.encodeMuLaw(pcm8k);
    } else {
      encoded = this.g711Codec.encodeALaw(pcm8k);
    }

    // Create RTP packet
    const rtpPacket = this.rtpHandler.createPacket(encoded, payloadType);

    return rtpPacket;
  }

  /**
   * Resample PCM audio using simple linear interpolation
   * For production, use a proper resampling library
   */
  resample(pcm: Buffer, fromRate: number, toRate: number): Buffer {
    if (fromRate === toRate) {
      return pcm;
    }

    const ratio = toRate / fromRate;
    const inputSamples = pcm.length / 2; // 16-bit samples
    const outputSamples = Math.floor(inputSamples * ratio);
    const output = Buffer.alloc(outputSamples * 2);

    for (let i = 0; i < outputSamples; i++) {
      const srcIndex = i / ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, inputSamples - 1);
      const fraction = srcIndex - srcIndexFloor;

      const sample1 = pcm.readInt16LE(srcIndexFloor * 2);
      const sample2 = pcm.readInt16LE(srcIndexCeil * 2);

      // Linear interpolation
      const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);
      output.writeInt16LE(interpolated, i * 2);
    }

    this.log.debug({ fromRate, toRate, inputSamples, outputSamples }, 'Resampled audio');

    return output;
  }

  /**
   * Encode PCM to base64 for OpenAI
   */
  encodeToBase64(pcm: Buffer): string {
    return pcm.toString('base64');
  }

  /**
   * Decode base64 from OpenAI to PCM
   */
  decodeFromBase64(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }

  /**
   * Buffer audio chunks for smoother streaming
   */
  bufferAudio(chunk: Buffer): void {
    this.audioBuffer.push(chunk);
  }

  /**
   * Get buffered audio and clear buffer
   */
  getBufferedAudio(): Buffer {
    const combined = Buffer.concat(this.audioBuffer);
    this.audioBuffer = [];
    return combined;
  }

  /**
   * Clear audio buffer
   */
  clearBuffer(): void {
    this.audioBuffer = [];
  }
}
