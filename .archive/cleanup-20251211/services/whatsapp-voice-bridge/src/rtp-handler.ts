/**
 * RTP (Real-time Transport Protocol) Handler
 * 
 * Handles RTP packet parsing and generation for audio streaming
 */

import { Logger } from 'pino';

export interface RTPPacket {
  version: number;
  padding: boolean;
  extension: boolean;
  csrcCount: number;
  marker: boolean;
  payloadType: number;
  sequenceNumber: number;
  timestamp: number;
  ssrc: number;
  payload: Buffer;
}

export class RTPHandler {
  private log: Logger;
  private sequenceNumber: number = 0;
  private timestamp: number = 0;
  private ssrc: number;

  constructor(logger: Logger) {
    this.log = logger;
    this.ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Parse RTP packet from buffer
   */
  parsePacket(buffer: Buffer): RTPPacket | null {
    if (buffer.length < 12) {
      this.log.warn({ length: buffer.length }, 'RTP packet too short');
      return null;
    }

    try {
      const firstByte = buffer.readUInt8(0);
      const version = (firstByte >> 6) & 0x03;
      const padding = ((firstByte >> 5) & 0x01) === 1;
      const extension = ((firstByte >> 4) & 0x01) === 1;
      const csrcCount = firstByte & 0x0F;

      const secondByte = buffer.readUInt8(1);
      const marker = ((secondByte >> 7) & 0x01) === 1;
      const payloadType = secondByte & 0x7F;

      const sequenceNumber = buffer.readUInt16BE(2);
      const timestamp = buffer.readUInt32BE(4);
      const ssrc = buffer.readUInt32BE(8);

      // Calculate payload offset
      let offset = 12 + (csrcCount * 4);

      // Skip extension header if present
      if (extension && buffer.length >= offset + 4) {
        const extensionLength = buffer.readUInt16BE(offset + 2) * 4;
        offset += 4 + extensionLength;
      }

      // Extract payload
      let payloadLength = buffer.length - offset;
      
      // Remove padding if present
      if (padding && buffer.length > offset) {
        const paddingLength = buffer.readUInt8(buffer.length - 1);
        payloadLength -= paddingLength;
      }

      const payload = buffer.slice(offset, offset + payloadLength);

      return {
        version,
        padding,
        extension,
        csrcCount,
        marker,
        payloadType,
        sequenceNumber,
        timestamp,
        ssrc,
        payload,
      };
    } catch (error) {
      this.log.error({ error }, 'Failed to parse RTP packet');
      return null;
    }
  }

  /**
   * Create RTP packet from payload
   */
  createPacket(payload: Buffer, payloadType: number = 0, marker: boolean = false): Buffer {
    const packet = Buffer.alloc(12 + payload.length);

    // Byte 0: V(2), P(1), X(1), CC(4)
    packet.writeUInt8(0x80, 0); // Version 2, no padding, no extension, no CSRC

    // Byte 1: M(1), PT(7)
    const markerBit = marker ? 0x80 : 0x00;
    packet.writeUInt8(markerBit | (payloadType & 0x7F), 1);

    // Bytes 2-3: Sequence number
    packet.writeUInt16BE(this.sequenceNumber, 2);
    this.sequenceNumber = (this.sequenceNumber + 1) & 0xFFFF;

    // Bytes 4-7: Timestamp
    packet.writeUInt32BE(this.timestamp, 4);
    this.timestamp += 160; // 20ms @ 8kHz

    // Bytes 8-11: SSRC
    packet.writeUInt32BE(this.ssrc, 8);

    // Payload
    payload.copy(packet, 12);

    return packet;
  }

  /**
   * Get codec name from payload type
   */
  getCodecName(payloadType: number): string {
    const codecs: { [key: number]: string } = {
      0: 'PCMU',  // G.711 μ-law
      3: 'GSM',
      4: 'G723',
      8: 'PCMA',  // G.711 A-law
      9: 'G722',
      10: 'L16-stereo',
      11: 'L16-mono',
      13: 'CN',
      96: 'Dynamic', // Often Opus
      97: 'Dynamic',
      98: 'Dynamic',
      99: 'Dynamic',
      100: 'Dynamic',
      101: 'telephone-event',
    };

    return codecs[payloadType] || `Unknown(${payloadType})`;
  }

  /**
   * Reset sequence and timestamp counters
   */
  reset(): void {
    this.sequenceNumber = 0;
    this.timestamp = 0;
    this.ssrc = Math.floor(Math.random() * 0xFFFFFFFF);
  }
}
