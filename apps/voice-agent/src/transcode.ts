/**
 * Audio transcoding utilities for voice agent.
 * 
 * Twilio sends μ-law (G.711) encoded audio at 8kHz.
 * OpenAI Realtime expects PCM16 at 16kHz or 24kHz.
 * 
 * This module provides:
 * - μ-law to PCM16 decoding
 * - Resampling from 8kHz to 16kHz
 * 
 * NOTE: This is a stub implementation for MVP.
 * For production, replace with proper DSP library or FFmpeg bindings.
 */

// μ-law decoding table (ITU-T G.711)
const ULAW_DECODE_TABLE = new Int16Array(256);

// Initialize μ-law decode table
(function initUlawTable() {
  for (let i = 0; i < 256; i++) {
    const exp = (i >> 4) & 0x07;
    const mantissa = i & 0x0f;
    let value = ((mantissa << 3) + 0x84) << exp;
    if ((i & 0x80) === 0) {
      value = -value;
    }
    ULAW_DECODE_TABLE[i] = value;
  }
})();

/**
 * Decode μ-law (G.711) audio to PCM16.
 * 
 * @param ulawData Buffer containing μ-law encoded audio
 * @returns Buffer containing PCM16 audio (signed 16-bit little-endian)
 */
export function decodeUlaw(ulawData: Buffer): Buffer {
  const pcmData = Buffer.alloc(ulawData.length * 2);

  for (let i = 0; i < ulawData.length; i++) {
    const sample = ULAW_DECODE_TABLE[ulawData[i]];
    pcmData.writeInt16LE(sample, i * 2);
  }

  return pcmData;
}

/**
 * Simple linear interpolation resampling from 8kHz to 16kHz.
 * 
 * NOTE: This is a basic stub implementation suitable for MVP.
 * For production, use a proper resampling library like:
 * - sox (libsox bindings)
 * - ffmpeg (via fluent-ffmpeg)
 * - web-audio-api-rs
 * - a dedicated DSP library
 * 
 * @param pcm8k Buffer containing PCM16 audio at 8kHz
 * @returns Buffer containing PCM16 audio at 16kHz
 */
export function resample8kTo16k(pcm8k: Buffer): Buffer {
  // Input: 8kHz, Output: 16kHz (2x upsampling)
  const inputSamples = pcm8k.length / 2;
  const outputSamples = inputSamples * 2;
  const pcm16k = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcIndex = i / 2;
    const srcIndexInt = Math.floor(srcIndex);
    const fraction = srcIndex - srcIndexInt;

    // Read input samples
    const sample1 = srcIndexInt < inputSamples 
      ? pcm8k.readInt16LE(srcIndexInt * 2) 
      : 0;
    const sample2 = srcIndexInt + 1 < inputSamples 
      ? pcm8k.readInt16LE((srcIndexInt + 1) * 2) 
      : sample1;

    // Linear interpolation
    const interpolated = Math.round(sample1 + (sample2 - sample1) * fraction);

    // Write output sample
    pcm16k.writeInt16LE(interpolated, i * 2);
  }

  return pcm16k;
}

/**
 * Encode PCM16 to μ-law (G.711).
 * Used when sending audio back to Twilio if needed.
 * 
 * NOTE: This is a stub. OpenAI returns PCM16 which we currently
 * pass through. For production, implement proper encoding if needed.
 * 
 * @param pcmData Buffer containing PCM16 audio
 * @returns Buffer containing μ-law encoded audio
 */
export function encodeUlaw(pcmData: Buffer): Buffer {
  // Stub implementation
  // TODO: Implement proper PCM16 to μ-law encoding for production
  throw new Error("μ-law encoding not yet implemented");
}

/**
 * Resample from 16kHz to 8kHz.
 * Used when sending audio back to Twilio if needed.
 * 
 * NOTE: This is a stub implementation.
 * 
 * @param pcm16k Buffer containing PCM16 audio at 16kHz
 * @returns Buffer containing PCM16 audio at 8kHz
 */
export function resample16kTo8k(pcm16k: Buffer): Buffer {
  // Simple downsampling by decimation (take every other sample)
  const inputSamples = pcm16k.length / 2;
  const outputSamples = Math.floor(inputSamples / 2);
  const pcm8k = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const sample = pcm16k.readInt16LE(i * 4);
    pcm8k.writeInt16LE(sample, i * 2);
  }

  return pcm8k;
}
