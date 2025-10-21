import { Logger } from '@nestjs/common';
import type { MediaStream, MediaStreamTrack, RTCIceServer, RTCPeerConnection } from 'wrtc';
import { fetch } from 'undici';
import { env } from '../../../common/env';

const REALTIME_SDP_ENDPOINT = 'https://api.openai.com/v1/realtime/sdp';

type OnTrack = (track: MediaStreamTrack, streams: MediaStream[]) => void;

type CreateRealtimePeerArgs = {
  callId: string;
  onRemoteTrack?: OnTrack;
};

export class RealtimePeer {
  constructor(public readonly pc: RTCPeerConnection) {}

  addInboundTrack(track: MediaStreamTrack, stream?: MediaStream) {
    if (stream) {
      this.pc.addTrack(track, stream);
    } else {
      this.pc.addTrack(track);
    }
  }

  onTrack(callback: OnTrack) {
    this.pc.ontrack = (event) => {
      callback(event.track, event.streams);
    };
  }

  setIceServers(servers: RTCIceServer[]) {
    this.pc.setConfiguration({ iceServers: servers });
  }

  close() {
    this.pc.close();
  }
}

export async function createRealtimePeer(args: CreateRealtimePeerArgs): Promise<RealtimePeer> {
  const logger = new Logger('RealtimePeer');
  if (!env.openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  const { RTCPeerConnection } = await loadWrtc();
  const pc = new RTCPeerConnection();

  if (args.onRemoteTrack) {
    pc.ontrack = (event) => {
      args.onRemoteTrack?.(event.track, event.streams);
    };
  }

  const offer = await pc.createOffer({ offerToReceiveAudio: true });
  await pc.setLocalDescription(offer);

  const response = await fetch(REALTIME_SDP_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.realtimeModel,
      session: {
        instructions: [
          'You are a sales/support voice agent.',
          'Languages: Kinyarwanda and English (auto detect).',
          'Respect calling hours; handle opt-out; barge-in enabled.',
        ],
        vad: { enable: true, mode: 'default' },
        barge_in: true,
        tools: [
          {
            name: 'lookupLead',
            schema: {
              type: 'object',
              properties: { phone: { type: 'string' } },
              required: ['phone'],
            },
          },
          {
            name: 'createQuote',
            schema: {
              type: 'object',
              properties: { sku: { type: 'string' }, qty: { type: 'number' } },
              required: ['sku', 'qty'],
            },
          },
        ],
      },
      sdp: offer.sdp,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(`Realtime SDP exchange failed (${response.status}) ${text}`);
    throw new Error(`Realtime SDP exchange failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    sdp: string;
    iceServers?: RTCIceServer[];
  };

  if (Array.isArray(payload.iceServers) && payload.iceServers.length > 0) {
    pc.setConfiguration({ iceServers: payload.iceServers });
  }

  await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp });

  return new RealtimePeer(pc);
}

type WrtcModule = typeof import('wrtc');
let wrtcModule: WrtcModule | null = null;

async function loadWrtc(): Promise<WrtcModule> {
  if (!wrtcModule) {
    wrtcModule = await import('wrtc');
  }
  return wrtcModule;
}
