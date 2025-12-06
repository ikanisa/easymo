/**
 * G.711 Audio Codec
 * 
 * Implements G.711 μ-law (PCMU) and A-law (PCMA) encoding/decoding
 * Used for converting between compressed RTP audio and PCM
 */

import { Logger } from 'pino';

export class G711Codec {
  private log: Logger;

  constructor(logger: Logger) {
    this.log = logger;
  }

  /**
   * Decode G.711 μ-law to PCM16
   */
  decodeMuLaw(encoded: Buffer): Buffer {
    const pcm = Buffer.alloc(encoded.length * 2); // 16-bit PCM
    
    for (let i = 0; i < encoded.length; i++) {
      const mulaw = encoded[i];
      const sample = this.mulaw2linear(mulaw);
      pcm.writeInt16LE(sample, i * 2);
    }

    return pcm;
  }

  /**
   * Decode G.711 A-law to PCM16
   */
  decodeALaw(encoded: Buffer): Buffer {
    const pcm = Buffer.alloc(encoded.length * 2); // 16-bit PCM
    
    for (let i = 0; i < encoded.length; i++) {
      const alaw = encoded[i];
      const sample = this.alaw2linear(alaw);
      pcm.writeInt16LE(sample, i * 2);
    }

    return pcm;
  }

  /**
   * Encode PCM16 to G.711 μ-law
   */
  encodeMuLaw(pcm: Buffer): Buffer {
    const encoded = Buffer.alloc(pcm.length / 2);
    
    for (let i = 0; i < pcm.length / 2; i++) {
      const sample = pcm.readInt16LE(i * 2);
      encoded[i] = this.linear2mulaw(sample);
    }

    return encoded;
  }

  /**
   * Encode PCM16 to G.711 A-law
   */
  encodeALaw(pcm: Buffer): Buffer {
    const encoded = Buffer.alloc(pcm.length / 2);
    
    for (let i = 0; i < pcm.length / 2; i++) {
      const sample = pcm.readInt16LE(i * 2);
      encoded[i] = this.linear2alaw(sample);
    }

    return encoded;
  }

  /**
   * μ-law decompression
   */
  private mulaw2linear(mulawByte: number): number {
    const MULAW_BIAS = 0x84;
    
    mulawByte = ~mulawByte;
    const sign = (mulawByte & 0x80) !== 0;
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0F;
    
    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS << exponent;
    
    if (!sign) {
      sample = -sample;
    }
    
    return sample;
  }

  /**
   * A-law decompression
   */
  private alaw2linear(alawByte: number): number {
    alawByte ^= 0x55;
    
    const sign = (alawByte & 0x80) !== 0;
    const exponent = (alawByte >> 4) & 0x07;
    const mantissa = alawByte & 0x0F;
    
    let sample = mantissa << 4;
    
    if (exponent > 0) {
      sample += 0x100;
      sample <<= (exponent - 1);
    }
    
    if (!sign) {
      sample = -sample;
    }
    
    return sample;
  }

  /**
   * Linear to μ-law compression
   */
  private linear2mulaw(sample: number): number {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 0x84;
    
    const sign = (sample < 0) ? 0x80 : 0x00;
    if (sign) sample = -sample;
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    
    sample += MULAW_BIAS;
    
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1);
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const mulawByte = ~(sign | (exponent << 4) | mantissa);
    
    return mulawByte & 0xFF;
  }

  /**
   * Linear to A-law compression
   */
  private linear2alaw(sample: number): number {
    const ALAW_MAX = 0xFFF;
    
    const sign = (sample < 0) ? 0x00 : 0x80;
    if (!sign) sample = -sample;
    if (sample > ALAW_MAX) sample = ALAW_MAX;
    
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1);
    
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const alawByte = sign | (exponent << 4) | mantissa;
    
    return alawByte ^ 0x55;
  }
}
