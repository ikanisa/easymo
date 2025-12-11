import { EventEmitter } from 'events';
import { RTCPeerConnection, RTCSessionDescription } from 'wrtc';
import { createLogger } from './logger';

const logger = createLogger('whatsapp-session');

export class WhatsAppWebRTCSession extends EventEmitter {
  private pc: RTCPeerConnection;
  private callId: string;
  private muted = false;

  constructor(callId: string, sdpOffer: string) {
    super();
    this.callId = callId;

    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
      ],
    });

    this.setupPeerConnection(sdpOffer);
  }

  private async setupPeerConnection(sdpOffer: string) {
    this.pc.ontrack = (event) => {
      logger.info({ callId: this.callId }, 'Received audio from WhatsApp');
      
      // TODO: Capture audio and emit as PCM16 buffers
      this.emit('audioIn', Buffer.alloc(0));
    };

    this.pc.onicecandidate = (event) => {
      if (!event.candidate) {
        logger.info({ callId: this.callId }, 'ICE gathering complete');
      }
    };

    this.pc.onconnectionstatechange = () => {
      logger.info({ callId: this.callId, state: this.pc.connectionState }, 'Connection state');
      
      if (['disconnected', 'failed', 'closed'].includes(this.pc.connectionState)) {
        this.emit('close');
      }
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription({
      type: 'offer',
      sdp: sdpOffer,
    }));

    logger.info({ callId: this.callId }, 'Remote description set');
  }

  async createAnswer(): Promise<string> {
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
      } else {
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') {
            resolve();
          }
        };
      }
    });

    return this.pc.localDescription!.sdp;
  }

  sendAudio(audioData: Buffer) {
    // TODO: Inject audio into RTP stream
  }

  mute() {
    this.muted = true;
  }

  unmute() {
    this.muted = false;
  }

  getStats() {
    return {
      callId: this.callId,
      connectionState: this.pc.connectionState,
      muted: this.muted,
    };
  }

  close() {
    this.pc.close();
    this.emit('close');
  }
}
