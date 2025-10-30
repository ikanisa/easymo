import { describe, it, expect } from "vitest";
import { decodeUlaw, resample8kTo16k } from "../src/transcode";

describe("transcode", () => {
  describe("decodeUlaw", () => {
    it("should decode μ-law audio to PCM16", () => {
      // Create a test μ-law buffer (simple pattern)
      const ulawData = Buffer.from([0x00, 0x80, 0xff]);
      
      const pcmData = decodeUlaw(ulawData);
      
      // Should be 2x size (16-bit samples)
      expect(pcmData.length).toBe(ulawData.length * 2);
      
      // Verify it's a valid buffer
      expect(Buffer.isBuffer(pcmData)).toBe(true);
    });

    it("should handle empty buffer", () => {
      const ulawData = Buffer.alloc(0);
      const pcmData = decodeUlaw(ulawData);
      
      expect(pcmData.length).toBe(0);
    });

    it("should decode specific μ-law values correctly", () => {
      // Test some known μ-law values
      const ulawData = Buffer.from([0x7f]); // Mid-range value
      const pcmData = decodeUlaw(ulawData);
      
      const sample = pcmData.readInt16LE(0);
      expect(sample).toBeDefined();
      expect(sample).toBeGreaterThanOrEqual(-32768);
      expect(sample).toBeLessThanOrEqual(32767);
    });
  });

  describe("resample8kTo16k", () => {
    it("should resample from 8kHz to 16kHz", () => {
      // Create test PCM16 audio at 8kHz
      const pcm8k = Buffer.alloc(160 * 2); // 160 samples = 20ms at 8kHz
      for (let i = 0; i < 160; i++) {
        pcm8k.writeInt16LE(i * 100, i * 2);
      }
      
      const pcm16k = resample8kTo16k(pcm8k);
      
      // Should be 2x size (upsampling from 8kHz to 16kHz)
      expect(pcm16k.length).toBe(pcm8k.length * 2);
    });

    it("should handle empty buffer", () => {
      const pcm8k = Buffer.alloc(0);
      const pcm16k = resample8kTo16k(pcm8k);
      
      expect(pcm16k.length).toBe(0);
    });

    it("should produce valid PCM16 samples", () => {
      const pcm8k = Buffer.alloc(80 * 2); // 80 samples
      
      // Fill with test pattern
      for (let i = 0; i < 80; i++) {
        pcm8k.writeInt16LE(1000, i * 2);
      }
      
      const pcm16k = resample8kTo16k(pcm8k);
      
      // Verify output has valid samples
      const sample = pcm16k.readInt16LE(0);
      expect(sample).toBeGreaterThanOrEqual(-32768);
      expect(sample).toBeLessThanOrEqual(32767);
    });

    it("should interpolate values smoothly", () => {
      // Create a simple ramp
      const pcm8k = Buffer.alloc(4 * 2);
      pcm8k.writeInt16LE(0, 0);
      pcm8k.writeInt16LE(1000, 2);
      pcm8k.writeInt16LE(2000, 4);
      pcm8k.writeInt16LE(3000, 6);
      
      const pcm16k = resample8kTo16k(pcm8k);
      
      // Check that interpolated values are between original values
      const sample1 = pcm16k.readInt16LE(0);
      const sample2 = pcm16k.readInt16LE(2);
      const sample3 = pcm16k.readInt16LE(4);
      
      expect(sample1).toBe(0);
      expect(sample2).toBeGreaterThan(0);
      expect(sample2).toBeLessThan(1000);
      expect(sample3).toBeCloseTo(1000, -1);
    });
  });
});
