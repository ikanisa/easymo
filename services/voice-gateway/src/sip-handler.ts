/**
 * SIP Handler for Voice Gateway
 * 
 * Handles incoming SIP calls from Twilio and other providers
 * Bridges audio between SIP trunk and OpenAI Realtime API
 */

import WebSocket from 'ws';
import { logger } from './logger';
import { CallSession, CallSessionConfig } from './session';

export interface SIPCallParams {
  callSid: string;
  from: string;
  to: string;
  correlationId?: string;
}

/**
 * Manages SIP call sessions
 */
export class SIPHandler {
  private activeSessions: Map<string, CallSession> = new Map();

  /**
   * Handle incoming SIP call from Twilio
   */
  async handleIncomingCall(
    params: SIPCallParams,
    streamSocket: WebSocket
  ): Promise<void> {
    const { callSid, from, to, correlationId } = params;

    logger.info({
      callSid,
      from: from.slice(-4),
      to,
      correlationId,
      msg: 'sip.incoming_call',
    });

    try {
      // Create call session
      const sessionConfig: CallSessionConfig = {
        callId: callSid,
        providerCallId: callSid,
        fromNumber: from,
        toNumber: to,
        agentId: 'call_center', // Use Call Center AGI
        direction: 'inbound',
        language: 'en-US', // Can be detected from caller's region
        voiceStyle: 'alloy',
        metadata: {
          provider: 'twilio',
          correlationId,
        },
      };

      const session = new CallSession(sessionConfig);
      this.activeSessions.set(callSid, session);

      // Initialize session
      await session.initialize();

      // Answer the call
      await session.answer();

      // Connect to OpenAI Realtime API
      await session.connectRealtime();

      // Bridge Twilio audio stream ↔ OpenAI Realtime
      this.bridgeAudio(session, streamSocket);

      logger.info({
        callSid,
        msg: 'sip.call_connected',
      });
    } catch (error) {
      logger.error({
        callSid,
        error: error instanceof Error ? error.message : String(error),
        msg: 'sip.call_setup_error',
      });

      // Send error message and close stream
      streamSocket.close();
      this.activeSessions.delete(callSid);
    }
  }

  /**
   * Bridge audio between Twilio and OpenAI Realtime
   */
  private bridgeAudio(session: CallSession, twilioStream: WebSocket): void {
    const callId = session.callId;

    // Handle incoming audio from Twilio (user speaking)
    twilioStream.on('message', (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString());

        switch (msg.event) {
          case 'connected':
            logger.info({ callId, msg: 'sip.stream_connected' });
            break;

          case 'start':
            logger.info({ callId, msg: 'sip.stream_started', streamSid: msg.start.streamSid });
            break;

          case 'media':
            // Extract audio payload (μ-law, base64)
            const audioBuffer = Buffer.from(msg.media.payload, 'base64');
            session.sendAudio(audioBuffer);
            break;

          case 'stop':
            logger.info({ callId, msg: 'sip.stream_stopped' });
            this.endCall(callId);
            break;
        }
      } catch (error) {
        logger.error({
          callId,
          error: error instanceof Error ? error.message : String(error),
          msg: 'sip.message_parse_error',
        });
      }
    });

    // Handle outgoing audio from OpenAI Realtime (AI speaking)
    session.on('audio_out', (audioBuffer: Buffer) => {
      if (twilioStream.readyState === WebSocket.OPEN) {
        // Send audio to Twilio in μ-law format
        twilioStream.send(JSON.stringify({
          event: 'media',
          streamSid: callId,
          media: {
            payload: audioBuffer.toString('base64'),
          },
        }));
      }
    });

    // Handle stream errors
    twilioStream.on('error', (error) => {
      logger.error({
        callId,
        error: error.message,
        msg: 'sip.stream_error',
      });
      this.endCall(callId);
    });

    // Handle stream closure
    twilioStream.on('close', () => {
      logger.info({ callId, msg: 'sip.stream_closed' });
      this.endCall(callId);
    });

    // Handle call events
    session.on('ended', () => {
      if (twilioStream.readyState === WebSocket.OPEN) {
        twilioStream.close();
      }
      this.activeSessions.delete(callId);
    });
  }

  /**
   * End a call session
   */
  private async endCall(callId: string): Promise<void> {
    const session = this.activeSessions.get(callId);
    
    if (session) {
      try {
        await session.end('completed');
      } catch (error) {
        logger.error({
          callId,
          error: error instanceof Error ? error.message : String(error),
          msg: 'sip.end_call_error',
        });
      }
      
      this.activeSessions.delete(callId);
    }
  }

  /**
   * Get active session count
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  /**
   * Get session by call ID
   */
  getSession(callId: string): CallSession | undefined {
    return this.activeSessions.get(callId);
  }
}
