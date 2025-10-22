import type {
  MediaStream,
  MediaStreamTrack,
  RTCIceCandidateInit,
  RTCIceServer,
  RTCPeerConnection,
  RTCPeerConnectionIceEvent,
  RTCSessionDescriptionInit,
  RTCRtpTransceiver,
} from 'wrtc';

type CreateWaPeerArgs = {
  callId: string;
  remoteOfferSdp: string;
  outboundTrack?: MediaStreamTrack | null;
  outboundStream?: MediaStream | null;
  onRemoteTrack: (track: MediaStreamTrack, streams: MediaStream[]) => void;
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;
  iceServers?: RTCIceServer[];
};

type WrtcModule = typeof import('wrtc');

let wrtcModule: WrtcModule | null = null;

async function getWrtc(): Promise<WrtcModule> {
  if (!wrtcModule) {
    wrtcModule = await import('wrtc');
  }
  return wrtcModule;
}

export class WaPeer {
  constructor(
    public readonly pc: RTCPeerConnection,
    private readonly outbound: RTCRtpTransceiver,
  ) {}

  get localDescription() {
    return this.pc.localDescription;
  }

  async addRemoteIce(candidate: RTCIceCandidateInit) {
    await this.pc.addIceCandidate(candidate);
  }

  async setRemoteDescription(sdp: string, type: RTCSessionDescriptionInit['type'] = 'offer') {
    await this.pc.setRemoteDescription({ type, sdp });
  }

  async setOutboundTrack(track: MediaStreamTrack, stream?: MediaStream) {
    await this.outbound.sender.replaceTrack(track);
    if (stream) {
      this.outbound.sender.setStreams(stream);
    }
  }

  close() {
    this.pc.close();
  }
}

export async function createWaPeer(args: CreateWaPeerArgs): Promise<WaPeer> {
  const { RTCPeerConnection } = await getWrtc();
  const pc = new RTCPeerConnection({
    iceServers: args.iceServers ?? [],
  });

  pc.ontrack = (event) => {
    args.onRemoteTrack(event.track, event.streams);
  };

  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate && args.onIceCandidate) {
      args.onIceCandidate(event.candidate);
    }
  };

  const outbound = pc.addTransceiver('audio', { direction: 'sendonly' });
  if (args.outboundTrack) {
    await outbound.sender.replaceTrack(args.outboundTrack);
  }
  if (args.outboundStream) {
    outbound.sender.setStreams(args.outboundStream);
  }

  await pc.setRemoteDescription({ type: 'offer', sdp: args.remoteOfferSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  return new WaPeer(pc, outbound);
}
